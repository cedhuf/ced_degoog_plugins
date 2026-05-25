// Hister Slot plugin for Degoog
// Shows pages from your personal Hister history index alongside search results.
//
// Hister search API: GET /search?q=<query>
// Hister SPA URL:    /?q=<query>  (used for "View all" links)
//
// Requires Degoog ≥ 0.17.0
// isClientExposed: false → all requests go through the Degoog server

const cfg = {
  url:          "",
  apiKey:       "",
  slotEnabled:  true,
  slotPosition: "above-results",
  slotLimit:    5,
  slotStyle:    "inline",
  slotDetail:   "title",
};

// Plugin ID injected by Degoog at runtime.
// Store format: <author>-<repo>-<folder> → cedhuf-ced_degoog_plugins-hister-slot
const _pluginId =
  typeof __PLUGIN_ID__ !== "undefined" ? __PLUGIN_ID__ : "cedhuf-ced_degoog_plugins-hister-slot"; // eslint-disable-line no-undef

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

async function _search(query, contextFetch) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const res = await doFetch(
    `${cfg.url}/search?q=${encodeURIComponent(query)}`,
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
  // Hister returns { Documents: [...] } — Go marshals struct fields as PascalCase
  const raw =
    data.Documents ?? data.documents ??
    data.results   ?? data.hits      ?? data.items ??
    (Array.isArray(data) ? data : []);
  return _dedupe(Array.isArray(raw) ? raw : []);
}

// Deduplicate by base URL (strip query string) and by title.
// Hister indexes multiple visits to the same page with slightly different URLs.
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
  const content = r.Content || r.content || r.Body   || r.body   || "";
  const snippet = r.Snippet || r.snippet || r.Excerpt || r.excerpt || content.slice(0, 180);
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>
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
      description: `Base URL of your Hister instance (no trailing slash). Test the connection at [/api/plugin/${_pluginId}/test](/api/plugin/${_pluginId}/test).`,
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
  },

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    let results;
    try {
      results = await _search(query, context?.fetch);
    } catch (err) {
      return {
        html: `<div class="hister-slot hister-error"><p>${_esc(err.message)}</p></div>`,
      };
    }

    const displayed = results.slice(0, cfg.slotLimit);
    if (!displayed.length) return { html: "" };

    const viewAll = `${cfg.url}/?q=${encodeURIComponent(query)}`;
    const items   = displayed.map(_renderResult).join("");
    const footer  = `
      <div class="hister-footer">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-footer-label">Hister</span>
        <a class="hister-slot-viewall" href="${viewAll}" target="_blank" rel="noopener">View all →</a>
      </div>`;
    const header  = `
      <div class="hister-slot-header">
        <span class="hister-dot" aria-hidden="true">●</span>
        <span class="hister-slot-label">Hister</span>
        <a class="hister-slot-viewall" href="${viewAll}" target="_blank" rel="noopener">View all →</a>
      </div>`;

    const detail = `hister-detail-${cfg.slotDetail}`;

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

// ── Diagnostic route ──────────────────────────────────────────────────────────
// GET /api/plugin/<plugin-id>/test  →  connectivity check

async function _probe(label, fetchFn) {
  try {
    const res  = await fetchFn();
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { label, status: res.status, ok: res.ok, body };
  } catch (err) {
    return { label, status: null, ok: false, error: String(err) };
  }
}

export const routes = [
  {
    method: "get",
    path:   "test",
    async handler(_req) {
      if (!cfg.url) {
        return _jsonResponse({ ok: false, error: "URL not configured — save settings first." });
      }

      const [noAuth, withAuth] = await Promise.all([
        _probe("GET /search?q=test (no auth)", () =>
          fetch(`${cfg.url}/search?q=test`, { headers: { Accept: "application/json", Origin: cfg.url } }),
        ),
        _probe("GET /search?q=test (with API key)", () =>
          fetch(`${cfg.url}/search?q=test`, { headers: _headers() }),
        ),
      ]);

      const ok = withAuth.ok || noAuth.ok;
      return _jsonResponse({
        config:  { url: cfg.url, apiKeySet: Boolean(cfg.apiKey) },
        checks:  { noAuth, withAuth },
        verdict: ok
          ? "OK — Hister is reachable and returning results."
          : cfg.apiKey
            ? "Search failed with API key. Verify the token matches your Hister Access Token (Hister → Profile)."
            : "Search failed. Set your Hister Access Token in Settings → Plugins → Hister Slot → API Key.",
      });
    },
  },
];

export default { slot };
