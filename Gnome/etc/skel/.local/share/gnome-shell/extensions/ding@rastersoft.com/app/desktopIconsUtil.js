/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* exported getModifiersInDnD, getDesktopDir, getScriptsDir, getTemplatesDir, clamp,
   spawnCommandLine, launchTerminal, getFilteredEnviron, distanceBetweenPoints, getExtraFolders,
   getMounts, getFileExtensionOffset, getFilesFromNautilusDnD, writeTextFileToDesktop,
   windowHidePagerTaskbarModal, waitDelayMs */
'use strict';
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Prefs = imports.preferences;
const Enums = imports.enums;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

/**
 *
 * @param context
 * @param modifiersToCheck
 */
function getModifiersInDnD(context, modifiersToCheck) {
    let device = context.get_device();
    let display = device.get_display();
    let keymap = Gdk.Keymap.get_for_display(display);
    let modifiers = keymap.get_modifier_state();
    return (modifiers & modifiersToCheck) != 0;
}

/**
 *
 */
function getDesktopDir() {
    let desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
    return Gio.File.new_for_commandline_arg(desktopPath);
}

/**
 *
 */
function getScriptsDir() {
    let scriptsDir =  GLib.build_filenamev([GLib.get_home_dir(), Enums.NAUTILUS_SCRIPTS_DIR]);
    return Gio.File.new_for_commandline_arg(scriptsDir);
}

/**
 *
 */
function getTemplatesDir() {
    let templatesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_TEMPLATES);
    if ((templatesDir == GLib.get_home_dir()) || (templatesDir == null)) {
        return null;
    }
    return Gio.File.new_for_commandline_arg(templatesDir);
}

/**
 *
 * @param value
 * @param min
 * @param max
 */
function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
}

/**
 *
 * @param commandLine
 * @param environ
 */
function spawnCommandLine(commandLine, environ = null) {
    try {
        let [success, argv] = GLib.shell_parse_argv(commandLine);
        trySpawn(null, argv, environ);
    } catch (err) {
        print(`${commandLine} failed with ${err}`);
    }
}

/**
 *
 * @param workdir
 * @param command
 */
function launchTerminal(workdir, command) {
    let terminalSettings = new Gio.Settings({schema_id: Enums.TERMINAL_SCHEMA});
    let exec = terminalSettings.get_string(Enums.EXEC_KEY);
    let argv = [exec, `--working-directory=${workdir}`];
    if (command) {
        argv.push('-e');
        argv.push(command);
    }
    trySpawn(workdir, argv, null);
}

/**
 *
 * @param workdir
 * @param argv
 * @param environ
 */
function trySpawn(workdir, argv, environ = null) {
    /* The following code has been extracted from GNOME Shell's
     * source code in Misc.Util.trySpawn function and modified to
     * set the working directory.
     *
     * https://gitlab.gnome.org/GNOME/gnome-shell/blob/gnome-3-30/js/misc/util.js
     */

    var success, pid;
    try {
        [success, pid] = GLib.spawn_async(workdir, argv, environ,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null);
    } catch (err) {
        /* Rewrite the error in case of ENOENT */
        if (err.matches(GLib.SpawnError, GLib.SpawnError.NOENT)) {
            throw new GLib.SpawnError({
                code: GLib.SpawnError.NOENT,
                message: _('Command not found'),
            });
        } else if (err instanceof GLib.Error) {
            // The exception from gjs contains an error string like:
            //   Error invoking GLib.spawn_command_line_async: Failed to
            //   execute child process "foo" (No such file or directory)
            // We are only interested in the part in the parentheses. (And
            // we can't pattern match the text, since it gets localized.)
            let message = err.message.replace(/.*\((.+)\)/, '$1');
            throw new err.constructor({
                code: err.code,
                message,
            });
        } else {
            throw err;
        }
    }
    // Dummy child watch; we don't want to double-fork internally
    // because then we lose the parent-child relationship, which
    // can break polkit.  See https://bugzilla.redhat.com//show_bug.cgi?id=819275
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {});
}

/**
 *
 */
function getFilteredEnviron() {
    let environ = [];
    for (let env of GLib.get_environ()) {
        /* It's a must to remove the WAYLAND_SOCKET environment variable
            because, under Wayland, DING uses an specific socket to allow the
            extension to detect its windows. But the scripts must run under
            the normal socket */
        if (env.startsWith('WAYLAND_SOCKET=')) {
            continue;
        }
        environ.push(env);
    }
    return environ;
}

/**
 *
 * @param x
 * @param y
 * @param x2
 * @param y2
 */
