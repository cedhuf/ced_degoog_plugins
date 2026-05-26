# Karakeep Slot

Integrates [Karakeep](https://karakeep.app) — your self-hosted bookmark manager — directly into Degoog search results.

When you search, an **"In your bookmarks"** panel appears alongside regular results, showing bookmarks you have saved that match your query. Results include AI-generated summaries, tags, and favicons. Click any result to open it, or **View all →** to jump to your full Karakeep search.

## Requirements

- Degoog ≥ 0.17.0
- A running [Karakeep](https://github.com/karakeep-app/karakeep) instance
- A Karakeep API key (see below)

## Setup

1. Open your Karakeep instance → **Settings → API Keys**
2. Create a new API key and copy it
3. In Degoog → **Settings → Plugins → Karakeep Slot**, enter your instance URL and paste the API key

## Settings

| Setting | Description | Default |
|---|---|---|
| **Karakeep Instance URL** | Base URL of your Karakeep instance, e.g. `https://karakeep.example.com` | *(required)* |
| **API Key** | Your Karakeep API key from Settings → API Keys | *(required)* |
| **Show panel** | Enable or disable the "In your bookmarks" panel | ✅ enabled |
| **Panel position** | `above-results` · `below-results` · `knowledge-panel` · `above-sidebar` | `above-results` |
| **Display style** | `inline` — blends with results · `card` — compact bordered panel | `inline` |
| **Detail level** | `title` — link only · `snippet` — title + AI summary · `full` — title + URL + excerpt + tags | `snippet` |
| **Results to show** | How many Karakeep bookmarks to display in the panel (1–20) | `5` |

## What gets shown

The panel displays your Karakeep bookmarks that match the search query via full-text search (titles, descriptions, content, and notes are all searched). For each result:

- **Title** — links to the original page
- **Favicon** — the site's icon (when available)
- **Snippet** — AI-generated summary if available, otherwise the description or a content excerpt
- **Tags** — AI and manually assigned tags (in `full` detail mode)

## Supported bookmark types

| Type | What's shown |
|---|---|
| **Link** | URL, title, description, favicon, summary |
| **Text note** | Title, text content |
| **Asset** (PDF / image) | Filename, source URL if available |
