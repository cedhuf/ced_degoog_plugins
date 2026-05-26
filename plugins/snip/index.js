// Snip — cosmetic plugin for Degoog
// Selectively hides or replaces UI elements on the home page.
//
// Works via style.css (loaded globally) + script.js (fetches /config and
// applies CSS classes to <html>). The slot itself never renders any HTML.
//
// Confirmed selectors from degoog-org/degoog source:
//   .home-footer-bottom  — home page footer
//   #nav-settings-top    — top-right settings gear icon
//   .button-row          — row containing search + lucky buttons
//   #btn-lucky           — "I'm Feeling Lucky" button
//   #search-bar-home     — search bar wrapper div
//   #search-form-home    — home search form

const cfg = {
  hideFooter:      false,
  hideNavSettings: false,
  buttons:         "default", // "default" | "hide-lucky" | "arrow"
};

export const slot = {
  id:          "snip",
  name:        "Snip",
  description: "Selectively hide or replace Degoog home page UI elements — footer, nav icon, buttons.",
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
        "default — keep both buttons · " +
        "hide-lucky — remove \"I'm Feeling Lucky\", keep Search · " +
        "arrow — remove both buttons, add a minimal → inside the search bar",
    },
  ],

  configure(settings) {
    cfg.hideFooter      = Boolean(settings.hideFooter);
    cfg.hideNavSettings = Boolean(settings.hideNavSettings);
    cfg.buttons         = ["default", "hide-lucky", "arrow"].includes(settings.buttons)
      ? settings.buttons
      : "default";
  },

  // This slot is CSS/script only — it never injects HTML.
  trigger() { return false; },
  async execute() { return { html: "" }; },
};

// ── Routes ────────────────────────────────────────────────────────────────────

export const routes = [
  {
    // GET /api/plugin/snip/config
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
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  },
];

export default { slot, routes };
