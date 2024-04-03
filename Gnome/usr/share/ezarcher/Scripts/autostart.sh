#!/bin/bash

LIVEUSER="live"
chmod -R 777 ~/.local/share/gnome-shell/extensions
xdg-mime default org.gnome.Nautilus.desktop inode/directory
if [ "$USER" = "$LIVEUSER" ]; then
   sleep 5 
   sh -c "pkexec calamares"
   echo "Calamares creates issues when auto launched"
else
    flatpak run moe.nyarchlinux.tour
    rm -rf ~/.config/autostart/start.desktop
fi

