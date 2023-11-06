import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {ExtensionState} from 'resource:///org/gnome/shell/misc/extensionUtils.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import {MenuSettingsController} from './controller.js';
import {SearchProviderEmitter} from './searchProviders/searchProviderEmitter.js';
import * as Theming from './theming.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js'

let customUpdateState = function() {
    this._notificationQueue = this._notificationQueue.filter((notification) => {
      if (notification.title.includes("Applied")) {
        reloadTheme();
      }
      return true;
    });
    this._updateStateOriginal();
}

export default class ArcMenu extends Extension {
    constructor(metaData) {
        super(metaData);
        this._realHasOverview = Main.sessionMode.hasOverview;
    }


    enable() {
        this._arcmenuManager = new ArcMenuManager(this);
        this.settings = this.getSettings();
        this.searchProviderEmitter = new SearchProviderEmitter();

        const hideOverviewOnStartup = this.settings.get_boolean('hide-overview-on-startup');
        if (hideOverviewOnStartup && Main.layoutManager._startingUp) {
            Main.sessionMode.hasOverview = false;
            Main.layoutManager.connectObject('startup-complete', () => {
                Main.sessionMode.hasOverview = this._realHasOverview;
            }, this);
            // handle Ubuntu's method
            if (Main.layoutManager.startInOverview)
                Main.layoutManager.startInOverview = false;
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
            const isEnabled = extension.state === ExtensionState.ENABLED;
            const isDisabled = extension.state === ExtensionState.DISABLED;

            if ((isDtp || isAzTaskbar) && (isEnabled || isDisabled)) {
                this._disconnectExtensionSignals();
                this._connectExtensionSignals();
                this._reload();
            }
        }, this);

    	// Override updatestate
    	MessageTray.MessageTray.prototype._updateStateOriginal =
    	MessageTray.MessageTray.prototype._updateState;
    	MessageTray.MessageTray.prototype._updateState = customUpdateState;
        // listen to dash to panel if they are compatible and already enabled
        this._connectExtensionSignals();
	Theming.updateStylesheet(this.settings);
}

    disable() {
        this.searchProviderEmitter.destroy();
        delete this.searchProviderEmitter;

        Main.sessionMode.hasOverview = this._realHasOverview;

        Theming.deleteStylesheet();

        this._disconnectExtensionSignals();

        this._disableButtons();
        this.settingsControllers = null;
    MessageTray.MessageTray.prototype._updateState =
    MessageTray.MessageTray.prototype._updateStateOriginal;
    delete MessageTray.MessageTray.prototype._updateStateOriginal;
    //settings.run_dispose();
    //settings = null;
    


        this._arcmenuManager.destroy();
        this._arcmenuManager = null;

        Main.layoutManager.disconnectObject(this);
        Main.extensionManager.disconnectObject(this);
        this.settings.disconnectObject(this);
        this.settings = null;
    }

    _connectExtensionSignals() {
        const dtp = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);
        if (dtp?.state === ExtensionState.ENABLED && global.dashToPanel)
            global.dashToPanel._panelsCreatedId = global.dashToPanel.connect('panels-created', () => this._reload());

        const azTaskbar = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);
        if (azTaskbar?.state === ExtensionState.ENABLED && global.azTaskbar)
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

        if (global.dashToPanel && global.dashToPanel.panels) {
            panels = global.dashToPanel.panels.map(pw => pw);
            panelExtensionEnabled = true;
        } else if (global.azTaskbar && global.azTaskbar.panels) {
            panels = global.azTaskbar.panels.map(pw => pw);
            panels.unshift(Main.panel);
            panelExtensionEnabled = true;
        } else {
            panels = [Main.panel];
        }

        const panelLength = multiMonitor ? panels.length : 1;
        for (var i = 0; i < panelLength; i++) {
            // Dash to Panel and AzTaskbar don't store the actual 'panel' in their global 'panels' object
            let panel = panels[i].panel ?? panels[i];
            const panelParent = panels[i].panel ? panels[i] : Main.panel;

            let panelBox;
            if (panels[i].panelBox) // case Dash To Panel
                panelBox = panels[i].panelBox;
            else if (panels[i].panel) // case AzTaskbar
                panelBox = panels[i];
            else
                panelBox = Main.layoutManager.panelBox;

            // Place ArcMenu in main top panel when
            // Dash to Panel setting "Keep original gnome-shell top panel" is on
            const isStandalone = this.settings.get_boolean('dash-to-panel-standalone') &&
                                 global.dashToPanel && panelExtensionEnabled;
            if (isStandalone && ('isPrimary' in panelParent && panelParent.isPrimary) && panelParent.isStandalone)
                panel = Main.panel;

            const panelInfo = {panel, panelBox, panelParent};
            const settingsController = new MenuSettingsController(panelInfo, i);

            settingsController.monitorIndex = panelParent.monitor?.index ?? 0;

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
