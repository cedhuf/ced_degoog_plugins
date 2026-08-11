# ced_degoog_plugins

[Degoog](https://github.com/degoog-org/degoog) extensions by [@cedhuf](https://github.com/cedhuf): self-hosted integrations built for homelab stacks. Privacy-first, zero cloud, everything under your control.

## Add this repository to Degoog

**Settings > Store > Add**, then paste:

```
https://github.com/cedhuf/ced_degoog_plugins.git
```

Then **Browse**, pick an extension, **Install**, **Configure**.

## Available extensions

Each extension documents its own settings. Follow the link rather than looking for a table here, so there is one place to keep accurate.

### Integrations

Two extensions per service: a **plugin** for the results panel and the First mode, and an **engine** for the dedicated tab and the bang shortcut. Degoog keeps plugins and engines in separate registries, so each is configured on its own.

| Extension | Type | What it does |
|---|---|---|
| [Hister](plugins/hister-slot/) | plugin | "In your index" panel, plus Hister First routing |
| [Hister Engine](engines/hister-engine/) | engine | `Hister` tab and the `!hister` bang |
| [Karakeep](plugins/karakeep-slot/) | plugin | "In your bookmarks" panel, plus Karakeep First routing |
| [Karakeep Engine](engines/karakeep-engine/) | engine | `Karakeep` tab and the `!karakeep` bang |

The plugin and the engine are useful on their own, but First mode needs both: the plugin decides to redirect, the engine provides the tab it redirects to.

### Interface

| Extension | Type | What it does |
|---|---|---|
| [Logotype](plugins/logotype/) | plugin | Replace the Degoog logo with a text wordmark or your own image, managed via `!logo` |
| [OhMyClean](plugins/ohmyclean/) | plugin | Selectively hide Degoog UI elements: footer, settings gear, search buttons, wordmark |

## Version requirements

| Extension | Minimum Degoog |
|---|---|
| Hister, Karakeep | 0.24.0 |
| Hister Engine, Karakeep Engine | 0.21.0 |
| Logotype, OhMyClean | 0.17.0 |

The Hister and Karakeep plugins need 0.24.0 for the plugin manifest API, which is what lets their panel and their First mode register as one extension with one settings entry instead of two.

## Repository structure

```
ced_degoog_plugins/
├── package.json            <- Degoog Store manifest
├── plugins/
│   ├── hister-slot/        <- plugin manifest + slot + interceptor + skip route
│   ├── karakeep-slot/      <- same shape, for Karakeep
│   ├── logotype/
│   └── ohmyclean/
└── engines/
    ├── hister-engine/
    └── karakeep-engine/
```

## License

MIT
