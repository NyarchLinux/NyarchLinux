import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import * as Constants from '../constants.js';
import * as PW from '../prefsWidgets.js';

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
            this.menuHotkeyRow.setMultiMonitor(multiMonitor);
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
        const primaryMonitorSetting = isMenuHotkey ? 'hotkey-open-primary-monitor'
            : 'runner-hotkey-open-primary-monitor';
        const accelerator = this._settings.get_strv(hotkeySetting).toString();
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
                    if (dialog.resultsText)
                        this._settings.set_strv(hotkeySetting, [dialog.resultsText]);
                    else
                        this._settings.set_strv(hotkeySetting, []);
                    hotkeyLabel.label = this.acceleratorToLabel(dialog.resultsText);
                }
                dialog.restoreSystemShortcuts();
                dialog.destroy();
            });
        });

        const customizeButton = new Gtk.Button({
            icon_name: 'applications-system-symbolic',
            css_classes: ['flat'],
            valign: Gtk.Align.CENTER,
            visible: isMenuHotkey ? this._settings.get_boolean('multi-monitor') : true,
        });
        customHotkeyRow.add_suffix(customizeButton);

        customizeButton.connect('clicked', () => {
            const windowPreviewOptions = new HotkeyOptionsDialog(this._settings, _('Hotkey Options'), this.get_root(), primaryMonitorSetting);
            windowPreviewOptions.show();
        });

        customHotkeyRow.setMultiMonitor = bool => {
            customizeButton.visible = bool;
        };

        return customHotkeyRow;
    }

    acceleratorToLabel(accelerator) {
        if (!accelerator)
            return _('Disabled');
        const [ok, key, mods] = Gtk.accelerator_parse(accelerator);
        if (!ok)
            return '';

        return Gtk.accelerator_get_label(key, mods);
    }
});

var HotkeyOptionsDialog = GObject.registerClass(
class ArcMenuHotkeyOptionsDialog extends PW.DialogWindow {
    _init(settings, title, parent, primaryMonitorSetting) {
        super._init(title, parent);
        this.set_default_size(460, 150);
        this.search_enabled = false;
        this.resizable = false;

        const primaryMonitorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: settings.get_boolean(primaryMonitorSetting),
        });
        primaryMonitorSwitch.connect('notify::active', widget => {
            settings.set_boolean(primaryMonitorSetting, widget.get_active());
        });
        const primaryMonitorRow = new Adw.ActionRow({
            title: _('Open on Primary Monitor'),
            activatable_widget: primaryMonitorSwitch,
        });
        primaryMonitorRow.add_suffix(primaryMonitorSwitch);

        this.pageGroup.add(primaryMonitorRow);
    }
});

var HotkeyDialog = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
},
class ArcMenuHotkeyDialog extends Adw.Window {
    _init(isMenuHotkey, settings, parent) {
        super._init({
            modal: true,
            title: _('Modify Hotkey'),
            transient_for: parent.get_root(),
            resizable: false,
        });
        this._settings = settings;
        this._parentWindow = parent.get_root();

        this.set_default_size(460, 275);

        const eventControllerKey = new Gtk.EventControllerKey();
        this.add_controller(eventControllerKey);

        const shortcutController = new Gtk.ShortcutController();
        this.add_controller(shortcutController);
        const escapeShortcut = new Gtk.Shortcut({
            trigger: Gtk.ShortcutTrigger.parse_string('Escape'),
            action: Gtk.ShortcutAction.parse_string('action(window.close)'),
        });
        shortcutController.add_shortcut(escapeShortcut);

        this.connect('destroy', () => {
            this.restoreSystemShortcuts();
        });

        const sidebarToolBarView = new Adw.ToolbarView({
            top_bar_style: Adw.ToolbarStyle.RAISED,
        });
        this.set_content(sidebarToolBarView);

        const headerBar = new Adw.HeaderBar({
            show_end_title_buttons: true,
            show_start_title_buttons: false,
        });
        sidebarToolBarView.add_top_bar(headerBar);

        const applyButton = new Gtk.Button({
            label: _('Apply'),
            halign: Gtk.Align.END,
            hexpand: false,
            css_classes: ['suggested-action'],
            visible: false,
        });
        applyButton.connect('clicked', () => {
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        headerBar.pack_end(applyButton);

        const cancelButton = new Gtk.Button({
            label: _('Cancel'),
            halign: Gtk.Align.START,
            hexpand: false,
            visible: false,
        });
        cancelButton.connect('clicked', () => this.close());
        headerBar.pack_start(cancelButton);

        const content = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        sidebarToolBarView.set_content(content);

        const keyLabel = new Gtk.Label({
            /* TRANSLATORS: %s is replaced with a description of the keyboard shortcut, don't translate/transliterate <b>%s</b>*/
            label: _('Enter a new shortcut to change <b>%s</b>').format(isMenuHotkey ? _('ArcMenu Hotkey') : _('Standalone Runner Hotkey')),
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
            disabled_text: _('Disabled'),
        });
        content.append(shortcutLabel);

        const conflictLabel = new Gtk.Label({
            label: _('Press Esc to cancel or Backspace to disable the keyboard shortcut.'),
            use_markup: true,
            wrap: true,
        });
        content.append(conflictLabel);

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
                shortcutLabel.accelerator = null;
                shortcutLabel.visible = true;
                cancelButton.visible = true;
                keyboardImage.visible = false;
                conflictLabel.visible = false;
                applyButton.visible = true;
                return Gdk.EVENT_STOP;
            }

            // Remove CapsLock
            modmask &= ~Gdk.ModifierType.LOCK_MASK;

            const combo = {mods: modmask, keycode, keyval: keyvalLower};
            if (!this._isValidBinding(combo))
                return Gdk.EVENT_STOP;

            this.resultsText = Gtk.accelerator_name(keyval, modmask);
            const conflicts = this.findConflicts(this.resultsText);

            shortcutLabel.accelerator = this.resultsText;
            shortcutLabel.visible = true;
            cancelButton.visible = true;
            keyboardImage.visible = false;
            if (conflicts) {
                applyButton.visible = false;
                conflictLabel.css_classes = ['error'];
                conflictLabel.visible = true;
                conflictLabel.label = _('Conflict with <b>%s</b> hotkey').format(`${conflicts.conflict}`);
            } else {
                conflictLabel.visible = false;
                applyButton.visible = true;
            }

            return Gdk.EVENT_STOP;
        });
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
            this._conflictSettings = [
                new Gio.Settings({schema_id: 'org.gnome.mutter.keybindings'}),
                new Gio.Settings({schema_id: 'org.gnome.mutter.wayland.keybindings'}),
                new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'}),
                new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'}),
            ];
        }

        return this._conflictSettings;
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
        const [runnerHotkey] = this._settings.get_strv('runner-hotkey');
        const [menuHotkey] = this._settings.get_strv('arcmenu-hotkey');

        arcMenuHotkeys[menuHotkey] = [_('ArcMenu')];
        arcMenuHotkeys[runnerHotkey] = [_('Standlone Runner')];

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
