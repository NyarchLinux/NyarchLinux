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
const Config = imports.misc.config;
const ShellVersion = parseFloat(Config.PACKAGE_VERSION);

const Main = imports.ui.main;
const Theming = Me.imports.theming;
const Util = imports.misc.util;
const Utils = Me.imports.utils;
const MessageTray = imports.ui.messageTray;

let settings;
let settingsControllers;
let extensionChangedId;


async function reloadTheme() {
    await new Promise(r => setTimeout(r, 500));
    Theming.updateStylesheet(settings);
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

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
    settings.connect('changed::multi-monitor', () => _reload());
    settings.connect('changed::dash-to-panel-standalone', () => _reload());
    settingsControllers = [];

    Theming.createStylesheet(settings);

    _enableButtons();

    // dash to panel might get enabled after ArcMenu
    extensionChangedId = Main.extensionManager.connect('extension-state-changed', (data, extension) => {
        if (extension.uuid === Constants.DASH_TO_PANEL_UUID || extension.uuid === Constants.AZTASKBAR_UUID || extension.uuid == Constants.BLUR_MY_SHELL_UUID || extension.uuid == Constants.MATERIAL_YOU_UUID) {
            _disconnectExtensionSignals();
            _connectExtensionSignals();
            Theming.updateStylesheet(settings);
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
    if(extensionChangedId){
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
    settings.run_dispose();
    settings = null;
    
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
    let multiMonitor = settings.get_boolean('multi-monitor');

    let panelExtensionEnabled = false;
    let panelArray = [Main.panel];

    if(global.dashToPanel && global.dashToPanel.panels){
        panelArray = global.dashToPanel.panels.map(pw => pw);
        panelExtensionEnabled = true;
    }
    if(global.azTaskbar && global.azTaskbar.panels){
        panelArray = panelArray.concat(global.azTaskbar.panels.map(pw => pw));
        panelExtensionEnabled = true;
    }

    let panelLength = multiMonitor ? panelArray.length : 1;
    for(var index = 0; index < panelLength; index++){
        let panel = panelArray[index].panel ?? panelArray[index];
        let panelParent = panelArray[index];

        //Place ArcMenu in top panel when Dash to Panel setting "Keep original gnome-shell top panel" is on
        let isStandalone = settings.get_boolean('dash-to-panel-standalone') && global.dashToPanel && panelExtensionEnabled;
        if(isStandalone && ('isPrimary' in panelParent && panelParent.isPrimary) && panelParent.isStandalone)
            panel = Main.panel;
    
        let isPrimaryPanel = index === 0 ? true : false;
        let settingsController = new Controller.MenuSettingsController(settings, settingsControllers, panel, isPrimaryPanel);

        settingsController.monitorIndex = panelParent.monitor?.index ?? 0;

        if(panelExtensionEnabled)
            panel._amDestroyId = panel.connect('destroy', () => extensionChangedId ? _disableButton(settingsController) : null);

        settingsController.enableButton();
        settingsController.connectSettingsEvents();
        settingsControllers.push(settingsController);
    }
}

function _disableButtons(){
    for (let i = settingsControllers.length - 1; i >= 0; --i) {
        let sc = settingsControllers[i];
        _disableButton(sc);
    }
}

function _disableButton(controller) {
    if(controller.panel?._amDestroyId){
        controller.panel.disconnect(controller.panel._amDestroyId);
        delete controller.panel._amDestroyId;
    }

    settingsControllers.splice(settingsControllers.indexOf(controller), 1);
    controller.destroy();
}
