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
const ExtensionUtils = imports.misc.extensionUtils;
const Gettext = imports.gettext;


var _ = Gettext.domain('desktopicons-neo').gettext;

function init() {}

function buildPrefsWidget() {
    let extension = ExtensionUtils.getCurrentExtension();

    let localedir = extension.dir.get_child('locale');
    if (localedir.query_exists(null))
        Gettext.bindtextdomain('desktopicons-neo', localedir.get_path());

    let frame = new Gtk.Label({ label: _("To configure Desktop Icons: Neo, right-click a blank space on the desktop and choose 'Desktop Icon Settings'"),
                                lines: 5,
                                justify: Gtk.Justification.CENTER,
                                wrap: true,
                                wrap_mode: Pango.WrapMode.WORD});
    if (frame.show_all) {
        frame.show_all();
    } else {
        frame.show();
    }
    return frame;
}
