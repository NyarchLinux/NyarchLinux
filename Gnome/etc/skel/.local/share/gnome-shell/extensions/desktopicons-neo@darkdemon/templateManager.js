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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Enums = imports.enums;
const DesktopIconsUtil = imports.desktopIconsUtil;

var TemplateManager = class {

    constructor() {
        this._templates = [];
        this._templatesEnumerateCancellable = null;
        this._templateDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_TEMPLATES);
        if (this._templateDir == GLib.get_home_dir()) {
            this._templateDir = null;
        }
        if (this._templateDir != null) {
            this._templateGFile = Gio.File.new_for_path(this._templateDir);
            this._monitor = this._templateGFile.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect("changed", () => {
                this._refreshTemplates();
            });
            this._refreshTemplates();
        } else {
            this._templateGFile = null;
        }
    }

    getTemplates() {
        let templates = [];
        for(let template of this._templates) {
            let data = {};
            data["icon"] = template.get_icon();
            let name = template.get_name();
            let offset = DesktopIconsUtil.getFileExtensionOffset(name, false);
            data["name"] = name.substring(0, offset);
            data["extension"] = name.substring(offset);
            data["file"] = name;
            templates.push(data);
        }
        return templates;
    }

    _refreshTemplates() {
        if (this._templatesEnumerateCancellable) {
            this._templatesEnumerateCancellable.cancel();
        }
        this._templatesEnumerateCancellable = new Gio.Cancellable();
        this._templateGFile.enumerate_children_async(
            Enums.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            this._templatesEnumerateCancellable,
            (source, result) => {
                try {
                    let fileEnum = source.enumerate_children_finish(result);
                    this._templates = [];
                    let info;
                    while ((info = fileEnum.next_file(null))) {
                        if (info.get_file_type() != Gio.FileType.DIRECTORY) {
                            this._templates.push(info);
                        }
                    }
                } catch(e) {}
            }
        );
    }

    getTemplateFile(name) {
        if (this._templateGFile == null) {
            return null;
        }
        let template = Gio.File.new_for_path(GLib.build_filenamev([this._templateDir, name]));
        if (template.query_exists(null)) {
            return template;
        } else {
            return null;
        }
    }
}
