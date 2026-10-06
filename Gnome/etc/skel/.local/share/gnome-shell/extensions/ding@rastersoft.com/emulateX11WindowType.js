/* Emulate X11WindowType
 *
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
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
import Meta from 'gi://Meta';


class ManageWindow {
    /* This class is added to each managed window, and it's used to
       make it behave like an X11 Desktop window.

       A window can take advantage of these flags by ending its title with
       blank spaces (one space is treated as @!H, two spaces as @!HTD):

       * T : put this window at the top of the window stack
       * D : show this window in all desktops

       Using the title is generally not a problem because the desktop window
       doesn't have a title, and it allows to take advantage of these flags
       even on decorated windows.
    */

    constructor(window, waylandClient, X11Emulator) {
        this._waylandClient = waylandClient;
        this._X11Emulator = X11Emulator;
        this._window = window;
        this._signalIDs = [];
        this.windowUnmanaged = false;
        this._keepAtTop = false;
        this._showInAllDesktops = false;
        // This signal is disconnected in `disable`, when `clearWindow()` is
        // called for each window to remove everything added.
        this._signalIDs.push(window.connect('notify::title', () => {
            this._parseTitle();
        }));
        this._parseTitle();
    }

    _moveIntoPlace() {
        if (this._moveIntoPlaceID)
            GLib.source_remove(this._moveIntoPlaceID);

        this._moveIntoPlaceID = GLib.timeout_add(GLib.PRIORITY_LOW, 250, () => {
            if (this._fixed && (this._x !== null) && (this._y !== null))
                this._window.move_frame(true, this._x, this._y);

            this._moveIntoPlaceID = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    refreshWindowPosition() {
        this._moveIntoPlace();
    }

    destroy() {
        for (const signalID of this._signalIDs)
            this._window.disconnect(signalID);

        if (this._moveIntoPlaceID) {
            GLib.source_remove(this._moveIntoPlaceID);
            this._moveIntoPlaceID = 0;
        }
        if (this._keepAtTop && !this.windowUnmanaged)
            this._window.unmake_above();

        this._window = null;
        this._waylandClient = null;
    }

    setWaylandClient(client) {
        this._waylandClient = client;
    }

    _parseTitle() {
        this._x = null;
        this._y = null;
        const keepAtTop = this._keepAtTop;
        this._keepAtTop = false;
        const showInAllDesktops = this._showInAllDesktops;
        this._showInAllDesktops = false;
        this._fixed = false;
        let title = this._window.get_title();
        if (title !== null) {
            if ((title.length > 0) && (title[title.length - 1] === ' ')) {
                if ((title.length > 1) && (title[title.length - 2] === ' '))
                    title = '@!HTD';
                else
                    title = '@!H';
            }
            const pos = title.search('@!');
            if (pos !== -1) {
                const extraChars = title.substring(pos + 2).trim().toUpperCase();
                for (const char of extraChars) {
                    switch (char) {
                    case 'T':
                        this._keepAtTop = true;
                        break;
                    case 'D':
                        this._showInAllDesktops = true;
                        break;
                    }
                }
            }
            // This string must match the one at desktopManager.js
            if (title.startsWith('Desktop Icons ')) {
                this._keepAtTop = false;
                this._fixed = true;
                try {
                    const desktopIndex = parseInt(title.substring(14).trim());
                    const desktopData = this._X11Emulator.getMonitorData(desktopIndex - 1);
                    this._x = desktopData.x + desktopData.windowMarginLeft;
                    this._y = desktopData.y + desktopData.windowMarginTop;
                } catch (e) {
                    console.log(`Exception ${e.message}.\n${e.stack}`);
                }
                this._window.set_type(Meta.WindowType.DESKTOP);
            }
            if (this._keepAtTop !== keepAtTop) {
                if (this._keepAtTop)
                    this._window.make_above();
                else
                    this._window.unmake_above();
            }
            if (this._showInAllDesktops !== showInAllDesktops) {
                if (this._showInAllDesktops)
                    this._window.stick();
                else
                    this._window.unstick();
            }
            this._moveIntoPlace();
        }
    }
}

export class EmulateX11WindowType {
    /*
     This class makes all the heavy lifting for emulating WindowType.
     Just make one instance of it, call enable(), and whenever a window
     that you want to give "superpowers" is mapped, add it with the
     "addWindow" method. That's all.
     */
    constructor() {
        this._windowList = [];
        this._waylandClient = null;
        this._monitorData = [];
    }

    setMonitorData(data) {
        this._monitorData = data;
    }

    getMonitorData(idx) {
        if (idx >= this._monitorData.length)
            return null;

        return this._monitorData[idx];
    }

    setWaylandClient(client) {
        this._waylandClient = client;
        for (const window of this._windowList) {
            if (window.customJS_ding)
                window.customJS_ding.setWaylandClient(this._waylandClient);
        }
    }

    enable() {
        this._idMap = global.window_manager.connect_after('map', (obj, windowActor) => {
            const window = windowActor.get_meta_window();
            if (this._waylandClient && this._waylandClient.query_window_belongs_to(window))
                this.addWindow(window);
        });
    }

    disable() {
        for (const window of this._windowList)
            this._clearWindow(window);

        this._windowList = [];

        // disconnect signals
        if (this._idMap) {
            global.window_manager.disconnect(this._idMap);
            this._idMap = null;
        }
        this.refreshWindowsPosition();
    }

    addWindow(window) {
        window.customJS_ding = new ManageWindow(window, this._waylandClient, this);
        this._windowList.push(window);
        window.customJS_ding.unmanagedID = window.connect('unmanaged', iWindow => {
            iWindow.customJS_ding.windowUnmanaged = true;
            this._clearWindow(iWindow);
            this._windowList = this._windowList.filter(item => item !== iWindow);
        });
        this.refreshWindowsPosition();
    }

    refreshWindowsPosition() {
        this._windowList.forEach(window => {
            window.customJS_ding.refreshWindowPosition();
        });
    }

    _clearWindow(window) {
        window.disconnect(window.customJS_ding.unmanagedID);
        window.customJS_ding.destroy();
        window.customJS_ding = null;
    }
};
