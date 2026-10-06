/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2021 Sergio Costas (rastersoft@gmail.com)
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
import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var ThumbnailLoader = class {
    constructor(desktopManager, codePath) {
        this._timeoutValue = 5000;
        this._codePath = codePath;
        this._thumbList = [];
        this._thumbnailScriptWatch = null;
        this._running = false;
        if (!GnomeDesktop) {
            desktopManager.dbusManager.doNotify(_('GnomeDesktop-4.0 GIR file not found'),
                _('GnomeDesktop-4.0.gir file is missing. Please, install the required package in your system.'));
        } else {
            this._thumbnailFactoryNormal = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.NORMAL);
            this._thumbnailFactoryLarge = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);
            if (this._thumbnailFactoryLarge.generate_thumbnail_async) {
                this._useAsyncAPI = true;
            } else {
                this._useAsyncAPI = false;
                print('Failed to detected async api for thumbnails');
            }
        }
    }

    _generateThumbnail(file, resolve) {
        this._thumbList.push([file, resolve]);
        if (!this._running)
            this._launchNewBuild();
    }

    _launchNewBuild() {
        let file, resolve;
        do {
            if (this._thumbList.length === 0) {
                this._running = false;
                return;
            }
            // if the file disappeared while waiting in the queue, don't refresh the thumbnail
            [file, resolve] = this._thumbList.shift();
            if (file._destroyed)
                continue;

            if (file.file.query_exists(null)) {
                if (this._thumbnailFactoryLarge.has_valid_failed_thumbnail(file.uri, file.modifiedTime)) {
                    this._resolveThumbnail(file, resolve);
                    continue;
                } else {
                    break;
                }
            }
        } while (true);
        this._running = true;
        if (this._useAsyncAPI)
            this._createThumbnailAsync(file, resolve);
        else
            this._createThumbnailSubprocess(file, resolve);
    }

    _createThumbnailAsync(file, resolve) {
        const fileInfo = file.file.query_info('standard::content-type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
        this._doCancel = new Gio.Cancellable();
        const modifiedTime = fileInfo.get_attribute_uint64('time::modified');
        this._thumbnailFactoryLarge.generate_thumbnail_async(file.uri, fileInfo.get_content_type(), this._doCancel, (obj, res) => {
            this._removeTimeout();
            try {
                const thumbnailPixbuf = obj.generate_thumbnail_finish(res);
                this._thumbnailFactoryLarge.save_thumbnail_async(thumbnailPixbuf, file.uri, modifiedTime, this._doCancel, (obj2, res2) => {
                    obj2.save_thumbnail_finish(res2);
                    this._resolveThumbnail(file, resolve);
                    this._launchNewBuild();
                });
            } catch (e) {
                print(`Error while creating thumbnail: ${e.message}\n${e.stack}`);
                this._createFailedThumbnailAsync(file, modifiedTime, resolve);
            }
        });
        this._timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeoutValue, () => {
            print(`Timeout while generating thumbnail for ${file.displayName}`);
            this._timeoutID = 0;
            this._doCancel.cancel();
            this._createFailedThumbnailAsync(file, modifiedTime, resolve);
            return false;
        });
    }

    _createFailedThumbnailAsync(file, modifiedTime, resolve) {
        this._doCancel = new Gio.Cancellable();
        this._thumbnailFactoryLarge.create_failed_thumbnail_async(file.uri, modifiedTime, this._doCancel, (obj, res) => {
            try {
                obj.create_failed_thumbnail_finish(res);
                this._resolveThumbnail(file, resolve);
            } catch (e) {
                print(`Error while creating failed thumbnail: ${e.message}\n${e.stack}`);
                resolve(null);
            }
            this._launchNewBuild();
        });
    }

    _createThumbnailSubprocess(file, resolve) {
        const args = [];
        args.push(GLib.build_filenamev([this._codePath, 'createThumbnail.js']));
        args.push(file.path);
        this._proc = new Gio.Subprocess({argv: args});
        this._proc.init(null);
        this._proc.wait_check_async(null, (source, result) => {
            this._removeTimeout();
            try {
                const result2 = source.wait_check_finish(result);
                if (result2) {
                    const status = source.get_status();
                    if (status === 0)
                        this._resolveThumbnail(file, resolve);
                } else {
                    print(`Failed to generate thumbnail for ${file.displayName}`);
                    resolve(null);
                }
            } catch (error) {
                print(`Exception when generating thumbnail for ${file.displayName}: ${error}`);
                resolve(null);
            }
            this._launchNewBuild();
        });
        this._timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeoutValue, () => {
            print(`Timeout while generating thumbnail for ${file.displayName}`);
            this._timeoutID = 0;
            this._proc.force_exit();
            this._thumbnailFactoryLarge.create_failed_thumbnail(file.uri, file.modifiedTime);
            return false;
        });
    }

    _removeTimeout() {
        if (this._timeoutID !== 0) {
            GLib.source_remove(this._timeoutID);
            this._timeoutID = 0;
        }
    }

    _resolveThumbnail(file, resolve) {
        let thumbnail = this._thumbnailFactoryLarge.lookup(file.uri, file.modifiedTime);
        if (thumbnail === null) {
            thumbnail = this._thumbnailFactoryNormal.lookup(file.uri, file.modifiedTime);
            if (thumbnail === null)
                return false;
        }
        resolve(thumbnail);
        return true;
    }

    getThumbnail(file) {
        return new Promise(resolve => {
            try {
                if (!this._resolveThumbnail(file, resolve)) {
                    if (!this._thumbnailFactoryLarge.has_valid_failed_thumbnail(file.uri, file.modifiedTime) &&
                        this._thumbnailFactoryLarge.can_thumbnail(file.uri, file.attributeContentType, file.modifiedTime))
                        this._generateThumbnail(file, resolve);
                    else
                        resolve(null);
                }
            } catch (error) {
                print(`Error when asking for a thumbnail for ${file.displayName}: ${error.message}\n${error.stack}`);
                resolve(null);
            }
        });
    }
};
