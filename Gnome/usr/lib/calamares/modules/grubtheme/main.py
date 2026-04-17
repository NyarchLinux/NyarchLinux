#!/usr/bin/env python3

import os
import subprocess
import re
import libcalamares
import glob


def detect_resolution():

    try:
        result = subprocess.run(
            ["xrandr", "--current"],
            capture_output=True,
            text=True,
            check=True
        ).stdout
        patern = "primary\\D+(\\d+x\\d+)"
        return re.search(patern, result).group(1)
        
    except Exception as e:
        libcalamares.utils.warning(f"xrandr failed: {e}")



def run():

    root_mount_point = libcalamares.globalstorage.value("rootMountPoint")
    temp_res_file_path = None

    if not root_mount_point:
        libcalamares.utils.warning("Root mount point not found - skipping module resolution detection")
    
    else:
        libcalamares.utils.debug(
            f"Target root: {root_mount_point}"
        )

        # Detect resolution - from live env
        resolution = detect_resolution()

        if resolution:
            # Save resolution to tmp file

            temp_res_file_path = os.path.join(
                root_mount_point,
                "tmp",
                "grub_res"
            )

            os.makedirs(
                os.path.dirname(temp_res_file_path),
                exist_ok=True
            )

            with open(temp_res_file_path, "w") as f:
                f.write(resolution)

            libcalamares.utils.debug(
                f"Resolution {resolution} saved"
            )

        else:
            libcalamares.utils.warning(
                "Module resolution detection failed"
            )

    # Install package - to target env
    try:

        pkg_path = glob.glob("/opt/ezrepo/grub-theme-Nyarch*.pkg.tar.zst")[0]

        cmd = [
            "pacman",
            "-U",
            "--noconfirm",
            pkg_path
        ]

        libcalamares.utils.debug(
            f"Running: {' '.join(cmd)}"
        )
        
        result = libcalamares.utils.target_env_call(cmd)

        if result != 0:
            libcalamares.utils.warning("Error while installing package via pacman")

    except Exception as e:
        libcalamares.utils.warning(f"Pacman failed: {e}")

    
    # Clean tmp file
    if temp_res_file_path:
        libcalamares.utils.debug("Removind tmp file")
        try:
            os.remove(temp_res_file_path)
        except Exception as e:
            libcalamares.utils.warning(f"Fail to remove tmp file:\n{e}")
   

    # End
    return None

