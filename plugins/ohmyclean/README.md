# OhMyClean

Selectively remove or replace Degoog UI elements across all pages. No HTML injected into results — a `<style>` block is added to `<head>` on every page by the companion script.

## Settings

| Setting | Options | Default |
|---|---|---|
| **Hide home page footer** | toggle | off |
| **Hide settings gear icon** | toggle | off |
| **Hide logo / wordmark** | toggle | off |
| **Search buttons** | `default` · `hide-lucky` · `arrow` | `default` |

### Search button modes

| Mode | Effect |
|---|---|
| `default` | Both "Search" and "I'm Feeling Lucky" buttons visible |
| `hide-lucky` | "I'm Feeling Lucky" removed, Search button kept |
| `arrow` | Both buttons hidden — a minimal `→` arrow appears inside the search bar |

> **Note:** If you hide the settings gear icon, your Degoog settings remain fully accessible at `yourdomain.tld/settings`.

> **Note:** "Hide logo / wordmark" only affects the [Logotype](https://github.com/cedhuf/ced_degoog_plugins/tree/main/plugins/logotype) plugin's custom wordmark — it has no effect if Logotype is not installed.

## How it works

OhMyClean loads a tiny `script.js` on every page (home, results, settings). It fetches the current settings from its own `/config` route, caches the result in `sessionStorage` (zero flash-of-unstyled-content on repeat loads), then injects a `<style>` element directly into `<head>` with the computed CSS rules.

The settings gear is hidden on both the home page (`#nav-settings-top`) and the results page (`#nav-settings-results`). No HTML is ever rendered in the search results slot. No external requests.
