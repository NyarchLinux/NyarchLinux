#!/bin/bash

LIVEUSER="live"
chmor -R 777 ~/.config/nyarch
chmod -R 777 ~/.local/share/gnome-shell/extensions
xdg-mime default org.gnome.Nautilus.desktop inode/directory
if [ "$USER" = "$LIVEUSER" ]; then
   sleep 5 
   #sh -c "pkexec calamares"
else
    flatpak run moe.nyarchlinux.tour
    rm -rf ~/.config/autostart/start.desktop
fi

