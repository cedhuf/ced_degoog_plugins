// Hister Engine for Degoog
// Registers Hister as a native Degoog search engine.
// Results appear in a dedicated tab and via the !hister bang shortcut.

const cfg = {
  url:    "",
  apiKey: "",
};

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

export default {
  name:         "Hister Engine",
  type:         "web",
  bangShortcut: "hister",

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
  ],

  configure(settings) {
    cfg.url    = (settings.url || "").replace(/\/$/, "");
    cfg.apiKey = settings.apiKey || "";
  },

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!_isConfigured()) return { results: [] };

    const doFetch = context?.fetch ?? fetch;
    let data;
    try {
      const res = await doFetch(`${cfg.url}/search`, {
        method:  "POST",
        headers: { ..._headers(), "Content-Type": "application/json" },
        body:    JSON.stringify({ q: query, include_text: true }),
      });
      if (!res.ok) return { results: [] };
      data = JSON.parse(await res.text());
    } catch {
      return { results: [] };
    }

    // Hister returns { Documents: [...] } — Go marshals struct fields as PascalCase
    const raw =
      data.Documents ?? data.documents ??
      data.results   ?? data.hits      ?? data.items ??
      (Array.isArray(data) ? data : []);

    if (!Array.isArray(raw)) return { results: [] };

    // Hister returns all results at once — slice client-side for pagination
    const limit  = 20;
    const offset = (page - 1) * limit;
    const results = raw.slice(offset, offset + limit).map((r) => ({
      title:   r.Title   || r.title   || r.URL    || r.url    || "Untitled",
      url:     r.URL     || r.url     || "#",
      snippet: r.Snippet || r.snippet || r.Excerpt || r.excerpt || r.text?.slice(0, 200) || r.Text?.slice(0, 200) || r.Content?.slice(0, 200) || r.content?.slice(0, 200) || "",
      source:  "Hister",
    }));

    return { results, totalPages: Math.ceil(raw.length / limit) };
  },
};
