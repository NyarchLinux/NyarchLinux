# arch-update
Update indicator for Arch Linux and GNOME Shell

Note : Since 2026, the project has been moved to CodeBerg : https://codeberg.org/RaphaelRochet/arch-update

## Warning for Gnome 42+
Default update command tries to run "gnome-terminal".
You need to either install gnome-terminal or edit update command in advanced options to run Console. See wiki for examples.

## Features
- Uses pacman's «checkupdates» by default and thus does not need root access
- Optional update count display on panel
- Optional notification on new updates (defaults to off)
- Launcher for your favorite update command
- Comes in English, French, Czech, German, Spanish, Brazilian Portuguese, Italian, Polish, Romanian, Arabic, Slovak, Chinese, Serbian, Swedish, Norwegian Bokmal, Russian, Persian, Turkish, Esperanto, Finnish, Dutch, Ukrainian, Korean, Occitan, hungarian languages. (Thanks translators !)

## Requirements
If you use the default "checkupdates" way you will need to install "pacman-contrib".

## AUR, Flatpak, ...
You can easily add support for AUR or another package manager, by editing check and updates commands.
You will find many examples in the wiki : https://codeberg.org/RaphaelRochet/arch-update/wiki

## One-click install
It's on extensions.gnome.org :
https://extensions.gnome.org/extension/1010/archlinux-updates-indicator/

## Manual install
To install, download as zip and unzip contents in ~/.local/share/gnome-shell/extensions/arch-update@RaphaelRochet

## Credits
All icons are based on Thayer Williams' Archer logo, winner of Arch Linux logo contest.

Some portions of the extension were inspired from Touchad Indicator and Lock keys. 
https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator
https://github.com/kazysmaster/gnome-shell-extension-lockkeys
