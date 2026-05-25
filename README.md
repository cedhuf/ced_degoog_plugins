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

### Hister Slot

Integrates [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — directly into Degoog.

| Feature | Description |
|---|---|
| **Slot** | "In your index" panel shown alongside regular results (position configurable) |

**Requirements:** Degoog ≥ 0.17.0 · Hister (any recent version)

**Settings:**

| Setting | Description | Default |
|---|---|---|
| Hister Instance URL | `https://hister.example.com` | *(required)* |
| API Key | Your Hister Access Token (Hister → Profile → Access Token) | *(optional)* |
| Show panel | Display the "In your index" panel in results | ✅ |
| Panel position | `above-results` / `below-results` / `knowledge-panel` / `above-sidebar` | `above-results` |
| Results to show | Number of results displayed in the panel | `5` |

**Testing the connection:**

Once the URL is saved, a test link appears directly in the URL field description inside Settings → Plugins → Hister Slot. Click it to open the diagnostic endpoint in a new tab — it shows the raw Hister API response and a verdict.

---

### Hister Engine

Registers Hister as a native Degoog search engine. Results appear in a dedicated tab and via the `!hister` bang shortcut.

Install separately from **Settings → Store → Hister Engine**.

---

## Repository structure

```
ced_degoog_plugins/
├── package.json               ← Degoog Store manifest
├── README.md
├── plugins/
│   └── hister-slot/
│       ├── index.js           ← slot + /test diagnostic route
│       ├── style.css          ← scoped styles (uses Degoog CSS variables)
│       ├── logo.png
│       ├── screenshot.png
│       └── author.json
└── engines/
    └── hister-engine/
        ├── index.js           ← standalone search engine + !hister bang
        └── screenshot.png
```

## License

MIT
