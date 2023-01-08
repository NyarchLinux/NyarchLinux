--------------------------------------------------
Ezarcher Linux - Live Desktop 
ezarch CLI Install Scripts & Calamares Installer
--------------------------------------------------

Welcome to Ezarcher

The Ezarcher Linux ISO is a full featured Arch Linux desktop. The live system comes with many common desktop software packages and tools to install Arch Linux on your system. There are two installer methods, the Calamares Installer Framework and my own ezarch scripts. The Calamares installer is located in the System menu and titled Install System. Finally, there is also the choice to use the install guides to copy and paste commands that will install Arch, the Arch Way.

The live user's /home folder has an ezarcher folder with several folders containing all the project files for the Ezarcher system. The ~/ezarcher/Docs folder contains some introductory readme files and suggested steps to enhance the system. The ~/ezarcher/Guides folder has the original ezarch install guides with each step to install an Arch system from scratch. The ~/ezarcher/PkgBuilds folder contains the the PKGBUILD files for the Calamares and its two helper applications. The ~/ezarcher/Scripts folder contains the ezarch.bios and ezarch.uefi install scripts to perform an menu driven Arch installation. The ~/ezarcher/Templates folder contains tar files for each of the live ISOs with a desktop environment.

User password: live
Root password: toor

Have fun, stay safe. :-)


--------------------------------------
Templates to Build Your Own ISOs
--------------------------------------

Ezarcher Desktop Templates
https://sourceforge.net/projects/ezarch/files/Ezarcher/Templates/

The Ezarcher Desktop Templates project is a simple set of files and a steps.sh script to automate the building of a live desktop Arch Linux ISO that contains one of several desktops, and includes the ezarch install scripts in the ~/ezarcher/Scripts folder. The Calamares Installer is also available in each desktop template. I must express my sincere gratitude and give full credit to Matias Calabrese for his exemplary contribution of transforming the ezarcher templates to work with the new archiso program and process. This project would not be where it is today without his assistance and contributions. Thank you, Matias! :-)

The steps.sh file copies the necessary files into the build folder, in this case, "ezreleng" and runs the mkarchiso script to produce the Ezarcher GUI ISO image. In addition to the standard Arch Linux install media packages, I have added one of six desktop environments, a plethora of multimedia software, system maintenance and recovery tools, filesystem drivers, wifi drivers, and other assorted software in order to provide a full-featured desktop experience. The script creates a live user and assigns the password "live." The root user is given the password "toor" (root spelled backwards). Sddm is enabled, networkmanager and systemd-resolved are enabled, haveged is enabled, Cups is enabled, and the graphical runlevel target is set.

I have included the ezarch.bios and ezarch.uefi install scripts for you to install a fresh Arch Linux system using my preferred install method. The install scripts are located in the ~/ezarcher/Scripts folder and can be launched by using su to get a root terminal, open a terminal in the ~/ezarcher/Scripts and type: ./ezarch.bios or ./ezarch.uefi depending on the type of installation required. The ezmaint script has nine various maintenance functions that should be performed occasionally on any Arch based system. The menu gives easy access to these functions:

-------------------------------------
 Ezarcher Maintenance Script
-------------------------------------

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


readme.txt
# Revision: 2022.12.06 -- by eznix (https://sourceforge.net/projects/ezarch/)
# (GNU/General Public License version 3.0)
