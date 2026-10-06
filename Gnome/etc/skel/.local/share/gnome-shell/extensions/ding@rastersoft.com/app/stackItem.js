
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
import Gio from 'gi://Gio';

import * as desktopIconItem from './desktopIconItem.js';
import * as Prefs from './preferences.js';
import * as Enums from './enums.js';

const Signals = imports.signals;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;


export var stackItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, file, attributeContentType, fileExtra) {
        super(desktopManager, fileExtra);
        this._isSpecial = false;
        this._file = file;
        this.isStackTop = true;
        this.stackUnique = false;
        this._size = null;
        this._modifiedTime = null;
        this._attributeContentType = attributeContentType;
        this._createIconActor(Gtk.AccessibleRole.TOGGLE_BUTTON);
        this._createStackTopIcon();
        this._setLabelName(this._file);
        this.setAccessibleName(this._getVisibleName());
    }

    _getEmblems() {
        if (!this.stackUnique) {
            const emblem = Prefs.getUnstackList().includes(this._attributeContentType) ? 'close-stack' : 'open-stack';
            return [
                {
                    icon: Gio.ThemedIcon.new(emblem),
                    size: 3,
                    position: Enums.EmblemPosition.TOP_LEFT,
                },
                {
                    icon: Gio.content_type_get_icon(this._attributeContentType),
                    size: 2,
                    position: Enums.EmblemPosition.BOTTOM_RIGHT,
                },
            ];
        }
        return null;
    }

    _createStackTopIcon() {
        let folder = 'folder';
        if (Prefs.getUnstackList().includes(this._attributeContentType))
            folder = 'folder-open';

        this._icon.set_paintable(this._createEmblemedIcon(null, folder));
    }

    doOpen() {
        this._desktopManager.onToggleStackUnstackThisTypeClicked(this.attributeContentType);
    }

    _doButtonOnePressed() {
        this._desktopManager.onToggleStackUnstackThisTypeClicked(this.attributeContentType);
    }

    setSelected() {
    }

    updateIcon() {
        this._createStackTopIcon();
    }

    _getVisibleName() {
        return this._currentFileName;
    }

    setAccessibleName(filename) {
        const isExpanded = Prefs.getUnstackList().includes(this.attributeContentType);
        this._accessibleBox.update_property([Gtk.AccessibleProperty.LABEL, Gtk.AccessibleProperty.DESCRIPTION], [filename, '']);
        this._accessibleBox.update_state([Gtk.AccessibleState.CHECKED], [isExpanded ? Gtk.AccessibleTristate.TRUE : Gtk.AccessibleTristate.FALSE]);
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get attributeContentType() {
        return this._attributeContentType;
    }

    get displayName() {
        return this._file;
    }

    get file() {
        return this._file;
    }

    get fileName() {
        return this._file;
    }

    get fileSize() {
        return this._size;
    }

    get isAllSelectable() {
        return false;
    }

    get modifiedTime() {
        return this._modifiedTime;
    }

    get path() {
        return `/tmp/${this._file}`;
    }

    get uri() {
        return `file:///tmp/${this._file}`;
    }

    get isStackMarker() {
        return true;
    }

    set size(size) {
        this._size = size;
    }

    set time(time) {
        this._modifiedTime = time;
    }
};
Signals.addSignalMethods(stackItem.prototype);
