// Hister Engine for Degoog
// Registers Hister as a native Degoog search engine.
// Results appear in a dedicated "Hister" tab and via the !hister bang shortcut.
//
// Hister First mode (optional):
// When enabled, every search pre-fetches Hister. If the result count meets the
// configured threshold, the interceptor returns { query: "hister:<q>" } which
// routes the search exclusively to this engine — no query sent to other engines.
// A GET /skip?q=<q> route lets the user opt out for a single search.

import { basename } from "node:path";

// Distinct engine type → dedicated tab in the results page.
export const type = "hister";

let _url                  = "";
let _apiKey               = "";
let _histerFirstEnabled   = false;
let _histerFirstThreshold = 10;
let _folderName           = "hister-engine";

// Cache shared between interceptor and executeSearch — avoids fetching Hister
// twice when the interceptor already pre-fetched for a given query.
const _prefetchCache = new Map(); // q → { results, ts, activated }
const _skipOnce      = new Set(); // queries to let through without activation
const PREFETCH_TTL   = 30_000;   // 30 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isConfigured() { return Boolean(_url); }

function _headers() {
  const h = { Accept: "application/json", Origin: _url };
  if (_apiKey) {
    h["Authorization"]  = `Bearer ${_apiKey}`;
    h["X-Access-Token"] = _apiKey;
  }
  return h;
}

function _getCached(q) {
  const e = _prefetchCache.get(q);
  if (!e || Date.now() - e.ts > PREFETCH_TTL) { _prefetchCache.delete(q); return null; }
  return e;
}

async function _search(query, contextFetch, limit) {
  const doFetch = contextFetch ?? globalThis.fetch ?? fetch;
  const qObj = { text: query, include_text: true };
  if (limit) qObj.limit = limit;
  const q = encodeURIComponent(JSON.stringify(qObj));
  const res = await doFetch(`${_url}/search?query=${q}`, { headers: _headers() });
  if (!res.ok) throw new Error(`Hister returned HTTP ${res.status}`);
  const data = await res.json();
  const raw =
    data.Documents ?? data.documents ??
    data.results   ?? data.hits      ?? data.items ??
    (Array.isArray(data) ? data : []);
  return Array.isArray(raw) ? raw : [];
}

// ── Interceptor ───────────────────────────────────────────────────────────────

export const interceptor = {
  isClientExposed: false,
  name:            "Hister First",
  description:     "Pre-fetches Hister and routes the search exclusively to your history when enough results are found.",

  init(ctx) {
    _folderName = basename(ctx.dir);
  },

  async intercept(query, context) {
    const q = query.trim();

    // Skip: already a hister:-prefixed query, a bang, not configured, or feature off
    if (!q || /^hister:/i.test(q) || /^!/.test(q) || !_isConfigured() || !_histerFirstEnabled) {
      return { query };
    }

    // User clicked "Search all engines →" for this query — skip once
    if (_skipOnce.has(q)) { _skipOnce.delete(q); return { query }; }

    // Serve from cache if still fresh
    const cached = _getCached(q);
    if (cached) {
      return cached.activated ? { query: `hister:${q}` } : { query };
    }

    // Pre-fetch enough results to evaluate the threshold
    let results;
    try {
      results = await _search(q, context?.fetch, _histerFirstThreshold + 5);
    } catch {
      return { query }; // Hister unreachable → fall through to normal search
    }

    const activated = results.length >= _histerFirstThreshold;
    _prefetchCache.set(q, { results, ts: Date.now(), activated });

    // When the threshold is met, route exclusively to this engine by prefixing
    // the query with the engine type. Degoog maps "hister:<q>" to engines whose
    // export const type === "hister", skipping all other engines.
    return activated ? { query: `hister:${q}` } : { query };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/hister-engine/skip?q=<query>
    // Called by the "Search all engines →" link. Marks the query as skip-once
    // so the interceptor won't activate on the immediately following search,
    // then redirects to a normal Degoog search with all engines enabled.
    method: "get",
    path:   "/skip",
    handler(req) {
      try {
        const url = new URL(req.url);
        const q   = url.searchParams.get("q") || "";
        if (q) {
          _skipOnce.add(q);
          setTimeout(() => _skipOnce.delete(q), 60_000);
        }
        return new Response(null, {
          status:  302,
          headers: { Location: `/search?q=${encodeURIComponent(q)}` },
        });
      } catch {
        return new Response(null, { status: 302, headers: { Location: "/" } });
      }
    },
  },
];

// ── Engine ────────────────────────────────────────────────────────────────────

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
    {
      key:         "histerFirst",
      label:       "Hister First mode",
      type:        "toggle",
      default:     false,
      description: "When your history has enough results, route the search exclusively to Hister — no query is sent to other engines.",
    },
    {
      key:         "histerFirstThreshold",
      label:       "Minimum results to activate",
      type:        "text",
      default:     "10",
      placeholder: "10",
      description: "Minimum number of Hister results needed to activate Hister First (1–50).",
    },
  ];

  configure(settings) {
    _url                  = (settings.url || "").replace(/\/$/, "");
    _apiKey               = settings.apiKey || "";
    _histerFirstEnabled   = settings.histerFirst === true;
    _histerFirstThreshold = Math.max(1, Math.min(50, parseInt(settings.histerFirstThreshold || "10", 10)));
  }

  init(ctx) {
    _folderName = basename(ctx.dir);
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    // Strip the "hister:" prefix the interceptor may have injected —
    // the actual Hister search needs the clean query string.
    const q = query.replace(/^hister:/i, "").trim() || query;

    if (!_isConfigured()) return [];

    // Serve from the interceptor's cache when available
    const cached = _getCached(q);
    if (cached) {
      return cached.results
        .map((r) => ({
          title:   r.Title   || r.title   || r.URL || r.url || "Untitled",
          url:     r.URL     || r.url     || "",
          snippet: r.Snippet || r.snippet || r.Excerpt || r.excerpt ||
                   (r.text   || r.Text    || "").slice(0, 200) || "",
          source:  this.name,
        }))
        .filter((r) => r.title && r.url);
    }

    const doFetch = context?.fetch ?? fetch;
    try {
      const results = await _search(q, doFetch, 20);
      return results
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
