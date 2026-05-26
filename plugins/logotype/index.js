import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const DATA_DIR  = join(process.cwd(), "data", "logotype");
const LOGO_PATH = join(DATA_DIR, "logo.dat");
const DIMS_PATH = join(DATA_DIR, "dimensions.json");
const WM_PATH   = join(DATA_DIR, "wordmark.json");

const DEFAULT_DIMS = { homeMaxHeight: 300, homeMaxWidth: 500, searchMaxHeight: 100, searchMaxWidth: 300 };

const FONTS = [
  { id: "outfit",        name: "Outfit",        family: "Outfit",           weight: "700" },
  { id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk",    weight: "700" },
  { id: "bebas-neue",    name: "Bebas Neue",    family: "Bebas Neue",       weight: "400" },
  { id: "playfair",      name: "Playfair",      family: "Playfair Display", weight: "700" },
  { id: "raleway",       name: "Raleway",       family: "Raleway",          weight: "300" },
  { id: "josefin",       name: "Josefin",       family: "Josefin Sans",     weight: "700" },
];
const FONT_IDS = new Set(FONTS.map(f => f.id));

const SOLID_PRESETS = ["#e06c75","#e5c07b","#98c379","#56b6c2","#61afef","#c678dd","#ffffff"];
const GRADIENT_PRESETS = [
  { name: "Aurora", from: "#06b6d4", to: "#8b5cf6", angle: 90  },
  { name: "Sunset", from: "#f97316", to: "#ec4899", angle: 90  },
  { name: "Forest", from: "#10b981", to: "#0ea5e9", angle: 90  },
  { name: "Fire",   from: "#ef4444", to: "#f97316", angle: 90  },
  { name: "Dusk",   from: "#8b5cf6", to: "#ec4899", angle: 135 },
  { name: "Gold",   from: "#fbbf24", to: "#f97316", angle: 45  },
];
const VALID_COLOR_TYPES = ["none","solid","gradient"];
const VALID_DEC_TYPES   = ["none","bars","line","dot"];
const VALID_DEC_POS     = ["before","after","both"];
const VALID_ANGLES      = [45, 90, 135];

// ── Storage ───────────────────────────────────────────────────────────────────

const _load = async () => {
  try { return await readFile(LOGO_PATH, "utf-8"); } catch { return null; }
};
const _save = async (dataUrl) => {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LOGO_PATH, dataUrl, "utf-8");
};

const _loadDimensions = async () => {
  try {
    const raw = await readFile(DIMS_PATH, "utf-8");
    return { ...DEFAULT_DIMS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_DIMS }; }
};
const _saveDimensions = async (dims) => {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DIMS_PATH, JSON.stringify(dims), "utf-8");
};

const _loadWordmark = async () => {
  try {
    const raw = await readFile(WM_PATH, "utf-8");
    const wm = JSON.parse(raw);
    return typeof wm.text === "string" && wm.text.trim() ? wm : null;
  } catch { return null; }
};
const _saveWordmark = async (config) => {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(WM_PATH, JSON.stringify(config), "utf-8");
};

// ── Settings ──────────────────────────────────────────────────────────────────

let hideLogoManagement = false;
let logoIntro = "none";
let settingsLoaded = false;

const _loadSettings = async () => {
  if (settingsLoaded) return;
  settingsLoaded = true;
  try {
    const raw = await readFile(join(process.cwd(), "data", "plugin-settings.json"), "utf-8");
    const s = JSON.parse(raw)?.["plugin-logotype"];
    if (s) {
      hideLogoManagement = s.hideLogoManagement === true || s.hideLogoManagement === "true";
      logoIntro = ["none","fade","matrix"].includes(s.logoIntro) ? s.logoIntro : "none";
    }
  } catch {}
};
_loadSettings().catch(() => {});

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function _validHex(v) {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}

// SVG icon strings for decorator chips (chip-sized)
const DEC_ICON = {
  bars: `<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="8" width="3" height="6" rx="0.5"/><rect x="4.5" y="4" width="3" height="10" rx="0.5"/><rect x="9" y="0" width="3" height="14" rx="0.5"/></svg>`,
  line: `<svg width="3" height="14" viewBox="0 0 3 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="14" rx="1.5"/></svg>`,
  dot:  `<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4"/></svg>`,
};

// ── Plugin export ─────────────────────────────────────────────────────────────

