<br/>
<p align="center">
  <h3 align="center">Dash2Dock Animated</h3>

  <p align="center">
    A GNOME Shell 40+ Extension
    <br/>
    <br/>
  </p>
</p>

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/icedman)

![Contributors](https://img.shields.io/github/contributors/icedman/dash2dock-lite?color=dark-green) ![Forks](https://img.shields.io/github/forks/icedman/dash2dock-lite?style=social) ![Stargazers](https://img.shields.io/github/stars/icedman/dash2dock-lite?style=social) ![Issues](https://img.shields.io/github/issues/icedman/dash2dock-lite) ![License](https://img.shields.io/github/license/icedman/dash2dock-lite) 

![Screen Shot](https://raw.githubusercontent.com/icedman/dash2dock-lite/main/screenshots/Screenshot%20from%202024-03-19%2015-31-27.png)

### Notice

* Gnome 46 update is ready for testing
* Gnome 45 port is ready for testing
* Gnome 44 and prior will be under g44 branch

### Features

* Multi-monitor support (new!)
* Dash docked at the desktop
* Animated dock icons
* Resize icons
* Autohide/intellihide
* Dock positions: bottom, top, left, right
* Scrollwheel to cycle windows
* Click to maximize/minimize windows
* Style top panel
* Panel mode
* Show/Hide Apps icon
* Analog clock
* Dynamic calendar
* Dynamic trash icon
* Mounted devices
* Downloads icon with fan animation (new!)
* Icon color effects(Tint, Monochrome)

### Prerequisites

Requirements:

* GNOME Shell (version 40+)

### Installation

Manual Installation: 
- Clone this repo
```bash
$ git clone https://github.com/icedman/dash2dock-lite.git
```
- Use the `Makefile` to build and install
```bash 
$ cd dash2dock-lite
$ make
```

Using the AUR (Arch User Repository):
*This requires an Arch-based distribution to work:*
```bash
$ git clone https://aur.archlinux.org/gnome-shell-extension-dash2dock-lite.git
$ makepkg -si
```

From Gnome Extensions Repository

Visit [https://extensions.gnome.org/extension/4994/dash2dock-lite/](https://extensions.gnome.org/extension/4994/dash2dock-lite/)

## Theme Support

Export your settings under Style > Themes Button > "Export"...

This will be saved to ```/tmp/theme.json```. Edit this json file and save under ```~/.config/d2da/themes``` or at ```{extension_path}/dash2dock-animated/themes``` so that it becomes available at the extension settings app.

## Dynamic Icons

Dynamic trash icon is supported (beta). The first time this is enabled, a GNOME shell restart is required.

The trash icon has an action "Empty Trash" which requires a script *{EXTENSION_PATH}/apps/empty-trash.sh* with the content:

```sh
#!/usr/bin/sh
rm -rf ~/.local/share/Trash/*
```

Modify the script to match your system if necessary. And make sure that the script is executable:

```sh
chmod +x {EXTENSION_PATH}/apps/empty-trash.sh
```

## Bug Reporting

When reporting bugs. Please indicate the following:

* Linux Flavor/Distribution and version
* Gnome version (45.xx)
* Dash2Dock Animated release number

Check for any exceptions in the logs by running the following at the terminal:

```sh
journalctl /usr/bin/gnome-shell -f -o cat
```

To check incompatibilities with other extensions, try running Dash2Dock Animated with other extensions disabled.

To check for lag or inefficiency. Run the following in the terminal and observer gnome-shell CPU usage.

```sh
top -d 0.5
```

On my old Dell XPS13 i5-6200U. CPU usage is about 50% with icons quality high, frame rate high, shadows on.

Please be specific on the errors encountered. Add screenshots whenever possible.

## Testing Rig

* Arch Linux (Gnome 45.5)
* Ubuntu 23 (Gnome 45.0)
* Debian 12 (Gnome 43.9)
* Manjaro Linux (Gnome 45.3)
* Fedora 39 (Gnome 45.0)
* Fedora 40 Beta (Gnome 46.0)
* Gnome OS Nightly (virtual, Gnome 46)

## License

Distributed under the GPL 3.0 License. See [LICENSE](https://github.com/icedman/dash2dock-lite/blob/main/LICENSE.md) for more information.
