#!/bin/bash

# Build script for Civitai Quick Save Collection Chrome Extension

# Extension name
EXT_NAME="civitai-quick-save-collection"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Output zip file
OUTPUT_FILE="${SCRIPT_DIR}/${EXT_NAME}.zip"

# Remove existing zip if present
if [ -f "$OUTPUT_FILE" ]; then
    echo "Removing existing ${EXT_NAME}.zip..."
    rm "$OUTPUT_FILE"
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Create zip with all extension files
echo "Building ${EXT_NAME}.zip..."

zip -r "$OUTPUT_FILE" \
    manifest.json \
    background.js \
    domain-config.js \
    content.js \
    styles.css \
    options.html \
    options.js \
    icons/ \
    -x "*.DS_Store" \
    -x "__MACOSX/*"

# Check if build was successful
if [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📦 Output: ${OUTPUT_FILE}"
    echo ""
    # Show zip contents
    echo "Contents:"
    unzip -l "$OUTPUT_FILE"
else
    echo "❌ Build failed!"
    exit 1
fi
