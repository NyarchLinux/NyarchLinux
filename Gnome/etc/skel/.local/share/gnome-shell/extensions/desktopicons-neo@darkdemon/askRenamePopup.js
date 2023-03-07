/* LICENSE INFORMATION
 * 
 * Desktop Icons: Neo - A desktop icons extension for GNOME with numerous features, 
 * customizations, and optimizations.
 * 
 * Copyright 2021 Abdurahman Elmawi (cooper64doom@gmail.com)
 * 
 * This project is based on Desktop Icons NG (https://gitlab.com/rastersoft/desktop-icons-ng),
 * a desktop icons extension for GNOME licensed under the GPL v3.
 * 
 * This project is free and open source software as described in the GPL v3.
 * 
 * This project (Desktop Icons: Neo) is licensed under the GPL v3. To view the details of this license, 
 * visit https://www.gnu.org/licenses/gpl-3.0.html for the necessary information
 * regarding this project's license.
 */

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const DBusUtils = imports.dbusUtils;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;

var AskRenamePopup = class {

    constructor(fileItem) {

        this._desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        this._fileItem = fileItem;
        this._popover = new Gtk.Popover({relative_to: fileItem._container,
                                         modal: true});
        let contentBox = new Gtk.Grid({row_spacing: 6,
                                       column_spacing: 6,
                                       margin: 10});
        this._popover.add(contentBox);
        let label = new Gtk.Label({label: fileItem.isDirectory ? _("Folder name") : _("File name"),
                                   justify: Gtk.Justification.LEFT,
                                   halign: Gtk.Align.START});
        contentBox.attach(label, 0, 0, 2, 1);
        this._textArea = new Gtk.Entry();
        this._textArea.text = fileItem.fileName;
        contentBox.attach(this._textArea, 0, 1, 1, 1);
        this._button = new Gtk.Button({label: _("Rename")});
        contentBox.attach(this._button, 1, 1, 1, 1);
        this._button.connect('clicked', () => {
            this._do_rename();
        });
        this._textArea.connect('changed', () => {
            this._validate();
        });
        this._textArea.connect('activate', () => {
            if (this._button.sensitive) {
                this._do_rename();
            }
        });
        this._textArea.set_can_default(true);
        this._popover.set_default_widget(this._textArea);
        this._button.get_style_context().add_class("suggested-action");
        this._popover.show_all();
        this._validate();
        this._textArea.grab_focus_without_selecting();
        this._textArea.select_region(0, DesktopIconsUtil.getFileExtensionOffset(fileItem.fileName, fileItem.isDirectory));
    }

    _validate() {
        let text = this._textArea.text;
        let final_path = this._desktopPath + '/' + text;
        let final_file = Gio.File.new_for_commandline_arg(final_path);
        if ((text == '') || (-1 != text.indexOf('/')) || (text == this._fileItem.fileName) || final_file.query_exists(null)) {
            this._button.sensitive = false;
        } else {
            this._button.sensitive = true;
        }
    }

    _do_rename() {
        DBusUtils.NautilusFileOperations2Proxy.RenameURIRemote(
            this._fileItem.file.get_uri(), this._textArea.text,
            DBusUtils.NautilusFileOperations2Proxy.platformData(),
            (result, error) => {
                if (error)
                    throw new Error('Error renaming file: ' + error.message);
            }
        );
    }
};