function distanceBetweenPoints(x, y, x2, y2) {
    return Math.pow(x - x2, 2) + Math.pow(y - y2, 2);
}

/**
 *
 */
function getExtraFolders() {
    let extraFolders = [];
    if (Prefs.desktopSettings.get_boolean('show-home')) {
        extraFolders.push([Gio.File.new_for_commandline_arg(GLib.get_home_dir()), Enums.FileType.USER_DIRECTORY_HOME]);
    }
    if (Prefs.desktopSettings.get_boolean('show-trash')) {
        extraFolders.push([Gio.File.new_for_uri('trash:///'), Enums.FileType.USER_DIRECTORY_TRASH]);
    }
    return extraFolders;
}

/**
 *
 * @param volumeMonitor
 */
function getMounts(volumeMonitor) {
    let showVolumes = Prefs.desktopSettings.get_boolean('show-volumes');
    let showNetwork = Prefs.desktopSettings.get_boolean('show-network-volumes');

    try {
        var mounts = volumeMonitor.get_mounts();
    } catch (e) {
        print(`Failed to get the list of mounts with ${e}`);
        return [];
    }

    let result = [];
    let uris = [];
    for (let mount of mounts) {
        try {
            let isDrive = (mount.get_drive() != null) || (mount.get_volume() != null);
            let uri = mount.get_default_location().get_uri();
            if (((isDrive && showVolumes) || (!isDrive && showNetwork)) && !uris.includes(uri)) {
                result.push([mount.get_default_location(), Enums.FileType.EXTERNAL_DRIVE, mount]);
                uris.push(uri);
            }
        } catch (e) {
            print(`Failed with ${e} while getting volume`);
        }
    }
    return result;
}

/**
 *
 * @param filename
 * @param opts
 */
function getFileExtensionOffset(filename, opts = {'isDirectory': false}) {
    let offset = filename.length;
    let extension = '';
    if (!opts.isDirectory) {
        const doubleExtensions = ['.gz', '.bz2', '.sit', '.Z', '.bz', '.xz'];
        for (const item of doubleExtensions) {
            if (filename.endsWith(item)) {
                offset -= item.length;
                extension = filename.substring(offset);
                filename = filename.substring(0, offset);
                break;
            }
        }
        let lastDot = filename.lastIndexOf('.');
        if (lastDot > 0) {
            offset = lastDot;
            extension = filename.substring(offset) + extension;
            filename = filename.substring(0, offset);
        }
    }
    return {offset, 'basename': filename, extension};
}

/**
 *
 * @param selection
 * @param type
 */
function getFilesFromNautilusDnD(selection, type) {
    let data = String.fromCharCode.apply(null, selection.get_data());
    let retval = [];
    let elements = data.split('\r\n');
    for (let item of elements) {
        if (item.length == 0) {
            continue;
        }
        if (type == 1) {
            // x-special/gnome-icon-list
            let entry = item.split('\r');
            retval.push(entry[0]);
        } else {
            // text/uri-list
            if (item[0] == '#') {
                continue;
            }
            retval.push(item);
        }
    }
    return retval;
}

/**
 *
 * @param text
 * @param filename
 * @param dropCoordinates
 */
function writeTextFileToDesktop(text, filename, dropCoordinates) {
    let path = GLib.build_filenamev([GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP),  filename]);
    let file = Gio.File.new_for_path(path);
    const PERMISSIONS_MODE = 0o744;
    if (GLib.mkdir_with_parents(file.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
        let [success, tag] = file.replace_contents(text, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
    if (dropCoordinates != null) {
        let info = new Gio.FileInfo();
        info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
        try {
            file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {}
    }
}

/**
 *
 * @param window
 * @param modal
 */
function windowHidePagerTaskbarModal(window, modal) {
    let usingX11 = Gdk.Display.get_default().constructor.$gtype.name === 'GdkX11Display';
    if (usingX11) {
        window.set_type_hint(Gdk.WindowTypeHint.NORMAL);
        window.set_skip_taskbar_hint(true);
        window.set_skip_pager_hint(true);
    } else {
        let title = window.get_title();
        if (title == null) {
            title = '';
        }
        if (modal) {
            title += '  ';
        } else {
            title += ' ';
        }
        window.set_title(title);
    }
    if (modal) {
        window.connect('focus-out-event', () => {
            window.set_keep_above(true);
            window.stick();
            window.grab_focus();
        });
        window.grab_focus();
    }
}

/**
 *
 * @param ms
 */
function waitDelayMs(ms) {
    return new Promise((resolve, reject) => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return false;
        });
    });
}
