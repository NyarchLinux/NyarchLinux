
/*
 * Compiz-alike-magic-lamp-effect for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-alike-magic-lamp-effect>
 *
 * This file is part of the gnome-shell extension Compiz-alike-magic-lamp-effect.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension Compiz-alike-magic-lamp-effect.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

export class SettingsData {
    constructor(settings) {
        this.EFFECT = {
            key: 'effect',
            get: function () { return settings.get_string(this.key); },
            set: function (v) { settings.set_string(this.key, v); }
        };
    
        this.DURATION = {
            key: 'duration',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.X_TILES = {
            key: 'x-tiles',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    
        this.Y_TILES = {
            key: 'y-tiles',
            get: function () { return settings.get_double(this.key); },
            set: function (v) { settings.set_double(this.key, v); }
        };
    }
}