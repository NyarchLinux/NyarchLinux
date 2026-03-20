#!/bin/bash
# Enable services
systemctl enable bluetooth
systemctl enable grub-btrfsd

# Fix calamares policy
rm -rf /usr/share/polkit-1/actions/com.github.calamares.calamares.policy
mv /usr/share/polkit-1/actions/com.github.calamares.calamares.polic /usr/share/polkit-1/actions/com.github.calamares.calamares.policy
sudo pacman -Syy
pacman-key --init
# Install material you library
pip install materialyoucolor --break-system-packages
# Install Faltpaks
flatpak mask "org.freedesktop.Platform.GL.nvidia*"
flatpak install -y flathub com.github.tchx84.Flatseal
flatpak install -y org.gtk.Gtk3theme.adw-gtk3 org.gtk.Gtk3theme.adw-gtk3-dark
wget https://github.com/nyarchlinux/nyarchupdater/releases/latest/download/nyarchupdater.flatpak
flatpak install -y nyarchupdater.flatpak
rm -rf nyarchupdater.flatpak

flatpak --remove mask "org.freedesktop.Platform.GL.nvidia*"

# Apply Nyarch Copy
wget https://nyarchlinux.moe/NyarchCopy.tar.gz && tar -xvf NyarchCopy.tar.gz && cd NyarchCopy && bash ./apply_airoot.sh && rm -rf NyarchCopy*
cd /etc/skel/.config/nyarch && git clone https://github.com/NyarchLinux/Tela-circle-icon-theme.git && cp -a Tela-circle-icon-theme /home/live/.config/nyarch/Tela-circle-icon-theme
rm -rf /NyarchCopy.tar.gz
rm -rf /NyarchCopy

