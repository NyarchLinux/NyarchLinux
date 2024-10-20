#!/bin/bash
sudo pacman -Syy
pacman-key --init
flatpak mask "org.freedesktop.Platform.GL.nvidia*"
sudo -u live yay -S extension-manager --noconfirm

flatpak install -y flathub info.febvre.Komikku
flatpak install -y flathub com.github.tchx84.Flatseal
flatpak install -y org.gtk.Gtk3theme.adw-gtk3 org.gtk.Gtk3theme.adw-gtk3-dark

wget https://github.com/nyarchlinux/nyarchtour/releases/latest/download/nyarchtour.flatpak
wget https://github.com/nyarchlinux/nyarchwizard/releases/latest/download/wizard.flatpak
wget https://github.com/nyarchlinux/catgirldownloader/releases/latest/download/catgirldownloader.flatpak
wget https://github.com/nyarchlinux/nyarchscript/releases/latest/download/nyarchscript.flatpak
wget https://github.com/nyarchlinux/nyarchcustomize/releases/latest/download/nyarchcustomize.flatpak
wget https://github.com/nyarchlinux/waifudownloader/releases/latest/download/waifudownloader.flatpak
wget https://github.com/nyarchlinux/nyarchassistant/releases/latest/download/nyarchassistant.flatpak

flatpak install -y nyarchtour.flatpak
flatpak install -y catgirldownloader.flatpak
flatpak install -y nyarchcustomize.flatpak
flatpak install -y wizard.flatpak
flatpak install -y nyarchscript.flatpak
flatpak install -y waifudownloader.flatpak
flatpak install -y nyarchassistant.flatpak

rm -rf nyarchtour.flatpak
rm -rf catgirldownloader.flatpak
rm -rf nyarchcustomize.flatpak
rm -rf nyarchtour.flatpak
rm -rf wizard.flatpak
rm -rf nyarchscript.flatpak
rm -rf waifudownloader.flatpak
rm -rf nyarchassistant.flatpak

flatpak --remove mask "org.freedesktop.Platform.GL.nvidia*"
