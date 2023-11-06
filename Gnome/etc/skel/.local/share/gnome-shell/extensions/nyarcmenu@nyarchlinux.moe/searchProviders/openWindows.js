
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * @param {Gio.App} app The app
 * @param {int} size App icon size
 */
function createIcon(app, size) {
    return app
        ? app.create_icon_texture(size)
        : new St.Icon({icon_name: 'icon-missing', icon_size: size});
}

export const OpenWindowSearchProvider = class {
    constructor() {
        this.id = 'arcmenu.open-windows';
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;

        this._appWindows = [];
        this._windowTracker = Shell.WindowTracker.get_default();

        this.appInfo = {
            get_description: () => _('List of open windows across all workspaces'),
            get_name: () => _('Open Windows'),
            get_id: () => 'arcmenu.open-windows',
            get_icon: () => Gio.icon_new_for_string('focus-windows-symbolic'),
            should_show: () => true,
        };
    }

    getResultMetas(winIds) {
        const metas = winIds.map(winId => {
            const aw = this._getAppWindow(winId);
            return aw ? {
                id: winId,
                name: aw.window.title ?? aw.app.get_name(),
                description: aw.window.get_workspace()
                    ? _("'%s' on Workspace %d").format(aw.app.get_name(), aw.window.get_workspace().index() + 1)
                    : aw.app.get_name(),
                createIcon: size => createIcon(aw.app, size),
            } : undefined;
        }).filter(m => m?.name !== undefined && m?.name !== null);

        return new Promise(resolve => resolve(metas));
    }

    filterResults(results, maxNumber) {
        return results.slice(0, maxNumber);
    }

    getInitialResultSet(terms, _cancellable) {
        this._appWindows = getWindows(null).map(window => {
            return {
                window,
                app: this._windowTracker.get_window_app(window),
            };
        });

        return new Promise(resolve => {
            const results = this._getFilteredWindowIds(terms, this._appWindows);
            resolve(results);
        });
    }

    getSubsearchResultSet(previousResults, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    activateResult(winId, _terms) {
        const window = this._getAppWindow(winId)?.window;
        if (window)
            Main.activateWindow(window);
    }

    launchSearch() {

    }

    _getFilteredWindowIds(terms, appWindows) {
        terms = terms.map(term => term.toLowerCase());
        appWindows = appWindows.filter(aw => {
            const title = aw.window.title?.toLowerCase();
            const appName = aw.app.get_name()?.toLowerCase();
            const appDescription = aw.app.get_description()?.toLowerCase();
            return terms.some(term => title?.includes(term) || appName?.includes(term) ||
                appDescription?.includes(term));
        });

        return appWindows.map(aw => aw.window.get_id().toString());
    }

    _getAppWindow(winId) {
        winId = typeof winId === 'string' ? parseInt(winId) : winId;
        return this._appWindows.find(aw => aw.window.get_id() === winId);
    }
};

/**
 * @param {Meta.Workspace} workspace
 * @returns {Meta.Window}
 */
function getWindows(workspace) {
    // We ignore skip-taskbar windows in switchers, but if they are attached
    // to their parent, their position in the MRU list may be more appropriate
    // than the parent; so start with the complete list ...
    const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
    // ... map windows to their parent where appropriate ...
    return windows.map(w => {
        return w.is_attached_dialog() ? w.get_transient_for() : w;
    // ... and filter out skip-taskbar windows and duplicates
    }).filter((w, i, a) => !w.skip_taskbar && a.indexOf(w) === i);
}
