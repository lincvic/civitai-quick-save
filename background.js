// Civitai Quick Save Collection - Background Service Worker

importScripts('domain-config.js');

const {
  DEFAULT_CIVITAI_ORIGIN,
  SUPPORTED_CIVITAI_MATCH_PATTERNS,
  normalizeSupportedOrigin,
  resolvePreferredOrigin,
} = globalThis.CivitaiDomainConfig;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const API_PROXY_ACTION = 'cqsApiRequest';
const LAST_USED_ORIGIN_KEY = 'lastUsedApiOrigin';
const COLLECTIONS_BY_ORIGIN_KEY = 'collectionsByOrigin';
const COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY = 'collectionsTimestampsByOrigin';

// Store for collections cache
let collectionsCache = {};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Civitai Quick Save Collection extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCollections') {
    handleGetCollections(sender, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'saveToCollection') {
    handleSaveToCollection(message, sender, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'refreshCollections') {
    handleRefreshCollections(sender, sendResponse);
    return true;
  }
  
  if (message.action === 'removeFromCollection') {
    handleRemoveFromCollection(message, sender, sendResponse);
    return true;
  }
});

function getCacheEntry(origin) {
  return collectionsCache[origin] || null;
}

function setCacheEntry(origin, collections, timestamp) {
  collectionsCache[origin] = {
    data: collections,
    timestamp
  };
}

async function persistLastUsedOrigin(origin) {
  if (!origin) {
    return;
  }

  await chrome.storage.local.set({ [LAST_USED_ORIGIN_KEY]: origin });
}

async function resolveApiContext(sender) {
  const [activeTabs, openTabs, stored] = await Promise.all([
    chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
      url: SUPPORTED_CIVITAI_MATCH_PATTERNS
    }),
    chrome.tabs.query({
      url: SUPPORTED_CIVITAI_MATCH_PATTERNS
    }),
    chrome.storage.local.get([LAST_USED_ORIGIN_KEY])
  ]);

  const origin = resolvePreferredOrigin({
    senderUrl: sender?.tab?.url || sender?.url || null,
    activeTabUrls: activeTabs.map((tab) => tab.url).filter(Boolean),
    openTabUrls: openTabs.map((tab) => tab.url).filter(Boolean),
    storedOrigin: stored[LAST_USED_ORIGIN_KEY],
    fallbackOrigin: DEFAULT_CIVITAI_ORIGIN
  });

  const matchingTab = [sender?.tab, ...activeTabs, ...openTabs].find((tab) =>
    Number.isInteger(tab?.id) && normalizeSupportedOrigin(tab.url) === origin
  );

  await persistLastUsedOrigin(origin);
  return {
    origin,
    tabId: matchingTab?.id ?? null
  };
}

