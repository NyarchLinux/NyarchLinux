import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ArcMenuManager} from './arcmenuManager.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.File.prototype, 'query_info_async');

export const RecentFilesManager = class ArcMenuRecentFilesManager {
    constructor() {
        this._bookmarksFile = new GLib.BookmarkFile();
        this._recentFile = GLib.build_filenamev([GLib.get_user_data_dir(), 'recently-used.xbel']);
        this._queryCancellables = [];
    }

    getRecentFiles() {
        try {
            this._bookmarksFile.load_from_file(this._recentFile);
        } catch (e) {
            if (!e.matches(GLib.BookmarkFileError.FILE_NOT_FOUND)) {
                console.log(`Could not open recent files: ${e.message}`);
                return [];
            }
        }

        const recentFilesUris = this._bookmarksFile.get_uris();
        recentFilesUris.sort((a, b) => this._bookmarksFile.get_modified(b) - this._bookmarksFile.get_modified(a));
        return recentFilesUris;
    }

    removeItem(uri) {
        try {
            this._bookmarksFile.remove_item(uri);
            this._bookmarksFile.to_file(this._recentFile);
        } catch (e) {
            console.log(`Could not save recent file ${uri}: ${e.message}`);
        }
    }

    getMimeType(uri) {
        return this._bookmarksFile.get_mime_type(uri);
    }

    async queryInfoAsync(recentFileUri) {
        const file = Gio.File.new_for_uri(recentFileUri);
        const cancellable = new Gio.Cancellable();

        if (file === null)
            return {error: 'Recent file is null.'};

        this._queryCancellables.push(cancellable);

        try {
            const fileInfo = await file.query_info_async('standard::type,standard::is-hidden',
                0, 0, cancellable);

            this.removeCancellableFromList(cancellable);

            if (fileInfo) {
                const isHidden = fileInfo.get_attribute_boolean('standard::is-hidden');
                const showHidden = ArcMenuManager.settings.get_boolean('show-hidden-recent-files');

                if (isHidden && !showHidden)
                    return {error: `${file.get_basename()} is hidden.`};

                return {recentFile: file};
            }
            return {error: 'No File Info Found.'};
        } catch (err) {
            this.removeCancellableFromList(cancellable);

            return {error: err};
        }
    }

    removeCancellableFromList(cancellable) {
        const index = this._queryCancellables.indexOf(cancellable);
        if (index !== -1)
            this._queryCancellables.splice(index, 1);
    }

    cancelCurrentQueries() {
        if (this._queryCancellables.length === 0)
            return;

        for (let cancellable of this._queryCancellables) {
            cancellable.cancel();
            cancellable = null;
        }

        this._queryCancellables = null;
        this._queryCancellables = [];
    }

    destroy() {
        this.cancelCurrentQueries();
        this._bookmarksFile = null;
        this._recentFile = null;
    }
};
