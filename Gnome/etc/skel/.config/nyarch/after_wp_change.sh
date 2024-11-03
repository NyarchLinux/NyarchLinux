#!/bin/bash
# Get the current color from pywal
#PYCOLOR=$(jq -r '.colors.color2' < ~/.cache/wal/colors.json | sed 's/#//')
# Check if is dark
ISDARK=$(gsettings get org.gnome.desktop.interface color-scheme)
execute_change () {
	file_name=~/.config/gtk-4.0/gtk.css  # Replace with the actual file path
	echo $ISDARK
  if [ "$ISDARK" = "'default'" ]; then
    COLOR=$(grep 'accent_color' "$file_name" | cut -d ' ' -f 3 | tr -d ';' | cut -c 2-)
  else
    COLOR=$(grep 'accent_bg_color' "$file_name" | cut -d ' ' -f 3 | tr -d ';' | cut -c 2-)
  fi
  echo $COLOR;
	# Generate and install tela icons
  chmod +x ~/.config/nyarch/Tela-circle-icon-theme/install.sh 
	~/.config/nyarch/Tela-circle-icon-theme/install.sh -n Tela-circle-MaterialYou "$COLOR"
	#gsettings set org.gnome.desktop.interface icon-theme "Adwaita"
	gsettings set org.gnome.desktop.interface icon-theme "Tela-circle-MaterialYou-$COLOR"
  #gtk-update-icon-cache
  find ~/.local/share/icons -type d -name "Tela-circle-MaterialYou-*" ! -name "Tela-circle-MaterialYou-$COLOR" -exec rm -rf "{}" +
}

execute_change &
