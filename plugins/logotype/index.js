import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const DATA_DIR  = join(process.cwd(), "data", "logotype");
const LOGO_PATH = join(DATA_DIR, "logo.dat");
const DIMS_PATH = join(DATA_DIR, "dimensions.json");
const WM_PATH   = join(DATA_DIR, "wordmark.json");

const DEFAULT_DIMS = { homeMaxHeight: 300, homeMaxWidth: 500, searchMaxHeight: 100, searchMaxWidth: 300 };

const FONTS = [
  { id: "outfit",        name: "Outfit",          family: "Outfit",           weight: "700" },
  { id: "space-grotesk", name: "Space Grotesk",   family: "Space Grotesk",    weight: "700" },
  { id: "bebas-neue",    name: "Bebas Neue",       family: "Bebas Neue",       weight: "400" },
  { id: "playfair",      name: "Playfair",         family: "Playfair Display", weight: "700" },
  { id: "raleway",       name: "Raleway",          family: "Raleway",          weight: "300" },
  { id: "josefin",       name: "Josefin",          family: "Josefin Sans",     weight: "700" },
];
const FONT_IDS = new Set(FONTS.map(f => f.id));

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
  } catch {
    return { ...DEFAULT_DIMS };
  }
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
let logoIntro  = "none";
let settingsLoaded = false;

