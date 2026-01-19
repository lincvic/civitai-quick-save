# Civitai Quick Save Collection

A Chrome extension that adds quick save buttons to all images, videos, and posts on [civitai.com](https://civitai.com), allowing you to instantly save items to your collections.

## Features

- **Quick Save Buttons**: Adds save buttons to every image, video, and post on Civitai
- **Multiple Collections**: Shows a button for each of your collections
- **Instant Save**: One-click saving without navigating away from the page
- **Visual Feedback**: Clear success/error notifications
- **Auto-Detection**: Automatically detects new content loaded via infinite scroll
- **Dark Theme**: Styled to match Civitai's dark interface

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the extension folder (`civitai-quick-save-collection`)
6. The extension icon should appear in your toolbar

## Usage

1. **Login to Civitai**: Make sure you're logged into [civitai.com](https://civitai.com)

2. **Refresh Collections**: 
   - Click the extension icon or go to extension options
   - Click "Refresh Collections" to load your collections

3. **Browse & Save**:
   - Navigate to any page on Civitai with images
   - Hover over any image/post to see the save buttons
   - Click a collection button to save instantly

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Civitai Page                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │                 │  │                 │               │
│  │     Image       │  │     Image       │               │
│  │   ┌─────────┐   │  │   ┌─────────┐   │               │
│  │   │ Save to │   │  │   │ Save to │   │               │
│  │   │ Coll A  │   │  │   │ Coll A  │   │               │
│  │   ├─────────┤   │  │   ├─────────┤   │               │
│  │   │ Save to │   │  │   │ Save to │   │               │
│  │   │ Coll B  │   │  │   │ Coll B  │   │               │
│  │   └─────────┘   │  │   └─────────┘   │               │
│  └─────────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## Configuration

Access the options page by:
- Right-clicking the extension icon → Options
- Or navigating to `chrome://extensions` → Civitai Quick Save → Details → Extension options

### Options Page Features

- View all your collections
- Refresh collections list
- Check connection status

## Troubleshooting

### Buttons not appearing

1. Make sure you're on `civitai.com`
2. Try refreshing the page
3. Check that you're logged in
4. Open the extension options and click "Refresh Collections"

### "Not logged in" error

1. Navigate to [civitai.com](https://civitai.com) and log in
2. Refresh the extension options page
3. Click "Refresh Collections"

### API errors

Civitai's internal API may change. See [API_DISCOVERY.md](API_DISCOVERY.md) for instructions on updating the API endpoints.

## File Structure

```
civitai-quick-save-collection/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for API calls
├── content.js         # DOM manipulation and button injection
├── styles.css         # Button and toast styling
├── options.html       # Settings page HTML
├── options.js         # Settings page logic
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md          # This file
└── API_DISCOVERY.md   # API endpoint documentation
```

## Permissions

This extension requires the following permissions:

- **storage**: Store collections cache and settings
- **activeTab**: Access the current tab when clicked
- **host_permissions (civitai.com)**: Interact with Civitai pages

## Development

### Modifying the Extension

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the Civitai page to see changes

### Key Files to Modify

- **`content.js`**: Change how buttons are injected or styled
- **`background.js`**: Update API endpoints or add new features
- **`styles.css`**: Customize button appearance

## Known Limitations

- Uses undocumented Civitai APIs that may change
- Requires being logged into Civitai
- Button positions may need adjustment if Civitai changes their layout

## License

MIT License - Feel free to modify and distribute.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
