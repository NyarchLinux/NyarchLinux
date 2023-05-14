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
'use strict';
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Config = imports.misc.config;
const ByteArray = imports.byteArray;

const Me = ExtensionUtils.getCurrentExtension();
const EmulateX11 = Me.imports.emulateX11WindowType;
const VisibleArea = Me.imports.visibleArea;
const GnomeShellOverride = Me.imports.gnomeShellOverride;

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

// This object will contain all the global variables
let data = {};

var DesktopIconsUsableArea = null;

/**
 *
 */
function init() {
    data.isEnabled = false;
    data.launchDesktopId = 0;
    data.currentProcess = null;
    data.dbusTimeoutId = 0;

    data.GnomeShellOverride = null;
    data.GnomeShellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

    /* The constructor of the EmulateX11 class only initializes some
     * internal properties, but nothing else. In fact, it has its own
     * enable() and disable() methods. That's why it could have been
     * created here, in init(). But since the rule seems to be NO CLASS
     * CREATION IN INIT UNDER NO CIRCUMSTANCES...
     */
    data.x11Manager = null;
    data.visibleArea = null;

    /* Ensures that there aren't "rogue" processes.
     * This is a safeguard measure for the case of Gnome Shell being
     * relaunched (for example, under X11, with Alt+F2 and R), to kill
     * any old DING instance. That's why it must be here, in init(),
     * and not in enable() or disable() (disable already guarantees that
     * the current instance is killed).
     */
    doKillAllOldDesktopProcesses();
}


/**
 * Enables the extension
 */
function enable() {
    if (!data.GnomeShellOverride) {
        data.GnomeShellOverride = new GnomeShellOverride.GnomeShellOverride();
    }

    if (!data.x11Manager) {
        data.x11Manager = new EmulateX11.EmulateX11WindowType();
    }
    if (!DesktopIconsUsableArea) {
        DesktopIconsUsableArea = new VisibleArea.VisibleArea();
        data.visibleArea = DesktopIconsUsableArea;
    }
    // If the desktop is still starting up, we wait until it is ready
    if (Main.layoutManager._startingUp) {
        data.startupPreparedId = Main.layoutManager.connect('startup-complete', innerEnable);
    } else {
        data.startupPreparedId = null;
        innerEnable();
    }
}

/**
 * The true code that configures everything and launches the desktop program
 */
function innerEnable() {
    if (data.startupPreparedId !== null) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = null;
    }

    data.GnomeShellOverride.enable();

    // under X11 we don't need to cheat, so only do all this under wayland
    if (Meta.is_wayland_compositor()) {
        data.x11Manager.enable();
    }

    /*
     * If the desktop geometry changes (because a new monitor has been added, for example),
     * we kill the desktop program. It will be relaunched automatically with the new geometry,
     * thus adapting to it on-the-fly.
     */
    data.monitorsChangedId = Main.layoutManager.connect('monitors-changed', updateDesktopGeometry);
    /*
     * Any change in the workareas must be detected too, for example if the used size
     * changes.
     */
    data.workareasChangedId = global.display.connect('workareas-changed', updateDesktopGeometry);

    /*
     * This callback allows to detect a change in the working area (like when changing the Scale value)
     */
    data.visibleAreaId = data.visibleArea.connect('updated-usable-area', updateDesktopGeometry);

    data.isEnabled = true;
    if (data.launchDesktopId) {
        GLib.source_remove(data.launchDesktopId);
    }

    /*
     * Due to a problem in the Clipboard API in Gtk3, it is not possible to do the CUT/COPY operation from
     * dynamic languages like Javascript, because one of the methods needed is marked as NOT INTROSPECTABLE
     *
     * https://discourse.gnome.org/t/missing-gtk-clipboard-set-with-data-in-gtk-3/6920
     *
     * The right solution is to migrate DING to Gtk4, where the whole API is available, but that is a very
     * big task, so in the meantime, we take advantage of the fact that the St API, in Gnome Shell, can put
     * binary contents in the clipboard, so we use DBus to notify that we want to do a CUT or a COPY operation,
     * passing the URIs as parameters, and delegate that to the DING Gnome Shell extension. This is easily done
     * with a GLib.SimpleAction.
     */
    data.dbusConnectionId = Gio.bus_own_name(Gio.BusType.SESSION, 'com.rastersoft.dingextension', Gio.BusNameOwnerFlags.NONE, null, (connection, name) => {
        data.dbusConnection = connection;

        data.doCopy = new Gio.SimpleAction({
            name: 'doCopy',
            parameter_type: new GLib.VariantType('as'),
        });
        data.doCut = new Gio.SimpleAction({
            name: 'doCut',
            parameter_type: new GLib.VariantType('as'),
        });
        data.disableTimer = new Gio.SimpleAction({
            name: 'disableTimer',
        });
        data.desktopGeometry = Gio.SimpleAction.new_stateful('desktopGeometry', new GLib.VariantType('av'), getDesktopGeometry());
        data.desktopGeometry.set_enabled(true);
        data.doCopyId = data.doCopy.connect('activate', manageCutCopy);
        data.doCutId = data.doCut.connect('activate', manageCutCopy);
        data.disableTimerId = data.disableTimer.connect('activate', () => {
            if (data.currentProcess && data.currentProcess.subprocess) {
                data.currentProcess.cancel_timer();
            }
        });
        data.actionGroup = new Gio.SimpleActionGroup();
        data.actionGroup.add_action(data.doCopy);
        data.actionGroup.add_action(data.doCut);
        data.actionGroup.add_action(data.disableTimer);
        data.actionGroup.add_action(data.desktopGeometry);

        data.dbusConnectionGroupId = data.dbusConnection.export_action_group(
            '/com/rastersoft/dingextension/control',
            data.actionGroup
        );
        launchDesktop();
    }, null);
}

