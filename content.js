// Civitai Quick Save Collection - Content Script

// Store collections data
let collections = [];
let isInitialized = false;

// More specific selectors for Civitai image/post cards
// These target the actual content cards, not generic containers
const CARD_SELECTORS = [
  // Image cards - these have specific structure with image links
  'a[href^="/images/"]',
  // Post cards
  'a[href^="/posts/"]',
  // Model cards
  'a[href^="/models/"]',
  // Article cards  
  'a[href^="/articles/"]',
].join(', ');

// Initialize the extension
async function initialize() {
  if (isInitialized) return;
  
  try {
    // Fetch collections from background
    const response = await chrome.runtime.sendMessage({ action: 'getCollections' });
    
    if (response.success) {
      collections = response.collections || [];
      isInitialized = true;
      console.log('Civitai Quick Save: Loaded', collections.length, 'collections');
      
      // Start observing and injecting buttons
      injectButtonsToExistingItems();
      startObserver();
    } else {
      console.warn('Civitai Quick Save: Could not load collections -', response.error);
      // Retry after a delay
      setTimeout(initialize, 5000);
    }
  } catch (error) {
    console.error('Civitai Quick Save: Initialization error -', error);
    setTimeout(initialize, 5000);
  }
}

// Extract item info from a link element
function extractItemInfo(linkElement) {
  const href = linkElement.getAttribute('href') || '';
  
  // Match different content types
  const imageMatch = href.match(/\/images\/(\d+)/);
  if (imageMatch) {
    return { itemId: imageMatch[1], itemType: 'image' };
  }
  
  const postMatch = href.match(/\/posts\/(\d+)/);
  if (postMatch) {
    return { itemId: postMatch[1], itemType: 'post' };
  }
  
  const modelMatch = href.match(/\/models\/(\d+)/);
  if (modelMatch) {
    return { itemId: modelMatch[1], itemType: 'model' };
  }
  
  const articleMatch = href.match(/\/articles\/(\d+)/);
  if (articleMatch) {
    return { itemId: articleMatch[1], itemType: 'article' };
  }
  
  return { itemId: null, itemType: null };
}

// Check if element is a valid card (has an image and reasonable size)
function isValidCard(element) {
  // Must contain an image or video
  const hasMedia = element.querySelector('img, video') !== null;
  if (!hasMedia) return false;
  
  // Check size - must be reasonable card size
  const rect = element.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 120) return false;
  
  // Skip if it's just a small thumbnail/avatar
  if (rect.width < 150 && rect.height < 150) return false;
  
  return true;
}

// Find the best container element to attach buttons to
function findCardContainer(linkElement) {
  // The link itself might be the card, or we need to find parent card container
  // Look for the closest element that contains the image and has position relative
  
  // First check if the link itself is the card
  if (isValidCard(linkElement)) {
    return linkElement;
  }
  
  // Look for parent with position relative (typical card wrapper)
  let current = linkElement.parentElement;
  let depth = 0;
  const maxDepth = 5; // Don't go too far up
  
  while (current && depth < maxDepth) {
    // Check if this could be a card container
    const style = window.getComputedStyle(current);
    const isPositioned = style.position === 'relative' || style.position === 'absolute';
    
    if (isPositioned && isValidCard(current)) {
      return current;
    }
    
    current = current.parentElement;
    depth++;
  }
  
  // Fallback to the link element if nothing better found
  return isValidCard(linkElement) ? linkElement : null;
}

// Create the quick save button container for an item
function createButtonContainer(itemInfo) {
  const { itemId, itemType } = itemInfo;
  
  if (!itemId || collections.length === 0) {
    return null;
  }
  
  const container = document.createElement('div');
  container.className = 'cqs-container';
  container.dataset.cqsItemId = itemId;
  container.dataset.cqsItemType = itemType || 'image';
  
  // Create buttons for each collection
  collections.forEach((collection, index) => {
    const button = document.createElement('button');
    button.className = 'cqs-button';
    button.dataset.collectionId = collection.id;
    button.dataset.collectionName = collection.name;
    button.title = `Save to ${collection.name}`;
    
    // Truncate long collection names
    const displayName = collection.name.length > 15 
      ? collection.name.substring(0, 12) + '...' 
      : collection.name;
    
    button.innerHTML = `
      <svg class="cqs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="cqs-label">${displayName}</span>
    `;
    
    button.addEventListener('click', handleSaveClick);
    
    // Stagger button positions
    button.style.setProperty('--cqs-index', index);
    
    container.appendChild(button);
  });
  
  return container;
}

