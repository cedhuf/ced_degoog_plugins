// Snip — client-side CSS class applicator.
//
// Finds its own plugin base URL from the <script> tag, fetches /config,
// caches in sessionStorage to prevent flash-of-unstyled-content on reload,
// then applies CSS classes to <html> and (optionally) injects the arrow button.

(function () {
  "use strict";

  // ── Find plugin base URL ───────────────────────────────────────────────────
  // document.currentScript is set while this script executes synchronously.
  // Fall back to scanning <script> tags if the browser clears it (e.g. defer).

  var base = null;

  var cur = document.currentScript;
  if (cur && cur.src) {
    base = cur.src.replace(/\/script\.js(\?.*)?$/, "");
  } else {
    var tags = document.getElementsByTagName("script");
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].src && /\/snip\/script\.js/.test(tags[i].src)) {
        base = tags[i].src.replace(/\/script\.js(\?.*)?$/, "");
        break;
      }
    }
  }

  if (!base) return; // Can't derive config URL — bail silently

  // ── Apply config object to <html> ──────────────────────────────────────────

  function applyConfig(c) {
    var html = document.documentElement;
    if (c.hideFooter)      html.classList.add("snip-hide-footer");
    if (c.hideNavSettings) html.classList.add("snip-hide-nav");
    if (c.buttons === "hide-lucky") html.classList.add("snip-hide-lucky");
    if (c.buttons === "arrow") {
      html.classList.add("snip-arrow-mode");
      injectArrow();
    }
  }

  // ── Arrow button injection ─────────────────────────────────────────────────
  // Appends a minimal submit button inside #search-bar-home so it appears
  // as an icon within the search bar itself. .button-row is hidden via CSS.

  function injectArrow() {
    function tryInject() {
      if (document.getElementById("snip-arrow-btn")) return; // already done
      var bar = document.getElementById("search-bar-home");
      if (!bar) return;
      var btn = document.createElement("button");
      btn.type = "submit";
      btn.id   = "snip-arrow-btn";
      btn.setAttribute("aria-label", "Search");
      btn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="5" y1="12" x2="19" y2="12"/>' +
        '<polyline points="12 5 19 12 12 19"/>' +
        "</svg>";
      bar.appendChild(btn);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", tryInject);
    } else {
      tryInject();
    }
  }

  // ── Fetch config with sessionStorage cache ─────────────────────────────────
  // Applying the cached version first means zero FOUC on repeat page loads.

  var CACHE_KEY = "snip-cfg";

  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch (e) {}
  if (cached) applyConfig(cached);

  fetch(base + "/config", { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
      applyConfig(c); // idempotent — adding a class twice is a no-op
    })
    .catch(function () { /* silent — degrade gracefully */ });
})();
