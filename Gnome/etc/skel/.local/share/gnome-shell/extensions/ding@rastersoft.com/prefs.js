
/* Desktop Icons GNOME Shell extension
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const ExtensionUtils = imports.misc.extensionUtils;
const Gettext = imports.gettext;
const Me = ExtensionUtils.getCurrentExtension();
const Enums = Me.imports.enums;
const PrefsWindow = Me.imports.prefswindow;

var _ = Gettext.domain('ding').gettext;

/**
 *
 */
function init() {}

/**
 *
 */
function buildPrefsWidget() {
    let schemaSource = GioSSS.get_default();
    let schemaGtk = schemaSource.lookup(Enums.SCHEMA_GTK, true);
    let gtkSettings = new Gio.Settings({settings_schema: schemaGtk});
    let schemaObj = schemaSource.lookup(Enums.SCHEMA_NAUTILUS, true);
    let nautilusSettings;
    if (!schemaObj) {
        nautilusSettings = null;
    } else {
        nautilusSettings = new Gio.Settings({settings_schema: schemaObj});
    }
    let desktopSettings = PrefsWindow.get_schema(Me.dir.get_path(), Enums.SCHEMA);

    let localedir = Me.dir.get_child('locale');
    if (localedir.query_exists(null)) {
        Gettext.bindtextdomain('ding', localedir.get_path());
    }

    let frame = PrefsWindow.preferencesFrame(Gtk, desktopSettings, nautilusSettings, gtkSettings);
    if (frame.show_all) {
        frame.show_all();
    } else {
        frame.show();
    }
    return frame;
}
