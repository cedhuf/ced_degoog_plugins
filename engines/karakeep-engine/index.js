// Karakeep Engine for Degoog
// Registers Karakeep as a native Degoog search engine.
// Results appear via the !karakeep bang shortcut.
//
// NOTE: Configure this engine separately in Settings → Engines → Karakeep Engine.
//       The Karakeep Slot has its own settings — they are NOT shared.
//
// API: GET /api/v1/bookmarks/search?q=<query>&limit=<n>
// Auth: Authorization: Bearer <api-key>

export const type = "karakeep";

let _url    = "";
let _apiKey = "";
let _limit  = 20;

function _isConfigured() { return Boolean(_url && _apiKey); }

function _headers() {
  return {
    Accept:        "application/json",
    Authorization: `Bearer ${_apiKey}`,
  };
}

function _getTitle(b) {
  return b.title || b.content?.title || b.content?.fileName || "Untitled";
}

function _getUrl(b) {
  const c = b.content;
  if (!c) return "";
  if (c.type === "link")  return c.url        || "";
  if (c.type === "text")  return c.sourceUrl  || "";
  if (c.type === "asset") return c.sourceUrl  || "";
  return "";
}

function _getSnippet(b) {
  return (
    b.summary                                              ||
    b.content?.description                                 ||
    b.note                                                 ||
    (b.content?.type === "text"  ? b.content.text    : "") ||
    (b.content?.type === "asset" ? b.content.content : "") ||
    ""
  ).slice(0, 300);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default class KarakeepEngine {
  isClientExposed = false;
  name            = "Karakeep";
  bangShortcut    = "karakeep";

  settingsSchema = [
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
      key:         "limit",
      label:       "Results per search",
      type:        "text",
      default:     "20",
      placeholder: "20",
      description: "Maximum number of bookmarks returned per search (1–50).",
    },
  ];

  configure(settings) {
    _url    = (settings.url || "").replace(/\/$/, "");
    _apiKey = settings.apiKey || "";
    _limit  = Math.max(1, Math.min(50, parseInt(settings.limit || "20", 10)));
  }

  async executeSearch(query, _page = 1, _timeFilter, context) {
    if (!_isConfigured()) {
      console.warn(
        "[karakeep-engine] Not configured — set URL and API Key in " +
        "Settings → Engines → Karakeep Engine.",
      );
      return [];
    }

    const doFetch = context?.fetch ?? fetch;
    try {
      const params = new URLSearchParams({ q: query, limit: String(_limit) });
      const res = await doFetch(
        `${_url}/api/v1/bookmarks/search?${params}`,
        { headers: _headers() },
      );
      if (!res.ok) return [];

      const data = await res.json();
      const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];

      return bookmarks
        .map((b) => ({
          title:   _getTitle(b),
          url:     _getUrl(b),
          snippet: _getSnippet(b),
          source:  this.name,
        }))
        .filter((r) => r.title && r.url);
    } catch {
      return [];
    }
  }
}
