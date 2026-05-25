// Hister Slot plugin for Degoog
// Shows pages from your personal Hister history index alongside search results.
//
// Hister search API: GET /search?query=<JSON>
// Hister SPA URL:    /?q=<query>  (used for "View all" links)
//
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
  slotDetail:   "title",
};

let _histerFirstEnabled   = false;
let _histerFirstThreshold = 10;
let _folderName           = "hister-slot";

// Shared cache between interceptor and slot — avoids a second Hister round-trip
// when the interceptor has already pre-fetched results for this query.
// key: query string  →  value: { results: [], ts: number, meetsThreshold: boolean }
const _prefetchCache = new Map();
const PREFETCH_TTL   = 30_000; // 30 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json", Origin: cfg.url };
  if (cfg.apiKey) {
    h["Authorization"]  = `Bearer ${cfg.apiKey}`;
    h["X-Access-Token"] = cfg.apiKey;
  }
  return h;
}

function _getCached(q) {
  const e = _prefetchCache.get(q);
  if (!e || Date.now() - e.ts > PREFETCH_TTL) { _prefetchCache.delete(q); return null; }
  return e;
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const qObj = { text: query, include_text: true };
  if (limit) qObj.limit = limit;
  const q = encodeURIComponent(JSON.stringify(qObj));
  const res = await doFetch(
    `${cfg.url}/search?query=${q}`,
    { headers: _headers() },
  );
  if (!res.ok) {
    if (!cfg.apiKey && (res.status === 401 || res.status === 403 || res.status === 500)) {
      throw new Error(
        `Hister returned HTTP ${res.status}. If your instance requires authentication, ` +
        `set your Access Token in Settings → Plugins → Hister Slot → API Key.`,
      );
    }
    throw new Error(`Hister returned HTTP ${res.status}. Check the URL in Settings → Plugins → Hister Slot.`);
  }
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch {
    throw new Error("Hister returned an unexpected response. Make sure the URL points to your Hister instance.");
  }
  const raw =
    data.Documents ?? data.documents ??
    data.results   ?? data.hits      ?? data.items ??
    (Array.isArray(data) ? data : []);
  return _dedupe(Array.isArray(raw) ? raw : []);
}

