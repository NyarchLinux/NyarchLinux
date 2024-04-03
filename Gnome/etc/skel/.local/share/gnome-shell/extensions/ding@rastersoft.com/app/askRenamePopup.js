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
/* exported AskRenamePopup */
'use strict';
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const DBusUtils = imports.dbusUtils;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var AskRenamePopup = class {
    constructor(fileItem, allowReturnOnSameName, closeCB) {
        this._closeCB = closeCB;
        this._allowReturnOnSameName = allowReturnOnSameName;
        this._desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        this._fileItem = fileItem;
        this._popover = new Gtk.Popover({
            relative_to: fileItem._iconContainer,
            modal: true,
        });
        let contentBox = new Gtk.Grid({
            row_spacing: 6,
            column_spacing: 6,
            margin: 10,
        });
        this._popover.add(contentBox);
        let label = new Gtk.Label({
            label: fileItem.isDirectory ? _('Folder name') : _('File name'),
            justify: Gtk.Justification.LEFT,
            halign: Gtk.Align.START,
        });
        contentBox.attach(label, 0, 0, 2, 1);
        this._textArea = new Gtk.Entry();
        this._textArea.text = fileItem.fileName;
        contentBox.attach(this._textArea, 0, 1, 1, 1);
        this._button = new Gtk.Button({label: allowReturnOnSameName ? _('OK') : _('Rename')});
        contentBox.attach(this._button, 1, 1, 1, 1);
        this._buttonId = this._button.connect('clicked', this._do_rename.bind(this));
        this._textAreaChangedId = this._textArea.connect('changed', this._validate.bind(this));
        this._textAreaActivateId = this._textArea.connect('activate', this._do_rename.bind(this));
        this._popoverId = this._popover.connect('closed', this._cleanAll.bind(this));
        this._textArea.set_can_default(true);
        this._popover.set_default_widget(this._textArea);
        this._button.get_style_context().add_class('suggested-action');
        contentBox.show_all();
        this._popover.popup();
        this._validate();
        this._textArea.grab_focus_without_selecting();
        this._textArea.select_region(0, DesktopIconsUtil.getFileExtensionOffset(fileItem.fileName, {'isDirectory': fileItem.isDirectory}).offset);
    }

    _cleanAll() {
        this._button.disconnect(this._buttonId);
        this._textArea.disconnect(this._textAreaActivateId);
        this._textArea.disconnect(this._textAreaChangedId);
        this._popover.disconnect(this._popoverId);
        this._closeCB();
    }

    updateFileItem(fileItem) {
        this._fileItem = fileItem;
        if (fileItem) {
            this._popover.set_relative_to(this._fileItem._iconContainer);
            this._popover.modal = true;
            this._textArea.set_position(this._cursorPosition);
        } else {
            this._cursorPosition = this._textArea.get_position();
            this._popover.modal = false;
            this._popover.set_relative_to(null);
        }
    }

    _validate() {
        let text = this._textArea.text;
        let finalPath = `${this._desktopPath}/${text}`;
        let finalFile = Gio.File.new_for_commandline_arg(finalPath);
        if ((text == '') || (text.indexOf('/') !== -1) ||
           ((text == this._fileItem.fileName) && !this._allowReturnOnSameName) ||
           (finalFile.query_exists(null) && (text !== this._fileItem.fileName))) {
            this._button.sensitive = false;
        } else {
            this._button.sensitive = true;
        }
    }

    _do_rename() {
        if (!this._button.sensitive) {
            return;
        }
        this._popover.popdown();
        if (this._fileItem.fileName == this._textArea.text) {
            return;
        }
        DBusUtils.RemoteFileOperations.RenameURIRemote(
            this._fileItem.file.get_uri(), this._textArea.text
        );
    }

    closeWindow() {
        this._popover.popdown();
    }
};
