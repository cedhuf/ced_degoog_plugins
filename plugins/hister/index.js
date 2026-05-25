// Hister plugin for Degoog
// Integrates Hister (personal full-text web history index) into Degoog search.
//
// Exports:
//   • slot        — "In your index" panel injected into the results page
//   • interceptor — optional: pre-fetches results before slot renders (install
//                   alongside the slot, enable via slot settings)
//   • routes      — GET test: raw connection diagnostic endpoint
//
// Requires Degoog ≥ 0.17.0
// isClientExposed: false → all requests go through the Degoog server

// ── Config (shared between slot and interceptor via module scope) ──────────────

const cfg = {
  url:                  "",
  apiKey:               "",
  slotEnabled:          true,
  slotPosition:         "above-results",
  interceptorEnabled:   false,
};

// Pre-fetch cache: interceptor writes, slot reads (avoids double HTTP call)
const _cache = new Map();

// Plugin ID injected by Degoog at runtime — used to build the test URL
const _pluginId =
  typeof __PLUGIN_ID__ !== "undefined" ? __PLUGIN_ID__ : "hister-slot"; // eslint-disable-line no-undef

// logo.png encoded as data-URL, loaded once in init()
let _logoDataUrl = "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

// Hister search endpoint: GET /search?q=<query>
// Valid Hister GET params: q, date_from, date_to, include_html, page_key, sort, semantic
// NOTE: "limit" is NOT a valid parameter — slicing is done client-side
async function _search(query, contextFetch) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const url = `${cfg.url}/search?q=${encodeURIComponent(query)}`;
  const res  = await doFetch(url, { headers: _headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Non-JSON response from Hister (${res.status}). First 300 chars:\n${text.slice(0, 300)}`,
    );
  }
  // Hister returns { Documents: [...], History: [...], ... }
  // Go JSON marshaling uses PascalCase by default; fall back to lowercase variants
  const raw =
    data.Documents  ?? data.documents  ??
    data.results    ?? data.hits       ?? data.items ??
    (Array.isArray(data) ? data : []);
  return Array.isArray(raw) ? raw : [];
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderResult(r) {
  // Handle both Go PascalCase and json-tagged lowercase field names
  const title   = r.Title   || r.title   || r.URL   || r.url   || "Untitled";
  const url     = r.URL     || r.url     || "#";
  const content = r.Content || r.content || r.Body  || r.body  || "";
  const snippet = r.Snippet || r.snippet || r.Excerpt || r.excerpt || content.slice(0, 180);
  const rawDate = r.Date    || r.date    || r.VisitedAt || r.visited_at || r.Timestamp || r.timestamp;
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

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "hister-slot",
  name:        "Hister",
  description: "Shows pages from your personal Hister history index alongside search results.",
  position:    "above-results",
  isClientExposed: false,

  settingsSchema: [
    {
      key:         "url",
      label:       "Hister Instance URL",
      type:        "url",
      required:    true,
      placeholder: "http://hister:4433",
      description: `Base URL of your Hister instance, no trailing slash. Test at [/api/plugin/${_pluginId}/test](/api/plugin/${_pluginId}/test).`,
    },
    {
      key:         "apiKey",
      label:       "API Key",
      type:        "password",
      required:    false,
      placeholder: "(optional)",
      description: "API key if your Hister instance requires authentication.",
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
      key:         "interceptorEnabled",
      label:       "Enable result pre-fetching (requires interceptor plugin)",
      type:        "toggle",
      default:     false,
      description: "Pre-fetch Hister results before the panel renders to avoid a double HTTP request. Only effective when the Hister — Pre-fetch plugin is also installed.",
    },
  ],

  configure(settings) {
    cfg.url                = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey             = settings.apiKey || "";
    cfg.slotEnabled        = settings.slotEnabled !== false;
    cfg.slotPosition       = settings.slotPosition || "above-results";
    cfg.interceptorEnabled = settings.interceptorEnabled === true;
    slot.position          = cfg.slotPosition;
  },

  async init(ctx) {
    // Load logo.png as a data-URL for embedding in the slot header
    try {
      // Preferred: read via Node.js fs using ctx.dir (absolute plugin folder path)
      const { readFile } = await import("node:fs/promises");
      const { join }     = await import("node:path");
      const buf = await readFile(join(ctx.dir, "logo.png"));
      _logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      try {
        // Fallback: Degoog's ctx.readFile (returns binary as a string)
        const raw = await ctx.readFile("logo.png");
        _logoDataUrl = `data:image/png;base64,${Buffer.from(raw, "binary").toString("base64")}`;
      } catch {
        _logoDataUrl = "";
      }
    }
  },

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    let results = _cache.get(query);
    if (results) {
      _cache.delete(query);
    } else {
      try {
        results = await _search(query, context?.fetch);
      } catch (err) {
        return {
          title: "Hister",
          html: `<div class="hister-slot hister-error">
            <p><strong>Could not reach Hister:</strong></p>
            <pre style="white-space:pre-wrap;font-size:.75rem;opacity:.8;overflow:auto;max-height:8rem">${_esc(String(err))}</pre>
            <p>Check your URL and API key in <strong>Settings → Plugins → Hister</strong>.</p>
          </div>`,
        };
      }
    }

    // Limit display to 5 results client-side (Hister API has no limit param)
    const displayed = results.slice(0, 5);
    if (!displayed.length) return { html: "" };

    const viewAll  = `${cfg.url}/?q=${encodeURIComponent(query)}`;
    const items    = displayed.map(_renderResult).join("");
    const iconHtml = _logoDataUrl
      ? `<img src="${_logoDataUrl}" alt="" width="14" height="14" style="vertical-align:middle;border-radius:2px">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              style="width:14px;height:14px;vertical-align:middle">
           <circle cx="11" cy="11" r="8"/>
           <line x1="21" y1="21" x2="16.65" y2="16.65"/>
           <line x1="11" y1="8"  x2="11"    y2="14"/>
           <line x1="8"  y1="11" x2="14"    y2="11"/>
         </svg>`;

    return {
      title: "In your index",
      html: `
        <div class="hister-slot">
          <div class="hister-slot-header">
            <span class="hister-slot-icon" aria-hidden="true">${iconHtml}</span>
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
// Optional companion to the slot: pre-fetches Hister results so the slot
// renders without a second HTTP round-trip.
//
// No configure() here — reads from cfg which is kept in sync by slot.configure().
// Install this alongside the Hister slot, then enable the toggle in slot settings.

export const interceptor = {
  name:        "Hister — Pre-fetch",
  description: "Pre-fetches Hister results before the slot renders to avoid a double HTTP request. Install alongside the Hister slot and enable the toggle in slot settings.",
  isClientExposed: false,

  async intercept(query, context) {
    _cache.delete(query);
    if (!_isConfigured() || !cfg.slotEnabled || !cfg.interceptorEnabled) {
      return { query };
    }
    try {
      const results = await _search(query, context?.fetch);
      if (results.length) _cache.set(query, results);
    } catch {
      // Never block search due to Hister being unavailable
    }
    return { query };
  },
};

// ── Diagnostic route ──────────────────────────────────────────────────────────
// Accessible at: /api/plugin/<plugin-id>/test
// Returns raw Hister API response to help debug endpoint and response format.

export const routes = [
  {
    method: "get",
    path:   "test",
    async handler(_req) {
      if (!cfg.url) {
        return _jsonResponse({ ok: false, error: "URL not configured — save settings first." });
      }
      const endpoint = `${cfg.url}/search?q=test`;
      try {
        const res  = await fetch(endpoint, { headers: _headers() });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }
        return _jsonResponse({
          ok:       res.ok,
          status:   res.status,
          endpoint,
          response: data,
          hint: res.ok
            ? "Connection OK. If results still don't appear check that the slot toggle is on and restart the container."
            : `HTTP ${res.status} — check your URL and API key.`,
        });
      } catch (err) {
        return _jsonResponse({
          ok:       false,
          error:    String(err),
          endpoint,
          hint:     "Hister may be unreachable from the Degoog server. Check network/firewall.",
        });
      }
    },
  },
];

export default { slot, interceptor };
