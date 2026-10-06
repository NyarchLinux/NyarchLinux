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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Enums from './enums.js';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as SignalManager from './signalManager.js';

export var TemplatesScriptsManagerFlags = {
    'NONE': 0,
    'ONLY_EXECUTABLE': 1,
    'HIDE_EXTENSIONS': 2,
};

export var TemplatesScriptsManager = class extends SignalManager.SignalManager {
    constructor(baseFolder, flags) {
        super();
        // Too many templates can result in resource exhaustion, crashing
        // the desktop. To avoid this, we limit the number of templates to 100.
        // It can happen if the Templates folder points to the wrong folder,
        // or if there is a loop due to a symlink to an already added folder.
        this._maxNumberOfSubfolders = 100;
        this._entries = [];
        this._entriesEnumerateCancellable = null;
        this._readingEntries = false;
        this._entriesDir = baseFolder;
        this._entriesFolderChanged = false;
        this._flags = flags;
        this._entriesDirSignals = new SignalManager.SignalManager();

        if (this._entriesDir === GLib.get_home_dir())
            this._entriesDir = null;

        if (this._entriesDir !== null) {
            this._monitorDir = baseFolder.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._monitorDir.set_rate_limit(1000);
            this.connectSignal(this._monitorDir, 'changed', () => {
                this._updateEntries().catch(e => {
                    print(`Exception while updating entries in monitor: ${e.message}\n${e.stack}`);
                });
            });
            this._updateEntries().catch(e => {
                print(`Exception while updating entries: ${e.message}\n${e.stack}`);
            });
        }
    }

    destroy() {
        this._entriesDirSignals.disconnectAllSignals();
        this.disconnectAllSignals();
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

        this._processedEntries = 0;
        do {
            this._entriesDirSignals.disconnectAllSignals();
            this._entriesFolderChanged = false;
            if (!this._entriesDir.query_exists(null)) {
                entriesList = null;
                break;
            }
            // eslint-disable-next-line
            entriesList = await this._processDirectory(this._entriesDir);
        } while ((entriesList === null) || this._entriesFolderChanged);

        this._entries = entriesList;
        this._readingEntries = false;
    }

    async _processDirectory(directory) {
        this._processedEntries++;
        if (this._processedEntries >= this._maxNumberOfSubfolders)
            return [];

        if (directory !== this._entriesDir) {
            const monitorDir = directory.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            monitorDir.set_rate_limit(1000);
            this._entriesDirSignals.connectSignal(monitorDir, 'changed', () => {
                this._updateEntries();
            });
        }

        let files = null;
        try {
            files = await this._readDirectory(directory);
        } catch {
            return null;
        }

        if (files === null)
            return null;

        const output = [];
        for (const file of files) {
            if (file[2] === null) {
                output.push(file);
                continue;
            }
            // eslint-disable-next-line
            file[2] = await this._processDirectory(file[1]);
            if (file[2] === null)
                return null;

            if (file[2].length !== 0)
                output.push(file);
        }
        return output;
    }

    _readDirectory(directory) {
        return new Promise((resolve, reject) => {
            if (this._entriesEnumerateCancellable)
                this._entriesEnumerateCancellable.cancel();

            this._entriesEnumerateCancellable = new Gio.Cancellable();
            directory.enumerate_children_async(
                Enums.DEFAULT_ATTRIBUTES,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                this._entriesEnumerateCancellable,
                (source, result) => {
                    this._entriesEnumerateCancellable = null;
                    const fileList = [];
                    try {
                        const fileEnum = source.enumerate_children_finish(result);
                        if (this._entriesFolderChanged) {
                            resolve(null);
                            return;
                        }
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            const isDir = info.get_file_type() === Gio.FileType.DIRECTORY;
                            if ((this._flags & TemplatesScriptsManagerFlags.ONLY_EXECUTABLE) &&
                                !isDir &&
                                !info.get_attribute_boolean('access::can-execute'))
                                continue;

                            const child = fileEnum.get_child(info);
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
        if ((scriptsList === null) || (scriptsList.length === 0))
            return null;

        const scriptSubMenu = new Gio.Menu();
        for (const fileItem of scriptsList) {
            let menuItemName = fileItem[0];
            if (this._flags & TemplatesScriptsManagerFlags.HIDE_EXTENSIONS)
                menuItemName = DesktopIconsUtil.getFileExtensionOffset(menuItemName, false).basename;

            const menuItemPath = fileItem[1];
            const subDirs = fileItem[2];
            if (subDirs === null) {
                const menuItem = Gio.MenuItem.new(menuItemName, null);
                menuItem.set_action_and_target_value('app.create-template', GLib.Variant.new_string(menuItemPath));
                scriptSubMenu.append_item(menuItem);
            } else {
                const subMenu = this._createTemplatesScriptsSubMenu(subDirs);
                if (subMenu !== null)
                    scriptSubMenu.append_submenu(menuItemName, subMenu);
            }
        }
        return scriptSubMenu;
    }
};
