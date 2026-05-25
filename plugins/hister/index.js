// ─────────────────────────────────────────────────────────────────────────────
// Hister plugin for Degoog
// Integrates Hister (personal full-text web history index) into Degoog search.
//
// Features:
//   • Slot        — injects a "Dans votre index" panel in the results page
//   • Interceptor — skips external engines when Hister already has enough hits
//   • Engine      — registers Hister as a standalone/blended search engine
//
// Requires degoog ≥ 0.17.0  (interceptor type + slotPositions API)
// isClientExposed: false  → all requests are server-side; client IP never sent
// ─────────────────────────────────────────────────────────────────────────────

// ── Internal state ────────────────────────────────────────────────────────────
const cfg = {
  url:                   "",
  apiKey:                "",
  slotEnabled:           true,
  slotPosition:          "above-results",
  interceptorEnabled:    false,
  interceptorThreshold:  5,
  engineEnabled:         false,
};

// Per-request flag set by the interceptor, consumed by the engine.
let _skipExternalEngines = false;

// ── Shared helpers ────────────────────────────────────────────────────────────

function _isConfigured() {
  return Boolean(cfg.url);
}

function _headers() {
  const h = { Accept: "application/json" };
  if (cfg.apiKey) h["Authorization"] = `Bearer ${cfg.apiKey}`;
  return h;
}

async function _search(query, limit = 10) {
  const url = `${cfg.url}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers: _headers() });
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

// ── Slot ──────────────────────────────────────────────────────────────────────
// Injects a "Dans votre index" panel into the results page.

export const slot = {
  // User can override this in Settings → Plugins → Hister → Configure
  slotPositions: ["above-results", "below-results", "knowledge-panel", "above-sidebar"],
  position: "above-results", // kept in sync with cfg.slotPosition by configure()

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, _context) {
    let results;
    try {
      results = await _search(query, 5);
    } catch (_) {
      return { html: "" };
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
// When Hister has ≥ threshold hits, sets a flag so the engine wrapper can
// skip itself, effectively suppressing external engines for this query.
// The query string itself is always returned unchanged.

export const interceptor = {
  async execute(query) {
    _skipExternalEngines = false;
    if (!_isConfigured() || !cfg.interceptorEnabled) return query;

    try {
      const results = await _search(query, cfg.interceptorThreshold);
      if (results.length >= cfg.interceptorThreshold) {
        _skipExternalEngines = true;
      }
    } catch (_) {
      // Never block a search due to Hister being unavailable
    }
    return query;
  },
};

// ── Engine ────────────────────────────────────────────────────────────────────
// Registers Hister as a native Degoog engine.
// When engineEnabled is true, Hister results blend with other engines
// (or appear in a dedicated tab if the user pins it).

export const engine = {
  id:         "hister",
  name:       "Hister",
  engineType: "web",
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <circle cx="11" cy="11" r="8"/>
           <line x1="21" y1="21" x2="16.65" y2="16.65"/>
           <line x1="11" y1="8"  x2="11"    y2="14"/>
           <line x1="8"  y1="11" x2="14"    y2="11"/>
         </svg>`,

  async executeSearch(query, page = 1, _timeFilter, context) {
    if (!_isConfigured() || !cfg.engineEnabled) return [];

    // If the interceptor flagged "enough local results" and we are not
    // specifically on the Hister engine tab, skip silently.
    if (_skipExternalEngines && !context?.isEngineTab) return [];

    const limit  = 20;
    const offset = (page - 1) * limit;
    const url    =
      `${cfg.url}/api/search` +
      `?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

    let data;
    try {
      const doFetch = context?.fetch ?? fetch;
      const res = await doFetch(url, { headers: _headers() });
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

// ── Settings schema ───────────────────────────────────────────────────────────

export const settingsSchema = [
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
    description:
      "API key Hister si l'instance est protégée (Settings → General → API key dans Hister).",
    secret: true,
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
    options: [
      { value: "above-results",   label: "Au-dessus des résultats" },
      { value: "below-results",   label: "En-dessous des résultats" },
      { value: "knowledge-panel", label: "Panneau de connaissance (sidebar)" },
      { value: "above-sidebar",   label: "Haut de la sidebar" },
    ],
    default:     "above-results",
    description: "Emplacement du panel Hister dans la page de résultats.",
  },
  {
    key:         "interceptorEnabled",
    label:       "Intercepteur anti-redondance",
    type:        "toggle",
    default:     false,
    description:
      "Quand activé, si Hister a déjà assez de résultats, les moteurs externes sont supprimés pour cette requête.",
  },
  {
    key:         "interceptorThreshold",
    label:       "Seuil de l'intercepteur",
    type:        "text",
    default:     "5",
    placeholder: "5",
    description:
      "Nombre minimum de résultats Hister requis pour déclencher la suppression des moteurs externes.",
  },
  {
    key:         "engineEnabled",
    label:       "Moteur Hister natif",
    type:        "toggle",
    default:     false,
    description:
      "Enregistre Hister comme moteur dans Degoog — les résultats sont mélangés avec les autres moteurs ou accessibles via un onglet dédié.",
  },
];

export function configure(settings) {
  cfg.url                 = (settings.url || "").replace(/\/$/, "");
  cfg.apiKey              = settings.apiKey              || "";
  cfg.slotEnabled         = settings.slotEnabled         !== false;
  cfg.slotPosition        = settings.slotPosition        || "above-results";
  cfg.interceptorEnabled  = settings.interceptorEnabled  === true;
  cfg.interceptorThreshold = Math.max(1, parseInt(settings.interceptorThreshold, 10) || 5);
  cfg.engineEnabled       = settings.engineEnabled       === true;

  // Keep slot.position in sync so degoog picks up the user's preference
  slot.position = cfg.slotPosition;
}

export function isConfigured() {
  return _isConfigured();
}

// ── Default export ────────────────────────────────────────────────────────────

export default {
  name:            "Hister",
  description:     "Intègre votre index personnel Hister dans les résultats Degoog.",
  version:         "1.0.0",
  isClientExposed: false,

  settingsSchema,
  configure,
  isConfigured,

  slot,
  interceptor,
  engine,
};
