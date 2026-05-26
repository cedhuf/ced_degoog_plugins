// Karakeep Slot plugin for Degoog
// Shows bookmarks from your personal Karakeep instance alongside search results.
// "Karakeep First" mode: when enough bookmarks match, the interceptor routes the
// search server-side to the dedicated Karakeep tab instead of global search.
//
// Karakeep REST API: GET /api/v1/bookmarks/search?q=<query>&limit=<n>
// Auth:             Authorization: Bearer <api-key>
// Karakeep web UI:  /?q=<query>  (used for "View all" links)
//
// API docs: https://docs.karakeep.app/api/karakeep-api/
// Requires Degoog ≥ 0.17.0
// isClientExposed: false → all requests go through the Degoog server

import { basename } from "node:path";

const cfg = {
  url:          "",
  apiKey:       "",
  slotEnabled:  true,
  slotPosition: "above-results",
  slotLimit:    5,
  slotStyle:    "inline",
  slotDetail:   "snippet",
};

let _karakeepFirstEnabled   = false;
let _karakeepFirstThreshold = 3;
let _folderName             = "karakeep-slot";

// Shared cache: interceptor pre-fetches, slot serves from cache (no double fetch)
const _prefetchCache = new Map(); // q → { results, ts, activated }
const _skipOnce      = new Set(); // queries to let through normally once
const PREFETCH_TTL   = 30_000;   // 30 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url && cfg.apiKey);
}

