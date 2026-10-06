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
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as EmulateX11 from './emulateX11WindowType.js';
import * as VisibleArea from './visibleArea.js';

export default class DING extends Extension {
    constructor(metadata) {
        super(metadata);
        this.DesktopIconsUsableArea = null;
        this.data = {};
        this.data.isEnabled = false;
        this.data.launchDesktopId = 0;
        this.data.currentProcess = null;

        /* The constructor of the EmulateX11 class only initializes some
        * internal properties, but nothing else. In fact, it has its own
        * enable() and disable() methods. That's why it could have been
        * created here, in init(). But since the rule seems to be NO CLASS
        * CREATION IN INIT UNDER NO CIRCUMSTANCES...
        */
        this.data.x11Manager = null;
        this.data.visibleArea = null;
    }

    enable() {
        if (!this.data.x11Manager)
            this.data.x11Manager = new EmulateX11.EmulateX11WindowType();

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
        this.data.x11Manager.disable();
        this.data.visibleArea.disable();

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

        if (this.data.scaleFactorId) {
            St.ThemeContext.get_for_stage(global.stage).disconnect(this.data.scaleFactorId);
            this.data.scaleFactorId = 0;
        }
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
    }

    /**
     * The true code that configures everything and launches the desktop program
     */
    innerEnable() {
        if (this.data.startupPreparedId !== null) {
            Main.layoutManager.disconnect(this.data.startupPreparedId);
            this.data.startupPreparedId = null;
        }

        // Exit the overview mode on startup
        Main.overview.hide();

        this.data.x11Manager.enable();

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

        /*
         * This callback allows to detect a change in the scale factor, to adapt the desktop geometry to it.
         */
        this.data.scaleFactorId = St.ThemeContext.get_for_stage(global.stage).connect('notify::scale-factor',
            () => this.updateDesktopGeometry());

        this.data.isEnabled = true;
        if (this.data.launchDesktopId)
            GLib.source_remove(this.data.launchDesktopId);


        this.data.dbusConnectionId = Gio.bus_own_name(Gio.BusType.SESSION, 'com.rastersoft.dingextension', Gio.BusNameOwnerFlags.NONE, null, connection => {
            this.data.dbusConnection = connection;

            this.data.disableTimer = new Gio.SimpleAction({
                name: 'disableTimer',
            });
            this.data.desktopGeometry = Gio.SimpleAction.new_stateful('desktopGeometry', new GLib.VariantType('av'), this.getDesktopGeometry());
            this.data.desktopGeometry.set_enabled(true);
            this.data.disableTimerId = this.data.disableTimer.connect('activate', () => {
                if (this.data.currentProcess && this.data.currentProcess.subprocess)
                    this.data.currentProcess.cancel_timer();
            });
            this.data.actionGroup = new Gio.SimpleActionGroup();
            this.data.actionGroup.add_action(this.data.disableTimer);
            this.data.actionGroup.add_action(this.data.desktopGeometry);

            this.data.dbusConnectionGroupId = this.data.dbusConnection.export_action_group(
                '/com/rastersoft/dingextension/control',
                this.data.actionGroup
            );
            this.launchDesktop();
        }, null);
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
        if (this.data.actionGroup && (Main.layoutManager.monitors.length !== 0)) {
            this.data.actionGroup.change_action_state('desktopGeometry', this.getDesktopGeometry());
            this.data.x11Manager.refreshWindowsPosition();
        }
    }

