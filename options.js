// Civitai Quick Save Collection - Options Page Script

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const emptyState = document.getElementById('emptyState');
  const collectionsList = document.getElementById('collectionsList');
  const refreshBtn = document.getElementById('refreshBtn');
  const message = document.getElementById('message');
  
  // Load collections on page load
  loadCollections();
  
  // Refresh button click handler
  refreshBtn.addEventListener('click', () => {
    refreshCollections();
  });
  
  // Load collections from storage/background
  async function loadCollections() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCollections' });
      
      if (response.success && response.collections && response.collections.length > 0) {
        displayCollections(response.collections);
        setStatus('connected', `${response.collections.length} collections`);
      } else if (response.success) {
        showEmptyState();
        setStatus('disconnected', 'No collections');
      } else {
        showEmptyState();
        setStatus('disconnected', 'Not connected');
        showMessage('error', response.error || 'Could not load collections. Make sure you are logged into Civitai.');
      }
    } catch (error) {
      console.error('Error loading collections:', error);
      showEmptyState();
      setStatus('disconnected', 'Error');
      showMessage('error', 'Failed to communicate with extension. Try reloading the page.');
    }
  }
  
  // Refresh collections from Civitai
  async function refreshCollections() {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<span class="spinner"></span> Refreshing...';
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'refreshCollections' });
      
      if (response.success && response.collections && response.collections.length > 0) {
        displayCollections(response.collections);
        setStatus('connected', `${response.collections.length} collections`);
        showMessage('success', `Successfully loaded ${response.collections.length} collections!`);
        
        // Notify content scripts about the update
        notifyContentScripts(response.collections);
      } else if (response.success) {
        showEmptyState();
        setStatus('disconnected', 'No collections');
        showMessage('error', 'No collections found. Create some collections on Civitai first.');
      } else {
        showEmptyState();
        setStatus('disconnected', 'Not connected');
        showMessage('error', response.error || 'Could not refresh collections. Make sure you are logged into Civitai.');
      }
    } catch (error) {
      console.error('Error refreshing collections:', error);
      showMessage('error', 'Failed to refresh. Check your connection and try again.');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"></path>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refresh Collections
      `;
    }
  }
  
  // Display collections in the list
  function displayCollections(collections) {
    emptyState.style.display = 'none';
    collectionsList.style.display = 'flex';
    collectionsList.innerHTML = '';
    
    collections.forEach(collection => {
      const item = document.createElement('div');
      item.className = 'collection-item';
      item.innerHTML = `
        <span class="collection-name">${escapeHtml(collection.name)}</span>
        <span class="collection-count">${collection.itemCount || 0} items</span>
      `;
      collectionsList.appendChild(item);
    });
  }
  
  // Show empty state
  function showEmptyState() {
    emptyState.style.display = 'block';
    collectionsList.style.display = 'none';
    collectionsList.innerHTML = '';
  }
  
  // Set connection status
  function setStatus(status, text) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = text;
  }
  
  // Show message
  function showMessage(type, text) {
    message.className = `message visible ${type}`;
    message.textContent = text;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      message.classList.remove('visible');
    }, 5000);
  }
  
  // Notify content scripts about collection updates
  async function notifyContentScripts(collections) {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://civitai.com/*' });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'collectionsUpdated',
            collections: collections
          });
        } catch (e) {
          // Tab might not have content script loaded
          console.log('Could not notify tab:', tab.id);
        }
      }
    } catch (error) {
      console.error('Error notifying content scripts:', error);
    }
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
