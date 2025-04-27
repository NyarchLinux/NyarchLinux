/*
 * Credits: this file is a copy of GNOME's 'placeDisplay.js' file from the 'Places Status Indicator' extension.
 * https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/blob/main/extensions/places-menu/placeDisplay.js
 */

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ShellMountOperation from 'resource:///org/gnome/shell/ui/shellMountOperation.js';

Gio._promisify(Gio.AppInfo, 'launch_default_for_uri_async');
Gio._promisify(Gio.File.prototype, 'mount_enclosing_volume');

const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';

const Hostname1Iface = '<node> \
<interface name="org.freedesktop.hostname1"> \
<property name="PrettyHostname" type="s" access="read" /> \
</interface> \
</node>';
const Hostname1 = Gio.DBusProxy.makeProxyWrapper(Hostname1Iface);

export class PlaceInfo extends EventEmitter {
    constructor(...params) {
        super();

        this._init(...params);
    }

    _init(kind, file, name, icon) {
        this.kind = kind;
        this.file = file;
        this.name = name || this._getFileName();
        this.icon = icon ? new Gio.ThemedIcon({name: icon}) : this.getIcon();
    }

    destroy() {
        this.file = null;
        this.icon = null;
    }

    isRemovable() {
        return false;
    }

    async _ensureMountAndLaunch(context, tryMount) {
        try {
            await Gio.AppInfo.launch_default_for_uri_async(this.file.get_uri(), context, null);
        } catch (err) {
            if (!err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_MOUNTED)) {
                Main.notifyError(_('Failed to launch “%s”').format(this.name), err.message);
                return;
            }

            const source = {
                get_icon: () => this.icon,
            };
            const op = new ShellMountOperation.ShellMountOperation(source);
            try {
                await this.file.mount_enclosing_volume(0, op.mountOp, null);

                if (tryMount)
                    this._ensureMountAndLaunch(context, false);
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED_HANDLED))
                    Main.notifyError(_('Failed to mount volume for “%s”').format(this.name), e.message);
            } finally {
                op.close();
            }
        }
    }

    launch(timestamp) {
        const launchContext = global.create_app_launch_context(timestamp, -1);
        this._ensureMountAndLaunch(launchContext, true);
    }

    getIcon() {
        this.file.query_info_async('standard::symbolic-icon',
            Gio.FileQueryInfoFlags.NONE,
            0,
            null,
            (file, result) => {
                try {
                    const info = file.query_info_finish(result);
                    this.icon = info.get_symbolic_icon();
                    this.emit('changed');
                } catch (e) {
                    if (e instanceof Gio.IOErrorEnum)
                        return;
                    throw e;
                }
            });

        // return a generic icon for this kind for now, until we have the
        // icon from the query info above
        switch (this.kind) {
        case 'network':
            return new Gio.ThemedIcon({name: 'folder-remote-symbolic'});
        case 'devices':
            return new Gio.ThemedIcon({name: 'drive-harddisk-symbolic'});
        case 'special':
        case 'bookmarks':
        default:
            if (!this.file.is_native())
                return new Gio.ThemedIcon({name: 'folder-remote-symbolic'});
            else
                return new Gio.ThemedIcon({name: 'folder-symbolic'});
        }
    }

    _getFileName() {
        if (this.file.get_path() === GLib.get_home_dir())
            return _('Home');
        try {
            const info = this.file.query_info('standard::display-name', 0, null);
            return info.get_display_name();
        } catch (e) {
            if (e instanceof Gio.IOErrorEnum)
                return this.file.get_basename();
            throw e;
        }
    }
}

export class RootInfo extends PlaceInfo {
    _init() {
        super._init('devices', Gio.File.new_for_path('/'), _('Computer'));

        const busName = 'org.freedesktop.hostname1';
        const objPath = '/org/freedesktop/hostname1';
        new Hostname1(Gio.DBus.system, busName, objPath, (obj, error) => {
            if (error)
                return;

            this._proxy = obj;
            this._proxy.connectObject('g-properties-changed',
                this._propertiesChanged.bind(this), this);
            this._propertiesChanged(obj);
        });
    }

    getIcon() {
        return new Gio.ThemedIcon({name: 'drive-harddisk-symbolic'});
    }

    _propertiesChanged(proxy) {
        // GDBusProxy will emit a g-properties-changed when hostname1 goes down
        // ignore it
        if (proxy.g_name_owner) {
            this.name = proxy.PrettyHostname || _('Computer');
            this.emit('changed');
        }
    }

    destroy() {
        this._proxy?.disconnectObject(this);
        this._proxy = null;
        super.destroy();
    }
}

