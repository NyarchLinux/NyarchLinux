import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import * as Constants from '../constants.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const forbiddenKeyvals = [
    Gdk.KEY_Home,
    Gdk.KEY_Left,
    Gdk.KEY_Up,
    Gdk.KEY_Right,
    Gdk.KEY_Down,
    Gdk.KEY_Page_Up,
    Gdk.KEY_Page_Down,
    Gdk.KEY_End,
    Gdk.KEY_Tab,
    Gdk.KEY_KP_Enter,
    Gdk.KEY_Return,
    Gdk.KEY_Mode_switch,
    Gdk.KEY_Escape,
];

export const GeneralPage = GObject.registerClass(
class ArcMenuGeneralPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('General'),
            icon_name: 'go-home-symbolic',
            name: 'GeneralPage',
        });
        this._settings = settings;

        const menuDisplayGroup = new Adw.PreferencesGroup({
            title: _('Panel Display Options'),
        });
        this.add(menuDisplayGroup);

        // Show Activities Row----------------------------------------------------------------------------
        const showActivitiesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('show-activities-button'),
        });
        showActivitiesSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('show-activities-button', widget.get_active());
        });
        const showActivitiesRow = new Adw.ActionRow({
            title: _('Show Activities Button'),
            subtitle: _('Dash to Panel may conflict with this setting'),
            activatable_widget: showActivitiesSwitch,
        });
        showActivitiesRow.add_suffix(showActivitiesSwitch);
        // -----------------------------------------------------------------------------------------------

        // Position in Panel Row-------------------------------------------------------------
        const menuPositions = new Gtk.StringList();
        menuPositions.append(_('Left'));
        menuPositions.append(_('Center'));
        menuPositions.append(_('Right'));
        const menuPositionRow = new Adw.ComboRow({
            title: _('Position in Panel'),
            model: menuPositions,
            selected: this._settings.get_enum('position-in-panel'),
        });
        menuPositionRow.connect('notify::selected', widget => {
            if (widget.selected === Constants.MenuPosition.CENTER)
                menuAlignmentRow.show();
            else
                menuAlignmentRow.hide();
            this._settings.set_enum('position-in-panel', widget.selected);
        });
        // --------------------------------------------------------------------------------------

        // Menu Alignment row--------------------------------------------------------------------
        const menuAlignmentScale = new Gtk.Scale({
            valign: Gtk.Align.CENTER,
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 1, page_increment: 1, page_size: 0}),
            digits: 0, round_digits: 0, hexpand: true,

        });
        menuAlignmentScale.set_value(this._settings.get_int('menu-position-alignment'));
        menuAlignmentScale.add_mark(0, Gtk.PositionType.BOTTOM, _('Left'));
        menuAlignmentScale.add_mark(50, Gtk.PositionType.BOTTOM, _('Center'));
        menuAlignmentScale.add_mark(100, Gtk.PositionType.BOTTOM, _('Right'));

        menuAlignmentScale.connect('value-changed', widget => {
            this._settings.set_int('menu-position-alignment', widget.get_value());
        });
        const menuAlignmentRow = new Adw.ActionRow({
            title: _('Menu Alignment'),
            activatable_widget: menuAlignmentScale,
            visible: this._settings.get_enum('position-in-panel') === Constants.MenuPosition.CENTER,
        });
        menuAlignmentRow.add_suffix(menuAlignmentScale);
        // -------------------------------------------------------------------------------------

        // Mulit Monitor Row -------------------------------------------------------------------
        const multiMonitorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('multi-monitor'),
        });
        multiMonitorSwitch.connect('notify::active', widget => {
            const multiMonitor = widget.get_active();
            this._settings.set_boolean('multi-monitor', multiMonitor);
        });

        const multiMonitorRow = new Adw.ActionRow({
            title: _('Display ArcMenu on all Panels'),
            subtitle: _('Dash to Panel or App Icons Taskbar extension required'),
            activatable_widget: multiMonitorSwitch,
        });
        multiMonitorRow.add_suffix(multiMonitorSwitch);
        // --------------------------------------------------------------------------------------

        // Prefer Top Panel -------------------------------------------------------------------
        const preferTopPanelSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('dash-to-panel-standalone'),
        });
        preferTopPanelSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('dash-to-panel-standalone', widget.get_active());
        });

        const preferTopPanelRow = new Adw.ActionRow({
            title: _('Always Prefer Top Panel'),
            subtitle: _("Useful with Dash to Panel setting 'Keep original gnome-shell top panel'"),
            activatable_widget: multiMonitorSwitch,
        });
        preferTopPanelRow.add_suffix(preferTopPanelSwitch);
        // --------------------------------------------------------------------------------------

        // Add the rows to the group
        menuDisplayGroup.add(menuPositionRow);
        menuDisplayGroup.add(menuAlignmentRow);
        menuDisplayGroup.add(multiMonitorRow);
        menuDisplayGroup.add(preferTopPanelRow);
        menuDisplayGroup.add(showActivitiesRow);

        const generalGroup = new Adw.PreferencesGroup({
            title: _('General Settings'),
        });
        this.add(generalGroup);

        this.menuHotkeyRow = this._createExpanderRow(_('ArcMenu Hotkey'), true);
        this.standaloneRunnerRow = this._createExpanderRow(_('Standalone Runner Menu'), false);
        generalGroup.add(this.menuHotkeyRow);
        generalGroup.add(this.standaloneRunnerRow);

        const hideOverviewSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('hide-overview-on-startup'),
        });
        hideOverviewSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('hide-overview-on-startup', widget.get_active());
        });

        const hideOverviewRow = new Adw.ActionRow({
            title: _('Hide Overview on Startup'),
            activatable_widget: hideOverviewSwitch,
        });
        hideOverviewRow.add_suffix(hideOverviewSwitch);
        generalGroup.add(hideOverviewRow);
    }

    _createExpanderRow(title, isMenuHotkey) {
        const hotkeySetting = isMenuHotkey ? 'arcmenu-hotkey' : 'runner-hotkey';
        const accelerator = this._settings.get_strv(hotkeySetting);
        const hotkeyString = this.acceleratorToLabel(accelerator);
        const hotkeyLabel = new Gtk.Label({
            label: hotkeyString,
            css_classes: ['dim-label'],
        });
        const customHotkeyRow = new Adw.ActionRow({
            title: _(title),
            activatable: true,
        });
        customHotkeyRow.add_suffix(hotkeyLabel);

        customHotkeyRow.connect('activated', () => {
            const dialog = new HotkeyDialog(isMenuHotkey, this._settings, this);
            dialog.show();
            dialog.inhibitSystemShortcuts();
            dialog.connect('response', (_w, response) => {
                if (response === Gtk.ResponseType.APPLY) {
                    if (dialog.hotkeys)
                        this._settings.set_strv(hotkeySetting, dialog.hotkeys);
                    else
                        this._settings.set_strv(hotkeySetting, []);
                    hotkeyLabel.label = this.acceleratorToLabel(dialog.hotkeys);
                }
                dialog.restoreSystemShortcuts();
                dialog.destroy();
            });
        });

        const editButton = new Gtk.Image({
            icon_name: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            margin_start: 12,
        });
        customHotkeyRow.add_suffix(editButton);

        return customHotkeyRow;
    }

    acceleratorToLabel(accelerator) {
        if (!accelerator || accelerator.length === 0)
            return _('Disabled');

        const hotkeyStrings = [];

        accelerator.forEach(accel => {
            const [ok, key, mods] = Gtk.accelerator_parse(accel);
            if (ok)
                hotkeyStrings.push(Gtk.accelerator_get_label(key, mods));
        });

        return hotkeyStrings.join(', ');
    }
});

