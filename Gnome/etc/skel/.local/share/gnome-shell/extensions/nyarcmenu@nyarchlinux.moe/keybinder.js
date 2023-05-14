/* exported OverrideOverlayKey, CustomKeybinding */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Gio, GObject, Meta, Shell} = imports.gi;
const Constants = Me.imports.constants;
const Main = imports.ui.main;

const MUTTER_SCHEMA = 'org.gnome.mutter';

var OverrideOverlayKey = class {
    constructor() {
        this.isOverrideOverlayEnabled = false;
        this._ignoreHotKeyChangedEvent = false;

        this._mutterSettings = new Gio.Settings({'schema': MUTTER_SCHEMA});

        this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');

        this._overlayKeyChangedID = this._mutterSettings.connect('changed::overlay-key', () => {
            if (!this._ignoreHotKeyChangedEvent)
                this._oldOverlayKey = this._mutterSettings.get_value('overlay-key');
        });

        this._mainStartUpComplete = Main.layoutManager.connect('startup-complete',
            () => this._overrideOverlayKey());
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
        if (this.overlayKeyID) {
            global.display.disconnect(this.overlayKeyID);
            this.overlayKeyID = null;
        }
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
            log('ArcMenu Error - Failed to set Super_L hotkey');
            return;
        }

        GObject.signal_handler_block(global.display, this.defaultOverlayKeyID);

        Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);

        this.overlayKeyID = global.display.connect('overlay-key', () => {
            this._toggleMenu();
            // Workaround for PopShell extension conflicting with ArcMenu SUPER_L hotkey.
            // PopShell extension removes ActionMode.POPUP from 'overlay-key',
            // which prevents the use of the SUPER_L hotkey when popup menus are opened.
            // Set 'overlay-key' action mode to ActionMode.ALL when ArcMenu is opened.
            Main.wm.allowKeybinding('overlay-key', Shell.ActionMode.ALL);
        });
    }

    destroy() {
        if (this._overlayKeyChangedID) {
            this._mutterSettings.disconnect(this._overlayKeyChangedID);
            this._overlayKeyChangedID = null;
        }
        this.disable();
        if (this._mainStartUpComplete) {
            Main.layoutManager.disconnect(this._mainStartUpComplete);
            this._mainStartUpComplete = null;
        }
    }
};

var CustomKeybinding = class {
    constructor() {
        this._keybindings = new Map();
    }

    bind(keybindingNameKey, keybindingValueKey, keybindingHandler) {
        if (!this._keybindings.has(keybindingNameKey)) {
            this._keybindings.set(keybindingNameKey, keybindingValueKey);

            Main.wm.addKeybinding(keybindingValueKey, ExtensionUtils.getSettings(),
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
        this._keybindings.forEach((value, key) => {
            Main.wm.removeKeybinding(value);
            this._keybindings.delete(key);
        });
    }

    destroy() {
        this.unbindAll();
    }
};
