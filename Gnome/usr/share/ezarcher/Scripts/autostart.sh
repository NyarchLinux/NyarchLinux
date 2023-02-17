#!/bin/bash

LIVEUSER="live"
chmod -R 777 ~/.local/share/gnome-shell/extensions/material-you-theme@asubbiah.com/
if [ "$USER" = "$LIVEUSER" ]; then
    sh -c "pkexec calamares"
else
    flatpak run moe.nyarchlinux.tour
    rm -rf ~/.config/autostart/start.desktop
fi

