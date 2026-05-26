// Hister Engine for Degoog
// Registers Hister as a native Degoog search engine.
// Results appear via the !hister bang shortcut.
//
// Result mode (settingsSchema → searchTypeOverride):
//   "web"   — results mixed into global search (default)
//   "hister" — results only in the dedicated Hister tab
//
// The dedicated tab is automatically shown/hidden based on the active mode.

import { basename } from "node:path";

// Default type = "web" → results appear in global search.
// Degoog reads searchTypeOverride at query time to determine the effective type.
export const type = "web";

// ── Tab ───────────────────────────────────────────────────────────────────────
// Registers a "Hister" tab in the Degoog results UI.
// Visible only when searchTypeOverride = "hister" (dedicated tab mode).

export const tab = {
  name:       "Hister",
  engineType: "hister",
};

// ── State ─────────────────────────────────────────────────────────────────────

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

// ── Engine ────────────────────────────────────────────────────────────────────

export default class HisterEngine {
  isClientExposed = false;
  name            = "Hister";
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
      description:
        "Your Hister Access Token (Hister → Profile → Access Token). Required if your instance uses authentication.",
      secret: true,
    },
    {
      key:         "searchTypeOverride",
      label:       "Result mode",
      type:        "select",
      options:     ["web", "hister"],
      description:
        "web — results mixed into global search · " +
        "hister — dedicated Hister tab only (results not shown in global search)",
    },
  ];

  configure(settings) {
    _url    = (settings.url || "").replace(/\/$/, "");
    _apiKey = settings.apiKey || "";
    // searchTypeOverride is read directly by Degoog — no handling needed here.
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
