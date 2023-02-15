const ExtensionUtils = imports.misc.extensionUtils;
const UPower = imports.gi.UPowerGlib;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

var UPowerBatteryProvider = class {
    constructor(logger) {
        this._upower_client = UPower.Client.new();
        this._logger = logger;
    }

    locateBatteryDevice(device) {
        // upower has no field in the devices that indicate that a battery is
        // from a bluetooth device, so we must try and find by the provided mac.
        // Problem is, the native_path field has macs in all kinds of forms ...
        let _mac_addrs = [
            device.mac.toUpperCase(),
            device.mac.replace(/:/g, "_").toUpperCase(),
        ];

        let _battery_devices = this._upower_client.get_devices();
        let _bateries = _battery_devices.filter(bat => {
            let _native_path = bat.native_path.toUpperCase();
            return _mac_addrs.some(mac => _native_path.includes(mac));
        });

        if (_bateries.length > 1) {
            this._logger.warn(`device ${device.name} matched more than one UPower device by native_path`);
            _bateries = [];
        }

        let _battery_native_path = _bateries.map(bat => bat.native_path)[0] || "NOT-FOUND";
        this._logger.info(`battery: ${_battery_native_path}`);

        return _bateries;
    }
}
