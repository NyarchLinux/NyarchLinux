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
import GObject from 'gi://GObject';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Graphene from 'gi://Graphene';

import * as Prefs from './preferences.js';
import * as Enums from './enums.js';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as SignalManager from './signalManager.js';
import * as dndClipboardUtils from './dndClipboardUtils.js';

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;


var elementSpacing = 2;

export var DesktopGrid = class extends SignalManager.SignalManager {
    constructor(desktopManager, desktopName, desktopDescription, asDesktop) {
        super();
        this._signalIds = [];
        this._destroying = false;
        this._desktopManager = desktopManager;
        this._desktopName = desktopName;
        this._asDesktop = asDesktop;
        this._desktopDescription = desktopDescription;
        this.updateWindowGeometry();
        this.updateUnscaledHeightWidthMargins();

        // we don't use Adw.ApplicationWindow because it has rounded corners, which is something that we don't want for the desktop
        this._window = new Gtk.ApplicationWindow({application: desktopManager.mainApp, 'title': desktopName});
        this._window.set_decorated(false);
        if (this._asDesktop) {
            this._window.set_deletable(false);
            // For Wayland Transparent background, but only if this instance is working as desktop
            this._window.add_css_class('desktopwindow');
        } else {
            // Opaque black test window
            this._window.add_css_class('testwindow');
        }
        this._window.set_resizable(false);
        this.connectSignal(this._window, 'close-request', () => {
            if (this._destroying)
                return false;

            if (this._asDesktop) {
                // Do not destroy window when closing if the instance is working as desktop
                return true;
            } else {
                // Exit if this instance is working as an stand-alone window
                return false;
            }
        });

        this._container = new Gtk.Fixed();
        this._window.set_child(this._container);
        this.gridGlobalRectangle = new Gdk.Rectangle();
        this.setDropDestination(this._container);

        this._paintContainer = new PaintContainer(this);
        this._container.put(this._paintContainer, 0, 0);
        this.setGridStatus();
        this._window.set_default_size(this._windowWidth, this._windowHeight);
        this._window.set_size_request(this._windowWidth, this._windowHeight);
        this._window.show();
        this._window.set_size_request(this._windowWidth, this._windowHeight);
        this._window.set_default_size(this._windowWidth, this._windowHeight);

        const buttonMenuController = new Gtk.GestureClick();
        buttonMenuController.propagation_phase = Gtk.PropagationPhase.BUBBLE;
        buttonMenuController.button = 3;
        this._container.add_controller(buttonMenuController);
        this.connectSignal(buttonMenuController, 'pressed', (controller, nPress, x, y) => {
            this._desktopManager.onPressRightButton(controller, x, y, this._container);
        });

        const buttonMainController = new Gtk.GestureClick();
        buttonMenuController.propagation_phase = Gtk.PropagationPhase.BUBBLE;
        buttonMainController.button = 1;
        this._container.add_controller(buttonMainController);
        this.connectSignal(buttonMainController, 'pressed', (controller, nPress, x, y) => {
            [x, y] = this.coordinatesLocalToGlobal(x, y);
            this._desktopManager.onPressMainButton(controller, x, y, this._container);
        });
        this.connectSignal(buttonMainController, 'cancel', () => {
            this._desktopManager.onCancelledMainButton();
        });
        this.connectSignal(buttonMainController, 'released', () => {
            this._desktopManager.onReleaseMainButton();
        });
        const motionController = new Gtk.EventControllerMotion();
        this._container.add_controller(motionController);
        this.connectSignal(motionController, 'motion', (controller, x, y) => {
            [x, y] = this.coordinatesLocalToGlobal(x, y);
            this._desktopManager.onMotion(x, y);
        });


        const keyController = new Gtk.EventControllerKey();
        this._window.add_controller(keyController);
        this.connectSignal(keyController, 'key-pressed', (controller, keyval, keycode, state) => {
            return this._desktopManager.onKeyPress(keyval, keycode, state, this, controller.get_current_event_time());
        });
        // key-release-event must be used for the arrow keys to avoid conflicts
        // with assistive technologies.
        this.connectSignal(keyController, 'key-released', (controller, keyval, keycode, state) => {
            return this._desktopManager.onKeyRelease(keyval, keycode, state, this);
        });
        this.updateGridRectangle();
        this.resizeGrid();
    }

    updateGridDescription(desktopDescription) {
        this._desktopDescription = desktopDescription;
    }

    updateWindowGeometry() {
        this._zoom = this._desktopDescription.scaleFactor;
        this._x = this._desktopDescription.x + this._desktopDescription.windowMarginLeft;
        this._y = this._desktopDescription.y + this._desktopDescription.windowMarginTop;
        this._monitor = this._desktopDescription.monitorIndex;
        this._size_divisor = this._zoom;

        this._windowWidth = Math.floor((this._desktopDescription.width - (this._desktopDescription.windowMarginRight + this._desktopDescription.windowMarginLeft)) / this._size_divisor);
        this._windowHeight = Math.floor((this._desktopDescription.height - (this._desktopDescription.windowMarginTop + this._desktopDescription.windowMarginBottom)) / this._size_divisor);
    }

    updateUnscaledHeightWidthMargins() {
        this._marginTop = this._desktopDescription.marginTop - this._desktopDescription.windowMarginTop;
        this._marginBottom = this._desktopDescription.marginBottom - this._desktopDescription.windowMarginBottom;
        this._marginLeft = this._desktopDescription.marginLeft - this._desktopDescription.windowMarginLeft;
        this._marginRight = this._desktopDescription.marginRight - this._desktopDescription.windowMarginRight;
        this._width = this._desktopDescription.width - this._desktopDescription.marginLeft - this._desktopDescription.marginRight;
        this._height = this._desktopDescription.height - this._desktopDescription.marginTop - this._desktopDescription.marginBottom;

        this._width = Math.floor(this._width / this._size_divisor);
        this._height = Math.floor(this._height / this._size_divisor);
        this._marginTop = Math.floor(this._marginTop / this._size_divisor);
        this._marginBottom = Math.floor(this._marginBottom / this._size_divisor);
        this._marginLeft = Math.floor(this._marginLeft / this._size_divisor);
        this._marginRight = Math.floor(this._marginRight / this._size_divisor);
        this._maxColumns = Math.floor(this._width / (Prefs.getDesiredWidth() + 4 * elementSpacing));
        this._maxRows = Math.floor(this._height / (Prefs.getDesiredHeight() + 4 * elementSpacing));
        this._elementWidth = Math.floor(this._width / this._maxColumns);
        this._elementHeight = Math.floor(this._height / this._maxRows);
    }

    updateGridRectangle() {
        this.gridGlobalRectangle.x = this._x;
        this.gridGlobalRectangle.y = this._y;
        this.gridGlobalRectangle.width = this._width;
        this.gridGlobalRectangle.height = this._height;
    }

    setSizeContainer() {
        this._container.margin_top = this._marginTop;
        this._container.margin_bottom = this._marginBottom;
        const leftToRight =
            this._container.get_direction() === Gtk.TextDirection.LTR;
        if (leftToRight) {
            this._container.margin_start = this._marginLeft;
            this._container.margin_end = this._marginRight;
        } else {
            this._container.margin_start = this._marginRight;
            this._container.margin_end = this._marginLeft;
        }
        this._paintContainer.setSize(this._windowWidth - this._marginLeft - this._marginRight,
            this._windowHeight - this._marginTop - this._marginBottom);
    }

    setGridStatus() {
        this._fileItems = {};
        this._gridStatus = {};
        for (let y = 0; y < this._maxRows; y++) {
            for (let x = 0; x < this._maxColumns; x++)
                this._setGridUse(x, y, false);
        }
    }

    resizeGrid() {
        this.updateUnscaledHeightWidthMargins();
        this.updateGridRectangle();
        this.setSizeContainer();
        this.setGridStatus();
    }

    destroy() {
        this._destroying = true;
        this.disconnectAllSignals();
        this._window.destroy();
    }

    setDropDestination(dropDestination) {
        const dropTarget = new Gtk.DropTargetAsync();
        const validFormats = Gdk.ContentFormats.new(Enums.MIME_TYPES);
        dropTarget.set_actions(Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.ASK);
        dropTarget.set_formats(validFormats);

        this.connectSignal(dropTarget, 'drag-enter', (widget, drop) => {
            drop.status(Gdk.DragAction.COPY | Gdk.DragAction.MOVE | Gdk.DragAction.LINK,
                Gdk.DragAction.MOVE);
            return Gdk.DragAction.MOVE;
        });

        this.connectSignal(dropTarget, 'drag-motion', (widget, drop, x, y) => {
            [x, y] = this.coordinatesLocalToGlobal(x, y);
            this._desktopManager.onDragMotion(x, y);
            return Gdk.DragAction.MOVE;
        });

        this.connectSignal(dropTarget, 'drag-leave', (_widget, _drop) => {
            this._desktopManager.onDragLeave();
        });

        this.connectSignal(dropTarget, 'drop', async (widget, drop, x, y) => {
            const dropInfo = await dndClipboardUtils.manageIconDrop(this, drop, x, y);
            if (dropInfo === null)
                return false;

            x = this._elementWidth * Math.floor(x / this._elementWidth);
            y = this._elementHeight * Math.floor(y / this._elementHeight);
            [x, y] = this.coordinatesLocalToGlobal(x, y);
            try {
                this._desktopManager.onDragDataReceived(dropInfo, x, y, dropInfo.action === Gdk.DragAction.MOVE);
            } catch (e) {
                print(`Error: ${e}\n`);
            }
            this._paintContainer.queue_draw();
            return true;
        });

        this.connectSignal(dropTarget, 'accept', (widget, drop) => {
            return drop.get_formats().match(validFormats);
        });

        dropDestination.add_controller(dropTarget);
    }

    receiveLeave() {
        this._desktopManager.onDragLeave();
    }

    highLightGridAt(x, y) {
        const selected = this.getGridAt(x, y, false);
        this._paintContainer.selectedList = [selected];
    }

    unHighLightGrids() {
        this._paintContainer.selectedList = null;
    }

    _getGridCoordinates(x, y) {
        let placeX = Math.floor(x / this._elementWidth);
        let placeY = Math.floor(y / this._elementHeight);
        placeX = DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        return [placeX, placeY];
    }

    gridInUse(x, y) {
        const [placeX, placeY] = this._getGridCoordinates(x, y);
        return !this._isEmptyAt(placeX, placeY);
    }

    getGridLocalCoordinates(x, y) {
        const [column, row] = this._getGridCoordinates(x, y);
        const localX = Math.floor(this._width * column / this._maxColumns);
        const localY = Math.floor(this._height * row / this._maxRows);
        return [localX, localY];
    }

    _fileAt(x, y) {
        const [placeX, placeY] = this._getGridCoordinates(x, y);
        return this._gridStatus[placeY * this._maxColumns + placeX];
    }

    refreshDrag(selectedList, ox, oy) {
        if (selectedList === null) {
            this._paintContainer.selectedList = null;
            return;
        }
        const newSelectedList = [];
        for (let [x, y] of selectedList) {
            x += ox;
            y += oy;
            const r = this.getGridAt(x, y);
            if (r && !isNaN(r[0]) && !isNaN(r[1]) && (!this.gridInUse(r[0], r[1]) || this._fileAt(r[0], r[1]).isSelected))
                newSelectedList.push(r);
        }
        if (newSelectedList.length === 0) {
            this._paintContainer.selectedList = null;
            return;
        }
        if (this._paintContainer.selectedList !== null) {
            if (newSelectedList[0][0] === this._paintContainer.selectedList[0][0] &&
                newSelectedList[0][1] === this._paintContainer.selectedList[0][1])
                return;
        }
        this._paintContainer.selectedList = newSelectedList;
    }

    queue_draw() {
        this._paintContainer.queue_draw();
    }

    getDistance(x, y) {
        /**
         * Checks if these coordinates belong to this grid.
         *
         * @returns -1 if there is no free space for new icons;
         *          0 if the coordinates are inside this grid;
         *          or the distance to the middle point, if none of the previous
         */

        let isFree = false;
        for (const element in this._gridStatus) {
            if (!this._gridStatus[element]) {
                isFree = true;
                break;
            }
        }
        if (!isFree)
            return -1;

        if (this._coordinatesBelongToThisGrid(x, y))
            return 0;

        return Math.pow(x - (this._x + this._windowWidth * this._zoom / 2), 2) + Math.pow(x - (this._y + this._windowHeight * this._zoom / 2), 2);
    }

    coordinatesGlobalToLocal(X, Y) {
        X -= this._x;
        Y -= this._y;
        const [unused, x, y] = this._window.translate_coordinates(this._container, X, Y);
        return [Math.floor(x), Math.floor(y)];
    }

    coordinatesLocalToGlobal(x, y) {
        const [unused, X, Y] = this._container.translate_coordinates(this._window, x, y);
        return [Math.floor(X + this._x), Math.floor(Y + this._y)];
    }

    _addFileItemTo(fileItem, column, row, coordinatesAction) {
        if (this._destroying)
            return;

        const localX = Math.floor(this._width * column / this._maxColumns);
        const localY = Math.floor(this._height * row / this._maxRows);
        this._container.put(fileItem.container, localX + elementSpacing, localY + elementSpacing);
        this._setGridUse(column, row, fileItem);
        this._fileItems[fileItem.uri] = [column, row, fileItem];
        const [x, y] = this.coordinatesLocalToGlobal(localX + elementSpacing, localY + elementSpacing);
        fileItem.setCoordinates(
            x,
            y,
            this._elementWidth - 2 * elementSpacing,
            this._elementHeight - 2 * elementSpacing,
            elementSpacing,
            this,
            column / this._maxColumns);
        /* If this file is new in the Desktop and hasn't yet
         * fixed coordinates, store the new possition to ensure
         * that the next time it will be shown in the same possition.
         * Also store the new possition if it has been moved by the user,
         * and not triggered by a screen change.
         */
        if ((fileItem.savedCoordinates === null) || (coordinatesAction === Enums.StoredCoordinates.OVERWRITE))
            fileItem.savedCoordinates = [x, y];
    }

    removeItem(fileItem) {
        if (fileItem.uri in this._fileItems) {
            const [column, row] = this._fileItems[fileItem.uri];
            this._setGridUse(column, row, false);
            this._container.remove(fileItem.container);
            delete this._fileItems[fileItem.uri];
        }
    }

    addFileItemCloseTo(fileItem, x, y, coordinatesAction) {
        const addVolumesOpposite = Prefs.desktopSettings.get_boolean('add-volumes-opposite');
        const [column, row] = this._getEmptyPlaceClosestTo(x,
            y,
            coordinatesAction,
            fileItem.isDrive && addVolumesOpposite);
        this._addFileItemTo(fileItem, column, row, coordinatesAction);
    }

    _isEmptyAt(x, y) {
        return this._gridStatus[y * this._maxColumns + x] === false;
    }

    _setGridUse(x, y, inUse) {
        this._gridStatus[y * this._maxColumns + x] = inUse;
    }

    getGridAt(x, y, globalCoordinates = false) {
        if (this._coordinatesBelongToThisGrid(x, y)) {
            [x, y] = this.coordinatesGlobalToLocal(x, y);
            if (globalCoordinates) {
                x = this._elementWidth * Math.floor(x / this._elementWidth);
                y = this._elementHeight * Math.floor(y / this._elementHeight);
                [x, y] = this.coordinatesLocalToGlobal(x, y);
                return [x, y];
            } else {
                return this.getGridLocalCoordinates(x, y);
            }
        } else {
            return null;
        }
    }

    _coordinatesBelongToThisGrid(X, Y) {
        const checkRectangle = new Gdk.Rectangle({x: X, y: Y, width: 1, height: 1});
        return this.gridGlobalRectangle.intersect(checkRectangle)[0];
    }

    _getEmptyPlaceClosestTo(x, y, coordinatesAction, reverseHorizontal) {
        [x, y] = this.coordinatesGlobalToLocal(x, y);
        let placeX = Math.floor(x / this._elementWidth);
        let placeY = Math.floor(y / this._elementHeight);

        const cornerInversion = Prefs.getStartCorner();
        if (reverseHorizontal)
            cornerInversion[0] = !cornerInversion[0];


        placeX = DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        if (this._isEmptyAt(placeX, placeY) && (coordinatesAction !== Enums.StoredCoordinates.ASSIGN))
            return [placeX, placeY];

        let found = false;
        let resColumn = null;
        let resRow = null;
        let minDistance = Infinity;
        let column, row;
        for (let tmpColumn = 0; tmpColumn < this._maxColumns; tmpColumn++) {
            if (cornerInversion[0])
                column = this._maxColumns - tmpColumn - 1;
            else
                column = tmpColumn;

            for (let tmpRow = 0; tmpRow < this._maxRows; tmpRow++) {
                if (cornerInversion[1])
                    row = this._maxRows - tmpRow - 1;
                else
                    row = tmpRow;

                if (!this._isEmptyAt(column, row))
                    continue;


                const proposedX = column * this._elementWidth;
                const proposedY = row * this._elementHeight;
                if (coordinatesAction === Enums.StoredCoordinates.ASSIGN)
                    return [column, row];

                const distance = DesktopIconsUtil.distanceBetweenPoints(proposedX, proposedY, x, y);
                if (distance < minDistance) {
                    found = true;
                    minDistance = distance;
                    resColumn = column;
                    resRow = row;
                }
            }
        }

        if (!found)
            print('Not enough place at monitor');


        return [resColumn, resRow];
    }

    get Window() {
        return this._window;
    }
};