function _headers() {
  return {
    Accept:        "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
}

function _getCached(q) {
  const e = _prefetchCache.get(q);
  if (!e || Date.now() - e.ts > PREFETCH_TTL) {
    _prefetchCache.delete(q);
    return null;
  }
  return e;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const params  = new URLSearchParams({ q: query, limit: String(limit || 10) });
  const res     = await doFetch(
    `${cfg.url}/api/v1/bookmarks/search?${params}`,
    { headers: _headers() },
  );

  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }

  if (!res.ok) {
    let detail = "";
    try {
      const j = JSON.parse(body);
      detail = j.message || j.error || j.details || "";
    } catch { detail = body.slice(0, 200); }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Karakeep returned HTTP ${res.status} (Unauthorized). ` +
        `Check your API Key in Settings → Plugins → Karakeep Slot.` +
        (detail ? ` — ${detail}` : ""),
      );
    }
    if (res.status === 500) {
      throw new Error(
        `Karakeep returned HTTP 500. The most common cause is that ` +
        `Meilisearch (the search backend) is not running or not reachable ` +
        `by your Karakeep instance. Check your Karakeep logs and make sure ` +
        `Meilisearch is healthy.` +
        (detail ? ` Karakeep says: "${detail}"` : ""),
      );
    }
    throw new Error(
      `Karakeep returned HTTP ${res.status}. ` +
      `Check the URL in Settings → Plugins → Karakeep Slot.` +
      (detail ? ` — ${detail}` : ""),
    );
  }

  let data;
  try { data = JSON.parse(body); } catch {
    throw new Error("Karakeep returned an unexpected response (not JSON).");
  }
  return Array.isArray(data.bookmarks) ? data.bookmarks : [];
}

// ── Bookmark field extractors ─────────────────────────────────────────────────

function _getTitle(b) {
  return b.title || b.content?.title || b.content?.fileName || "Untitled";
}

function _getUrl(b) {
  const c = b.content;
  if (!c) return null;
  if (c.type === "link")  return c.url       || null;
  if (c.type === "text")  return c.sourceUrl || null;
  if (c.type === "asset") return c.sourceUrl || null;
  return null;
}

function _getSnippet(b) {
  const s =
    b.summary                                              ||
    b.content?.description                                 ||
    b.note                                                 ||
    (b.content?.type === "text"  ? b.content.text    : "") ||
    (b.content?.type === "asset" ? b.content.content : "") ||
    "";
  return s.slice(0, 280);
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
  const title   = _getTitle(b);
  const url     = _getUrl(b);
  const snippet = cfg.slotDetail !== "title" ? _getSnippet(b) : "";
  const tags    = cfg.slotDetail === "full"  ? _renderTags(b.tags) : "";

  const favicon =
    b.content?.favicon
      ? `<img class="kk-favicon" src="${_esc(b.content.favicon)}" ` +
        `alt="" width="14" height="14" loading="lazy">`
      : "";

  const urlLine =
    url && cfg.slotDetail === "full"
      ? `<div class="kk-result-url">${_esc(url)}</div>`
      : "";

  const titleEl = url
    ? `<a class="kk-result-title" href="${_esc(url)}" target="_blank" ` +
      `rel="noopener">${favicon}${_esc(title)}</a>`
    : `<span class="kk-result-title">${favicon}${_esc(title)}</span>`;

  return `
    <div class="kk-result">
      ${titleEl}
      ${urlLine}
      ${snippet ? `<div class="kk-result-snippet">${_esc(snippet)}</div>` : ""}
      ${tags}
    </div>`;
}

// ── Interceptor ───────────────────────────────────────────────────────────────
// Karakeep First: pre-fetches Karakeep in parallel with the normal search so
// the cache is warm by the time the slot runs.

export const interceptor = {
  isClientExposed: false,
  name:            "Karakeep First",
  description:     "Routes the search to the Karakeep tab when your bookmarks have enough results.",

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  async intercept(query, context) {
    const q = query.trim();

    // Skip: bang command, not configured, feature disabled, or already in cache
    if (!q || /^!/.test(q) || !_isConfigured() || !_karakeepFirstEnabled) {
      return { query };
    }

    // User clicked "Search all engines →" — pass through once
    if (_skipOnce.has(q)) { _skipOnce.delete(q); return { query }; }

    // Cache hit — no need to fetch again
    if (_getCached(q)) {
      const entry = _getCached(q);
      if (entry?.activated) {
        return { query, overrides: { searchType: "karakeep" } };
      }
      return { query };
    }

    // Pre-fetch to warm the cache for the slot
    try {
      const results   = await _search(q, context?.fetch, 50);
      const activated = results.length >= _karakeepFirstThreshold;
      console.log(
        `[karakeep-slot] pre-fetched ${results.length} bookmarks for "${q}" — activated=${activated}`,
      );
      _prefetchCache.set(q, { results, ts: Date.now(), activated });

      if (activated) {
        return { query, overrides: { searchType: "karakeep" } };
      }
    } catch (err) {
      console.log(`[karakeep-slot] pre-fetch failed: ${err.message}`);
    }

    return { query };
  },
};

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "karakeep-slot",
  name:        "Karakeep Slot",
  description: "Shows bookmarks from your personal Karakeep instance alongside search results.",
  position:    "above-results",
  isClientExposed: false,

  settingsSchema: [
    {
      key:         "url",
      label:       "Karakeep Instance URL",
      type:        "url",
      required:    true,
      placeholder: "https://karakeep.example.com",
      description: "Base URL of your Karakeep instance (no trailing slash).",
    },
    {
      key:         "apiKey",
      label:       "API Key",
      type:        "password",
      required:    true,
      placeholder: "your-api-key",
      description:
        "Your Karakeep API key — generate one in Karakeep → Settings → API Keys.",
      secret: true,
    },
    {
      key:     "slotEnabled",
      label:   'Show "In your bookmarks" panel',
      type:    "toggle",
      default: true,
      description: "Display matching bookmarks alongside Degoog search results.",
    },
    {
      key:     "slotPosition",
      label:   "Panel position",
      type:    "select",
      options: ["above-results", "below-results", "knowledge-panel", "above-sidebar"],
      default: "above-results",
      description: "Where to display the Karakeep panel on the results page.",
    },
    {
      key:     "slotStyle",
      label:   "Display style",
      type:    "select",
      options: ["inline", "card"],
      default: "inline",
      description:
        "inline — blends with native results · card — compact bordered panel",
    },
    {
      key:     "slotDetail",
      label:   "Detail level",
      type:    "select",
      options: ["title", "snippet", "full"],
      default: "snippet",
      description:
        "title — link only · snippet — title + AI summary/excerpt · full — title + URL + excerpt + tags",
    },
    {
      key:         "slotLimit",
      label:       "Results to show in panel",
      type:        "text",
      default:     "5",
      placeholder: "5",
      description: "Maximum number of Karakeep bookmarks displayed in the panel (1–20).",
    },
    // ── Karakeep First ────────────────────────────────────────────────────────
    {
      key:     "karakeepFirst",
      label:   "Karakeep First mode",
      type:    "toggle",
      default: false,
      description:
        "When your Karakeep bookmarks have enough results, automatically route the " +
        "search to the dedicated Karakeep tab instead of global search. The slot " +
        "panel still shows a \"Search all engines →\" link to opt out.",
    },
    {
      key:         "karakeepFirstThreshold",
      label:       "Minimum results to activate",
      type:        "text",
      default:     "3",
      placeholder: "3",
      description:
        "Minimum number of Karakeep bookmarks needed to activate Karakeep First " +
        "routing (1–50).",
    },
  ],

  configure(settings) {
    cfg.url          = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey       = settings.apiKey || "";
    cfg.slotEnabled  = settings.slotEnabled !== false;
    cfg.slotPosition = settings.slotPosition || "above-results";
    cfg.slotStyle    = settings.slotStyle === "card" ? "card" : "inline";
    cfg.slotDetail   = ["title", "snippet", "full"].includes(settings.slotDetail)
      ? settings.slotDetail
      : "snippet";
    cfg.slotLimit    = Math.max(1, Math.min(20, parseInt(settings.slotLimit, 10) || 5));
    slot.position    = cfg.slotPosition;

    _karakeepFirstEnabled   = Boolean(settings.karakeepFirst);
    _karakeepFirstThreshold = Math.max(
      1,
      Math.min(50, parseInt(settings.karakeepFirstThreshold || "3", 10)),
    );
  },

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  trigger(query) {
    if (query && /^!/.test(query.trim())) return false;
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    const q = query.trim();

    // Use pre-fetched cache when available — no double Karakeep round-trip
    const cached = _getCached(q);
    let bookmarks;
    if (cached) {
      bookmarks = cached.results;
    } else {
      try {
        bookmarks = await _search(q, context?.fetch, cfg.slotLimit);
      } catch (err) {
        return {
          html: `<div class="kk-slot kk-error"><p>${_esc(err.message)}</p></div>`,
        };
      }
    }

    const displayed = bookmarks.slice(0, cfg.slotLimit);
    if (!displayed.length) return { html: "" };

    // Show banner when Karakeep First routed this search to the Karakeep tab
    const karakeepFirst = _karakeepFirstEnabled && (cached?.activated ?? false);
    const total   = bookmarks.length;
    const viewAll = `${cfg.url}/?q=${encodeURIComponent(q)}`;
    const skipUrl = `/api/plugin/${_folderName}/skip?q=${encodeURIComponent(q)}`;
    const items   = displayed.map(_renderResult).join("");
    const detail  = `kk-detail-${cfg.slotDetail}`;

    const banner = karakeepFirst
      ? `
        <div class="kk-first-banner">
          <span class="kk-first-info">${total} bookmark${total !== 1 ? "s" : ""} found</span>
          <a class="kk-first-all" href="${_esc(skipUrl)}">Search all engines →</a>
        </div>`
      : "";

    const footer = `
      <div class="kk-footer">
        <span class="kk-dot" aria-hidden="true">●</span>
        <span class="kk-footer-label">Karakeep</span>
        <a class="kk-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    const header = `
      <div class="kk-slot-header">
        <span class="kk-dot" aria-hidden="true">●</span>
        <span class="kk-slot-label">Karakeep</span>
        <a class="kk-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    if (cfg.slotStyle === "inline") {
      return {
        html: `
          <div class="kk-slot kk-inline ${detail}">
            ${banner}
            <div class="kk-results">${items}</div>
            ${footer}
          </div>`,
      };
    }

    return {
      html: `
        <div class="kk-slot kk-card ${detail}">
          ${header}
          ${banner}
          <div class="kk-results">${items}</div>
        </div>`,
    };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/karakeep-slot/debug
    method: "get",
    path:   "/debug",
    async handler(_req) {
      const state = {
        configured:        _isConfigured(),
        url:               cfg.url ? cfg.url.replace(/^https?:\/\//, "").split("/")[0] : null,
        slotEnabled:       cfg.slotEnabled,
        slotLimit:         cfg.slotLimit,
        karakeepFirst:     _karakeepFirstEnabled,
        threshold:         _karakeepFirstThreshold,
        folderName:        _folderName,
        cacheSize:         _prefetchCache.size,
        skipOnceSize:      _skipOnce.size,
      };

      if (_isConfigured()) {
        try {
          const params = new URLSearchParams({ q: "test", limit: "1" });
          const res    = await fetch(`${cfg.url}/api/v1/bookmarks/search?${params}`, {
            headers: _headers(),
          });
          let bodySnippet = "";
          try { bodySnippet = (await res.text()).slice(0, 300); } catch { /* ignore */ }
          state.probe = { status: res.status, ok: res.ok, body: bodySnippet };
          if (res.status === 500) {
            state.hint =
              "HTTP 500 from Karakeep usually means Meilisearch is not running " +
              "or not reachable. Check your Karakeep server logs.";
          }
        } catch (err) {
          state.probe = { error: err.message };
        }
      }

      return new Response(JSON.stringify(state, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  {
    // GET /api/plugin/karakeep-slot/skip?q=<query>
    // Marks the query as skip-once so the interceptor won't activate on the
    // next search, then redirects to a normal Degoog search (all engines).
    method: "get",
    path:   "/skip",
    handler(req) {
      try {
        const url = new URL(req.url);
        const q   = url.searchParams.get("q") || "";
        if (q) {
          _skipOnce.add(q);
          setTimeout(() => _skipOnce.delete(q), 60_000);
        }
        return new Response(null, {
          status:  302,
          headers: { Location: `/search?q=${encodeURIComponent(q)}` },
        });
      } catch {
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
    },
  },
];

export default { slot, interceptor, routes };
