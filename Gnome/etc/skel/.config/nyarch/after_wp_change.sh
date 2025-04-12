#!/usr/bin/env bash
# Improved script to change Tela icon theme based on GTK4 accent color,
# preventing issues from concurrent executions.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
GTK_CSS_FILE="$HOME/.config/gtk-4.0/gtk.css"
ICON_INSTALL_SCRIPT="$HOME/.config/nyarch/Tela-circle-icon-theme/install.sh"
ICON_BASE_NAME="Tela-circle-MaterialYou"
LAST_COLOR_CACHE_FILE="$HOME/.cache/last_tela_icon_color"
LOCK_DIR="/tmp/change_tela_icon.lock" # Lock directory to prevent concurrent runs

# --- Locking Mechanism ---
# Try to create the lock directory. If it already exists, another instance is running.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Script is already running. Exiting." >&2
    exit 1
fi

# Ensure the lock directory is removed when the script exits (normally, on error, or via signal)
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1' EXIT HUP INT TERM

# --- Main Logic ---
execute_change() {
    # Check if GTK CSS file exists
    if [ ! -f "$GTK_CSS_FILE" ]; then
        echo "Error: GTK CSS file not found at $GTK_CSS_FILE" >&2
        exit 1 # Exit script, lock will be removed by trap
    fi

    # Check if install script exists and is executable
    if [ ! -x "$ICON_INSTALL_SCRIPT" ]; then
        echo "Error: Icon install script not found or not executable at $ICON_INSTALL_SCRIPT" >&2
        exit 1 # Exit script, lock will be removed by trap
    fi

    # Get current theme preference (light/dark)
    # Check if gsettings is available
    if ! command -v gsettings &> /dev/null; then
        echo "Error: gsettings command not found. Cannot determine theme preference." >&2
        exit 1
    fi
    local is_dark=$(gsettings get org.gnome.desktop.interface color-scheme)
    local color_variable

    # Determine which CSS variable to grep for based on theme preference
    if [[ "$is_dark" == "'prefer-dark'" || "$is_dark" == *"dark"* ]]; then # More robust check for dark
        color_variable='accent_bg_color'
    else
        # Covers 'default', 'prefer-light', or others - assumes light accent
        color_variable='accent_color'
    fi

    echo "Detected color scheme: $is_dark (using '$color_variable')"

    # Extract the color hex code (removing '#')
    local current_color=$(grep "$color_variable" "$GTK_CSS_FILE" | head -n 1 | sed -n 's/.*#\([0-9a-fA-F]\{6\}\);.*/\1/p')

    if [ -z "$current_color" ]; then
        echo "Error: Could not extract color for '$color_variable' from $GTK_CSS_FILE" >&2
        # Optionally try the other variable as a fallback? For now, just exit.
        exit 1 # Exit script, lock will be removed by trap
    fi
    echo "Extracted color: #$current_color"

    # Check if the color has actually changed since the last run
    local last_color=""
    if [ -f "$LAST_COLOR_CACHE_FILE" ]; then
        last_color=$(cat "$LAST_COLOR_CACHE_FILE")
    fi

    if [ "$current_color" == "$last_color" ]; then
        echo "Color #$current_color has not changed since last run. No update needed."
        # No need to exit 1 here, just finish successfully without doing work
        return 0
    fi

    # --- Perform Actions (Color has changed or first run) ---
    echo "Color changed to #$current_color. Updating icons..."
    local target_icon_theme_name="$ICON_BASE_NAME-$current_color"

    # Generate and install Tela icons
    # No need for chmod +x here if permissions are set correctly once
    echo "Running install script: $ICON_INSTALL_SCRIPT -n $ICON_BASE_NAME $current_color"
    if ! "$ICON_INSTALL_SCRIPT" -n "$ICON_BASE_NAME" "$current_color"; then
       echo "Error: Icon install script failed." >&2
       exit 1 # Exit script, lock will be removed by trap
    fi
    echo "Install script finished."

    # Set the new icon theme using gsettings
    echo "Setting GTK icon theme to $target_icon_theme_name"
    if ! gsettings set org.gnome.desktop.interface icon-theme "$target_icon_theme_name"; then
        echo "Error: Failed to set icon theme using gsettings." >&2
        # Don't necessarily exit here, maybe the install worked but gsettings failed
        # Let the cleanup proceed, but report the error.
    else
        echo "Successfully set icon theme."
    fi

    # Optional: Update icon cache (often handled by install scripts or package managers)
    # echo "Updating icon cache (may take a moment)..."
    # gtk-update-icon-cache || echo "Warning: gtk-update-icon-cache command failed or not found."

    # Clean up old generated icon themes
    echo "Cleaning up old '$ICON_BASE_NAME-*' icon themes..."
    # Use find within the specific icons directory
    local icons_dir="$HOME/.local/share/icons"
    if [ -d "$icons_dir" ]; then
        find "$icons_dir" -maxdepth 1 -mindepth 1 -type d -name "$ICON_BASE_NAME-*" ! -name "$target_icon_theme_name" -exec echo "Removing: {}" \; -exec rm -rf "{}" +
        echo "Cleanup complete."
    else
        echo "Warning: Icons directory $icons_dir not found, skipping cleanup."
    fi

    # Store the newly applied color for the next check
    echo "$current_color" > "$LAST_COLOR_CACHE_FILE"
    echo "Successfully updated icons for color #$current_color"
}

# Execute the main function
execute_change

# --- Unlock ---
# The trap will handle removing the lock directory on exit
# If we reach here, the script completed successfully (or returned 0)
exit 0
