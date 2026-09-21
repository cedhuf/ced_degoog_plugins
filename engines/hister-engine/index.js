// Hister Engine for Degoog
// Results appear in a dedicated "Hister" tab and via the !hister bang shortcut.
// The Hister plugin's "Hister First" interceptor routes searches to this tab
// when enough history results match, so no manual tab switching is needed.
//
// Degoog snapshots `type` at import. Use the native type override in the
// engine's settings to feed only one tab.
export const type = ["web", "hister"];

// Same id and keys as the Hister plugin's manifest: the URL and token are
// stored once, in the plugin's bucket, and edited on the plugin's card.
// Keep these fields identical to plugins/hister-slot/index.js.
export const plugin = {
  id: "hister-slot",
  name: "Hister",
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
  ],
};

// ── State ─────────────────────────────────────────────────────────────────────

let _url = "";
let _apiKey = "";

function _isConfigured() {
  return Boolean(_url);
}

function _headers() {
  const h = { Accept: "application/json", Origin: _url };
  if (_apiKey) {
    h["Authorization"] = `Bearer ${_apiKey}`;
    h["X-Access-Token"] = _apiKey;
  }
  return h;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default class HisterEngine {
  isClientExposed = false;
  name = "Hister";
  bangShortcut = "hister";

  configure(settings) {
    _url = (settings.url || "").replace(/\/$/, "");
    _apiKey = settings.apiKey || "";
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!_isConfigured()) {
      console.warn(
        "[hister-engine] no instance URL set, returning no results. " +
          "Configure it in Settings > Plugins > Hister (install the Hister plugin if missing).",
      );
      return [];
    }

    const doFetch = context?.fetch ?? fetch;
    try {
      const q = encodeURIComponent(
        JSON.stringify({ text: query, include_text: true, limit: 20 }),
      );
      const res = await doFetch(`${_url}/search?query=${q}`, {
        headers: _headers(),
      });
      if (!res.ok) {
        console.warn(
          `[hister-engine] ${_url} returned HTTP ${res.status}` +
            (!_apiKey && [401, 403, 500].includes(res.status)
              ? ". Your instance looks like it requires an access token."
              : "."),
        );
        return [];
      }
      const data = await res.json();
      const raw =
        data.Documents ??
        data.documents ??
        data.results ??
        data.hits ??
        data.items ??
        (Array.isArray(data) ? data : []);
      if (!Array.isArray(raw)) return [];
      return raw
        .map((r) => ({
          title: r.Title || r.title || r.URL || r.url || "Untitled",
          url: r.URL || r.url || "",
          snippet:
            r.Snippet ||
            r.snippet ||
            r.Excerpt ||
            r.excerpt ||
            (r.text || r.Text || "").slice(0, 200) ||
            "",
          source: this.name,
        }))
        .filter((r) => r.title && r.url);
    } catch (err) {
      console.warn(`[hister-engine] search against ${_url} failed: ${err.message}`);
      return [];
    }
  }
}
