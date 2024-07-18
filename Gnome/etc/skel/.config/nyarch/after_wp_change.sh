#!/bin/bash
# Get the current color from pywal
#PYCOLOR=$(jq -r '.colors.color2' < ~/.cache/wal/colors.json | sed 's/#//')
execute_change () {
	sleep 1
	file_name=~/.config/gtk-4.0/gtk.css  # Replace with the actual file path
	COLOR=$(grep 'accent_bg_color' $file_name | cut -d ' ' -f 3 | tr -d ';')
	echo $COLOR;
	# Generate and install tela icons
	chmod +x ~/.config/nyarch/Tela-circle-icon-theme-custom-color/install.sh 
	~/.config/nyarch/Tela-circle-icon-theme-custom-color/install.sh -a "$COLOR" -n Tela-circle-MaterialYou
	gsettings set org.gnome.desktop.interface icon-theme "Adwaita"
	gsettings set org.gnome.desktop.interface icon-theme "Tela-circle-MaterialYou"
}

execute_change &
