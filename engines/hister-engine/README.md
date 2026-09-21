# Hister Engine

Registers [Hister](https://github.com/asciimoo/hister), your personal full-text web history search engine, as a native Degoog search engine.

![Hister Engine screenshot](screenshots/screenshot.png)

Results appear in a dedicated **Hister** tab and, by default, also among the web results. The `!hister` bang shortcut jumps straight to them.

## Requirements

- Degoog with engine plugin manifests (currently the `develop` branch, next release)
- The **Hister** plugin, installed automatically with the engine
- A running [Hister](https://github.com/asciimoo/hister) instance

## Settings

None of its own. The engine shares the Hister plugin's manifest id, so the instance URL and access token are entered once, on the plugin's card in **Settings > Plugins > Hister**. The engine's card keeps only Degoog's native options (type override, transport, score).

Uninstalling the plugin removes that shared settings bucket, so remove the two together.

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
