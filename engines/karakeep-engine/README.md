# Karakeep Engine

Registers [Karakeep](https://karakeep.app), your self-hosted bookmark manager, as a native Degoog search engine.

Results appear in a dedicated **Karakeep** tab and, by default, also among the web results. The `!karakeep` bang shortcut jumps straight to them.

## Requirements

- Degoog **0.21.0** or newer
- A running [Karakeep](https://github.com/karakeep-app/karakeep) instance with Meilisearch enabled
- A Karakeep API key

## Settings

In **Settings > Engines > Karakeep**.

| Setting | Description | Default |
|---|---|---|
| Karakeep instance URL | Base URL, for example `https://karakeep.example.com`, no trailing slash | *(required)* |
| API key | From **Karakeep > Settings > API Keys** | *(required)* |
| Results per search | 1 to 50 | `20` |

## Choosing which tabs it feeds

The engine declares `type = ["web", "karakeep"]`, so out of the box it contributes both to web results and to its own tab.

To change that, use Degoog's **built-in engine type override** in the engine settings rather than editing the plugin. Set it to `karakeep` for the dedicated tab only, or `web` for web results only. Degoog reads `type` once at import time, so a value that changes at runtime would have no effect.

## Usage

- **Tab.** Pick the **Karakeep** tab on any results page to search only your bookmarks.
- **Bang.** Type `!karakeep docker compose` in the search bar.

## Related

Install the **Karakeep** plugin alongside this engine for the "In your bookmarks" panel and Karakeep First mode, which routes searches to this engine's tab automatically when your bookmarks already answer the query.

Note that the engine and the plugin are configured separately: Degoog keeps engines and plugins in two different registries, so the instance URL and API key have to be entered in both places.

## Upgrading from 1.x

The `Visible in` setting is gone. It relied on reassigning the exported `type`, which Degoog never re-reads, so it did not actually work. Degoog's native type override replaces it and does work.

The old note about the `karakeep` tab not resolving is obsolete: the `tab` export was replaced by the `type` array in 1.7.0 and the tab works.