    /**
     *
     */
    getDesktopGeometry() {
        const desktopVariantList = [];
        const desktopList = [];
        const ws = global.workspace_manager.get_active_workspace();
        const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
        for (let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
            const area = this.data.visibleArea.getMonitorGeometry(ws, monitorIndex);
            const monitorData = {
                'x': area.x,
                'y': area.y,
                'width': area.width,
                'height': area.height,
                scaleFactor,
                'marginTop': area.marginTop,
                'marginBottom': area.marginBottom,
                'marginLeft': area.marginLeft,
                'marginRight': area.marginRight,
                monitorIndex,
                'primaryMonitor': Main.layoutManager.primaryIndex,
                'windowMarginTop': area.windowMarginTop,
                'windowMarginBottom': area.windowMarginBottom,
                'windowMarginLeft': area.windowMarginLeft,
                'windowMarginRight': area.windowMarginRight,
            };
            /* console.log(`Monitor ${monitorIndex}`);
            for (let a in monitorData) {
                console.log(`    ${a}: ${monitorData[a]}`);
            }*/
            const desktopListElement = new GLib.Variant('a{sd}', monitorData);
            desktopVariantList.push(desktopListElement);
            desktopList.push(monitorData);
        }
        this.data.x11Manager.setMonitorData(desktopList);
        return new GLib.Variant('av', desktopVariantList);
    }

    /**
     *
     * @param {int} reloadTime
     */
    doRelaunch(reloadTime) {
        this.data.currentProcess = null;
        this.data.x11Manager.setWaylandClient(null);
        if (this.data.isEnabled) {
            if (this.data.launchDesktopId)
                GLib.source_remove(this.data.launchDesktopId);

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
        const argv = [];
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
            const delta = GLib.get_monotonic_time() - this.data.launchTime;
            // if the process just died after having run for at least one second, reload it ASAP
            var reloadTime = 1;
            if (delta < 1000000) {
                // but if the process is dying over and over again, ensure that it isn't respawn faster than once per second
                reloadTime = 1000;
            }
            obj.wait_finish(res);
            if (!this.data.currentProcess || obj !== this.data.currentProcess.subprocess)
                return;

            if (obj.get_if_exited())
                obj.get_exit_status();

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
    constructor(flags, processId) {
        this._process_id = processId;
        this.cancellable = new Gio.Cancellable();
        this._launcher = new Gio.SubprocessLauncher({flags: flags | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE});
        this.subprocess = null;
        this.process_running = false;
        this._launch_timer = 0;
        this._waiting_for_windows = 0;
    }

    spawnv(argv) {
        try {
            // New API introduced in https://gitlab.gnome.org/GNOME/mutter/-/merge_requests/4491
            this._waylandClient = Meta.WaylandClient.new_subprocess(global.context, this._launcher, argv);
            this.subprocess = this._waylandClient.get_subprocess();
        } catch (e) {
            this.subprocess = null;
            console.log(`Error while trying to launch DING process: ${e.message}\n${e.stack}`);
        }
        this._launcher.close();
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
                this.cancel_timer();
            });
            this.process_running = true;
            if (Main.layoutManager.monitors.length !== 0) {
                // This ensures that, if the DING window isn't detected in three seconds
                // after launch, the desktop will be killed and, thus, relaunched again.
                this._waiting_for_windows = Main.layoutManager.monitors.length;
                this._launch_timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 6000, () => {
                    this._launch_timer = 0;
                    this.subprocess.force_exit();
                    return false;
                });
            }
        }
        return this.subprocess;
    }

    cancel_timer() {
        if (this._launch_timer !== 0) {
            GLib.source_remove(this._launch_timer);
            this._launch_timer = 0;
            this._waiting_for_windows = 0;
        }
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    read_output() {
        if (!this._dataInputStream)
            return;

        this._dataInputStream.read_line_async(GLib.PRIORITY_DEFAULT, this.cancellable, (object, res) => {
            try {
                const [output, length] = object.read_line_finish_utf8(res);
                if (length)
                    print(`${this._process_id}: ${output}`);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    return;

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
        if (!this.process_running)
            return false;

        try {
            const ownsWindow = this._waylandClient.owns_window(window);
            if (ownsWindow && (this._launch_timer !== 0) && (this._waiting_for_windows !== 0)) {
                console.log(`Received notification for window. ${this._waiting_for_windows - 1} notifications remaining.`);
                this._waiting_for_windows--;
                if (this._waiting_for_windows === 0)
                    this.cancel_timer();
            }
            return ownsWindow;
        } catch (error) {
            console.log(`Exception error: ${error.message}\n${error.stack}`);
            return false;
        }
    }
};