var PlaceDeviceInfo = class ArcMenuPlaceDeviceInfo extends PlaceInfo {
    _init(kind, mount) {
        this._mount = mount;
        super._init(kind, mount.get_root(), mount.get_name());
    }

    getIcon() {
        return this._mount.get_symbolic_icon();
    }

    isRemovable() {
        return this._mount.can_eject() || this._mount.can_unmount();
    }

    canUnmount() {
        return this._mount.can_unmount();
    }

    canEject() {
        return this._mount.can_eject();
    }

    eject() {
        const unmountArgs = [
            Gio.MountUnmountFlags.NONE,
            new ShellMountOperation.ShellMountOperation(this._mount).mountOp,
            null, // Gio.Cancellable
        ];

        if (this._mount.can_eject()) {
            this._mount.eject_with_operation(...unmountArgs,
                this._ejectFinish.bind(this));
        } else {
            this._mount.unmount_with_operation(...unmountArgs,
                this._unmountFinish.bind(this));
        }
    }

    _ejectFinish(mount, result) {
        try {
            mount.eject_with_operation_finish(result);
        } catch (e) {
            this._reportFailure(e);
        }
    }

    _unmountFinish(mount, result) {
        try {
            mount.unmount_with_operation_finish(result);
        } catch (e) {
            this._reportFailure(e);
        }
    }

    _reportFailure(exception) {
        const msg = _('Ejecting drive “%s” failed:').format(this._mount.get_name());
        Main.notifyError(msg, exception.message);
    }
};

var PlaceVolumeInfo = class ArcMenuPlaceVolumeInfo extends PlaceInfo {
    _init(kind, volume) {
        this._volume = volume;
        super._init(kind, volume.get_activation_root(), volume.get_name());
    }

    launch(timestamp) {
        if (this.file) {
            super.launch(timestamp);
            return;
        }

        this._volume.mount(0, null, null, (volume, result) => {
            volume.mount_finish(result);

            const mount = volume.get_mount();
            this.file = mount.get_root();
            super.launch(timestamp);
        });
    }

    getIcon() {
        return this._volume.get_symbolic_icon();
    }
};

const DEFAULT_DIRECTORIES = [
    GLib.UserDirectory.DIRECTORY_DOCUMENTS,
    GLib.UserDirectory.DIRECTORY_PICTURES,
    GLib.UserDirectory.DIRECTORY_MUSIC,
    GLib.UserDirectory.DIRECTORY_DOWNLOAD,
    GLib.UserDirectory.DIRECTORY_VIDEOS,
];

