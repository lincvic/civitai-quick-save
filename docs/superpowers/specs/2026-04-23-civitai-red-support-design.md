# Civitai.red Support Design

## Goal

Extend the Chrome extension so it works on both `civitai.com` and `civitai.red` without changing the current quick-save behavior on `civitai.com`.

## Architecture

The extension should treat the active Civitai host as the API authority instead of relying on a single hard-coded base URL. A small shared domain helper will define supported origins and the selection logic for choosing the best API base from a sender tab, open tabs, or the last known working origin.

## Components

- `manifest.json`
  Add `https://civitai.red/*` to the extension host permissions and content script matches.
- `domain-config.js`
  New shared helper containing supported origins, tab query patterns, and pure origin-resolution helpers.
- `background.js`
  Resolve the API base per request instead of using a global constant. Persist the last successfully selected Civitai origin so option-page actions can still work when they are not sent from a tab.
- `options.js`
  Notify content scripts on both supported Civitai domains after collections refresh.
- `options.html`
  Load the shared domain helper before `options.js` and update help text to mention both supported domains.
- `README.md`
  Document support for both `civitai.com` and `civitai.red`.

## Data Flow

1. A content script on either supported domain sends a message to the background worker.
2. The background worker resolves the best API origin in this order:
   - sender tab origin, if it is a supported Civitai host
   - active supported tab origin
   - any open supported tab origin
   - last stored supported origin
   - default fallback `https://civitai.com`
3. The background worker calls the matching `/api/trpc/collection.*` endpoint on that origin.
4. When the options page refreshes collections, it notifies content scripts on both supported domains so buttons stay in sync.

## Error Handling

- Ignore invalid or unsupported URLs during origin resolution.
- Keep the current fetch error handling for unauthorized and failed API responses.
- Use a conservative default fallback to `https://civitai.com` when no supported origin can be inferred.

## Testing

- Add a Node.js unit test for the shared domain helper covering:
  - both supported match patterns
  - sender-origin preference
  - active/open tab fallback
  - stored-origin fallback
  - default fallback for unsupported input
- Run fresh syntax checks on changed JavaScript files before completion.
