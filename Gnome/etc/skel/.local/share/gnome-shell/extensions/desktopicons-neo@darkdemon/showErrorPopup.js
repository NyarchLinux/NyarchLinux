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
const Pango = imports.gi.Pango;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;

var ShowErrorPopup = class {

    constructor(text, secondaryText, parentWindow, modal) {

        this._window = new Gtk.MessageDialog({window_position: Gtk.WindowPosition.CENTER_ON_PARENT,
                                              transient_for: parentWindow,
                                              message_type: Gtk.MessageType.ERROR,
                                              buttons: Gtk.ButtonsType.NONE,
                                              text: text,
                                              secondary_text: secondaryText});
        DesktopIconsUtil.windowHidePagerTaskbarModal(this._window, true);
        let deleteButton = this._window.add_button(_("Close"), Gtk.ResponseType.OK);
        if (modal) {
            deleteButton.connect('clicked', () => {
                this._window.hide();
                this._window.destroy();
            });
            this._window.show();
        }
    }
    run() {
        this._window.show();
        this._window.run();
        this._window.hide();
        this._window.destroy();
    }
};
