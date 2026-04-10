import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Constants from './constants.js';
import {connectSettings, Debouncer} from './utils.js';

const MUTTER_SCHEMA = 'org.gnome.mutter';
const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

export class Keybinder extends EventEmitter {
    constructor(settings) {
        super();
        this._settings = settings;
        this._overlayKeybinder = new OverlayKeybinder();
        this._customKeybinder = new CustomKeybinder(this._settings);
        this._debouncer = new Debouncer();
        this._toggleArcMenu = () => {
            console.log('ArcMenu Warning: toggleArcMenu() not set.');
        };
        this._toggleRunnerMenu = () => {
            console.log('ArcMenu Warning: toggleRunnerMenu() not set.');
        };

        connectSettings(
            ['arcmenu-hotkey', 'runner-hotkey', 'arcmenu-hotkey-overlay-key-enabled', 'runner-hotkey-overlay-key-enabled'],
            this._updateHotkeys.bind(this),
            this
        );

        this._updateHotkeys();
    }

    set toggleArcMenu(handler) {
        this._toggleArcMenu = handler;
    }

    set toggleRunnerMenu(handler) {
        this._toggleRunnerMenu = handler;
    }

    _updateHotkeys() {
        this._debouncer.debounce('updateHotkeys', () => {
            const runnerHotkeys = this._settings.get_strv('runner-hotkey');
            const arcmenuHotkeys = this._settings.get_strv('arcmenu-hotkey');

            this._customKeybinder.unbind('ToggleArcMenu');
            this._customKeybinder.unbind('ToggleRunnerMenu');
            this._overlayKeybinder.disable();

            if (arcmenuHotkeys.length > 0) {
                const superKey = this._getSuperHotkey(arcmenuHotkeys, 'arcmenu');
                if (superKey) {
                    this._overlayKeybinder.enable(superKey, () => this._toggleArcMenu());
                    this._spliceSuperHotkeys(arcmenuHotkeys);
                }

                if (arcmenuHotkeys.length > 0)
                    this._customKeybinder.bind('ToggleArcMenu', 'arcmenu-hotkey', () => this._toggleArcMenu());
            }

            let runnerMenuActive = false;
            if (runnerHotkeys.length > 0) {
                // ArcMenu has priority of the overlay-key. If already enabled, skip for StandaloneRunner.
                const superKey = this._getSuperHotkey(runnerHotkeys, 'runner');
                if (superKey && !this._overlayKeybinder.enabled) {
                    this._overlayKeybinder.enable(superKey, () => this._toggleRunnerMenu());
                    this._spliceSuperHotkeys(runnerHotkeys);
                    runnerMenuActive = true;
                }

                if (runnerHotkeys.length > 0) {
                    this._customKeybinder.bind('ToggleRunnerMenu', 'runner-hotkey', () => this._toggleRunnerMenu());
                    runnerMenuActive = true;
                }
            }
            this.emit('runner-menu-active', runnerMenuActive);
        });
    }

    _spliceSuperHotkeys(hotkeys) {
        const hasSuperL = hotkeys.includes(Constants.SUPER_L);
        const hasSuperR = hotkeys.includes(Constants.SUPER_R);

        if (hasSuperL && hasSuperR && ShellVersion >= 48) {
            hotkeys.splice(hotkeys.indexOf(Constants.SUPER_L), 1);
            hotkeys.splice(hotkeys.indexOf(Constants.SUPER_R), 1);
        } else if (hasSuperL || hasSuperR) {
            const index = hotkeys.findIndex(key => key === Constants.SUPER_L || key === Constants.SUPER_R);
            if (index !== -1)
                hotkeys.splice(index, 1);
        }
    }

