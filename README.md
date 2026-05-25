# ced_degoog_plugins

> **Note:** This plugin was developed with the assistance of [Claude](https://claude.ai) (Anthropic AI). Architecture, Degoog API compliance, and implementation were iterated collaboratively with AI.

[Degoog](https://github.com/degoog-org/degoog) extensions by [@cedhuf](https://github.com/cedhuf) — self-hosted integrations built for homelab stacks. Privacy-first, zero cloud, everything under your control.

## Add this repository to Degoog

**Settings → Store → Add**, then paste:

```
https://github.com/cedhuf/ced_degoog_plugins.git
```

Then **Browse** → pick an extension → **Install** → **Configure**.

---

## Available extensions

### 🔍 Hister — Plugin

Integrates [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — directly into Degoog.

| Feature | Description |
|---|---|
| **Slot** | "In your index" panel shown alongside regular results (position configurable) |
| **Pre-fetch interceptor** | Optionally pre-loads Hister results before the panel renders, saving one HTTP round-trip |

**Requirements:** Degoog ≥ 0.17.0 · Hister (any recent version)

**Settings:**

| Setting | Description | Default |
|---|---|---|
| Hister Instance URL | `http://hister:8080` | *(required)* |
| API Key | API key if the instance is protected | *(optional)* |
| Show panel | Display the "In your index" panel in results | ✅ |
| Panel position | `above-results` / `below-results` / `knowledge-panel` / `above-sidebar` | `above-results` |
| Enable pre-fetching | Pre-load results before panel renders | ❌ |
| Pre-fetch result count | How many results to pre-load | `5` |

**Testing the connection:**

Once the URL is saved, open this in your browser (replace `<plugin-id>` with the value shown in the URL field description):

```
http://your-degoog/api/plugin/<plugin-id>/test
```

The endpoint returns the raw Hister API response, status code, and a hint — useful for diagnosing endpoint or format mismatches.

---

### 🔍 Hister — Engine

Registers Hister as a native Degoog search engine. Results appear in a dedicated tab and via the `!hister` bang shortcut.

Install separately from **Settings → Store → Hister Engine**.

---

## Repository structure

```
ced_degoog_plugins/
├── package.json          ← Degoog Store manifest
├── README.md
├── plugins/
│   └── hister/
│       ├── index.js      ← slot + interceptor + /test route
│       ├── style.css     ← scoped styles (uses Degoog CSS variables)
│       └── author.json
└── engines/
    └── hister/
        └── index.js      ← standalone search engine + !hister bang
```

## License

MIT
