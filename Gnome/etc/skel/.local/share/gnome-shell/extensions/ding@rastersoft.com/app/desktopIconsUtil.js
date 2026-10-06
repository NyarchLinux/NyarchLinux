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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import * as Prefs from './preferences.js';
import * as Enums from './enums.js';
const Gettext = imports.gettext.domain('ding');
import * as ShowErrorPopup from './showErrorPopup.js';

const _ = Gettext.gettext;

/**
 *
 */
export function getDesktopDir() {
    const desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
    return Gio.File.new_for_commandline_arg(desktopPath);
}

/**
 *
 */
export function getScriptsDir() {
    const scriptsDir = GLib.build_filenamev([GLib.get_home_dir(), Enums.NAUTILUS_SCRIPTS_DIR]);
    return Gio.File.new_for_commandline_arg(scriptsDir);
}

/**
 *
 */
export function getTemplatesDir() {
    const templatesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_TEMPLATES);
    if ((templatesDir === GLib.get_home_dir()) || (templatesDir === null))
        return null;

    return Gio.File.new_for_commandline_arg(templatesDir);
}

/**
 * Returns the state of the modifier keys in the controller
 *
 * @param {Gtk.EventController} controller
 */
export function getControllerStatus(controller) {
    const state = controller.get_current_event_state();
    return {
        shift: !!(state & Gdk.ModifierType.SHIFT_MASK),
        control: !!(state & Gdk.ModifierType.CONTROL_MASK),
        alt: !!(state & Gdk.ModifierType.ALT_MASK),
        super: !!(state & Gdk.ModifierType.SUPER_MASK),
    };
}

/**
 *
 * @param {float} value
 * @param {float} min
 * @param {float} max
 */
export function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
}

/**
 *
 * @param {string} commandLine
 * @param {Array} environ
 */
export function spawnCommandLine(commandLine, environ = null) {
    try {
        const [unused, argv] = GLib.shell_parse_argv(commandLine);
        trySpawn(null, argv, environ);
    } catch (err) {
        print(`${commandLine} failed with ${err}`);
    }
}

/**
 *
 * @param {string} workdir
 * @param {string} command
 */
export function launchTerminal(workdir, command) {
    const settings = new Gio.Settings({schema_id: Enums.TERMINAL_SCHEMA});
    const settingsExec = settings.get_string(Enums.EXEC_KEY);
    const terminals = ['xdg-terminal-exec', settingsExec, 'kgx', 'gnome-terminal'];
    for (const name of terminals) {
        const exec = GLib.find_program_in_path(name);
        if (exec !== null) {
            const argv = [exec];
            if (workdir && (name === 'xdg-terminal-exec'))
                argv.push(`--dir=${workdir}`);

            if (command) {
                argv.push('-e');
                argv.push(command);
            }
            try {
                trySpawn(workdir, argv, null);
                return;
            } catch (err) {
                print(`Starting ${exec} failed with ${err}`);
            }
        }
    }
    new ShowErrorPopup.ShowErrorPopup(
        'No Terminal',
        'Cannot open a terminal, because none is installed or configured properly.',
        true
    );
}

/**
 *
 * @param {string} workdir
 * @param {Array} argv
 * @param {Array} environ
 */
export function trySpawn(workdir, argv, environ = null) {
    /* The following code has been extracted from GNOME Shell's
     * source code in Misc.Util.trySpawn function and modified to
     * set the working directory.
     *
     * https://gitlab.gnome.org/GNOME/gnome-shell/blob/gnome-3-30/js/misc/util.js
     */

    var pid;
    try {
        var [unused, ipid] = GLib.spawn_async(workdir, argv, environ,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null);
        pid = ipid;
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
            const message = err.message.replace(/.*\((.+)\)/, '$1');
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
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => { });
}

/**
 *
 */
export function getFilteredEnviron() {
    const environ = [];
    for (const env of GLib.get_environ()) {
        /* It's a must to remove the WAYLAND_SOCKET environment variable
            because, under Wayland, DING uses an specific socket to allow the
            extension to detect its windows. But the scripts must run under
            the normal socket */
        if (env.startsWith('WAYLAND_SOCKET='))
            continue;

        environ.push(env);
    }
    return environ;
}

