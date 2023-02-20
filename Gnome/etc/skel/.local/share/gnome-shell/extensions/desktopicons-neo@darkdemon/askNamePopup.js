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
const DesktopIconsUtil = imports.desktopIconsUtil;
const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;

var AskNamePopup = class {

    constructor(filename, title, parentWindow) {

        this._desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        this._window = new Gtk.Dialog({use_header_bar: true,
                                       window_position: Gtk.WindowPosition.CENTER_ON_PARENT,
                                       transient_for: parentWindow,
                                       resizable: false});
        this._button = this._window.add_button(_("OK"), Gtk.ResponseType.OK);
        this._window.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        this._window.set_modal(true);
        this._window.set_title(title);
        DesktopIconsUtil.windowHidePagerTaskbarModal(this._window, true);
        let contentArea = this._window.get_content_area();
        this._textArea = new Gtk.Entry();
        if (filename) {
            this._textArea.text = filename;
        }
        contentArea.pack_start(this._textArea, true, true, 5);
        this._textArea.connect('activate', () => {
            if (this._button.sensitive) {
                this._window.response(Gtk.ResponseType.OK);
            }
        });
        this._textArea.connect('changed', () => {
            this._validate();
        });
        this._validate();
    }

    _validate() {
        let text = this._textArea.text;
        let final_path = this._desktopPath + '/' + text;
        let final_file = Gio.File.new_for_commandline_arg(final_path);
        if ((text == '') || (-1 != text.indexOf('/')) || final_file.query_exists(null)) {
            this._button.sensitive = false;
        } else {
            this._button.sensitive = true;
        }
    }

    run() {
        this._window.show_all();
        let retval = this._window.run();
        this._window.hide();
        if (retval == Gtk.ResponseType.OK) {
            return this._textArea.text;
        } else {
            return null;
        }
    }
};