// Handle save button click
async function handleSaveClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const button = event.currentTarget;
  const container = button.closest('.cqs-container');
  const collectionId = button.dataset.collectionId;
  const collectionName = button.dataset.collectionName;
  const itemId = container.dataset.cqsItemId;
  const itemType = container.dataset.cqsItemType;
  
  // Visual feedback - loading state
  button.classList.add('cqs-loading');
  button.disabled = true;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveToCollection',
      collectionId,
      itemId,
      itemType
    });
    
    if (response.success) {
      // Success feedback
      button.classList.remove('cqs-loading');
      button.classList.add('cqs-saved');
      showToast(`Saved to "${collectionName}"`, 'success');
      
      // Reset after delay
      setTimeout(() => {
        button.classList.remove('cqs-saved');
        button.disabled = false;
      }, 2000);
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Civitai Quick Save: Save failed -', error);
    button.classList.remove('cqs-loading');
    button.classList.add('cqs-error');
    showToast(`Failed to save: ${error.message}`, 'error');
    
    setTimeout(() => {
      button.classList.remove('cqs-error');
      button.disabled = false;
    }, 2000);
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.cqs-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `cqs-toast cqs-toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('cqs-toast-visible');
  });
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('cqs-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Track processed items to avoid duplicates
const processedItems = new Set();

// Inject buttons to a single link element
function injectButtonsToLink(linkElement) {
  const itemInfo = extractItemInfo(linkElement);
  
  if (!itemInfo.itemId) {
    return;
  }
  
  // Create unique key for this item
  const itemKey = `${itemInfo.itemType}-${itemInfo.itemId}`;
  
  // Find the card container
  const cardContainer = findCardContainer(linkElement);
  
  if (!cardContainer) {
    return;
  }
  
  // Skip if already processed (check container)
  if (cardContainer.querySelector('.cqs-container')) {
    return;
  }
  
  // Skip if we've already processed this item ID (in case same image appears multiple times)
  // Actually, don't skip - user might want to save same image from different views
  
  const buttonContainer = createButtonContainer(itemInfo);
  
  if (buttonContainer) {
    // Ensure the container has position for absolute positioning
    const computedStyle = window.getComputedStyle(cardContainer);
    if (computedStyle.position === 'static') {
      cardContainer.style.position = 'relative';
    }
    
    cardContainer.appendChild(buttonContainer);
  }
}

// Inject buttons to all existing items
function injectButtonsToExistingItems() {
  // Find all content links
  const links = document.querySelectorAll(CARD_SELECTORS);
  
  links.forEach(link => {
    injectButtonsToLink(link);
  });
}

// MutationObserver to handle dynamically loaded content
let observer = null;

function startObserver() {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      // Debounce processing
      clearTimeout(observer.debounceTimer);
      observer.debounceTimer = setTimeout(() => {
        injectButtonsToExistingItems();
      }, 200);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'collectionsUpdated') {
    collections = message.collections || [];
    // Re-inject buttons with new collections
    document.querySelectorAll('.cqs-container').forEach(el => el.remove());
    processedItems.clear();
    injectButtonsToExistingItems();
    sendResponse({ success: true });
  }
  
  if (message.action === 'toggleVisibility') {
    const containers = document.querySelectorAll('.cqs-container');
    containers.forEach(container => {
      container.classList.toggle('cqs-hidden', !message.visible);
    });
    sendResponse({ success: true });
  }
});

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Also re-initialize on page navigation (for SPA behavior)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Small delay to let the new content load
    setTimeout(injectButtonsToExistingItems, 500);
  }
}).observe(document, { subtree: true, childList: true });
