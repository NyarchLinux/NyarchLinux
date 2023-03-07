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
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Prefs = imports.preferences;
const Enums = imports.enums;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;


var elementSpacing = 2;

var DesktopGrid = class {

    constructor(desktopManager, desktopName, desktopDescription, asDesktop, premultiplied) {

        this._destroying = false;
        this._desktopManager = desktopManager;
        this._asDesktop = asDesktop;
        this._premultiplied = premultiplied;
        this._zoom = desktopDescription.zoom;
        this._x = desktopDescription.x;
        this._y = desktopDescription.y;
        let size_divisor = this._zoom;
        
        let using_X11 = Gdk.Display.get_default().constructor.$gtype.name === 'GdkX11Display';
        if (asDesktop) {
            if (using_X11) {
                size_divisor = Math.ceil(this._zoom);
            } else {
                if (premultiplied) {
                    size_divisor = 1;
                }
            }
        }
        this._width = Math.floor(desktopDescription.width / size_divisor);
        this._height = Math.floor(desktopDescription.height / size_divisor);
        this._maxColumns = Math.floor(this._width / (Prefs.get_desired_width() + 4 * elementSpacing));
        this._maxRows =  Math.floor(this._height / (Prefs.get_desired_height() + 4 * elementSpacing));
        this._elementWidth = Math.floor(this._width / this._maxColumns);
        this._elementHeight = Math.floor(this._height / this._maxRows);

        this._window = new Gtk.Window({"title": desktopName});
        if (asDesktop) {
            this._window.set_decorated(false);
            this._window.set_deletable(false);
            // If we are under X11, manage everything from here
            if (using_X11) {
                this._window.set_type_hint(Gdk.WindowTypeHint.DESKTOP);
                this._window.stick();
                this._window.move(this._x / this._zoom, this._y / this._zoom);
            }
        }
        this._window.set_resizable(false);
        this._window.connect('delete-event', () => {
            if (this._destroying) {
                return false;
            }
            if (this._asDesktop) {
                // Do not destroy window when closing if the instance is working as desktop
                return true;
            } else {
                // Exit if this instance is working as an stand-alone window
                Gtk.main_quit();
            }
        });

        const scale = this._window.get_scale_factor();
        this.gridGlobalRectangle = new Gdk.Rectangle({'x':this._x, 'y':this._y, 'width':(this._width*scale), 'height':(this._height*scale)});

        this._eventBox = new Gtk.EventBox({ visible: true });
        this._window.add(this._eventBox);
        this._container = new Gtk.Fixed();
        this._eventBox.add(this._container);

        this.setDropDestination(this._eventBox);

        // Transparent background, but only if this instance is working as desktop
        this._window.set_app_paintable(true);
        if (asDesktop) {
            let screen = this._window.get_screen();
            let visual = screen.get_rgba_visual();
            if (visual && screen.is_composited() && this._asDesktop) {
                this._window.set_visual(visual);
                this._window.connect('draw', (widget, cr) => {
                    Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 0.0, green: 0.0, blue: 0.0, alpha: 0.0}));
                    cr.paint();
                    cr.$dispose();
                    return false;
                });
            }
        }

        this._selectedList = null;
        this._container.connect('draw', (widget, cr) => {
            this._doDrawRubberBand(cr);
            cr.$dispose();
        });

        this._fileItems = {};

        this._gridStatus = {};
        for (let y=0; y<this._maxRows; y++) {
            for (let x=0; x<this._maxColumns; x++) {
                this._setGridUse(x, y, false);
            }
        }
        this._window.show_all();
        this._window.set_size_request(this._width, this._height);
        this._window.resize(this._width, this._height);
        this._eventBox.add_events(Gdk.EventMask.BUTTON_MOTION_MASK |
                                  Gdk.EventMask.BUTTON_PRESS_MASK |
                                  Gdk.EventMask.BUTTON_RELEASE_MASK |
                                  Gdk.EventMask.KEY_RELEASE_MASK);
        this._eventBox.connect('button-press-event', (actor, event) => {
            let [a, x, y] = event.get_coords();
            [x, y] = this._coordinatesLocalToGlobal(x, y);
            this._desktopManager.onPressButton(x, y, event, this);
            return false;
        });
        this._eventBox.connect('motion-notify-event', (actor, event) => {
            let [a, x, y] = event.get_coords();
            [x, y] = this._coordinatesLocalToGlobal(x, y);
            this._desktopManager.onMotion(x, y);
        });
        this._eventBox.connect('button-release-event', (actor, event) => {
            this._desktopManager.onReleaseButton(this);
        });
        this._window.connect('key-press-event', (actor, event) => {
            this._desktopManager.onKeyPress(event, this);
        });
    }

    destroy() {
        this._destroying = true;
        this._window.destroy();
    }

    setDropDestination(dropDestination) {
        dropDestination.drag_dest_set(Gtk.DestDefaults.MOTION | Gtk.DestDefaults.DROP, null, Gdk.DragAction.MOVE);
        let targets = new Gtk.TargetList(null);
        targets.add(Gdk.atom_intern('x-special/desktopicons-neo-icon-list', false), Gtk.TargetFlags.SAME_APP, 0);
        targets.add(Gdk.atom_intern('x-special/gnome-icon-list', false), 0, 1);
        targets.add(Gdk.atom_intern('text/uri-list', false), 0, 2);
        targets.add(Gdk.atom_intern('text/plain', false), 0, 3);
        dropDestination.drag_dest_set_target_list(targets);
        dropDestination.connect('drag-motion', (widget, context, x, y, time) => {
            x = this._elementWidth * Math.floor(x / this._elementWidth);
            y = this._elementHeight * Math.floor(y / this._elementHeight);
            [x, y] = this._coordinatesLocalToGlobal(x, y);
            this._desktopManager.onDragMotion(x, y);
        });
        this._eventBox.connect('drag-leave', (widget, context, time) => {
            this._desktopManager.onDragLeave();
        });
        dropDestination.connect('drag-data-received', (widget, context, x, y, selection, info, time) => {
            x = this._elementWidth * Math.floor(x / this._elementWidth);
            y = this._elementHeight * Math.floor(y / this._elementHeight);
            [x, y] = this._coordinatesLocalToGlobal(x, y);
            this._desktopManager.onDragDataReceived(x, y, selection, info);
            this._window.queue_draw();
        });
    }

    refreshDrag(selectedList, ox, oy) {
        if (selectedList === null) {
            this._selectedList = null;
            this._window.queue_draw();
            return;
        }
        let newSelectedList = [];
        for (let [x, y] of selectedList) {
            x += ox;
            y += oy;
            let r = this.getGridAt(x, y, false);
            if (r !== null) {
                newSelectedList.push(r);
            }
        }
        if (newSelectedList.length == 0) {
            if (this._selectedList !== null) {
                this._selectedList = null;
                this._window.queue_draw();
            }
            return;
        }
        if (this._selectedList !== null) {
            if ((newSelectedList[0][0] == this._selectedList[0][0]) && (newSelectedList[0][1] == this._selectedList[0][1])) {
                return;
            }
        }
        this._selectedList = newSelectedList;
        this._window.queue_draw();
    }

    queue_draw() {
        this._window.queue_draw();
    }

    _drawRounded(cr, x, y, width, height, r) {
	    let pi = Math.PI;
	    
        if(width <= r){
            r = width-1;
        }
        if(height <= r){
            r = height-1;
        }
        if(width <= r && height <= r){
            r = Math.min(width,height);
        }
		cr.arc(x + r, y + r, r, pi, 3 * pi / 2);
		cr.arc(x + width - r, y + r, r, 3 * pi / 2, 0);
		cr.arc(x + width - r, y + height - r, r, 0, pi / 2);
		cr.arc(x + r, y + height - r, r, pi / 2, pi);
		cr.closePath();
    }
    
    _doDrawRubberBand(cr) {
        if (this._desktopManager.rubberBand) {
            let minX = Math.min(this._desktopManager.rubberBandInitX, this._desktopManager.mouseX);
            let maxX = Math.max(this._desktopManager.rubberBandInitX, this._desktopManager.mouseX);
            let minY = Math.min(this._desktopManager.rubberBandInitY, this._desktopManager.mouseY);
            let maxY = Math.max(this._desktopManager.rubberBandInitY, this._desktopManager.mouseY);

            if ((minX >= (this._x + this._width )) || (minY >= (this._y + this._height)) || (maxX < this._x) || (maxY < this._y)) {
                return;
            }
            let [xInit, yInit] = this._coordinatesGlobalToLocal(minX, minY);
            let [xFin, yFin] = this._coordinatesGlobalToLocal(maxX, maxY);
            this._rubberBandCurveRadius = 4;
            
            this._curvedCorners = Prefs.desktopSettings.get_boolean('curved-corners');
            
            if(this._curvedCorners){
            	this._drawRounded(cr, xInit + 0.5, yInit + 0.5, xFin - xInit, yFin - yInit, this._rubberBandCurveRadius);
            }else{
            	cr.rectangle(xInit + 0.5, yInit + 0.5, xFin - xInit, yFin - yInit);
            }
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: this._desktopManager.selectColor.red,
                                                        green: this._desktopManager.selectColor.green,
                                                        blue: this._desktopManager.selectColor.blue,
                                                        alpha: 0.6})
            );
            cr.fill();
            cr.setLineWidth(1);
            if(this._curvedCorners){
            	this._drawRounded(cr, xInit + 0.5, yInit + 0.5, xFin - xInit, yFin - yInit, this._rubberBandCurveRadius);
            }else{
            	cr.rectangle(xInit + 0.5, yInit + 0.5, xFin - xInit, yFin - yInit);
            }
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: this._desktopManager.selectColor.red,
                                                        green: this._desktopManager.selectColor.green,
                                                        blue: this._desktopManager.selectColor.blue,
                                                        alpha: 1.0})
            );
            cr.stroke();
        }
        if (this._desktopManager.showDropPlace && (this._selectedList !== null)) {
            for(let [x, y] of this._selectedList) {
                cr.rectangle(x + 0.5, y + 0.5, this._elementWidth, this._elementHeight);
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 0.5,
                                                            green: 0.5,
                                                            blue: 0.5,
                                                            alpha: 0.4})
                );
                cr.fill();
                cr.setLineWidth(0.5);
                cr.rectangle(x + 0.5, y + 0.5, this._elementWidth, this._elementHeight);
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 0.5,
                                                            green: 0.5,
                                                            blue: 0.5,
                                                            alpha: 1.0})
                );
                cr.stroke();
            }
        }
    }

    getDistance(x, y) {
        /**
         * Checks if these coordinates belong to this grid.
         *
         * @Returns: -1 if there is no free space for new icons;
         *            0 if the coordinates are inside this grid;
         *            or the distance to the middle point, if none of the previous
         */

         let isFree = false;
         for (let element in this._gridStatus) {
             if (!this._gridStatus[element]) {
                 isFree = true;
                 break;
             }
         }
         if (!isFree) {
             return -1;
         }
         if (this._coordinatesBelongToThisGrid(x, y)) {
             return 0;
         }
         return Math.pow(x - (this._x + this._width * this._zoom / 2), 2) + Math.pow(x - (this._y + this._height * this._zoom / 2), 2);
    }

    _coordinatesGlobalToLocal(x, y) {
        x = DesktopIconsUtil.clamp(Math.floor((x - this._x) / this._zoom), 0, this._width - 1);
        y = DesktopIconsUtil.clamp(Math.floor((y - this._y) / this._zoom), 0, this._height - 1);
        return [x, y];
    }

    _coordinatesLocalToGlobal(x, y) {
        return [x * this._zoom + this._x, y * this._zoom + this._y];
    }

    _addFileItemTo(fileItem, column, row, coordinatesAction) {

        let localX = Math.floor(this._width * column / this._maxColumns);
        let localY = Math.floor(this._height * row / this._maxRows);
        this._container.put(fileItem._container, localX + elementSpacing, localY + elementSpacing);
        this._setGridUse(column, row, true);
        this._fileItems[fileItem.uri] = [column, row, fileItem];
        let [x, y] = this._coordinatesLocalToGlobal(localX + elementSpacing, localY + elementSpacing);
        fileItem.setCoordinates(x,
                                y,
                                this._elementWidth - 2 * elementSpacing,
                                this._elementHeight - 2 * elementSpacing,
                                elementSpacing,
                                this._zoom,
                                this);
        /* If this file is new in the Desktop and hasn't yet
         * fixed coordinates, store the new possition to ensure
         * that the next time it will be shown in the same possition.
         * Also store the new possition if it has been moved by the user,
         * and not triggered by a screen change.
         */
        if ((fileItem.savedCoordinates == null) || (coordinatesAction == Enums.StoredCoordinates.OVERWRITE)) {
            fileItem.savedCoordinates = [x, y];
        }
    }

    removeItem(fileItem) {
        if (fileItem.uri in this._fileItems) {
            let [column, row, tmp] = this._fileItems[fileItem.uri];
            this._setGridUse(column, row, false);
            this._container.remove(fileItem._container);
            delete this._fileItems[fileItem.uri];
        }
    }

    addFileItemCloseTo(fileItem, x, y, coordinatesAction) {
        let add_volumes_opposite = Prefs.desktopSettings.get_boolean('add-volumes-opposite');
        let [column, row] = this._getEmptyPlaceClosestTo(x,
                                                         y,
                                                         coordinatesAction,
                                                         fileItem.isDrive && add_volumes_opposite);
        this._addFileItemTo(fileItem, column, row, coordinatesAction);
    }

    _isEmptyAt(x,y) {
        return !this._gridStatus[y * this._maxColumns + x];
    }

    _setGridUse(x, y, inUse) {
        this._gridStatus[y * this._maxColumns + x] = inUse;
    }

    getGridAt(x, y, globalCoordinates) {
        if (this._coordinatesBelongToThisGrid(x, y)) {
            [x, y] = this._coordinatesGlobalToLocal(x, y);
            x = this._elementWidth * Math.floor((x / this._elementWidth) + 0.5);
            y = this._elementHeight * Math.floor((y / this._elementHeight) + 0.5);
            if (globalCoordinates) {
                [x, y] = this._coordinatesLocalToGlobal(x, y);
            }
            return [x, y];
        } else {
            return null;
        }
    }

    _coordinatesBelongToThisGrid(x, y) {
        return ((x >= this._x) && (x < (this._x + this._width * this._zoom)) && (y >= this._y) && (y < (this._y + this._height * this._zoom)));
    }

    _getEmptyPlaceClosestTo(x, y, coordinatesAction, reverseHorizontal) {

        [x, y] = this._coordinatesGlobalToLocal(x, y);
        let placeX = Math.floor(x / this._elementWidth);
        let placeY = Math.floor(y / this._elementHeight);

        let cornerInversion = Prefs.get_start_corner();
        if (reverseHorizontal) {
            cornerInversion[0] = !cornerInversion[0];
        }

        placeX = DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        if (this._isEmptyAt(placeX, placeY) && (coordinatesAction != Enums.StoredCoordinates.ASSIGN)) {
            return [placeX, placeY];
        }
        let found = false;
        let resColumn = null;
        let resRow = null;
        let minDistance = Infinity;
        let column, row;
        for (let tmp_column = 0; tmp_column < this._maxColumns; tmp_column++) {
            if (cornerInversion[0]) {
                column = this._maxColumns - tmp_column - 1;
            } else {
                column = tmp_column;
            }
            for (let tmp_row = 0; tmp_row < this._maxRows; tmp_row++) {
                if (cornerInversion[1]) {
                    row = this._maxRows - tmp_row - 1;
                } else {
                    row = tmp_row;
                }
                if (!this._isEmptyAt(column, row)) {
                    continue;
                }

                let proposedX = column * this._elementWidth;
                let proposedY = row * this._elementHeight;
                if (coordinatesAction == Enums.StoredCoordinates.ASSIGN)
                    return [column, row];
                let distance = DesktopIconsUtil.distanceBetweenPoints(proposedX, proposedY, x, y);
                if (distance < minDistance) {
                    found = true;
                    minDistance = distance;
                    resColumn = column;
                    resRow = row;
                }
            }
        }

        if (!found) {
            throw new Error(`Not enough place at monitor`);
        }

        return [resColumn, resRow];
    }
};
