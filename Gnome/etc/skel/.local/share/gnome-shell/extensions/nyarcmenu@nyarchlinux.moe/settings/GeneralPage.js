/* exported GeneralPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, GdkPixbuf, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var GeneralPage = GObject.registerClass(
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
            this._settings.set_boolean('multi-monitor', widget.get_active());
            menuHotkeyRow.displayRows();
            standaloneRunnerRow.displayRows();
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

        const menuHotkeyRow = this._createExpanderRow(_('ArcMenu Hotkey'), true);
        const standaloneRunnerRow = this._createExpanderRow(_('Standalone Runner Menu'), false);
        generalGroup.add(menuHotkeyRow);
        generalGroup.add(standaloneRunnerRow);

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
        const hotkeySetting = isMenuHotkey ? 'menu-hotkey-type' : 'runner-menu-hotkey-type';
        const customHotkeySetting = isMenuHotkey ? 'arcmenu-custom-hotkey' : 'runner-menu-custom-hotkey';
        const primaryMonitorSetting = isMenuHotkey ? 'hotkey-open-primary-monitor'
            : 'runner-hotkey-open-primary-monitor';
        const enabledSetting = isMenuHotkey ? 'enable-menu-hotkey' : 'enable-standlone-runner-menu';

        const enabled = this._settings.get_boolean(enabledSetting);

        const expanderRow = new Adw.ExpanderRow({
            title: _(title),
            show_enable_switch: true,
            enable_expansion: enabled,
        });

        expanderRow.connect('notify::enable-expansion', widget => {
            this._settings.set_boolean(enabledSetting, widget.enable_expansion);
        });

        const primaryMonitorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean(primaryMonitorSetting),
        });
        primaryMonitorSwitch.connect('notify::active', widget => {
            this._settings.set_boolean(primaryMonitorSetting, widget.get_active());
        });
        const primaryMonitorRow = new Adw.ActionRow({
            title: _('Open on Primary Monitor'),
            activatable_widget: primaryMonitorSwitch,
        });
        primaryMonitorRow.add_suffix(primaryMonitorSwitch);

        const hotKeyOptions = new Gtk.StringList();
        hotKeyOptions.append(_('Left Super Key'));
        hotKeyOptions.append(_('Custom Hotkey'));
        const hotkeyRow = new Adw.ComboRow({
            title: _('Hotkey'),
            model: hotKeyOptions,
            selected: this._settings.get_enum(hotkeySetting),
        });

        const shortcutCell = new Gtk.ShortcutsShortcut({
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        shortcutCell.accelerator = this._settings.get_strv(customHotkeySetting).toString();

        const modifyHotkeyButton = new Gtk.Button({
            label: _('Modify Hotkey'),
            valign: Gtk.Align.CENTER,
        });

        const customHotkeyRow = new Adw.ActionRow({
            title: _('Current Hotkey'),
            activatable_widget: modifyHotkeyButton,
        });
        customHotkeyRow.add_suffix(shortcutCell);
        customHotkeyRow.add_suffix(modifyHotkeyButton);
        modifyHotkeyButton.connect('clicked', () => {
            const dialog = new HotkeyDialog(this._settings, this);
            dialog.show();
            dialog.connect('response', (_w, response) => {
                if (response === Gtk.ResponseType.APPLY) {
                    this._settings.set_strv(customHotkeySetting, [dialog.resultsText]);
                    shortcutCell.accelerator = dialog.resultsText;
                }
                dialog.destroy();
            });
        });

        expanderRow.add_row(hotkeyRow);
        expanderRow.add_row(customHotkeyRow);
        expanderRow.add_row(primaryMonitorRow);

        expanderRow.displayRows = () => {
            customHotkeyRow.hide();
            primaryMonitorRow.hide();

            if (hotkeyRow.selected === Constants.HotkeyType.CUSTOM)
                customHotkeyRow.show();

            if (this._settings.get_boolean('multi-monitor'))
                primaryMonitorRow.show();
        };

        hotkeyRow.connect('notify::selected', widget => {
            expanderRow.displayRows();
            this._settings.set_enum(hotkeySetting, widget.selected);
        });
        expanderRow.displayRows();

        return expanderRow;
    }
});

var HotkeyDialog = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
},
class ArcMenuHotkeyDialog extends Gtk.Window {
    _init(settings, parent) {
        this._settings = settings;
        this.keyEventController = new Gtk.EventControllerKey();

        super._init({
            modal: true,
            title: _('Set Custom Hotkey'),
            transient_for: parent.get_root(),
        });
        const vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            homogeneous: false,
            margin_top: 5,
            margin_bottom: 5,
            margin_start: 5,
            margin_end: 5,
            hexpand: true,
            halign: Gtk.Align.FILL,
        });
        this.set_child(vbox);
        this._createLayout(vbox);
        this.add_controller(this.keyEventController);
        this.set_size_request(500, 250);
    }

    _createLayout(vbox) {
        let hotkeyKey = '';

        const modFrame = new Adw.PreferencesGroup();
        const modRow = new Adw.ActionRow({
            title: _('Choose Modifiers'),
        });

        const buttonBox = new Gtk.Box({
            hexpand: true,
            halign: Gtk.Align.END,
            spacing: 5,
        });
        modRow.add_suffix(buttonBox);
        const ctrlButton = new Gtk.ToggleButton({
            label: _('Ctrl'),
            valign: Gtk.Align.CENTER,
        });
        const superButton = new Gtk.ToggleButton({
            label: _('Super'),
            valign: Gtk.Align.CENTER,
        });
        const shiftButton = new Gtk.ToggleButton({
            label: _('Shift'),
            valign: Gtk.Align.CENTER,
        });
        const altButton = new Gtk.ToggleButton({
            label: _('Alt'),
            valign: Gtk.Align.CENTER,
        });
        ctrlButton.connect('toggled', () => {
            this.resultsText = '';
            if (ctrlButton.get_active())
                this.resultsText += '<Ctrl>';
            if (superButton.get_active())
                this.resultsText += '<Super>';
            if (shiftButton.get_active())
                this.resultsText += '<Shift>';
            if (altButton.get_active())
                this.resultsText += '<Alt>';
            this.resultsText += hotkeyKey;
            resultsWidget.accelerator =  this.resultsText;
            applyButton.set_sensitive(true);
        });
        superButton.connect('toggled', () => {
            this.resultsText = '';
            if (ctrlButton.get_active())
                this.resultsText += '<Ctrl>';
            if (superButton.get_active())
                this.resultsText += '<Super>';
            if (shiftButton.get_active())
                this.resultsText += '<Shift>';
            if (altButton.get_active())
                this.resultsText += '<Alt>';
            this.resultsText += hotkeyKey;
            resultsWidget.accelerator =  this.resultsText;
            applyButton.set_sensitive(true);
        });
        shiftButton.connect('toggled', () => {
            this.resultsText = '';
            if (ctrlButton.get_active())
                this.resultsText += '<Ctrl>';
            if (superButton.get_active())
                this.resultsText += '<Super>';
            if (shiftButton.get_active())
                this.resultsText += '<Shift>';
            if (altButton.get_active())
                this.resultsText += '<Alt>';
            this.resultsText += hotkeyKey;
            resultsWidget.accelerator =  this.resultsText;
            applyButton.set_sensitive(true);
        });
        altButton.connect('toggled', () => {
            this.resultsText = '';
            if (ctrlButton.get_active())
                this.resultsText += '<Ctrl>';
            if (superButton.get_active())
                this.resultsText += '<Super>';
            if (shiftButton.get_active())
                this.resultsText += '<Shift>';
            if (altButton.get_active())
                this.resultsText += '<Alt>';
            this.resultsText += hotkeyKey;
            resultsWidget.accelerator =  this.resultsText;
            applyButton.set_sensitive(true);
        });
        buttonBox.append(ctrlButton);
        buttonBox.append(superButton);
        buttonBox.append(shiftButton);
        buttonBox.append(altButton);
        modFrame.add(modRow);
        vbox.append(modFrame);

        const keyFrame = new Adw.PreferencesGroup();
        const keyLabel = new Gtk.Label({
            label: _('Press any key'),
            use_markup: true,
            xalign: .5,
            hexpand: true,
            halign: Gtk.Align.CENTER,
        });
        vbox.append(keyLabel);

        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(`${Me.path}/media/icons/prefs_icons/keyboard-symbolic.svg`, 256, 72);
        const keyboardImage = Gtk.Picture.new_for_pixbuf(pixbuf);
        keyboardImage.hexpand = true;
        keyboardImage.vexpand = true;
        keyboardImage.halign = Gtk.Align.CENTER;
        keyboardImage.valign = Gtk.Align.CENTER;
        vbox.append(keyboardImage);

        const resultsRow = new Adw.ActionRow({
            title: _('New Hotkey'),
        });
        const resultsWidget = new Gtk.ShortcutsShortcut({
            hexpand: true,
            halign: Gtk.Align.END,
        });
        resultsRow.add_suffix(resultsWidget);
        keyFrame.add(resultsRow);

        const applyButton = new Gtk.Button({
            label: _('Apply'),
            halign: Gtk.Align.END,
            css_classes: ['suggested-action'],
        });
        applyButton.connect('clicked', () => {
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        applyButton.set_sensitive(false);

        this.keyEventController.connect('key-released', (controller, keyval) =>  {
            this.resultsText = '';
            const key = keyval;
            hotkeyKey = Gtk.accelerator_name(key, 0);
            if (ctrlButton.get_active())
                this.resultsText += '<Ctrl>';
            if (superButton.get_active())
                this.resultsText += '<Super>';
            if (shiftButton.get_active())
                this.resultsText += '<Shift>';
            if (altButton.get_active())
                this.resultsText += '<Alt>';
            this.resultsText += Gtk.accelerator_name(key, 0);
            resultsWidget.accelerator =  this.resultsText;
            applyButton.set_sensitive(true);
        });

        vbox.append(keyFrame);
        vbox.append(applyButton);
    }
});
