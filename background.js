// Civitai Quick Save Collection - Background Service Worker

const CIVITAI_BASE_URL = 'https://civitai.com';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Store for collections cache
let collectionsCache = {
  data: null,
  timestamp: 0
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Civitai Quick Save Collection extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getCollections') {
    handleGetCollections(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'saveToCollection') {
    handleSaveToCollection(message, sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'refreshCollections') {
    handleRefreshCollections(sendResponse);
    return true;
  }
  
  if (message.action === 'removeFromCollection') {
    handleRemoveFromCollection(message, sendResponse);
    return true;
  }
});

// Fetch user's collections from Civitai
async function fetchCollections() {
  try {
    // The endpoint is collection.getAllUser - a protected procedure
    // It requires the user to be logged in (session cookie)
    // Input schema: getAllUserCollectionsInputSchema (all fields optional)
    const input = {
      json: {
        contributingOnly: false  // Get all collections, not just contributing
      }
    };
    
    const collectionsResponse = await fetch(
      `${CIVITAI_BASE_URL}/api/trpc/collection.getAllUser?input=${encodeURIComponent(JSON.stringify(input))}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!collectionsResponse.ok) {
      const errorText = await collectionsResponse.text();
      console.error('Collections API error:', collectionsResponse.status, errorText);
      
      if (collectionsResponse.status === 401) {
        throw new Error('Not logged in. Please log in to Civitai first.');
      }
      throw new Error(`Failed to fetch collections: ${collectionsResponse.status}`);
    }
    
    const collectionsData = await collectionsResponse.json();
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
async function handleGetCollections(sendResponse) {
  try {
    // Check cache first
    const now = Date.now();
    if (collectionsCache.data && (now - collectionsCache.timestamp) < CACHE_DURATION) {
      sendResponse({ success: true, collections: collectionsCache.data });
      return;
    }
    
    // Also check storage for persisted cache
    const stored = await chrome.storage.local.get(['collections', 'collectionsTimestamp']);
    if (stored.collections && stored.collectionsTimestamp && (now - stored.collectionsTimestamp) < CACHE_DURATION) {
      collectionsCache.data = stored.collections;
      collectionsCache.timestamp = stored.collectionsTimestamp;
      sendResponse({ success: true, collections: stored.collections });
      return;
    }
    
    // Fetch fresh collections
    const collections = await fetchCollections();
    
    // Update cache
    collectionsCache.data = collections;
    collectionsCache.timestamp = now;
    
    // Persist to storage
    await chrome.storage.local.set({
      collections: collections,
      collectionsTimestamp: now
    });
    
    sendResponse({ success: true, collections });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle refresh collections request
async function handleRefreshCollections(sendResponse) {
  try {
    // Clear cache
    collectionsCache.data = null;
    collectionsCache.timestamp = 0;
    await chrome.storage.local.remove(['collections', 'collectionsTimestamp']);
    
    // Fetch fresh collections
    const collections = await fetchCollections();
    
    // Update cache
    const now = Date.now();
    collectionsCache.data = collections;
    collectionsCache.timestamp = now;
    
    // Persist to storage
    await chrome.storage.local.set({
      collections: collections,
      collectionsTimestamp: now
    });
    
    sendResponse({ success: true, collections });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle save to collection request
async function handleSaveToCollection(message, sendResponse) {
  const { collectionId, itemId, itemType } = message;
  
  try {
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
    
    const response = await fetch(`${CIVITAI_BASE_URL}/api/trpc/collection.saveItem`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(input)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Save item API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('Not logged in. Please log in to Civitai first.');
      }
      throw new Error(`Failed to save: ${response.status}`);
    }
    
    const result = await response.json();
    sendResponse({ success: true, result });
    
  } catch (error) {
    console.error('Error saving to collection:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle remove from collection request
async function handleRemoveFromCollection(message, sendResponse) {
  const { collectionId, itemId } = message;
  
  try {
    // The endpoint is collection.removeFromCollection
    // Input schema: removeCollectionItemInput = { collectionId, itemId }
    const input = {
      json: {
        collectionId: parseInt(collectionId),
        itemId: parseInt(itemId)
      }
    };
    
    const response = await fetch(`${CIVITAI_BASE_URL}/api/trpc/collection.removeFromCollection`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(input)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Remove item API error:', response.status, errorText);
      throw new Error(`Failed to remove: ${response.status}`);
    }
    
    const result = await response.json();
    sendResponse({ success: true, result });
    
  } catch (error) {
    console.error('Error removing from collection:', error);
    sendResponse({ success: false, error: error.message });
  }
}
