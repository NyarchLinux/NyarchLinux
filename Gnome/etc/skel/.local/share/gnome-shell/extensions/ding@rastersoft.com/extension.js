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
import Clutter from 'gi://Clutter'
import GLib from 'gi://GLib'
import Gio from 'gi://Gio'
import Meta from 'gi://Meta'
import St from 'gi://St'

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js'

import * as EmulateX11 from './emulateX11WindowType.js';
import * as VisibleArea from './visibleArea.js';
import * as GnomeShellOverride from './gnomeShellOverride.js';

const Clipboard = St.Clipboard.get_default();
const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

export default class DING extends Extension {
    constructor(metadata) {
        super(metadata);
        this.DesktopIconsUsableArea = null;
        this.data = {};
        this.data.isEnabled = false;
        this.data.launchDesktopId = 0;
        this.data.currentProcess = null;
        this.data.dbusTimeoutId = 0;
        this.data.switchWorkspaceId = 0;

        this.data.GnomeShellOverride = null;

        /* The constructor of the EmulateX11 class only initializes some
        * internal properties, but nothing else. In fact, it has its own
        * enable() and disable() methods. That's why it could have been
        * created here, in init(). But since the rule seems to be NO CLASS
        * CREATION IN INIT UNDER NO CIRCUMSTANCES...
        */
        this.data.x11Manager = null;
        this.data.visibleArea = null;

        /* Ensures that there aren't "rogue" processes.
        * This is a safeguard measure for the case of Gnome Shell being
        * relaunched (for example, under X11, with Alt+F2 and R), to kill
        * any old DING instance. That's why it must be here, in init(),
        * and not in enable() or disable() (disable already guarantees that
        * the current instance is killed).
        */
        this.doKillAllOldDesktopProcesses();
    }

    enable() {
        if (!this.data.GnomeShellOverride) {
            this.data.GnomeShellOverride = new GnomeShellOverride.GnomeShellOverride();
        }
        if (!this.data.x11Manager) {
            this.data.x11Manager = new EmulateX11.EmulateX11WindowType();
        }
        if (!this.DesktopIconsUsableArea) {
            this.DesktopIconsUsableArea = new VisibleArea.VisibleArea();
            this.data.visibleArea = this.DesktopIconsUsableArea;
        }
        // If the desktop is still starting up, we wait until it is ready
        if (Main.layoutManager._startingUp) {
            this.data.startupPreparedId = Main.layoutManager.connect('startup-complete', () => this.innerEnable());
        } else {
            this.data.startupPreparedId = null;
            this.innerEnable();
        }
    }

    disable() {
        this.DesktopIconsUsableArea = null;
        this.data.isEnabled = false;
        this.killCurrentProcess();
        this.data.GnomeShellOverride.disable();
        this.data.x11Manager.disable();
        this.data.visibleArea.disable();

        if (this.data.doCopyId) {
            this.data.doCopy.disconnect(this.data.doCopyId);
            this.data.doCopyId = 0;
            this.data.doCopy = undefined;
        }

        if (this.data.switchWorkspaceId) {
            global.window_manager.disconnect(this.data.switchWorkspaceId);
            this.data.switchWorkspaceId = 0;
        }
        if (this.data.doCutId) {
            this.data.doCut.disconnect(this.data.doCutId);
            this.data.doCutId = 0;
            this.data.doCut = undefined;
        }

        if (this.data.disableTimerId) {
            this.data.disableTimer.disconnect(this.data.disableTimerId);
            this.data.disableTimerId = 0;
            this.data.disableTimer = undefined;
        }

        this.data.desktopGeometry = undefined;

        // disconnect signals only if connected
        if (this.data.dbusConnectionGroupId) {
            this.data.dbusConnection.unexport_action_group(this.data.dbusConnectionGroupId);
            this.data.dbusConnectionGroupId = 0;
            this.data.dbusConnection = undefined;
        }

        if (this.data.dbusConnectionId) {
            Gio.bus_unown_name(this.data.dbusConnectionId);
            this.data.dbusConnectionId = 0;
        }
        this.data.actionGroup = undefined;

        if (this.data.visibleAreaId) {
            this.data.visibleArea.disconnect(this.data.visibleAreaId);
            this.data.visibleAreaId = 0;
        }
        if (this.data.startupPreparedId) {
            Main.layoutManager.disconnect(this.data.startupPreparedId);
            this.data.startupPreparedId = 0;
        }
        if (this.data.monitorsChangedId) {
            Main.layoutManager.disconnect(this.data.monitorsChangedId);
            this.data.monitorsChangedId = 0;
        }
        if (this.data.workareasChangedId) {
            global.display.disconnect(this.data.workareasChangedId);
            this.data.workareasChangedId = 0;
        }
        if (this.data.sizeChangedId) {
            global.window_manager.disconnect(this.data.sizeChangedId);
            this.data.sizeChangedId = 0;
        }
        if (this.data.dbusTimeoutId) {
            GLib.source_remove(this.data.dbusTimeoutId);
            this.data.dbusTimeoutId = 0;
        }
    }

