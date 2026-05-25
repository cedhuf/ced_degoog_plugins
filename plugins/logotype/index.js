import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "logotype");
const LOGO_PATH = join(DATA_DIR, "logo.dat");
const DIMS_PATH = join(DATA_DIR, "dimensions.json");

const DEFAULT_DIMS = { homeMaxHeight: 300, homeMaxWidth: 500, searchMaxHeight: 100, searchMaxWidth: 300 };

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

let hideLogoManagement = false;
let logoIntro = "none";
let settingsLoaded = false;

const _loadSettings = async () => {
  if (settingsLoaded) return;
  settingsLoaded = true;
  try {
    const settingsPath = join(process.cwd(), "data", "plugin-settings.json");
    const raw = await readFile(settingsPath, "utf-8");
    const allSettings = JSON.parse(raw);
    const pluginSettings = allSettings?.["plugin-logotype"];
    if (pluginSettings) {
      const val = pluginSettings.hideLogoManagement;
      hideLogoManagement = val === true || val === "true";
      const validIntros = ["none", "fade", "matrix"];
      logoIntro = validIntros.includes(pluginSettings.logoIntro) ? pluginSettings.logoIntro : "none";
    }
  } catch {
    // Settings file doesn't exist or can't be read, use defaults
  }
};

_loadSettings().catch(() => {});

export default {
  name: "Logotype",
  description: "Replace the Degoog logo with your own image. Use !logo in the search bar to manage it.",
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
      description: "Canvas animation played when the logo first appears on the page.",
    },
  ],

  configure(settings) {
    const val = settings?.hideLogoManagement;
    hideLogoManagement = val === true || val === "true";
    const validIntros = ["none", "fade", "matrix"];
    logoIntro = validIntros.includes(settings?.logoIntro) ? settings.logoIntro : "none";
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

    const [current, dims] = await Promise.all([_load(), _loadDimensions()]);
    const { homeMaxHeight, homeMaxWidth, searchMaxHeight, searchMaxWidth } = dims;

    const previewHtml = current
      ? `<img id="logotype-preview" src="${current}" alt="Current logo" style="max-height:80px;max-width:220px;object-fit:contain;display:block;border-radius:6px;border:1px solid rgba(255,255,255,0.1);padding:4px 8px;background:rgba(0,0,0,0.2);" />`
      : `<p id="logotype-nologo" style="font-size:0.82rem;color:var(--text-secondary);font-style:italic;margin:0;">No custom logo set.</p>`;

    const homePreviewImg = current
      ? `<img id="logotype-home-preview-img" src="${current}" alt="Home logo preview" style="max-height:${homeMaxHeight}px;max-width:${homeMaxWidth}px;object-fit:contain;display:block;" />`
      : `<img id="logotype-home-preview-img" src="" alt="Home logo preview" style="max-height:${homeMaxHeight}px;max-width:${homeMaxWidth}px;object-fit:contain;display:none;" />`;

    const sliderRow = (id, label, min, max, value) =>
      `<div style="display:flex;align-items:center;gap:8px;">`
      + `<span style="font-size:0.78rem;color:var(--text-secondary);min-width:110px;">${label}</span>`
      + `<input id="${id}" type="range" min="${min}" max="${max}" value="${value}" style="flex:1;accent-color:var(--accent,#cba6f7);" />`
      + `<span id="${id}-val" style="font-size:0.78rem;min-width:44px;text-align:right;">${value}px</span>`
      + `</div>`;

    return {
      title: "Logotype",
      html: `
        <div id="logotype-card" style="padding:14px 16px;display:flex;flex-direction:column;gap:12px;">
          <div style="background:rgba(0,0,0,0.15);border-radius:8px;padding:20px 16px 24px;display:flex;flex-direction:column;align-items:center;gap:18px;">
            <span style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);align-self:flex-start;">Home page preview</span>
            ${homePreviewImg}
            <div style="width:100%;max-width:584px;display:flex;flex-direction:column;align-items:stretch;gap:18px;">
              <div style="display:flex;align-items:center;width:100%;border-radius:24px;border:1px solid rgba(255,255,255,0.15);background:var(--bg-secondary,#1e1e2e);padding:10px 16px;gap:12px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4;flex-shrink:0;">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <span style="flex:1;font-size:0.95rem;color:var(--text-secondary);user-select:none;"></span>
              </div>
              <div style="display:flex;gap:11px;justify-content:center;">
                <span style="padding:10px 20px;border-radius:4px;font-size:0.875rem;background:rgba(255,255,255,0.05);color:var(--text-primary);border:1px solid rgba(255,255,255,0.1);user-select:none;font-weight:500;">Degoog Search</span>
                <span style="padding:10px 20px;border-radius:4px;font-size:0.875rem;background:rgba(255,255,255,0.05);color:var(--text-primary);border:1px solid rgba(255,255,255,0.1);user-select:none;font-weight:500;">I'm Feeling Lucky</span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;">
            ${previewHtml}
            <div style="display:flex;flex-direction:column;gap:6px;">
              <label style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.15);background:var(--bg-secondary,#1e1e2e);color:var(--text-primary,#cdd6f4);">
                Upload image
                <input id="logotype-file" type="file" accept="image/*" style="display:none;" />
              </label>
              <button id="logotype-remove" style="display:inline-flex;align-items:center;padding:6px 14px;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer;border:1px solid rgba(243,139,168,0.25);background:var(--bg-secondary,#1e1e2e);color:var(--danger,#f38ba8);">
                Remove
              </button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);">Dimensions</span>
            ${sliderRow("lt-home-h", "Home height", 20, 600, homeMaxHeight)}
            ${sliderRow("lt-home-w", "Home width", 50, 1200, homeMaxWidth)}
            ${sliderRow("lt-search-h", "Search height", 20, 300, searchMaxHeight)}
            ${sliderRow("lt-search-w", "Search width", 50, 600, searchMaxWidth)}
            <button id="logotype-save-dims" style="align-self:flex-start;margin-top:2px;padding:5px 14px;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.15);background:var(--bg-secondary,#1e1e2e);color:var(--text-primary,#cdd6f4);">Save dimensions</button>
          </div>
          <p id="logotype-status" style="font-size:0.78rem;color:var(--text-secondary);margin:0;"></p>
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
        try {
          body = await req.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { dataUrl } = body ?? {};

        if (dataUrl === null || dataUrl === "") {
          try { await unlink(LOGO_PATH); } catch {}
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          return new Response(JSON.stringify({ error: "Invalid image data" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const MAX_BYTES = 2 * 1024 * 1024;
        if (dataUrl.length > MAX_BYTES * 1.37) {
          return new Response(JSON.stringify({ error: "Image too large (max 2 MB)" }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
        }

        await _save(dataUrl);
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
        try {
          body = await req.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const _n = (v, fb) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 ? n : fb; };
        const dims = {
          homeMaxHeight: _n(body?.homeMaxHeight, 300),
          homeMaxWidth: _n(body?.homeMaxWidth, 500),
          searchMaxHeight: _n(body?.searchMaxHeight, 100),
          searchMaxWidth: _n(body?.searchMaxWidth, 300),
        };
        await _saveDimensions(dims);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  ],
};
