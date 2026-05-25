(function () {
  const API = "/api/plugin/logotype/logo";

  // Immediately hide the OG logo to prevent flicker while the custom logo loads.
  const _hideStyle = document.createElement("style");
  _hideStyle.textContent = "#home-logo .logo, .results-logo { visibility: hidden !important; }";
  document.head.appendChild(_hideStyle);

  // Synchronously hide the search bar and buttons so they don't flash before the
  // matrix intro reveals them. Removed immediately if intro is not 'matrix'.
  const _searchHideStyle = document.createElement("style");
  _searchHideStyle.textContent = "#search-bar-home, .button-row { clip-path: inset(0 100% 0 0); }";
  document.head.appendChild(_searchHideStyle);

  /** @type {string|null|undefined} */
  let _cachedDataUrl = undefined;

  /** @type {boolean} */
  let hideLogoManagement = false;

  /** @type {string} */
  let _logoIntro = "none";

  /** @type {boolean} */
  let _introPlayed = false;

  /** @type {number} */
  let _searchMaxHeight = 100;
  /** @type {number} */
  let _searchMaxWidth = 300;
  /** @type {number} */
  let _homeMaxHeight = 300;
  /** @type {number} */
  let _homeMaxWidth = 500;

  /** @type {boolean} */
  let _dimensionsLoaded = false;

  /** @type {Promise<void>|null} */
  let _settingsPromise = null;

  /**
   * @returns {Promise<void>}
   */
  function loadSettings() {
    if (_settingsPromise) return _settingsPromise;
    _settingsPromise = fetch("/api/plugin/logotype/settings")
      .then((r) => r.json())
      .then((d) => {
        const val = d?.hideLogoManagement;
        hideLogoManagement = val === true || val === "true";
        const validIntros = ["none", "fade", "matrix"];
        _logoIntro = validIntros.includes(d?.logoIntro) ? d.logoIntro : "none";
      })
      .catch(() => {});
    return _settingsPromise;
  }

  /**
   * @returns {Promise<void>}
   */
  async function loadDimensions() {
    if (_dimensionsLoaded) return;
    try {
      const res = await fetch("/api/plugin/logotype/dimensions");
      if (!res.ok) return;
      const d = await res.json();
      const _p = (v, fb) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 ? n : fb; };
      _homeMaxHeight = _p(d.homeMaxHeight, 300);
      _homeMaxWidth = _p(d.homeMaxWidth, 500);
      _searchMaxHeight = _p(d.searchMaxHeight, 100);
      _searchMaxWidth = _p(d.searchMaxWidth, 300);
      _dimensionsLoaded = true;
    } catch {
      // Use defaults
    }
  }

  /**
   * @returns {Promise<string|null>}
   */
  async function fetchLogo() {
    if (_cachedDataUrl !== undefined) return _cachedDataUrl;
    try {
      const res = await fetch(API);
      if (!res.ok) { _cachedDataUrl = null; return null; }
      const data = await res.json();
      _cachedDataUrl = data.dataUrl ?? null;
      return _cachedDataUrl;
    } catch {
      _cachedDataUrl = null;
      return null;
    }
  }

  /**
   * Replaces logo elements on the page with the custom image.
   * @param {string} dataUrl
   * @param {string} [intro]
   */
  function applyLogo(dataUrl, intro) {
    document.querySelectorAll(".logotype-img").forEach((el) => {
      const img = /** @type {HTMLImageElement} */ (el);
      img.src = dataUrl;
    });

    /** @type {Array<{ el: Element|null, search: boolean }>} */
    const targets = [
      { el: document.querySelector("#home-logo .logo"), search: false },
      { el: document.querySelector(".results-logo"), search: true },
    ];

    /** @type {HTMLImageElement[]} */
    const newImgs = [];

    for (const { el, search } of targets) {
      if (!el || el.dataset.logotypeApplied) continue;
      el.dataset.logotypeApplied = "1";
      const img = document.createElement("img");
      img.src = dataUrl;
      img.alt = "Logo";
      img.className = search ? "logotype-img logotype-img--search" : "logotype-img";
      if (search) {
        img.style.maxHeight = `${_searchMaxHeight}px`;
        img.style.maxWidth = `${_searchMaxWidth}px`;
      } else {
        img.style.maxHeight = `${_homeMaxHeight}px`;
        img.style.maxWidth = `${_homeMaxWidth}px`;
      }
      if (el.tagName === "A") {
        el.replaceChildren(img);
      } else {
        el.replaceWith(img);
      }
      newImgs.push(img);
    }

    if (!_introPlayed && intro && intro !== "none" && newImgs.length > 0) {
      _introPlayed = true;
      newImgs.forEach((img) => _runIntro(img, intro));
    }
  }

  /**
   * @param {HTMLImageElement} img
   * @param {string} type
   */
  function _runIntro(img, type) {
    if (type === "fade")   _fadeIn(img);
    else if (type === "matrix") _matrixIn(img);
  }

  /**
   * @param {HTMLImageElement} img
   */
  async function _fadeIn(img) {
    const searchBar = /** @type {HTMLElement|null} */ (document.querySelector("#search-bar-home"));
    const buttonRow = /** @type {HTMLElement|null} */ (document.querySelector(".button-row"));
    const isHome = !!searchBar;

    await new Promise((resolve) => {
      const duration = 650;
      const start = performance.now();
      img.style.opacity = "0";
      /** @param {number} now */
      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        img.style.opacity = String(t);
        if (t < 1) requestAnimationFrame(frame);
        else { img.style.opacity = ""; resolve(); }
      }
      requestAnimationFrame(frame);
    });

    if (isHome) {
      await _fadeReveal(searchBar, 350);
      await _fadeReveal(buttonRow, 280);
      _searchHideStyle.remove();
      if (searchBar) searchBar.style.clipPath = "";
      if (buttonRow) buttonRow.style.clipPath = "";
    }
  }

  /**
   * @param {HTMLImageElement} img
   */
  async function _matrixIn(img) {
    try { await img.decode(); } catch { return; }
    const w = img.naturalWidth || 400;
    const h = img.naturalHeight || 200;
    const PAD = 100;

    const searchBar = /** @type {HTMLElement|null} */ (document.querySelector("#search-bar-home"));
    const buttonRow = /** @type {HTMLElement|null} */ (document.querySelector(".button-row"));
    const isHome = !!searchBar;
    if (isHome) {
      [searchBar, buttonRow].forEach((el) => {
        if (!el) return;
        el.style.clipPath = "inset(0 100% 0 0)";
      });
    }

    const _makeChannel = (rMul, gMul, bMul) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const x = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
      x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i]   = (d.data[i]   * rMul) | 0;
        d.data[i+1] = (d.data[i+1] * gMul) | 0;
        d.data[i+2] = (d.data[i+2] * bMul) | 0;
      }
      x.putImageData(d, 0, 0);
      return c;
    };

    const redCh  = _makeChannel(1, 0, 0);
    const cyanCh = _makeChannel(0, 1, 1);

    const isSearch = img.className.includes("--search");
    const maxW = isSearch ? _searchMaxWidth  : _homeMaxWidth;
    const maxH = isSearch ? _searchMaxHeight : _homeMaxHeight;
    const scale     = Math.min(1, maxW / w, maxH / h);
    const rendW     = Math.round(w * scale);
    const rendH     = Math.round(h * scale);
    const scaledPad = Math.round(PAD * scale);

    const CW = w + PAD * 2;
    const CH = h + PAD * 2;

    const canvas = document.createElement("canvas");
    canvas.width  = CW;
    canvas.height = CH;
    canvas.className = img.className;
    canvas.style.cssText  = img.style.cssText;
    canvas.style.width    = `${rendW + scaledPad * 2}px`;
    canvas.style.height   = `${rendH + scaledPad * 2}px`;
    canvas.style.maxWidth  = "none";
    canvas.style.maxHeight = "none";
    canvas.style.margin    = `-${scaledPad}px`;
    canvas.style.display   = "block";

    const parent = img.parentNode;
    const next   = img.nextSibling;
    if (!parent) return;
    parent.removeChild(img);
    parent.insertBefore(canvas, next);

    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    const R  = (/** @type {number} */ a, /** @type {number} */ b) => Math.random() * (b - a) + a;
    const Ri = (/** @type {number} */ a, /** @type {number} */ b) => Math.floor(R(a, b));
    const CORRUPT_COLORS = ["#00fff0", "#ff003c", "#ff00ff", "#ffffff", "#000000", "#ffff00"];
    const duration = 900;
    const start = performance.now();

    await new Promise((resolve) => {
      /** @param {number} now */
      function frame(now) {
      const t         = Math.min((now - start) / duration, 1);
      const intensity = Math.pow(1 - t, 1.4);

      ctx.clearRect(0, 0, CW, CH);

      ctx.globalAlpha = t < 0.08 ? 0 : Math.min(1, (t - 0.08) / 0.3);
      ctx.drawImage(img, PAD, PAD, w, h);
      ctx.globalAlpha = 1;

      if (intensity > 0.02) {
        const numSlices = Ri(2, Math.ceil(intensity * 7) + 3);
        for (let i = 0; i < numSlices; i++) {
          const bh = R(h * 0.05, h * 0.35);
          const sy = R(0, h - bh);
          const dx = (Math.random() < 0.5 ? 1 : -1) * R(w * 0.04, w * 0.55) * intensity;
          ctx.drawImage(img, 0, sy, w, bh, PAD + dx, PAD + sy, w, bh);
        }

        if (intensity > 0.06) {
          const shift = R(w * 0.025, w * 0.09) * intensity;
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = Math.min(0.95, intensity * 0.9);
          ctx.drawImage(redCh,  PAD + shift,          PAD, w, h);
          ctx.drawImage(cyanCh, PAD - shift * 0.65,   PAD, w, h);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }

        if (intensity > 0.04) {
          const noiseCount = Math.ceil(intensity * 200);
          for (let i = 0; i < noiseCount; i++) {
            const v = Ri(0, 256);
            ctx.fillStyle   = `rgb(${v},${v},${v})`;
            ctx.globalAlpha = R(0.25, 0.85);
            ctx.fillRect(Ri(0, CW), Ri(0, CH), Ri(1, Math.ceil(intensity * 12) + 1), Ri(1, Math.ceil(intensity * 6) + 1));
          }
          ctx.globalAlpha = 1;
        }

        const numCorrupt = Ri(0, Math.ceil(intensity * 5) + 1);
        for (let i = 0; i < numCorrupt; i++) {
          ctx.fillStyle   = CORRUPT_COLORS[Ri(0, CORRUPT_COLORS.length)];
          ctx.globalAlpha = R(0.5, 1.0) * intensity;
          ctx.fillRect(R(0, w + PAD), R(0, h + PAD), R(w * 0.06, w * 0.55), R(2, h * 0.12));
        }
        ctx.globalAlpha = 1;

        if (intensity > 0.12 && Math.random() > 0.35) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          const step = Ri(2, 5);
          for (let y = 0; y < CH; y += step * 2) {
            ctx.fillRect(0, y, CW, step);
          }
        }

        if (intensity > 0.6 && Math.random() > 0.88) {
          ctx.fillStyle = Math.random() > 0.4 ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.95)";
          ctx.fillRect(PAD, PAD, w, h);
        }
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        if (canvas.parentNode) {
          canvas.parentNode.insertBefore(img, canvas);
          canvas.remove();
        }
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });

    if (isHome) {
      await _cyberReveal(searchBar, 150);
      await _cyberReveal(buttonRow, 120);
      _searchHideStyle.remove();
      if (searchBar) searchBar.style.clipPath = "";
      if (buttonRow) buttonRow.style.clipPath = "";
    }
  }

  /**
   * @param {HTMLElement|null} el
   * @param {number} duration
   * @returns {Promise<void>}
   */
  function _fadeReveal(el, duration) {
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
      el.style.clipPath = "inset(0 0% 0 0)";
      el.style.opacity  = "0";
      const start = performance.now();
      /** @param {number} now */
      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        el.style.opacity = String(t);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          el.style.opacity  = "";
          el.style.clipPath = "inset(0 0% 0 0)";
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /**
   * @param {HTMLElement|null} el
   * @param {number} duration
   * @returns {Promise<void>}
   */
  function _cyberReveal(el, duration) {
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
      const rect = el.getBoundingClientRect();

      const scanner = document.createElement("div");
      scanner.style.cssText = [
        "position:fixed",
        `top:${rect.top - 4}px`,
        `left:${rect.left}px`,
        `width:3px`,
        `height:${rect.height + 8}px`,
        "background:linear-gradient(to bottom,transparent 0%,#00fff0 35%,#ffffff 50%,#00fff0 65%,transparent 100%)",
        "box-shadow:0 0 14px 6px rgba(0,255,240,0.7)",
        "pointer-events:none",
        "z-index:9999",
      ].join(";");
      document.body.appendChild(scanner);

      const start = performance.now();
      /** @param {number} now */
      function frame(now) {
        const t     = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.style.clipPath      = `inset(0 ${((1 - eased) * 100).toFixed(1)}% 0 0)`;
        scanner.style.left     = `${rect.left + eased * rect.width}px`;

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          el.style.clipPath = "inset(0 0% 0 0)";
          scanner.remove();
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  async function init() {
    await Promise.all([loadDimensions(), loadSettings()]);
    const dataUrl = await fetchLogo();
    if (dataUrl) applyLogo(dataUrl, _logoIntro);
    if (!dataUrl || !_logoIntro.match(/^(matrix|fade)$/)) _searchHideStyle.remove();
    _hideStyle.remove();
  }

  /**
   * @param {HTMLElement} root
   * @param {string|null} dataUrl
   */
  function _updateCardPreview(root, dataUrl) {
    const PREVIEW_STYLE = "max-height:80px;max-width:220px;object-fit:contain;display:block;border-radius:6px;border:1px solid rgba(255,255,255,0.1);padding:4px 8px;background:rgba(0,0,0,0.2);";
    const existing = /** @type {HTMLImageElement|null} */ (root.querySelector("#logotype-preview"));
    const noLogo = root.querySelector("#logotype-nologo");
    const homePreviewImg = /** @type {HTMLImageElement|null} */ (root.querySelector("#logotype-home-preview-img"));

    if (dataUrl) {
      if (existing) {
        existing.src = dataUrl;
      } else {
        const img = document.createElement("img");
        img.id = "logotype-preview";
        img.src = dataUrl;
        img.alt = "Current logo";
        img.style.cssText = PREVIEW_STYLE;
        if (noLogo) noLogo.replaceWith(img);
      }
      if (homePreviewImg) {
        homePreviewImg.src = dataUrl;
        homePreviewImg.style.display = "";
      }
    } else {
      if (existing) {
        const p = document.createElement("p");
        p.id = "logotype-nologo";
        p.style.cssText = "font-size:0.82rem;color:var(--text-secondary);font-style:italic;margin:0;";
        p.textContent = "No custom logo set.";
        existing.replaceWith(p);
      }
      if (homePreviewImg) homePreviewImg.style.display = "none";
    }
  }

  /**
   * @param {HTMLElement} root
   */
  function wireResultUi(root) {
    const fileInput = /** @type {HTMLInputElement|null} */ (root.querySelector("#logotype-file"));
    if (!fileInput) return;

    const removeBtn = root.querySelector("#logotype-remove");
    const status = root.querySelector("#logotype-status");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (status) status.textContent = "Image too large (max 2 MB).";
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = /** @type {string} */ (reader.result);
        try {
          const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          });
          const json = await res.json();
          if (!res.ok) {
            if (status) status.textContent = json.error ?? "Upload failed.";
            return;
          }
          _cachedDataUrl = dataUrl;
          if (status) status.textContent = "Logo saved!";
          applyLogo(dataUrl);
          _updateCardPreview(root, dataUrl);
        } catch {
          if (status) status.textContent = "Upload failed.";
        }
      };
      reader.readAsDataURL(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        try {
          const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: null }),
          });
          if (!res.ok) { if (status) status.textContent = "Remove failed."; return; }
          _cachedDataUrl = null;
          if (status) status.textContent = "Logo removed.";
          _updateCardPreview(root, null);
        } catch {
          if (status) status.textContent = "Remove failed.";
        }
      });
    }

    const homeHSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-h"));
    const homeWSlider   = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-home-w"));
    const searchHSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-h"));
    const searchWSlider = /** @type {HTMLInputElement|null} */ (root.querySelector("#lt-search-w"));
    const saveDimsBtn   = root.querySelector("#logotype-save-dims");
    const homePreviewImg = /** @type {HTMLImageElement|null} */ (root.querySelector("#logotype-home-preview-img"));

    const _wireSliderLabel = (slider, valId) => {
      if (!slider) return;
      const label = root.querySelector(`#${valId}`);
      slider.addEventListener("input", () => {
        if (label) label.textContent = slider.value + "px";
      });
    };
    _wireSliderLabel(homeHSlider,   "lt-home-h-val");
    _wireSliderLabel(homeWSlider,   "lt-home-w-val");
    _wireSliderLabel(searchHSlider, "lt-search-h-val");
    _wireSliderLabel(searchWSlider, "lt-search-w-val");

    if (homeHSlider && homePreviewImg) {
      homeHSlider.addEventListener("input", () => { homePreviewImg.style.maxHeight = homeHSlider.value + "px"; });
    }
    if (homeWSlider && homePreviewImg) {
      homeWSlider.addEventListener("input", () => { homePreviewImg.style.maxWidth = homeWSlider.value + "px"; });
    }
    if (searchHSlider) {
      searchHSlider.addEventListener("input", () => {
        document.querySelectorAll(".logotype-img--search").forEach((el) => {
          /** @type {HTMLImageElement} */ (el).style.maxHeight = searchHSlider.value + "px";
        });
      });
    }
    if (searchWSlider) {
      searchWSlider.addEventListener("input", () => {
        document.querySelectorAll(".logotype-img--search").forEach((el) => {
          /** @type {HTMLImageElement} */ (el).style.maxWidth = searchWSlider.value + "px";
        });
      });
    }

    if (saveDimsBtn) {
      saveDimsBtn.addEventListener("click", async () => {
        const dims = {
          homeMaxHeight: parseInt(homeHSlider?.value ?? "300", 10),
          homeMaxWidth: parseInt(homeWSlider?.value ?? "500", 10),
          searchMaxHeight: parseInt(searchHSlider?.value ?? "100", 10),
          searchMaxWidth: parseInt(searchWSlider?.value ?? "300", 10),
        };
        try {
          const res = await fetch("/api/plugin/logotype/dimensions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dims),
          });
          if (!res.ok) { if (status) status.textContent = "Save failed."; return; }
          _homeMaxHeight = dims.homeMaxHeight;
          _homeMaxWidth = dims.homeMaxWidth;
          _searchMaxHeight = dims.searchMaxHeight;
          _searchMaxWidth = dims.searchMaxWidth;
          _dimensionsLoaded = true;
          document.querySelectorAll(".logotype-img--search").forEach((el) => {
            /** @type {HTMLImageElement} */ (el).style.maxHeight = `${_searchMaxHeight}px`;
            /** @type {HTMLImageElement} */ (el).style.maxWidth = `${_searchMaxWidth}px`;
          });
          document.querySelectorAll(".logotype-img:not(.logotype-img--search)").forEach((el) => {
            /** @type {HTMLImageElement} */ (el).style.maxHeight = `${_homeMaxHeight}px`;
            /** @type {HTMLImageElement} */ (el).style.maxWidth = `${_homeMaxWidth}px`;
          });
          if (status) status.textContent = "Dimensions saved!";
        } catch {
          if (status) status.textContent = "Save failed.";
        }
      });
    }
  }

  const obs = new MutationObserver(() => {
    init();
    document.querySelectorAll("#logotype-card:not([data-wired])").forEach((el) => {
      const root = /** @type {HTMLElement} */ (el);
      root.dataset.wired = "1";
      wireResultUi(root);
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });

  init();
})();