class PaintContainer extends Gtk.Widget {
    static {
        GObject.registerClass(this);
    }

    constructor(desktopGrid) {
        super();
        this._desktopGrid = desktopGrid;
        this._selectedList = null;
        this._width = 0;
        this._height = 0;
    }

    get selectedList() {
        return this._selectedList;
    }

    set selectedList(value) {
        if (this._selectedList === value)
            return;

        this._selectedList = value;
        this.queue_draw();
    }

    setSize(width, height) {
        this._width = width;
        this._height = height;
        this.queue_resize();
    }

    vfunc_measure(orientation, _forSize) {
        if (orientation === Gtk.Orientation.HORIZONTAL)
            return [this._width, this._width, -1, -1];
        else
            return [this._height, this._height, -1, -1];
    }

    vfunc_snapshot(snapshot) {
        const dm = this._desktopGrid._desktopManager;
        const grid = this._desktopGrid;

        if (dm.rubberBand && dm.selectionRectangle) {
            if (grid.gridGlobalRectangle.intersect(dm.selectionRectangle)[0]) {
                const [xInit, yInit] = grid.coordinatesGlobalToLocal(dm.x1, dm.y1);
                const [xFin, yFin] = grid.coordinatesGlobalToLocal(dm.x2, dm.y2);

                const fillColor = new Gdk.RGBA();
                fillColor.red = dm.selectColor.red;
                fillColor.green = dm.selectColor.green;
                fillColor.blue = dm.selectColor.blue;
                fillColor.alpha = 0.3;

                const borderColor = new Gdk.RGBA();
                borderColor.red = dm.selectColor.red;
                borderColor.green = dm.selectColor.green;
                borderColor.blue = dm.selectColor.blue;
                borderColor.alpha = 1.0;

                this._snapshotRoundedRect(snapshot,
                    xInit, yInit, xFin - xInit, yFin - yInit,
                    5, fillColor, borderColor, 1);
            }
        }

        if (dm.showDropPlace && this._selectedList !== null) {
            for (const [x, y] of this._selectedList) {
                const fillColor = new Gdk.RGBA();
                fillColor.red = dm.selectColor.red;
                fillColor.green = dm.selectColor.green;
                fillColor.blue = dm.selectColor.blue;
                fillColor.alpha = 0.4;

                const borderColor = new Gdk.RGBA();
                borderColor.red = dm.selectColor.red;
                borderColor.green = dm.selectColor.green;
                borderColor.blue = dm.selectColor.blue;
                borderColor.alpha = 1.0;

                this._snapshotRoundedRect(snapshot,
                    x, y, grid._elementWidth, grid._elementHeight,
                    10, fillColor, borderColor, 0.5);
            }
        }
    }

