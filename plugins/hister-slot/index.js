// Hister Slot plugin for Degoog
// Shows pages from your personal Hister history index alongside search results.
//
// "Hister First" mode: when enabled and enough history results are found, the
// interceptor returns { overrides: { searchType: "hister" } } so Degoog routes
// the search server-side to the dedicated Hister tab (requires Degoog develop).
// The interceptor fetches synchronously but is capped to 2 s to avoid blocking
// the search pipeline if Hister is slow or unreachable.
//
// Hister search API: GET /search?query=<JSON>
// Hister SPA URL:    /?q=<query>  (used for "View all" links)
//
// Requires Degoog develop (≥ 0.17.0 + interceptor overrides patch)
// isClientExposed: false → all requests go through the Degoog server

import { basename } from "node:path";

const cfg = {
  url: "",
  apiKey: "",
  slotEnabled: true,
  slotPosition: "above-results",
  slotLimit: 5,
  slotStyle: "inline",
  slotDetail: "title",
};

let _histerFirstEnabled = false;
let _histerFirstThreshold = 10;
let _folderName = "hister-slot";

// Shared cache: interceptor pre-fetches, slot serves from cache (no double fetch)
const _prefetchCache = new Map(); // q → { results, ts, activated }
const _skipOnce = new Set(); // queries to let through normally once
const PREFETCH_TTL = 30_000; // 30 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

// Degoog can deliver toggle values as the string "false" — Boolean("false") is
// true, which would silently enable features the user disabled. Use _bool() for
// all settings that come from toggle/select fields.
function _bool(v) {
  if (v === true  || v === "true")  return true;
  if (v === false || v === "false") return false;
  return Boolean(v);
}

function _headers() {
  const h = { Accept: "application/json", Origin: cfg.url };
  if (cfg.apiKey) {
    h["Authorization"] = `Bearer ${cfg.apiKey}`;
    h["X-Access-Token"] = cfg.apiKey;
  }
  return h;
}

function _getCached(q) {
  const e = _prefetchCache.get(q);
  if (!e || Date.now() - e.ts > PREFETCH_TTL) {
    _prefetchCache.delete(q);
    return null;
  }
  return e;
}

