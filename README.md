# ced_degoog_plugins

[Degoog](https://github.com/degoog-org/degoog) extensions by [@cedhuf](https://github.com/cedhuf) — self-hosted integrations built for homelab stacks. Privacy-first, zero cloud, everything under your control.

## Add this repository to Degoog

**Settings → Store → Add**, then paste:

```
https://github.com/cedhuf/ced_degoog_plugins.git
```

Then **Browse** → pick an extension → **Install** → **Configure**.

---

## Available extensions

### Logotype

Replace the Degoog logo with a custom **text wordmark** or your own **image**. Style your brand name with font, color, and graphic decorator options — all with a live preview.

Manage via the **`!logo`** command in the search bar.

| Feature | Description |
|---|---|
| **Text wordmark** | Brand name with font picker, solid/gradient color, and decorators (Bars, Line, Dot) |
| **Image logo** | Upload PNG, JPG, SVG, or GIF — control dimensions for home and search bar |
| **Intro animation** | Optional `fade` or `matrix` animation on first page load |

**Requirements:** Degoog ≥ 0.17.0

---

### Hister Slot

Integrates [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — directly into Degoog search results.

| Feature | Description |
|---|---|
| **Slot** | "In your index" panel shown alongside regular results (position configurable) |

**Requirements:** Degoog ≥ 0.17.0 · Hister (any recent version)

| Setting | Description | Default |
|---|---|---|
| Hister Instance URL | `https://hister.example.com` | *(required)* |
| API Key | Your Hister Access Token (Hister → Profile → Access Token) | *(optional)* |
| Show panel | Display the "In your index" panel in results | ✅ |
| Panel position | `above-results` / `below-results` / `knowledge-panel` / `above-sidebar` | `above-results` |
| Results to show | Number of results displayed in the panel | `5` |

---

### Hister Engine

Registers Hister as a native Degoog search engine. Results appear in a dedicated tab and via the `!hister` bang shortcut.

**Requirements:** Degoog ≥ 0.17.0 · Hister (any recent version)

---

## Repository structure

```
ced_degoog_plugins/
├── package.json               ← Degoog Store manifest
├── README.md
├── plugins/
│   ├── logotype/
│   │   ├── index.js           ← server routes + !logo card UI
│   │   ├── script.js          ← client-side wordmark/image rendering
│   │   ├── style.css
│   │   ├── author.json
│   │   └── screenshots/
│   └── hister-slot/
│       ├── index.js           ← slot + /test diagnostic route
│       ├── style.css
│       ├── author.json
│       └── screenshots/
└── engines/
    └── hister-engine/
        ├── index.js           ← standalone search engine + !hister bang
        └── screenshots/
```

## License

MIT
