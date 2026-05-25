# Hister Engine

Registers [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — as a native Degoog search engine.

Results from your Hister index appear in a **dedicated tab** alongside Web, Images, and other engines. You can also trigger it directly from the search bar using the **`!hister`** bang shortcut.

![Hister Engine screenshot](screenshots/screenshot.png)

## Requirements

- Degoog ≥ 0.17.0
- A running [Hister](https://github.com/asciimoo/hister) instance

## Settings

| Setting | Description | Default |
|---|---|---|
| **Hister Instance URL** | Base URL of your Hister instance, e.g. `https://hister.example.com` | *(required)* |
| **API Key** | Your Hister Access Token — find it under **Hister → Profile → Access Token** | *(optional)* |
| **Hister First mode** | Route searches exclusively to Hister when your history has enough results | ❌ disabled |
| **Minimum results to activate** | How many Hister results are needed to skip other engines (1–50) | `10` |

## Usage

- **Tab search** — select the **Hister** tab on any results page to search only your history index.
- **Bang shortcut** — type `!hister <query>` in the search bar to jump directly to Hister results.

## Hister First

When **Hister First** is enabled, every search pre-fetches your Hister index in parallel. If the result count meets the threshold, the query is routed exclusively to Hister — no search query is sent to external engines.

The Hister Slot plugin (if installed) will display a **"Search all engines →"** link that lets you run a full search on demand for that query.

## Authentication

If your Hister instance requires a login, generate your Access Token from **Hister → Profile → Access Token** and paste it in the **API Key** field. The token is stored securely and never sent to the browser.