export default {
  name: "Logotype",
  description: "Replace the Degoog logo with styled text or your own image. Use !logo to manage it.",
  trigger: "logo",
  isClientExposed: false,

  settingsSchema: [
    {
      key: "hideLogoManagement",
      label: "Hide logo management",
      type: "toggle",
      default: false,
      description: "Prevent users from uploading or changing the logo (useful for public instances).",
    },
    {
      key: "logoIntro",
      label: "Logo intro animation",
      type: "select",
      options: ["none", "fade", "matrix"],
      default: "none",
      description: "Canvas animation played when an image logo first appears on the page.",
    },
  ],

  configure(settings) {
    hideLogoManagement = settings?.hideLogoManagement === true || settings?.hideLogoManagement === "true";
    logoIntro = ["none","fade","matrix"].includes(settings?.logoIntro) ? settings.logoIntro : "none";
    settingsLoaded = true;
  },

  async execute() {
    await _loadSettings();

    if (hideLogoManagement) {
      return {
        title: "Logotype",
        html: `
          <div id="logotype-card" style="padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.3;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p style="font-size:0.9rem;opacity:0.6;margin:0;text-align:center;">Logo management is disabled on this instance.</p>
          </div>`,
      };
    }

    const [current, dims, wm] = await Promise.all([_load(), _loadDimensions(), _loadWordmark()]);
    const { homeMaxHeight, homeMaxWidth, searchMaxHeight, searchMaxWidth } = dims;

    // Extract + validate saved state
    const defaultTab = wm ? "text" : (current ? "image" : "text");
    const wmText     = _esc(wm?.text || "");
    const wmFont     = wm && FONT_IDS.has(wm.font) ? wm.font : "outfit";
    const fontDef    = FONTS.find(f => f.id === wmFont) || FONTS[0];

    const wmColor   = wm?.color || { type: "none" };
    const wmDec     = wm?.decorator || { type: "none", position: "before" };
    const colorType = VALID_COLOR_TYPES.includes(wmColor.type) ? wmColor.type : "none";
    const solidVal  = _validHex(wmColor.value) || "#4a9eff";
    const gradFrom  = _validHex(wmColor.from)  || "#06b6d4";
    const gradTo    = _validHex(wmColor.to)    || "#8b5cf6";
    const gradAngle = VALID_ANGLES.includes(wmColor.angle) ? wmColor.angle : 90;
    const decType   = VALID_DEC_TYPES.includes(wmDec.type)       ? wmDec.type     : "none";
    const decPos    = VALID_DEC_POS.includes(wmDec.position) ? wmDec.position : "before";

    // Preview element
    let previewContent;
    if (wm) {
      previewContent = `<span id="lt-preview-el" class="lt-wm-preview-text" style="font-family:'${_esc(fontDef.family)}',sans-serif;font-weight:${fontDef.weight};">${wmText}</span>`;
    } else if (current) {
      previewContent = `<img id="lt-preview-el" src="${current}" alt="Logo" style="max-height:80px;max-width:280px;object-fit:contain;display:block;" />`;
    } else {
      previewContent = `<span id="lt-preview-el" class="lt-wm-preview-text lt-wm-preview-empty" style="font-family:'${_esc(fontDef.family)}',sans-serif;font-weight:${fontDef.weight};">Your brand</span>`;
    }

    // Font chips
    const fontChips = FONTS.map(f =>
      `<button class="lt-font-chip${f.id === wmFont ? " active" : ""}" data-font="${f.id}" style="font-family:'${_esc(f.family)}',sans-serif;font-weight:${f.weight};">${_esc(f.name)}</button>`
    ).join("");

    // Solid color swatches
    const solidSwatches = SOLID_PRESETS.map(c =>
      `<button class="lt-swatch${colorType === "solid" && wmColor.value === c ? " active" : ""}" data-color="${c}" style="background:${c};" title="${c}"></button>`
    ).join("") +
    `<label class="lt-swatch lt-swatch-custom" title="Custom color"><input id="lt-solid-custom" type="color" value="${colorType === "solid" ? solidVal : "#4a9eff'"}"/><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></label>`;

    // Gradient preset swatches
    const gradSwatches = GRADIENT_PRESETS.map(g =>
      `<button class="lt-swatch lt-swatch-grad" data-from="${g.from}" data-to="${g.to}" data-angle="${g.angle}" style="background:linear-gradient(90deg,${g.from},${g.to});" title="${g.name}"></button>`
    ).join("");

    // Angle buttons
    const angleButtons = [
      { a: 90,  label: "→" },
      { a: 45,  label: "↗" },
      { a: 135, label: "↘" },
    ].map(({ a, label }) =>
      `<button class="lt-angle-btn${gradAngle === a ? " active" : ""}" data-angle="${a}">${label}</button>`
    ).join("");

    // Decorator chips
    const decChips = [
      { type: "none", label: "None", icon: "" },
      { type: "bars", label: "Bars", icon: DEC_ICON.bars },
      { type: "line", label: "Line", icon: DEC_ICON.line },
      { type: "dot",  label: "Dot",  icon: DEC_ICON.dot  },
    ].map(({ type, label, icon }) =>
      `<button class="lt-dec-chip${decType === type ? " active" : ""}" data-type="${type}" title="${label}">${icon || label}</button>`
    ).join("");

    // Position buttons
    const posButtons = [
      { pos: "before", label: "Before" },
      { pos: "after",  label: "After"  },
      { pos: "both",   label: "Both"   },
    ].map(({ pos, label }) =>
      `<button class="lt-pos-btn${decPos === pos ? " active" : ""}" data-pos="${pos}">${label}</button>`
    ).join("");

    // Dimension slider helper
    const sliderRow = (id, label, min, max, value) =>
      `<div class="lt-slider-row"><span class="lt-slider-label">${label}</span><input id="${id}" type="range" min="${min}" max="${max}" value="${value}" class="lt-slider"/><span id="${id}-val" class="lt-slider-val">${value}px</span></div>`;

    return {
      title: "Logotype",
      html: `
        <div id="logotype-card" data-active-tab="${defaultTab}" data-wm-font="${wmFont}">

          <!-- ── Mode selector ── -->
          <div class="lt-mode-tabs">
            <button class="lt-mode-tab${defaultTab === "text"  ? " active" : ""}" data-tab="text" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M17 6H7"/><path d="M12 6v12"/></svg>
              Text
            </button>
            <button class="lt-mode-tab${defaultTab === "image" ? " active" : ""}" data-tab="image" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Image
            </button>
          </div>

          <!-- ── Preview ── -->
          <div class="lt-preview-wrap">
            <span class="lt-preview-label">Preview</span>
            <div class="lt-preview-logo-area">${previewContent}</div>
            <div class="lt-preview-searchbar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.35;flex-shrink:0;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
          </div>

          <!-- ── Text panel ── -->
          <div id="lt-panel-text" class="lt-panel"${defaultTab !== "text" ? ' style="display:none"' : ""}>

            <input id="lt-wm-text" type="text" class="lt-text-input" value="${wmText}" placeholder="Your brand name…" maxlength="80" autocomplete="off" spellcheck="false"/>

            <div class="lt-section">
              <span class="lt-section-title">Font</span>
              <div class="lt-font-picker">${fontChips}</div>
            </div>

            <div class="lt-section">
              <span class="lt-section-title">Color</span>
              <div class="lt-mode-group">
                <button class="lt-mode-btn${colorType === "none"     ? " active" : ""}" data-mode="none">Default</button>
                <button class="lt-mode-btn${colorType === "solid"    ? " active" : ""}" data-mode="solid">Solid</button>
                <button class="lt-mode-btn${colorType === "gradient" ? " active" : ""}" data-mode="gradient">Gradient</button>
              </div>
              <div id="lt-solid-panel"${colorType !== "solid"    ? ' style="display:none"' : ""}>
                <div class="lt-swatches">${solidSwatches}</div>
              </div>
              <div id="lt-gradient-panel"${colorType !== "gradient" ? ' style="display:none"' : ""}>
                <div class="lt-grad-row">
                  <label class="lt-grad-label">From<input id="lt-grad-from" type="color" value="${gradFrom}"/></label>
                  <label class="lt-grad-label">To<input id="lt-grad-to" type="color" value="${gradTo}"/></label>
                  <div class="lt-angle-group">${angleButtons}</div>
                </div>
                <div class="lt-swatches lt-swatches-grad">${gradSwatches}</div>
              </div>
            </div>

            <div class="lt-section">
              <span class="lt-section-title">Decoration</span>
              <div class="lt-dec-group">${decChips}</div>
              <div id="lt-pos-row" class="lt-pos-group"${decType === "none" ? ' style="display:none"' : ""}>${posButtons}</div>
            </div>

          </div>

          <!-- ── Image panel ── -->
          <div id="lt-panel-image" class="lt-panel"${defaultTab !== "image" ? ' style="display:none"' : ""}>

            <label class="lt-upload-zone" for="logotype-file">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" style="opacity:0.4;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span class="lt-upload-text">${current ? "Replace image" : "Choose an image"}</span>
              <span class="lt-upload-hint">PNG · JPG · SVG · WebP &nbsp;·&nbsp; max 2 MB</span>
              <input id="logotype-file" type="file" accept="image/*" style="display:none"/>
            </label>

            ${current
              ? `<div class="lt-img-current">
                   <img id="logotype-preview" src="${current}" alt="Current logo" class="lt-img-thumb"/>
                   <button id="logotype-remove" class="lt-btn lt-btn-ghost lt-btn-danger" type="button">Remove image</button>
                 </div>`
              : `<p id="logotype-noimg" class="lt-img-none">No image set yet.</p>`
            }

          </div>

          <!-- ── Display size ── -->
          <details class="lt-dims-details">
            <summary class="lt-dims-summary">Display size</summary>
            <div class="lt-dims-body">
              <div class="lt-dims-group">
                <span class="lt-dims-group-label">Home page</span>
                ${sliderRow("lt-home-h", "Height", 20, 600,  homeMaxHeight)}
                ${sliderRow("lt-home-w", "Width",  50, 1200, homeMaxWidth)}
              </div>
              <div class="lt-dims-group">
                <span class="lt-dims-group-label">Search bar</span>
                ${sliderRow("lt-search-h", "Height", 20, 300, searchMaxHeight)}
                ${sliderRow("lt-search-w", "Width",  50, 600, searchMaxWidth)}
              </div>
            </div>
          </details>

          <!-- ── Footer ── -->
          <div class="lt-footer">
            <div class="lt-footer-actions">
              <button id="lt-save"  class="lt-btn lt-btn-primary" type="button">Save</button>
              <button id="lt-reset" class="lt-btn lt-btn-ghost lt-btn-danger" type="button">Reset to default</button>
            </div>
            <p id="logotype-status" class="lt-status"></p>
          </div>

        </div>`,
    };
  },

  routes: [
    {
      method: "get",
      path: "/settings",
      handler: async () => {
        await _loadSettings();
        return new Response(JSON.stringify({ hideLogoManagement, logoIntro }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "get",
      path: "/logo",
      handler: async () => {
        const data = await _load();
        return new Response(JSON.stringify({ dataUrl: data ?? null }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "post",
      path: "/logo",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) return new Response(JSON.stringify({ error: "Logo management is disabled" }), { status: 403, headers: { "Content-Type": "application/json" } });
        let body;
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
        const { dataUrl } = body ?? {};
        if (dataUrl === null || dataUrl === "") { try { await unlink(LOGO_PATH); } catch {} return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }); }
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return new Response(JSON.stringify({ error: "Invalid image data" }), { status: 400, headers: { "Content-Type": "application/json" } });
        if (dataUrl.length > 2 * 1024 * 1024 * 1.37) return new Response(JSON.stringify({ error: "Image too large (max 2 MB)" }), { status: 413, headers: { "Content-Type": "application/json" } });
        await _save(dataUrl);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
    {
      method: "get",
      path: "/wordmark",
      handler: async () => {
        const wm = await _loadWordmark();
        return new Response(JSON.stringify(wm ?? { text: null }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "post",
      path: "/wordmark",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) return new Response(JSON.stringify({ error: "Logo management is disabled" }), { status: 403, headers: { "Content-Type": "application/json" } });
        let body;
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
        const text = (body?.text ?? "").trim().slice(0, 80);
        if (!text) { try { await unlink(WM_PATH); } catch {} return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }); }
        const font = FONT_IDS.has(body?.font) ? body.font : "outfit";

        // Validate color
        const rawColor = body?.color || {};
        const colorType = VALID_COLOR_TYPES.includes(rawColor.type) ? rawColor.type : "none";
        let color;
        if (colorType === "solid") {
          color = { type: "solid", value: _validHex(rawColor.value) || "#4a9eff" };
        } else if (colorType === "gradient") {
          color = {
            type: "gradient",
            from:  _validHex(rawColor.from)  || "#06b6d4",
            to:    _validHex(rawColor.to)    || "#8b5cf6",
            angle: VALID_ANGLES.includes(parseInt(rawColor.angle)) ? parseInt(rawColor.angle) : 90,
          };
        } else {
          color = { type: "none" };
        }

        // Validate decorator
        const rawDec = body?.decorator || {};
        const decType = VALID_DEC_TYPES.includes(rawDec.type)    ? rawDec.type     : "none";
        const decPos  = VALID_DEC_POS.includes(rawDec.position)  ? rawDec.position : "before";
        const decorator = { type: decType, position: decPos };

        await _saveWordmark({ text, font, color, decorator });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
    {
      method: "post",
      path: "/reset",
      handler: async () => {
        await Promise.allSettled([unlink(LOGO_PATH), unlink(WM_PATH), unlink(DIMS_PATH)]);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
    {
      method: "get",
      path: "/dimensions",
      handler: async () => {
        const dims = await _loadDimensions();
        return new Response(JSON.stringify(dims), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
    {
      method: "post",
      path: "/dimensions",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) return new Response(JSON.stringify({ error: "Dimension management is disabled" }), { status: 403, headers: { "Content-Type": "application/json" } });
        let body;
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
        const _n = (v, fb) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 ? n : fb; };
        const dims = {
          homeMaxHeight:   _n(body?.homeMaxHeight, 300),
          homeMaxWidth:    _n(body?.homeMaxWidth,  500),
          searchMaxHeight: _n(body?.searchMaxHeight, 100),
          searchMaxWidth:  _n(body?.searchMaxWidth,  300),
        };
        await _saveDimensions(dims);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  ],
};