/*
 * Before Gnome Shell 40, St API couldn't access binary data in the clipboard, only text data. Also, the
 * original Desktop Icons was a pure extension, so it was limited to what Clutter and St offered. That was
 * the reason why Nautilus accepted a text format for CUT and COPY operations in the form
 *
 *     x-special/nautilus-clipboard
 *     OPERATION
 *     FILE_URI
 *     [FILE_URI]
 *     [...]
 *
 * In Gnome Shell 40, St was enhanced and now it supports binary data; that's why Nautilus migrated to a
 * binary format identified by the atom 'x-special/gnome-copied-files', where the CUT or COPY operation is
 * shared.
 *
 * To maintain compatibility, we check the current Gnome Shell version and, based on that, we use the
 * binary or the text clipboards.
 */
/**
 *
 * @param action
 * @param parameters
 */
function manageCutCopy(action, parameters) {
    let content = '';
    if (data.GnomeShellVersion < 40) {
        content = 'x-special/nautilus-clipboard\n';
    }
    if (action.name == 'doCut') {
        content += 'cut\n';
    } else {
        content += 'copy\n';
    }

    let first = true;
    for (let file of parameters.recursiveUnpack()) {
        if (!first) {
            content += '\n';
        }
        first = false;
        content += file;
    }

    if (data.GnomeShellVersion < 40) {
        Clipboard.set_text(CLIPBOARD_TYPE, `${content}\n`);
    } else {
        Clipboard.set_content(CLIPBOARD_TYPE, 'x-special/gnome-copied-files', ByteArray.toGBytes(ByteArray.fromString(content)));
    }
}

/**
 * Kills the current desktop program
 */
function killCurrentProcess() {
    if (data.launchDesktopId) {
        GLib.source_remove(data.launchDesktopId);
        data.launchDesktopId = 0;
    }

    // kill the desktop program. It will be reloaded automatically.
    if (data.currentProcess && data.currentProcess.subprocess) {
        data.currentProcess.cancel_timer();
        data.currentProcess.cancellable.cancel();
        data.currentProcess.subprocess.send_signal(15);
    }
    data.currentProcess = null;
    data.x11Manager.setWaylandClient(null);
}

/**
 * Disables the extension
 */
function disable() {
    DesktopIconsUsableArea = null;
    data.isEnabled = false;
    killCurrentProcess();
    data.GnomeShellOverride.disable();
    data.x11Manager.disable();
    data.visibleArea.disable();

    if (data.doCopyId) {
        data.doCopy.disconnect(data.doCopyId);
        data.doCopyId = 0;
        data.doCopy = undefined;
    }

    if (data.doCutId) {
        data.doCut.disconnect(data.doCutId);
        data.doCutId = 0;
        data.doCut = undefined;
    }

    if (data.disableTimerId) {
        data.disableTimer.disconnect(data.disableTimerId);
        data.disableTimerId = 0;
        data.disableTimer = undefined;
    }

    data.desktopGeometry = undefined;

    // disconnect signals only if connected
    if (data.dbusConnectionGroupId) {
        data.dbusConnection.unexport_action_group(data.dbusConnectionGroupId);
        data.dbusConnectionGroupId = 0;
    }

    if (data.dbusConnectionId) {
        Gio.bus_unown_name(data.dbusConnectionId);
        data.dbusConnectionId = 0;
    }
    data.actionGroup = undefined;

    if (data.visibleAreaId) {
        data.visibleArea.disconnect(data.visibleAreaId);
        data.visibleAreaId = 0;
    }
    if (data.startupPreparedId) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = 0;
    }
    if (data.monitorsChangedId) {
        Main.layoutManager.disconnect(data.monitorsChangedId);
        data.monitorsChangedId = 0;
    }
    if (data.workareasChangedId) {
        global.display.disconnect(data.workareasChangedId);
        data.workareasChangedId = 0;
    }
    if (data.sizeChangedId) {
        global.window_manager.disconnect(data.sizeChangedId);
        data.sizeChangedId = 0;
    }
    if (data.dbusTimeoutId) {
        GLib.source_remove(data.dbusTimeoutId);
        data.dbusTimeoutId = 0;
    }
}

