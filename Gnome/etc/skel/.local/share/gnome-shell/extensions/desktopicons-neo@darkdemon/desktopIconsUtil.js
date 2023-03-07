/* LICENSE INFORMATION
 * 
 * Desktop Icons: Neo - A desktop icons extension for GNOME with numerous features, 
 * customizations, and optimizations.
 * 
 * Copyright 2021 Abdurahman Elmawi (cooper64doom@gmail.com)
 * 
 * This project is based on Desktop Icons NG (https://gitlab.com/rastersoft/desktop-icons-ng),
 * a desktop icons extension for GNOME licensed under the GPL v3.
 * 
 * This project is free and open source software as described in the GPL v3.
 * 
 * This project (Desktop Icons: Neo) is licensed under the GPL v3. To view the details of this license, 
 * visit https://www.gnu.org/licenses/gpl-3.0.html for the necessary information
 * regarding this project's license.
 */

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Prefs = imports.preferences;
const Enums = imports.enums;
const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;

function getDesktopDir() {
    let desktopPath = Prefs.desktopSettings.get_string('desktop-directory');
    if(desktopPath == 'null'){
    	desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
    	Prefs.desktopSettings.set_string('desktop-directory', desktopPath);
    }
    return Gio.File.new_for_commandline_arg(desktopPath);
}

function getScriptsDir() {
    let scriptsDir =  GLib.build_filenamev([GLib.get_home_dir(), Enums.NAUTILUS_SCRIPTS_DIR]);
    return Gio.File.new_for_commandline_arg(scriptsDir);
}

function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
};

function spawnCommandLine(command_line) {
    try {
        let [success, argv] = GLib.shell_parse_argv(command_line);
        trySpawn(null, argv);
    } catch (err) {
        print(`${command_line} failed with ${err}`);
    }
}

function launchTerminal(workdir, command) {
    let terminalSettings = new Gio.Settings({ schema_id: Enums.TERMINAL_SCHEMA });
    let exec = terminalSettings.get_string(Enums.EXEC_KEY);
    let argv = [exec, `--working-directory=${workdir}`];
    if (command) {
        argv.push('-e');
        argv.push(command);
    }
    trySpawn(workdir, argv);
}

function trySpawn(workdir, argv) {
    /* The following code has been extracted from GNOME Shell's
     * source code in Misc.Util.trySpawn function and modified to
     * set the working directory.
     *
     * https://gitlab.gnome.org/GNOME/gnome-shell/blob/gnome-3-30/js/misc/util.js
     */

    var success, pid;
    try {
        [success, pid] = GLib.spawn_async(workdir, argv, null,
                                          GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                          null);
    } catch (err) {
        /* Rewrite the error in case of ENOENT */
        if (err.matches(GLib.SpawnError, GLib.SpawnError.NOENT)) {
            throw new GLib.SpawnError({ code: GLib.SpawnError.NOENT,
                                        message: _("Command not found") });
        } else if (err instanceof GLib.Error) {
            // The exception from gjs contains an error string like:
            //   Error invoking GLib.spawn_command_line_async: Failed to
            //   execute child process "foo" (No such file or directory)
            // We are only interested in the part in the parentheses. (And
            // we can't pattern match the text, since it gets localized.)
            let message = err.message.replace(/.*\((.+)\)/, '$1');
            throw new (err.constructor)({ code: err.code,
                                          message: message });
        } else {
            throw err;
        }
    }
    // Dummy child watch; we don't want to double-fork internally
    // because then we lose the parent-child relationship, which
    // can break polkit.  See https://bugzilla.redhat.com//show_bug.cgi?id=819275
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {});
}

function distanceBetweenPoints(x, y, x2, y2) {
    return (Math.pow(x - x2, 2) + Math.pow(y - y2, 2));
}

function getExtraFolders() {
    let extraFolders = new Array();
    if (Prefs.desktopSettings.get_boolean('show-home')) {
        extraFolders.push([Gio.File.new_for_commandline_arg(GLib.get_home_dir()), Enums.FileType.USER_DIRECTORY_HOME]);
    }
    if (Prefs.desktopSettings.get_boolean('show-trash')) {
        extraFolders.push([Gio.File.new_for_uri('trash:///'), Enums.FileType.USER_DIRECTORY_TRASH]);
    }
    return extraFolders;
}

