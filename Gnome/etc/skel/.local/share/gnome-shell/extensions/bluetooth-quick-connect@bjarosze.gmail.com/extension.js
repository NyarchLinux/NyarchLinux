// Copyright 2018 Bartosz Jaroszewski
// SPDX-License-Identifier: GPL-2.0-or-later
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const UiExtension = Me.imports.ui;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Bluetooth = imports.gi.GnomeBluetooth.Client.prototype.get_devices === undefined ?
    Me.imports.bluetooth_legacy :
    Me.imports.bluetooth;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const BatteryProvider = Me.imports.power.UPowerBatteryProvider;


class BluetoothQuickConnect {
    constructor(quickSettings, bluetooth, settings) {
        this._logger = new Utils.Logger(settings);
        this._logger.info('Initializing extension');
        if (quickSettings) {
            let btIndicator = quickSettings._bluetooth;
            let oldItem = btIndicator.quickSettingsItems[0];
            let newItem = new Me.imports.quickSettings.BluetoothToggleMenu(oldItem);

            btIndicator.quickSettingsItems = [newItem];
            quickSettings.menu.addItem(newItem);
            quickSettings.menu._grid.set_child_below_sibling(newItem, oldItem);
            quickSettings.menu._grid.remove_child(oldItem);
            this._proxy = oldItem._client._proxy;
            this._menu = newItem.itemsSection;
        } else {
            this._menu = bluetooth._item.menu;
            this._proxy = bluetooth._proxy;
        }
        this._controller = new Bluetooth.BluetoothController();
        this._settings = settings;
        this._battery_provider = new BatteryProvider(this._logger);

        this._items = {};
    }

    enable() {
        this._logger.info('Enabling extension');
        this._controller.enable();
        this._refresh();
        this._connectControllerSignals();
        this._connectIdleMonitor();
        this._connectMenuSignals();
    }

    _connectMenuSignals() {
        this._connectSignal(this._menu, 'open-state-changed', (menu, isOpen) => {
            this._logger.info(`Menu toggled: ${isOpen}`);
            if (isOpen)
                this._disconnectIdleMonitor();
            else
                this._connectIdleMonitor();

            if (isOpen && this._settings.isAutoPowerOnEnabled() && this._proxy.BluetoothAirplaneMode) {
                this._logger.info('Disabling airplane mode');
                this._proxy.BluetoothAirplaneMode = false;
            }
        });
    }

    disable() {
        this._logger.info('Disabling extension');
        this._destroy();
    }

    test() {
        try {
            this._logger.info('Testing bluetoothctl');
            GLib.spawn_command_line_sync("bluetoothctl --version");
            this._logger.info('Test succeeded');
        } catch (error) {
            Main.notifyError(_("Bluetooth Quick Connect"), _("Error trying to execute \"bluetoothctl\""));
            this._logger.info('Test failed');
        }
    }

    _connectControllerSignals() {
        this._logger.info('Connecting bluetooth controller signals');

        this._connectSignal(this._controller, 'default-adapter-changed', (ctrl) => {
            this._logger.info('Default adapter changed event');
            this._refresh();
        });

        this._connectSignal(this._controller, 'device-inserted', (ctrl, device) => {
            this._logger.info(`Device inserted event: ${device.name}`);
            if (device.isPaired) {
                this._addMenuItem(device);
            } else {
                this._logger.info(`Device ${device.name} not paired, ignoring`);
            }
        });

        this._connectSignal(this._controller, 'device-changed', (ctrl, device) => {
            this._logger.info(`Device changed event: ${device.name}`);
            if (device.isPaired)
                this._syncMenuItem(device);
            else
                this._logger.info(`Skipping change event for unpaired device ${device.name}`);
        });

        this._connectSignal(this._controller, 'device-deleted', () => {
            this._logger.info(`Device deleted event`);
            this._refresh();
        });

        this._connectSignal(Main.sessionMode, 'updated', () => {
            this._refresh();
        });
    }

    _syncMenuItem(device) {
        this._logger.info(`Synchronizing device menu item: ${device.name}`);
        let item = this._items[device.mac] || this._addMenuItem(device);

        item.sync(device);
    }

    _addMenuItem(device) {
        this._logger.info(`Adding device menu item: ${device.name} ${device.mac}`);

        let menuItem = new UiExtension.PopupBluetoothDeviceMenuItem(
            device,
            this._battery_provider,
            this._logger,
            {
                showRefreshButton: this._settings.isShowRefreshButtonEnabled(),
                closeMenuOnAction: !this._settings.isKeepMenuOnToggleEnabled(),
                showBatteryValue: this._settings.isShowBatteryValueEnabled(),
                showBatteryIcon: this._settings.isShowBatteryIconEnabled()
            }
        );

        this._items[device.mac] = menuItem;
        this._menu.addMenuItem(menuItem);

        return menuItem;
    }

    _connectIdleMonitor() {
        if (this._idleMonitorId) return;

        this._logger.info('Connecting idle monitor');

        this._idleMonitorId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._settings.autoPowerOffCheckingInterval() * 1000, () => {
            if (this._settings.isAutoPowerOffEnabled() && this._controller.getConnectedDevices().length === 0)
                this._proxy.BluetoothAirplaneMode = true;

            return true;
        });
    }

    _disconnectIdleMonitor() {
        if (!this._idleMonitorId) return;

        this._logger.info('Disconnecting idle monitor');

        GLib.Source.remove(this._idleMonitorId);
        this._idleMonitorId = null;
    }

    _connectSignal(subject, signal_name, method) {
        let signal_id = subject.connect(signal_name, method);
        this._signals.push({
            subject: subject,
            signal_id: signal_id
        });
    }

    _refresh() {
        this._removeDevicesFromMenu();
        this._addDevicesToMenu();

        this._logger.info('Refreshing devices list');
    }

    _addDevicesToMenu() {
        this._controller.getDevices().sort((a, b) => {
            return a.name.localeCompare(b.name);
        }).forEach((device) => {
            if (device.isPaired) {
                let item = this._addMenuItem(device);
            } else {
                this._logger.info(`skipping adding device ${device.name}`);
            }
        });
    }

    _removeDevicesFromMenu() {
        Object.values(this._items).forEach((item) => {
            item.disconnectSignals();
            item.destroy();
        });

        this._items = {};
    }

    _destroy() {
        this._disconnectSignals();
        this._removeDevicesFromMenu();
        this._disconnectIdleMonitor();
        if (this._controller)
            this._controller.destroy();
    }
}

Utils.addSignalsHelperMethods(BluetoothQuickConnect.prototype);

let bluetoothQuickConnect = null;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    if (Main.panel.statusArea.quickSettings) {
        bluetoothQuickConnect = new BluetoothQuickConnect(
            Main.panel.statusArea.quickSettings,
            null,
            new Settings()
        );
    } else {
        bluetoothQuickConnect = new BluetoothQuickConnect(
            null,
            Main.panel.statusArea.aggregateMenu._bluetooth,
            new Settings()
        );
    }

    bluetoothQuickConnect.test();
    bluetoothQuickConnect.enable();
}

function disable() {
    bluetoothQuickConnect.disable();
    bluetoothQuickConnect = null;
}
