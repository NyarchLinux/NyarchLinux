import Gio from 'gi://Gio';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import {MenuController} from './menuController.js';
import {SearchProviderEmitter} from './searchProviders/searchProviderEmitter.js';
import {CustomStylesheet} from './theming.js';

import * as Utils from './utils.js';
import {UpdateNotification} from './updateNotifier.js';

export const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

export default class ArcMenu extends Extension {
    enable() {
        this.settings = this.getSettings();

        this._resource = Gio.Resource.load(`${this.path}/data/resources.gresource`);
        Gio.resources_register(this._resource);

        this._arcmenuManager = new ArcMenuManager(this);
        this.searchProviderEmitter = new SearchProviderEmitter();
        this.menuControllers = [];
        this._azTaskbarActive = false;
        this._dtpActive = false;
        this._updateNotification = new UpdateNotification(this);
        this._customStylesheet = new CustomStylesheet(this.settings);

        const hideOverviewOnStartup = this.settings.get_boolean('hide-overview-on-startup');
        if (hideOverviewOnStartup && Main.layoutManager._startingUp) {
            const hadOverview = Main.sessionMode.hasOverview;
            Main.sessionMode.hasOverview = false;
            Main.layoutManager.connectObject('startup-complete', () => {
                Main.sessionMode.hasOverview = hadOverview;

                if (ShellVersion >= 50)
                    Main.overview.hide();
            }, this);
        }

        this._getPanelExtensionStates();

        this.settings.connectObject('changed::multi-monitor', () => this._reload(), this);
        this.settings.connectObject('changed::dash-to-panel-standalone', () => this._reload(), this);

        this._enableButtons();

        Main.extensionManager.connectObject('extension-state-changed', (data, extension) => {
            const isDtp = extension.uuid === Constants.DASH_TO_PANEL_UUID;
            const isAzTaskbar = extension.uuid === Constants.AZTASKBAR_UUID;
            const isActive = extension.state === Utils.ExtensionState.ACTIVE;

            if (isDtp && (isActive !== this._dtpActive)) {
                this._dtpActive = isActive;
                this._disconnectExtensionSignals();
                this._connectExtensionSignals();
                this._reload();
            }

            if (isAzTaskbar && (isActive !== this._azTaskbarActive)) {
                this._azTaskbarActive = isActive;
                this._disconnectExtensionSignals();
                this._connectExtensionSignals();
                this._reload();
            }
        }, this);

        this._connectExtensionSignals();

        global.connectObject('shutdown', () => this._customStylesheet.destroy(), this);
    }

    disable() {
        this._disconnectExtensionSignals();
        Main.layoutManager.disconnectObject(this);
        Main.extensionManager.disconnectObject(this);
        global.disconnectObject(this);
        this.settings.disconnectObject(this);

        this._updateNotification.destroy();
        this._updateNotification = null;

        this._customStylesheet.destroy();
        this._customStylesheet = null;

        this._disableButtons();
        this.menuControllers = null;

        this.searchProviderEmitter.destroy();
        this.searchProviderEmitter = null;

        this._arcmenuManager.destroy();
        this._arcmenuManager = null;

        Gio.resources_unregister(this._resource);
        this._resource = null;
        this.settings = null;
    }

    _getPanelExtensionStates() {
        this._azTaskbarActive = this._isExtensionActive(Constants.AZTASKBAR_UUID);
        this._dtpActive = this._isExtensionActive(Constants.DASH_TO_PANEL_UUID);
    }

    _isExtensionActive(uuid) {
        const extension = Main.extensionManager.lookup(uuid);
        if (extension?.state === Utils.ExtensionState.ACTIVE)
            return true;

        return false;
    }

    /**
     *
     * @param {*} panel Dash to Panel's 'panel'
     * @param {boolean} panelExtensionEnabled is Dash to Panel enabled
     * @returns {boolean}
     * @description Returns true if `panel` isPrimary and isStandalone\
     *              and ArcMenu setting 'dash-to-panel-standalone' is enabled.
     */
    _isPrimaryStandalonePanel(panel, panelExtensionEnabled) {
        const standalone = this.settings.get_boolean('dash-to-panel-standalone');
        if (!standalone)
            return false;

        const dtpEnabled = global.dashToPanel && panelExtensionEnabled;
        if (!dtpEnabled)
            return false;

        const isPrimaryStandalone = panel.isPrimary && panel.isStandalone;
        return isPrimaryStandalone;
    }