/**
 *
 * @param {float} x
 * @param {float} y
 * @param {float} x2
 * @param {float} y2
 */
export function distanceBetweenPoints(x, y, x2, y2) {
    return Math.pow(x - x2, 2) + Math.pow(y - y2, 2);
}

/**
 *
 */
export function getExtraFolders() {
    const extraFolders = [];
    if (Prefs.desktopSettings.get_boolean('show-home'))
        extraFolders.push([Gio.File.new_for_commandline_arg(GLib.get_home_dir()), Enums.FileType.USER_DIRECTORY_HOME]);

    if (Prefs.desktopSettings.get_boolean('show-trash'))
        extraFolders.push([Gio.File.new_for_uri('trash:///'), Enums.FileType.USER_DIRECTORY_TRASH]);

    return extraFolders;
}

/**
 *
 * @param {Gio.VolumeMonitor} volumeMonitor
 */
export function getMounts(volumeMonitor) {
    const showVolumes = Prefs.desktopSettings.get_boolean('show-volumes');
    const showNetwork = Prefs.desktopSettings.get_boolean('show-network-volumes');

    var mounts;
    try {
        mounts = volumeMonitor.get_mounts();
    } catch (e) {
        print(`Failed to get the list of mounts with ${e}`);
        return [];
    }

    const result = [];
    const uris = [];
    for (const mount of mounts) {
        try {
            const isDrive = (mount.get_drive() !== null) || (mount.get_volume() !== null);
            const uri = mount.get_default_location().get_uri();
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
 * @param {string} filename
 * @param {Dictionary} opts
 */
export function getFileExtensionOffset(filename, opts = {'isDirectory': false}) {
    let offset = filename.length;
    let extension = '';
    if (!opts.isDirectory) {
        const doubleExtensions = ['.gz', '.bz2', '.sit', '.Z', '.bz', '.xz', '.zst'];
        for (const item of doubleExtensions) {
            if (filename.endsWith(item)) {
                offset -= item.length;
                extension = filename.substring(offset);
                filename = filename.substring(0, offset);
                break;
            }
        }
        const lastDot = filename.lastIndexOf('.');
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
 * @param {GLib.Bytes} selection
 * @param {int} type
 */
export function getFilesFromNautilusDnD(selection, type) {
    const data = String.fromCharCode.apply(null, selection.get_data());
    const retval = [];
    const elements = data.split('\r\n');
    for (const item of elements) {
        if (item.length === 0)
            continue;

        if (type === 1) {
            // x-special/gnome-icon-list
            const entry = item.split('\r');
            retval.push(entry[0]);
        } else {
            // text/uri-list
            if (item[0] === '#')
                continue;

            retval.push(item);
        }
    }
    return retval;
}

/**
 *
 * @param {string} text
 * @param {string} filename
 * @param {Array} dropCoordinates
 */
export function writeTextFileToDesktop(text, filename, dropCoordinates) {
    const path = GLib.build_filenamev([GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP), filename]);
    const file = Gio.File.new_for_path(path);
    const PERMISSIONS_MODE = 0o744;
    if (GLib.mkdir_with_parents(file.get_parent().get_path(), PERMISSIONS_MODE) === 0)
        file.replace_contents(text, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

    if (dropCoordinates !== null) {
        const info = new Gio.FileInfo();
        info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
        try {
            file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        } catch { }
    }
}

/**
 *
 * @param {Gtk.Window} window
 * @param {boolean} modal
 */
export function windowHidePagerTaskbarModal(window, modal) {
    let title = window.get_title();
    if (title === null)
        title = '';

    if (modal)
        title += '  ';
    else
        title += ' ';

    window.set_title(title);
    window.set_modal(modal);
    window.grab_focus();
}

/**
 *
 * @param {int} ms
 */
export function waitDelayMs(ms) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return false;
        });
    });
}