function getMounts(volumeMonitor) {
    let show_volumes = Prefs.desktopSettings.get_boolean('show-volumes');
    let show_network = Prefs.desktopSettings.get_boolean('show-network-volumes');

    try {
        var mounts = volumeMonitor.get_mounts();
    } catch(e) {
        print(`Failed to get the list of mounts with ${e}`);
        return [];
    }

    let result = [];
    let uris = [];
    for (let mount of mounts) {
        try {
            let is_drive = (mount.get_drive() != null) || (mount.get_volume() != null);
            let uri = mount.get_default_location().get_uri();
            if (((is_drive && show_volumes) || (!is_drive && show_network)) && (!(uris.includes(uri)))) {
                result.push([mount.get_default_location(), Enums.FileType.EXTERNAL_DRIVE, mount]);
                uris.push(uri);
            }
        } catch(e) {
            print(`Failed with ${e} while getting volume`);
        }
    }
    return result;
}

function getFileExtensionOffset(filename, isDirectory) {
    let offset = filename.length;

    if (!isDirectory) {
        let doubleExtensions = ['.gz', '.bz2', '.sit', '.Z', '.bz', '.xz'];
        for (let extension of doubleExtensions) {
            if (filename.endsWith(extension)) {
                offset -= extension.length;
                filename = filename.substring(0, offset);
                break;
            }
        }
        let lastDot = filename.lastIndexOf('.');
        if (lastDot > 0)
            offset = lastDot;
    }
    return offset;
}

function getFilesFromNautilusDnD(selection, type) {
    let data = String.fromCharCode.apply(null, selection.get_data());
    let retval = [];
    let elements = data.split('\r\n');
    for(let item of elements) {
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


function isExecutable(mimetype, file_name) {

    if (Gio.content_type_can_be_executable(mimetype)) {
        // Gnome Shell 40 removed this option
        try {
            var action = Prefs.nautilusSettings.get_string('executable-text-activation');
        } catch(e) {
            var action = 'ask';
        }
        switch (action) {
            default: // display
                return Enums.WhatToDoWithExecutable.DISPLAY;
            case 'launch':
                return Enums.WhatToDoWithExecutable.EXECUTE;
            case 'ask':
                let dialog = new Gtk.MessageDialog({
                    text: _("Do you want to run “{0}”, or display its contents?").replace('{0}', file_name),
                    secondary_text: _("“{0}” is an executable text file.").replace('{0}', file_name),
                    message_type: Gtk.MessageType.QUESTION,
                    buttons: Gtk.ButtonsType.NONE
                });
                dialog.add_button(_("Run in terminal"),
                                  Enums.WhatToDoWithExecutable.EXECUTE_IN_TERMINAL);
                dialog.add_button(_("Display Text"),
                                  Enums.WhatToDoWithExecutable.DISPLAY);
                dialog.add_button(_("Cancel"),
                                  Gtk.ResponseType.CANCEL);
                dialog.add_button(_("Execute"),
                                  Enums.WhatToDoWithExecutable.EXECUTE);
                dialog.set_default_response(Gtk.ResponseType.CANCEL);

                dialog.show_all();
                let result = dialog.run();
                dialog.destroy();
                if ((result != Enums.WhatToDoWithExecutable.EXECUTE) &&
                    (result != Enums.WhatToDoWithExecutable.EXECUTE_IN_TERMINAL) &&
                    (result != Enums.WhatToDoWithExecutable.DISPLAY)) {
                        return Gtk.ResponseType.CANCEL;
                } else {
                        return result;
                }
        }
    } else {
        return Enums.WhatToDoWithExecutable.DISPLAY;
    }
}

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
        } catch(e) {}
    }
}

function windowHidePagerTaskbarModal(window, modal) {
    let using_X11 = Gdk.Display.get_default().constructor.$gtype.name === 'GdkX11Display';
    if (using_X11) {
        window.set_type_hint(Gdk.WindowTypeHint.NORMAL);
        window.set_skip_taskbar_hint(true);
        window.set_skip_pager_hint(true);
    } else {
        let title = window.get_title();
        if (modal) {
            title = title;
        } else {
            title = title;
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