    _getSuperHotkey(hotkeys, type) {
        const useAsOverlayKey = this._settings.get_boolean(`${type}-hotkey-overlay-key-enabled`);
        if (!useAsOverlayKey)
            return false;

        if (hotkeys.includes(Constants.SUPER_L) && hotkeys.includes(Constants.SUPER_R)) {
            // GNOME 48+ supports using 'Super' as the overlay-key, which allows both Super_L and Super_R
            if (ShellVersion >= 48)
                return Constants.SUPER;
            else
                return hotkeys.find(key => key === Constants.SUPER_L || key === Constants.SUPER_R);
        } else if (hotkeys.includes(Constants.SUPER_L)) {
            return Constants.SUPER_L;
        } else if (hotkeys.includes(Constants.SUPER_R)) {
            return Constants.SUPER_R;
        } else {
            return false;
        }
    }

    destroy() {
        this._debouncer.destroy();
        this._debouncer = null;
        this._settings.disconnectObject(this);
        this._settings = null;
        this._overlayKeybinder.destroy();
        this._overlayKeybinder = null;
        this._customKeybinder.destroy();
        this._customKeybinder = null;
        this._toggleArcMenu = null;
        this._toggleRunnerMenu = null;
    }
}

class OverlayKeybinder {
    constructor() {
        this._ignoreHotKeyChangedEvent = false;
        this.enabled = false;

        this._mutterSettings = new Gio.Settings({'schema': MUTTER_SCHEMA});

        this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');

        this._mutterSettings.connectObject('changed::overlay-key', () => {
            if (!this._ignoreHotKeyChangedEvent)
                this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');
        }, this);
    }

    enable(hotkey, handler) {
        if (this.enabled)
            return;

        this.enabled = true;

        this._ignoreHotKeyChangedEvent = true;

        this._mutterSettings.set_string('overlay-key', hotkey);
        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

        if (Main.layoutManager._startingUp) {
            Main.layoutManager.connectObject('startup-complete', () => {
                this._overrideOverlayKey(handler);
                Main.layoutManager.disconnectObject(this);
            }, this);
        } else {
            this._overrideOverlayKey(handler);
        }

        this._ignoreHotKeyChangedEvent = false;
    }

    disable() {
        if (!this.enabled)
            return;

        this.enabled = false;
        this._ignoreHotKeyChangedEvent = true;
        this._mutterSettings.set_value('overlay-key', this._oldOverlayKey);

        global.display.disconnectObject(this);

        if (this.defaultOverlayKeyID) {
            GObject.signal_handler_unblock(global.display, this.defaultOverlayKeyID);
            this.defaultOverlayKeyID = null;
        }
        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);
        this._ignoreHotKeyChangedEvent = false;
    }

    _overrideOverlayKey(handler) {
        this.defaultOverlayKeyID = GObject.signal_handler_find(global.display, {signalId: 'overlay-key'});

        if (!this.defaultOverlayKeyID) {
            console.log('ArcMenu Error - Failed to set Super hotkey');
            return;
        }

        GObject.signal_handler_block(global.display, this.defaultOverlayKeyID);

        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

        global.display.connectObject('overlay-key', () => {
            handler();
            // PopShell Workaround
            Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);
        }, this);
    }

    destroy() {
        this._mutterSettings.disconnectObject(this);
        Main.layoutManager.disconnectObject(this);
        this.disable();
        this._mutterSettings = null;
    }
}

class CustomKeybinder {
    constructor(settings) {
        this._keybindings = new Map();
        this._settings = settings;
    }

    bind(id, settingName, handler) {
        if (this._keybindings.has(id))
            return;

        this._keybindings.set(id, settingName);

        Main.wm.addKeybinding(settingName, this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            handler);
    }

    unbind(id) {
        if (!this._keybindings.has(id))
            return;

        const settingName = this._keybindings.get(id);
        Main.wm.removeKeybinding(settingName);
        this._keybindings.delete(id);
    }

    unbindAll() {
        this._keybindings.forEach(value => {
            Main.wm.removeKeybinding(value);
        });
        this._keybindings.clear();
    }

    destroy() {
        this.unbindAll();
        this._keybindings = null;
        this._settings = null;
    }
}
