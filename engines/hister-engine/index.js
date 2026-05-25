// Hister Engine for Degoog
// Registers Hister as a native Degoog search engine.
// Results appear in a dedicated "Hister" tab and via the !hister bang shortcut.

// Distinct engine type → dedicated tab in the results page.
// The !hister bang shortcut routes directly to this tab.
export const type = "hister";

let _url    = "";
let _apiKey = "";

function _isConfigured() { return Boolean(_url); }

function _headers() {
  const h = { Accept: "application/json", Origin: _url };
  if (_apiKey) {
    h["Authorization"]  = `Bearer ${_apiKey}`;
    h["X-Access-Token"] = _apiKey;
  }
  return h;
}

export default class HisterEngine {
  isClientExposed = false;
  name            = "Hister Engine";
  bangShortcut    = "hister";

  settingsSchema = [
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
  ];

  configure(settings) {
    _url    = (settings.url || "").replace(/\/$/, "");
    _apiKey = settings.apiKey || "";
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!_isConfigured()) return [];
    const doFetch = context?.fetch ?? fetch;
    try {
      const q = encodeURIComponent(
        JSON.stringify({ text: query, include_text: true, limit: 20 }),
      );
      const res = await doFetch(
        `${_url}/search?query=${q}`,
        { headers: _headers() },
      );
      if (!res.ok) return [];
      const data = await res.json();

      // Hister returns { documents: [...] } with Go PascalCase fallbacks
      const raw =
        data.Documents ?? data.documents ??
        data.results   ?? data.hits      ?? data.items ??
        (Array.isArray(data) ? data : []);

      if (!Array.isArray(raw)) return [];

      return raw
        .map((r) => ({
          title:   r.Title   || r.title   || r.URL || r.url || "Untitled",
          url:     r.URL     || r.url     || "",
          snippet: r.Snippet || r.snippet || r.Excerpt || r.excerpt ||
                   (r.text   || r.Text    || "").slice(0, 200) || "",
          source:  this.name,
        }))
        .filter((r) => r.title && r.url);
    } catch {
      return [];
    }
  }
}
