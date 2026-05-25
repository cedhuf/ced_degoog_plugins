(function () {

  // ── Constants (must match index.js) ────────────────────────────────────────

  const FONTS = [
    { id: "outfit",        name: "Outfit",        family: "Outfit",           weight: "700", gfQuery: "Outfit:wght@700" },
    { id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk",    weight: "700", gfQuery: "Space+Grotesk:wght@700" },
    { id: "bebas-neue",    name: "Bebas Neue",    family: "Bebas Neue",       weight: "400", gfQuery: "Bebas+Neue" },
    { id: "playfair",      name: "Playfair",      family: "Playfair Display", weight: "700", gfQuery: "Playfair+Display:wght@700" },
    { id: "raleway",       name: "Raleway",       family: "Raleway",          weight: "300", gfQuery: "Raleway:wght@300" },
    { id: "josefin",       name: "Josefin",       family: "Josefin Sans",     weight: "700", gfQuery: "Josefin+Sans:wght@700" },
  ];
  const FONT_MAP = Object.fromEntries(FONTS.map(f => [f.id, f]));

  // ── Font loading ────────────────────────────────────────────────────────────

  const _loadedFonts = new Set();
  function _loadGoogleFonts(queries) {
    const toLoad = queries.filter(q => !_loadedFonts.has(q));
    if (!toLoad.length) return;
    toLoad.forEach(q => _loadedFonts.add(q));
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${toLoad.map(q => `family=${q}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }
  const _loadAllPreviewFonts = () => _loadGoogleFonts(FONTS.map(f => f.gfQuery));
  const _loadFont = (fontId) => _loadGoogleFonts([(FONT_MAP[fontId] || FONTS[0]).gfQuery]);

  // ── Page-logo state ─────────────────────────────────────────────────────────

  const _hideStyle = document.createElement("style");
  _hideStyle.textContent = "#home-logo .logo, .results-logo { visibility: hidden !important; }";
  document.head.appendChild(_hideStyle);

  const _searchHideStyle = document.createElement("style");
  _searchHideStyle.textContent = "#search-bar-home, .button-row { clip-path: inset(0 100% 0 0); }";
  document.head.appendChild(_searchHideStyle);

  let _cachedDataUrl  = undefined;
  let _cachedWordmark = undefined;
  let _logoIntro = "none";
  let _introPlayed = false;
  let _searchMaxHeight = 100, _searchMaxWidth = 300;
  let _homeMaxHeight   = 300, _homeMaxWidth   = 500;
  let _dimensionsLoaded = false;
  let _settingsPromise = null;

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  function loadSettings() {
    if (_settingsPromise) return _settingsPromise;
    _settingsPromise = fetch("/api/plugin/logotype/settings")
      .then(r => r.json())
      .then(d => { _logoIntro = ["none","fade","matrix"].includes(d?.logoIntro) ? d.logoIntro : "none"; })
      .catch(() => {});
    return _settingsPromise;
  }

  async function loadDimensions() {
    if (_dimensionsLoaded) return;
    try {
      const d = await fetch("/api/plugin/logotype/dimensions").then(r => r.json());
      const p = (v, fb) => { const n = parseInt(v,10); return !isNaN(n) && n > 0 ? n : fb; };
      _homeMaxHeight = p(d.homeMaxHeight,300); _homeMaxWidth  = p(d.homeMaxWidth,500);
      _searchMaxHeight = p(d.searchMaxHeight,100); _searchMaxWidth = p(d.searchMaxWidth,300);
      _dimensionsLoaded = true;
    } catch {}
  }

  async function fetchLogo() {
    if (_cachedDataUrl !== undefined) return _cachedDataUrl;
    try {
      const d = await fetch("/api/plugin/logotype/logo").then(r => r.json());
      return (_cachedDataUrl = d.dataUrl ?? null);
    } catch { return (_cachedDataUrl = null); }
  }

  async function fetchWordmark() {
    if (_cachedWordmark !== undefined) return _cachedWordmark;
    try {
      const d = await fetch("/api/plugin/logotype/wordmark").then(r => r.json());
      return (_cachedWordmark = d.text ? d : null);
    } catch { return (_cachedWordmark = null); }
  }

  // ── Wordmark rendering ──────────────────────────────────────────────────────

  // Convert CSS gradient angle to SVG linearGradient coordinates
  function _angleToSvgCoords(angle) {
    const rad = (angle - 90) * Math.PI / 180;
    const x2 = +(0.5 + 0.5 * Math.cos(rad)).toFixed(4);
    const y2 = +(0.5 + 0.5 * Math.sin(rad)).toFixed(4);
    return { x1: +(1 - x2).toFixed(4), y1: +(1 - y2).toFixed(4), x2, y2 };
  }

  // Build wordmark content (text + optional decorators) into a container element.
  // Safe: only sets textContent for user-supplied text.
  function _buildWordmarkContent(container, config, fontDef) {
    const color = config.color    || { type: "none" };
    const dec   = config.decorator || { type: "none", position: "before" };

    const showBefore = dec.type !== "none" && (dec.position === "before" || dec.position === "both");
    const showAfter  = dec.type !== "none" && (dec.position === "after"  || dec.position === "both");

    // Compute SVG fill + optional gradient defs
    let svgFill = "currentColor";
    let defsHtml = "";
    if (color.type === "solid") {
      svgFill = color.value;
    } else if (color.type === "gradient") {
      const gid = `lt-g-${Math.random().toString(36).slice(2, 9)}`;
      const c = _angleToSvgCoords(color.angle || 90);
      defsHtml = `<defs><linearGradient id="${gid}" x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="${color.from}"/><stop offset="100%" stop-color="${color.to}"/></linearGradient></defs>`;
      svgFill = `url(#${gid})`;
    }

    function _decSvgStr(mirrored, includeDefs) {
      const defs = includeDefs ? defsHtml : "";
      const f = svgFill;
      switch (dec.type) {
        case "bars": {
          const r = mirrored
            ? `<rect x="0" y="0" width="3" height="16" rx="0.5" fill="${f}"/><rect x="4.5" y="5" width="3" height="11" rx="0.5" fill="${f}"/><rect x="9" y="10" width="3" height="6" rx="0.5" fill="${f}"/>`
            : `<rect x="0" y="10" width="3" height="6" rx="0.5" fill="${f}"/><rect x="4.5" y="5" width="3" height="11" rx="0.5" fill="${f}"/><rect x="9" y="0" width="3" height="16" rx="0.5" fill="${f}"/>`;
          return `<svg class="lt-word-dec" width="14" height="1em" viewBox="0 0 12 16" xmlns="http://www.w3.org/2000/svg">${defs}${r}</svg>`;
        }
        case "line":
          return `<svg class="lt-word-dec" width="3" height="1em" viewBox="0 0 3 16" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="3" height="16" rx="1.5" fill="${f}"/></svg>`;
        case "dot":
          return `<svg class="lt-word-dec lt-word-dec--dot" width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">${defs}<circle cx="4" cy="4" r="4" fill="${f}"/></svg>`;
        default: return "";
      }
    }

    // Build HTML string — SVG only (no user text in innerHTML)
    let html = "";
    if (showBefore) html += _decSvgStr(false, true);
    html += `<span class="lt-word-text"></span>`;
    if (showAfter)  html += _decSvgStr(true, !showBefore);
    container.innerHTML = html;

    // Set user text safely + apply text color styles
    const textSpan = container.querySelector(".lt-word-text");
    if (textSpan) {
      textSpan.textContent = config.text;
      textSpan.style.fontFamily = `"${fontDef.family}", sans-serif`;
      textSpan.style.fontWeight = fontDef.weight;
      if (color.type === "solid") {
        textSpan.style.color = color.value;
      } else if (color.type === "gradient") {
        const angle = color.angle || 90;
        textSpan.style.background = `linear-gradient(${angle}deg, ${color.from}, ${color.to})`;
        textSpan.style.webkitBackgroundClip = "text";
        textSpan.style.webkitTextFillColor  = "transparent";
        textSpan.style.backgroundClip       = "text";
      }
    }
  }

  // ── Apply wordmark to page logos ────────────────────────────────────────────

  function applyWordmark(config) {
    const fontDef = FONT_MAP[config.font] || FONTS[0];
    _loadFont(config.font);

    for (const { sel, search } of [
      { sel: "#home-logo .logo", search: false },
      { sel: ".results-logo",    search: true  },
    ]) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.logotypeApplied) continue;
      el.dataset.logotypeApplied = "1";

      const wrapper = document.createElement("span");
      wrapper.className = search
        ? "logotype-wordmark logotype-wordmark--search"
        : "logotype-wordmark";

      _buildWordmarkContent(wrapper, config, fontDef);

      if (el.tagName === "A") el.replaceChildren(wrapper);
      else el.replaceWith(wrapper);
    }
  }

  // ── Apply image logo to page ────────────────────────────────────────────────

  function applyLogo(dataUrl, intro) {
    document.querySelectorAll(".logotype-img").forEach(el => { el.src = dataUrl; });

    const newImgs = [];
    for (const { sel, search } of [
      { sel: "#home-logo .logo", search: false },
      { sel: ".results-logo",    search: true  },
    ]) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.logotypeApplied) continue;
      el.dataset.logotypeApplied = "1";

      const img = document.createElement("img");
      img.src = dataUrl; img.alt = "Logo";
      img.className = search ? "logotype-img logotype-img--search" : "logotype-img";
      img.style.maxHeight = `${search ? _searchMaxHeight : _homeMaxHeight}px`;
      img.style.maxWidth  = `${search ? _searchMaxWidth  : _homeMaxWidth}px`;

      if (el.tagName === "A") el.replaceChildren(img);
      else el.replaceWith(img);
      newImgs.push(img);
    }

    if (!_introPlayed && intro && intro !== "none" && newImgs.length) {
      _introPlayed = true;
      newImgs.forEach(img => _runIntro(img, intro));
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  async function init() {
    await Promise.all([loadDimensions(), loadSettings()]);
    const [wm, dataUrl] = await Promise.all([fetchWordmark(), fetchLogo()]);

    if (wm?.text) {
      applyWordmark(wm);
      _searchHideStyle.remove();
    } else if (dataUrl) {
      applyLogo(dataUrl, _logoIntro);
      if (!_logoIntro.match(/^(matrix|fade)$/)) _searchHideStyle.remove();
    } else {
      _searchHideStyle.remove();
    }
    _hideStyle.remove();
  }

  // ── Card UI helpers ─────────────────────────────────────────────────────────

  function _setStatus(root, msg, ok) {
    const el = root.querySelector("#logotype-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "var(--success, #a6e3a1)" : "";
  }

  // Read current UI state from DOM
  function _readState(root) {
    const colorMode = root.querySelector(".lt-mode-btn.active")?.dataset.mode || "none";
    let color = { type: "none" };
    if (colorMode === "solid") {
      color = { type: "solid", value: root.querySelector("#lt-solid-custom")?.value || "#4a9eff" };
    } else if (colorMode === "gradient") {
      color = {
        type:  "gradient",
        from:  root.querySelector("#lt-grad-from")?.value  || "#06b6d4",
        to:    root.querySelector("#lt-grad-to")?.value    || "#8b5cf6",
        angle: parseInt(root.querySelector(".lt-angle-btn.active")?.dataset.angle || "90", 10),
      };
    }
    return {
      text:      root.querySelector("#lt-wm-text")?.value       || "",
      font:      root.querySelector(".lt-font-chip.active")?.dataset.font || "outfit",
      color,
      decorator: {
        type:     root.querySelector(".lt-dec-chip.active")?.dataset.type || "none",
        position: root.querySelector(".lt-pos-btn.active")?.dataset.pos  || "before",
      },
    };
  }

  // Refresh live preview from current UI state
  function _refreshPreview(root) {
    const state = _readState(root);
    let el = root.querySelector("#lt-preview-el");
    if (!el) return;

    // Ensure it's a span (not an img from image mode)
    if (el.tagName !== "SPAN") {
      const span = document.createElement("span");
      span.id = "lt-preview-el";
      el.replaceWith(span);
      el = span;
    }

    el.className = `lt-wm-preview-text${!state.text ? " lt-wm-preview-empty" : ""}`;
    el.innerHTML = "";

    const fontDef = FONT_MAP[state.font] || FONTS[0];
    _buildWordmarkContent(el, {
      text:      state.text || "Your brand",
      font:      state.font,
      color:     state.color,
      decorator: state.decorator,
    }, fontDef);
  }

  // ── Card UI wiring ──────────────────────────────────────────────────────────

  function wireResultUi(root) {
    _loadAllPreviewFonts();

    const card = /** @type {HTMLElement} */ (root);
    let activeTab = card.dataset.defaultTab || "text";

    // ── Tabs
    root.querySelectorAll(".lt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;
        root.querySelectorAll(".lt-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        root.querySelectorAll(".lt-panel").forEach(p => { p.style.display = "none"; });
        const panel = root.querySelector(`#lt-panel-${tab}`);
        if (panel) panel.style.display = "";

        if (tab === "text") {
          _refreshPreview(root);
        } else {
          _switchPreviewToImage(root, _cachedDataUrl || null);
        }
      });
    });

    // ── Text input — live preview
    root.querySelector("#lt-wm-text")?.addEventListener("input", () => {
      if (activeTab === "text") _refreshPreview(root);
    });

    // ── Font chips
    root.querySelectorAll(".lt-font-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        root.querySelectorAll(".lt-font-chip").forEach(c => c.classList.toggle("active", c === chip));
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Color mode buttons
    root.querySelectorAll(".lt-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        root.querySelectorAll(".lt-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        root.querySelector("#lt-solid-panel").style.display    = mode === "solid"    ? "" : "none";
        root.querySelector("#lt-gradient-panel").style.display = mode === "gradient" ? "" : "none";
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Solid swatches
    root.querySelectorAll(".lt-swatch[data-color]").forEach(swatch => {
      swatch.addEventListener("click", () => {
        root.querySelectorAll(".lt-swatch[data-color]").forEach(s => s.classList.toggle("active", s === swatch));
        const customInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-solid-custom"));
        if (customInput) customInput.value = swatch.dataset.color;
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Custom solid color input
    root.querySelector("#lt-solid-custom")?.addEventListener("input", () => {
      root.querySelectorAll(".lt-swatch[data-color]").forEach(s => s.classList.remove("active"));
      if (activeTab === "text") _refreshPreview(root);
    });

    // ── Gradient from/to inputs
    ["#lt-grad-from", "#lt-grad-to"].forEach(id => {
      root.querySelector(id)?.addEventListener("input", () => {
        root.querySelectorAll(".lt-swatch-grad").forEach(s => s.classList.remove("active"));
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Angle buttons
    root.querySelectorAll(".lt-angle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".lt-angle-btn").forEach(b => b.classList.toggle("active", b === btn));
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Gradient presets
    root.querySelectorAll(".lt-swatch-grad").forEach(swatch => {
      swatch.addEventListener("click", () => {
        const from = swatch.dataset.from, to = swatch.dataset.to;
        const angle = parseInt(swatch.dataset.angle || "90", 10);
        const fromInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-grad-from"));
        const toInput   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-grad-to"));
        if (fromInput) fromInput.value = from;
        if (toInput)   toInput.value   = to;
        root.querySelectorAll(".lt-angle-btn").forEach(b => b.classList.toggle("active", parseInt(b.dataset.angle) === angle));
        root.querySelectorAll(".lt-swatch-grad").forEach(s => s.classList.toggle("active", s === swatch));
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Decorator type chips
    root.querySelectorAll(".lt-dec-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        root.querySelectorAll(".lt-dec-chip").forEach(c => c.classList.toggle("active", c === chip));
        const isNone = chip.dataset.type === "none";
        const posRow = root.querySelector("#lt-pos-row");
        if (posRow) posRow.style.display = isNone ? "none" : "";
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Decorator position buttons
    root.querySelectorAll(".lt-pos-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".lt-pos-btn").forEach(b => b.classList.toggle("active", b === btn));
        if (activeTab === "text") _refreshPreview(root);
      });
    });

    // ── Save wordmark
    root.querySelector("#lt-wm-save")?.addEventListener("click", async () => {
      const state = _readState(root);
      if (!state.text.trim()) { _setStatus(root, "Enter a brand name first.", false); return; }
      try {
        const res = await fetch("/api/plugin/logotype/wordmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        const json = await res.json();
        if (!res.ok) { _setStatus(root, json.error ?? "Save failed.", false); return; }
        _cachedWordmark = { ...state };
        _setStatus(root, "Saved! Reloading…", true);
        setTimeout(() => location.reload(), 800);
      } catch { _setStatus(root, "Save failed.", false); }
    });

    // ── Image upload
    root.querySelector("#logotype-file")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { _setStatus(root, "Image too large (max 2 MB).", false); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = /** @type {string} */ (reader.result);
        try {
          const res = await fetch("/api/plugin/logotype/logo", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          });
          const json = await res.json();
          if (!res.ok) { _setStatus(root, json.error ?? "Upload failed.", false); return; }
          _cachedDataUrl = dataUrl;
          _switchPreviewToImage(root, dataUrl);
          _updateImgThumb(root, dataUrl);
          _setStatus(root, "Saved! Reloading…", true);
          setTimeout(() => location.reload(), 800);
        } catch { _setStatus(root, "Upload failed.", false); }
      };
      reader.readAsDataURL(file);
    });

    // ── Remove image
    root.querySelector("#logotype-remove")?.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/plugin/logotype/logo", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: null }),
        });
        if (!res.ok) { _setStatus(root, "Remove failed.", false); return; }
        _cachedDataUrl = null;
        _updateImgThumb(root, null);
        _switchPreviewToImage(root, null);
        _setStatus(root, "Image removed.", true);
      } catch { _setStatus(root, "Remove failed.", false); }
    });

    // ── Dimension sliders
    const homeHSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-h"));
    const homeWSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-w"));
    const searchHSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-h"));
    const searchWSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-w"));

    [[homeHSlider,"lt-home-h-val"],[homeWSlider,"lt-home-w-val"],[searchHSlider,"lt-search-h-val"],[searchWSlider,"lt-search-w-val"]]
      .forEach(([slider, valId]) => {
        if (!slider) return;
        const label = root.querySelector(`#${valId}`);
        slider.addEventListener("input", () => { if (label) label.textContent = `${slider.value}px`; });
      });

    root.querySelector("#logotype-reset-dims")?.addEventListener("click", async () => {
      const defaults = { homeMaxHeight: 300, homeMaxWidth: 500, searchMaxHeight: 100, searchMaxWidth: 300 };
      if (homeHSlider)   { homeHSlider.value   = "300"; root.querySelector("#lt-home-h-val").textContent   = "300px"; }
      if (homeWSlider)   { homeWSlider.value   = "500"; root.querySelector("#lt-home-w-val").textContent   = "500px"; }
      if (searchHSlider) { searchHSlider.value = "100"; root.querySelector("#lt-search-h-val").textContent = "100px"; }
      if (searchWSlider) { searchWSlider.value = "300"; root.querySelector("#lt-search-w-val").textContent = "300px"; }
      try {
        const res = await fetch("/api/plugin/logotype/dimensions", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(defaults),
        });
        if (!res.ok) { _setStatus(root, "Reset failed.", false); return; }
        _homeMaxHeight = 300; _homeMaxWidth = 500; _searchMaxHeight = 100; _searchMaxWidth = 300;
        _dimensionsLoaded = true;
        _setStatus(root, "Dimensions reset to defaults.", true);
      } catch { _setStatus(root, "Reset failed.", false); }
    });

    root.querySelector("#logotype-save-dims")?.addEventListener("click", async () => {
      const dims = {
        homeMaxHeight:   parseInt(homeHSlider?.value   ?? "300", 10),
        homeMaxWidth:    parseInt(homeWSlider?.value   ?? "500", 10),
        searchMaxHeight: parseInt(searchHSlider?.value ?? "100", 10),
        searchMaxWidth:  parseInt(searchWSlider?.value ?? "300", 10),
      };
      try {
        const res = await fetch("/api/plugin/logotype/dimensions", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dims),
        });
        if (!res.ok) { _setStatus(root, "Save failed.", false); return; }
        Object.assign({ _homeMaxHeight: dims.homeMaxHeight, _homeMaxWidth: dims.homeMaxWidth, _searchMaxHeight: dims.searchMaxHeight, _searchMaxWidth: dims.searchMaxWidth });
        _homeMaxHeight = dims.homeMaxHeight; _homeMaxWidth = dims.homeMaxWidth;
        _searchMaxHeight = dims.searchMaxHeight; _searchMaxWidth = dims.searchMaxWidth;
        _dimensionsLoaded = true;
        document.querySelectorAll(".logotype-img--search").forEach(el => { el.style.maxHeight = `${_searchMaxHeight}px`; el.style.maxWidth = `${_searchMaxWidth}px`; });
        document.querySelectorAll(".logotype-img:not(.logotype-img--search)").forEach(el => { el.style.maxHeight = `${_homeMaxHeight}px`; el.style.maxWidth = `${_homeMaxWidth}px`; });
        _setStatus(root, "Dimensions saved!", true);
      } catch { _setStatus(root, "Save failed.", false); }
    });

    // ── Reset all
    root.querySelector("#lt-reset")?.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/plugin/logotype/reset", { method: "POST" });
        if (!res.ok) { _setStatus(root, "Reset failed.", false); return; }
        _cachedDataUrl = null; _cachedWordmark = null;
        _setStatus(root, "Reset. Reloading…", true);
        setTimeout(() => location.reload(), 600);
      } catch { _setStatus(root, "Reset failed.", false); }
    });
  }

  // ── Preview helpers ─────────────────────────────────────────────────────────

  function _switchPreviewToImage(root, dataUrl) {
    const area = root.querySelector(".lt-preview-logo-area");
    if (!area) return;
    let el = root.querySelector("#lt-preview-el");
    if (dataUrl) {
      if (!el || el.tagName !== "IMG") {
        const img = document.createElement("img");
        img.id = "lt-preview-el"; img.alt = "Logo";
        img.style.cssText = "max-height:80px;max-width:280px;object-fit:contain;display:block;";
        if (el) el.replaceWith(img); else area.appendChild(img);
        el = img;
      }
      el.src = dataUrl;
    } else {
      if (el && el.tagName === "IMG") {
        const span = document.createElement("span");
        span.id = "lt-preview-el";
        span.className = "lt-wm-preview-text lt-wm-preview-empty";
        span.textContent = "Your brand";
        el.replaceWith(span);
      }
    }
  }

  function _updateImgThumb(root, dataUrl) {
    const existing = root.querySelector("#logotype-preview");
    const noLogo   = root.querySelector("#logotype-nologo");
    if (dataUrl) {
      if (existing) { existing.src = dataUrl; }
      else if (noLogo) {
        const img = document.createElement("img");
        img.id = "logotype-preview"; img.alt = "Current logo"; img.className = "lt-img-thumb"; img.src = dataUrl;
        noLogo.replaceWith(img);
      }
    } else {
      if (existing) {
        const p = document.createElement("p");
        p.id = "logotype-nologo"; p.className = "lt-img-none"; p.textContent = "No image set.";
        existing.replaceWith(p);
      }
    }
  }

  // ── Intro animations ────────────────────────────────────────────────────────

  function _runIntro(img, type) {
    if (type === "fade") _fadeIn(img);
    else if (type === "matrix") _matrixIn(img);
  }

  async function _fadeIn(img) {
    const searchBar = document.querySelector("#search-bar-home");
    const buttonRow = document.querySelector(".button-row");
    await new Promise(resolve => {
      const duration = 650, start = performance.now();
      img.style.opacity = "0";
      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        img.style.opacity = String(t);
        if (t < 1) requestAnimationFrame(frame);
        else { img.style.opacity = ""; resolve(); }
      }
      requestAnimationFrame(frame);
    });
    if (searchBar) {
      await _fadeReveal(searchBar, 350); await _fadeReveal(buttonRow, 280);
      _searchHideStyle.remove(); searchBar.style.clipPath = ""; if (buttonRow) buttonRow.style.clipPath = "";
    }
  }

  async function _matrixIn(img) {
    try { await img.decode(); } catch { return; }
    const w = img.naturalWidth || 400, h = img.naturalHeight || 200, PAD = 100;
    const searchBar = document.querySelector("#search-bar-home");
    const buttonRow = document.querySelector(".button-row");
    if (searchBar) [searchBar, buttonRow].forEach(el => el && (el.style.clipPath = "inset(0 100% 0 0)"));
    const _ch = (rm, gm, bm) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img,0,0,w,h); const d = x.getImageData(0,0,w,h); for (let i=0;i<d.data.length;i+=4){d.data[i]=(d.data[i]*rm)|0;d.data[i+1]=(d.data[i+1]*gm)|0;d.data[i+2]=(d.data[i+2]*bm)|0;} x.putImageData(d,0,0); return c; };
    const redCh = _ch(1,0,0), cyanCh = _ch(0,1,1);
    const isSearch = img.className.includes("--search");
    const maxW = isSearch ? _searchMaxWidth : _homeMaxWidth, maxH = isSearch ? _searchMaxHeight : _homeMaxHeight;
    const scale = Math.min(1,maxW/w,maxH/h), rendW = Math.round(w*scale), rendH = Math.round(h*scale), scaledPad = Math.round(PAD*scale);
    const canvas = document.createElement("canvas"); canvas.width = w+PAD*2; canvas.height = h+PAD*2;
    canvas.className = img.className; canvas.style.cssText = img.style.cssText;
    canvas.style.width = `${rendW+scaledPad*2}px`; canvas.style.height = `${rendH+scaledPad*2}px`;
    canvas.style.maxWidth = "none"; canvas.style.maxHeight = "none"; canvas.style.margin = `-${scaledPad}px`; canvas.style.display = "block";
    const parent = img.parentNode, next = img.nextSibling; if (!parent) return;
    parent.removeChild(img); parent.insertBefore(canvas, next);
    const ctx = canvas.getContext("2d");
    const R=(a,b)=>Math.random()*(b-a)+a, Ri=(a,b)=>Math.floor(R(a,b));
    const COLORS=["#00fff0","#ff003c","#ff00ff","#ffffff","#000000","#ffff00"];
    const CW=canvas.width, CH=canvas.height, duration=900, start=performance.now();
    await new Promise(resolve => {
      function frame(now) {
        const t=Math.min((now-start)/duration,1), intensity=Math.pow(1-t,1.4);
        ctx.clearRect(0,0,CW,CH); ctx.globalAlpha=t<0.08?0:Math.min(1,(t-0.08)/0.3); ctx.drawImage(img,PAD,PAD,w,h); ctx.globalAlpha=1;
        if (intensity>0.02) {
          for(let i=0,n=Ri(2,Math.ceil(intensity*7)+3);i<n;i++){const bh=R(h*.05,h*.35),sy=R(0,h-bh),dx=(Math.random()<.5?1:-1)*R(w*.04,w*.55)*intensity;ctx.drawImage(img,0,sy,w,bh,PAD+dx,PAD+sy,w,bh);}
          if(intensity>0.06){const sh=R(w*.025,w*.09)*intensity;ctx.globalCompositeOperation="screen";ctx.globalAlpha=Math.min(.95,intensity*.9);ctx.drawImage(redCh,PAD+sh,PAD,w,h);ctx.drawImage(cyanCh,PAD-sh*.65,PAD,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";}
          if(intensity>0.04){for(let i=0,n=Math.ceil(intensity*200);i<n;i++){const v=Ri(0,256);ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.globalAlpha=R(.25,.85);ctx.fillRect(Ri(0,CW),Ri(0,CH),Ri(1,Math.ceil(intensity*12)+1),Ri(1,Math.ceil(intensity*6)+1));}ctx.globalAlpha=1;}
          for(let i=0,n=Ri(0,Math.ceil(intensity*5)+1);i<n;i++){ctx.fillStyle=COLORS[Ri(0,COLORS.length)];ctx.globalAlpha=R(.5,1)*intensity;ctx.fillRect(R(0,w+PAD),R(0,h+PAD),R(w*.06,w*.55),R(2,h*.12));}ctx.globalAlpha=1;
          if(intensity>0.12&&Math.random()>.35){ctx.fillStyle="rgba(0,0,0,0.55)";for(let y=0,s=Ri(2,5);y<CH;y+=s*2)ctx.fillRect(0,y,CW,s);}
          if(intensity>0.6&&Math.random()>.88){ctx.fillStyle=Math.random()>.4?"rgba(255,255,255,0.85)":"rgba(0,0,0,0.95)";ctx.fillRect(PAD,PAD,w,h);}
        }
        if(t<1)requestAnimationFrame(frame);
        else{if(canvas.parentNode){canvas.parentNode.insertBefore(img,canvas);canvas.remove();}resolve();}
      }
      requestAnimationFrame(frame);
    });
    if (searchBar) {
      await _cyberReveal(searchBar,150); await _cyberReveal(buttonRow,120);
      _searchHideStyle.remove(); searchBar.style.clipPath=""; if(buttonRow)buttonRow.style.clipPath="";
    }
  }

  function _fadeReveal(el, duration) {
    if (!el) return Promise.resolve();
    return new Promise(resolve => {
      el.style.clipPath = "inset(0 0% 0 0)"; el.style.opacity = "0";
      const start = performance.now();
      function frame(now) {
        const t = Math.min((now-start)/duration,1); el.style.opacity = String(t);
        if (t<1) requestAnimationFrame(frame);
        else { el.style.opacity=""; el.style.clipPath="inset(0 0% 0 0)"; resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  function _cyberReveal(el, duration) {
    if (!el) return Promise.resolve();
    return new Promise(resolve => {
      const rect = el.getBoundingClientRect();
      const scanner = document.createElement("div");
      scanner.style.cssText = ["position:fixed",`top:${rect.top-4}px`,`left:${rect.left}px`,"width:3px",`height:${rect.height+8}px`,"background:linear-gradient(to bottom,transparent 0%,#00fff0 35%,#ffffff 50%,#00fff0 65%,transparent 100%)","box-shadow:0 0 14px 6px rgba(0,255,240,0.7)","pointer-events:none","z-index:9999"].join(";");
      document.body.appendChild(scanner);
      const start = performance.now();
      function frame(now) {
        const t=Math.min((now-start)/duration,1), eased=1-Math.pow(1-t,3);
        el.style.clipPath=`inset(0 ${((1-eased)*100).toFixed(1)}% 0 0)`;
        scanner.style.left=`${rect.left+eased*rect.width}px`;
        if(t<1) requestAnimationFrame(frame);
        else { el.style.clipPath="inset(0 0% 0 0)"; scanner.remove(); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  // ── Boot ────────────────────────────────────────────────────────────────────

  const obs = new MutationObserver(() => {
    init();
    document.querySelectorAll("#logotype-card:not([data-wired])").forEach(el => {
      el.dataset.wired = "1";
      wireResultUi(/** @type {HTMLElement} */ (el));
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  init();

})();
