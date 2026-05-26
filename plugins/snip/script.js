// Snip — client-side style injector.
//
// Runs on every page (home + results). Fetches /config, builds a <style>
// element and injects it into <head>. sessionStorage cache means zero
// flash-of-unstyled-content on repeat loads.
//
// Also handles arrow button injection when buttons="arrow".

(function () {
  "use strict";

  var STYLE_ID  = "snip-style-head";
  var CACHE_KEY = "snip-cfg";
  var ARROW_ID  = "snip-arrow-btn";

  // ── Derive plugin base URL from the <script> tag ───────────────────────────

  var base = null;

  // document.currentScript is set during synchronous script execution.
  var cur = document.currentScript;
  if (cur && cur.src) {
    base = cur.src.replace(/\/script\.js(\?.*)?$/, "");
  }

  // Fallback: scan all <script> tags (needed if script is async/deferred).
  if (!base) {
    var tags = document.getElementsByTagName("script");
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].src && /\/snip\/script\.js/.test(tags[i].src)) {
        base = tags[i].src.replace(/\/script\.js(\?.*)?$/, "");
        break;
      }
    }
  }

  if (!base) return; // Can't find our own URL — bail silently.

  // ── Apply a config object ──────────────────────────────────────────────────

  function applyConfig(c) {
    // Inject / replace <style> in <head>
    var existing = document.getElementById(STYLE_ID);
    if (existing) existing.parentNode.removeChild(existing);

    var css = c.css || "";
    if (css) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }

    // Arrow button
    if (c.buttons === "arrow") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectArrow);
      } else {
        injectArrow();
      }
    }
  }

  // ── Arrow button ───────────────────────────────────────────────────────────
  // Appended inside #search-bar-home so it appears as an icon in the bar.

  function injectArrow() {
    if (document.getElementById(ARROW_ID)) return; // already injected
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
  fetch(base + "/config", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
      applyConfig(c);
    })
    .catch(function () { /* degrade gracefully */ });
})();
