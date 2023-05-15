# arch-update
Update indicator for Arch Linux and GNOME Shell

## Warning for Gnome 42
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

## One-click install
It's on extensions.gnome.org :
https://extensions.gnome.org/extension/1010/archlinux-updates-indicator/

## Install from AUR
Thanks to michiwend you can install it from Arch Linux User Repository : gnome-shell-extension-arch-update
https://aur.archlinux.org/packages/gnome-shell-extension-arch-update/

## Manual install
To install, simply download as zip and unzip contents in ~/.local/share/gnome-shell/extensions/arch-update@RaphaelRochet

## Changes

### v52
- Gnome 44
- Move to GTK4
- Updated translations : Brazilian Portuguese, Chinese

### v51
- Minor fix

### v50
- Gnome 43
- Updated translation : Dutch

### v49
- "Fix 'Strip version numbers' nor working with old behavior

### v48
- Added translation : hungarian
- Fix Inconsistent icon theme
- Add basic parsing to tell updates and titles apart; also increase readibility in menu
- Now "strip version number" can be applied to indicator menu or notifications

### v47
- Gnome 42
- Fix deprectated option in default commandline

### v46
- Updated translation : Brazilian Portuguese
- Added translation : Occitan
- Fixed indicator not shown if in error state (#178)

### v45
- Fixed an error on unloading introduced in v44

### v44
- Minor refactoring

### v43
- Gnome 41
- New translations : Dutch, Korean, Ukrainian
- Updated translations : Simplified Chinese, Russian

### v42
- Updated translation : German

### v41
- Fixed metadata for extensions website

### v40
- Gnome 40 only
- Updated translation : Russian

### v39
- Fixed update list empty after suspend
- Fixed update list not fully visible when lots of updates
- Updated translations : Chinese and Spanish

### v38
- Fixed crash about Gtk.IconTheme.get_defaults
- Added indicator position setting

### v37
- Theme support is back ! Also an option to force built-in icons if needed.

### v36
- Gnome 3.36.1 only
- Fixed open prefs from menu

### v35
- Gnome 3.36 only
- Fixed a warning about absolete call

### v34
- Gnome 3.36
- New translation : Swedish
- Updated translations : Italian, German

### v33
- Removed deprecated code
- Removed support for older GS

### v32
- Gnome 3.34

### v31
- Updated translation : Turkish

### v30
- Gnome 3.32

### v29
- Update translation : Romanian
- Applied French translation to all French

### v28
- Gnome 3.30
- New translation : Esperanto
- New translation : Finnish
- Updated translation : Brazilian
- Fix indicator alignment
- Fix some errors that could quickly fill log

### v27
- Added info about pacman-contrib for checkupdates script
- New translation : Estonian
- Updated translation : Romanian

### v26
- Gnome 3.28
- New translation : Hebrew
- Update translation : Spanish

### v25
- Added optional package manager menu entry
- Added requirements in readme
- Updated Slovak translation
- Updated Italian translation
- Fixed a JS Warning
- Fixed a bug that crashes Gnome-SHELL on update

### v24
- Gnome 3.26
- Updated Romanian translation

### v23
- Updated translation : Arabic

### v22
- Updated translation : Serbian
- New translation : Turkish

### v21
- Gnome 3.24
- New translation : Persian

### v20
- Translations updates (German, Spanish)

### v19
- Ability to cancel checking
- New translation : Catalan
- Updated translations : Spanish, Brazilian

### v18
- Gnome 3.22
- New preferences window
- Cleaner translations (some text are not translated yet)
- Menu does not close when updating

### v17
- New translation : Russian
- Updated translation : Czech

### v16
- Add vertical scroll bar on preferences window

### v15
- New feature : auto-expand update list
- New translation : Norwegian Bokmal
- Updated translation : Brazilian Portuguese

### v14
- Gnome 3.20 compatibility

### v13
- New translation : Serbian (sr and sr@latin)
- Updated translation : Spanish
- Minor bug fix

### v12
- New translation : Chinese
- Updated translation : Czech

### v11
- New option to strip out version numbers
- New translations : Slovak and Arabic
- Updated translations : Brazilian Portuguese, German

### v10
- Licence added : GNU GPL v3
- Updated translations : Polish and Brazilian portuguese

### v9
- Added option to change command used to check for updates (for advanced users)
- Added Romanian and Polish translations

### v8
- Added Italian language

### v7
- Added Brazilian Portuguese translation

### v6
- Added Spanish language

### v5
- Option to have permanent notifications
- Asynchronous checking - No more 1 sec Shell freeze during updates check !
- 'Updates pending' menu item can now be expanded to show updates list
- Option to only list new updates in notifications
- Aded "Update Now" action button on notifications

### v4
- Run update command from indicator
- Autodetect when updates are done
- Prefs dialog reworked

### v3
- Notification option
- Czech and German languages added

## Credits
All icons are based on Thayer Williams' Archer logo, winner of Arch Linux logo contest.

Some portions of the extension were inspired from Touchad Indicator and Lock keys. 
https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator
https://github.com/kazysmaster/gnome-shell-extension-lockkeys
