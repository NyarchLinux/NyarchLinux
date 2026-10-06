/* DING: Desktop Icons New Generation for GNOME Shell
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
import GObject from 'gi://GObject';
const Gettext = imports.gettext;
import Gio from 'gi://Gio';
const GioSSS = Gio.SettingsSchemaSource;
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

var _ = Gettext.domain('ding').gettext;

/**
 *
 * @param {string} path
 * @param {string} schema
 */
export function getSchema(path, schema) {
    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaSource;
    let schemaFile = Gio.File.new_for_path(GLib.build_filenamev([path, 'schemas', 'gschemas.compiled']));
    if (schemaFile.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(GLib.build_filenamev([path, 'schemas']), GioSSS.get_default(), false);
    } else {
        schemaFile = Gio.File.new_for_path(GLib.build_filenamev([path, '..', 'schemas', 'gschemas.compiled']));
        if (schemaFile.query_exists(null))
            schemaSource = GioSSS.new_from_directory(GLib.build_filenamev([path, '..', 'schemas']), GioSSS.get_default(), false);
        else
            schemaSource = GioSSS.get_default();
    }
    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error(`Schema ${schema} could not be found for extension. Please check your installation.`);


    return new Gio.Settings({settings_schema: schemaObj});
}

/**
 *
 * @param {GLib.Schema} desktopSettings
 * @param {GLib.Schema} nautilusSettings
 * @param {GLib.Schema} gtkSettings
 */
export function preferencesFrame(desktopSettings, nautilusSettings, gtkSettings) {
    const frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
        margin_top: 10,
        margin_bottom: 10,
        margin_start: 10,
        margin_end: 10,
    });
    if (!frame.add)
        frame.add = frame.append;


    frame.add(buildSelector(desktopSettings, 'icon-size', _('Size for the desktop icons'), {'tiny': _('Tiny'), 'small': _('Small'), 'standard': _('Standard'), 'large': _('Large')}));
    frame.add(buildSwitcher(desktopSettings, 'show-home', _('Show the personal folder in the desktop')));
    frame.add(buildSwitcher(desktopSettings, 'show-trash', _('Show the trash icon in the desktop')));
    frame.add(buildSwitcher(desktopSettings, 'show-volumes', _('Show external drives in the desktop')));
    frame.add(buildSwitcher(desktopSettings, 'show-network-volumes', _('Show network drives in the desktop')));
    frame.add(buildSelector(desktopSettings,
        'start-corner',
        _('New icons alignment'),
        {
            'top-left': _('Top-left corner'),
            'top-right': _('Top-right corner'),
            'bottom-left': _('Bottom-left corner'),
            'bottom-right': _('Bottom-right corner'),
        }));
    frame.add(buildSwitcher(desktopSettings, 'add-volumes-opposite', _('Add new drives to the opposite side of the screen')));
    frame.add(buildSwitcher(desktopSettings, 'show-drop-place', _("Highlight the drop place during Drag'n'Drop")));
    frame.add(buildSwitcher(desktopSettings, 'use-nemo', _('Use Nemo to open folders')));

    frame.add(buildSwitcher(desktopSettings, 'show-link-emblem', _('Add an emblem to soft links')));

    frame.add(buildSwitcher(desktopSettings, 'dark-text-in-labels', _('Use dark text in icon labels')));

    frame.add(new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL}));


    // Nautilus options
    const frameLabel = new Gtk.Label({
        label: `<b>${_('Settings shared with Nautilus')}</b>`,
        use_markup: true,
    });
    const nautilusFrame = new Gtk.Frame({label_widget: frameLabel});
    const nautilusBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 5,
        margin_bottom: 5,
        margin_start: 5,
        margin_end: 5,
        spacing: 10,
    });
    if (nautilusFrame.add)
        nautilusFrame.add(nautilusBox);
    else
        nautilusFrame.set_child(nautilusBox);

    frame.add(nautilusFrame);

    if (!nautilusBox.add)
        nautilusBox.add = nautilusBox.append;

    nautilusBox.add(buildSelector(nautilusSettings, 'click-policy', _('Click type for open files'), {'single': _('Single click'), 'double': _('Double click')}));
    nautilusBox.add(buildSwitcher(gtkSettings, 'show-hidden', _('Show hidden files')));
    nautilusBox.add(buildSwitcher(nautilusSettings, 'show-delete-permanently', _('Show a context menu item to delete permanently')));
    // Gnome Shell 40 removed this option
    try {
        nautilusBox.add(buildSelector(nautilusSettings,
            'executable-text-activation',
            _('Action to do when launching a program from the desktop'), {
                'display': _('Display the content of the file'),
                'launch': _('Launch the file'),
                'ask': _('Ask what to do'),
            }));
    } catch {
    }
    nautilusBox.add(buildSelector(nautilusSettings,
        'show-image-thumbnails',
        _('Show image thumbnails'), {
            'never': _('Never'),
            'local-only': _('Local files only'),
            'always': _('Always'),
        }));
    return frame;
}

/**
 *
 * @param {GLib.Schema} settings
 * @param {string} key
 * @param {string} labelText
 */
export function buildSwitcher(settings, key, labelText) {
    const hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10});
    const label = new Gtk.Label({label: labelText, xalign: 0});
    let status = false;
    if (settings)
        status = settings.get_boolean(key);

    const switcher = new Gtk.Switch({active: status});
    label.set_hexpand(true);
    switcher.set_hexpand(false);
    switcher.set_halign(Gtk.Align.END);
    if (settings)
        settings.bind(key, switcher, 'active', 3);
    else
        switcher.sensitive = false;

    if (hbox.pack_start) {
        hbox.pack_start(label, true, true, 0);
        hbox.add(switcher);
    } else {
        hbox.append(label);
        hbox.append(switcher);
    }
    return hbox;
}

/**
 *
 * @param {GLib.Schema} settings
 * @param {string} key
 * @param {string} labelText
 * @param {Dictionary} elements
 */
export function buildSelector(settings, key, labelText, elements) {
    const listStore = new Gtk.ListStore();
    listStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
    if (settings) {
        const schemaKey = settings.settings_schema.get_key(key);
        const values = schemaKey.get_range().get_child_value(1).get_child_value(0).get_strv();
        for (const val of values) {
            const iter = listStore.append();
            let visibleText = val;
            if (visibleText in elements)
                visibleText = elements[visibleText];

            listStore.set(iter, [0, 1], [visibleText, val]);
        }
    }
    const hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10});
    const label = new Gtk.Label({label: labelText, xalign: 0});
    const combo = new Gtk.ComboBox({model: listStore});
    const rendererText = new Gtk.CellRendererText();
    combo.pack_start(rendererText, false);
    combo.add_attribute(rendererText, 'text', 0);
    combo.set_id_column(1);
    label.set_hexpand(true);
    combo.set_hexpand(false);
    combo.set_halign(Gtk.Align.END);
    if (settings)
        settings.bind(key, combo, 'active-id', 3);
    else
        combo.sensitive = false;

    if (hbox.pack_start) {
        hbox.pack_start(label, true, true, 0);
        hbox.add(combo);
    } else {
        hbox.append(label);
        hbox.append(combo);
    }
    return hbox;
}
