// Hister plugin for Degoog
// Integrates Hister (personal full-text web history index) into Degoog search.
//
// Exports:
//   • slot        — panel "Dans votre index" injecté dans la page de résultats
//   • interceptor — pré-charge les résultats Hister avant le rendu du slot
//   • routes      — GET /test : diagnostique la connexion à votre instance Hister
//
// Requires degoog ≥ 0.17.0
// isClientExposed: false → toutes les requêtes passent par le serveur

// ── Config partagée ───────────────────────────────────────────────────────────

const cfg = {
  url:                  "",
  apiKey:               "",
  slotEnabled:          true,
  slotPosition:         "above-results",
  interceptorEnabled:   false,
  interceptorThreshold: 5,
};

// Cache inter-module : l'intercepteur remplit, le slot consomme (évite un double appel HTTP)
const _cache = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const res = await doFetch(
    `${cfg.url}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: _headers() },
  );
  if (!res.ok) throw new Error(`Hister HTTP ${res.status}`);
  const data = await res.json();
  // Hister peut retourner un tableau direct ou { results: [] }
  return Array.isArray(data) ? data : (data.results ?? data.hits ?? data.items ?? []);
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _renderResult(r) {
  const title   = r.title   || r.url   || "Sans titre";
  const url     = r.url     || "#";
  const snippet = r.snippet || r.excerpt || (r.content ? r.content.slice(0, 180) : "");
  const date    = r.date || r.visited_at || r.timestamp;
  const dateHtml = date
    ? `<span class="hister-date">${new Date(date).toLocaleDateString("fr-FR")}</span>`
    : "";
  return `
    <div class="hister-result">
      <a class="hister-result-title" href="${_esc(url)}" target="_blank" rel="noopener">${_esc(title)}</a>${dateHtml}
      <div class="hister-result-url">${_esc(url)}</div>
      ${snippet ? `<div class="hister-result-snippet">${_esc(snippet)}</div>` : ""}
    </div>`;
}

// ── Paramètres ────────────────────────────────────────────────────────────────

// Labels français → identifiants de position Degoog
const POSITIONS = {
  "Au-dessus des résultats": "above-results",
  "Sous les résultats":      "below-results",
  "Panneau latéral":         "knowledge-panel",
  "Haut de la barre latérale": "above-sidebar",
};

const settingsSchema = [
  {
    key:         "url",
    label:       "URL de l'instance Hister",
    type:        "url",
    required:    true,
    placeholder: "http://hister:8080",
    description: "URL de base de votre instance Hister, sans slash final. Pour tester la connexion : ouvrez /api/plugin/hister-slot/test dans votre navigateur.",
  },
  {
    key:         "apiKey",
    label:       "Clé API",
    type:        "password",
    required:    false,
    placeholder: "(optionnel)",
    description: "Clé API si votre instance Hister est protégée (Paramètres → Général → Clé API dans Hister).",
    secret:      true,
  },
  {
    key:         "slotEnabled",
    label:       "Afficher le panel « Dans votre index »",
    type:        "toggle",
    default:     true,
    description: "Affiche vos pages déjà visitées dans les résultats de recherche Degoog.",
  },
  {
    key:         "slotPosition",
    label:       "Position du panel",
    type:        "select",
    options:     Object.keys(POSITIONS),
    default:     "Au-dessus des résultats",
    description: "Emplacement du panel Hister dans la page de résultats.",
  },
  {
    key:         "interceptorEnabled",
    label:       "Activer le pré-chargement",
    type:        "toggle",
    default:     false,
    description: "Pré-charge les résultats Hister avant le rendu du panel pour éviter une double requête HTTP.",
  },
  {
    key:         "interceptorThreshold",
    label:       "Nombre de résultats à pré-charger",
    type:        "text",
    default:     "5",
    placeholder: "5",
    description: "Combien de résultats pré-charger (entre 1 et 20).",
  },
];

function configure(settings) {
  cfg.url    = (settings.url || "").replace(/\/$/, "");
  cfg.apiKey = settings.apiKey || "";
  cfg.slotEnabled = settings.slotEnabled !== false;

  const posLabel = settings.slotPosition || "Au-dessus des résultats";
  cfg.slotPosition = POSITIONS[posLabel] ?? "above-results";

  cfg.interceptorEnabled   = settings.interceptorEnabled === true;
  cfg.interceptorThreshold = Math.max(1, parseInt(settings.interceptorThreshold, 10) || 5);

  // Synchronise la propriété lue par Degoog pour positionner le slot
  slot.position = cfg.slotPosition;
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "hister-slot",
  name:        "Hister",
  description: "Affiche les pages de votre historique personnel dans les résultats Degoog.",
  position:    "above-results",
  isClientExposed: false,
  settingsId:  "hister",
  settingsSchema,
  configure,

  trigger(_query) {
    return _isConfigured() && cfg.slotEnabled;
  },

  async execute(query, context) {
    // Utilise les résultats pré-chargés par l'intercepteur si disponibles
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

// ── Intercepteur ──────────────────────────────────────────────────────────────
// L'API Degoog ne permet pas à un intercepteur de supprimer d'autres moteurs —
// il peut uniquement modifier la requête. Ici on s'en sert pour pré-charger
// les résultats Hister avant que le slot les demande.

export const interceptor = {
  name:        "Hister — Pré-chargement",
  description: "Pré-charge les résultats Hister avant le rendu du panel pour éviter une double requête HTTP.",
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
      // Ne jamais bloquer une recherche si Hister est indisponible
    }
    return { query };
  },
};

// ── Route de diagnostic ───────────────────────────────────────────────────────
// Accessible via : GET /api/plugin/hister-slot/test
// Retourne la réponse brute de l'API Hister pour vérifier l'endpoint et le format.

export const routes = [
  {
    method: "get",
    path:   "/test",
    async handler(_req) {
      if (!cfg.url) {
        return Response.json({
          ok:     false,
          erreur: "URL non configurée — sauvegardez vos paramètres d'abord.",
        });
      }
      const endpoint = `${cfg.url}/api/search?q=test&limit=3`;
      try {
        const res  = await fetch(endpoint, { headers: _headers() });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        return Response.json({
          ok:        res.ok,
          statut:    res.status,
          endpoint,
          réponse:  data,
          conseil:   res.ok
            ? "Connexion OK. Si le slot ne s'affiche pas, vérifiez que le champ 'url' est sauvegardé et que le toggle est activé."
            : `Erreur HTTP ${res.status} — vérifiez l'URL et la clé API.`,
        });
      } catch (err) {
        return Response.json({
          ok:       false,
          erreur:   String(err),
          endpoint,
          conseil:  "Vérifiez que l'instance Hister est démarrée et accessible depuis le serveur Degoog.",
        });
      }
    },
  },
];

export default { slot, interceptor };
