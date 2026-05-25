// Hister plugin for Degoog
// Integrates Hister (personal full-text web history index) into Degoog search.
//
// Exports:
//   • slot        — "In your index" panel injected into the results page
//   • interceptor — pre-fetches Hister results before the slot renders (optional)
//   • routes      — GET test : raw connection diagnostic endpoint
//
// Requires Degoog ≥ 0.17.0
// isClientExposed: false → all requests go through the Degoog server

// ── Shared config ─────────────────────────────────────────────────────────────

const cfg = {
  url:                  "",
  apiKey:               "",
  slotEnabled:          true,
  slotPosition:         "above-results",
  interceptorEnabled:   false,
  interceptorThreshold: 5,
};

// Cache: interceptor pre-fetches, slot consumes (avoids a double HTTP round-trip)
const _cache = new Map();

// Runtime plugin ID injected by Degoog — used to build the test URL
const _pluginId =
  typeof __PLUGIN_ID__ !== "undefined" ? __PLUGIN_ID__ : "hister-slot"; // eslint-disable-line no-undef

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

async function _search(query, limit = 10, contextFetch) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const res = await doFetch(
    `${cfg.url}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: _headers() },
  );
  if (!res.ok) throw new Error(`Hister HTTP ${res.status}`);
  const data = await res.json();
  // Handle common Hister response shapes
  return Array.isArray(data) ? data : (data.results ?? data.hits ?? data.items ?? []);
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderResult(r) {
  const title   = r.title || r.url || "Untitled";
  const url     = r.url   || "#";
  const snippet = r.snippet || r.excerpt || (r.content ? r.content.slice(0, 180) : "");
  const rawDate = r.date  || r.visited_at || r.timestamp;
  const dateHtml = rawDate
    ? `<span class="hister-date">${new Date(rawDate).toLocaleDateString()}</span>`
    : "";
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>${dateHtml}
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

function _jsonResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

const settingsSchema = [
  {
    key:         "url",
    label:       "Hister Instance URL",
    type:        "url",
    required:    true,
    placeholder: "http://hister:8080",
    description: `Base URL of your Hister instance, no trailing slash. Once saved, test the connection at [/api/plugin/${_pluginId}/test](/api/plugin/${_pluginId}/test).`,
  },
  {
    key:         "apiKey",
    label:       "API Key",
    type:        "password",
    required:    false,
    placeholder: "(optional)",
    description: "API key if your Hister instance is protected (Hister Settings → General → API key).",
    secret:      true,
  },
  {
    key:         "slotEnabled",
    label:       "Show \"In your index\" panel",
    type:        "toggle",
    default:     true,
    description: "Display pages from your personal Hister index alongside Degoog search results.",
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
    key:         "interceptorEnabled",
    label:       "Enable result pre-fetching",
    type:        "toggle",
    default:     false,
    description: "Pre-fetch Hister results before the panel renders to avoid a double HTTP request.",
  },
  {
    key:         "interceptorThreshold",
    label:       "Pre-fetch result count",
    type:        "text",
    default:     "5",
    placeholder: "5",
    description: "How many results to pre-fetch (1–20).",
  },
];

function configure(settings) {
  cfg.url    = (settings.url || "").replace(/\/$/, "");
  cfg.apiKey = settings.apiKey || "";
  cfg.slotEnabled          = settings.slotEnabled !== false;
  cfg.slotPosition         = settings.slotPosition || "above-results";
  cfg.interceptorEnabled   = settings.interceptorEnabled === true;
  cfg.interceptorThreshold = Math.max(1, parseInt(settings.interceptorThreshold, 10) || 5);
  // Keep the property Degoog reads to position the slot in sync with user prefs
  slot.position = cfg.slotPosition;
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "hister-slot",
  name:        "Hister",
  description: "Shows pages from your personal Hister history index alongside search results.",
  position:    "above-results",
  isClientExposed: false,
  settingsId:  "hister",
  settingsSchema,
  configure,

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    // Consume pre-cached results if the interceptor already fetched them
    let results = _cache.get(query);
    if (results) {
      _cache.delete(query);
    } else {
      try {
        results = await _search(query, 5, context?.fetch);
      } catch (err) {
        // Show a visible error so misconfiguration is easy to spot
        return {
          title: "Hister",
          html: `<div class="hister-slot hister-error">
            <p>Could not reach Hister: <code>${_esc(String(err))}</code></p>
            <p>Check your URL and API key in <strong>Settings → Plugins → Hister</strong>,
               then test the connection at <a href="/api/plugin/${_pluginId}/test" target="_blank">/api/plugin/${_pluginId}/test</a>.</p>
          </div>`,
        };
      }
    }

    if (!results.length) return { html: "" };

    const viewAll = `${cfg.url}/search?q=${encodeURIComponent(query)}`;
    const items   = results.map(_renderResult).join("");

    return {
      title: "In your index",
      html: `
        <div class="hister-slot">
          <div class="hister-slot-header">
            <span class="hister-slot-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8"  x2="11"    y2="14"/>
                <line x1="8"  y1="11" x2="14"    y2="11"/>
              </svg>
            </span>
            <span class="hister-slot-label">In your index</span>
            <a class="hister-slot-viewall" href="${viewAll}" target="_blank" rel="noopener">
              View all →
            </a>
          </div>
          <div class="hister-results">${items}</div>
        </div>`,
    };
  },
};

// ── Interceptor ───────────────────────────────────────────────────────────────
// Degoog interceptors can only modify the query string; they cannot suppress
// other engines. This one pre-fetches Hister results so the slot avoids a
// second HTTP round-trip.

export const interceptor = {
  name:        "Hister — Pre-fetch",
  description: "Pre-fetches Hister results before the slot renders to avoid a double HTTP request.",
  isClientExposed: false,
  configure,

  async intercept(query, context) {
    _cache.delete(query);
    if (!_isConfigured() || !cfg.slotEnabled || !cfg.interceptorEnabled) {
      return { query };
    }
    try {
      const results = await _search(query, cfg.interceptorThreshold, context?.fetch);
      if (results.length) _cache.set(query, results);
    } catch (_) {
      // Never block a search because Hister is unavailable
    }
    return { query };
  },
};

// ── Diagnostic route ──────────────────────────────────────────────────────────
// Accessible at: /api/plugin/<plugin-id>/test
// Returns the raw Hister API response so you can verify the endpoint and
// response format without digging into server logs.

export const routes = [
  {
    method: "get",
    path:   "test",
    async handler(_req) {
      if (!cfg.url) {
        return _jsonResponse({
          ok:     false,
          error:  "URL not configured — save your settings first.",
        });
      }
      const endpoint = `${cfg.url}/api/search?q=test&limit=3`;
      try {
        const res  = await fetch(endpoint, { headers: _headers() });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return _jsonResponse({
          ok:       res.ok,
          status:   res.status,
          endpoint,
          response: data,
          hint: res.ok
            ? "Connection OK. If the slot still does not appear, make sure the URL is saved, the toggle is on, and restart the Degoog container."
            : `HTTP ${res.status} error — check the URL and API key.`,
        });
      } catch (err) {
        return _jsonResponse({
          ok:       false,
          error:    String(err),
          endpoint,
          hint:     "Hister may be unreachable from the Degoog server. Check network/firewall rules.",
        });
      }
    },
  },
];

export default { slot, interceptor };
