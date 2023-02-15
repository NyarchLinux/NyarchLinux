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
        this._model = this._client.get_model();
    }

    enable() {
        this._connectSignal(this._model, 'row-changed', (arg0, arg1, iter) => {
            if (iter) {
                let device = this._buildDevice(iter);
                if (device.isDefault)
                    this.emit('default-adapter-changed', device);
                else
                    this.emit('device-changed', device);
            }

        });
        this._connectSignal(this._model, 'row-deleted', () => {
            this.emit('device-deleted');
        });
        this._connectSignal(this._model, 'row-inserted', (arg0, arg1, iter) => {
            if (iter) {
                let device = this._buildDevice(iter);
                this.emit('device-inserted', device);
            }
        });
    }

    getDevices() {
        let adapter = this._getDefaultAdapter();
        if (!adapter)
            return [];

        let devices = [];

        let [ret, iter] = this._model.iter_children(adapter);
        while (ret) {
            let device = this._buildDevice(iter);
            devices.push(device);
            ret = this._model.iter_next(iter);
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

    _getDefaultAdapter() {
        let [ret, iter] = this._model.get_iter_first();
        while (ret) {
            let isDefault = this._model.get_value(iter, GnomeBluetooth.Column.DEFAULT);
            let isPowered = this._model.get_value(iter, GnomeBluetooth.Column.POWERED);
            if (isDefault && isPowered)
                return iter;
            ret = this._model.iter_next(iter);
        }
        return null;
    }

    _buildDevice(iter) {
        return new BluetoothDevice(this._model, iter);
    }
}

Signals.addSignalMethods(BluetoothController.prototype);
Utils.addSignalsHelperMethods(BluetoothController.prototype);

var BluetoothDevice = class {
    constructor(model, iter) {
        this._model = model;
        this.update(iter);
    }

    update(iter) {
        this.name = this._model.get_value(iter, GnomeBluetooth.Column.ALIAS) || this._model.get_value(iter, GnomeBluetooth.Column.NAME);
        this.isConnected = this._model.get_value(iter, GnomeBluetooth.Column.CONNECTED);
        this.isPaired = this._model.get_value(iter, GnomeBluetooth.Column.PAIRED);
        this.mac = this._model.get_value(iter, GnomeBluetooth.Column.ADDRESS);
        this.isDefault = this._model.get_value(iter, GnomeBluetooth.Column.DEFAULT);
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
