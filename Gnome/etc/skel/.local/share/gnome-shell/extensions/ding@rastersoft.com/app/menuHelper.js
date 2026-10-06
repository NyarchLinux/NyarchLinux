/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2025 Sergio Costas (rastersoft@gmail.com)
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

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as Prefs from './preferences.js';

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var MenuHelper = class {
    constructor(desktopManager, mainApp) {
        this._mainApp = mainApp;
        this._desktopManager = desktopManager;
    }

    _newMenuElement(text, action, menu, parameter = null) {
        const item = Gio.MenuItem.new(text, null);
        if (parameter === null)
            item.set_detailed_action(`app.${action}`);
        else
            item.set_action_and_target_value(`app.${action}`, parameter);

        menu.append_item(item);
    }

    _newSection(menu) {
        const section = Gio.Menu.new();
        menu.append_section(null, section);
        return section;
    }

    _addNewAction(name, accels, callback, paramType = null) {
        const newAction = Gio.SimpleAction.new(name, paramType === null ? null : new GLib.VariantType(paramType));
        newAction.connect('activate', callback);
        this._mainApp.add_action(newAction);
        if (accels !== null)
            this._mainApp.set_accels_for_action(`app.${name}`, accels);

        newAction.enabled = true;
        return newAction;
    }

    _addNewActionBoolean(name, accels = null) {
        const newAction = Gio.SimpleAction.new_stateful(name, null, GLib.Variant.new_boolean(Prefs.desktopSettings.get_boolean(name)));
        newAction.connect('change-state', (action, newState) => {
            action.set_state(newState);
            Prefs.desktopSettings.set_boolean(name, newState.get_boolean());
        });
        this._mainApp.add_action(newAction);
        if (accels !== null)
            this._mainApp.set_accels_for_action(name, accels);

        newAction.enabled = true;
    }

    _addNewActionSelection(name, accels = null) {
        const newAction = Gio.SimpleAction.new_stateful(name, GLib.VariantType.new('s'), GLib.Variant.new_string(Prefs.desktopSettings.get_string(name)));
        newAction.connect('activate', (action, parameter) => {
            Prefs.desktopSettings.set_string(name, parameter.get_string()[0]);
            action.set_state(parameter);
        });
        this._mainApp.add_action(newAction);
        if (accels !== null)
            this._mainApp.set_accels_for_action(name, accels);

        newAction.enabled = true;
    }
};
