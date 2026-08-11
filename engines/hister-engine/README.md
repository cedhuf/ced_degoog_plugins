# Hister Engine

Registers [Hister](https://github.com/asciimoo/hister), your personal full-text web history search engine, as a native Degoog search engine.

![Hister Engine screenshot](screenshots/screenshot.png)

Results appear in a dedicated **Hister** tab and, by default, also among the web results. The `!hister` bang shortcut jumps straight to them.

## Requirements

- Degoog **0.21.0** or newer
- A running [Hister](https://github.com/asciimoo/hister) instance

## Settings

In **Settings > Engines > Hister**.

| Setting | Description | Default |
|---|---|---|
| Hister instance URL | Base URL, for example `https://hister.example.com`, no trailing slash | *(required)* |
| API key | Your Access Token, from **Hister > Profile > Access Token**. Only needed if your instance uses authentication | *(optional)* |

## Choosing which tabs it feeds

The engine declares `type = ["web", "hister"]`, so out of the box it contributes both to web results and to its own tab.

To change that, use Degoog's **built-in engine type override** in the engine settings rather than editing the plugin. Set it to `hister` for the dedicated tab only, or `web` for web results only. Degoog reads `type` once at import time, so a value that changes at runtime would have no effect.

## Usage

- **Tab.** Pick the **Hister** tab on any results page to search only your history index.
- **Bang.** Type `!hister <query>` in the search bar.

## Related

Install the **Hister** plugin alongside this engine for the "In your index" panel and Hister First mode, which routes searches to this engine's tab automatically when your history already answers the query.

## Upgrading from 1.x

The `Visible in` setting is gone. It relied on reassigning the exported `type`, which Degoog never re-reads, so it did not actually work. Degoog's native type override replaces it and does work.
