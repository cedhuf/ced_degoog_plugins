# Hister Slot

Integrates [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — directly into Degoog search results.

When you search, a **"In your index"** panel appears alongside regular results, showing pages you have previously visited that match your query. Click any result to open the page, or **View all →** to open your full Hister search.

![Hister Slot screenshot](screenshots/screenshot.png)

> **⚠️ Known issue — Hister First mode is not functional**
>
> The "Hister First" feature (automatically switching to Hister-only results when your history has enough matches) is **disabled in v2.4.0** and must not be enabled. Activating it causes an infinite redirect loop in the current Degoog version. The plugin's core "In your index" panel works perfectly — only the automatic engine-switching is affected.
>
> See [issue #TBD](https://github.com/cedhuf/ced_degoog_plugins/issues) for details and progress.

## Requirements

- Degoog ≥ 0.17.0
- A running [Hister](https://github.com/asciimoo/hister) instance

## Settings

| Setting | Description | Default |
|---|---|---|
| **Hister Instance URL** | Base URL of your Hister instance, e.g. `https://hister.example.com` | *(required)* |
| **API Key** | Your Hister Access Token — find it under **Hister → Profile → Access Token** | *(optional)* |
| **Show panel** | Enable or disable the "In your index" panel | ✅ enabled |
| **Panel position** | `above-results` · `below-results` · `knowledge-panel` · `above-sidebar` | `above-results` |
| **Results to show** | How many Hister results to display in the panel (1–20) | `5` |

## Authentication

If your Hister instance requires a login, generate your Access Token from **Hister → Profile → Access Token** and paste it in the **API Key** field. The token is stored securely and never sent to the browser.

## Testing the connection

Once you save the URL, a **Test** link appears in the URL field description inside Settings → Plugins → Hister Slot. Click it to run a live connectivity check and see the raw response from your Hister instance.
