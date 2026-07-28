const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_CIVITAI_ORIGIN,
  SUPPORTED_CIVITAI_MATCH_PATTERNS,
  getApiBaseUrl,
  resolvePreferredOrigin,
} = require('../domain-config.js');

test('exposes match patterns for both supported domains', () => {
  assert.deepEqual(SUPPORTED_CIVITAI_MATCH_PATTERNS, [
    'https://civitai.com/*',
    'https://civitai.red/*',
  ]);
});

test('uses the sender tab origin when it is supported', () => {
  assert.equal(
    resolvePreferredOrigin({
      senderUrl: 'https://civitai.red/images/1',
      activeTabUrls: ['https://civitai.com/images/2'],
      storedOrigin: 'https://civitai.com',
    }),
    'https://civitai.red'
  );
});

test('falls back to the active supported tab origin', () => {
  assert.equal(
    resolvePreferredOrigin({
      senderUrl: 'chrome-extension://extension/options.html',
      activeTabUrls: ['https://civitai.red/posts/10'],
      openTabUrls: ['https://civitai.com/images/2'],
      storedOrigin: 'https://civitai.com',
    }),
    'https://civitai.red'
  );
});

test('falls back to any supported open tab origin', () => {
  assert.equal(
    resolvePreferredOrigin({
      senderUrl: null,
      activeTabUrls: ['https://example.com/'],
      openTabUrls: ['https://civitai.com/models/3'],
      storedOrigin: 'https://civitai.red',
    }),
    'https://civitai.com'
  );
});

test('falls back to the stored supported origin', () => {
  assert.equal(
    resolvePreferredOrigin({
      senderUrl: null,
      activeTabUrls: [],
      openTabUrls: [],
      storedOrigin: 'https://civitai.red',
    }),
    'https://civitai.red'
  );
});

test('falls back to the default origin for unsupported input', () => {
  assert.equal(
    resolvePreferredOrigin({
      senderUrl: 'https://example.com/anything',
      activeTabUrls: ['https://example.org/'],
      openTabUrls: [],
      storedOrigin: 'https://not-civitai.invalid',
    }),
    DEFAULT_CIVITAI_ORIGIN
  );
  assert.equal(getApiBaseUrl('https://example.com/anything'), DEFAULT_CIVITAI_ORIGIN);
});
