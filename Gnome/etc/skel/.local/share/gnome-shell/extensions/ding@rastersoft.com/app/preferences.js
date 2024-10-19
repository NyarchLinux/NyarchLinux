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
imports.gi.versions.Gtk = '3.0';

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Enums = imports.enums;
const PrefsWindow = imports.prefswindow;

const Gettext = imports.gettext;

var _ = Gettext.domain('ding').gettext;

var nautilusSettings;
var nautilusCompression;
var gtkSettings;
var desktopSettings;
var mutterSettings = null;
// This is already in Nautilus settings, so it should not be made tweakable here
var CLICK_POLICY_SINGLE = false;
var prefsWindow;

var prefsWindow;

/**
 *
 * @param path
 */
function init(path) {
    let schemaSource = GioSSS.get_default();
    let schemaGtk = schemaSource.lookup(Enums.SCHEMA_GTK, true);
    gtkSettings = new Gio.Settings({settings_schema: schemaGtk});
    let schemaObj = schemaSource.lookup(Enums.SCHEMA_NAUTILUS, true);
    if (!schemaObj) {
        nautilusSettings = null;
    } else {
        nautilusSettings = new Gio.Settings({settings_schema: schemaObj});
        nautilusSettings.connect('changed', _onNautilusSettingsChanged);
        _onNautilusSettingsChanged();
    }
    const compressionSchema = schemaSource.lookup(Enums.SCHEMA_NAUTILUS_COMPRESSION, true);
    if (!compressionSchema) {
        nautilusCompression = null;
    } else {
        nautilusCompression = new Gio.Settings({settings_schema: compressionSchema});
    }
    let schemaDarkSettings = schemaSource.lookup(Enums.SCHEMA_DARK_SETTINGS, true);
    if (schemaDarkSettings) {
        this.schemaGnomeDarkSettings = new Gio.Settings({ settings_schema: schemaDarkSettings });
    }

    desktopSettings = PrefsWindow.get_schema(path, Enums.SCHEMA);
    let schemaMutter = schemaSource.lookup(Enums.SCHEMA_MUTTER, true);
    if (schemaMutter) {
        mutterSettings = new Gio.Settings({settings_schema: schemaMutter});
    }
}

/**
 *
 */
function showPreferences() {
    if (prefsWindow) {
        return;
    }
    prefsWindow = new Gtk.Window({
        resizable: false,
        window_position: Gtk.WindowPosition.CENTER,
    });
    prefsWindow.connect('destroy', () => {
        prefsWindow = null;
    });
    prefsWindow.set_title(_('Settings'));
    DesktopIconsUtil.windowHidePagerTaskbarModal(prefsWindow, true);
    let frame = PrefsWindow.preferencesFrame(Gtk, desktopSettings, nautilusSettings, gtkSettings);
    prefsWindow.add(frame);
    prefsWindow.show_all();
}

/**
 *
 */
function _onNautilusSettingsChanged() {
    CLICK_POLICY_SINGLE = nautilusSettings.get_string('click-policy') == 'single';
}

/**
 *
 */
function get_icon_size() {
    return Enums.ICON_SIZE[desktopSettings.get_string('icon-size')];
}

/**
 *
 */
function get_desired_width() {
    return Enums.ICON_WIDTH[desktopSettings.get_string('icon-size')];
}

/**
 *
 */
function get_desired_height() {
    return Enums.ICON_HEIGHT[desktopSettings.get_string('icon-size')];
}

/**
 *
 */
function get_start_corner() {
    return Enums.START_CORNER[desktopSettings.get_string('start-corner')].slice();
}

/**
 *
 */
function getSortOrder() {
    return Enums.SortOrder[desktopSettings.get_string(Enums.SortOrder.ORDER)];
}

/**
 *
 * @param order
 */
function setSortOrder(order) {
    let x = Object.values(Enums.SortOrder).indexOf(order);
    desktopSettings.set_enum(Enums.SortOrder.ORDER, x);
}

/**
 *
 */
function getUnstackList() {
    return desktopSettings.get_strv('unstackedtypes');
}

/**
 *
 * @param array
 */
function setUnstackList(array) {
    desktopSettings.set_strv('unstackedtypes', array);
}
