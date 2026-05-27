# Web Search Engine

Combines **Google**, **DuckDuckGo**, and **Bing** into a single Degoog search engine. Each provider can be toggled on or off independently, and results are automatically merged and deduplicated.

## Settings

| Setting | Options | Default | Description |
|---|---|---|---|
| **Enable Google** | on / off | on | Include Google in search results |
| **Google Safe Search** | off / on | off | Filter explicit content from Google |
| **Enable DuckDuckGo** | on / off | on | Include DuckDuckGo in search results |
| **DuckDuckGo Safe Search** | off / moderate / strict | off | Filter explicit content from DDG |
| **Enable Bing** | on / off | off | Include Bing in search results |
| **Bing Safe Search** | off / moderate / strict | off | Filter explicit content from Bing |
| **Merge Strategy** | interleave / append | interleave | How results from different sources are combined |

## Merge strategies

- **interleave** — results alternate between sources (Google → DDG → Bing → Google → …). Gives a balanced mix on every page.
- **append** — results are grouped by source (all Google results, then all DDG, then all Bing). Useful when you want to compare sources.

Duplicate URLs are always removed regardless of the strategy chosen.

## Bang shortcut

Type `!web <query>` in the search bar to force a search through this engine.

## Requirements

- Degoog ≥ 0.17.0
- `cheerio` — already bundled with degoog (no extra install needed)
