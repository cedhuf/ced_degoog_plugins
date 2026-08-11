// Karakeep for Degoog
//
// One plugin, two extension points, a single settings panel:
//   - slot        renders an "In your bookmarks" panel next to the results
//   - interceptor "Karakeep First" routes the search straight to the Karakeep
//                 tab when your bookmarks already answer the query
//
// Both are grouped under the `plugin` manifest below, so Degoog registers them
// as a single configurable entry (requires Degoog >= 0.24.0).
//
// Karakeep REST API: GET /api/v1/bookmarks/search?q=<query>&limit=<n>
// Auth:              Authorization: Bearer <api-key>
// Karakeep web UI:   /?q=<query>   (used for the "View all" links)
// API docs:          https://docs.karakeep.app/api/karakeep-api/
//
// isClientExposed: false, so every request goes through the Degoog server.

// ── Plugin manifest ───────────────────────────────────────────────────────────
// Ties the slot and the interceptor to one id. Degoog stores their settings
// under that id and hides the interceptor from the extension list.

export const plugin = {
  id: "karakeep-slot",
  name: "Karakeep",
  description:
    "Surfaces bookmarks from your self-hosted Karakeep instance inside Degoog.",
};

// ── State ─────────────────────────────────────────────────────────────────────

const cfg = {
  url: "",
  apiKey: "",
  panelEnabled: true,
  limit: 5,
  style: "inline",
  detail: "snippet",
  firstEnabled: false,
  firstThreshold: 3,
};

// Built by init() from ctx.routeUrl, so the plugin never has to guess its id.
let _skipRoute = "/api/plugin/karakeep-slot/skip";

// The interceptor pre-fetches, the slot serves from this cache. One Karakeep
// round-trip per query instead of two.
const _prefetchCache = new Map(); // query -> { results, ts, activated }
const _skipOnce = new Set(); // queries to let through untouched, once
const PREFETCH_TTL = 30_000;
const PREFETCH_TIMEOUT = 2_000;
const SKIP_TTL = 60_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const _isConfigured = () => Boolean(cfg.url && cfg.apiKey);

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

const _headers = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${cfg.apiKey}`,
});

function _getCached(q) {
  const entry = _prefetchCache.get(q);
  if (!entry || Date.now() - entry.ts > PREFETCH_TTL) {
    _prefetchCache.delete(q);
    return null;
  }
  return entry;
}

// Karakeep error bodies carry the useful part, so surface it in the panel.
function _errorFor(status, body) {
  let detail = "";
  try {
    const parsed = JSON.parse(body);
    detail = parsed.message || parsed.error || parsed.details || "";
  } catch {
    detail = body.slice(0, 200);
  }
  const suffix = detail ? ` Karakeep says: "${detail}"` : "";

  if (status === 401 || status === 403)
    return `Karakeep returned HTTP ${status} (unauthorized). Check your API key in Settings.${suffix}`;
  if (status === 500)
    return `Karakeep returned HTTP 500. This usually means Meilisearch, its search backend, is down or unreachable from your Karakeep instance. Check your Karakeep logs.${suffix}`;
  return `Karakeep returned HTTP ${status}. Check the instance URL in Settings.${suffix}`;
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const params = new URLSearchParams({ q: query, limit: String(limit || 10) });
  const res = await doFetch(`${cfg.url}/api/v1/bookmarks/search?${params}`, {
    headers: _headers(),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(_errorFor(res.status, body));

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Karakeep returned an unexpected response (not JSON).");
  }
  return Array.isArray(data.bookmarks) ? data.bookmarks : [];
}

// ── Bookmark rendering ────────────────────────────────────────────────────────

const _title = (b) =>
  b.title || b.content?.title || b.content?.fileName || "Untitled";

function _url(b) {
  const c = b.content;
  if (!c) return null;
  if (c.type === "link") return c.url || null;
  if (c.type === "text" || c.type === "asset") return c.sourceUrl || null;
  return null;
}

function _snippet(b) {
  const c = b.content;
  return (
    b.summary ||
    c?.description ||
    b.note ||
    (c?.type === "text" ? c.text : "") ||
    (c?.type === "asset" ? c.content : "") ||
    ""
  ).slice(0, 280);
}

function _renderTags(tags) {
  if (!tags?.length) return "";
  const items = tags
    .slice(0, 6)
    .map((t) => `<span class="kk-tag">#${_esc(t.name)}</span>`)
    .join("");
  return `<div class="kk-tags">${items}</div>`;
}

function _renderResult(b) {
  const url = _url(b);
  const title = _title(b);
  const snippet = cfg.detail !== "title" ? _snippet(b) : "";
  const tags = cfg.detail === "full" ? _renderTags(b.tags) : "";
  const favicon = b.content?.favicon
    ? `<img class="kk-favicon" src="${_esc(b.content.favicon)}" alt="" width="14" height="14" loading="lazy">`
    : "";

  const titleEl = url
    ? `<a class="kk-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${favicon}${_esc(title)}</a>`
    : `<span class="kk-result-title">${favicon}${_esc(title)}</span>`;

  return `
    <div class="kk-result">
      ${titleEl}
      ${url && cfg.detail === "full" ? `<div class="kk-result-url">${_esc(url)}</div>` : ""}
      ${snippet ? `<div class="kk-result-snippet">${_esc(snippet)}</div>` : ""}
      ${tags}
    </div>`;
}