    /**
     * The true code that configures everything and launches the desktop program
     */
    innerEnable() {
        if (this.data.startupPreparedId !== null) {
            Main.layoutManager.disconnect(this.data.startupPreparedId);
            this.data.startupPreparedId = null;
        }

        this.data.GnomeShellOverride.enable();

        // under X11 we don't need to cheat, so only do all this under wayland
        if (Meta.is_wayland_compositor()) {
            this.data.x11Manager.enable();
        } else {
            this.data.switchWorkspaceId = global.window_manager.connect('switch-workspace', () => {
                let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, global.workspace_manager.get_active_workspace());
                windows = global.display.sort_windows_by_stacking(windows);
                if (windows.length) {
                    let topWindow = windows[windows.length - 1];
                    topWindow.focus(Clutter.CURRENT_TIME);
                }
            });
        }

        /*
        * If the desktop geometry changes (because a new monitor has been added, for example),
        * we kill the desktop program. It will be relaunched automatically with the new geometry,
        * thus adapting to it on-the-fly.
        */
        this.data.monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.updateDesktopGeometry());
        /*
        * Any change in the workareas must be detected too, for example if the used size
        * changes.
        */
        this.data.workareasChangedId = global.display.connect('workareas-changed', () => this.updateDesktopGeometry());

        /*
        * This callback allows to detect a change in the working area (like when changing the Scale value)
        */
        this.data.visibleAreaId = this.data.visibleArea.connect('updated-usable-area', () => this.updateDesktopGeometry());

        this.data.isEnabled = true;
        if (this.data.launchDesktopId) {
            GLib.source_remove(this.data.launchDesktopId);
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
        this.data.dbusConnectionId = Gio.bus_own_name(Gio.BusType.SESSION, 'com.rastersoft.dingextension', Gio.BusNameOwnerFlags.NONE, null, (connection, name) => {
            this.data.dbusConnection = connection;

            this.data.doCopy = new Gio.SimpleAction({
                name: 'doCopy',
                parameter_type: new GLib.VariantType('as'),
            });
            this.data.doCut = new Gio.SimpleAction({
                name: 'doCut',
                parameter_type: new GLib.VariantType('as'),
            });
            this.data.disableTimer = new Gio.SimpleAction({
                name: 'disableTimer',
            });
            this.data.desktopGeometry = Gio.SimpleAction.new_stateful('desktopGeometry', new GLib.VariantType('av'), this.getDesktopGeometry());
            this.data.desktopGeometry.set_enabled(true);
            this.data.doCopyId = this.data.doCopy.connect('activate', (action, parameters) => this.manageCutCopy(action, parameters));
            this.data.doCutId = this.data.doCut.connect('activate', (action, parameters) => this.manageCutCopy(action, parameters));
            this.data.disableTimerId = this.data.disableTimer.connect('activate', () => {
                if (this.data.currentProcess && this.data.currentProcess.subprocess) {
                    this.data.currentProcess.cancel_timer();
                }
            });
            this.data.actionGroup = new Gio.SimpleActionGroup();
            this.data.actionGroup.add_action(this.data.doCopy);
            this.data.actionGroup.add_action(this.data.doCut);
            this.data.actionGroup.add_action(this.data.disableTimer);
            this.data.actionGroup.add_action(this.data.desktopGeometry);

            this.data.dbusConnectionGroupId = this.data.dbusConnection.export_action_group(
                '/com/rastersoft/dingextension/control',
                this.data.actionGroup
            );
            this.launchDesktop();
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
    */
    /**
     *
     * @param action
     * @param parameters
     */
    manageCutCopy(action, parameters) {
        let content = '';
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
        let obj = new TextEncoder();
        Clipboard.set_content(CLIPBOARD_TYPE, 'x-special/gnome-copied-files', new GLib.Bytes(obj.encode(content)));
    }

    /**
     * Kills the current desktop program
     */
    killCurrentProcess() {
        if (this.data.launchDesktopId) {
            GLib.source_remove(this.data.launchDesktopId);
            this.data.launchDesktopId = 0;
        }

        // kill the desktop program. It will be reloaded automatically.
        if (this.data.currentProcess && this.data.currentProcess.subprocess) {
            this.data.currentProcess.cancel_timer();
            this.data.currentProcess.cancellable.cancel();
            this.data.currentProcess.subprocess.send_signal(15);
        }
        this.data.currentProcess = null;
        this.data.x11Manager.setWaylandClient(null);
    }

    /**
     *
     */
    updateDesktopGeometry() {
        if (this.data.actionGroup && (Main.layoutManager.monitors.length != 0)) {
            this.data.actionGroup.change_action_state('desktopGeometry', this.getDesktopGeometry());
        }
    }

    /**
     *
     */
    getDesktopGeometry() {
        let desktopList = [];
        let ws = global.workspace_manager.get_workspace_by_index(0);
        for (let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
            let area = this.data.visibleArea.getMonitorGeometry(ws, monitorIndex);
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
    doKillAllOldDesktopProcesses() {
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
            let path = `gjs ${GLib.build_filenamev([this.path, 'app', 'ding.js'])}`;
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
    doRelaunch(reloadTime) {
        this.data.currentProcess = null;
        this.data.x11Manager.setWaylandClient(null);
        if (this.data.isEnabled) {
            if (this.data.launchDesktopId) {
                GLib.source_remove(this.data.launchDesktopId);
            }
            this.data.launchDesktopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, reloadTime, () => {
                this.data.launchDesktopId = 0;
                this.launchDesktop();
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
    launchDesktop() {
        console.log('Launching DING process');
        let argv = [];
        argv.push(GLib.build_filenamev([this.path, 'app', 'ding.js']));
        // Specify that it must work as true desktop
        argv.push('-E');
        // The path. Allows the program to find translations, settings and modules.
        argv.push('-P');
        argv.push(GLib.build_filenamev([this.path, 'app']));

        this.data.currentProcess = new LaunchSubprocess(0, 'DING');
        this.data.currentProcess.set_cwd(GLib.get_home_dir());
        if (this.data.currentProcess.spawnv(argv) === null) {
            this.doRelaunch(1000);
            return;
        }
        this.data.x11Manager.setWaylandClient(this.data.currentProcess);
        this.data.launchTime = GLib.get_monotonic_time();

        /*
        * If the desktop process dies, wait 100ms and relaunch it, unless the exit status is different than
        * zero, in which case it will wait one second. This is done this way to avoid relaunching the desktop
        * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
        */
        this.data.currentProcess.subprocess.wait_async(null, (obj, res) => {
            let delta = GLib.get_monotonic_time() - this.data.launchTime;
            if (delta < 1000000) {
                // If the process is dying over and over again, ensure that it isn't respawn faster than once per second
                var reloadTime = 1000;
            } else {
                // but if the process just died after having run for at least one second, reload it ASAP
                var reloadTime = 1;
            }
            obj.wait_finish(res);
            if (!this.data.currentProcess || obj !== this.data.currentProcess.subprocess) {
                return;
            }
            if (obj.get_if_exited()) {
                obj.get_exit_status();
            }
            this.doRelaunch(reloadTime);
        });
    }
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
class LaunchSubprocess {
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
            console.log(`Error while trying to launch DING process: ${e.message}\n${e.stack}`);
        }
        // This is for GLib 2.68 or greater
        if (this._launcher.close) {
            this._launcher.close();
        }
        this._launcher = null;
        if (this.subprocess) {
            /*
                 * It reads STDOUT and STDERR and sends it to the journal using console.log(). This allows to
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
                console.error(e, `${this._process_id}_Error`);
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
                console.log(`Received notification for window. ${this._waiting_for_windows - 1} notifications remaining.`);
                this._waiting_for_windows--;
                if (this._waiting_for_windows == 0) {
                    GLib.source_remove(this._launch_timer);
                    this._launch_timer = 0;
                }
            }
            return ownsWindow;
        } catch (error) {
            console.log(`Exception error: ${error.message}\n${error.stack}`);
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
