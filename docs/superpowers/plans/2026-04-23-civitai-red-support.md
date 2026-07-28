# Civitai.red Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `civitai.red` support to the extension while preserving current `civitai.com` behavior.

**Architecture:** Introduce a shared domain helper for supported Civitai origins and deterministic origin selection. Update the manifest, background worker, options page, and docs to use that helper so requests follow the active host when possible and fall back safely when not.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, Node.js built-in test runner

---

## Chunk 1: Domain Resolution

### Task 1: Add a failing test for origin resolution

**Files:**
- Create: `tests/domain-config.test.js`
- Test: `tests/domain-config.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePreferredOrigin } = require('../domain-config.js');

test('uses the sender tab origin when it is supported', () => {
  assert.equal(resolvePreferredOrigin({ senderUrl: 'https://civitai.red/images/1' }), 'https://civitai.red');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/domain-config.test.js`
Expected: FAIL because `domain-config.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
function resolvePreferredOrigin({ senderUrl }) {
  return senderUrl.startsWith('https://civitai.red') ? 'https://civitai.red' : 'https://civitai.com';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/domain-config.test.js`
Expected: PASS for the initial sender-origin case.

### Task 2: Expand the helper to cover all fallback cases

**Files:**
- Create: `domain-config.js`
- Modify: `tests/domain-config.test.js`
- Test: `tests/domain-config.test.js`

- [ ] **Step 1: Add tests for supported patterns and fallback order**

```js
test('falls back to stored origin when no supported tabs are available', () => {
  assert.equal(
    resolvePreferredOrigin({ storedOrigin: 'https://civitai.red' }),
    'https://civitai.red'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/domain-config.test.js`
Expected: FAIL because the helper is still incomplete.

- [ ] **Step 3: Implement the pure helper**

```js
const SUPPORTED_CIVITAI_ORIGINS = ['https://civitai.com', 'https://civitai.red'];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/domain-config.test.js`
Expected: PASS with all helper tests green.

## Chunk 2: Extension Integration

### Task 3: Wire the extension to use the helper

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`
- Modify: `options.js`
- Modify: `options.html`

- [ ] **Step 1: Update host permissions and content script matches**

```json
"host_permissions": [
  "https://civitai.com/*",
  "https://civitai.red/*"
]
```

- [ ] **Step 2: Resolve the background API base per request**

Run: use `sender.tab.url`, open supported tabs, and stored origin to select the API base.

- [ ] **Step 3: Update option-page tab notifications**

Run: query both supported match patterns before broadcasting `collectionsUpdated`.

- [ ] **Step 4: Run syntax checks**

Run:
- `node --check background.js`
- `node --check options.js`
- `node --check domain-config.js`

Expected: all commands exit 0.

### Task 4: Update user-facing documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document both supported domains**

Run: update installation, usage, troubleshooting, and permissions text.

- [ ] **Step 2: Verify docs reflect the implementation**

Run: review the modified README against the code changes.
