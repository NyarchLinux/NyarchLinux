/* exported RecentFilesManager */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Gtk, Gio} = imports.gi;

Gio._promisify(Gio.File.prototype, 'query_info_async');

var RecentFilesManager = class ArcMenuRecentFilesManager {
    constructor() {
        this._recentManager = new Gtk.RecentManager();
        this._queryCancellables = [];
    }

    getRecentFiles() {
        const recentManagerItems = this._recentManager.get_items();
        recentManagerItems.sort((a, b) => b.get_modified() - a.get_modified());
        return recentManagerItems;
    }

    get recentManager() {
        return this._recentManager;
    }

    async queryInfoAsync(recentFile) {
        const file = Gio.File.new_for_uri(recentFile.get_uri());
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
                const showHidden = Me.settings.get_boolean('show-hidden-recent-files');

                if (isHidden && !showHidden)
                    return {error: `${recentFile.get_display_name()} is hidden.`};

                return {recentFile};
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
        this._recentManager = null;
    }
};