/**
 *
 */
function updateDesktopGeometry() {
    if (data.actionGroup && (Main.layoutManager.monitors.length != 0)) {
        data.actionGroup.change_action_state('desktopGeometry', getDesktopGeometry());
    }
}

/**
 *
 */
function getDesktopGeometry() {
    let desktopList = [];
    let ws = global.workspace_manager.get_workspace_by_index(0);
    for (let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
        let area = data.visibleArea.getMonitorGeometry(ws, monitorIndex);
        let desktopListElement = new GLib.Variant('a{sd}', {
            'x': area.x,
            'y': area.y,
            'width': area.width,
            'height': area.height,
            'zoom': area.scale,
            'marginTop': area.marginTop,
            'marginBottom': area.marginBottom,
            'marginLeft': area.marginLeft,
            'marginRight': area.marginRight,
            monitorIndex,
            'primaryMonitor': Main.layoutManager.primaryIndex,
        });
        desktopList.push(desktopListElement);
    }
    return new GLib.Variant('av', desktopList);
}


/**
 * This function checks all the processes in the system and kills those
 * that are a desktop manager from the current user (but not others).
 * This allows to avoid having several ones in case gnome shell resets,
 * or other odd cases. It requires the /proc virtual filesystem, but
 * doesn't fail if it doesn't exist.
 */

/**
 *
 */
function doKillAllOldDesktopProcesses() {
    let procFolder = Gio.File.new_for_path('/proc');
    if (!procFolder.query_exists(null)) {
        return;
    }

    let fileEnum = procFolder.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = fileEnum.next_file(null))) {
        let filename = info.get_name();
        if (!filename) {
            break;
        }
        let processPath = GLib.build_filenamev(['/proc', filename, 'cmdline']);
        let processUser = Gio.File.new_for_path(processPath);
        if (!processUser.query_exists(null)) {
            continue;
        }
        let [binaryData, etag] = processUser.load_bytes(null);
        let contents = '';
        let readData = binaryData.get_data();
        for (let i = 0; i < readData.length; i++) {
            if (readData[i] < 32) {
                contents += ' ';
            } else {
                contents += String.fromCharCode(readData[i]);
            }
        }
        let path = `gjs ${GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'ding.js'])}`;
        if (contents.startsWith(path)) {
            let proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
            proc.init(null);
            proc.wait(null);
        }
    }
}

/**
 *
 * @param reloadTime
 */
function doRelaunch(reloadTime) {
    data.currentProcess = null;
    data.x11Manager.setWaylandClient(null);
    if (data.isEnabled) {
        if (data.launchDesktopId) {
            GLib.source_remove(data.launchDesktopId);
        }
        data.launchDesktopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, reloadTime, () => {
            data.launchDesktopId = 0;
            launchDesktop();
            return false;
        });
    }
}

/**
 * Launches the desktop program, passing to it the current desktop geometry for each monitor
 * and the path where it is stored. It also monitors it, to relaunch it in case it dies or is
 * killed. Finally, it reads STDOUT and STDERR and redirects them to the journal, to help to
 * debug it.
 */
function launchDesktop() {
    global.log('Launching DING process');
    let argv = [];
    argv.push(GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'ding.js']));
    // Specify that it must work as true desktop
    argv.push('-E');
    // The path. Allows the program to find translations, settings and modules.
    argv.push('-P');
    argv.push(ExtensionUtils.getCurrentExtension().path);

    data.currentProcess = new LaunchSubprocess(0, 'DING');
    data.currentProcess.set_cwd(GLib.get_home_dir());
    if (data.currentProcess.spawnv(argv) === null) {
        doRelaunch(1000);
        return;
    }
    data.x11Manager.setWaylandClient(data.currentProcess);
    data.launchTime = GLib.get_monotonic_time();

    /*
     * If the desktop process dies, wait 100ms and relaunch it, unless the exit status is different than
     * zero, in which case it will wait one second. This is done this way to avoid relaunching the desktop
     * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
     */
    data.currentProcess.subprocess.wait_async(null, (obj, res) => {
        let delta = GLib.get_monotonic_time() - data.launchTime;
        if (delta < 1000000) {
            // If the process is dying over and over again, ensure that it isn't respawn faster than once per second
            var reloadTime = 1000;
        } else {
            // but if the process just died after having run for at least one second, reload it ASAP
            var reloadTime = 1;
        }
        obj.wait_finish(res);
        if (!data.currentProcess || obj !== data.currentProcess.subprocess) {
            return;
        }
        if (obj.get_if_exited()) {
            obj.get_exit_status();
        }
        doRelaunch(reloadTime);
    });
}

