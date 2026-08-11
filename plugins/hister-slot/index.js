// Hister for Degoog
//
// One plugin, two extension points, a single settings panel:
//   - slot        renders an "In your index" panel next to the search results
//   - interceptor "Hister First" routes the search straight to the Hister tab
//                 when your history already has enough matches
//
// Both are grouped under the `plugin` manifest below, so Degoog registers them
// as a single configurable entry (requires Degoog >= 0.24.0).
//
// Hister search API: GET /search?query=<JSON>
// Hister SPA URL:    /?q=<query>   (used for the "View all" links)
//
// isClientExposed: false, so every request goes through the Degoog server.

// ── Plugin manifest ───────────────────────────────────────────────────────────
// Ties the slot and the interceptor to one id. Degoog stores their settings
// under that id and hides the interceptor from the extension list.

export const plugin = {
  id: "hister-slot",
  name: "Hister",
  description:
    "Surfaces pages from your personal Hister history index inside Degoog.",
};

// ── State ─────────────────────────────────────────────────────────────────────

const cfg = {
  url: "",
  apiKey: "",
  panelEnabled: true,
  limit: 5,
  style: "inline",
  detail: "full",
  firstEnabled: false,
  firstThreshold: 10,
};

// Built by init() from ctx.routeUrl, so the plugin never has to guess its id.
let _skipRoute = "/api/plugin/hister-slot/skip";

// The interceptor pre-fetches, the slot serves from this cache. One Hister
// round-trip per query instead of two.
const _prefetchCache = new Map(); // query -> { results, ts, activated }
const _skipOnce = new Set(); // queries to let through untouched, once
const PREFETCH_TTL = 30_000;
const PREFETCH_TIMEOUT = 2_000;
const SKIP_TTL = 60_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const _isConfigured = () => Boolean(cfg.url);

// Degoog stores toggles as the string "false", and Boolean("false") is true.
const _bool = (v) => (v === true || v === "true" ? true : v === false || v === "false" ? false : Boolean(v));

const _clamp = (v, min, max, fallback) =>
  Math.max(min, Math.min(max, parseInt(v, 10) || fallback));

const _esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function _headers() {
  const h = { Accept: "application/json", Origin: cfg.url };
  if (cfg.apiKey) {
    h["Authorization"] = `Bearer ${cfg.apiKey}`;
    h["X-Access-Token"] = cfg.apiKey;
  }
  return h;
}

function _getCached(q) {
  const entry = _prefetchCache.get(q);
  if (!entry || Date.now() - entry.ts > PREFETCH_TTL) {
    _prefetchCache.delete(q);
    return null;
  }
  return entry;
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const payload = { text: query, include_text: true };
  if (limit) payload.limit = limit;
  const res = await doFetch(
    `${cfg.url}/search?query=${encodeURIComponent(JSON.stringify(payload))}`,
    { headers: _headers() },
  );

  if (!res.ok) {
    const needsAuth =
      !cfg.apiKey && [401, 403, 500].includes(res.status);
    throw new Error(
      needsAuth
        ? `Hister returned HTTP ${res.status}. If your instance requires authentication, set your Access Token in Settings.`
        : `Hister returned HTTP ${res.status}. Check the instance URL in Settings.`,
    );
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Hister returned an unexpected response.");
  }

  const raw =
    data.Documents ??
    data.documents ??
    data.results ??
    data.hits ??
    data.items ??
    (Array.isArray(data) ? data : []);
  return Array.isArray(raw) ? raw : [];
}

// Hister indexes a page once per visit, so the same URL (or the same title on
// a rewritten URL) can come back several times.
function _dedupe(results) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return results.filter((r) => {
    const base = (r.URL || r.url || "").split("?")[0].toLowerCase();
    const title = (r.Title || r.title || "").toLowerCase().trim();
    if ((base && seenUrls.has(base)) || (title && seenTitles.has(title)))
      return false;
    if (base) seenUrls.add(base);
    if (title) seenTitles.add(title);
    return true;
  });
}

