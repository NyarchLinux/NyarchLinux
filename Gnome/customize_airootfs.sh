#!/bin/bash
# Enable services
systemctl enable bluetooth
systemctl enable grub-btrfsd

sudo pacman -Syy
pacman-key --init
# Install material you library
pip install materialyoucolor --break-system-packages
# Install Faltpaks
flatpak mask "org.freedesktop.Platform.GL.nvidia*"

flatpak install -y flathub com.github.tchx84.Flatseal
flatpak install -y org.gtk.Gtk3theme.adw-gtk3 org.gtk.Gtk3theme.adw-gtk3-dark

wget https://github.com/nyarchlinux/nyarchtour/releases/latest/download/nyarchtour.flatpak
wget https://github.com/nyarchlinux/nyarchwizard/releases/latest/download/wizard.flatpak
wget https://github.com/nyarchlinux/catgirldownloader/releases/latest/download/catgirldownloader.flatpak
wget https://github.com/nyarchlinux/nyarchscript/releases/latest/download/nyarchscript.flatpak
wget https://github.com/nyarchlinux/nyarchcustomize/releases/latest/download/nyarchcustomize.flatpak
wget https://github.com/nyarchlinux/waifudownloader/releases/latest/download/waifudownloader.flatpak
wget https://github.com/nyarchlinux/nyarchassistant/releases/latest/download/nyarchassistant.flatpak
wget https://github.com/nyarchlinux/nyarchupdater/releases/latest/download/nyarchupdater.flatpak

flatpak install -y nyarchtour.flatpak
flatpak install -y catgirldownloader.flatpak
flatpak install -y nyarchcustomize.flatpak
flatpak install -y wizard.flatpak
flatpak install -y nyarchscript.flatpak
flatpak install -y waifudownloader.flatpak
flatpak install -y nyarchassistant.flatpak
flatpak install -y nyarchupdater.flatpak

rm -rf nyarchtour.flatpak
rm -rf catgirldownloader.flatpak
rm -rf nyarchcustomize.flatpak
rm -rf nyarchtour.flatpak
rm -rf wizard.flatpak
rm -rf nyarchscript.flatpak
rm -rf waifudownloader.flatpak
rm -rf nyarchassistant.flatpak
rm -rf nyarchupdater.flatpak

flatpak --remove mask "org.freedesktop.Platform.GL.nvidia*"

# Apply Nyarch Copy
wget https://nyarchlinux.moe/NyarchCopy.tar.gz && tar -xvf NyarchCopy.tar.gz && cd NyarchCopy && bash ./apply_airoot.sh && rm -rf NyarchCopy*
cd /etc/skel/.config/nyarch && git clone https://github.com/NyarchLinux/Tela-circle-icon-theme.git && cp -a Tela-circle-icon-theme /home/live/.config/nyarch/Tela-circle-icon-theme


