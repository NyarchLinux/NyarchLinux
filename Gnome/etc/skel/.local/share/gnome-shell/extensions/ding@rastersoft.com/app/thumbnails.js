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
'use strict';
imports.gi.versions.GnomeDesktop = '3.0';
const GnomeDesktop = imports.gi.GnomeDesktop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

var ThumbnailLoader = class {
    constructor(codePath) {
        this._timeoutValue = 5000;
        this._codePath = codePath;
        this._thumbList = [];
        this._thumbnailScriptWatch = null;
        this._running = false;
        this._thumbnailFactoryNormal = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.NORMAL);
        this._thumbnailFactoryLarge = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);
        if (this._thumbnailFactoryLarge.generate_thumbnail_async) {
            this._useAsyncAPI = true;
            print('Detected async api for thumbnails');
        } else {
            this._useAsyncAPI = false;
            print('Failed to detected async api for thumbnails');
        }
    }

    _generateThumbnail(file, callback) {
        this._thumbList.push([file, callback]);
        if (!this._running) {
            this._launchNewBuild();
        }
    }

    _launchNewBuild() {
        let file, callback;
        do {
            if (this._thumbList.length == 0) {
                this._running = false;
                return;
            }
            // if the file disappeared while waiting in the queue, don't refresh the thumbnail
            [file, callback] = this._thumbList.shift();
            if (file.file.query_exists(null)) {
                if (this._thumbnailFactoryLarge.has_valid_failed_thumbnail(file.uri, file.modifiedTime)) {
                    if (callback) {
                        callback();
                    }
                    continue;
                } else {
                    break;
                }
            }
        } while (true);
        this._running = true;
        if (this._useAsyncAPI) {
            this._createThumbnailAsync(file, callback);
        } else {
            this._createThumbnailSubprocess(file, callback);
        }
    }

    _createThumbnailAsync(file, callback) {
        let fileInfo = file.file.query_info('standard::content-type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
        this._doCancel = new Gio.Cancellable();
        let modifiedTime = fileInfo.get_attribute_uint64('time::modified');
        this._thumbnailFactoryLarge.generate_thumbnail_async(file.uri, fileInfo.get_content_type(), this._doCancel, (obj, res) => {
            this._removeTimeout();
            try {
                let thumbnailPixbuf = obj.generate_thumbnail_finish(res);
                this._thumbnailFactoryLarge.save_thumbnail_async(thumbnailPixbuf, file.uri, modifiedTime, this._doCancel, (obj, res) => {
                    obj.save_thumbnail_finish(res);
                    if (callback) {
                        callback();
                    }
                    this._launchNewBuild();
                });
            } catch (e) {
                print(`Error while creating thumbnail: ${e.message}\n${e.stack}`);
                this._createFailedThumbnailAsync(file, modifiedTime, callback);
            }
        });
        this._timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeoutValue, () => {
            print(`Timeout while generating thumbnail for ${file.displayName}`);
            this._timeoutID = 0;
            this._doCancel.cancel();
            this._createFailedThumbnailAsync(file, modifiedTime, callback);
            return false;
        });
    }

    _createFailedThumbnailAsync(file, modifiedTime, callback) {
        this._doCancel = new Gio.Cancellable();
        this._thumbnailFactoryLarge.create_failed_thumbnail_async(file.uri, modifiedTime, this._doCancel, (obj, res) => {
            try {
                obj.create_failed_thumbnail_finish(res);
            } catch (e) {
                print(`Error while creating failed thumbnail: ${e.message}\n${e.stack}`);
            }
            if (callback) {
                callback();
            }
            this._launchNewBuild();
        });
    }

    _createThumbnailSubprocess(file, callback) {
        let args = [];
        args.push(GLib.build_filenamev([this._codePath, 'createThumbnail.js']));
        args.push(file.path);
        this._proc = new Gio.Subprocess({argv: args});
        this._proc.init(null);
        this._proc.wait_check_async(null, (source, result) => {
            this._removeTimeout();
            try {
                let result2 = source.wait_check_finish(result);
                if (result2) {
                    let status = source.get_status();
                    if (status == 0) {
                        if (callback) {
                            callback();
                        }
                    }
                } else {
                    print(`Failed to generate thumbnail for ${file.displayName}`);
                }
            } catch (error) {
                print(`Exception when generating thumbnail for ${file.displayName}: ${error}`);
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
        if (this._timeoutID != 0) {
            GLib.source_remove(this._timeoutID);
            this._timeoutID = 0;
        }
    }

    getThumbnail(file, callback) {
        try {
            let thumbnail = this._thumbnailFactoryLarge.lookup(file.uri, file.modifiedTime);
            if (thumbnail == null) {
                thumbnail = this._thumbnailFactoryNormal.lookup(file.uri, file.modifiedTime);
                if ((thumbnail == null) &&
                    !this._thumbnailFactoryLarge.has_valid_failed_thumbnail(file.uri, file.modifiedTime) &&
                     this._thumbnailFactoryLarge.can_thumbnail(file.uri, file.attributeContentType, file.modifiedTime)) {
                    this._generateThumbnail(file, callback);
                }
            }
            return thumbnail;
        } catch (error) {
            print(`Error when asking for a thumbnail for ${file.displayName}: ${error.message}\n${error.stack}`);
        }
        return null;
    }
};