/**
 * This class encapsulates the code to launch a subprocess that can detect whether a window belongs to it
 * It only accepts to do it under Wayland, because under X11 there is no need to do these tricks
 *
 * It is compatible with https://gitlab.gnome.org/GNOME/mutter/merge_requests/754 to simplify the code
 *
 * @param {int} flags Flags for the SubprocessLauncher class
 * @param {string} process_id An string id for the debug output
 */
var LaunchSubprocess = class {
    constructor(flags, process_id) {
        this._process_id = process_id;
        this.cancellable = new Gio.Cancellable();
        this._launcher = new Gio.SubprocessLauncher({flags: flags | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE});
        if (Meta.is_wayland_compositor()) {
            try {
                this._waylandClient = Meta.WaylandClient.new(this._launcher);
            } catch (e) {
                this._waylandClient = Meta.WaylandClient.new(global.context,
                                                             this._launcher);
            }

            if (Config.PACKAGE_VERSION == '3.38.0') {
                // workaround for bug in 3.38.0
                this._launcher.ref();
            }
        }
        this.subprocess = null;
        this.process_running = false;
        this._launch_timer = 0;
        this._waiting_for_windows = 0;
    }

    spawnv(argv) {
        try {
            if (Meta.is_wayland_compositor()) {
                this.subprocess = this._waylandClient.spawnv(global.display, argv);
            } else {
                this.subprocess = this._launcher.spawnv(argv);
            }
        } catch (e) {
            this.subprocess = null;
            global.log(`Error while trying to launch DING process: ${e.message}\n${e.stack}`);
        }
        // This is for GLib 2.68 or greater
        if (this._launcher.close) {
            this._launcher.close();
        }
        this._launcher = null;
        if (this.subprocess) {
            /*
                 * It reads STDOUT and STDERR and sends it to the journal using global.log(). This allows to
                 * have any error from the desktop app in the same journal than other extensions. Every line from
                 * the desktop program is prepended with the "process_id" parameter sent in the constructor.
                 */
            this._dataInputStream = Gio.DataInputStream.new(this.subprocess.get_stdout_pipe());
            this.read_output();
            this.subprocess.wait_async(this.cancellable, () => {
                this.process_running = false;
                this._dataInputStream = null;
                this.cancellable = null;
                if (this._launch_timer != 0) {
                    GLib.source_remove(this._launch_timer);
                    this._launch_timer = 0;
                    this._waiting_for_windows = 0;
                }
            });
            this.process_running = true;
            if (Meta.is_wayland_compositor() && (Main.layoutManager.monitors.length != 0)) {
                // This ensures that, if the DING window isn't detected in three seconds
                // after launch, the desktop will be killed and, thus, relaunched again.
                this._waiting_for_windows = Main.layoutManager.monitors.length;
                this._launch_timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
                    this._launch_timer = 0;
                    this.subprocess.force_exit();
                    return false;
                });
            }
        }
        return this.subprocess;
    }

    cancel_timer() {
        if (this._launch_timer != 0) {
            GLib.source_remove(this._launch_timer);
            this._launch_timer = 0;
            this._waiting_for_windows = 0;
        }
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    read_output() {
        if (!this._dataInputStream) {
            return;
        }
        this._dataInputStream.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (object, res) => {
            try {
                const [output, length] = object.read_line_finish_utf8(res);
                if (length) {
                    print(`${this._process_id}: ${output}`);
                }
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                    return;
                }
                logError(e, `${this._process_id}_Error`);
            }

            this.read_output();
        });
    }

    /**
     * Queries whether the passed window belongs to the launched subprocess or not.
     *
     * @param {MetaWindow} window The window to check.
     */
    query_window_belongs_to(window) {
        if (!Meta.is_wayland_compositor()) {
            return false;
        }
        if (!this.process_running) {
            return false;
        }
        try {
            let ownsWindow = this._waylandClient.owns_window(window);
            if (ownsWindow && (this._launch_timer != 0) && (this._waiting_for_windows != 0)) {
                global.log(`Received notification for window. ${this._waiting_for_windows - 1} notifications remaining.`);
                this._waiting_for_windows--;
                if (this._waiting_for_windows == 0) {
                    GLib.source_remove(this._launch_timer);
                    this._launch_timer = 0;
                }
            }
            return ownsWindow;
        } catch (error) {
            global.log(`Exception error: ${error.message}\n${error.stack}`);
            return false;
        }
    }

    show_in_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running) {
            this._waylandClient.show_in_window_list(window);
        }
    }

    hide_from_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running) {
            this._waylandClient.hide_from_window_list(window);
        }
    }
};