async function requestCivitaiApi(apiContext, path, options = {}) {
  if (!path.startsWith('/api/trpc/collection.')) {
    throw new Error('Blocked unsupported Civitai API path.');
  }

  let proxyError = null;

  if (apiContext.tabId !== null) {
    try {
      const proxyResult = await chrome.tabs.sendMessage(apiContext.tabId, {
        action: API_PROXY_ACTION,
        request: {
          path,
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body
        }
      });

      if (!proxyResult?.success || !proxyResult.response) {
        throw new Error(proxyResult?.error || 'The Civitai tab did not return a response.');
      }

      return {
        ...proxyResult.response,
        transport: 'site-tab'
      };
    } catch (error) {
      proxyError = error;
      console.warn(
        `Civitai API tab proxy unavailable for ${apiContext.origin}; falling back to the service worker.`,
        error
      );
    }
  }

  const response = await fetch(`${apiContext.origin}${path}`, {
    ...options,
    credentials: 'include'
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
    transport: 'service-worker',
    proxyError: proxyError?.message || null
  };
}

function parseApiJson(response, operation) {
  try {
    return response.body ? JSON.parse(response.body) : null;
  } catch (error) {
    throw new Error(`${operation} returned an invalid response.`);
  }
}

function createApiError(operation, response, apiContext) {
  if (response.status === 401) {
    if (response.transport === 'service-worker') {
      return new Error(
        `Civitai could not access your ${apiContext.origin} session. ` +
        'Open or reload that site in a tab, then try again.'
      );
    }

    return new Error(
      `Your session on ${apiContext.origin} was rejected. Reload the site or sign in again.`
    );
  }

  return new Error(`${operation} failed: ${response.status}`);
}

// Fetch user's collections from Civitai
async function fetchCollections(apiContext) {
  try {
    // The endpoint is collection.getAllUser - a protected procedure
    // It requires the user to be logged in (session cookie)
    // Input schema: getAllUserCollectionsInputSchema (all fields optional)
    const input = {
      json: {
        contributingOnly: false  // Get all collections, not just contributing
      }
    };
    
    const path =
      `/api/trpc/collection.getAllUser?input=${encodeURIComponent(JSON.stringify(input))}`;
    const collectionsResponse = await requestCivitaiApi(
      apiContext,
      path,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!collectionsResponse.ok) {
      console.error(
        'Collections API error:',
        collectionsResponse.status,
        collectionsResponse.body
      );
      
      throw createApiError('Fetching collections', collectionsResponse, apiContext);
    }
    
    const collectionsData = parseApiJson(collectionsResponse, 'Fetching collections');
    return parseCollectionsResponse(collectionsData);
    
  } catch (error) {
    console.error('Error fetching collections:', error);
    throw error;
  }
}

// Parse collections response (handles trpc response format)
function parseCollectionsResponse(data) {
  try {
    // trpc responses are wrapped in result.data.json
    if (data.result?.data?.json) {
      const collections = data.result.data.json;
      // Ensure it's an array
      if (Array.isArray(collections)) {
        return collections.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          itemCount: c._count?.items || c.itemCount || 0
        }));
      }
      return [];
    }
    // Direct array response
    if (Array.isArray(data)) {
      return data.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        itemCount: c._count?.items || c.itemCount || 0
      }));
    }
    // Nested in items
    if (data.items && Array.isArray(data.items)) {
      return data.items.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        itemCount: c._count?.items || c.itemCount || 0
      }));
    }
    console.warn('Unexpected collections response format:', data);
    return [];
  } catch (e) {
    console.error('Error parsing collections:', e);
    return [];
  }
}

