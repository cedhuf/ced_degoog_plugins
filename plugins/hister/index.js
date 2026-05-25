// Hister plugin for Degoog
// Integrates Hister (personal full-text web history index) into Degoog search.
//
// Exports:
//   • slot        — "Dans votre index" panel injected in results page
//   • interceptor — pre-caches Hister results before the slot renders
//
// Requires degoog ≥ 0.17.0 (interceptor type + slotPositions API)
// isClientExposed: false → all requests are server-side; client IP never sent

// ── Shared config ─────────────────────────────────────────────────────────────

const cfg = {
  url:                  "",
  apiKey:               "",
  slotEnabled:          true,
  slotPosition:         "above-results",
  interceptorEnabled:   false,
  interceptorThreshold: 5,
};

// Result cache: interceptor populates it, slot consumes it (avoids double fetch)
const _cache = new Map();

// ── Shared helpers ────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

async function _search(query, limit = 10, contextFetch) {
  const doFetch = contextFetch ?? fetch;
  const url = `${cfg.url}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await doFetch(url, { headers: _headers() });
  if (!res.ok) throw new Error(`Hister HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? []);
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderResult(r) {
  const title   = r.title   || r.url   || "Untitled";
  const url     = r.url     || "#";
  const snippet = r.snippet || (r.content ? r.content.slice(0, 180) : "");
  const date    = r.date
    ? `<span class="hister-date">${new Date(r.date).toLocaleDateString()}</span>`
    : "";
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>${date}
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

// ── Shared settings ───────────────────────────────────────────────────────────
// settingsId "hister" is shared by both exports so Degoog stores a single copy.

const settingsSchema = [
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
  {
    key:         "slotEnabled",
    label:       "Slot « Dans votre index »",
    type:        "toggle",
    default:     true,
    description: "Affiche un panel de résultats Hister dans la page de résultats Degoog.",
  },
  {
    key:         "slotPosition",
    label:       "Position du slot",
    type:        "select",
    options:     ["above-results", "below-results", "knowledge-panel", "above-sidebar"],
    default:     "above-results",
    description: "Emplacement du panel Hister dans la page de résultats.",
  },
  {
    key:         "interceptorEnabled",
    label:       "Intercepteur (pré-chargement)",
    type:        "toggle",
    default:     false,
    description: "Pré-charge les résultats Hister avant le rendu du slot pour éviter une double requête HTTP.",
  },
  {
    key:         "interceptorThreshold",
    label:       "Seuil de l'intercepteur",
    type:        "text",
    default:     "5",
    placeholder: "5",
    description: "Nombre de résultats pré-chargés par l'intercepteur.",
  },
];

function configure(settings) {
  cfg.url                  = (settings.url || "").replace(/\/$/, "");
  cfg.apiKey               = settings.apiKey               || "";
  cfg.slotEnabled          = settings.slotEnabled          !== false;
  cfg.slotPosition         = settings.slotPosition         || "above-results";
  cfg.interceptorEnabled   = settings.interceptorEnabled   === true;
  cfg.interceptorThreshold = Math.max(1, parseInt(settings.interceptorThreshold, 10) || 5);
  // keep slot.position in sync so Degoog picks up the user's preference
  slot.position = cfg.slotPosition;
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "hister-slot",
  name:        "Hister",
  description: "Affiche les pages de votre historique personnel dans les résultats Degoog.",
  position:    "above-results",
  slotPositions: ["above-results", "below-results", "knowledge-panel", "above-sidebar"],
  isClientExposed: false,
  settingsId:  "hister",
  settingsSchema,
  configure,

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    // Use pre-cached results from the interceptor when available
    let results = _cache.get(query);
    if (results) {
      _cache.delete(query);
    } else {
      try {
        results = await _search(query, 5, context?.fetch);
      } catch (_) {
        return { html: "" };
      }
    }

    if (!results.length) return { html: "" };

    const viewAll = `${cfg.url}/search?q=${encodeURIComponent(query)}`;
    const items   = results.map(_renderResult).join("");

    return {
      title: "Dans votre index",
      html: `
        <div class="hister-slot">
          <div class="hister-slot-header">
            <span class="hister-slot-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8"  x2="11"    y2="14"/>
                <line x1="8"  y1="11" x2="14"    y2="11"/>
              </svg>
            </span>
            <span class="hister-slot-label">Dans votre index</span>
            <a class="hister-slot-viewall" href="${viewAll}" target="_blank" rel="noopener">
              Voir tout →
            </a>
          </div>
          <div class="hister-results">${items}</div>
        </div>`,
    };
  },
};

// ── Interceptor ───────────────────────────────────────────────────────────────
// Degoog interceptors can only modify the query string — they cannot suppress
// other search engines. This interceptor pre-fetches Hister results so the slot
// can render without a second HTTP round-trip.

export const interceptor = {
  name:        "Hister — Pré-chargement",
  description: "Pré-charge les résultats Hister avant le slot pour éviter une double requête HTTP.",
  isClientExposed: false,
  configure,

  async intercept(query, context) {
    _cache.delete(query);
    if (!_isConfigured() || !cfg.slotEnabled || !cfg.interceptorEnabled) {
      return { query };
    }
    try {
      const results = await _search(query, cfg.interceptorThreshold, context?.fetch);
      if (results.length) _cache.set(query, results);
    } catch (_) {
      // Never block a search due to Hister being unavailable
    }
    return { query };
  },
};

export default { slot, interceptor };
