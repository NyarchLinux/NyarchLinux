
/* exported OpenWindowSearchProvider */
const {Gio, St, Shell} = imports.gi;

const Main = imports.ui.main;
const {getWindows} = imports.ui.altTab;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

/**
 * @param {Gio.App} app The app
 * @param {int} size App icon size
 */
function createIcon(app, size) {
    return app
        ? app.create_icon_texture(size)
        : new St.Icon({icon_name: 'icon-missing', icon_size: size});
}

var OpenWindowSearchProvider = class {
    constructor() {
        this.id = 'arcmenu.open-windows';
        this.isRemoteProvider = true;
        this.canLaunchSearch = false;

        this._appWindows = [];
        this._windowTracker = Shell.WindowTracker.get_default();

        this.appInfo = {
            get_description: () => _('List of open windows across all workspaces'),
            get_name: () => _('Open Windows'),
            get_id: () => 'arcmenu.open-windows',
            get_icon: () => Gio.icon_new_for_string('focus-windows-symbolic'),
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