// Strip the "hister:" prefix the interceptor may have injected into the query.
function _cleanQuery(q) {
  return q.replace(/^hister:/i, "").trim() || q;
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const qObj = { text: query, include_text: true };
  if (limit) qObj.limit = limit;
  const q = encodeURIComponent(JSON.stringify(qObj));
  const res = await doFetch(`${cfg.url}/search?query=${q}`, {
    headers: _headers(),
  });
  if (!res.ok) {
    if (
      !cfg.apiKey &&
      (res.status === 401 || res.status === 403 || res.status === 500)
    ) {
      throw new Error(
        `Hister returned HTTP ${res.status}. If your instance requires authentication, ` +
          `set your Access Token in Settings → Plugins → Hister Slot → API Key.`,
      );
    }
    throw new Error(
      `Hister returned HTTP ${res.status}. Check the URL in Settings → Plugins → Hister Slot.`,
    );
  }
  let data;
  try {
    data = JSON.parse(await res.text());
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
  // Return raw results — callers apply _dedupe as needed
  return Array.isArray(raw) ? raw : [];
}

function _dedupe(results) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return results.filter((r) => {
    const rawUrl = r.URL || r.url || "";
    const base = rawUrl.split("?")[0].toLowerCase();
    const title = (r.Title || r.title || "").toLowerCase().trim();
    if ((base && seenUrls.has(base)) || (title && seenTitles.has(title)))
      return false;
    if (base) seenUrls.add(base);
    if (title) seenTitles.add(title);
    return true;
  });
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderResult(r) {
  const title = r.Title || r.title || r.URL || r.url || "Untitled";
  const url = r.URL || r.url || "#";
  const content =
    r.Content || r.content || r.Body || r.body || r.text || r.Text || "";
  const snippet =
    r.Snippet || r.snippet || r.Excerpt || r.excerpt || content.slice(0, 200);
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

// ── Interceptor ───────────────────────────────────────────────────────────────
// Hister First: fetches Hister results before the search runs to decide whether
// to route to the dedicated Hister tab. Capped at 2 s so a slow/unreachable
// Hister never blocks the search pipeline and triggers "Search failed".

export const interceptor = {
  isClientExposed: false,
  name:            "Hister First",
  description:     "Routes to the Hister tab when your history has enough results.",

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  async intercept(query, context) {
    const q = query.trim();

    // Skip: bang command, feature disabled, or not configured
    if (!q || /^!/.test(q) || !_histerFirstEnabled || !_isConfigured()) {
      return { query };
    }

    // User clicked "Search all engines →" — pass through once
    if (_skipOnce.has(q)) { _skipOnce.delete(q); return { query }; }

    // Cache hit — routing decision is already known, no need to fetch again
    const cached = _getCached(q);
    if (cached) {
      return cached.activated
        ? { query, overrides: { searchType: "hister" } }
        : { query };
    }

    // Fetch with a 2 s hard cap — prevents hanging the search pipeline when
    // Hister is slow or unreachable. On timeout we fall through to { query }.
    try {
      const raw = await Promise.race([
        _search(q, context?.fetch, 50),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("prefetch timeout")), 2000),
        ),
      ]);
      const activated = raw.length >= _histerFirstThreshold;
      const results   = _dedupe(raw);
      _prefetchCache.set(q, { results, ts: Date.now(), activated });
      console.log(
        `[hister-slot] prefetch ${raw.length} raw / ${results.length} unique for "${q}" — activated=${activated}`,
      );
      if (activated) {
        return { query, overrides: { searchType: "hister" } };
      }
    } catch (err) {
      console.log(`[hister-slot] prefetch skipped: ${err.message}`);
    }

    return { query };
  },
};

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id: "hister-slot",
  name: "Hister Slot",
  description:
    "Shows pages from your personal Hister history index alongside search results.",
  position: "above-results",
  isClientExposed: false,

  settingsSchema: [
    {
      key: "url",
      label: "Hister Instance URL",
      type: "url",
      required: true,
      placeholder: "https://hister.example.com",
      description: "Base URL of your Hister instance (no trailing slash).",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: false,
      placeholder: "(optional)",
      description:
        "Your Hister Access Token (Hister → Profile → Access Token). Required if your instance uses authentication.",
      secret: true,
    },
    {
      key: "slotEnabled",
      label: 'Show "In your index" panel',
      type: "toggle",
      default: true,
      description:
        "Display pages from your Hister index alongside Degoog search results.",
    },
    {
      key: "slotPosition",
      label: "Panel position",
      type: "select",
      options: [
        "above-results",
        "below-results",
        "knowledge-panel",
        "above-sidebar",
      ],
      default: "above-results",
      description: "Where to display the Hister panel on the results page.",
    },
    {
      key: "slotStyle",
      label: "Display style",
      type: "select",
      options: ["inline", "card"],
      default: "inline",
      description:
        "inline — blends with native results · card — compact bordered panel",
    },
    {
      key: "slotDetail",
      label: "Detail level",
      type: "select",
      options: ["title", "snippet", "full"],
      default: "full",
      description:
        "title — link only · snippet — title + excerpt · full — title + URL + excerpt",
    },
    {
      key: "slotLimit",
      label: "Results to show in panel",
      type: "text",
      default: "5",
      placeholder: "5",
      description:
        "Maximum number of Hister results displayed in the panel (1–20).",
    },
    // ── Hister First ──────────────────────────────────────────────────────────
    {
      key: "histerFirst",
      label: "Hister First mode",
      type: "toggle",
      default: false,
      description:
        "When your Hister history has enough results, automatically route the search " +
        "to the dedicated Hister tab instead of global search. The slot panel still " +
        "shows a \"Search all engines →\" link to opt out.",
    },
    {
      key: "histerFirstThreshold",
      label: "Minimum results to activate",
      type: "text",
      default: "10",
      placeholder: "10",
      description:
        "Minimum number of Hister results (before deduplication) needed to activate " +
        "Hister First routing (1–50).",
    },
  ],

  configure(settings) {
    cfg.url       = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey    = settings.apiKey || "";
    // Use explicit _bool() — Degoog can store toggle values as the string "false"
    cfg.slotEnabled  = settings.slotEnabled  === undefined ? true : _bool(settings.slotEnabled);
    cfg.slotPosition = settings.slotPosition || "above-results";
    cfg.slotStyle    = settings.slotStyle === "card" ? "card" : "inline";
    cfg.slotDetail   = ["title", "snippet", "full"].includes(settings.slotDetail)
      ? settings.slotDetail
      : "title";
    cfg.slotLimit = Math.max(
      1,
      Math.min(20, parseInt(settings.slotLimit, 10) || 5),
    );
    slot.position = cfg.slotPosition;

    _histerFirstEnabled = _bool(settings.histerFirst ?? false);
    _histerFirstThreshold = Math.max(
      1,
      Math.min(50, parseInt(settings.histerFirstThreshold || "10", 10)),
    );
  },

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  trigger(query) {
    // Don't run on bang-command pages (e.g. ?q=!hister+bandcamp) — the slot
    // would search Hister for the literal "!hister bandcamp" string.
    if (query && /^!/.test(query.trim())) return false;
    const ok = _isConfigured() && cfg.slotEnabled;
    if (!ok) {
      console.log(
        `[hister-slot] trigger=false — configured=${_isConfigured()} slotEnabled=${cfg.slotEnabled} url="${cfg.url}"`,
      );
    }
    return ok;
  },

  async execute(query, context) {
    // Strip "hister:" prefix the interceptor may have injected
    const q = _cleanQuery(query);
    console.log(`[hister-slot] execute q="${q}" cacheHit=${Boolean(_getCached(q))}`);

    // Use pre-fetched cache when available — no double Hister round-trip
    const cached = _getCached(q);
    let results;
    if (cached) {
      results = cached.results;
      console.log(`[hister-slot] served ${results.length} from cache`);
    } else {
      try {
        const raw = await _search(q, context?.fetch);
        results   = _dedupe(raw);
        console.log(`[hister-slot] fetched ${raw.length} raw / ${results.length} unique`);
      } catch (err) {
        console.log(`[hister-slot] fetch error: ${err.message}`);
        return {
          html: `<div class="hister-slot hister-error"><p>${_esc(err.message)}</p></div>`,
        };
      }
    }

    const displayed = results.slice(0, cfg.slotLimit);
    console.log(`[hister-slot] displaying ${displayed.length} / ${results.length}`);
    if (!displayed.length) return { html: "" };

    // Interceptor handles server-side routing — slot just renders the panel
    const histerFirst = _histerFirstEnabled && (cached?.activated ?? false);
    const total   = results.length;
    const viewAll = `${cfg.url}/?q=${encodeURIComponent(q)}`;
    const skipUrl = `/api/plugin/${_folderName}/skip?q=${encodeURIComponent(q)}`;
    const items   = displayed.map(_renderResult).join("");
    const detail  = `hister-detail-${cfg.slotDetail}`;

    // Banner shown on the Hister tab after the redirect, so the user can opt out.
    const banner = histerFirst
      ? `
      <div class="hister-first-banner">
        <span class="hister-first-info">${total} result${total !== 1 ? "s" : ""} from your history</span>
        <a class="hister-first-all" href="${_esc(skipUrl)}">Search all engines →</a>
      </div>`
      : "";

    const footer = `
      <div class="hister-footer">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-footer-label">Hister</span>
        <a class="hister-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    const header = `
      <div class="hister-slot-header">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-slot-label">Hister</span>
        <a class="hister-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    if (cfg.slotStyle === "inline") {
      return {
        html: `
          <div class="hister-slot hister-inline ${detail}">
            ${banner}
            <div class="hister-results">${items}</div>
            ${footer}
          </div>`,
      };
    }

    return {
      html: `
        <div class="hister-slot hister-card ${detail}">
          ${header}
          ${banner}
          <div class="hister-results">${items}</div>
        </div>`,
    };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/hister-slot/debug
    // Returns current plugin state — useful to verify the plugin version is loaded.
    method: "get",
    path: "/debug",
    handler(_req) {
      return new Response(
        JSON.stringify({
          configured: _isConfigured(),
          url: cfg.url
            ? cfg.url.replace(/^https?:\/\//, "").split("/")[0]
            : null,
          histerFirst: _histerFirstEnabled,
          threshold: _histerFirstThreshold,
          folderName: _folderName,
          cacheSize: _prefetchCache.size,
          skipOnceSize: _skipOnce.size,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  },
  {
    // GET /api/plugin/hister-slot/skip?q=<query>
    // Marks the query as skip-once so the interceptor won't activate on the
    // next search, then redirects to a normal Degoog search (all engines).
    method: "get",
    path: "/skip",
    handler(req) {
      try {
        const url = new URL(req.url);
        const q = url.searchParams.get("q") || "";
        if (q) {
          _skipOnce.add(q);
          setTimeout(() => _skipOnce.delete(q), 60_000);
        }
        return new Response(null, {
          status: 302,
          headers: { Location: `/search?q=${encodeURIComponent(q)}` },
        });
      } catch {
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
    },
  },
];

export default { slot, interceptor };
