#!/bin/bash

# This scripts downloads default Nyarch flatpak on host machine. 
# Note: by default, steps.sh will add to the iso every flatpak in the host.

flatpak install flathub info.febvre.Komikku
flatpak install flathub com.github.tchx84.Flatseal
flatpak install flathub de.haeckerfelix.Shortwave
flatpak install flathub org.gnome.Lollypop
flatpak install flathub de.haeckerfelix.Fragments
flatpak install org.gtk.Gtk3theme.adw-gtk3 org.gtk.Gtk3theme.adw-gtk3-dark