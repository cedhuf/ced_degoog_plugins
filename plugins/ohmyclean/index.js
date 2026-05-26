// OhMyClean — cosmetic plugin for Degoog
// Selectively hides or replaces UI elements across all pages.
//
// Strategy:
//   • script.js fetches /config and injects a <style> into <head> on every
//     page (home, results, settings) — Degoog loads script.js globally.
//   • /config route serves current settings + pre-built CSS for script.js.
//   • trigger() returns false — no slot panel ever rendered.
//
// Confirmed selectors from degoog-org/degoog source (index-templates/):
//   .home-footer-bottom      — home page footer
//   #nav-settings-top        — home page settings gear (top-right)
//   #nav-settings-results    — results page settings gear (top-right)
//   .button-row              — row with search + lucky buttons (home page)
//   #btn-lucky               — "I'm Feeling Lucky" button
//   #search-bar-home         — search bar wrapper (arrow injected here)
//   #home-logo                    — logo container (default logo + Logotype plugin)

const cfg = {
  hideFooter:      false,
  hideNavSettings: false,
  hideLogo:        false,
  buttons:         "default", // "default" | "hide-lucky" | "arrow"
};

// Boolean conversion safe pour les settings Degoog :
// Boolean("false") === true est un piège classique — on compare explicitement.
const _bool = (v) => v === true || v === "true" || v === 1 || v === "1";

// ── CSS builder ───────────────────────────────────────────────────────────────

function _buildRules() {
  const rules = [];
  if (cfg.hideFooter)
    rules.push(".home-footer-bottom { display: none !important; }");
  if (cfg.hideNavSettings) {
    // Two different IDs: home page vs results page
    rules.push("#nav-settings-top { display: none !important; }");
    rules.push("#nav-settings-results { display: none !important; }");
  }
  if (cfg.hideLogo)
    // #home-logo only exists on the home page — hides the default logo and
    // any custom logo set by the Logotype plugin.
    rules.push("#home-logo { display: none !important; }");
  if (cfg.buttons === "hide-lucky")
    rules.push("#btn-lucky { display: none !important; }");
  if (cfg.buttons === "arrow")
    rules.push(".button-row { display: none !important; }");
  return rules.join("\n");
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "ohmyclean",
  name:        "OhMyClean",
  description: "Selectively hide or replace Degoog UI elements — footer, settings gear, search buttons.",
  position:    "above-results",
  isClientExposed: false,

  settingsSchema: [
    {
      key:         "hideFooter",
      label:       "Hide home page footer",
      type:        "toggle",
      default:     false,
      description: 'Hides the bottom footer ("degoog vX.Y.Z | repo | docs") on the home page.',
    },
    {
      key:         "hideNavSettings",
      label:       "Hide settings gear icon",
      type:        "toggle",
      default:     false,
      description:
        "Hides the ⚙ gear icon on both the home page and results pages. " +
        "Settings remain accessible at /settings.",
    },
    {
      key:         "hideLogo",
      label:       "Hide logo / wordmark",
      type:        "toggle",
      default:     false,
      description:
        "Hides the logo area on the home page — works with the default Degoog logo " +
        "and with any custom logo set by the Logotype plugin.",
    },
    {
      key:     "buttons",
      label:   "Search buttons",
      type:    "select",
      options: ["default", "hide-lucky", "arrow"],
      default: "default",
      description:
        'default — keep both · ' +
        'hide-lucky — remove "I\'m Feeling Lucky", keep Search · ' +
        'arrow — remove both buttons, add a minimal → inside the search bar',
    },
  ],

  configure(settings) {
    cfg.hideFooter      = _bool(settings.hideFooter);
    cfg.hideNavSettings = _bool(settings.hideNavSettings);
    cfg.hideLogo        = _bool(settings.hideLogo);
    cfg.buttons         = ["default", "hide-lucky", "arrow"].includes(settings.buttons)
      ? settings.buttons
      : "default";
  },

  // style.css and script.js are loaded globally by Degoog on every page
  // (home, results, settings) regardless of trigger(). This slot never
  // renders HTML — all work is done by script.js injecting <style> into <head>.
  trigger() { return false; },
  async execute() { return { html: "" }; },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/.../config
    // Returns current settings + pre-built CSS for script.js.
    // Non-sensitive (UI prefs only) — intentionally unauthenticated.
    method: "get",
    path: "/config",
    handler(_req) {
      return new Response(
        JSON.stringify({
          hideFooter:      cfg.hideFooter,
          hideNavSettings: cfg.hideNavSettings,
          hideLogo:        cfg.hideLogo,
          buttons:         cfg.buttons,
          css:             _buildRules(),
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  },
];

export default { slot, routes };