export const PlacesManager = class ArcMenuPlacesManager extends EventEmitter {
    constructor() {
        super();

        this._places = {
            special: [],
            devices: [],
            bookmarks: [],
            network: [],
        };

        this._settings = new Gio.Settings({schema_id: BACKGROUND_SCHEMA});
        this._settings.connectObject('changed::show-desktop-icons',
            () => this._updateSpecials(), this);
        this._updateSpecials();

        /*
        * Show devices, code more or less ported from nautilus-places-sidebar.c
        */
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._volumeMonitor.connectObject(
            'volume-added', () => this._updateMounts(),
            'volume-removed', () => this._updateMounts(),
            'volume-changed', () => this._updateMounts(),
            'mount-added', () => this._updateMounts(),
            'mount-removed', () => this._updateMounts(),
            'mount-changed', () => this._updateMounts(),
            'drive-connected', () => this._updateMounts(),
            'drive-disconnected', () => this._updateMounts(),
            'drive-changed', () => this._updateMounts(),
            this);
        this._updateMounts();

        this._bookmarksFile = this._findBookmarksFile();
        this._bookmarkTimeoutId = 0;
        this._monitor = null;

        if (this._bookmarksFile) {
            this._monitor = this._bookmarksFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', () => {
                if (this._bookmarkTimeoutId > 0)
                    return;
                /* Defensive event compression */
                this._bookmarkTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT, 100, () => {
                        this._bookmarkTimeoutId = 0;
                        this._reloadBookmarks();
                        return false;
                    });
            });

            this._reloadBookmarks();
        }
    }

    destroy() {
        this._places.special.forEach(p => p.destroy());
        this._settings?.disconnectObject(this);
        this._settings = null;

        this._volumeMonitor.disconnectObject(this);

        if (this._monitor)
            this._monitor.cancel();
        this._monitor = null;
        if (this._bookmarkTimeoutId)
            GLib.source_remove(this._bookmarkTimeoutId);
    }

    _updateSpecials() {
        this._places.special.forEach(p => p.destroy());
        this._places.special = [];

        const homePath = GLib.get_home_dir();

        this._places.special.push(new PlaceInfo(
            'special',
            Gio.File.new_for_path(homePath),
            _('Home')));

        const specials = [];
        const dirs = DEFAULT_DIRECTORIES.slice();

        if (this._settings.get_boolean('show-desktop-icons'))
            dirs.push(GLib.UserDirectory.DIRECTORY_DESKTOP);

        for (let i = 0; i < dirs.length; i++) {
            const specialPath = GLib.get_user_special_dir(dirs[i]);
            if (!specialPath || specialPath === homePath)
                continue;

            const file = Gio.File.new_for_path(specialPath);
            let info;
            try {
                info = new PlaceInfo('special', file);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    continue;
                throw e;
            }

            specials.push(info);
        }

        specials.sort((a, b) => GLib.utf8_collate(a.name, b.name));
        this._places.special = this._places.special.concat(specials);

        this.emit('special-updated');
    }

    _updateMounts() {
        const networkMounts = [];
        const networkVolumes = [];

        this._places.devices.forEach(p => p.destroy());
        this._places.devices = [];
        this._places.network.forEach(p => p.destroy());
        this._places.network = [];

        /* first go through all connected drives */
        const drives = this._volumeMonitor.get_connected_drives();
        for (let i = 0; i < drives.length; i++) {
            const volumes = drives[i].get_volumes();

            for (let j = 0; j < volumes.length; j++) {
                const identifier = volumes[j].get_identifier('class');
                if (identifier && identifier.includes('network')) {
                    networkVolumes.push(volumes[j]);
                } else {
                    const mount = volumes[j].get_mount();
                    if (mount)
                        this._addMount('devices', mount);
                }
            }
        }

        /* add all volumes that is not associated with a drive */
        const volumes = this._volumeMonitor.get_volumes();
        for (let i = 0; i < volumes.length; i++) {
            if (volumes[i].get_drive())
                continue;

            const identifier = volumes[i].get_identifier('class');
            if (identifier && identifier.includes('network')) {
                networkVolumes.push(volumes[i]);
            } else {
                const mount = volumes[i].get_mount();
                if (mount)
                    this._addMount('devices', mount);
            }
        }

        /* add mounts that have no volume (/etc/mtab mounts, ftp, sftp,...) */
        const mounts = this._volumeMonitor.get_mounts();
        for (let i = 0; i < mounts.length; i++) {
            if (mounts[i].is_shadowed())
                continue;

            if (mounts[i].get_volume())
                continue;

            const root = mounts[i].get_default_location();
            if (!root.is_native()) {
                networkMounts.push(mounts[i]);
                continue;
            }
            this._addMount('devices', mounts[i]);
        }

        for (let i = 0; i < networkVolumes.length; i++) {
            const mount = networkVolumes[i].get_mount();
            if (mount) {
                networkMounts.push(mount);
                continue;
            }
            this._addVolume('network', networkVolumes[i]);
        }

        for (let i = 0; i < networkMounts.length; i++)
            this._addMount('network', networkMounts[i]);


        this.emit('devices-updated');
        this.emit('network-updated');
    }

    _findBookmarksFile() {
        const paths = [
            GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-3.0', 'bookmarks']),
            GLib.build_filenamev([GLib.get_home_dir(), '.gtk-bookmarks']),
        ];

        for (let i = 0; i < paths.length; i++) {
            if (GLib.file_test(paths[i], GLib.FileTest.EXISTS))
                return Gio.File.new_for_path(paths[i]);
        }

        return null;
    }

    _reloadBookmarks() {
        this._bookmarks = [];

        const content = Shell.get_file_contents_utf8_sync(this._bookmarksFile.get_path());
        const lines = content.split('\n');

        const bookmarks = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const components = line.split(' ');
            const [bookmark] = components;

            if (!bookmark)
                continue;

            const file = Gio.File.new_for_uri(bookmark);
            if (file.is_native() && !file.query_exists(null))
                continue;

            let duplicate = false;
            for (let j = 0; j < this._places.special.length; j++) {
                if (file.equal(this._places.special[j].file)) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate)
                continue;
            for (let j = 0; j < bookmarks.length; j++) {
                if (file.equal(bookmarks[j].file)) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate)
                continue;

            let label = null;
            if (components.length > 1)
                label = components.slice(1).join(' ');

            bookmarks.push(new PlaceInfo('bookmarks', file, label));
        }

        this._places.bookmarks = bookmarks;

        this.emit('bookmarks-updated');
    }

    _addMount(kind, mount) {
        let devItem;

        try {
            devItem = new PlaceDeviceInfo(kind, mount);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return;
            throw e;
        }

        this._places[kind].push(devItem);
    }

    _addVolume(kind, volume) {
        let volItem;

        try {
            volItem = new PlaceVolumeInfo(kind, volume);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                return;
            throw e;
        }

        this._places[kind].push(volItem);
    }

    get(kind) {
        return this._places[kind];
    }
};
