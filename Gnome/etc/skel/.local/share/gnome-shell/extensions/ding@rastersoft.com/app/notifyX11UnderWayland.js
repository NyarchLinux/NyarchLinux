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
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var NotifyX11UnderWayland = class {
    constructor(closeCB) {
        this._window = new Gtk.MessageDialog({
            transient_for: null,
            message_type: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.NONE,
        });
        const area = this._window.get_message_area();
        this._window.secondary_use_markup = true;
        this._window.text = _('Desktop Icons NG is running under X11Wayland');
        this._window.secondary_text = _("It seems that you have your system configured to force GTK to use X11. This works, but it's suboptimal. You should check your system configuration to fix this.");
        this.deleteButton = this._window.add_button(_('Close'), Gtk.ResponseType.OK);
        this.deleteButton.connect('clicked', () => {
            this._destroy(closeCB);
        });
        this._window.connect('close-request', () => {
            this._destroy(closeCB);
        });
        this.deleteButton.add_css_class('suggested-action');
        this._stopShowing = new Gtk.CheckButton({label: _("Don't show this message anymore.")});
        area.append(this._stopShowing);
        this._window.show();
    }

    _destroy(closeCB) {
        this._window.hide();
        this._window.destroy();
        this._window = null;
        closeCB(this._stopShowing.active);
    }
};
