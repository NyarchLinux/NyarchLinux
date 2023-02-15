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

const GnomeBluetooth = imports.gi.GnomeBluetooth;
const Signals = imports.signals;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

var BluetoothController = class {
    constructor() {
        this._client = new GnomeBluetooth.Client();
        this._deviceNotifyConnected = new Set();
        this._store = this._client.get_devices();
    }

    enable() {
        this._client.connect('notify::default-adapter', () => {
            this._deviceNotifyConnected.clear();
            this.emit('default-adapter-changed');
        });
        this._client.connect('notify::default-adapter-powered', () => {
            this._deviceNotifyConnected.clear();
            this.emit('default-adapter-changed');
        });
        this._client.connect('device-removed', (c, path) => {
            this._deviceNotifyConnected.delete(path);
            this.emit('device-deleted');
        });
        this._client.connect('device-added', (c, device) => {
            this._connectDeviceNotify(device);
            this.emit('device-inserted', new BluetoothDevice(device));
        });
    }

    _connectDeviceNotify(device) {
        const path = device.get_object_path();

        if (this._deviceNotifyConnected.has(path))
            return;

        device.connect('notify', (device) => {
            this.emit('device-changed', new BluetoothDevice(device));
        });
    }

    getDevices() {
        let devices = [];

        for (let i = 0; i < this._store.get_n_items(); i++) {
            let device = new BluetoothDevice(this._store.get_item(i));
            devices.push(device);
        }

        return devices;
    }

    getConnectedDevices() {
        return this.getDevices().filter((device) => {
            return device.isConnected;
        });
    }

    destroy() {
        this._disconnectSignals();
    }
}

Signals.addSignalMethods(BluetoothController.prototype);
Utils.addSignalsHelperMethods(BluetoothController.prototype);

var BluetoothDevice = class {
    constructor(dev) {
        this.update(dev);
    }

    update(dev) {
        this.name = dev.alias || dev.name;
        this.isConnected = dev.connected;
        this.isPaired = dev.paired;
        this.mac = dev.address;
    }

    disconnect() {
        Utils.spawn(`bluetoothctl -- disconnect ${this.mac}`)
    }

    connect() {
        Utils.spawn(`bluetoothctl -- connect ${this.mac}`)
    }

    reconnect() {
        Utils.spawn(`bluetoothctl -- disconnect ${this.mac} && sleep 7 && bluetoothctl -- connect ${this.mac}`)
    }
}
