import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import {MenuSettingsController} from './controller.js';
import {SearchProviderEmitter} from './searchProviders/searchProviderEmitter.js';
import * as Theming from './theming.js';

import * as Utils from './utils.js';

export default class ArcMenu extends Extension {
    enable() {
        this._arcmenuManager = new ArcMenuManager(this);
        this.settings = this.getSettings();

        this._convertOldSettings(this.settings);
        this.searchProviderEmitter = new SearchProviderEmitter();

        const hideOverviewOnStartup = this.settings.get_boolean('hide-overview-on-startup');
        if (hideOverviewOnStartup && Main.layoutManager._startingUp) {
            const hadOverview = Main.sessionMode.hasOverview;
            Main.sessionMode.hasOverview = false;
            Main.layoutManager.connectObject('startup-complete', () => {
                Main.sessionMode.hasOverview = hadOverview;
            }, this);
        }

        this.settings.connectObject('changed::multi-monitor', () => this._reload(), this);
        this.settings.connectObject('changed::dash-to-panel-standalone', () => this._reload(), this);
        this.settingsControllers = [];

        Theming.createStylesheet();

        this._enableButtons();

        // dash to panel might get enabled after ArcMenu
        Main.extensionManager.connectObject('extension-state-changed', (data, extension) => {
            const isDtp = extension.uuid === Constants.DASH_TO_PANEL_UUID;
            const isAzTaskbar = extension.uuid === Constants.AZTASKBAR_UUID;
            const isEnabled = extension.state === Utils.ExtensionState.ACTIVE;
            const isDisabled = extension.state === Utils.ExtensionState.INACTIVE;

            if ((isDtp || isAzTaskbar) && (isEnabled || isDisabled)) {
                this._disconnectExtensionSignals();
                this._connectExtensionSignals();
                this._reload();
            }
        }, this);

        // listen to dash to panel if they are compatible and already enabled
        this._connectExtensionSignals();
    }

    disable() {
        this.searchProviderEmitter.destroy();
        delete this.searchProviderEmitter;

        Theming.deleteStylesheet();

        this._disconnectExtensionSignals();

        this._disableButtons();
        this.settingsControllers = null;

        this._arcmenuManager.destroy();
        this._arcmenuManager = null;

        Main.layoutManager.disconnectObject(this);
        Main.extensionManager.disconnectObject(this);
        this.settings.disconnectObject(this);
        this.settings = null;
    }

    // Following settings changed in v52.
    // Keep this for a few releases to convert old settings to new format
    _convertOldSettings(settings) {
        Utils.convertOldSetting(settings, 'pinned-app-list', 'pinned-apps');
        Utils.convertOldSetting(settings, 'directory-shortcuts-list', 'directory-shortcuts');
        Utils.convertOldSetting(settings, 'application-shortcuts-list', 'application-shortcuts');
        Utils.convertOldSetting(settings, 'az-extra-buttons', 'az-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'eleven-extra-buttons', 'eleven-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'insider-extra-buttons', 'insider-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'windows-extra-buttons', 'windows-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'unity-extra-buttons', 'unity-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'brisk-extra-shortcuts', 'brisk-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'mint-extra-buttons', 'mint-layout-extra-shortcuts');
        Utils.convertOldSetting(settings, 'context-menu-shortcuts', 'context-menu-items');
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
        if (isPrimaryStandalone)
            return true;

        return false;
    }

    _connectExtensionSignals() {
        const dtpActive = this._isExtensionActive(Constants.DASH_TO_PANEL_UUID);
        if (dtpActive && global.dashToPanel)
            global.dashToPanel._panelsCreatedId = global.dashToPanel.connect('panels-created', () => this._reload());

        const azTaskbarActive = this._isExtensionActive(Constants.AZTASKBAR_UUID);
        if (azTaskbarActive && global.azTaskbar)
            global.azTaskbar._panelsCreatedId = global.azTaskbar.connect('panels-created', () => this._reload());
    }

    _disconnectExtensionSignals() {
        if (global.dashToPanel?._panelsCreatedId) {
            global.dashToPanel.disconnect(global.dashToPanel._panelsCreatedId);
            delete global.dashToPanel._panelsCreatedId;
        }
        if (global.azTaskbar?._panelsCreatedId) {
            global.azTaskbar.disconnect(global.azTaskbar._panelsCreatedId);
            delete global.azTaskbar._panelsCreatedId;
        }
    }

    _reload() {
        this._disableButtons();
        this._enableButtons();
    }

    _enableButtons() {
        const multiMonitor = this.settings.get_boolean('multi-monitor');

        let panelExtensionEnabled = false;
        let panels;

        const azTaskbarActive = this._isExtensionActive(Constants.AZTASKBAR_UUID);
        const dtpActive = this._isExtensionActive(Constants.DASH_TO_PANEL_UUID);

        if (dtpActive && global.dashToPanel?.panels) {
            panels = global.dashToPanel.panels.filter(p => p);
            panelExtensionEnabled = true;
        } else if (azTaskbarActive && global.azTaskbar?.panels) {
            panels = global.azTaskbar.panels.filter(p => p);
            panelExtensionEnabled = true;
        } else {
            panels = [Main.panel];
        }

        const panelsCount = multiMonitor ? panels.length : Math.min(panels.length, 1);
        for (var i = 0; i < panelsCount; i++) {
            if (!panels[i]) {
                console.log(`ArcMenu Error: panel ${i} not found. Skipping...`);
                continue;
            }

            let panel, panelBox, panelParent;
            if (panelExtensionEnabled) {
                panel = panels[i].panel;
                panelBox = dtpActive ? panels[i].panelBox : panels[i];
                panelParent = panels[i];
            } else {
                panel = panels[i];
                panelBox = Main.layoutManager.panelBox;
                panelParent = Main.panel;
            }

            const isPrimaryStandalone = this._isPrimaryStandalonePanel(panelParent, panelExtensionEnabled);
            if (isPrimaryStandalone)
                panel = Main.panel;

            const primaryPanelIndex = Main.layoutManager.primaryMonitor?.index;

            let monitorIndex = 0;
            if (panelParent.monitor) // App Icons Taskbar 'panelParent' may be Main.panel, which doesnt have a 'monitor' property.
                monitorIndex = panelParent.monitor.index;
            else if (panel === Main.panel)
                monitorIndex = primaryPanelIndex ?? 0;

            const isPrimaryPanel = monitorIndex === primaryPanelIndex;
            const panelInfo = {panel, panelBox, panelParent, isPrimaryPanel};

            const settingsController = new MenuSettingsController(panelInfo, monitorIndex);

            if (panelExtensionEnabled)
                panel._amDestroyId = panel.connect('destroy', () => this._disableButton(settingsController));

            settingsController.enableButton();
            settingsController.connectSettingsEvents();
            this.settingsControllers.push(settingsController);
        }
    }

    _disableButtons() {
        for (let i = this.settingsControllers.length - 1; i >= 0; --i) {
            const sc = this.settingsControllers[i];
            this._disableButton(sc);
        }
    }

    _disableButton(controller) {
        if (controller.panel?._amDestroyId) {
            controller.panel.disconnect(controller.panel._amDestroyId);
            delete controller.panel._amDestroyId;
        }

        this.settingsControllers.splice(this.settingsControllers.indexOf(controller), 1);
        controller.destroy();
    }
}
