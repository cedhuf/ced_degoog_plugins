// Hister engine for Degoog
// Registers Hister as a native Degoog search engine.
// Results appear in a dedicated tab and via the !hister bang shortcut.
//
// Configure URL and API key in Settings → Engines → Hister.

const cfg = {
  url:    "",
  apiKey: "",
};

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

export default {
  name:         "Hister",
  type:         "web",
  bangShortcut: "hister",

  settingsSchema: [
    {
      key:         "url",
      label:       "URL Hister",
      type:        "url",
      required:    true,
      placeholder: "http://hister:8080",
      description: "URL de base de votre instance Hister (sans slash final).",
    },
    {
      key:         "apiKey",
      label:       "Clé API",
      type:        "password",
      required:    false,
      placeholder: "(optionnel)",
      description: "API key Hister si l'instance est protégée (Settings → General → API key dans Hister).",
      secret:      true,
    },
  ],

  configure(settings) {
    cfg.url    = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey = settings.apiKey || "";
  },

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!_isConfigured()) return [];

    const limit  = 20;
    const offset = (page - 1) * limit;
    const doFetch = context?.fetch ?? fetch;

    let data;
    try {
      const res = await doFetch(
        `${cfg.url}/api/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
        { headers: _headers() },
      );
      if (!res.ok) return [];
      data = await res.json();
    } catch (_) {
      return [];
    }

    const raw = Array.isArray(data) ? data : (data.results ?? []);
    return raw.map((r) => ({
      title:   r.title   || r.url   || "Untitled",
      url:     r.url     || "#",
      snippet: r.snippet || (r.content ? r.content.slice(0, 200) : ""),
      source:  "Hister",
    }));
  },
};
