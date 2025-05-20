import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';

const MUTTER_SCHEMA = 'org.gnome.mutter';

export class OverrideOverlayKey {
    constructor() {
        this.isOverrideOverlayEnabled = false;
        this._ignoreHotKeyChangedEvent = false;

        this._mutterSettings = new Gio.Settings({'schema': MUTTER_SCHEMA});

        this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');

        this._mutterSettings.connectObject('changed::overlay-key', () => {
            if (!this._ignoreHotKeyChangedEvent)
                this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');
        }, this);

        Main.layoutManager.connectObject('startup-complete', () => this._overrideOverlayKey(), this);
    }

    enable(toggleMenu) {
        this._toggleMenu = toggleMenu;

        this._ignoreHotKeyChangedEvent = true;

        this._mutterSettings.set_string('overlay-key', Constants.SUPER_L);
        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

        this.isOverrideOverlayEnabled = true;

        if (!Main.layoutManager._startingUp)
            this._overrideOverlayKey();

        this._ignoreHotKeyChangedEvent = false;
    }

    disable() {
        this._ignoreHotKeyChangedEvent = true;
        this._mutterSettings.set_value('overlay-key', this._oldOverlayKey);

        global.display.disconnectObject(this);

        if (this.defaultOverlayKeyID) {
            GObject.signal_handler_unblock(global.display, this.defaultOverlayKeyID);
            this.defaultOverlayKeyID = null;
        }
        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);

        this.isOverrideOverlayEnabled = false;
        this._ignoreHotKeyChangedEvent = false;
    }

    _overrideOverlayKey() {
        if (!this.isOverrideOverlayEnabled)
            return;

        this.defaultOverlayKeyID = GObject.signal_handler_find(global.display, {signalId: 'overlay-key'});

        if (!this.defaultOverlayKeyID) {
            console.log('ArcMenu Error - Failed to set Super_L hotkey');
            return;
        }

        GObject.signal_handler_block(global.display, this.defaultOverlayKeyID);

        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

        global.display.connectObject('overlay-key', () => {
            this._toggleMenu();
            // Workaround for PopShell extension conflicting with ArcMenu SUPER_L hotkey.
            // PopShell extension removes ActionMode.POPUP from 'overlay-key',
            // which prevents the use of the SUPER_L hotkey when popup menus are opened.
            // Set 'overlay-key' action mode to ActionMode.ALL when ArcMenu is opened.
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

export class CustomKeybinding {
    constructor() {
        this._keybindings = new Map();
    }

    bind(keybindingNameKey, keybindingValueKey, keybindingHandler) {
        if (!this._keybindings.has(keybindingNameKey)) {
            this._keybindings.set(keybindingNameKey, keybindingValueKey);

            Main.wm.addKeybinding(keybindingValueKey, ArcMenuManager.settings,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
                keybindingHandler);
        }
    }

    unbind(keybindingNameKey) {
        if (this._keybindings.has(keybindingNameKey)) {
            const keybindingValueKey = this._keybindings.get(keybindingNameKey);
            Main.wm.removeKeybinding(keybindingValueKey);
            this._keybindings.delete(keybindingNameKey);
        }
    }

    unbindAll() {
        this._keybindings.forEach(value => {
            Main.wm.removeKeybinding(value);
        });
    }

    destroy() {
        this.unbindAll();
        this._keybindings = null;
    }
}
