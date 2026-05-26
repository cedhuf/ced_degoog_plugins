// Snip — cosmetic plugin for Degoog
// Selectively hides or replaces UI elements on the home page.
//
// Strategy:
//   • execute() injects a <style> block into the search-results DOM.
//     (<style> via innerHTML works; <script> does not.)
//   • script.js injects the same <style> into <head> on every page,
//     covering the home page and any client-side navigation.
//   • /config route serves current settings as JSON for script.js.
//
// Confirmed selectors from degoog-org/degoog source (index-templates/):
//   .home-footer-bottom  — home page footer
//   #nav-settings-top    — top-right settings gear icon
//   .button-row          — row with search + lucky buttons
//   #btn-lucky           — "I'm Feeling Lucky" button
//   #search-bar-home     — search bar wrapper (arrow injected here)

const cfg = {
  hideFooter:      false,
  hideNavSettings: false,
  buttons:         "default", // "default" | "hide-lucky" | "arrow"
};

// ── CSS builder ───────────────────────────────────────────────────────────────

function _buildRules() {
  const rules = [];
  if (cfg.hideFooter)
    rules.push(".home-footer-bottom { display: none !important; }");
  if (cfg.hideNavSettings)
    rules.push("#nav-settings-top { display: none !important; }");
  if (cfg.buttons === "hide-lucky")
    rules.push("#btn-lucky { display: none !important; }");
  if (cfg.buttons === "arrow")
    rules.push(".button-row { display: none !important; }");
  return rules.join("\n");
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  id:          "snip",
  name:        "Snip",
  description: "Selectively hide or replace Degoog home page elements — footer, settings icon, search buttons.",
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
      description: "Hides the ⚙ icon in the top-right corner of the home page.",
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
    cfg.hideFooter      = Boolean(settings.hideFooter);
    cfg.hideNavSettings = Boolean(settings.hideNavSettings);
    cfg.buttons         = ["default", "hide-lucky", "arrow"].includes(settings.buttons)
      ? settings.buttons
      : "default";
  },

  // Always trigger — we need to inject our <style> on every search page.
  trigger() { return true; },

  async execute() {
    const rules = _buildRules();
    // Nothing to do — return empty so we don't pollute the results page.
    if (!rules) return { html: "" };
    // Inject as a <style> block. Unlike <script>, <style> works via innerHTML.
    return {
      html: `<style id="snip-style">${rules}</style>`,
    };
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/.../config
    // Returns current settings as JSON for script.js to consume.
    // Non-sensitive (UI prefs only) — intentionally unauthenticated.
    method: "get",
    path: "/config",
    handler(_req) {
      return new Response(
        JSON.stringify({
          hideFooter:      cfg.hideFooter,
          hideNavSettings: cfg.hideNavSettings,
          buttons:         cfg.buttons,
          css:             _buildRules(), // pre-built for script.js convenience
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  },
];

export default { slot, routes };
