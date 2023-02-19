#!/bin/bash

# Script not finished yet

# Set Nyarch settings

## Set dconf default settings

### Enable tap to click for touchpads (very optional)
gsettings set org.gnome.desktop.peripherals.touchpad tap-to-click true

### Set gnome tweaks fonts
#### Font hinting to full
gsettings set org.gnome.desktop.interface font-hinting full
#### Font antialiasing to subpixel (better for LCD)
gsettings set org.gnome.desktop.interface font-antialiasing rgba