function _renderResult(r) {
  const url = r.URL || r.url || "#";
  const title = r.Title || r.title || url;
  const body = r.Content || r.content || r.Body || r.body || r.text || r.Text || "";
  const snippet =
    r.Snippet || r.snippet || r.Excerpt || r.excerpt || body.slice(0, 200);
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

// ── Slot ──────────────────────────────────────────────────────────────────────
// Owns the whole settings schema. The interceptor reads the same `cfg` object,
// so a single configure() keeps both sides in sync.

export const slot = {
  name: "Hister",
  description:
    "Shows pages from your personal Hister history index alongside search results.",
  isClientExposed: false,
  position: "above-results",
  // Degoog renders the "Position" select from this list on its own.
  slotPositions: [
    "above-results",
    "full-width-above-results",
    "below-results",
    "knowledge-panel",
    "above-sidebar",
    "below-sidebar",
  ],

  settingsSchema: [
    {
      key: "url",
      label: "Hister instance URL",
      type: "url",
      required: true,
      fieldset: "Connection",
      placeholder: "https://hister.example.com",
      description: "Base URL of your Hister instance, with no trailing slash.",
    },
    {
      key: "apiKey",
      label: "Access token",
      type: "password",
      secret: true,
      fieldset: "Connection",
      placeholder: "(optional)",
      description:
        "Found in Hister under Profile > Access Token. Required only if your instance uses authentication.",
    },

    {
      key: "panelEnabled",
      label: 'Show the "In your index" panel',
      type: "toggle",
      default: true,
      fieldset: "Panel",
      description:
        "Display matching pages from your index next to the Degoog results.",
    },
    {
      key: "style",
      label: "Display style",
      type: "select",
      options: ["inline", "card"],
      default: "inline",
      fieldset: "Panel",
      description:
        "inline blends with the native results, card is a compact bordered panel.",
    },
    {
      key: "detail",
      label: "Detail level",
      type: "select",
      options: ["title", "snippet", "full"],
      default: "full",
      fieldset: "Panel",
      description:
        "title is the link only, snippet adds an excerpt, full adds the URL too.",
    },
    {
      key: "limit",
      label: "Results in the panel",
      type: "range",
      min: "1",
      max: "20",
      step: "1",
      default: "5",
      fieldset: "Panel",
      description: "How many Hister results the panel lists at most.",
    },

    {
      key: "firstEnabled",
      label: "Hister First",
      type: "toggle",
      default: false,
      fieldset: "Hister First",
      description:
        "When your history already answers the query, send the search straight " +
        "to the Hister tab instead of the web engines. A banner always offers a " +
        "way back to the full results.",
    },
    {
      key: "firstThreshold",
      label: "Minimum results to trigger",
      type: "range",
      min: "1",
      max: "50",
      step: "1",
      default: "10",
      fieldset: "Hister First",
      visibleWhen: { key: "firstEnabled", equals: "true" },
      description:
        "How many Hister matches, before deduplication, it takes to redirect.",
    },
  ],

  configure(settings) {
    cfg.url = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey = settings.apiKey || "";
    cfg.panelEnabled =
      settings.panelEnabled === undefined ? true : _bool(settings.panelEnabled);
    cfg.style = settings.style === "card" ? "card" : "inline";
    cfg.detail = ["title", "snippet", "full"].includes(settings.detail)
      ? settings.detail
      : "full";
    cfg.limit = _clamp(settings.limit, 1, 20, 5);
    cfg.firstEnabled = _bool(settings.firstEnabled ?? false);
    cfg.firstThreshold = _clamp(settings.firstThreshold, 1, 50, 10);
  },

  init(ctx) {
    _skipRoute = ctx.routeUrl("/skip");
  },

  trigger(query) {
    // Bang pages such as ?q=!hister+bandcamp would otherwise search Hister for
    // the literal "!hister bandcamp" string.
    if (query && /^!/.test(query.trim())) return false;
    return _isConfigured() && cfg.panelEnabled;
  },

  async execute(query, context) {
    const q = query.replace(/^hister:/i, "").trim() || query;

    const cached = _getCached(q);
    let results = cached?.results;

    if (!results) {
      try {
        results = _dedupe(await _search(q, context?.fetch));
      } catch (err) {
        return {
          html: `<div class="hister-slot hister-error">${_esc(err.message)}</div>`,
        };
      }
    }

    const displayed = results.slice(0, cfg.limit);
    if (!displayed.length) return { html: "" };

    const viewAll = `${cfg.url}/?q=${encodeURIComponent(q)}`;
    const items = displayed.map(_renderResult).join("");

    // Only shown once Hister First actually redirected, so the user can opt out
    // of this one search. Rendered as a sibling of the panel: style.css pins it
    // as a fixed toast, which is what makes it readable page-wide.
    const banner =
      cfg.firstEnabled && cached?.activated
        ? `
      <div class="hister-first-banner">
        <span class="hister-first-info">${results.length} result${results.length !== 1 ? "s" : ""} from your history</span>
        <a class="hister-first-all" href="${_esc(`${_skipRoute}?q=${encodeURIComponent(q)}`)}">Search all engines &rarr;</a>
      </div>`
        : "";

    const viewAllLink = `<a class="hister-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all &rarr;</a>`;

    if (cfg.style === "card") {
      return {
        html: `${banner}
        <div class="hister-slot hister-card hister-detail-${cfg.detail}">
          <div class="hister-slot-header">
            <span class="hister-dot" aria-hidden="true">&bull;</span>
            <span class="hister-slot-label">Hister</span>
            ${viewAllLink}
          </div>
          <div class="hister-results">${items}</div>
        </div>`,
      };
    }

    return {
      html: `${banner}
      <div class="hister-slot hister-inline hister-detail-${cfg.detail}">
        <div class="hister-results">${items}</div>
        <div class="hister-footer">
          <span class="hister-dot" aria-hidden="true">&bull;</span>
          <span class="hister-footer-label">Hister</span>
          ${viewAllLink}
        </div>
      </div>`,
    };
  },
};

// ── Interceptor ───────────────────────────────────────────────────────────────
// No settingsSchema and no configure(): it shares `cfg` with the slot, and the
// manifest already routes both to the same settings panel.

export const interceptor = {
  name: "Hister First",
  description:
    "Routes the search to the Hister tab when your history has enough results.",
  isClientExposed: false,

  async intercept(query, context) {
    const q = query.trim();
    if (!q || /^!/.test(q) || !cfg.firstEnabled || !_isConfigured())
      return { query };

    // The user just clicked "Search all engines", let this one through.
    if (_skipOnce.has(q)) {
      _skipOnce.delete(q);
      return { query };
    }

    const cached = _getCached(q);
    if (cached) {
      return cached.activated
        ? { query, overrides: { searchType: "hister" } }
        : { query };
    }

    // Hard timeout: a slow or unreachable Hister must never stall the search.
    try {
      const raw = await Promise.race([
        _search(q, context?.fetch, 50),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), PREFETCH_TIMEOUT),
        ),
      ]);
      const activated = raw.length >= cfg.firstThreshold;
      _prefetchCache.set(q, { results: _dedupe(raw), ts: Date.now(), activated });
      if (activated) return { query, overrides: { searchType: "hister" } };
    } catch (err) {
      console.warn(`[hister] prefetch skipped: ${err.message}`);
    }

    return { query };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // Opts this query out of Hister First, then bounces to a normal search.
    method: "get",
    path: "/skip",
    handler(req) {
      let q = "";
      try {
        q = new URL(req.url).searchParams.get("q") || "";
      } catch {
        // Fall through to the home page below.
      }

      if (q) {
        _skipOnce.add(q);
        // Clear the activation flag too, otherwise the slot re-renders the
        // banner on the all-engines page we are about to redirect to.
        const entry = _prefetchCache.get(q);
        if (entry) _prefetchCache.set(q, { ...entry, activated: false });
        setTimeout(() => _skipOnce.delete(q), SKIP_TTL);
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: q ? `/search?q=${encodeURIComponent(q)}` : "/",
        },
      });
    },
  },
];
