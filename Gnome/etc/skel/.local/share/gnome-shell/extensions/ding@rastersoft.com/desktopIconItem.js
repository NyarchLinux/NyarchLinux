
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2021 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 * SwitcherooControl code based on code original from Marsch84
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
/* exported dropDestination */
'use strict';
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Cairo = imports.gi.cairo;
const DesktopIconsUtil = imports.desktopIconsUtil;

const Prefs = imports.preferences;
const Enums = imports.enums;

const ByteArray = imports.byteArray;
const Signals = imports.signals;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var desktopIconItem = class desktopIconItem {
    constructor(desktopManager, fileExtra) {
        this._signalIds = [];
        this._desktopManager = desktopManager;
        this._fileExtra = fileExtra;
        this._loadThumbnailDataCancellable = null;
        this._queryFileInfoCancellable = null;
        this._grid = null;
        this._lastClickTime = 0;
        this._lastClickButton = 0;
        this._clickCount = 0;
        this._isSelected = false;
        this._isSpecial = false;
        this._primaryButtonPressed = false;
        this._savedCoordinates = null;
        this._dropCoordinates = null;
        this._destroyed = false;
    }

    /** *********************
     * Destroyers *
     ***********************/

    removeFromGrid(callOnDestroy) {
        if (this._grid) {
            this._grid.removeItem(this);
            this._grid = null;
        }
        if (callOnDestroy) {
            this._onDestroy();
        }
    }

    _destroy() {
        /* Regular file data */
        if (this._queryFileInfoCancellable) {
            this._queryFileInfoCancellable.cancel();
        }

        /* Thumbnailing */
        if (this._loadThumbnailDataCancellable) {
            this._loadThumbnailDataCancellable.cancel();
        }
        /* Disconnect signals */
        for (let [object, signalId] of this._signalIds) {
            object.disconnect(signalId);
        }
        this._signalIds = [];
        this.container.destroy();
        this.container = null;
        this._eventBox = null;
        this._shieldEventBox = null;
        this._labelEventBox = null;
        this._shieldLabelEventBox = null;
        this._icon = null;
        this._iconContainer = null;
        this._label = null;
        this._labelContainer = null;
        this.iconRectangle = null;
    }

    _onDestroy() {
        this._destroy();
        this._destroyed = true;
    }

    _connectSignal(object, signal, callback) {
        this._signalIds.push([object, object.connect(signal, callback)]);
    }

    /** *********************
     * Creators *
     ***********************/

    _createIconActor() {
        this.container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER});
        this._connectSignal(this.container, 'destroy', () => this._onDestroy());
        this._eventBox = new Gtk.EventBox({visible: true, halign: Gtk.Align.CENTER});
        this._shieldEventBox = new Gtk.EventBox({visible: true, halign: Gtk.Align.CENTER});
        this._labelEventBox = new Gtk.EventBox({visible: true, halign: Gtk.Align.CENTER});
        this._shieldLabelEventBox = new Gtk.EventBox({visible: true, halign: Gtk.Align.CENTER});

        this._icon = new Gtk.Image();
        this._iconContainer = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        this._iconContainer.pack_start(this._icon, true, true, 0);
        this._iconContainer.set_baseline_position(Gtk.BaselinePosition.CENTER);
        this._eventBox.add(this._iconContainer);
        this._shieldEventBox.add(this._eventBox);

        this._label = new Gtk.Label();
        this._labelContainer = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER});
        let labelStyleContext = this._label.get_style_context();
        if (this._desktopManager.darkText) {
            labelStyleContext.add_class('file-label-dark');
        } else {
            labelStyleContext.add_class('file-label');
        }
        labelStyleContext = undefined; // prevent memory leaks
        this._label.set_ellipsize(Pango.EllipsizeMode.END);
        this._label.set_line_wrap(true);
        this._label.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._label.set_yalign(0.0);
        this._label.set_justify(Gtk.Justification.CENTER);
        this._label.set_lines(2);
        this._labelContainer.pack_start(this._label, false, true, 0);
        this._labelEventBox.add(this._labelContainer);
        this._shieldLabelEventBox.add(this._labelEventBox);

        this.container.pack_start(this._shieldEventBox, false, false, 0);
        this.container.pack_start(this._shieldLabelEventBox, false, false, 0);

        this._styleContext = this._iconContainer.get_style_context();
        this._labelStyleContext = this._labelContainer.get_style_context();
        this._styleContext.add_class('file-item');
        this._labelStyleContext.add_class('file-item');

        this.iconRectangle = new Gdk.Rectangle();
        this.labelRectangle = new Gdk.Rectangle();

        /* We need to allow the "button-press" event to pass through the callbacks, to allow the DnD to work
         * But we must avoid them to reach the main window.
         * The solution is to allow them to pass in a EventBox, used both for detecting the events and the DnD, and block them
         * in a second EventBox, located outside.
         */
        this._connectSignal(this._shieldEventBox, 'button-press-event', (actor, event) => {
            return true;
        });
        this._connectSignal(this._shieldLabelEventBox, 'button-press-event', (actor, event) => {
            return true;
        });
        this._connectSignal(this._eventBox, 'button-press-event', (actor, event) => this._onPressButton(actor, event));
        this._connectSignal(this._eventBox, 'enter-notify-event', (actor, event) => this._onEnter(this._eventBox));
        this._connectSignal(this._eventBox, 'leave-notify-event', (actor, event) => this._onLeave(this._eventBox));
        this._connectSignal(this._eventBox, 'button-release-event', (actor, event) => this._onReleaseButton(actor, event));
        this._connectSignal(this._eventBox, 'drag-motion', (widget, context, x, y, time) => {
            this.highLightDropTarget(x, y);
            this._updateDragStatus(context, time);
        });
        this._connectSignal(this._eventBox, 'drag-leave', () => {
            this.unHighLightDropTarget();
        });
        this._connectSignal(this._eventBox, 'size-allocate', () => this._calculateIconRectangle());
        this._connectSignal(this._labelEventBox, 'button-press-event', (actor, event) => this._onPressButton(actor, event));
        this._connectSignal(this._labelEventBox, 'enter-notify-event', (actor, event) => this._onEnter(this._labelEventBox));
        this._connectSignal(this._labelEventBox, 'leave-notify-event', (actor, event) => this._onLeave(this._labelEventBox));
        this._connectSignal(this._labelEventBox, 'button-release-event', (actor, event) => this._onReleaseButton(actor, event));
        this._connectSignal(this._labelEventBox, 'drag-motion', (widget, context, x, y, time) => {
            this.highLightDropTarget(x, y);
            this._updateDragStatus(context, time);
        });
        this._connectSignal(this._labelEventBox, 'drag-leave', () => {
            this.unHighLightDropTarget();
        });
        this._connectSignal(this._labelEventBox, 'size-allocate', () => {
            this._doLabelSizeAllocated();
        });
        this._connectSignal(this.container, 'drag-motion', (widget, context, x, y, time) => {
            this.highLightDropTarget(x, y);
            this._updateDragStatus(context, time);
        });
        this._connectSignal(this.container, 'drag-leave', () => {
            this.unHighLightDropTarget();
        });

        if (this._desktopManager.showDropPlace) {
            this._setDropDestination(this.container);
        } else {
            this._setDropDestination(this._eventBox);
            this._setDropDestination(this._labelEventBox);
        }
        this._setDragSource(this._eventBox);
        this._setDragSource(this._labelEventBox);
        this.container.show_all();
    }

    _doLabelSizeAllocated() {
        this._calculateLabelRectangle();
    }

    _calculateIconRectangle() {
        this.iconwidth = this._iconContainer.get_allocated_width();
        this.iconheight = this._iconContainer.get_allocated_height();
        let [x, y] = this._grid.coordinatesLocalToGlobal(0, 0, this._iconContainer);
        this.iconRectangle.x = x;
        this.iconRectangle.y = y;
        this.iconRectangle.width = this.iconwidth;
        this.iconRectangle.height = this.iconheight;
    }

    _calculateLabelRectangle() {
        this.labelwidth = this._labelContainer.get_allocated_width();
        this.labelheight = this._labelContainer.get_allocated_height();
        let [x, y] = this._grid.coordinatesLocalToGlobal(0, 0, this._labelContainer);
        this.labelRectangle.x = x;
        this.labelRectangle.y = y;
        this.labelRectangle.width = this.labelwidth;
        this.labelRectangle.height = this.labelheight;
    }

    setCoordinates(x, y, width, height, margin, grid) {
        this._x1 = x;
        this._y1 = y;
        this.width = width;
        this.height = height;
        this._grid = grid;
        this.container.set_size_request(width, height);
        this._label.margin_start = margin;
        this._label.margin_end = margin;
        this._label.margin_bottom = margin;
        this._iconContainer.margin_top = margin;
        this._calculateIconRectangle();
        this._calculateLabelRectangle();
    }

    getCoordinates() {
        this._x2 = this._x1 + this.container.get_allocated_width() - 1;
        this._y2 = this._y1 + this.container.get_allocated_height() - 1;
        return [this._x1, this._y1, this._x2, this._y2, this._grid];
    }

    _setLabelName(text) {
        this._currentFileName = text;
        this._eventBox.set_tooltip_text(text);
        let lastCutPos = -1;
        let newText = '';
        for (let pos = 0; pos < text.length; pos++) {
            let character = text[pos];
            newText += character;
            if (pos < (text.length - 1)) {
                var nextChar = text[pos + 1];
            } else {
                var nextChar = '';
            }
            if (character == ' ') {
                lastCutPos = pos;
            }
            if (['.', ',', '-', '_', '@', ':'].includes(character)) {
                /* if the next character is already an space or this is the last
                 * character, the string will be naturally cut here, so we do
                 * nothing.
                 */
                if ((nextChar == ' ') || (nextChar == '')) {
                    continue;
                }
                /* if there is a cut element in the last four previous characters,
                 * do not add a new cut element.
                 */
                if ((lastCutPos > -1) && ((pos - lastCutPos) < 4)) {
                    continue;
                }
                newText += '\u200B';
            }
        }
        this._label.label = newText;
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _updateClickState(event) {
        let settings = Gtk.Settings.get_default();

        if ((event.get_button()[1] == this._lastClickButton) &&
            ((event.get_time() - this._lastClickTime) < settings.gtk_double_click_time)) {
            this._clickCount++;
        } else {
            this._clickCount = 1;
        }

        this._lastClickTime = event.get_time();
        this._lastClickButton = event.get_button()[1];
    }

    getClickCount() {
        return this._clickCount;
    }

    _onPressButton(actor, event) {
        this._updateClickState(event);
        let button = event.get_button()[1];
        let [a, x, y] = event.get_coords();
        let state = event.get_state()[1];
        this._buttonPressInitialX = x;
        this._buttonPressInitialY = y;
        let shiftPressed = !!(state & Gdk.ModifierType.SHIFT_MASK);
        let controlPressed = !!(state & Gdk.ModifierType.CONTROL_MASK);
        if (button == 3) {
            this._doButtonThreePressed(event, shiftPressed, controlPressed);
        } else if (button == 1) {
            this._doButtonOnePressed(event, shiftPressed, controlPressed);
        }
        return false;
    }

    _onReleaseButton(actor, event) {
        let button = event.get_button()[1];
        if (button == 1) {
            this._doButtonOneReleased(event);
        }
        return false;
    }

    _doButtonThreePressed(event) {
        if (!this._isSelected) {
            this._desktopManager.selected(this, Enums.Selection.RIGHT_BUTTON);
        }
        this._desktopManager.fileItemMenu.showMenu(this, event);
    }

    _doButtonOnePressed(event, shiftPressed, controlPressed) {
        if (this.getClickCount() == 1) {
            this._primaryButtonPressed = true;
            if (shiftPressed || controlPressed) {
                this._desktopManager.selected(this, Enums.Selection.WITH_SHIFT);
            } else {
                this._desktopManager.selected(this, Enums.Selection.ALONE);
            }
        }
    }

    _doButtonOneReleased(event) {
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    _onEnter(element) {
        if (!this._styleContext.has_class('file-item-hover')) {
            this._styleContext.add_class('file-item-hover');
            this._labelStyleContext.add_class('file-item-hover');
        }
        if (Prefs.CLICK_POLICY_SINGLE) {
            let window = element.get_window();
            if (window) {
                window.set_cursor(Gdk.Cursor.new_from_name(Gdk.Display.get_default(), 'hand'));
            }
        }
        return false;
    }

    _onLeave(element) {
        this._primaryButtonPressed = false;
        if (this._styleContext.has_class('file-item-hover')) {
            this._styleContext.remove_class('file-item-hover');
            this._labelStyleContext.remove_class('file-item-hover');
        }
        if (Prefs.CLICK_POLICY_SINGLE) {
            let window = element.get_window();
            if (window) {
                window.set_cursor(Gdk.Cursor.new_from_name(Gdk.Display.get_default(), 'default'));
            }
        }
        return false;
    }

    _hasToRouteDragToGrid() {
        if (this._grid) {
            return true;
        }
        return false;
    }

    _updateDragStatus(context, time) {
        if (DesktopIconsUtil.getModifiersInDnD(context, Gdk.ModifierType.CONTROL_MASK)) {
            Gdk.drag_status(context, Gdk.DragAction.COPY, time);
        } else {
            Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
        }
    }

    highLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid.receiveMotion(this._x1, this._y1, true);
            return;
        }
        if (!this._styleContext.has_class('desktop-icons-selected')) {
            this._styleContext.add_class('desktop-icons-selected');
            this._labelStyleContext.add_class('desktop-icons-selected');
        }
        this._grid.highLightGridAt(this._x1, this._y1);
    }

    unHighLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid.receiveLeave();
            return;
        }
        if (!this._isSelected && this._styleContext.has_class('desktop-icons-selected')) {
            this._styleContext.remove_class('desktop-icons-selected');
            this._labelStyleContext.remove_class('desktop-icons-selected');
        }
        this._grid.unHighLightGrids();
    }

    setSelected() {
        this._isSelected = true;
        this._setSelectedStatus();
    }

    unsetSelected() {
        this._isSelected = false;
        this._setSelectedStatus();
    }

    toggleSelected() {
        this._isSelected = !this._isSelected;
        this._setSelectedStatus();
    }

    _setSelectedStatus() {
        if (this._isSelected && !this._styleContext.has_class('desktop-icons-selected')) {
            this._styleContext.add_class('desktop-icons-selected');
            this._labelStyleContext.add_class('desktop-icons-selected');
        }
        if (!this._isSelected && this._styleContext.has_class('desktop-icons-selected')) {
            this._styleContext.remove_class('desktop-icons-selected');
            this._labelStyleContext.remove_class('desktop-icons-selected');
        }
    }

    _setDragSource(widget) {
        widget.drag_source_set(Gdk.ModifierType.BUTTON1_MASK, null, Gdk.DragAction.MOVE | Gdk.DragAction.COPY);
        let targets = new Gtk.TargetList(null);
        targets.add(Gdk.atom_intern('x-special/ding-icon-list', false),
            Gtk.TargetFlags.SAME_APP, Enums.DndTargetInfo.DING_ICON_LIST);
        if ((this._fileExtra != Enums.FileType.USER_DIRECTORY_TRASH) &&
            (this._fileExtra != Enums.FileType.USER_DIRECTORY_HOME) &&
            (this._fileExtra != Enums.FileType.EXTERNAL_DRIVE)) {
            targets.add(Gdk.atom_intern('x-special/gnome-icon-list', false), 0,
                Enums.DndTargetInfo.GNOME_ICON_LIST);
            targets.add(Gdk.atom_intern('text/uri-list', false), 0,
                Enums.DndTargetInfo.URI_LIST);
        }
        widget.drag_source_set_target_list(targets);
        targets = undefined; // prevent memory leaks
        this._connectSignal(widget, 'drag-begin', (w, context) => {
            const scale = this._icon.get_scale_factor();
            let surf = new Cairo.ImageSurface(Cairo.SurfaceType.IMAGE, this.container.get_allocated_width() * scale, this.container.get_allocated_height() * scale);
            // setDeviceScale was introduced to GJS in version 1.69.2
            if (scale != 1.0 && surf.setDeviceScale !== undefined) {
                surf.setDeviceScale(scale, scale);
            }
            let cr = new Cairo.Context(surf);
            this.container.draw(cr);
            let itemnumber = this._desktopManager.getNumberOfSelectedItems();
            if (itemnumber > 1) {
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({
                    red: this._desktopManager.selectColor.red,
                    green: this._desktopManager.selectColor.green,
                    blue: this._desktopManager.selectColor.blue,
                    alpha: 0.6,
                })
                );
                itemnumber -= 1;
                switch (itemnumber.toString().length) {
                case 1:
                    cr.rectangle(1, 1, 30, 20);
                    break;
                case 2:
                    cr.rectangle(1, 1, 40, 20);
                    break;
                default:
                    cr.rectangle(1, 1, 50, 20);
                    break;
                }
                cr.fill();
                cr.setFontSize(18);
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({red: 1.0, green: 1.0, blue: 1.0, alpha: 1}));
                cr.moveTo(1, 17);
                cr.showText(`+${itemnumber}`);
            }
            Gtk.drag_set_icon_surface(context, surf);
            let [x, y] = this._calculateOffset(widget);
            context.set_hotspot(x, y);
            this._desktopManager.onDragBegin(this);
            cr.$dispose();
        });
        this._connectSignal(widget, 'drag-data-get', (w, context, data, info, time) => {
            let dragData = this._desktopManager.fillDragDataGet(info);
            if (dragData != null) {
                let list = ByteArray.fromString(dragData[1]);
                data.set(dragData[0], 8, list);
            }
        });
        this._connectSignal(widget, 'drag-end', (w, context) => {
            this._desktopManager.onDragEnd();
        });
    }

    _calculateOffset(widget) {
        if (widget == this._eventBox) {
            return [((this.width - this.iconwidth) / 2) + this._buttonPressInitialX, this._buttonPressInitialY];
        } else {
            return [((this.width - this.labelwidth) / 2) + this._buttonPressInitialX, (this.iconheight + 2) + this._buttonPressInitialY];
        }
    }

    _setDropDestination(dropDestination) {

    }

    /** *********************
     * Icon Rendering *
     ***********************/

    updateIcon() {
        this._updateIcon();
    }

    async _updateIcon() {
        if (this._destroyed) {
            return;
        }

        this._icon.set_padding(0, 0);
        try {
            let customIcon = this._fileInfo.get_attribute_as_string('metadata::custom-icon');
            if (customIcon && (customIcon != '')) {
                let customIconFile = Gio.File.new_for_uri(customIcon);
                if (customIconFile.query_exists(null)) {
                    let loadedImage = await this._loadImageAsIcon(customIconFile);
                    if (loadedImage | this._destroyed) {
                        return;
                    }
                }
            }
        } catch (error) {
            print(`Error while updating icon: ${error.message}.\n${error.stack}`);
        }

        if (this._fileExtra == Enums.FileType.USER_DIRECTORY_TRASH) {
            let pixbuf = this._createEmblemedIcon(this._fileInfo.get_icon(), null);
            const scale = this._icon.get_scale_factor();
            let surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, scale, null);
            this._icon.set_from_surface(surface);
            return;
        }
        let iconSet = false;
        if (Prefs.nautilusSettings.get_string('show-image-thumbnails') != 'never') {
            let thumbnail = this._desktopManager.thumbnailLoader.getThumbnail(this, this._updateIcon.bind(this));
            if (thumbnail != null) {
                let thumbnailFile = Gio.File.new_for_path(thumbnail);
                iconSet = await this._loadImageAsIcon(thumbnailFile);
                if (this._destroyed) {
                    return;
                }
            }
        }

        if (!iconSet) {
            let pixbuf;
            if (this._isBrokenSymlink) {
                pixbuf = this._createEmblemedIcon(null, 'text-x-generic');
            } else if (this._desktopFile && this._desktopFile.has_key('Icon')) {
                pixbuf = this._createEmblemedIcon(null, this._desktopFile.get_string('Icon'));
            } else {
                pixbuf = this._createEmblemedIcon(this._getDefaultIcon(), null);
            }
            const scale = this._icon.get_scale_factor();
            let surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, scale, null);
            this._icon.set_from_surface(surface);
        }
    }

    _getDefaultIcon() {
        if (this._fileExtra == Enums.FileType.EXTERNAL_DRIVE) {
            return this._custom.get_icon();
        }
        return this._fileInfo.get_icon();
    }

    _loadImageAsIcon(imageFile) {
        if (this._loadThumbnailDataCancellable) {
            this._loadThumbnailDataCancellable.cancel();
        }
        this._loadThumbnailDataCancellable = new Gio.Cancellable();

        return new Promise((resolve, reject) => {
            imageFile.load_bytes_async(this._loadThumbnailDataCancellable, (source, result) => {
                this._loadThumbnailDataCancellable = null;
                try {
                    let [thumbnailData, etagOut] = source.load_bytes_finish(result);
                    let thumbnailStream = Gio.MemoryInputStream.new_from_bytes(thumbnailData);
                    let thumbnailPixbuf = GdkPixbuf.Pixbuf.new_from_stream(thumbnailStream, null);

                    if (thumbnailPixbuf != null) {
                        let width = Prefs.get_desired_width() - 8;
                        let height = Prefs.get_icon_size() - 8;
                        let aspectRatio = thumbnailPixbuf.width / thumbnailPixbuf.height;
                        if ((width / height) > aspectRatio) {
                            width = height * aspectRatio;
                        } else {
                            height = width / aspectRatio;
                        }
                        const scale = this._icon.get_scale_factor();
                        width *= scale;
                        height *= scale;
                        let pixbuf = thumbnailPixbuf.scale_simple(Math.floor(width), Math.floor(height), GdkPixbuf.InterpType.BILINEAR);
                        pixbuf = this._addEmblemsToPixbufIfNeeded(pixbuf);
                        let surface = Gdk.cairo_surface_create_from_pixbuf(pixbuf, scale, null);
                        this._icon.set_from_surface(surface);
                        this._icon.set_padding(4, 4);
                        resolve(true);
                    }
                    resolve(false);
                } catch (e) {
                    resolve(false);
                }
            });
        });
    }

    _copyAndResizeIfNeeded(pixbuf) {
        /**
         * If the pixbuf is the original from the theme, copies it into a new one, to be able
         * to paint the emblems without altering the cached pixbuf in the theme object.
         * Also, ensures that the copied pixbuf is, at least, as big as the desired icon size,
         * to ensure that the emblems fit.
         */

        if (this._copiedPixbuf) {
            return pixbuf;
        }

        this._copiedPixbuf = true;
        let minsize = Prefs.get_icon_size();
        if ((pixbuf.width < minsize) || (pixbuf.height < minsize)) {
            let width = pixbuf.width < minsize ? minsize : pixbuf.width;
            let height = pixbuf.height < minsize ? minsize : pixbuf.height;
            let newpixbuf = GdkPixbuf.Pixbuf.new(pixbuf.colorspace, true, pixbuf.bits_per_sample, width, height);
            newpixbuf.fill(0);
            let x = Math.floor((width - pixbuf.width) / 2);
            let y = Math.floor((height - pixbuf.height) / 2);
            pixbuf.composite(newpixbuf, x, y, pixbuf.width, pixbuf.height, x, y, 1, 1,  GdkPixbuf.InterpType.NEAREST, 255);
            return newpixbuf;
        } else {
            return pixbuf.copy();
        }
    }

    _addEmblemsToPixbufIfNeeded(pixbuf) {
        const scale = this._icon.get_scale_factor();
        this._copiedPixbuf = false;
        let emblem = null;
        let finalSize = Math.floor(Prefs.get_icon_size() / 3) * scale;

        if (this._isDesktopFile && (!this._isValidDesktopFile || !this.trustedDesktopFile)) {
            pixbuf = this._copyAndResizeIfNeeded(pixbuf);
            pixbuf.saturate_and_pixelate(pixbuf, 0.5, true);
            emblem = Gio.ThemedIcon.new('emblem-unreadable');
            pixbuf = this._copyAndResizeIfNeeded(pixbuf);
            let theme = Gtk.IconTheme.get_default();
            let emblemIcon = theme.lookup_by_gicon_for_scale(emblem, finalSize / scale, scale, Gtk.IconLookupFlags.FORCE_SIZE).load_icon();
            emblemIcon.composite(pixbuf, pixbuf.width - finalSize, pixbuf.height - finalSize, finalSize, finalSize, pixbuf.width - finalSize, pixbuf.height - finalSize, 1, 1, GdkPixbuf.InterpType.BILINEAR, 255);
        }

        if (this._isSymlink && (this._desktopManager.showLinkEmblem || this._isBrokenSymlink)) {
            if (this._isBrokenSymlink) {
                emblem = Gio.ThemedIcon.new('emblem-unreadable');
            } else {
                emblem = Gio.ThemedIcon.new('emblem-symbolic-link');
            }
            pixbuf = this._copyAndResizeIfNeeded(pixbuf);
            let theme = Gtk.IconTheme.get_default();
            let emblemIcon = theme.lookup_by_gicon_for_scale(emblem, finalSize / scale, scale, Gtk.IconLookupFlags.FORCE_SIZE).load_icon();
            emblemIcon.composite(pixbuf, pixbuf.width - finalSize, pixbuf.height - finalSize, finalSize, finalSize, pixbuf.width - finalSize, pixbuf.height - finalSize, 1, 1, GdkPixbuf.InterpType.BILINEAR, 255);
        }

        if (this.isStackTop && !this.stackUnique) {
            pixbuf = this._copyAndResizeIfNeeded(pixbuf);
            let theme = Gtk.IconTheme.get_default();
            emblem = Gio.ThemedIcon.new('emblem-downloads');
            let emblemIcon = theme.lookup_by_gicon_for_scale(emblem, finalSize / scale, scale, Gtk.IconLookupFlags.FORCE_SIZE).load_icon();
            emblemIcon.composite(pixbuf, 0, 0, finalSize, finalSize, 0, 0, 1, 1, GdkPixbuf.InterpType.BILINEAR, 255);
        }
        return pixbuf;
    }

    _createEmblemedIcon(icon, iconName) {
        if (icon == null) {
            if (GLib.path_is_absolute(iconName)) {
                try {
                    let iconFile = Gio.File.new_for_commandline_arg(iconName);
                    icon = new Gio.FileIcon({file: iconFile});
                } catch (e) {
                    icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
                }
            } else {
                icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
            }
        }
        let theme = Gtk.IconTheme.get_default();

        const scale = this._icon.get_scale_factor();
        let itemIcon = null;
        try {
            itemIcon = theme.lookup_by_gicon_for_scale(icon, Prefs.get_icon_size(), scale, Gtk.IconLookupFlags.FORCE_SIZE).load_icon();
        } catch (e) {
            itemIcon = theme.load_icon_for_scale('text-x-generic', Prefs.get_icon_size(), scale, Gtk.IconLookupFlags.FORCE_SIZE);
        }

        itemIcon = this._addEmblemsToPixbufIfNeeded(itemIcon);

        return itemIcon;
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get state() {
        return this._state;
    }

    set state(state) {
        if (state == this._state) {
            return;
        }

        this._state = state;
    }

    get isDrive() {
        return this._fileExtra == Enums.FileType.EXTERNAL_DRIVE;
    }

    get isSelected() {
        return this._isSelected;
    }

    get isSpecial() {
        return this._isSpecial;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    set dropCoordinates(pos) {
        this._dropCoordinates = pos;
    }
};
Signals.addSignalMethods(desktopIconItem.prototype);
