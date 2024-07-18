
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
import Gio from 'gi://Gio'
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let mainAppControl = Gio.DBusActionGroup.get(
            Gio.DBus.session,
            'com.rastersoft.ding',
            '/com/rastersoft/ding'
        );
        mainAppControl.activate_action('changeDesktopIconSettings', null);

        const page = new Adw.PreferencesPage();

        window.add(page);
        window.connect_after('show', ()=>{window.close();});
    }
}
