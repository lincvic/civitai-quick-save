# Civitai API Discovery Guide

This document explains how to discover and verify Civitai's internal API endpoints for the Quick Save Collection extension.

## Important Note

Civitai does **not** have documented public API endpoints for managing collections. The extension uses internal/undocumented APIs that may change without notice. You may need to update the endpoints based on the actual API structure.

## How to Discover API Endpoints

### Step 1: Open Civitai in Chrome

1. Navigate to [https://civitai.com](https://civitai.com)
2. Make sure you are **logged in** to your account

### Step 2: Open Chrome DevTools

1. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. Go to the **Network** tab
3. Check the "Preserve log" checkbox
4. Filter by "Fetch/XHR" to see only API calls

### Step 3: Discover Collection List Endpoint

1. Navigate to your profile or collections page
2. Look for network requests containing `collection` in the URL
3. Common patterns to look for:
   - `/api/trpc/collection.getAllUser`
   - `/api/trpc/collection.getAll`
   - `/api/v1/collections`

**Expected Response Structure:**
```json
{
  "result": {
    "data": {
      "json": [
        {
          "id": 12345,
          "name": "My Collection",
          "itemCount": 42,
          "type": "Image"
        }
      ]
    }
  }
}
```

### Step 4: Discover Add to Collection Endpoint

1. Find any image on Civitai
2. Click the "Add to Collection" or bookmark button
3. Select a collection to add the image to
4. Watch the Network tab for the POST request

**Look for endpoints like:**
- `/api/trpc/collectionItem.upsert`
- `/api/trpc/collectionItem.create`
- `/api/v1/collection-items`

**Request Payload Example:**
```json
{
  "json": {
    "collectionId": 12345,
    "imageId": 67890
  }
}
```

### Step 5: Discover Current User Endpoint

1. Reload the page while logged in
2. Look for requests to get user information
3. Common patterns:
   - `/api/current-user`
   - `/api/trpc/user.getById`

## Updating the Extension

If the API endpoints have changed, update the following files:

### `background.js`

Update the `fetchCollections()` function:

```javascript
// Update this URL to match Civitai's actual endpoint
const collectionsResponse = await fetch(
  `${CIVITAI_BASE_URL}/api/trpc/collection.getAllUser?input=${encodeURIComponent(JSON.stringify({json:{}}))}`,
  { ... }
);
```

Update the `handleSaveToCollection()` function:

```javascript
// Update this URL to match Civitai's actual endpoint
const response = await fetch(`${CIVITAI_BASE_URL}/api/trpc/collectionItem.upsert`, {
  method: 'POST',
  body: JSON.stringify({
    json: {
      collectionId: parseInt(collectionId),
      imageId: parseInt(itemId)  // Adjust field name if needed
    }
  })
});
```

## Known API Patterns (as of January 2026)

Civitai uses **tRPC** for their API. Common characteristics:

1. **GET requests** use query parameters:
   ```
   /api/trpc/[procedure]?input={encoded_json}
   ```

2. **POST requests** use JSON body:
   ```
   POST /api/trpc/[procedure]
   Content-Type: application/json
   
   {"json": { ... }}
   ```

3. **Authentication** is handled via session cookies (no API key needed for user actions)

## Item Types

Different item types use different ID fields:

| Type | Field Name | Example |
|------|------------|---------|
| Image | `imageId` | `{"imageId": 12345}` |
| Post | `postId` | `{"postId": 12345}` |
| Model | `modelId` | `{"modelId": 12345}` |
| Article | `articleId` | `{"articleId": 12345}` |

## Troubleshooting

### "Not logged in" Error
- Make sure you're logged into Civitai in your browser
- Try refreshing the Civitai page
- Clear browser cookies and log in again

### "Unable to fetch collections" Error
- The API endpoint may have changed
- Follow the discovery steps above to find the new endpoint
- Update `background.js` accordingly

### Collections not appearing on images
- Check browser console for errors
- Verify the CSS selectors in `content.js` match Civitai's current DOM structure
- Civitai may have updated their page layout

## Contributing

If you discover updated API endpoints, please update this documentation and the corresponding code in `background.js`.
