/* eslint-disable no-unused-vars */
/* eslint-disable jsdoc/require-jsdoc */
/*
 * ArcMenu - Application Menu Extension for GNOME
 * Andrew Zaech https://gitlab.com/AndrewZaech
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, Gio, St} = imports.gi;
const Constants = Me.imports.constants;
const Controller = Me.imports.controller;

const Main = imports.ui.main;
const Theming = Me.imports.theming;
const Util = imports.misc.util;
const Utils = Me.imports.utils;
const MessageTray = imports.ui.messageTray;

let extensionChangedId, settingsControllers, _realHasOverview;

function init() {
    _realHasOverview = Main.sessionMode.hasOverview;
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

async function reloadTheme() {
    try {
        await new Promise(r => setTimeout(r, 400));
    } catch (e) {
        log(e);
    }
    Theming.updateStylesheet(Me.settings);
}
let customUpdateState = function() {
    this._notificationQueue = this._notificationQueue.filter((notification) => {
      if (notification.title.includes("Applied")) {
        reloadTheme();
      }
      return true;
    });
    this._updateStateOriginal();
}

function enable() {
    Me.settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);

    const hideOverviewOnStartup = Me.settings.get_boolean('hide-overview-on-startup');
    if (hideOverviewOnStartup && Main.layoutManager._startingUp) {
        Main.sessionMode.hasOverview = false;
        Main.layoutManager.connect('startup-complete', () => {
            Main.sessionMode.hasOverview = _realHasOverview;
        });
        // handle Ubuntu's method
        if (Main.layoutManager.startInOverview)
            Main.layoutManager.startInOverview = false;
    }

    Me.settings.connect('changed::multi-monitor', () => _reload());
    Me.settings.connect('changed::dash-to-panel-standalone', () => _reload());
    settingsControllers = [];

    Theming.createStylesheet(Me.settings);

    _enableButtons();

    // dash to panel might get enabled after ArcMenu
    extensionChangedId = Main.extensionManager.connect('extension-state-changed', (data, extension) => {
        if (extension.uuid === Constants.DASH_TO_PANEL_UUID || extension.uuid === Constants.AZTASKBAR_UUID || extension.uuid == Constants.BLUR_MY_SHELL_UUID || extension.uuid == Constants.MATERIAL_YOU_UUID) {
            _disconnectExtensionSignals();
            _connectExtensionSignals();
            reloadTheme();
            _reload();
        }
    });

    // listen to dash to panel if they are compatible and already enabled
    _connectExtensionSignals();

    // Override updatestate
    MessageTray.MessageTray.prototype._updateStateOriginal =
    MessageTray.MessageTray.prototype._updateState;
    MessageTray.MessageTray.prototype._updateState = customUpdateState;
}

function disable() {
    Main.sessionMode.hasOverview = _realHasOverview;

    if (extensionChangedId) {
        Main.extensionManager.disconnect(extensionChangedId);
        extensionChangedId = null;
    }

    Theming.deleteStylesheet();
    delete Me.customStylesheet;

    _disconnectExtensionSignals();

    _disableButtons();
    settingsControllers = null;
    MessageTray.MessageTray.prototype._updateState =
    MessageTray.MessageTray.prototype._updateStateOriginal;
    delete MessageTray.MessageTray.prototype._updateStateOriginal;
    //settings.run_dispose();
    //settings = null;
    
}


function _connectExtensionSignals() {
    if(global.dashToPanel)
        global.dashToPanel._panelsCreatedId = global.dashToPanel.connect('panels-created', () => _reload());

    if(global.azTaskbar)
        global.azTaskbar._panelsCreatedId = global.azTaskbar.connect('panels-created', () => _reload());
}

function _disconnectExtensionSignals() {
    if(global.dashToPanel?._panelsCreatedId){
        global.dashToPanel.disconnect(global.dashToPanel._panelsCreatedId);
        delete global.dashToPanel._panelsCreatedId;
    }
    if(global.azTaskbar?._panelsCreatedId){
        global.azTaskbar.disconnect(global.azTaskbar._panelsCreatedId);
        delete global.azTaskbar._panelsCreatedId;
    }
}

function _reload() {
    _disableButtons();
    _enableButtons();
}

function _enableButtons() {
    const multiMonitor = Me.settings.get_boolean('multi-monitor');

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
        const isStandalone = Me.settings.get_boolean('dash-to-panel-standalone') &&
                             global.dashToPanel && panelExtensionEnabled;
        if (isStandalone && ('isPrimary' in panelParent && panelParent.isPrimary) && panelParent.isStandalone)
            panel = Main.panel;

        const isPrimaryPanel = i === 0;
        const settingsController = new Controller.MenuSettingsController(settingsControllers,
            panel, panelBox, panelParent, isPrimaryPanel);

        settingsController.monitorIndex = panelParent.monitor?.index ?? 0;

        if (panelExtensionEnabled)
            panel._amDestroyId = panel.connect('destroy', () => _disableButton(settingsController));

        settingsController.enableButton();
        settingsController.connectSettingsEvents();
        settingsControllers.push(settingsController);
    }
}

function _disableButtons() {
    for (let i = settingsControllers.length - 1; i >= 0; --i) {
        const sc = settingsControllers[i];
        _disableButton(sc);
    }
}

function _disableButton(controller) {
    if (controller.panel?._amDestroyId) {
        controller.panel.disconnect(controller.panel._amDestroyId);
        delete controller.panel._amDestroyId;
    }

    settingsControllers.splice(settingsControllers.indexOf(controller), 1);
    controller.destroy();
}
