#!/bin/bash

LIVEUSER="live"
chmor -R 777 ~/.config/nyarch
chmod -R 777 ~/.local/share/gnome-shell/extensions
xdg-mime default org.gnome.Nautilus.desktop inode/directory
if [ "$USER" = "$LIVEUSER" ]; then
   # Disable suspension
   gsettings set org.gnome.desktop.session idle-delay "uint32 0"
   #sh -c "pkexec calamares"
else
    flatpak run moe.nyarchlinux.tour
    rm -rf ~/.config/autostart/start.desktop
fi

