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

import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
const GioSSS = Gio.SettingsSchemaSource;
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as Enums from './enums.js';
import * as PrefsWindow from './prefswindow.js';

const Gettext = imports.gettext;

var _ = Gettext.domain('ding').gettext;

export var nautilusSettings;
export var nautilusCompression;
export var gtkSettings;
export var desktopSettings;
export var a11YKeyboard = null;
export var a11YApplications = null;
export var schemaGnomeDarkSettings = null;
// This is already in Nautilus settings, so it should not be made tweakable here
export var CLICK_POLICY_SINGLE = false;
export var prefsWindow;

/**
 *
 * @param {string} path
 */
export function init(path) {
    const schemaSource = GioSSS.get_default();
    const schemaGtk = schemaSource.lookup(Enums.SCHEMA_GTK, true);
    gtkSettings = new Gio.Settings({settings_schema: schemaGtk});
    const schemaObj = schemaSource.lookup(Enums.SCHEMA_NAUTILUS, true);
    if (!schemaObj) {
        nautilusSettings = null;
    } else {
        nautilusSettings = new Gio.Settings({settings_schema: schemaObj});
        nautilusSettings.connect('changed', _onNautilusSettingsChanged);
        _onNautilusSettingsChanged();
    }
    const compressionSchema = schemaSource.lookup(Enums.SCHEMA_NAUTILUS_COMPRESSION, true);
    if (!compressionSchema)
        nautilusCompression = null;
    else
        nautilusCompression = new Gio.Settings({settings_schema: compressionSchema});

    const schemaA11YKeyboard = schemaSource.lookup(Enums.SCHEMA_A11Y_KEYBOARD, true);
    if (schemaA11YKeyboard)
        a11YKeyboard = new Gio.Settings({settings_schema: schemaA11YKeyboard});

    const schemaA11YApplications = schemaSource.lookup(Enums.SCHEMA_A11Y_APPLICATIONS, true);
    if (schemaA11YApplications)
        a11YApplications = new Gio.Settings({settings_schema: schemaA11YApplications});


    desktopSettings = PrefsWindow.getSchema(path, Enums.SCHEMA);
}

/**
 *
 */
export function showPreferences() {
    if (prefsWindow)
        return;

    prefsWindow = new Gtk.Window({
        resizable: false,
    });
    prefsWindow.connect('close-request', () => {
        prefsWindow = null;
    });
    prefsWindow.set_title(_('Settings'));
    DesktopIconsUtil.windowHidePagerTaskbarModal(prefsWindow, true);
    const frame = PrefsWindow.preferencesFrame(desktopSettings, nautilusSettings, gtkSettings);
    prefsWindow.set_child(frame);
    prefsWindow.present();
}

/**
 *
 */
export function _onNautilusSettingsChanged() {
    CLICK_POLICY_SINGLE = nautilusSettings.get_string('click-policy') === 'single';
}

/**
 *
 */
export function getIconSize() {
    return Enums.ICON_SIZE[desktopSettings.get_string('icon-size')];
}

/**
 *
 */
export function getDesiredWidth() {
    return Enums.ICON_WIDTH[desktopSettings.get_string('icon-size')];
}

/**
 *
 */
export function getDesiredHeight() {
    return Enums.ICON_HEIGHT[desktopSettings.get_string('icon-size')];
}

export function increaseIconSize() {
    const currentSize = desktopSettings.get_enum('icon-size');
    switch (currentSize) {
    case 3: // tiny
        desktopSettings.set_enum('icon-size', 0); // small
        break;
    case 2: // large
        break;
    default:
        desktopSettings.set_enum('icon-size', currentSize + 1);
        break;
    }
}

export function decreaseIconSize() {
    const currentSize = desktopSettings.get_enum('icon-size');
    switch (currentSize) {
    case 3: // tiny
        break;
    case 0: // small
        desktopSettings.set_enum('icon-size', 3);
        break;
    default:
        desktopSettings.set_enum('icon-size', currentSize - 1);
        break;
    }
}

/**
 *
 */
export function getStartCorner() {
    return Enums.START_CORNER[desktopSettings.get_string('start-corner')].slice();
}

/**
 *
 */
export function getSortOrder() {
    return Enums.SortOrder[desktopSettings.get_string(Enums.SortOrder.ORDER)];
}

/**
 *
 * @param {Enum} order
 */
export function setSortOrder(order) {
    const x = Object.values(Enums.SortOrder).indexOf(order);
    desktopSettings.set_enum(Enums.SortOrder.ORDER, x);
}

/**
 *
 */
export function getUnstackList() {
    return desktopSettings.get_strv('unstackedtypes');
}

/**
 *
 * @param {Array} array
 */
export function setUnstackList(array) {
    desktopSettings.set_strv('unstackedtypes', array);
}