function _dedupe(results) {
  const seenUrls   = new Set();
  const seenTitles = new Set();
  return results.filter((r) => {
    const rawUrl = r.URL || r.url || "";
    const base   = rawUrl.split("?")[0].toLowerCase();
    const title  = (r.Title || r.title || "").toLowerCase().trim();
    if ((base  && seenUrls.has(base))  ||
        (title && seenTitles.has(title))) return false;
    if (base)  seenUrls.add(base);
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
  const title   = r.Title   || r.title   || r.URL    || r.url    || "Untitled";
  const url     = r.URL     || r.url     || "#";
  const content = r.Content || r.content || r.Body || r.body || r.text || r.Text || "";
  const snippet = r.Snippet || r.snippet || r.Excerpt || r.excerpt || content.slice(0, 200);
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

// ── Interceptor ───────────────────────────────────────────────────────────────
//
// NOTE on "Hister First" and the Degoog interceptor API:
// InterceptorResult = { query: string } — the interceptor can ONLY rewrite the
// query text. There is no mechanism to stop other engines from running.
// Returning a bang like "!hister <query>" from the interceptor sends that
// literal string to ALL engines as their query, corrupting results.
//
// What this interceptor DOES do:
//   - Pre-fetches Hister before the main search starts (parallel, not sequential)
//   - Caches results so the slot renders immediately from cache (no second fetch)
//   - When the threshold is met, the slot shows a count banner
//
// Truly blocking other engines would require a core Degoog change to expose
// an engineTypes field in InterceptorResult.

export const interceptor = {
  isClientExposed: false,
  name:            "Hister Pre-fetch",
  description:     "Pre-fetches Hister results in parallel so the slot panel renders instantly from cache.",

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  async intercept(query, context) {
    const q = query.trim();

    // Skip: empty, bang command (already routed), not configured, or feature off
    if (!q || /^!/.test(q) || !_isConfigured() || !_histerFirstEnabled) return { query };

    // Already cached and fresh — nothing to do
    if (_getCached(q)) return { query };

    // Pre-fetch in background: fetch enough to evaluate the threshold
    let results;
    try {
      results = await _search(q, context?.fetch, _histerFirstThreshold + 5);
    } catch {
      return { query }; // Hister unreachable → fall through unchanged
    }

    const meetsThreshold = results.length >= _histerFirstThreshold;
    _prefetchCache.set(q, { results, ts: Date.now(), meetsThreshold });

    // Always return the original query — we cannot route to a specific engine
    // from an interceptor with the current Degoog API.
    return { query };
  },
};

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "hister-slot",
  name:        "Hister Slot",
  description: "Shows pages from your personal Hister history index alongside search results.",
  position:    "above-results",
  isClientExposed: false,

  settingsSchema: [
    {
      key:         "url",
      label:       "Hister Instance URL",
      type:        "url",
      required:    true,
      placeholder: "https://hister.example.com",
      description: "Base URL of your Hister instance (no trailing slash).",
    },
    {
      key:         "apiKey",
      label:       "API Key",
      type:        "password",
      required:    false,
      placeholder: "(optional)",
      description: "Your Hister Access Token (Hister → Profile → Access Token). Required if your instance uses authentication.",
      secret:      true,
    },
    {
      key:         "slotEnabled",
      label:       "Show \"In your index\" panel",
      type:        "toggle",
      default:     true,
      description: "Display pages from your Hister index alongside Degoog search results.",
    },
    {
      key:         "slotPosition",
      label:       "Panel position",
      type:        "select",
      options:     ["above-results", "below-results", "knowledge-panel", "above-sidebar"],
      default:     "above-results",
      description: "Where to display the Hister panel on the results page.",
    },
    {
      key:         "slotStyle",
      label:       "Display style",
      type:        "select",
      options:     ["inline", "card"],
      default:     "inline",
      description: "inline — blends with native results, subtle framing · card — compact bordered panel",
    },
    {
      key:         "slotDetail",
      label:       "Detail level",
      type:        "select",
      options:     ["title", "snippet", "full"],
      default:     "title",
      description: "title — link only · snippet — title + excerpt · full — title + URL + excerpt",
    },
    {
      key:         "slotLimit",
      label:       "Results to show in panel",
      type:        "text",
      default:     "5",
      placeholder: "5",
      description: "Maximum number of Hister results displayed in the panel (1–20).",
    },
    // ── Hister Pre-fetch ──────────────────────────────────────────────────────
    {
      key:         "histerFirst",
      label:       "Pre-fetch mode",
      type:        "toggle",
      default:     false,
      description: "Pre-fetch Hister results in parallel with other engines so the panel appears instantly. When results meet the threshold a count badge is shown.",
    },
    {
      key:         "histerFirstThreshold",
      label:       "Badge threshold",
      type:        "text",
      default:     "10",
      placeholder: "10",
      description: "Show the result count badge only when Hister returns at least this many results (1–50).",
    },
  ],

  configure(settings) {
    cfg.url          = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey       = settings.apiKey || "";
    cfg.slotEnabled  = settings.slotEnabled !== false;
    cfg.slotPosition = settings.slotPosition || "above-results";
    cfg.slotStyle    = settings.slotStyle === "card" ? "card" : "inline";
    cfg.slotDetail   = ["title", "snippet", "full"].includes(settings.slotDetail) ? settings.slotDetail : "title";
    cfg.slotLimit    = Math.max(1, Math.min(20, parseInt(settings.slotLimit, 10) || 5));
    slot.position    = cfg.slotPosition;

    _histerFirstEnabled   = settings.histerFirst === true;
    _histerFirstThreshold = Math.max(1, Math.min(50, parseInt(settings.histerFirstThreshold || "10", 10)));
  },

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    // Use pre-fetched cache if available — avoids a second Hister round-trip
    const cached = _getCached(query);
    let results;
    if (cached) {
      results = cached.results;
    } else {
      try {
        results = await _search(query, context?.fetch);
      } catch (err) {
        return {
          html: `<div class="hister-slot hister-error"><p>${_esc(err.message)}</p></div>`,
        };
      }
    }

    const displayed = results.slice(0, cfg.slotLimit);
    if (!displayed.length) return { html: "" };

    const total    = results.length;
    const viewAll  = `${cfg.url}/?q=${encodeURIComponent(query)}`;
    const items    = displayed.map(_renderResult).join("");
    const detail   = `hister-detail-${cfg.slotDetail}`;

    // Show a count badge when pre-fetch mode is on and the threshold is met
    const showBadge = _histerFirstEnabled && (cached?.meetsThreshold ?? false);
    const badge = showBadge
      ? `<span class="hister-count-badge">${total} in your index</span>`
      : "";

    const footer = `
      <div class="hister-footer">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-footer-label">Hister</span>
        ${badge}
        <a class="hister-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    const header = `
      <div class="hister-slot-header">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-slot-label">Hister</span>
        ${badge}
        <a class="hister-slot-viewall" href="${_esc(viewAll)}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    if (cfg.slotStyle === "inline") {
      return {
        html: `
          <div class="hister-slot hister-inline ${detail}">
            <div class="hister-results">${items}</div>
            ${footer}
          </div>`,
      };
    }

    return {
      html: `
        <div class="hister-slot hister-card ${detail}">
          ${header}
          <div class="hister-results">${items}</div>
        </div>`,
    };
  },
};

export default { slot, interceptor };
