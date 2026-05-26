// Snip — client-side style injector.
//
// Degoog replaces __PLUGIN_ID__ in this file before serving it, so we can
// build the correct /api/plugin/<id>/config URL without any URL-sniffing.
//
// Loaded on every page (home, results, settings) — see Degoog layout.html.
// sessionStorage cache → zero flash-of-unstyled-content on repeat loads.

(function () {
  "use strict";

  // Degoog substitutes the real plugin ID here at serve time.
  var CONFIG_URL = "/api/plugin/__PLUGIN_ID__/config";

  var STYLE_ID  = "snip-style-head";
  var ARROW_ID  = "snip-arrow-btn";
  var CACHE_KEY = "snip-cfg";

  // ── Apply a config object ──────────────────────────────────────────────────

  function applyConfig(c) {
    // Build the CSS rules from the server-provided string.
    var css = c.css || "";

    // Inject / replace <style> in <head>.
    var existing = document.getElementById(STYLE_ID);
    if (existing) existing.parentNode.removeChild(existing);

    if (css) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }

    // Arrow button injection.
    if (c.buttons === "arrow") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectArrow);
      } else {
        injectArrow();
      }
    }
  }

  // ── Arrow button ───────────────────────────────────────────────────────────
  // Appended inside #search-bar-home — appears as an icon within the bar.

  function injectArrow() {
    if (document.getElementById(ARROW_ID)) return;
    var bar = document.getElementById("search-bar-home");
    if (!bar) return;
    var btn = document.createElement("button");
    btn.type = "submit";
    btn.id   = ARROW_ID;
    btn.setAttribute("aria-label", "Search");
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="5" y1="12" x2="19" y2="12"/>' +
      '<polyline points="12 5 19 12 12 19"/>' +
      "</svg>";
    bar.appendChild(btn);
  }

  // ── Load config (cache-first) ──────────────────────────────────────────────

  // Apply cached version immediately → no FOUC on repeat loads.
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) applyConfig(JSON.parse(raw));
  } catch (e) { /* ignore */ }

  // Fetch fresh config in the background.
  fetch(CONFIG_URL, { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
      applyConfig(c);
    })
    .catch(function () { /* degrade gracefully */ });
})();
