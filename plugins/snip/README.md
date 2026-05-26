# Snip

Selectively remove or replace home page UI elements in Degoog. No scripts injected into search results — purely CSS classes applied to `<html>`.

## Settings

| Setting | Options | Default |
|---|---|---|
| **Hide home page footer** | toggle | off |
| **Hide settings gear icon** | toggle | off |
| **Search buttons** | `default` · `hide-lucky` · `arrow` | `default` |

### Button modes

| Mode | Effect |
|---|---|
| `default` | Both "Search" and "I'm Feeling Lucky" buttons visible |
| `hide-lucky` | "I'm Feeling Lucky" removed, Search button kept |
| `arrow` | Both buttons hidden — a minimal `→` arrow appears inside the search bar instead |

## How it works

Snip loads a tiny `script.js` on every page. It fetches the current settings from its own `/config` route, caches the result in `sessionStorage` (zero flash-of-unstyled-content on repeat loads), then adds CSS classes like `snip-hide-footer` to `<html>`. The CSS in `style.css` does the actual hiding.

No HTML is injected into search result slots. No external requests.
