# Hister

Integrates [Hister](https://github.com/asciimoo/hister), your personal full-text web history search engine, directly into Degoog.

![Hister screenshot](screenshots/screenshot.png)

The plugin does two things, from one settings panel:

- **In your index panel.** Pages you have already visited that match your query, shown alongside the regular results. Click a result to reopen the page, or **View all** to continue in Hister.
- **Hister First.** Optional. When your history already answers the query, the search is routed straight to the Hister tab instead of the web engines. A toast at the bottom of the page always offers **Search all engines** to fall back for that one search.

## Requirements

- Degoog **0.24.0** or newer
- A running [Hister](https://github.com/asciimoo/hister) instance

Degoog 0.24.0 is what lets the panel and Hister First register as a single plugin with one configuration entry. On older versions they show up as two unrelated extensions.

## Settings

Settings live in **Settings > Plugins > Hister**.

### Connection

| Setting | Description | Default |
|---|---|---|
| Hister instance URL | Base URL, for example `https://hister.example.com`, no trailing slash | *(required)* |
| Access token | From **Hister > Profile > Access Token**. Only needed if your instance uses authentication | *(optional)* |

The token is stored server-side and never reaches the browser: the plugin runs with `isClientExposed: false`, so every request to Hister goes through the Degoog server.

### Panel

| Setting | Description | Default |
|---|---|---|
| Show the "In your index" panel | Turn the panel off while keeping Hister First | enabled |
| Position | Where the panel renders, including full width above the results | `above-results` |
| Display style | `inline` blends with the native results, `card` is a compact bordered panel | `inline` |
| Detail level | `title`, `snippet` (adds an excerpt), or `full` (adds the URL) | `full` |
| Results in the panel | 1 to 20 | `5` |

### Hister First

| Setting | Description | Default |
|---|---|---|
| Hister First | Route the search to the Hister tab when your history has enough matches | disabled |
| Minimum results to trigger | 1 to 50, counted before deduplication | `10` |

For the redirect to land somewhere, install the companion **Hister Engine**, which is what provides the `hister` tab.

## How Hister First works

The interceptor pre-fetches your Hister index before the search runs, with a hard 2 second cap so a slow or unreachable instance can never stall Degoog. If the match count clears the threshold it returns `{ overrides: { searchType: "hister" } }` and Degoog routes the search server-side.

That pre-fetch is cached for 30 seconds and reused by the panel, so a search costs one Hister round-trip, not two.

Clicking **Search all engines** hits the plugin's `/skip` route, which marks the query as pass-through for 60 seconds and clears the cached activation flag, then redirects to a normal search.

## Upgrading from 2.x

3.0.0 moves the plugin onto Degoog's plugin manifest API. The settings are stored under a new id, so **you will need to re-enter your instance URL and token once**. The old `Panel position` setting is replaced by Degoog's native position selector, and the panel and Hister First now share a single card in the extension list instead of appearing twice.
