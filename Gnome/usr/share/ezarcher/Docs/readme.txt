Ezarcher Linux - Live Desktop 

Welcome to Ezarcher

The Ezarcher Linux ISO is a full featured Arch Linux desktop. The live system comes with many common desktop software packages and tools to install Arch Linux on your system. There are two installer methods, the Calamares Installer Framework and the Arch Way, by following the Arch Wiki. The Calamares installer is located in the System menu and titled Install System.

The live user's /home folder has an ezarcher folder with several folders containing all the project files for the Ezarcher system. The ~/ezarcher/Docs folder contains some introductory readme files and suggested steps to enhance the system. The ~/ezarcher/Install_Guides folder contains step-by-step installation guides for Arch Linux that follow the same general software selections as the live media. The ~/ezarcher/Install_Scripts folder contains the ezarch.bios and ezarch.uefi bash installation scripts that will install Arch Linux with some predefined setup options and software selections. The ~/ezarcher/PkgBuilds folder contains the the PKGBUILD files for the Calamares and its two helper applications. The ~/ezarcher/Scripts folder contains the ezmaint script for basic maintenance tasks, the grubinstall.sh script to install grub after the package updates. The ~/ezarcher/Templates folder contains tar files for each of the live ISOs with a desktop environment.

User password: live
Root password: toor

Have fun, stay safe. :-)


Templates to Build Your Own ISOs

Ezarcher Desktop Templates
https://sourceforge.net/projects/ezarch/files/Ezarcher/Templates/

The Ezarcher Desktop Templates project is a simple set of files and a steps.sh script to automate the building of a live desktop Arch Linux ISO that contains one of several desktops. The Calamares Installer is available in each desktop template.

The steps.sh file copies the necessary files into the build folder, in this case, "ezreleng" and runs the mkarchiso script to produce the Ezarcher GUI ISO image. In addition to the standard Arch Linux install media packages, I have added one of seven desktop environments, a plethora of multimedia software, system maintenance and recovery tools, filesystem drivers, wifi drivers, and other assorted software in order to provide a full-featured desktop experience. The script creates a live user and assigns the password "live." The root user is given the password "toor" (root spelled backwards). One of the following display managers are enabled: SDDM, Lightdm, GDM, or LXDM (depending on the desktop environment), networkmanager and systemd-resolved are enabled, haveged is enabled, and Cups printing is enabled.

The ezmaint script has eight various maintenance functions that should be performed occasionally on any Arch based system. The menu gives easy access to these functions:

--------------------------------
 Ezarcher Maintenance Script
--------------------------------

  1) Run system update
  2) Reset all pacman keys
  3) Regenerate mirrorlist
  4) Clean package cache
  5) Cleanup journal space
  6) Clean user cache on next boot
  7) Enable Bluetooth service
  8) Enable Firewalld service

  X) Exit

Enter your choice: 

Being based on Arch Linux, Ezarcher Desktop Templates inherits the same rolling release nature and caveats. There may be times when the Arch repositories change and the installer scripts do not function as intended. 

All of my scripts and documents are free for public use and adaptation, as per the terms as licensed under the GNU Public License 3.0. Please use and enjoy. Thank you. :-)

_____
readme.txt
# Revision: 25.05.02 -- by eznix (https://sourceforge.net/projects/ezarch/)
# (GNU/General Public License version 3.0)
