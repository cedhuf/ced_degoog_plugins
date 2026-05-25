# Hister Slot

Integrates [Hister](https://github.com/asciimoo/hister) — your personal full-text web history search engine — directly into Degoog search results.

When you search, a **"In your index"** panel appears alongside regular results, showing pages you have previously visited that match your query. Click any result to open the page, or **View all →** to open your full Hister search.

![Hister Slot screenshot](screenshots/screenshot.png)

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
| **Pre-fetch mode** | Pre-fetch Hister in parallel so the panel renders instantly from cache | ❌ disabled |
| **Badge threshold** | Minimum results to show the count badge in the panel (1–50) | `10` |

## Pre-fetch mode

When enabled, every search triggers a Hister fetch in parallel with the other engines. The slot panel reads from the shared cache and appears immediately without waiting for a second round-trip. When the result count meets the badge threshold, a small counter badge is shown next to the "View all" link.

> **Note:** The Degoog interceptor API (`InterceptorResult = { query }`) cannot stop other engines from running. Truly blocking them would require a core Degoog change. Use the **`!hister`** bang shortcut or the dedicated **Hister tab** (via Hister Engine) to search only your history.

## Authentication

If your Hister instance requires a login, generate your Access Token from **Hister → Profile → Access Token** and paste it in the **API Key** field. The token is stored securely and never sent to the browser.

## Testing the connection

Once you save the URL, a **Test** link appears in the URL field description inside Settings → Plugins → Hister Slot. Click it to run a live connectivity check and see the raw response from your Hister instance.
