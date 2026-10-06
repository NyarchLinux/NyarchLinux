
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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Pango from 'gi://Pango';

import * as dndClipboardUtils from './dndClipboardUtils.js';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as Prefs from './preferences.js';
import * as Enums from './enums.js';
import * as SignalManager from './signalManager.js';

const Signals = imports.signals;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var desktopIconItem = class desktopIconItem extends SignalManager.SignalManager {
    constructor(desktopManager, fileExtra) {
        super();
        this._desktopManager = desktopManager;
        this._fileExtra = fileExtra;
        this._loadThumbnailDataCancellable = null;
        this._queryFileInfoCancellable = null;
        this._grid = null;
        this._lastClickTime = 0;
        this._lastClickButton = 0;
        this._clickCount = 0;
        this._isSelected = false;
        this._isKeyboardSelected = false;
        this._isSpecial = false;
        this._savedCoordinates = null;
        this._dropCoordinates = null;
        this._destroyed = false;
        this._relativeX = 0.5;
    }

    /** *********************
     * Destroyers *
     ***********************/

    removeFromGrid(callOnDestroy) {
        if (this._grid) {
            this._grid.removeItem(this);
            this._grid = null;
        }
        if (callOnDestroy)
            this._onDestroy();
    }

    _destroy() {
        this._destroyed = true;
        /* Regular file data */
        if (this._queryFileInfoCancellable) {
            this._queryFileInfoCancellable.cancel();
            this._queryFileInfoCancellable = null;
        }

        /* Thumbnailing */
        if (this._loadThumbnailDataCancellable) {
            this._loadThumbnailDataCancellable.cancel();
            this._loadThumbnailDataCancellable = null;
        }
        /* Disconnect signals */
        this.disconnectAllSignals();
        this.container = null;
        this._icon = null;
        this._label = null;
        this._containerRectangle = null;
        if (this._grid) {
            this._grid.removeItem(this);
            this._grid = null;
        }
        this._desktopManager = null;
        this._fileExtra = null;
        this._savedCoordinates = null;
        this._dropCoordinates = null;
    }

    _onDestroy() {
        if (!this._destroyed)
            this._destroy();
    }

    /** *********************
     * Creators *
     ***********************/

    _createIconActor(role) {
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.START,
        });
        this.connectSignal(this.container, 'destroy', () => this._onDestroy());

        this.connectSignal(Prefs.nautilusSettings, 'changed', () => {
            this._setCursor();
        });
        this._setCursor();

        this._icon = new Gtk.Picture({
            can_shrink: false,
            keep_aspect_ratio: true,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.START,
            vexpand: false,
        });

        /* Append two labels in the same box, and use a Gtk.BinLayout to paint one over the other.
           One label will contain the icon name, and the other will contain just two blank lines.
           This way, the icon container will have always the same size, no matter if the label has
           one or two lines. I had to use this trick to ensure that the label text is always at the
           top, and the highlight to have the same size for labels with one or two lines, at the same
           time. */
        const labelContainer = new Gtk.Box();
        this._label = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.START,
            vexpand: false,
            natural_wrap_mode: Gtk.NaturalWrapMode.WORD,
            ellipsize: Pango.EllipsizeMode.END,
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
            yalign: 0.0,
            xalign: 0.5,
            justify: Gtk.Justification.CENTER,
            lines: 2,
        });
        const twoLinesLabel = new Gtk.Label({
            label: ' \n ',
            yalign: 0.0,
            xalign: 0.5,
            justify: Gtk.Justification.CENTER,
            lines: 2,
        });

        labelContainer.append(twoLinesLabel);
        labelContainer.append(this._label);
        labelContainer.set_layout_manager(new Gtk.BinLayout());

        this._accessibleBox = new Gtk.Box({
            focusable: true,
            can_focus: true,
            accessible_role: role,
        });

        if (this._desktopManager.darkText)
            this._label.add_css_class('file-label-dark');
        else
            this._label.add_css_class('file-label');


        this.container.append(this._icon);
        this.container.append(labelContainer);
        this.container.append(this._accessibleBox);

        this._icon.add_css_class('icon-item');
        this.container.add_css_class('file-item');

        this._containerRectangle = new Gdk.Rectangle();

        const buttonMainController = new Gtk.GestureClick();
        buttonMainController.propagation_phase = Gtk.PropagationPhase.BUBBLE;
        this.container.add_controller(buttonMainController);
        buttonMainController.button = 1;
        this.connectSignal(buttonMainController, 'pressed', this._doButtonOnePressed.bind(this));
        this.connectSignal(buttonMainController, 'released', this._onReleaseButton.bind(this));

        const buttonMenuController = new Gtk.GestureClick();
        buttonMenuController.propagation_phase = Gtk.PropagationPhase.BUBBLE;
        this.container.add_controller(buttonMenuController);
        buttonMenuController.button = 3;
        this.connectSignal(buttonMenuController, 'pressed', this._doButtonThreePressed.bind(this));

        const motionController = new Gtk.EventControllerMotion();
        this.container.add_controller(motionController);
        this.connectSignal(motionController, 'enter', this._onEnter.bind(this));
        this.connectSignal(motionController, 'leave', this._onLeave.bind(this));

        this._setDragSource(this.container);
        this.container.show();
    }

    _doLabelSizeAllocated() {
        this._calculateLabelRectangle();
    }

    _setCursor() {
        if (Prefs.nautilusSettings.get_string('click-policy') === 'single')
            this.container.set_cursor_from_name('pointer');
        else
            this.container.set_cursor(null);
    }

    checkIntersects(rectangle) {
        return this._containerRectangle.intersect(rectangle)[0];
    }

    _calculateLabelRectangle() {
        this.labelwidth = this._label.get_allocated_width();
        this.labelheight = this._label.get_allocated_height();
    }

    setCoordinates(x, y, width, height, margin, grid, relativeX) {
        this._x1 = x;
        this._y1 = y;
        this._relativeX = relativeX;
        this.width = width;
        this.height = height;
        this._grid = grid;
        this.container.set_size_request(width, 0);
        this._label.margin_start = margin;
        this._label.margin_end = margin;
        this._label.margin_bottom = margin;
        this._containerRectangle.x = this._x1;
        this._containerRectangle.y = this._y1;
        this._containerRectangle.width = this.width;
        this._containerRectangle.height = this.height;
    }

    getCoordinates() {
        this._x2 = this._x1 + this.container.get_allocated_width() - 1;
        this._y2 = this._y1 + this.container.get_allocated_height() - 1;
        return [this._x1, this._y1, this._x2, this._y2, this._grid];
    }

    _setLabelName(text) {
        this._currentFileName = text;
        this.container.set_tooltip_text(text);
        let lastCutPos = -1;
        let newText = '';
        for (let pos = 0; pos < text.length; pos++) {
            const character = text[pos];
            newText += character;
            let nextChar = '';
            if (pos < (text.length - 1))
                nextChar = text[pos + 1];

            if (character === ' ')
                lastCutPos = pos;

            if (['.', ',', '-', '_', '@', ':'].includes(character)) {
                /* if the next character is already an space or this is the last
                 * character, the string will be naturally cut here, so we do
                 * nothing.
                 */
                if ((nextChar === ' ') || (nextChar === ''))
                    continue;

                /* if there is a cut element in the last four previous characters,
                 * do not add a new cut element.
                 */
                if ((lastCutPos > -1) && ((pos - lastCutPos) < 4))
                    continue;

                newText += '\u200B';
            }
        }
        // adding a CR at the end ensures that the text has always two lines, and
        // that allows to have same-size icons.
        this._label.label = newText;
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _onReleaseButton(controller, nPress, x, y) {
        const state = DesktopIconsUtil.getControllerStatus(controller);
        if (nPress === 1) {
            if (state.shift || state.control)
                this._desktopManager.selected(this, Enums.Selection.WITH_SHIFT);
            else
                this._desktopManager.selected(this, Enums.Selection.ALONE);
        }
        this._doButtonOneReleased(controller, nPress, x, y, state);
    }

    _doButtonThreePressed(controller, nPress, x, y) {
        controller.set_state(Gtk.EventSequenceState.CLAIMED);
        this._buttonPressInitialX = x;
        this._buttonPressInitialY = y;
        if (nPress !== 1)
            return;

        if (!this._isSelected)
            this._desktopManager.selected(this, Enums.Selection.RIGHT_BUTTON);

        this._desktopManager.showFileMenu(this, x, y);
    }

    _doButtonOnePressed(controller, nPress, x, y) {
        this._buttonPressInitialX = x;
        this._buttonPressInitialY = y;
        const state = DesktopIconsUtil.getControllerStatus(controller);
        if (!this._isSelected && !state.shift && !state.control)
            this._desktopManager.selected(this, Enums.Selection.ALONE);

        // don't manage the click event in the grid.
        // We can't use EVENT_STOP or similar because that would break
        // the Drag'n'Drop controller.
        this._desktopManager.clickCaptured();
    }


    _doButtonOneReleased(controller) {
        controller.set_state(Gtk.EventSequenceState.CLAIMED);
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    _onEnter() {
        if (!this.container.has_css_class('file-item-hover'))
            this.container.add_css_class('file-item-hover');

        return false;
    }

    _onLeave() {
        if (this.container.has_css_class('file-item-hover'))
            this.container.remove_css_class('file-item-hover');

        return false;
    }

    _hasToRouteDragToGrid() {
        if (this._grid)
            return true;

        return false;
    }


    highLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid.receiveMotion(this._x1, this._y1, true);
            return;
        }
        if (!this.container.has_css_class('desktop-icons-selected'))
            this.container.add_css_class('desktop-icons-selected');

        this._grid.highLightGridAt(this._x1, this._y1);
    }

    unHighLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid.receiveLeave();
            return;
        }
        if (this.container.has_css_class('desktop-icons-selected'))
            this.container.remove_css_class('desktop-icons-selected');

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
        let grabFocus = false;
        if (this._isKeyboardSelected && this.container && !this.container.has_css_class('desktop-icons-selected-keyboard')) {
            this.container.add_css_class('desktop-icons-selected-keyboard');
            if (this._isKeyboardSelected)
                grabFocus = true;
        }
        if (!this._isKeyboardSelected && this.container && this.container.has_css_class('desktop-icons-selected-keyboard'))
            this.container.remove_css_class('desktop-icons-selected-keyboard');

        if (this._isSelected && this.container && !this.container.has_css_class('desktop-icons-selected')) {
            this.container.add_css_class('desktop-icons-selected');
            if (this._isKeyboardSelected)
                grabFocus = true;
        }
        if (!this._isSelected && this.container && this.container.has_css_class('desktop-icons-selected'))
            this.container.remove_css_class('desktop-icons-selected');

        if (grabFocus) {
            this.setAccessibleName(this._getVisibleName());
            this._accessibleBox.grabFocus();
        }
    }

    _setDragSource(widget) {
        const dragController = new Gtk.DragSource();
        dragController.set_actions(Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.ASK);
        widget.add_controller(dragController);
        this.connectSignal(dragController, 'prepare', () => {
            if (!this.isSelected)
                this.setSelected();

            const selection = this._desktopManager.getCurrentSelection(false);
            return dndClipboardUtils.loadDragData({fileList: selection, specialFilesSelected: this._desktopManager.checkIfSpecialFilesAreSelected()});
        });
        this.connectSignal(dragController, 'drag-begin', () => {
            this._desktopManager.onDragBegin(this);
        });
        this.connectSignal(dragController, 'drag-end', () => {
            this._desktopManager.onDragEnd();
        });
    }

    _calculateOffset(_widget) {
        return [((this.width - this.labelwidth) / 2) + this._buttonPressInitialX, (this.iconheight + 2) + this._buttonPressInitialY];
    }

    _setDropDestination(_dropDestination) {}

    /** *********************
     * Icon Rendering *
     ***********************/

    updateIcon() {
        this._updateIcon().catch(logError);
    }

    async _updateIcon() {
        if (this._destroyed)
            return;


        const isNotTrusted = (this._isDesktopFile && !this.trustedDesktopFile) || (this._isAppImageFile && !this.trustedAppImageFile);

        try {
            if (!isNotTrusted) {
                const customIcon = this._fileInfo.get_attribute_as_string('metadata::custom-icon');
                if (customIcon && (customIcon !== '')) {
                    const customIconFile = Gio.File.new_for_uri(customIcon);
                    if (customIconFile.query_exists(null)) {
                        const loadedImage = await this._loadImageAsIcon(customIconFile);
                        if (loadedImage || this._destroyed)
                            return;
                    }
                }
            }
        } catch (error) {
            console.error(error, `Error while updating icon: ${error.message}`);
        }
        if (this._destroyed)
            return;


        if (this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH) {
            const iconPaintable = this._createEmblemedIcon(this._fileInfo.get_icon(), null);
            this._icon.set_paintable(iconPaintable);
            return;
        }
        let iconSet = false;
        if (!isNotTrusted) {
            if (Prefs.nautilusSettings.get_string('show-image-thumbnails') !== 'never') {
                const thumbnail = await this._desktopManager.thumbnailLoader.getThumbnail(this);
                if (this._destroyed)
                    return;

                if (thumbnail !== null) {
                    const thumbnailFile = Gio.File.new_for_path(thumbnail);
                    iconSet = await this._loadImageAsIcon(thumbnailFile);
                    if (this._destroyed)
                        return;
                }
            }
        }

        if (!iconSet) {
            let iconPaintable;
            if (this._isBrokenSymlink)
                iconPaintable = this._createEmblemedIcon(null, 'text-x-generic');
            else if (this._desktopFile && this._desktopFile.has_key('Icon') && !isNotTrusted)
                iconPaintable = this._createEmblemedIcon(null, this._desktopFile.get_string('Icon'));
            else
                iconPaintable = this._createEmblemedIcon(this._getDefaultIcon(), null);

            // If the paintable isn't deleted first, it's not refreshed
            this._icon.set_paintable(null);
            this._icon.set_paintable(iconPaintable);
        }
    }

    _getDefaultIcon() {
        if (this._fileExtra === Enums.FileType.EXTERNAL_DRIVE)
            return this._custom.get_icon();

        return this._fileInfo.get_icon();
    }

    async _loadImageAsIcon(imageFile) {
        if (this._loadThumbnailDataCancellable)
            this._loadThumbnailDataCancellable.cancel();

        this._loadThumbnailDataCancellable = new Gio.Cancellable();

        try {
            const [thumbnailData] = await imageFile.load_bytes_async(this._loadThumbnailDataCancellable);
            if (this._destroyed)
                return false;


            const iconTexture = Gdk.Texture.new_from_bytes(thumbnailData);
            const iconSize = Prefs.getIconSize();
            let width = Prefs.getDesiredWidth();
            let height = iconSize;
            const aspectRatio = iconTexture.width / iconTexture.height;
            if ((width / height) > aspectRatio)
                width = Math.floor(height * aspectRatio);
            else
                height = Math.floor(width / aspectRatio);
            const iconPaintableSnapshot = Gtk.Snapshot.new();
            iconTexture.snapshot(iconPaintableSnapshot, width, height);
            let icon = iconPaintableSnapshot.to_paintable(null);
            icon = this._addEmblemsToIconIfNeeded(icon);
            if (this._icon) {
                const topMargin = (iconSize - height) / 2;
                this._icon.margin_top = topMargin;
                this._icon.margin_bottom = iconSize - topMargin - height;
                this._icon.set_paintable(icon);
                this._icon.show();
            } else {
                console.error('Icon is null');
            }
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return false;


            console.error(e, `Error while loading ${imageFile.get_uri()} as icon`);
            return false;
        }
        return true;
    }

    _addEmblemsToIconIfNeeded(iconPaintable) {
        const emblems = this._getEmblems();

        if (emblems === null)
            return iconPaintable;

        const iconWidth = iconPaintable.get_intrinsic_width();
        const iconHeight = iconPaintable.get_intrinsic_height();
        const iconPaintableSnapshot = Gtk.Snapshot.new();
        iconPaintable.snapshot(iconPaintableSnapshot, iconWidth, iconHeight);

        for (const emblem of emblems) {
            const scale = this._icon.get_scale_factor();
            const finalSize = Math.floor(Prefs.getIconSize() / emblem.size);
            const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            const emblemIcon = theme.lookup_by_gicon(emblem.icon, finalSize, scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
            const emblemSnapshot = Gtk.Snapshot.new();
            const emblemWidth = emblemIcon.get_intrinsic_width();
            const emblemHeight = emblemIcon.get_intrinsic_height();
            emblemIcon.snapshot(emblemSnapshot, emblemWidth, emblemHeight);
            let node = emblemSnapshot.to_node();
            if (emblem.position !== Enums.EmblemPosition.TOP_LEFT) {
                const point = new Graphene.Point();
                point.x = iconWidth - emblemWidth;
                point.y = iconHeight - emblemHeight;
                const translation = new Gsk.Transform().translate(point);
                node = new Gsk.TransformNode(node, translation);
            }
            iconPaintableSnapshot.append_node(node);
        }
        return iconPaintableSnapshot.to_paintable(null);
    }

    _createEmblemedIcon(icon, iconName) {
        if (icon === null) {
            if (GLib.path_is_absolute(iconName)) {
                try {
                    const iconFile = Gio.File.new_for_commandline_arg(iconName);
                    icon = new Gio.FileIcon({file: iconFile});
                } catch {
                    icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
                }
            } else {
                try {
                    icon = Gio.Icon.new_for_string(iconName);
                } catch {
                    icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
                }
            }
        }
        const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        const scale = this._icon.get_scale_factor();
        let iconPaintable = null;
        try {
            iconPaintable = theme.lookup_by_gicon(icon, Prefs.getIconSize(), scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
        } catch {
            iconPaintable = theme.lookup_icon('text-x-generic', [], Prefs.getIconSize(), scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
        }
        return this._addEmblemsToIconIfNeeded(iconPaintable);
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get state() {
        return this._state;
    }

    set state(state) {
        if (state === this._state)
            return;


        this._state = state;
    }

    get grid() {
        return this._grid;
    }

    get isDrive() {
        return this._fileExtra === Enums.FileType.EXTERNAL_DRIVE;
    }

    get isSelected() {
        return this._isSelected;
    }

    get isKeyboardSelected() {
        return this._isKeyboardSelected;
    }

    set isKeyboardSelected(status) {
        this._isKeyboardSelected = status;
        this._setSelectedStatus();
    }

    get isSpecial() {
        return this._isSpecial;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    get relativeX() {
        return this._relativeX;
    }

    set dropCoordinates(pos) {
        this._dropCoordinates = pos;
    }
};
Signals.addSignalMethods(desktopIconItem.prototype);