    _connectExtensionSignals() {
        if (this._dtpActive && global.dashToPanel)
            global.dashToPanel.connectObject('panels-created', () => this._reload(), this);

        if (this._azTaskbarActive && global.azTaskbar)
            global.azTaskbar.connectObject('panels-created', () => this._reload(), this);
    }

    _disconnectExtensionSignals() {
        if (global.dashToPanel)
            global.dashToPanel.disconnectObject(this);

        if (global.azTaskbar)
            global.azTaskbar.disconnectObject(this);
    }

    _reload() {
        this._disableButtons();
        this._enableButtons();
    }

    _enableButtons() {
        const multiMonitor = this.settings.get_boolean('multi-monitor');
        const panelExtensionEnabled = this._dtpActive || this._azTaskbarActive;

        // Finds available panels from Dash to Panel or App Icons Taskbar extension.
        // If none found, use Main.panel.

        const getExtensionPanels = () => {
            if (this._dtpActive)
                return global.dashToPanel?.panels;
            if (this._azTaskbarActive)
                return global.azTaskbar?.panels;
            return null;
        };
        const panels = getExtensionPanels()?.filter(p => p) ?? [Main.panel];

        // Register hotkeys, DBus methods, and certain settings changed events only once,
        // on the first panel processed in the loop (independent of primary monitor status).
        let isFirstPanel = true;

        const panelsCount = multiMonitor ? panels.length : Math.min(panels.length, 1);
        for (let i = 0; i < panelsCount; i++) {
            if (!panels[i]) {
                console.log(`ArcMenu Error: panel ${i} not found. Skipping...`);
                continue;
            }

            const isPrimaryStandalone = this._isPrimaryStandalonePanel(panels[i], panelExtensionEnabled);

            let panel, panelBox, panelParent;
            if (panelExtensionEnabled && !isPrimaryStandalone) {
                panel = panels[i].panel;
                panelBox = this._dtpActive ? panels[i].panelBox : panels[i];
                panelParent = panels[i];
            } else {
                panel = Main.panel;
                panelBox = Main.layoutManager.panelBox;
                panelParent = Main.panel;
            }

            // 'panelParent' may be 'Main.panel' doesn't have a 'monitor' property.
            const monitor = panelParent.monitor ?? Main.layoutManager.primaryMonitor;
            const panelInfo = {panel, panelBox, panelParent, isFirstPanel, isPrimaryStandalone, index: i};

            if (isFirstPanel)
                isFirstPanel = false;

            const menuController = new MenuController(monitor, panelInfo);

            panel.connectObject('destroy', () => this._disableButton(menuController, panel), this);

            menuController.enableButton();
            menuController.connectSettingsEvents();
            this.menuControllers.push(menuController);
        }
    }

    _disableButtons() {
        for (let i = this.menuControllers.length - 1; i >= 0; --i) {
            const mc = this.menuControllers[i];
            this._disableButton(mc, mc.panel);
        }
    }

    _disableButton(controller, panel) {
        panel.disconnectObject(this);

        const index = this.menuControllers.indexOf(controller);
        if (index !== -1)
            this.menuControllers.splice(index, 1);

        controller.destroy();
    }

    openPreferences() {
        // Find if an extension preferences window is already open
        const prefsWindow = global.get_window_actors().map(wa => wa.meta_window).find(w => w.wm_class === 'org.gnome.Shell.Extensions');

        if (!prefsWindow) {
            super.openPreferences();
            return;
        }

        // The current prefsWindow belongs to this extension, activate it
        if (prefsWindow.title === this.metadata.name) {
            Main.activateWindow(prefsWindow);
            return;
        }

        // If another extension's preferences are open, close it and open this extension's preferences
        prefsWindow.connectObject('unmanaged', () => {
            super.openPreferences();
            prefsWindow.disconnectObject(this);
        }, this);
        prefsWindow.delete(global.get_current_time());
    }
}