// Handle get collections request
async function handleGetCollections(sender, sendResponse) {
  try {
    const apiContext = await resolveApiContext(sender);
    const apiBaseUrl = apiContext.origin;

    // Check cache first
    const now = Date.now();
    const cacheEntry = getCacheEntry(apiBaseUrl);
    if (cacheEntry && (now - cacheEntry.timestamp) < CACHE_DURATION) {
      sendResponse({ success: true, collections: cacheEntry.data });
      return;
    }
    
    // Also check storage for persisted cache
    const stored = await chrome.storage.local.get([
      COLLECTIONS_BY_ORIGIN_KEY,
      COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY
    ]);
    const storedCollections = stored[COLLECTIONS_BY_ORIGIN_KEY]?.[apiBaseUrl];
    const storedTimestamp = stored[COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY]?.[apiBaseUrl];

    if (storedCollections && storedTimestamp && (now - storedTimestamp) < CACHE_DURATION) {
      setCacheEntry(apiBaseUrl, storedCollections, storedTimestamp);
      sendResponse({ success: true, collections: storedCollections });
      return;
    }
    
    // Fetch fresh collections
    const collections = await fetchCollections(apiContext);
    
    // Update cache
    setCacheEntry(apiBaseUrl, collections, now);
    
    // Persist to storage
    const collectionsByOrigin = {
      ...(stored[COLLECTIONS_BY_ORIGIN_KEY] || {}),
      [apiBaseUrl]: collections
    };
    const collectionsTimestampsByOrigin = {
      ...(stored[COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY] || {}),
      [apiBaseUrl]: now
    };

    await chrome.storage.local.set({
      [COLLECTIONS_BY_ORIGIN_KEY]: collectionsByOrigin,
      [COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY]: collectionsTimestampsByOrigin
    });
    
    sendResponse({ success: true, collections });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle refresh collections request
async function handleRefreshCollections(sender, sendResponse) {
  try {
    const apiContext = await resolveApiContext(sender);
    const apiBaseUrl = apiContext.origin;

    delete collectionsCache[apiBaseUrl];
    
    // Fetch fresh collections
    const collections = await fetchCollections(apiContext);
    
    // Update cache
    const now = Date.now();
    setCacheEntry(apiBaseUrl, collections, now);
    
    // Persist to storage
    const stored = await chrome.storage.local.get([
      COLLECTIONS_BY_ORIGIN_KEY,
      COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY
    ]);
    const collectionsByOrigin = {
      ...(stored[COLLECTIONS_BY_ORIGIN_KEY] || {}),
      [apiBaseUrl]: collections
    };
    const collectionsTimestampsByOrigin = {
      ...(stored[COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY] || {}),
      [apiBaseUrl]: now
    };

    await chrome.storage.local.set({
      [COLLECTIONS_BY_ORIGIN_KEY]: collectionsByOrigin,
      [COLLECTIONS_TIMESTAMPS_BY_ORIGIN_KEY]: collectionsTimestampsByOrigin
    });
    
    sendResponse({ success: true, collections });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle save to collection request
async function handleSaveToCollection(message, sender, sendResponse) {
  const { collectionId, itemId, itemType } = message;
  
  try {
    const apiContext = await resolveApiContext(sender);

    // The endpoint is collection.saveItem
    // Input schema: saveCollectionItemInputSchema
    // Requires one of: articleId, postId, modelId, imageId
    // And collections array with collectionId
    
    const input = {
      json: {
        collections: [
          { collectionId: parseInt(collectionId) }
        ]
      }
    };
    
    // Add the correct ID field based on item type
    const itemIdNum = parseInt(itemId);
    switch (itemType) {
      case 'image':
        input.json.imageId = itemIdNum;
        break;
      case 'post':
        input.json.postId = itemIdNum;
        break;
      case 'model':
        input.json.modelId = itemIdNum;
        break;
      case 'article':
        input.json.articleId = itemIdNum;
        break;
      default:
        // Default to image if type unknown
        input.json.imageId = itemIdNum;
    }
    
    const response = await requestCivitaiApi(apiContext, '/api/trpc/collection.saveItem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(input)
    });
    
    if (!response.ok) {
      console.error('Save item API error:', response.status, response.body);
      
      throw createApiError('Saving item', response, apiContext);
    }
    
    const result = parseApiJson(response, 'Saving item');
    sendResponse({ success: true, result });
    
  } catch (error) {
    console.error('Error saving to collection:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle remove from collection request
async function handleRemoveFromCollection(message, sender, sendResponse) {
  const { collectionId, itemId } = message;
  
  try {
    const apiContext = await resolveApiContext(sender);

    // The endpoint is collection.removeFromCollection
    // Input schema: removeCollectionItemInput = { collectionId, itemId }
    const input = {
      json: {
        collectionId: parseInt(collectionId),
        itemId: parseInt(itemId)
      }
    };
    
    const response = await requestCivitaiApi(
      apiContext,
      '/api/trpc/collection.removeFromCollection',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(input)
      }
    );
    
    if (!response.ok) {
      console.error('Remove item API error:', response.status, response.body);
      throw createApiError('Removing item', response, apiContext);
    }
    
    const result = parseApiJson(response, 'Removing item');
    sendResponse({ success: true, result });
    
  } catch (error) {
    console.error('Error removing from collection:', error);
    sendResponse({ success: false, error: error.message });
  }
}