// ── Slot ──────────────────────────────────────────────────────────────────────
// Owns the whole settings schema. The interceptor reads the same `cfg` object,
// so a single configure() keeps both sides in sync.

export const slot = {
  name: "Karakeep",
  description:
    "Shows bookmarks from your Karakeep instance alongside search results.",
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
      label: "Karakeep instance URL",
      type: "url",
      required: true,
      fieldset: "Connection",
      placeholder: "https://karakeep.example.com",
      description: "Base URL of your Karakeep instance, with no trailing slash.",
    },
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      required: true,
      secret: true,
      fieldset: "Connection",
      placeholder: "your-api-key",
      description: "Generate one in Karakeep under Settings > API Keys.",
    },

    {
      key: "panelEnabled",
      label: 'Show the "In your bookmarks" panel',
      type: "toggle",
      default: true,
      fieldset: "Panel",
      description:
        "Display matching bookmarks next to the Degoog results.",
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
      default: "snippet",
      fieldset: "Panel",
      description:
        "title is the link only, snippet adds the AI summary, full adds the URL and tags.",
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
      description: "How many bookmarks the panel lists at most.",
    },

    {
      key: "firstEnabled",
      label: "Karakeep First",
      type: "toggle",
      default: false,
      fieldset: "Karakeep First",
      description:
        "When your bookmarks already answer the query, send the search straight " +
        "to the Karakeep tab instead of the web engines. A banner always offers " +
        "a way back to the full results.",
    },
    {
      key: "firstThreshold",
      label: "Minimum results to trigger",
      type: "range",
      min: "1",
      max: "50",
      step: "1",
      default: "3",
      fieldset: "Karakeep First",
      visibleWhen: { key: "firstEnabled", equals: "true" },
      description: "How many matching bookmarks it takes to redirect.",
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
      : "snippet";
    cfg.limit = _clamp(settings.limit, 1, 20, 5);
    cfg.firstEnabled = _bool(settings.firstEnabled ?? false);
    cfg.firstThreshold = _clamp(settings.firstThreshold, 1, 50, 3);
  },

  init(ctx) {
    _skipRoute = ctx.routeUrl("/skip");
  },

  trigger(query) {
    // Bang pages such as ?q=!karakeep+rust would otherwise search Karakeep for
    // the literal "!karakeep rust" string.
    if (query && /^!/.test(query.trim())) return false;
    return _isConfigured() && cfg.panelEnabled;
  },

  async execute(query, context) {
    const q = query.trim();

    const cached = _getCached(q);
    let bookmarks = cached?.results;

    if (!bookmarks) {
      try {
        bookmarks = await _search(q, context?.fetch, cfg.limit);
      } catch (err) {
        return {
          html: `<div class="kk-slot kk-error">${_esc(err.message)}</div>`,
        };
      }
    }

    const displayed = bookmarks.slice(0, cfg.limit);
    if (!displayed.length) return { html: "" };

    const total = bookmarks.length;
    const viewAll = `${cfg.url}/?q=${encodeURIComponent(q)}`;
    const items = displayed.map(_renderResult).join("");

    // Only shown once Karakeep First actually redirected, so the user can opt
    // out of this one search. Rendered as a sibling of the panel: style.css
    // pins it as a fixed toast, which is what makes it readable page-wide.
    const banner =
      cfg.firstEnabled && cached?.activated
        ? `
      <div class="kk-first-banner">
        <span class="kk-first-info">${total} bookmark${total !== 1 ? "s" : ""} found</span>
        <a class="kk-first-all" href="${_esc(`${_skipRoute}?q=${encodeURIComponent(q)}`)}">Search all engines &rarr;</a>
      </div>`
        : "";

    const viewAllLink = `<a class="kk-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all &rarr;</a>`;

    if (cfg.style === "card") {
      return {
        html: `${banner}
        <div class="kk-slot kk-card kk-detail-${cfg.detail}">
          <div class="kk-slot-header">
            <span class="kk-dot" aria-hidden="true">&bull;</span>
            <span class="kk-slot-label">Karakeep</span>
            ${viewAllLink}
          </div>
          <div class="kk-results">${items}</div>
        </div>`,
      };
    }

    return {
      html: `${banner}
      <div class="kk-slot kk-inline kk-detail-${cfg.detail}">
        <div class="kk-results">${items}</div>
        <div class="kk-footer">
          <span class="kk-dot" aria-hidden="true">&bull;</span>
          <span class="kk-footer-label">Karakeep</span>
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
  name: "Karakeep First",
  description:
    "Routes the search to the Karakeep tab when your bookmarks have enough results.",
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
        ? { query, overrides: { searchType: "karakeep" } }
        : { query };
    }

    // Hard timeout: a slow or unreachable Karakeep must never stall the search.
    try {
      const results = await Promise.race([
        _search(q, context?.fetch, 50),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), PREFETCH_TIMEOUT),
        ),
      ]);
      const activated = results.length >= cfg.firstThreshold;
      _prefetchCache.set(q, { results, ts: Date.now(), activated });
      if (activated) return { query, overrides: { searchType: "karakeep" } };
    } catch (err) {
      console.warn(`[karakeep] prefetch skipped: ${err.message}`);
    }

    return { query };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // Opts this query out of Karakeep First, then bounces to a normal search.
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
