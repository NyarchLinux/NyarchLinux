#!/usr/bin/env bash
# shellcheck disable=SC2034

iso_name="nyarch-gnome"
iso_label="NYARCH-GNOME_$(date +%y%m%d)"
iso_publisher="Nyarch Linux <https://nyarchlinux.moe>"
iso_application="Nyarchlinux DVD"
iso_version="$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%y%m%d)"
install_dir="arch"
buildmodes=('iso')
bootmodes=('bios.syslinux.mbr' 'bios.syslinux.eltorito'
           'uefi-ia32.grub.esp' 'uefi-x64.grub.esp'
           'uefi-ia32.grub.eltorito' 'uefi-x64.grub.eltorito')
arch="x86_64"
pacman_conf="./pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'zstd' '-b' '1M')
bootstrap_tarball_compression=(zstd)
file_permissions=(
  ["/etc/shadow"]="0:0:0400"
  ["/etc/gshadow"]="0:0:0400"
  ["/etc/sudoers"]="0:0:0440"
  ["/root"]="0:0:750"
  ["/root/.automated_script.sh"]="0:0:755"
  ["/usr/local/bin/choose-mirror"]="0:0:755"
  ["/usr/local/bin/Installation_guide"]="0:0:755"
  ["/usr/local/bin/livecd-sound"]="0:0:755"
  ["/usr/local/bin/ezmaint"]="0:0:755"
  ["/usr/share/ezarcher/Scripts/"]="0:0:755"
  ["/usr/local/bin/grubinstall.sh"]="0:0:755"
#  ["/var/lib/flatpak"]="0:0:755"
#  ["/var/lib/flatpak/"]="0:0:755"
#  ["/var/lib/flatpak/app"]="0:0:755"
#  ["/var/lib/flatpak/runtime"]="0:0:755"
  ["/usr/local/bin/nekofetch"]="0:0:755"
  ["/usr/local/bin/nyaofetch"]="0:0:755"
  ["/usr/local/bin/nyaura"]="0:0:755"
  ["/usr/local/bin/nyay"]="0:0:755"
)
