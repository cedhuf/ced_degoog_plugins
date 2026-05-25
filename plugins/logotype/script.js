(function () {

  // ── Font definitions (must match index.js) ──────────────────────────────────

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

  function _loadAllPreviewFonts() {
    _loadGoogleFonts(FONTS.map(f => f.gfQuery));
  }

  function _loadFont(fontId) {
    const f = FONT_MAP[fontId] || FONTS[0];
    _loadGoogleFonts([f.gfQuery]);
  }

  // ── Page-logo state ─────────────────────────────────────────────────────────

  // Hide OG logo immediately to prevent flicker.
  const _hideStyle = document.createElement("style");
  _hideStyle.textContent = "#home-logo .logo, .results-logo { visibility: hidden !important; }";
  document.head.appendChild(_hideStyle);

  const _searchHideStyle = document.createElement("style");
  _searchHideStyle.textContent = "#search-bar-home, .button-row { clip-path: inset(0 100% 0 0); }";
  document.head.appendChild(_searchHideStyle);

  /** @type {string|null|undefined} */
  let _cachedDataUrl = undefined;
  /** @type {object|null|undefined} */
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
      .then(d => {
        _logoIntro = ["none", "fade", "matrix"].includes(d?.logoIntro) ? d.logoIntro : "none";
      })
      .catch(() => {});
    return _settingsPromise;
  }

  async function loadDimensions() {
    if (_dimensionsLoaded) return;
    try {
      const res = await fetch("/api/plugin/logotype/dimensions");
      if (!res.ok) return;
      const d = await res.json();
      const _p = (v, fb) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 ? n : fb; };
      _homeMaxHeight   = _p(d.homeMaxHeight,   300);
      _homeMaxWidth    = _p(d.homeMaxWidth,    500);
      _searchMaxHeight = _p(d.searchMaxHeight, 100);
      _searchMaxWidth  = _p(d.searchMaxWidth,  300);
      _dimensionsLoaded = true;
    } catch {}
  }

  async function fetchLogo() {
    if (_cachedDataUrl !== undefined) return _cachedDataUrl;
    try {
      const res = await fetch("/api/plugin/logotype/logo");
      if (!res.ok) { _cachedDataUrl = null; return null; }
      _cachedDataUrl = (await res.json()).dataUrl ?? null;
      return _cachedDataUrl;
    } catch {
      _cachedDataUrl = null;
      return null;
    }
  }

  async function fetchWordmark() {
    if (_cachedWordmark !== undefined) return _cachedWordmark;
    try {
      const res = await fetch("/api/plugin/logotype/wordmark");
      if (!res.ok) { _cachedWordmark = null; return null; }
      const d = await res.json();
      _cachedWordmark = d.text ? d : null;
      return _cachedWordmark;
    } catch {
      _cachedWordmark = null;
      return null;
    }
  }

  // ── Apply wordmark to page ──────────────────────────────────────────────────

  function applyWordmark(config) {
    const fontDef = FONT_MAP[config.font] || FONTS[0];
    _loadFont(config.font);

    const targets = [
      { sel: "#home-logo .logo",  search: false },
      { sel: ".results-logo",     search: true  },
    ];

    for (const { sel, search } of targets) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.logotypeApplied) continue;
      el.dataset.logotypeApplied = "1";

      const span = document.createElement("span");
      span.className   = search ? "logotype-wordmark logotype-wordmark--search" : "logotype-wordmark";
      span.textContent = config.text;
      span.style.fontFamily = `"${fontDef.family}", sans-serif`;
      span.style.fontWeight = fontDef.weight;

      if (el.tagName === "A") {
        el.replaceChildren(span);
      } else {
        el.replaceWith(span);
      }
    }
  }

  // ── Apply image logo to page ────────────────────────────────────────────────

  function applyLogo(dataUrl, intro) {
    document.querySelectorAll(".logotype-img").forEach(el => { el.src = dataUrl; });

    const targets = [
      { sel: "#home-logo .logo", search: false },
      { sel: ".results-logo",    search: true  },
    ];
    const newImgs = [];

    for (const { sel, search } of targets) {
      const el = document.querySelector(sel);
      if (!el || el.dataset.logotypeApplied) continue;
      el.dataset.logotypeApplied = "1";

      const img = document.createElement("img");
      img.src       = dataUrl;
      img.alt       = "Logo";
      img.className = search ? "logotype-img logotype-img--search" : "logotype-img";
      img.style.maxHeight = `${search ? _searchMaxHeight : _homeMaxHeight}px`;
      img.style.maxWidth  = `${search ? _searchMaxWidth  : _homeMaxWidth}px`;

      if (el.tagName === "A") {
        el.replaceChildren(img);
      } else {
        el.replaceWith(img);
      }
      newImgs.push(img);
    }

    if (!_introPlayed && intro && intro !== "none" && newImgs.length) {
      _introPlayed = true;
      newImgs.forEach(img => _runIntro(img, intro));
    }
  }

  // ── Init (runs on every navigation) ────────────────────────────────────────

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

  // ── !logo card UI wiring ────────────────────────────────────────────────────

  function _setStatus(root, msg, ok) {
    const el = root.querySelector("#logotype-status");
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? "var(--success, #a6e3a1)" : "var(--text-secondary, #888)";
  }

  function _updatePreview(root, text, fontId) {
    const el = root.querySelector("#lt-preview-el");
    if (!el) return;
    const fontDef = FONT_MAP[fontId] || FONTS[0];
    if (el.tagName === "SPAN") {
      el.textContent       = text || "Your brand";
      el.style.fontFamily  = `"${fontDef.family}", sans-serif`;
      el.style.fontWeight  = fontDef.weight;
      el.classList.toggle("lt-wm-preview-empty", !text);
    }
    // Store active font on the card for wiring convenience
    root.dataset.wmFont = fontId;
  }

  function _switchPreviewToText(root, text, fontId) {
    const area = root.querySelector(".lt-preview-logo-area");
    if (!area) return;
    let el = root.querySelector("#lt-preview-el");
    if (el && el.tagName !== "SPAN") {
      const span = document.createElement("span");
      span.id = "lt-preview-el";
      span.className = "lt-wm-preview-text lt-wm-preview-empty";
      el.replaceWith(span);
      el = span;
    }
    _updatePreview(root, text, fontId);
  }

  function _switchPreviewToImage(root, dataUrl) {
    const area = root.querySelector(".lt-preview-logo-area");
    if (!area) return;
    let el = root.querySelector("#lt-preview-el");
    if (dataUrl) {
      if (!el || el.tagName !== "IMG") {
        const img = document.createElement("img");
        img.id = "lt-preview-el";
        img.alt = "Logo";
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

  function wireResultUi(root) {
    // Load all preview fonts as soon as the card opens
    _loadAllPreviewFonts();

    const card     = /** @type {HTMLElement} */ (root);
    let activeTab  = card.dataset.defaultTab || "text";
    let activeFont = card.dataset.wmFont || "outfit";

    // ── Tab switching ──────────────────────────────────────────────────────────
    root.querySelectorAll(".lt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab === activeTab) return;
        activeTab = tab;

        root.querySelectorAll(".lt-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        root.querySelectorAll(".lt-panel").forEach(p => { p.style.display = "none"; });
        const panel = root.querySelector(`#lt-panel-${tab}`);
        if (panel) panel.style.display = "";

        // Sync preview
        if (tab === "text") {
          const textInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-wm-text"));
          _switchPreviewToText(root, textInput?.value || "", activeFont);
        } else {
          _switchPreviewToImage(root, _cachedDataUrl || null);
        }
      });
    });

    // ── Text panel ─────────────────────────────────────────────────────────────
    const textInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-wm-text"));
    const saveWmBtn = root.querySelector("#lt-wm-save");

    if (textInput) {
      // Live preview on input
      textInput.addEventListener("input", () => {
        if (activeTab === "text") _updatePreview(root, textInput.value, activeFont);
      });
    }

    // Font chip selection
    root.querySelectorAll(".lt-font-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        activeFont = chip.dataset.font;
        root.querySelectorAll(".lt-font-chip").forEach(c => c.classList.toggle("active", c === chip));
        if (activeTab === "text" && textInput) _updatePreview(root, textInput.value, activeFont);
      });
    });

    if (saveWmBtn && textInput) {
      saveWmBtn.addEventListener("click", async () => {
        const text = textInput.value.trim();
        if (!text) { _setStatus(root, "Enter a brand name first.", false); return; }
        try {
          const res = await fetch("/api/plugin/logotype/wordmark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, font: activeFont }),
          });
          const json = await res.json();
          if (!res.ok) { _setStatus(root, json.error ?? "Save failed.", false); return; }
          _cachedWordmark = { text, font: activeFont };
          _setStatus(root, "Saved! Reloading…", true);
          setTimeout(() => location.reload(), 800);
        } catch {
          _setStatus(root, "Save failed.", false);
        }
      });
    }

    // ── Image panel ────────────────────────────────────────────────────────────
    const fileInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#logotype-file"));
    const removeBtn = root.querySelector("#logotype-remove");

    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { _setStatus(root, "Image too large (max 2 MB).", false); return; }
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = /** @type {string} */ (reader.result);
          try {
            const res = await fetch("/api/plugin/logotype/logo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataUrl }),
            });
            const json = await res.json();
            if (!res.ok) { _setStatus(root, json.error ?? "Upload failed.", false); return; }
            _cachedDataUrl = dataUrl;
            _switchPreviewToImage(root, dataUrl);
            _updateImgThumb(root, dataUrl);
            _setStatus(root, "Saved! Reloading…", true);
            setTimeout(() => location.reload(), 800);
          } catch {
            _setStatus(root, "Upload failed.", false);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        try {
          const res = await fetch("/api/plugin/logotype/logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: null }),
          });
          if (!res.ok) { _setStatus(root, "Remove failed.", false); return; }
          _cachedDataUrl = null;
          _updateImgThumb(root, null);
          if (activeTab === "image") _switchPreviewToImage(root, null);
          _setStatus(root, "Image removed.", true);
        } catch {
          _setStatus(root, "Remove failed.", false);
        }
      });
    }

    // ── Dimension sliders ──────────────────────────────────────────────────────
    const homeHSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-h"));
    const homeWSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-w"));
    const searchHSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-h"));
    const searchWSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-w"));
    const saveDimsBtn   = root.querySelector("#logotype-save-dims");

    const _wireSlider = (slider, valId) => {
      if (!slider) return;
      const label = root.querySelector(`#${valId}`);
      slider.addEventListener("input", () => { if (label) label.textContent = `${slider.value}px`; });
    };
    _wireSlider(homeHSlider,   "lt-home-h-val");
    _wireSlider(homeWSlider,   "lt-home-w-val");
    _wireSlider(searchHSlider, "lt-search-h-val");
    _wireSlider(searchWSlider, "lt-search-w-val");

    if (saveDimsBtn) {
      saveDimsBtn.addEventListener("click", async () => {
        const dims = {
          homeMaxHeight:   parseInt(homeHSlider?.value   ?? "300", 10),
          homeMaxWidth:    parseInt(homeWSlider?.value   ?? "500", 10),
          searchMaxHeight: parseInt(searchHSlider?.value ?? "100", 10),
          searchMaxWidth:  parseInt(searchWSlider?.value ?? "300", 10),
        };
        try {
          const res = await fetch("/api/plugin/logotype/dimensions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dims),
          });
          if (!res.ok) { _setStatus(root, "Save failed.", false); return; }
          _homeMaxHeight   = dims.homeMaxHeight;
          _homeMaxWidth    = dims.homeMaxWidth;
          _searchMaxHeight = dims.searchMaxHeight;
          _searchMaxWidth  = dims.searchMaxWidth;
          _dimensionsLoaded = true;
          document.querySelectorAll(".logotype-img--search").forEach(el => {
            el.style.maxHeight = `${_searchMaxHeight}px`;
            el.style.maxWidth  = `${_searchMaxWidth}px`;
          });
          document.querySelectorAll(".logotype-img:not(.logotype-img--search)").forEach(el => {
            el.style.maxHeight = `${_homeMaxHeight}px`;
            el.style.maxWidth  = `${_homeMaxWidth}px`;
          });
          _setStatus(root, "Dimensions saved!", true);
        } catch {
          _setStatus(root, "Save failed.", false);
        }
      });
    }

    // ── Reset all ──────────────────────────────────────────────────────────────
    const resetBtn = root.querySelector("#lt-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        try {
          const res = await fetch("/api/plugin/logotype/reset", { method: "POST" });
          if (!res.ok) { _setStatus(root, "Reset failed.", false); return; }
          _cachedDataUrl  = null;
          _cachedWordmark = null;
          _setStatus(root, "Reset. Reloading…", true);
          setTimeout(() => location.reload(), 600);
        } catch {
          _setStatus(root, "Reset failed.", false);
        }
      });
    }
  }

  // ── Helpers for in-card preview updates ────────────────────────────────────

  function _updateImgThumb(root, dataUrl) {
    const existing = root.querySelector("#logotype-preview");
    const noLogo   = root.querySelector("#logotype-nologo");
    if (dataUrl) {
      if (existing) {
        existing.src = dataUrl;
      } else if (noLogo) {
        const img = document.createElement("img");
        img.id = "logotype-preview";
        img.alt = "Current logo";
        img.className = "lt-img-thumb";
        img.src = dataUrl;
        noLogo.replaceWith(img);
      }
    } else {
      if (existing) {
        const p = document.createElement("p");
        p.id = "logotype-nologo";
        p.className = "lt-img-none";
        p.textContent = "No image set.";
        existing.replaceWith(p);
      }
    }
  }

  // ── Intro animations (image mode only) ─────────────────────────────────────

  function _runIntro(img, type) {
    if (type === "fade")   _fadeIn(img);
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
      await _fadeReveal(searchBar, 350);
      await _fadeReveal(buttonRow, 280);
      _searchHideStyle.remove();
      searchBar.style.clipPath = "";
      if (buttonRow) buttonRow.style.clipPath = "";
    }
  }

  async function _matrixIn(img) {
    try { await img.decode(); } catch { return; }
    const w = img.naturalWidth || 400, h = img.naturalHeight || 200, PAD = 100;
    const searchBar = document.querySelector("#search-bar-home");
    const buttonRow = document.querySelector(".button-row");
    if (searchBar) [searchBar, buttonRow].forEach(el => el && (el.style.clipPath = "inset(0 100% 0 0)"));

    const _ch = (rm, gm, bm) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) { d.data[i] = (d.data[i]*rm)|0; d.data[i+1] = (d.data[i+1]*gm)|0; d.data[i+2] = (d.data[i+2]*bm)|0; }
      x.putImageData(d, 0, 0); return c;
    };
    const redCh = _ch(1,0,0), cyanCh = _ch(0,1,1);
    const isSearch = img.className.includes("--search");
    const maxW = isSearch ? _searchMaxWidth : _homeMaxWidth, maxH = isSearch ? _searchMaxHeight : _homeMaxHeight;
    const scale = Math.min(1, maxW/w, maxH/h);
    const rendW = Math.round(w*scale), rendH = Math.round(h*scale), scaledPad = Math.round(PAD*scale);
    const canvas = document.createElement("canvas");
    canvas.width = w + PAD*2; canvas.height = h + PAD*2; canvas.className = img.className;
    canvas.style.cssText = img.style.cssText;
    canvas.style.width = `${rendW + scaledPad*2}px`; canvas.style.height = `${rendH + scaledPad*2}px`;
    canvas.style.maxWidth = "none"; canvas.style.maxHeight = "none"; canvas.style.margin = `-${scaledPad}px`; canvas.style.display = "block";
    const parent = img.parentNode, next = img.nextSibling;
    if (!parent) return;
    parent.removeChild(img); parent.insertBefore(canvas, next);
    const ctx = canvas.getContext("2d");
    const R = (a,b) => Math.random()*(b-a)+a, Ri = (a,b) => Math.floor(R(a,b));
    const COLORS = ["#00fff0","#ff003c","#ff00ff","#ffffff","#000000","#ffff00"];
    const CW = canvas.width, CH = canvas.height, duration = 900, start = performance.now();
    await new Promise(resolve => {
      function frame(now) {
        const t = Math.min((now-start)/duration,1), intensity = Math.pow(1-t,1.4);
        ctx.clearRect(0,0,CW,CH);
        ctx.globalAlpha = t < 0.08 ? 0 : Math.min(1,(t-0.08)/0.3); ctx.drawImage(img,PAD,PAD,w,h); ctx.globalAlpha = 1;
        if (intensity > 0.02) {
          for (let i = 0, n = Ri(2, Math.ceil(intensity*7)+3); i < n; i++) { const bh=R(h*.05,h*.35),sy=R(0,h-bh),dx=(Math.random()<.5?1:-1)*R(w*.04,w*.55)*intensity; ctx.drawImage(img,0,sy,w,bh,PAD+dx,PAD+sy,w,bh); }
          if (intensity > 0.06) { const sh=R(w*.025,w*.09)*intensity; ctx.globalCompositeOperation="screen"; ctx.globalAlpha=Math.min(.95,intensity*.9); ctx.drawImage(redCh,PAD+sh,PAD,w,h); ctx.drawImage(cyanCh,PAD-sh*.65,PAD,w,h); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over"; }
          if (intensity > 0.04) { for (let i=0,n=Math.ceil(intensity*200);i<n;i++) { const v=Ri(0,256); ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.globalAlpha=R(.25,.85); ctx.fillRect(Ri(0,CW),Ri(0,CH),Ri(1,Math.ceil(intensity*12)+1),Ri(1,Math.ceil(intensity*6)+1)); } ctx.globalAlpha=1; }
          for (let i=0,n=Ri(0,Math.ceil(intensity*5)+1);i<n;i++) { ctx.fillStyle=COLORS[Ri(0,COLORS.length)]; ctx.globalAlpha=R(.5,1)*intensity; ctx.fillRect(R(0,w+PAD),R(0,h+PAD),R(w*.06,w*.55),R(2,h*.12)); } ctx.globalAlpha=1;
          if (intensity > 0.12 && Math.random()>.35) { ctx.fillStyle="rgba(0,0,0,0.55)"; for (let y=0,s=Ri(2,5);y<CH;y+=s*2) ctx.fillRect(0,y,CW,s); }
          if (intensity > 0.6 && Math.random()>.88) { ctx.fillStyle=Math.random()>.4?"rgba(255,255,255,0.85)":"rgba(0,0,0,0.95)"; ctx.fillRect(PAD,PAD,w,h); }
        }
        if (t < 1) requestAnimationFrame(frame);
        else { if (canvas.parentNode) { canvas.parentNode.insertBefore(img,canvas); canvas.remove(); } resolve(); }
      }
      requestAnimationFrame(frame);
    });
    if (searchBar) {
      await _cyberReveal(searchBar, 150); await _cyberReveal(buttonRow, 120);
      _searchHideStyle.remove(); searchBar.style.clipPath = ""; if (buttonRow) buttonRow.style.clipPath = "";
    }
  }

  function _fadeReveal(el, duration) {
    if (!el) return Promise.resolve();
    return new Promise(resolve => {
      el.style.clipPath = "inset(0 0% 0 0)"; el.style.opacity = "0";
      const start = performance.now();
      function frame(now) {
        const t = Math.min((now-start)/duration,1); el.style.opacity = String(t);
        if (t < 1) requestAnimationFrame(frame);
        else { el.style.opacity = ""; el.style.clipPath = "inset(0 0% 0 0)"; resolve(); }
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
        const t = Math.min((now-start)/duration,1), eased = 1-Math.pow(1-t,3);
        el.style.clipPath = `inset(0 ${((1-eased)*100).toFixed(1)}% 0 0)`;
        scanner.style.left = `${rect.left + eased*rect.width}px`;
        if (t < 1) requestAnimationFrame(frame);
        else { el.style.clipPath = "inset(0 0% 0 0)"; scanner.remove(); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  // ── MutationObserver + boot ─────────────────────────────────────────────────

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
