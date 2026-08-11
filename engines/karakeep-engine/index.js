// Karakeep Engine for Degoog
// Results appear in a dedicated "Karakeep" tab and via the !karakeep bang shortcut.
// The Karakeep plugin's "Karakeep First" interceptor routes searches to this
// tab when enough bookmarks match, so no manual tab switching is needed.
//
// NOTE: this engine is configured in Settings > Engines > Karakeep. Degoog keeps
//       engines and plugins in separate registries, so the URL and API key here
//       are NOT shared with the Karakeep plugin.
//
// API: GET /api/v1/bookmarks/search?q=<query>&limit=<n>
// Auth: Authorization: Bearer <api-key>

// Declared once at import time — Degoog snapshots this value and does not
// re-read it. To show Karakeep in only one of the two, use the engine's native
// type override in Settings → Engines rather than editing this line.
export const type = ["web", "karakeep"];

// ── State ─────────────────────────────────────────────────────────────────────

let _url = "";
let _apiKey = "";
let _limit = 20;

function _isConfigured() {
  return Boolean(_url && _apiKey);
}

function _headers() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${_apiKey}`,
  };
}

function _getTitle(b) {
  return b.title || b.content?.title || b.content?.fileName || "Untitled";
}

function _getUrl(b) {
  const c = b.content;
  if (!c) return "";
  if (c.type === "link") return c.url || "";
  if (c.type === "text") return c.sourceUrl || "";
  if (c.type === "asset") return c.sourceUrl || "";
  return "";
}

function _getSnippet(b) {
  return (
    b.summary ||
    b.content?.description ||
    b.note ||
    (b.content?.type === "text" ? b.content.text : "") ||
    (b.content?.type === "asset" ? b.content.content : "") ||
    ""
  ).slice(0, 300);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default class KarakeepEngine {
  isClientExposed = false;
  name = "Karakeep";
  bangShortcut = "karakeep";

  settingsSchema = [
    {
      key: "url",
      label: "Karakeep Instance URL",
      type: "url",
      required: true,
      placeholder: "https://karakeep.example.com",
      description: "Base URL of your Karakeep instance (no trailing slash).",
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
      placeholder: "your-api-key",
      description:
        "Your Karakeep API key — generate one in Karakeep → Settings → API Keys.",
      secret: true,
    },
    {
      key: "limit",
      label: "Results per search",
      type: "text",
      default: "20",
      placeholder: "20",
      description: "Maximum number of bookmarks returned per search (1-50).",
    },
  ];

  configure(settings) {
    _url = (settings.url || "").replace(/\/$/, "");
    _apiKey = settings.apiKey || "";
    _limit = Math.max(1, Math.min(50, parseInt(settings.limit || "20", 10)));
  }

  async executeSearch(query, _page = 1, _timeFilter, context) {
    // An empty tab is indistinguishable from a tab that never ran, so say why.
    // Note the engine is configured in Settings > Engines, separately from the
    // Karakeep plugin: having one set up says nothing about the other.
    if (!_isConfigured()) {
      console.warn(
        "[karakeep-engine] no instance URL or API key set, returning no " +
          "results. Configure it in Settings > Engines > Karakeep.",
      );
      return [];
    }

    const doFetch = context?.fetch ?? fetch;
    try {
      const params = new URLSearchParams({ q: query, limit: String(_limit) });
      const res = await doFetch(`${_url}/api/v1/bookmarks/search?${params}`, {
        headers: _headers(),
      });
      if (!res.ok) {
        console.warn(
          `[karakeep-engine] ${_url} returned HTTP ${res.status}` +
            (res.status === 500
              ? ". This usually means Meilisearch is down or unreachable from Karakeep."
              : res.status === 401 || res.status === 403
                ? ". Check the API key."
                : "."),
        );
        return [];
      }

      const data = await res.json();
      const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];

      return bookmarks
        .map((b) => ({
          title: _getTitle(b),
          url: _getUrl(b),
          snippet: _getSnippet(b),
          source: this.name,
        }))
        .filter((r) => r.title && r.url);
    } catch (err) {
      console.warn(`[karakeep-engine] search against ${_url} failed: ${err.message}`);
      return [];
    }
  }
}
