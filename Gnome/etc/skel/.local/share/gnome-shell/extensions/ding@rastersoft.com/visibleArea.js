/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2021 Sergio Costas (rastersoft@gmail.com)
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
const Main = imports.ui.main;
const Signals = imports.signals;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

var VisibleArea = class {
    constructor() {
        this._usableAreas = {};
        this._marginsList = {};
        this._refreshTimerId = null;
        // This UUID allows to ensure that the object is really a DesktopIconsIntegration object
        this._extensionUUID = '130cbc66-235c-4bd6-8571-98d2d8bba5e2';
    }

    disable() {
        if (this._refreshTimerId !== null) {
            GLib.source_remove(this._refreshTimerId);
            this._refreshTimerId = null;
        }
    }

    setMarginsForExtension(extensionUUID, margins) {
        if (margins == null) {
            if (!(extensionUUID in this._marginsList)) {
                return;
            }
            delete this._marginsList[extensionUUID];
        } else {
            this._marginsList[extensionUUID] = margins;
        }
        if (this._refreshTimerId) {
            GLib.source_remove(this._refreshTimerId);
        }
        this._refreshTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._refreshMargins();
            this._refreshTimerId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _refreshMargins() {
        this._usableAreas = {};
        for (let extensionUUID in this._marginsList) {
            let margins = this._marginsList[extensionUUID];
            for (let workspace in margins) {
                let index = workspace;
                if (workspace < 0) {
                    index = Main.layoutManager.primaryIndex;
                }
                if (!(index in this._usableAreas)) {
                    this._usableAreas[index] = {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                    };
                }
                for (let index2 of ['top', 'bottom', 'left', 'right']) {
                    this._usableAreas[index][index2] = Math.max(this._usableAreas[index][index2], margins[workspace][index2]);
                }
            }
        }
        this.emit('updated-usable-area');
    }

    /**
     * Returns the margin values for an specific monitor
     *
     * @param {} ws A workspace (obtained with global.workspace_manager.get_workspace_by_index(0);)
     * @param {*} monitorIndex The monitor number
     * @returns A dictionary with the following elements:
     *     x: the X coordinate of the monitor area
     *     y: the Y coordinate of the monitor area
     *     width: the width of the monitor area
     *     height: the height of the monitor area
     *     scale: the scale factor for this monitor
     *     marginTop: the number of pixels, counting from the top of the monitor, to leave free because are used by a dynamic element
     *     marginBottom: the number of pixels, counting from the bottom of the monitor, to leave free because are used by a dynamic element
     *     marginLeft: the number of pixels, counting from the left of the monitor area, to leave free because are used by a dynamic element
     *     marginRight: the number of pixels, counting from the right of the monitor area, to leave free because are used by a dynamic element
     *
     * The inner margins so returned automatically describe the working area of the monitor (in Gnome terms) that for example the top margin will
     * automatically include the height of the top panel.
     *
     * In addition any extra margins above that set by gnome by othe extensions in usable areas will be returned if they are bigger than the margins
     * described by gnome shell for the work area
     *
     * Thus, a window that covers the whole monitor area should be placed at X,Y and with a size of (width, height), and
     * it must have inner margins of marginTop, marginRight, marginBottom and marginLeft.
     */

    getMonitorGeometry(ws, monitorIndex) {
        let geometry = ws.get_display().get_monitor_geometry(monitorIndex);
        let scale = ws.get_display().get_monitor_scale(monitorIndex);
        let area = ws.get_work_area_for_monitor(monitorIndex);

        // calculate the margins due to the difference between the monitor geometry and the work area, ie. the work area margins
        let marginTop = area.y - geometry.y;
        let marginLeft = area.x - geometry.x;
        let marginRight = geometry.width - area.width - marginLeft;
        let marginBottom = geometry.height - area.height - marginTop;

        if (monitorIndex in this._usableAreas) {
            // If the margins for this monitor are bigger than the margins calculated previously,
            // use the higher number. This is because the margin set from the extensions are be from the monitor border,
            // an can supersede the ones that actually form the work area border.
            marginTop = Math.max(marginTop, this._usableAreas[monitorIndex]['top']);
            marginBottom = Math.max(marginBottom, this._usableAreas[monitorIndex]['bottom']);
            marginLeft = Math.max(marginLeft, this._usableAreas[monitorIndex]['left']);
            marginRight = Math.max(marginRight, this._usableAreas[monitorIndex]['right']);
        }

        return {
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
            scale,
            marginTop,
            marginBottom,
            marginLeft,
            marginRight,
        };
    }

    get uuid() {
        return this._extensionUUID;
    }
};
Signals.addSignalMethods(VisibleArea.prototype);
