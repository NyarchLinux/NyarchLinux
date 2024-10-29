/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
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
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Enums = imports.enums;
const DesktopIconsUtil = imports.desktopIconsUtil;

var TemplatesScriptsManagerFlags = {
    'NONE': 0,
    'ONLY_EXECUTABLE': 1,
    'HIDE_EXTENSIONS': 2,
};

var TemplatesScriptsManager = class {
    constructor(baseFolder, flags, activatedCB) {
        this._activatedCB = activatedCB;
        this._entries = [];
        this._entriesEnumerateCancellable = null;
        this._readingEntries = false;
        this._entriesDir = baseFolder;
        this._entriesDirMonitors = [];
        this._entriesFolderChanged = false;
        this._flags = flags;

        if (this._entriesDir == GLib.get_home_dir()) {
            this._entriesDir = null;
        }
        if (this._entriesDir !== null) {
            this._monitorDir = baseFolder.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._monitorDir.set_rate_limit(1000);
            this._monitorDir.connect('changed', (obj, file, otherFile, eventType) => {
                this._updateEntries().catch(e => {
                    print(`Exception while updating entries in monitor: ${e.message}\n${e.stack}`);
                });
            });
            this._updateEntries().catch(e => {
                print(`Exception while updating entries: ${e.message}\n${e.stack}`);
            });
        }
    }

    async _updateEntries() {
        if (this._readingEntries) {
            this._entriesFolderChanged = true;
            if (this._entriesEnumerateCancellable) {
                this._entriesEnumerateCancellable.cancel();
                this._entriesEnumerateCancellable = null;
            }
            return;
        }

        this._readingEntries = true;
        let entriesList = null;

        do {
            this._entriesDirMonitors.forEach(f => {
                f[0].disconnect(f[1]);
                f[0].cancel();
            });
            this._entriesDirMonitors = [];
            this._entriesFolderChanged = false;
            if (!this._entriesDir.query_exists(null)) {
                entriesList = null;
                break;
            }
            entriesList = await this._processDirectory(this._entriesDir);
        } while ((entriesList === null) || this._entriesFolderChanged);

        this._entries = entriesList;
        this._readingEntries = false;
    }

    async _processDirectory(directory) {
        if (directory !== this._entriesDir) {
            let monitorDir = directory.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            monitorDir.set_rate_limit(1000);
            let monitorId = monitorDir.connect('changed', (obj, file, otherFile, eventType) => {
                this._updateEntries();
            });
            this._entriesDirMonitors.push([monitorDir, monitorId]);
        }

        try {
            var files = await this._readDirectory(directory);
        } catch (e) {
            return null;
        }

        if (files === null) {
            return null;
        }
        let output = [];
        for (let file of files) {
            if (file[2] === null) {
                output.push(file);
                continue;
            }
            file[2] = await this._processDirectory(file[1]);
            if (file[2] === null) {
                return null;
            }
            if (file[2].length != 0) {
                output.push(file);
            }
        }
        return output;
    }

    _readDirectory(directory) {
        return new Promise((resolve, reject) => {
            if (this._entriesEnumerateCancellable) {
                this._entriesEnumerateCancellable.cancel();
            }
            this._entriesEnumerateCancellable = new Gio.Cancellable();
            directory.enumerate_children_async(
                Enums.DEFAULT_ATTRIBUTES,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                this._entriesEnumerateCancellable,
                (source, result) => {
                    this._entriesEnumerateCancellable = null;
                    let fileList = [];
                    try {
                        let fileEnum = source.enumerate_children_finish(result);
                        if (this._entriesFolderChanged) {
                            resolve(null);
                            return;
                        }
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            let isDir = info.get_file_type() == Gio.FileType.DIRECTORY;
                            if ((this._flags & TemplatesScriptsManagerFlags.ONLY_EXECUTABLE) &&
                                !isDir &&
                                !info.get_attribute_boolean('access::can-execute')) {
                                continue;
                            }
                            let child = fileEnum.get_child(info);
                            fileList.push([info.get_name(), isDir ? child : child.get_path(), isDir ? [] : null]);
                        }
                    } catch (e) {
                        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                            resolve(null);
                        } else {
                            reject(new GLib.Error(Gio.IOErrorEnum,
                                Gio.IOErrorEnum.FAILED,
                                'file-read-error'));
                        }
                        return;
                    }
                    fileList.sort((a, b) => {
                        return a[0].localeCompare(b[0], {
                            sensitivity: 'accent',
                            numeric: 'true',
                            localeMatcher: 'lookup',
                        });
                    });
                    resolve(fileList);
                }
            );
        });
    }

    createMenu() {
        return this._createTemplatesScriptsSubMenu(this._entries);
    }

    _createTemplatesScriptsSubMenu(scriptsList) {
        if ((scriptsList == null) || (scriptsList.length == 0)) {
            return null;
        }
        let scriptSubMenu = new Gtk.Menu();
        for (let fileItem of scriptsList) {
            let menuItemName = fileItem[0];
            if (this._flags & TemplatesScriptsManagerFlags.HIDE_EXTENSIONS) {
                menuItemName = DesktopIconsUtil.getFileExtensionOffset(menuItemName, false).basename;
            }
            let menuItemPath = fileItem[1];
            let subDirs = fileItem[2];
            if (subDirs === null) {
                let menuItem = new Gtk.MenuItem({label: menuItemName});
                menuItem.connect('activate', () => {
                    this._activatedCB(menuItemPath);
                });
                scriptSubMenu.add(menuItem);
            } else {
                let subMenu = this._createTemplatesScriptsSubMenu(subDirs);
                if (subMenu !== null) {
                    let menuItem = new Gtk.MenuItem({label: menuItemName});
                    menuItem.set_submenu(subMenu);
                    scriptSubMenu.add(menuItem);
                }
            }
        }
        scriptSubMenu.show_all();
        return scriptSubMenu;
    }
};
