#!/bin/bash

LIVEUSER="live"
chmod -R 777 ~/.local/share/gnome-shell/extensions
if [ "$USER" = "$LIVEUSER" ]; then
    sh -c "pkexec calamares"
else
    flatpak run moe.nyarchlinux.tour
    rm -rf ~/.config/autostart/start.desktop
fi

