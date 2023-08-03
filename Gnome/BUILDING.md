# Building

## Requisites and development environment
- First of all, to build this distribution you need an Arch Linux installation, or a derivate that ships archiso. We strongly suggest you to use [Ezarcher](https://sourceforge.net/projects/ezarch/).
- It is strongly suggested to run a full system update before building
```bash
sudo pacman -Syu
```
- You need to install `archiso` package
```bash
sudo pacman -S archiso
```
- If you want to ship pre-installed flatpak, install flatpak and run install_flatpaks.sh
```bash
sudo pacman -S flatpak
sudo ./install_flatpaks.sh
```
**If you have pre-installed flatpaks on your system, they will be added to the ISO**

## Running the script
- To build the ISO just run 
```bash
sudo ./steps.sh
```
And you will find the ISO in ./out

## Editing installed packages
### Packages from official repositories
- Every package in packages.x86_64 will be installed
- Also take a look at ./etc directory for configuration files
### Adding custom packages
- You can install flatpaks by just installing it on your system
- First of all you need a PKGBUILD file, write it or download it from the internet, you can download them from [Arch User Repository](https://aur.archlinux.org/). Pay attention to some broken packages though.
- Put it into a folder and run `makepkg` 
- Add the needed dependencies to packages.x84_64, and also add the package name to the file
- Put the generated .tar.zst file to `./usr/ezrepo` (we decided to maintain attribution for the repo to EzArcher)
- Run in that folder 
```bash
repo-add ezrepo.db.tar.gz file.tar.zst
```
replacing `file.tar.zst` with the file name.
- You may also like to add some of the package's configurations to ./etc
## Editing default desktop configuration
Any file in `./etc/skel/` will be put in user's home. There you can store dotfiles related to a specific desktop configuration.
