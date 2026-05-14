#!/bin/bash
# Installs Mango anime plugins to the correct location
# Usage: ./install.sh [plugin_path]
# Default: ~/mango/plugins/

PLUGIN_DIR="${1:-$HOME/mango/plugins}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing anime plugins to: $PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR"

for plugin in hianime consumet miruro tier3 comick mangadex; do
  if [ -d "$SCRIPT_DIR/$plugin" ]; then
    echo "  → Installing $plugin..."
    rm -rf "$PLUGIN_DIR/$plugin"
    cp -r "$SCRIPT_DIR/$plugin" "$PLUGIN_DIR/$plugin"
  fi
done

echo "Done! Restart Mango to load the new plugins."
