const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function createBackgroundWorker({ activeTabs = [], openTabs = [], proxyResponse, fetchImpl }) {
  let messageListener;
  const proxyCalls = [];
  const storage = {};
  const context = vm.createContext({
    URL,
    console: {
      log() {},
      warn() {},
      error() {}
    }
  });

  context.globalThis = context;
  context.chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    },
    tabs: {
      async query(query) {
        return query.active ? activeTabs : openTabs;
      },
      async sendMessage(tabId, message) {
        proxyCalls.push({ tabId, message });
        return proxyResponse;
      }
    },
    storage: {
      local: {
        async get(keys) {
          const requestedKeys = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requestedKeys
              .filter((key) => Object.hasOwn(storage, key))
              .map((key) => [key, storage[key]])
          );
        },
        async set(values) {
          Object.assign(storage, values);
        }
      }
    }
  };
  context.fetch = fetchImpl || (() => {
    throw new Error('The service-worker fetch should not be used.');
  });
  context.importScripts = (...filenames) => {
    for (const filename of filenames) {
      const source = fs.readFileSync(path.join(projectRoot, filename), 'utf8');
      vm.runInContext(source, context, { filename });
    }
  };

  const source = fs.readFileSync(path.join(projectRoot, 'background.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'background.js' });

  return {
    proxyCalls,
    storage,
    send(message, sender) {
      return new Promise((resolve) => {
        const keepsChannelOpen = messageListener(message, sender, resolve);
        assert.equal(keepsChannelOpen, true);
      });
    }
  };
}

function createContentScript({ fetchImpl }) {
  let messageListener;
  const context = vm.createContext({
    URL,
    fetch: fetchImpl,
    setTimeout() {},
    clearTimeout() {},
    requestAnimationFrame() {},
    location: { href: 'https://civitai.red/images/123' },
    window: { location: { origin: 'https://civitai.red' } },
    document: {
      readyState: 'loading',
      addEventListener() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      }
    }
  });

  const source = fs.readFileSync(path.join(projectRoot, 'content.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'content.js' });

  return {
    send(message) {
      return new Promise((resolve) => {
        const keepsChannelOpen = messageListener(message, {}, resolve);
        assert.equal(keepsChannelOpen, true);
      });
    }
  };
}

test('background routes collection requests through the sender Civitai tab', async () => {
  const apiBody = JSON.stringify({
    result: {
      data: {
        json: [
          { id: 7, name: 'Favorites', type: 'Image', _count: { items: 3 } }
        ]
      }
    }
  });
  const worker = createBackgroundWorker({
    proxyResponse: {
      success: true,
      response: { ok: true, status: 200, statusText: 'OK', body: apiBody }
    }
  });

  const response = await worker.send(
    { action: 'getCollections' },
    { tab: { id: 42, url: 'https://civitai.red/images/123' } }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    success: true,
    collections: [
      { id: 7, name: 'Favorites', type: 'Image', itemCount: 3 }
    ]
  });
  assert.equal(worker.proxyCalls.length, 1);
  assert.equal(worker.proxyCalls[0].tabId, 42);
  assert.equal(worker.proxyCalls[0].message.action, 'cqsApiRequest');
  assert.match(
    worker.proxyCalls[0].message.request.path,
    /^\/api\/trpc\/collection\.getAllUser\?/
  );
  assert.equal(worker.storage.lastUsedApiOrigin, 'https://civitai.red');
});

test('content proxy makes the API request relative to the authenticated site', async () => {
  let fetchCall;
  const contentScript = createContentScript({
    async fetchImpl(url, options) {
      fetchCall = { url, options };
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async text() {
          return '{"result":{"data":{"json":[]}}}';
        }
      };
    }
  });

  const response = await contentScript.send({
    action: 'cqsApiRequest',
    request: {
      path: '/api/trpc/collection.getAllUser?input=test',
      method: 'GET',
      headers: { Accept: 'application/json' }
    }
  });

  assert.equal(fetchCall.url, '/api/trpc/collection.getAllUser?input=test');
  assert.equal(fetchCall.options.credentials, 'include');
  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    success: true,
    response: {
      ok: true,
      status: 200,
      statusText: 'OK',
      body: '{"result":{"data":{"json":[]}}}'
    }
  });
});

test('content proxy blocks API requests outside collection routes', async () => {
  let fetchCalled = false;
  const contentScript = createContentScript({
    async fetchImpl() {
      fetchCalled = true;
    }
  });

  const response = await contentScript.send({
    action: 'cqsApiRequest',
    request: {
      path: 'https://example.com/api/private',
      method: 'GET'
    }
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(JSON.parse(JSON.stringify(response)), {
    success: false,
    error: 'Blocked unsupported Civitai API request.'
  });
});
