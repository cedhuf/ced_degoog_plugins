// Web Search Engine for Degoog
// Combines Google, DuckDuckGo, and Bing in a single engine.
// Each provider can be enabled or disabled independently in Settings.
// Requires cheerio — already bundled with degoog.

export const type = "web";

// ── User agents ───────────────────────────────────────────────────────────────

const _UA = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const _GSA = [
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/113.0.5672.127 Safari/537.36",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
];

function _rnd(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── cheerio (lazy, shared across all sub-engines) ─────────────────────────────

let _cheerioLoad = undefined; // undefined = not tried, null = unavailable, fn = ready

async function _$(html) {
  if (_cheerioLoad === undefined) {
    try {
      const mod = await import("cheerio");
      _cheerioLoad = mod.load ?? mod.default?.load ?? null;
    } catch {
      _cheerioLoad = null;
    }
  }
  if (!_cheerioLoad) {
    throw new Error("[web-search] cheerio not found — run: npm install cheerio");
  }
  return _cheerioLoad(html);
}

// ── Google utilities ──────────────────────────────────────────────────────────

function _googleTbs(timeFilter) {
  const map = { hour: "qdr:h", day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  return map[timeFilter] ?? null;
}

function _googleCustomTbs(from, to) {
  if (!from && !to) return null;
  const fmt = (s) => (s ? s.replace(/-/g, "/") : "");
  return `cdr:1,cd_min:${fmt(from)},cd_max:${fmt(to)}`;
}

function _resolveGoogleHref(href) {
  try {
    const url = new URL(href, "https://www.google.com");
    const q = url.searchParams.get("q");
    if (q && q.startsWith("http")) return q;
    const u = url.searchParams.get("url");
    if (u && u.startsWith("http")) return u;
  } catch {
    /* keep original */
  }
  return href;
}

async function _searchGoogle(query, page, timeFilter, context, safeSearch) {
  const start = (page - 1) * 10;
  const lang = context?.lang || "en";

  const params = new URLSearchParams({
    q: query,
    hl: lang,
    lr: `lang_${lang}`,
    ie: "utf8",
    oe: "utf8",
    start: String(start),
    filter: "0",
  });

  const tbs =
    timeFilter === "custom"
      ? _googleCustomTbs(context?.dateFrom, context?.dateTo)
      : _googleTbs(timeFilter);
  if (tbs) params.set("tbs", tbs);
  if (safeSearch === "on") params.set("safe", "active");

  const url = `https://www.google.com/search?${params}`;
  const doFetch = context?.fetch ?? fetch;
  const resp = await doFetch(url, {
    headers: {
      "User-Agent": _rnd(_GSA),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":
        context?.buildAcceptLanguage?.() ||
        process.env.DEGOOG_DEFAULT_SEARCH_LANGUAGE ||
        "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+",
    },
    redirect: "follow",
  });

  const html = await resp.text();
  const $ = await _$(html);
  const results = [];

  const pushResult = (title, href, snippet) => {
    const resolvedUrl = _resolveGoogleHref(href);
    if (
      title &&
      resolvedUrl &&
      resolvedUrl.startsWith("http") &&
      !resolvedUrl.includes("google.com/search")
    ) {
      results.push({ title, url: resolvedUrl, snippet, source: "Google" });
      return true;
    }
    return false;
  };

  $('a[href^="/url?q="]').each((_, el) => {
    const linkEl = $(el);
    const title = linkEl.find("span").first().text().trim();
    const href = linkEl.attr("href") || "";
    const snippet = linkEl.parent().next("div").text().trim();
    pushResult(title, href, snippet);
  });

  if (results.length === 0) {
    $("[data-hveid] a[href]").each((_, el) => {
      const linkEl = $(el);
      const title =
        linkEl.find("h3").first().text().trim() ||
        linkEl.closest("[data-hveid]").find("[role='link']").first().text().trim();
      const href = linkEl.attr("href") || "";
      const snippet = linkEl
        .closest("[data-hveid]")
        .find("[data-sncf]")
        .first()
        .text()
        .trim();
      pushResult(title, href, snippet);
    });
  }

  return results;
}

// ── DuckDuckGo utilities ──────────────────────────────────────────────────────

const _DDG_SAFE = { moderate: "-2", strict: "1" };

function _resolveDdgHref(href) {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return uddg;
    if (url.pathname.endsWith("/y.js")) {
      const u = url.searchParams.get("u");
      if (u) return u;
    }
  } catch {
    /* keep original */
  }
  return href;
}

function _isDdgInternal(url) {
  try {
    const h = new URL(url).hostname;
    return h === "duckduckgo.com" || h.endsWith(".duckduckgo.com");
  } catch {
    return false;
  }
}

async function _searchDDG(query, page, timeFilter, context, safeSearch) {
  const offset = ((page || 1) - 1) * 30;
  const lang = context?.lang;
  const params = new URLSearchParams({ q: query });

  if (offset > 0) {
    params.set("s", String(offset));
    params.set("dc", String(offset + 1));
  }
  if (lang && lang !== "en") params.set("kl", `${lang}-${lang}`);
  if (_DDG_SAFE[safeSearch]) params.set("kp", _DDG_SAFE[safeSearch]);
  if (timeFilter && timeFilter !== "any" && timeFilter !== "custom") {
    const dfMap = { hour: "h", day: "d", week: "w", month: "m", year: "y" };
    if (dfMap[timeFilter]) params.set("df", dfMap[timeFilter]);
  }

  const url = `https://html.duckduckgo.com/html/?${params}`;
  const doFetch = context?.fetch ?? fetch;
  const resp = await doFetch(url, {
    headers: {
      "User-Agent": _rnd(_UA),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language":
        context?.buildAcceptLanguage?.() ||
        process.env.DEGOOG_DEFAULT_SEARCH_LANGUAGE ||
        "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://duckduckgo.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
  });

  const html = await resp.text();
  const $ = await _$(html);
  const results = [];

  $(".result").each((_, el) => {
    const titleEl = $(el).find(".result__title a").first();
    const snippetEl = $(el).find(".result__snippet").first();
    const title = titleEl.text().trim();
    let href = titleEl.attr("href") || "";
    const snippet = snippetEl.text().trim();
    href = _resolveDdgHref(href);
    if (title && href && href.startsWith("http") && !_isDdgInternal(href)) {
      results.push({ title, url: href, snippet, source: "DuckDuckGo" });
    }
  });

  return results;
}

// ── Bing ──────────────────────────────────────────────────────────────────────

async function _searchBing(query, page, timeFilter, context, safeSearch) {
  const first = (page - 1) * 50;
  const lang = context?.lang;
  let url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=50&first=${first}`;
  if (lang) url += `&setlang=${lang}`;

  const adlt =
    safeSearch === "strict" || safeSearch === "moderate" ? safeSearch : "off";
  url += `&adlt=${adlt}`;

  if (timeFilter && timeFilter !== "any" && timeFilter !== "custom") {
    const freshMap = { hour: "Hour", day: "Day", week: "Week", month: "Month", year: "Year" };
    if (freshMap[timeFilter])
      url += `&filters=ex1%3a"ez5_${freshMap[timeFilter]}_TimeCustom"`;
  } else if (timeFilter === "custom" && (context?.dateFrom || context?.dateTo)) {
    const from = context?.dateFrom ?? "";
    const to = context?.dateTo ?? "";
    url += `&filters=${encodeURIComponent(
      `ex1:"ez5_Custom_TimeCustom" ex2:"CustomDate|${from}_${to}"`,
    )}`;
  }

  const doFetch = context?.fetch ?? fetch;
  const resp = await doFetch(url, {
    headers: {
      "User-Agent": _rnd(_UA),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language":
        context?.buildAcceptLanguage?.() ||
        process.env.DEGOOG_DEFAULT_SEARCH_LANGUAGE ||
        "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
  });

  const html = await resp.text();
  const $ = await _$(html);
  const results = [];

  const items =
    $("li.b_algo").length > 0 ? $("li.b_algo") : $('li[class*="b_algo"]');

  items.each((_, el) => {
    const titleEl = $(el).find("h2 a").first();
    const snippetEl = $(el).find(".b_caption p").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href") || "";
    const snippet = snippetEl.text().trim();
    if (title && href && href.startsWith("http")) {
      results.push({ title, url: href, snippet, source: "Bing" });
    }
  });

  if (results.length === 0) {
    $("#b_results li, main li").each((_, el) => {
      const $li = $(el);
      const titleEl = $li.find("h2 a").first();
      const href = titleEl.attr("href") || "";
      const title = titleEl.text().trim();
      if (title && href && href.startsWith("http")) {
        results.push({
          title,
          url: href,
          snippet: $li.find("p").first().text().trim(),
          source: "Bing",
        });
      }
    });
  }

  return results;
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

function _interleave(batches) {
  const seen = new Set();
  const out = [];
  const maxLen = Math.max(...batches.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) {
    for (const batch of batches) {
      const r = batch[i];
      if (r && !seen.has(r.url)) {
        seen.add(r.url);
        out.push(r);
      }
    }
  }
  return out;
}

function _append(batches) {
  const seen = new Set();
  return batches.flat().filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default class WebSearchEngine {
  isClientExposed = false;
  name = "Web Search";
  bangShortcut = "web";

  _google = true;
  _ddg = true;
  _bing = false;
  _googleSafe = "off";
  _ddgSafe = "off";
  _bingSafe = "off";
  _merge = "interleave";

  settingsSchema = [
    {
      key: "enableGoogle",
      label: "Enable Google",
      type: "select",
      options: ["on", "off"],
      default: "on",
      description: "Include Google in combined search results.",
    },
    {
      key: "googleSafeSearch",
      label: "Google Safe Search",
      type: "select",
      options: ["off", "on"],
      default: "off",
      description: "Filter explicit content from Google results.",
    },
    {
      key: "enableDDG",
      label: "Enable DuckDuckGo",
      type: "select",
      options: ["on", "off"],
      default: "on",
      description: "Include DuckDuckGo in combined search results.",
    },
    {
      key: "ddgSafeSearch",
      label: "DuckDuckGo Safe Search",
      type: "select",
      options: ["off", "moderate", "strict"],
      default: "off",
      description: "Filter explicit content from DuckDuckGo results.",
    },
    {
      key: "enableBing",
      label: "Enable Bing",
      type: "select",
      options: ["off", "on"],
      default: "off",
      description: "Include Bing in combined search results.",
    },
    {
      key: "bingSafeSearch",
      label: "Bing Safe Search",
      type: "select",
      options: ["off", "moderate", "strict"],
      default: "off",
      description: "Filter explicit content from Bing results.",
    },
    {
      key: "mergeStrategy",
      label: "Merge Strategy",
      type: "select",
      options: ["interleave", "append"],
      default: "interleave",
      description:
        'How to combine results from multiple engines. "interleave" alternates sources (Google → DDG → Bing → …); "append" groups by source.',
    },
  ];

  configure(settings) {
    this._google = settings.enableGoogle !== "off";
    this._ddg = settings.enableDDG !== "off";
    this._bing = settings.enableBing === "on";
    this._googleSafe = settings.googleSafeSearch || "off";
    this._ddgSafe = settings.ddgSafeSearch || "off";
    this._bingSafe = settings.bingSafeSearch || "off";
    this._merge = settings.mergeStrategy || "interleave";
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    const tasks = [];
    if (this._google)
      tasks.push(
        _searchGoogle(query, page, timeFilter, context, this._googleSafe).catch(() => []),
      );
    if (this._ddg)
      tasks.push(
        _searchDDG(query, page, timeFilter, context, this._ddgSafe).catch(() => []),
      );
    if (this._bing)
      tasks.push(
        _searchBing(query, page, timeFilter, context, this._bingSafe).catch(() => []),
      );

    if (tasks.length === 0) return [];

    const batches = await Promise.all(tasks);
    return this._merge === "append" ? _append(batches) : _interleave(batches);
  }
}
