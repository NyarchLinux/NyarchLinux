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
import GLib from 'gi://GLib';
import * as DBusUtils from './dbusUtils.js';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
const Gettext = imports.gettext.domain('ding');
import * as SignalManager from './signalManager.js';

const _ = Gettext.gettext;

const RENAME_ENTRY_MIN_CHARS = 30;
const RENAME_ENTRY_MAX_CHARS = 50;

export var AskRenamePopup = class extends SignalManager.SignalManager {
    constructor(extensionManager, fileItem, allowReturnOnSameName, closeCB) {
        super();
        this._extensionManager = extensionManager;
        this._closeCB = closeCB;
        this._allowReturnOnSameName = allowReturnOnSameName;
        this._desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        this._fileItem = fileItem;
        this._popover = new Gtk.Popover();
        this._popover.set_parent(fileItem.container);
        this._popover.set_position(fileItem.relativeX > 0.5 ? Gtk.PositionType.LEFT : Gtk.PositionType.RIGHT);
        const contentBox = new Gtk.Box({
            margin_start: 18,
            margin_end: 18,
            margin_top: 18,
            margin_bottom: 18,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._popover.set_child(contentBox);
        const label = new Gtk.Label({
            label: fileItem.isDirectory ? _('Rename folder') : _('Rename file'),
            justify: Gtk.Justification.CENTER,
            halign: Gtk.Align.CENTER,
            margin_bottom: 12,
        });
        label.add_css_class('title-2');
        contentBox.append(label);
        this._textArea = new Gtk.Entry({
            margin_bottom: 12,
        });
        this._textArea.update_property([Gtk.AccessibleProperty.LABEL], [_('New filename')]);
        this._textArea.text = fileItem.fileName;
        this._textArea.set_width_chars(DesktopIconsUtil.clamp(fileItem.displayName, RENAME_ENTRY_MIN_CHARS, RENAME_ENTRY_MAX_CHARS));
        contentBox.append(this._textArea);
        this._button = new Gtk.Button({
            label: allowReturnOnSameName ? _('OK') : _('Rename'),
            halign: Gtk.Align.END,
        });
        this._button.add_css_class('suggested-action');
        contentBox.append(this._button);
        this.connectSignal(this._button, 'clicked', this._do_rename.bind(this));
        this.connectSignal(this._textArea, 'changed', this._validate.bind(this));
        this.connectSignal(this._textArea, 'activate', this._do_rename.bind(this));
        this.connectSignal(this._popover, 'closed', this._cleanAll.bind(this));
        this._extensionManager.showPopup();
        // this._textArea.set_can_default(true);
        this._popover.set_default_widget(this._textArea);
        this._button.add_css_class('suggested-action');
        contentBox.show();
        this._popover.popup();
        this._validate();
        this._textArea.grab_focus_without_selecting();
        this._textArea.select_region(0, DesktopIconsUtil.getFileExtensionOffset(fileItem.fileName, {'isDirectory': fileItem.isDirectory}).offset);
    }

    _cleanAll() {
        this.disconnectAllSignals();
        this._extensionManager.hidePopup();
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
        const text = this._textArea.text;
        const finalPath = `${this._desktopPath}/${text}`;
        const finalFile = Gio.File.new_for_commandline_arg(finalPath);
        if ((text === '') || (text.indexOf('/') !== -1) ||
            ((text === this._fileItem.fileName) && !this._allowReturnOnSameName) ||
            (finalFile.query_exists(null) && (text !== this._fileItem.fileName)))
            this._button.sensitive = false;
        else
            this._button.sensitive = true;
    }

    _do_rename() {
        if (!this._button.sensitive)
            return;

        this._popover.popdown();
        if (this._fileItem.fileName === this._textArea.text)
            return;

        DBusUtils.RemoteFileOperations.RenameURIRemote(
            this._fileItem.file.get_uri(), this._textArea.text
        ).catch(e => {
            print(e);
        });
    }

    closeWindow() {
        this._popover.popdown();
    }
};