var HotkeyDialog = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
},
class ArcMenuHotkeyDialog extends Adw.Window {
    _init(isMenuHotkey, settings, parent) {
        const title = isMenuHotkey ? _('ArcMenu Hotkeys') : _('Standalone Runner Hotkeys');
        super._init({
            modal: true,
            title,
            transient_for: parent.get_root(),
            resizable: true,
        });
        this._settings = settings;
        this._parentWindow = parent.get_root();

        this.set_default_size(560, 585);

        const primaryMonitorSetting = isMenuHotkey ? 'hotkey-open-primary-monitor' : 'runner-hotkey-open-primary-monitor';
        const hotkeySetting = isMenuHotkey ? 'arcmenu-hotkey' : 'runner-hotkey';
        this.hotkeys = this._settings.get_strv(hotkeySetting);

        const eventControllerKey = new Gtk.EventControllerKey();
        this.add_controller(eventControllerKey);

        const shortcutController = new Gtk.ShortcutController();
        this.add_controller(shortcutController);

        this.connect('destroy', () => {
            this.restoreSystemShortcuts();
        });

        const sidebarToolBarView = new Adw.ToolbarView({
            top_bar_style: Adw.ToolbarStyle.FLAT,
        });
        this.set_content(sidebarToolBarView);

        this._headerBar = new Adw.HeaderBar({
            show_end_title_buttons: true,
            show_start_title_buttons: false,
        });
        sidebarToolBarView.add_top_bar(this._headerBar);

        this._applyButton = new Gtk.Button({
            label: _('Apply'),
            halign: Gtk.Align.END,
            hexpand: false,
            css_classes: ['suggested-action'],
            visible: false,
        });
        this._applyButton.connect('clicked', () => {
            this._settings.set_boolean(`${hotkeySetting}-overlay-key-enabled`, useAsOverlayKeySwitch.get_active());
            this._settings.set_boolean(primaryMonitorSetting, primaryMonitorSwitch.get_active());
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        this._headerBar.pack_end(this._applyButton);

        this._cancelButton = new Gtk.Button({
            label: _('Cancel'),
            halign: Gtk.Align.START,
            hexpand: false,
            visible: false,
        });
        this._cancelButton.connect('clicked', () => this.close());
        this._headerBar.pack_start(this._cancelButton);

        const hotkeysPage = new Adw.PreferencesPage();
        sidebarToolBarView.set_content(hotkeysPage);

        const content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18,
            height_request: 200,
        });
        const addHotkeyGroup = new Adw.PreferencesGroup();
        addHotkeyGroup.add(content);
        hotkeysPage.add(addHotkeyGroup);

        this._currentHotkeysGroup = new Adw.PreferencesGroup({
            title: _('Active Hotkeys'),
            visible: this.hotkeys.length > 0,
        });
        hotkeysPage.add(this._currentHotkeysGroup);

        const hotkeyOptionsGroup = new Adw.PreferencesGroup({
            title: _('Hotkey Options'),
        });
        hotkeysPage.add(hotkeyOptionsGroup);

        const useAsOverlayKeySwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean(`${hotkeySetting}-overlay-key-enabled`),
        });
        useAsOverlayKeySwitch.connect('notify::active', () => {
            this._toggleHeaderBarButtons(true);
        });

        const useAsOverlayKeyRow = new Adw.ActionRow({
            title: _('Super Hotkeys Override GNOME Overview Hotkey'),
            activatable_widget: useAsOverlayKeySwitch,
        });
        useAsOverlayKeyRow.add_suffix(useAsOverlayKeySwitch);
        hotkeyOptionsGroup.add(useAsOverlayKeyRow);

        const primaryMonitorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: settings.get_boolean(primaryMonitorSetting),
        });
        primaryMonitorSwitch.connect('notify::active', () => {
            this._toggleHeaderBarButtons(true);
        });
        const primaryMonitorRow = new Adw.ActionRow({
            title: _('Open on Primary Monitor'),
            activatable_widget: primaryMonitorSwitch,
        });
        primaryMonitorRow.add_suffix(primaryMonitorSwitch);
        hotkeyOptionsGroup.add(primaryMonitorRow);

        this.hotkeys.forEach(hotkey => {
            this._addHotkeyRow(hotkey);
        });

        const keyLabel = new Gtk.Label({
            label: _('Type on your keyboard to add a new hotkey.'),
            css_classes: ['title-4'],
            use_markup: true,
            xalign: .5,
            wrap: true,
        });
        content.append(keyLabel);

        const directory = GLib.path_get_dirname(import.meta.url);
        const rootDirectory = GLib.path_get_dirname(directory);
        const iconPath = '/icons/hicolor/16x16/actions/settings-keyboard.svg';

        const keyboardImage = new Gtk.Picture({
            file: Gio.File.new_for_uri(`${rootDirectory}${iconPath}`),
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            can_shrink: false,
        });
        content.append(keyboardImage);

        const shortcutLabel = new Gtk.ShortcutLabel({
            hexpand: true,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.START,
            vexpand: false,
            visible: false,
            css_classes: ['title-1'],
            disabled_text: _('Disabled'),
        });
        content.append(shortcutLabel);

        const conflictLabel = new Gtk.Label({
            visible: false,
            use_markup: true,
            wrap: true,
        });
        content.append(conflictLabel);

        const addButton = new Gtk.Button({
            label: _('Add Hotkey'),
            halign: Gtk.Align.CENTER,
            hexpand: false,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            css_classes: ['suggested-action'],
            visible: false,
        });
        addButton.connect('clicked', () => {
            this._currentHotkeysGroup.visible = true;
            this._toggleHeaderBarButtons(true);
            this._addHotkeyRow(this.resultsText);
            this.hotkeys.push(this.resultsText);
            this.resultsText = null;
            shortcutLabel.accelerator = null;
            shortcutLabel.visible = false;
            keyboardImage.visible = true;
            conflictLabel.visible = false;
            addButton.visible = false;
        });
        content.append(addButton);

        // Based on code from PaperWM prefsKeybinding.js https://github.com/paperwm/PaperWM
        eventControllerKey.connect('key-pressed', (controller, keyval, keycode, state) => {
            let modmask = state & Gtk.accelerator_get_default_mod_mask();
            let keyvalLower = Gdk.keyval_to_lower(keyval);

            // Normalize <Tab>
            if (keyvalLower === Gdk.KEY_ISO_Left_Tab)
                keyvalLower = Gdk.KEY_Tab;

            // Put Shift back if it changed the case of the key
            if (keyvalLower !== keyval)
                modmask |= Gdk.ModifierType.SHIFT_MASK;

            const event = controller.get_current_event();
            const isModifier = event.is_modifier();

            // Backspace deletes
            if (!isModifier && modmask === 0 && keyvalLower === Gdk.KEY_BackSpace) {
                this.resultsText = null;
                shortcutLabel.accelerator = null;
                shortcutLabel.visible = false;
                keyboardImage.visible = true;
                conflictLabel.visible = false;
                addButton.visible = false;
                return Gdk.EVENT_STOP;
            }

            // Remove CapsLock
            modmask &= ~Gdk.ModifierType.LOCK_MASK;

            // Remove SUPER_MASK modifier if keyval is Super_L or Super_R
            if (keyval === Gdk.KEY_Super_L || keyval === Gdk.KEY_Super_R)
                modmask &= ~Gdk.ModifierType.SUPER_MASK;

            const combo = {mods: modmask, keycode, keyval: keyvalLower};
            if (!this._isValidBinding(combo))
                return Gdk.EVENT_STOP;

            this.resultsText = Gtk.accelerator_name(keyval, modmask);
            const conflicts = this.findConflicts(this.resultsText);

            shortcutLabel.accelerator = this.resultsText;
            shortcutLabel.visible = true;
            keyboardImage.visible = false;
            if (conflicts) {
                this.resultsText = null;
                conflictLabel.css_classes = ['error'];
                conflictLabel.visible = true;
                addButton.visible = false;
                conflictLabel.label = _('Conflict with <b>%s</b> hotkey').format(`${conflicts.conflict}`);
            } else {
                conflictLabel.visible = false;
                addButton.visible = true;
            }

            return Gdk.EVENT_STOP;
        });
    }

    _toggleHeaderBarButtons(bool) {
        this._headerBar.show_end_title_buttons = !bool;
        this._applyButton.visible = bool;
        this._cancelButton.visible = bool;
    }

    _addHotkeyRow(hotkey) {
        const [ok, key, mods] = Gtk.accelerator_parse(hotkey);
        const shortcutLabel = new Gtk.ShortcutLabel({
            valign: Gtk.Align.CENTER,
            vexpand: false,
            accelerator: ok ? Gtk.accelerator_name(key, mods) : null,
        });

        const shortcutRow = new Adw.ActionRow();
        this._currentHotkeysGroup.add(shortcutRow);

        const removeButton = new Gtk.Button({
            icon_name: 'list-remove-symbolic',
            halign: Gtk.Align.END,
            hexpand: false,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            css_classes: ['destructive-action'],
            visible: true,
        });
        removeButton.connect('clicked', () => {
            const index = this.hotkeys.indexOf(hotkey);
            this.hotkeys.splice(index, 1);
            this._currentHotkeysGroup.remove(shortcutRow);
            this._toggleHeaderBarButtons(true);
            this._currentHotkeysGroup.visible = this.hotkeys.length > 0;
        });

        shortcutRow.add_prefix(shortcutLabel);
        shortcutRow.add_suffix(removeButton);
    }

    // Based on code from PaperWM prefsKeybinding.js https://github.com/paperwm/PaperWM
    _isValidBinding(combo) {
        if ((combo.mods === 0 || combo.mods === Gdk.ModifierType.SHIFT_MASK) && combo.keycode !== 0) {
            const keyval = combo.keyval;
            if ((keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z) ||
                (keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z) ||
                (keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9) ||
                (keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound) ||
                (keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun) ||
                (keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN) ||
                (keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega) ||
                (keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf) ||
                (keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao) ||
                (keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh) ||
                (keyval === Gdk.KEY_space && combo.mods === 0) ||
                forbiddenKeyvals.includes(keyval))
                return false;
        }

        // Empty binding
        if (combo.keyval === 0 && combo.mods === 0 && combo.keycode === 0)
            return false;

        // Allow use of Super_L and Super_R hotkeys
        if (combo.keyval === Gdk.KEY_Super_L || combo.keyval === Gdk.KEY_Super_R)
            return true;

        // Allow Tab in addition to accelerators allowed by GTK
        if (!Gtk.accelerator_valid(combo.keyval, combo.mods) &&
            (combo.keyval !== Gdk.KEY_Tab || combo.mods === 0))
            return false;

        return true;
    }

    getConflictSettings() {
        if (!this._conflictSettings) {
            this._conflictSettings = [];
            this._addConflictSettings('org.gnome.mutter.keybindings');
            this._addConflictSettings('org.gnome.mutter.wayland.keybindings');
            this._addConflictSettings('org.gnome.shell.keybindings');
            this._addConflictSettings('org.gnome.desktop.wm.keybindings');
            this._addConflictSettings('org.gnome.settings-daemon.plugins.media-keys');
        }

        return this._conflictSettings;
    }

    _addConflictSettings(schemaId) {
        try {
            const settings = new Gio.Settings({schema_id: schemaId});
            this._conflictSettings.push(settings);
        } catch (e) {
            console.log(e);
        }
    }

    generateKeycomboMap(settings) {
        const map = {};
        for (const name of settings.list_keys()) {
            const value = settings.get_value(name);
            if (value.get_type_string() !== 'as')
                continue;

            for (const combo of value.deep_unpack()) {
                if (combo === '0|0')
                    continue;
                if (map[combo])
                    map[combo].push(name);
                else
                    map[combo] = [name];
            }
        }

        return map;
    }

    findConflicts(newHotkey) {
        const schemas = this.getConflictSettings();
        let conflicts = null;

        const newHotkeyMap = {};
        newHotkeyMap[newHotkey] = ['New Hotkey'];

        for (const settings of schemas) {
            const against = this.generateKeycomboMap(settings);
            for (const combo in newHotkeyMap) {
                if (against[combo]) {
                    conflicts = {
                        conflict: against[combo],
                        name: newHotkeyMap[combo],
                    };
                }
            }
        }

        const arcMenuHotkeys = {};

        const runnerHotkey = this._settings.get_strv('runner-hotkey');
        runnerHotkey.forEach(hotkey => {
            arcMenuHotkeys[hotkey] = [_('Standlone Runner')];
        });
        const arcmenuHotkey = this._settings.get_strv('arcmenu-hotkey');
        arcmenuHotkey.forEach(hotkey => {
            arcMenuHotkeys[hotkey] = [_('ArcMenu')];
        });

        for (const combo in newHotkeyMap) {
            if (arcMenuHotkeys[combo]) {
                conflicts = {
                    conflict: arcMenuHotkeys[combo],
                    name: newHotkeyMap[combo],
                };
            }
        }

        return conflicts;
    }

    inhibitSystemShortcuts() {
        this.grab_focus();

        // Note - surface.inhibit_system_shortcuts() seems to need a different surface on X11 vs Wayland?
        const isWayland = GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
        const surface = isWayland ? this.get_surface() : this._parentWindow.get_surface();

        surface.inhibit_system_shortcuts(null);
    }

    restoreSystemShortcuts() {
        // Note - surface.inhibit_system_shortcuts() seems to need a different surface on X11 vs Wayland?
        const isWayland = GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
        const surface = isWayland ? this.get_surface() : this._parentWindow.get_surface();

        if (surface)
            surface.restore_system_shortcuts();
    }
});