    _snapshotRoundedRect(snapshot, x, y, width, height, radius, fillColor, borderColor, borderWidth) {
        // Normalise negative dimensions (rubber band dragged in reverse)
        if (width < 0) {
            x += width;
            width = -width;
        }
        if (height < 0) {
            y += height;
            height = -height;
        }
        radius = Math.min(radius, width / 2, height / 2);

        const rect = new Graphene.Rect();
        rect.init(x, y, width, height);

        const roundedRect = new Gsk.RoundedRect();
        roundedRect.init_from_rect(rect, radius);

        snapshot.push_rounded_clip(roundedRect);
        snapshot.append_color(fillColor, rect);
        snapshot.pop();

        if (borderWidth) {
            const stroke = new Gsk.Stroke(borderWidth);
            const builder = new Gsk.PathBuilder();
            builder.move_to(x + radius, y);
            builder.line_to(x + width - radius, y);
            builder.arc_to(x + width, y, x + width, y + radius);
            builder.line_to(x + width, y + height - radius);
            builder.arc_to(x + width, y + height, x + width - radius, y + height);
            builder.line_to(x + radius, y + height);
            builder.arc_to(x, y + height, x, y + height - radius);
            builder.line_to(x, y + radius);
            builder.arc_to(x, y, x + radius, y);
            builder.close();
            snapshot.append_stroke(builder.to_path(), stroke, borderColor);
        }
    }
}
