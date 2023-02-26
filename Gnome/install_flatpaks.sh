#!/bin/bash

# This scripts downloads default Nyarch flatpak on host machine. 
# Note: by default, steps.sh will add to the iso every flatpak in the host.

flatpak install flathub info.febvre.Komikku
flatpak install flathub com.github.tchx84.Flatseal
flatpak install flathub de.haeckerfelix.Shortwave
flatpak install flathub org.gnome.Lollypop
flatpak install flathub de.haeckerfelix.Fragments
flatpak install org.gtk.Gtk3theme.adw-gtk3 org.gtk.Gtk3theme.adw-gtk3-dark
flatpak install flathub com.mattjakeman.ExtensionManager

cd flatpaks
rm -rf nyarchtour.flatpak
rm -rf catgirldownloader.flatpak
rm -rf nyarchcustomize.flatpak
rm -rf nyarchtour.flatpak
rm -rf wizard.flatpak

wget https://github.com/nyarchlinux/nyarchtour/releases/latest/download/nyarchtour.flatpak
wget https://github.com/nyarchlinux/nyarchwizard/releases/latest/download/wizard.flatpak
wget https://github.com/nyarchlinux/catgirldownloader/releases/latest/download/catgirldownloader.flatpak
wget https://github.com/nyarchlinux/nyarchscript/releases/latest/download/nyarchscript.flatpak
wget https://github.com/nyarchlinux/nyarchcustomize/releases/latest/download/nyarchcustomize.flatpak

flatpak install nyarchtour.flatpak
flatpak install catgirldownloader.flatpak
flatpak install nyarchcustomize.flatpak
flatpak install wizard.flatpak
flatpak install nyarchscript.flatpak
