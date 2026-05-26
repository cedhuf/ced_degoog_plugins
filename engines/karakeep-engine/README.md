# Karakeep Engine

Registers [Karakeep](https://karakeep.app) as a native Degoog search engine, enabling full-text bookmark search via the `!karakeep` bang shortcut.

## Requirements

- Degoog ≥ 0.17.0
- A running [Karakeep](https://github.com/karakeep-app/karakeep) instance with Meilisearch enabled
- A Karakeep API key (Settings → API Keys)

## Usage

Search your bookmarks from any Degoog search box:

```
!karakeep docker compose
```

Results are fetched from your Karakeep instance's full-text search API and displayed alongside or instead of web results, depending on how Degoog handles bang commands.

## Settings

| Setting | Description | Default |
|---|---|---|
| **Karakeep Instance URL** | Base URL, e.g. `https://karakeep.example.com` | *(required)* |
| **API Key** | From Karakeep → Settings → API Keys | *(required)* |
| **Results per search** | Number of bookmarks returned (1–50) | `20` |

## Note on the Karakeep tab

This engine also exports a `tab` declaration (`engineType: "karakeep"`). The tab may not display results correctly in the current Degoog version due to a known issue with custom engine type resolution. The `!karakeep` bang shortcut works reliably regardless.

Install the **Karakeep Slot** plugin alongside this engine if you want bookmark results to appear inline with every search.
