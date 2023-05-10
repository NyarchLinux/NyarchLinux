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
const Gtk = imports.gi.Gtk;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var ShowErrorPopup = class {
    constructor(text, secondaryText, modal) {
        this._window = new Gtk.MessageDialog({
            window_position: Gtk.WindowPosition.CENTER_ON_PARENT,
            transient_for: null,
            message_type: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.NONE,
        });
        let labels = this._window.get_message_area().get_children();
        labels[1].set_justify(Gtk.Justification.CENTER);
        this._window.secondary_use_markup = true;
        this._window.text = text;
        this._window.secondary_text = secondaryText;
        DesktopIconsUtil.windowHidePagerTaskbarModal(this._window, true);
        this.deleteButton = this._window.add_button(_('Close'), Gtk.ResponseType.OK);
        this.deleteButton.connect('clicked', () => {
            this._window.hide();
            this._window.destroy();
            this._window = null;
        });
        this._window.connect('delete-event', () => {
            this._window.destroy();
            this._window = null;
        });
        if (modal) {
            this._window.show();
        }
    }

    run() {
        this._window.show();
        this.timeoutClose(3000);
    }

    async timeoutClose(time) {
        await DesktopIconsUtil.waitDelayMs(time);
        if (this._window) {
            this.deleteButton.activate();
        }
    }
};
