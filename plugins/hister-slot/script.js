// Hister First — client-side redirect handler for the Hister Slot plugin.
//
// Degoog injects slot HTML via innerHTML, which browsers refuse to execute
// <script> tags from. This file is loaded normally by Degoog (like style.css)
// so it can use DOM APIs freely.
//
// Strategy: watch for <div id="hf-redir" data-q="..."> being added to the DOM
// by the slot's execute(). When found, redirect to ?type=hister so only the
// Hister engine runs — unless we're already on that type (no infinite loop).

(function () {
  "use strict";

  function tryRedirect() {
    var el = document.getElementById("hf-redir");
    if (!el) return;

    // Already on the Hister tab — do nothing (prevents redirect loop)
    var type = new URLSearchParams(window.location.search).get("type") || "web";
    if (type === "hister") return;

    var q = el.getAttribute("data-q");
    if (q) {
      window.location.replace(
        "/search?q=" + encodeURIComponent(q) + "&type=hister",
      );
    }
  }

  // 1. Run immediately — handles SSR where the element may already be in the DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryRedirect);
  } else {
    tryRedirect();
  }

  // 2. Watch for the marker being injected dynamically (client-side slot render)
  var observer = new MutationObserver(tryRedirect);

  function startObserving() {
    var target = document.body || document.documentElement;
    if (target) observer.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserving);
  } else {
    startObserving();
  }
})();