const _loadSettings = async () => {
  if (settingsLoaded) return;
  settingsLoaded = true;
  try {
    const settingsPath = join(process.cwd(), "data", "plugin-settings.json");
    const raw = await readFile(settingsPath, "utf-8");
    const allSettings = JSON.parse(raw);
    const s = allSettings?.["plugin-logotype"];
    if (s) {
      hideLogoManagement = s.hideLogoManagement === true || s.hideLogoManagement === "true";
      const valid = ["none", "fade", "matrix"];
      logoIntro = valid.includes(s.logoIntro) ? s.logoIntro : "none";
    }
  } catch {}
};
_loadSettings().catch(() => {});

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
    const valid = ["none", "fade", "matrix"];
    logoIntro = valid.includes(settings?.logoIntro) ? settings.logoIntro : "none";
    settingsLoaded = true;
  },

  async execute() {
    await _loadSettings();

    if (hideLogoManagement) {
      return {
        title: "Logotype",
        html: `
          <div id="logotype-card" style="padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.3;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p style="font-size:0.9rem;color:var(--text-secondary);margin:0;text-align:center;">Logo management is disabled on this instance.</p>
          </div>`,
      };
    }

    const [current, dims, wm] = await Promise.all([_load(), _loadDimensions(), _loadWordmark()]);
    const { homeMaxHeight, homeMaxWidth, searchMaxHeight, searchMaxWidth } = dims;

    const defaultTab = wm ? "text" : (current ? "image" : "text");
    const wmText     = _esc(wm?.text || "");
    const wmFont     = wm && FONT_IDS.has(wm.font) ? wm.font : "outfit";
    const fontDef    = FONTS.find(f => f.id === wmFont) || FONTS[0];

    // Preview logo element
    const previewEl = wm
      ? `<span id="lt-preview-el" class="lt-wm-preview-text" style="font-family:'${_esc(fontDef.family)}',sans-serif;font-weight:${fontDef.weight};">${wmText}</span>`
      : current
        ? `<img id="lt-preview-el" src="${current}" alt="Logo" style="max-height:80px;max-width:280px;object-fit:contain;display:block;" />`
        : `<span id="lt-preview-el" class="lt-wm-preview-text lt-wm-preview-empty" style="font-family:'${_esc(fontDef.family)}',sans-serif;font-weight:${fontDef.weight};">Your brand</span>`;

    // Font picker
    const fontChips = FONTS.map(f =>
      `<button class="lt-font-chip${f.id === wmFont ? " active" : ""}" data-font="${f.id}" style="font-family:'${_esc(f.family)}',sans-serif;font-weight:${f.weight};">${_esc(f.name)}</button>`
    ).join("");

    // Dimension sliders
    const sliderRow = (id, label, min, max, value) =>
      `<div class="lt-slider-row">`
      + `<span class="lt-slider-label">${label}</span>`
      + `<input id="${id}" type="range" min="${min}" max="${max}" value="${value}" class="lt-slider" />`
      + `<span id="${id}-val" class="lt-slider-val">${value}px</span>`
      + `</div>`;

    // Current image thumb
    const imgPreview = current
      ? `<img id="logotype-preview" src="${current}" alt="Current logo" class="lt-img-thumb" />`
      : `<p id="logotype-nologo" class="lt-img-none">No image set.</p>`;

    return {
      title: "Logotype",
      html: `
        <div id="logotype-card" data-default-tab="${defaultTab}" data-wm-font="${wmFont}">

          <div class="lt-preview-wrap">
            <span class="lt-preview-label">Preview</span>
            <div class="lt-preview-logo-area">${previewEl}</div>
            <div class="lt-preview-searchbar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.35;flex-shrink:0;">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>
          </div>

          <div class="lt-tabs">
            <button class="lt-tab${defaultTab === "text"  ? " active" : ""}" data-tab="text">Text</button>
            <button class="lt-tab${defaultTab === "image" ? " active" : ""}" data-tab="image">Image</button>
          </div>

          <div id="lt-panel-text" class="lt-panel"${defaultTab !== "text" ? ' style="display:none;"' : ""}>
            <input id="lt-wm-text" type="text" class="lt-text-input" value="${wmText}" placeholder="Your brand name…" maxlength="80" autocomplete="off" spellcheck="false" />
            <div class="lt-font-picker">${fontChips}</div>
            <button id="lt-wm-save" class="lt-btn">Save</button>
          </div>

          <div id="lt-panel-image" class="lt-panel"${defaultTab !== "image" ? ' style="display:none;"' : ""}>
            <div class="lt-img-row">
              ${imgPreview}
              <div class="lt-img-actions">
                <label class="lt-btn">
                  Upload image
                  <input id="logotype-file" type="file" accept="image/*" style="display:none;" />
                </label>
                <button id="logotype-remove" class="lt-btn lt-btn-danger">Remove</button>
              </div>
            </div>
            <div class="lt-dims">
              <span class="lt-dims-title">Dimensions</span>
              ${sliderRow("lt-home-h",   "Home height",   20, 600,  homeMaxHeight)}
              ${sliderRow("lt-home-w",   "Home width",    50, 1200, homeMaxWidth)}
              ${sliderRow("lt-search-h", "Search height", 20, 300,  searchMaxHeight)}
              ${sliderRow("lt-search-w", "Search width",  50, 600,  searchMaxWidth)}
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button id="logotype-save-dims" class="lt-btn">Save dimensions</button>
                <button id="logotype-reset-dims" class="lt-btn lt-btn-ghost" title="Reset to defaults: 300×500 / 100×300">Reset to defaults</button>
              </div>
            </div>
          </div>

          <div class="lt-footer">
            <button id="lt-reset" class="lt-btn lt-btn-danger lt-btn-ghost">Reset all</button>
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
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "get",
      path: "/logo",
      handler: async () => {
        const data = await _load();
        return new Response(JSON.stringify({ dataUrl: data ?? null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "post",
      path: "/logo",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) {
          return new Response(JSON.stringify({ error: "Logo management is disabled" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        let body;
        try { body = await req.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const { dataUrl } = body ?? {};
        if (dataUrl === null || dataUrl === "") {
          try { await unlink(LOGO_PATH); } catch {}
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          return new Response(JSON.stringify({ error: "Invalid image data" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        if (dataUrl.length > 2 * 1024 * 1024 * 1.37) {
          return new Response(JSON.stringify({ error: "Image too large (max 2 MB)" }), { status: 413, headers: { "Content-Type": "application/json" } });
        }
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
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "post",
      path: "/wordmark",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) {
          return new Response(JSON.stringify({ error: "Logo management is disabled" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        let body;
        try { body = await req.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const text = (body?.text ?? "").trim().slice(0, 80);
        const font = FONT_IDS.has(body?.font) ? body.font : "outfit";
        if (!text) {
          try { await unlink(WM_PATH); } catch {}
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        await _saveWordmark({ text, font });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
    {
      method: "post",
      path: "/reset",
      handler: async () => {
        await Promise.allSettled([
          unlink(LOGO_PATH),
          unlink(WM_PATH),
          unlink(DIMS_PATH),
        ]);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "get",
      path: "/dimensions",
      handler: async () => {
        const dims = await _loadDimensions();
        return new Response(JSON.stringify(dims), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      method: "post",
      path: "/dimensions",
      handler: async (req) => {
        await _loadSettings();
        if (hideLogoManagement) {
          return new Response(JSON.stringify({ error: "Dimension management is disabled" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        let body;
        try { body = await req.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const _n = (v, fb) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 ? n : fb; };
        const dims = {
          homeMaxHeight: _n(body?.homeMaxHeight, 300),
          homeMaxWidth:  _n(body?.homeMaxWidth,  500),
          searchMaxHeight: _n(body?.searchMaxHeight, 100),
          searchMaxWidth:  _n(body?.searchMaxWidth,  300),
        };
        await _saveDimensions(dims);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  ],
};
