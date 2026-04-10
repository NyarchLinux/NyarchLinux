import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../constants.js';
import {IconChooserDialog} from './iconChooserDialog.js';
import * as SettingsUtils from './settingsUtils.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const MenuButtonPage = GObject.registerClass(
class ArcMenuMenuButtonPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('Menu Button'),
            icon_name: 'icon-arcmenu-logo-symbolic',
            name: 'MenuButtonPage',
        });
        this._settings = settings;

        const restoreDefaultsButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            vexpand: false,
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Reset settings'),
            css_classes: ['flat'],
            halign: Gtk.Align.END,
            hexpand: true,
        });
        restoreDefaultsButton.connect('clicked', () => {
            const pageName = this.title;
            const dialog = new Gtk.MessageDialog({
                text: `<b>${_('Reset all %s settings?').format(pageName)}</b>`,
                secondary_text: _('All %s settings will be reset to the default value.').format(pageName),
                use_markup: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true,
            });
            dialog.connect('response', (widget, response) => {
                if (response === Gtk.ResponseType.YES)
                    this.restoreDefaults();
                dialog.destroy();
            });
            dialog.show();
        });

        const menuButtonAppearanceFrame = new Adw.PreferencesGroup({
            title: _('Appearance'),
            header_suffix: restoreDefaultsButton,
        });

        const menuButtonAppearances = new Gtk.StringList();
        menuButtonAppearances.append(_('Icon'));
        menuButtonAppearances.append(_('Text'));
        menuButtonAppearances.append(_('Icon and Text'));
        menuButtonAppearances.append(_('Text and Icon'));
        menuButtonAppearances.append(_('Hidden'));
        const menuButtonAppearanceRow = new Adw.ComboRow({
            title: _('Display Style'),
            model: menuButtonAppearances,
            selected: Gtk.INVALID_LIST_POSITION,
        });
        menuButtonAppearanceRow.connect('notify::selected', widget => {
            if (widget.selected === Constants.MenuButtonAppearance.NONE) {
                menuButtonOffsetRow.hide();
                menuButtonPaddingRow.hide();
                menuButtonCustomTextBoxRow.hide();
            } else if (widget.selected === Constants.MenuButtonAppearance.ICON) {
                menuButtonPaddingRow.show();
                menuButtonCustomTextBoxRow.hide();
                menuButtonOffsetRow.show();
            } else {
                menuButtonPaddingRow.show();
                menuButtonOffsetRow.show();
                menuButtonCustomTextBoxRow.show();
            }
            this._settings.set_enum('menu-button-appearance', widget.selected);
        });

        const paddingScale = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: -1,
                upper: 25,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        paddingScale.set_value(this._settings.get_int('menu-button-padding'));
        paddingScale.connect('value-changed', () => {
            this._settings.set_int('menu-button-padding', paddingScale.get_value());
        });
        const menuButtonPaddingRow = new Adw.ActionRow({
            title: _('Padding'),
            subtitle: _('%d Default Theme Value').format(-1),
            activatable_widget: paddingScale,
        });
        menuButtonPaddingRow.add_suffix(paddingScale);

        // /// Row for menu button offset /////
        const offsetScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 10, // arbitrary value
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        offsetScale.set_value(this._settings.get_int('menu-button-position-offset'));
        offsetScale.connect('value-changed', () => {
            this._settings.set_int('menu-button-position-offset', offsetScale.get_value());
        });
        const menuButtonOffsetRow = new Adw.ActionRow({
            title: _('Position in Panel'),
            activatable_widget: offsetScale,
        });
        menuButtonOffsetRow.add_suffix(offsetScale);
        // //////////////////

        const menuButtonCustomTextEntry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL,
        });
        menuButtonCustomTextEntry.set_text(this._settings.get_string('menu-button-text'));
        menuButtonCustomTextEntry.connect('changed', widget => {
            const customMenuButtonText = widget.get_text();
            this._settings.set_string('menu-button-text', customMenuButtonText);
        });
        const menuButtonCustomTextBoxRow = new Adw.ActionRow({
            title: _('Text'),
            activatable_widget: menuButtonCustomTextEntry,
            visible: false,
        });
        menuButtonCustomTextBoxRow.add_suffix(menuButtonCustomTextEntry);

        menuButtonAppearanceFrame.add(menuButtonAppearanceRow);
        menuButtonAppearanceFrame.add(menuButtonCustomTextBoxRow);
        menuButtonAppearanceFrame.add(menuButtonPaddingRow);
        menuButtonAppearanceFrame.add(menuButtonOffsetRow);
        this.add(menuButtonAppearanceFrame);

        const menuButtonIconFrame = new Adw.PreferencesGroup({
            title: _('Icon'),
        });
        const menuButtonIconButton = new Gtk.Button({
            label: _('Browse...'),
            valign: Gtk.Align.CENTER,
        });
        menuButtonIconButton.connect('clicked', () => {
            const dialog = new IconChooserDialog(this._settings, this);
            dialog.show();
            dialog.connect('response', (_self, response) => {
                if (response === Gtk.ResponseType.APPLY)
                    this._settings.set_string('menu-button-icon', dialog.iconString);

                dialog.destroy();
            });
        });
        const menuButtonIconRow = new Adw.ActionRow({
            title: _('Choose a New Icon'),
            activatable_widget: menuButtonIconButton,
        });
        menuButtonIconRow.add_suffix(menuButtonIconButton);
        menuButtonIconFrame.add(menuButtonIconRow);

        const menuButtonIconSizeScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 14,
                upper: 64,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        menuButtonIconSizeScale.set_value(this._settings.get_int('menu-button-icon-size'));
        menuButtonIconSizeScale.connect('value-changed', () => {
            this._settings.set_int('menu-button-icon-size', menuButtonIconSizeScale.get_value());
        });
        const menuButtonIconSizeRow = new Adw.ActionRow({
            title: _('Icon Size'),
            activatable_widget: menuButtonIconSizeScale,
        });
        menuButtonIconSizeRow.add_suffix(menuButtonIconSizeScale);
        menuButtonIconFrame.add(menuButtonIconSizeRow);

        menuButtonAppearanceRow.selected = this._settings.get_enum('menu-button-appearance');

        this.add(menuButtonIconFrame);

        // Click Options -----------

        const clickOptionsGroup = new Adw.PreferencesGroup({
            title: _('Click Options'),
        });
        this.add(clickOptionsGroup);

        const clickOptionsList = new Gtk.StringList();
        clickOptionsList.append(_('ArcMenu'));
        clickOptionsList.append(_('Context Menu'));
        clickOptionsList.append(_('None'));

        const leftClickRow = new Adw.ComboRow({
            title: _('Left Click'),
            model: clickOptionsList,
            selected: this._settings.get_enum('menu-button-left-click-action'),
        });
        leftClickRow.connect('notify::selected', widget => {
            this._settings.set_enum('menu-button-left-click-action', widget.selected);
        });
        clickOptionsGroup.add(leftClickRow);

        const rightClickRow = new Adw.ComboRow({
            title: _('Right Click'),
            model: clickOptionsList,
            selected: this._settings.get_enum('menu-button-right-click-action'),
        });
        rightClickRow.connect('notify::selected', widget => {
            this._settings.set_enum('menu-button-right-click-action', widget.selected);
        });
        clickOptionsGroup.add(rightClickRow);

        const middleClickRow = new Adw.ComboRow({
            title: _('Middle Click'),
            model: clickOptionsList,
            selected: this._settings.get_enum('menu-button-middle-click-action'),
        });
        middleClickRow.connect('notify::selected', widget => {
            this._settings.set_enum('menu-button-middle-click-action', widget.selected);
        });
        clickOptionsGroup.add(middleClickRow);

        // -----------

        const stylingGroup = new Adw.PreferencesGroup({
            title: _('Styling'),
            description: _('Results may vary with third party themes'),
        });
        this.add(stylingGroup);

        const buttonFGColorRow = this._createButtonColorRow(_('Foreground Color'), 'menu-button-fg-color');
        stylingGroup.add(buttonFGColorRow);

        const buttonBGColorRow = this._createButtonColorRow(_('Background Color'), 'menu-button-bg-color');
        stylingGroup.add(buttonBGColorRow);

        const buttonHoverBGColorRow = this._createButtonColorRow(`${_('Hover')} ${_('Background Color')}`, 'menu-button-hover-bg-color');
        stylingGroup.add(buttonHoverBGColorRow);

        const buttonHoverFGColorRow = this._createButtonColorRow(`${_('Hover')} ${_('Foreground Color')}`, 'menu-button-hover-fg-color');
        stylingGroup.add(buttonHoverFGColorRow);

        const buttonActiveBGColorRow = this._createButtonColorRow(`${_('Active')} ${_('Background Color')}`, 'menu-button-active-bg-color');
        stylingGroup.add(buttonActiveBGColorRow);

        const buttonActiveFGColorRow = this._createButtonColorRow(`${_('Active')} ${_('Foreground Color')}`, 'menu-button-active-fg-color');
        stylingGroup.add(buttonActiveFGColorRow);

        const buttonBorderRadiusRow = this._createSpinButtonToggleRow(_('Border Radius'),
            'menu-button-border-radius', 0, 25);
        stylingGroup.add(buttonBorderRadiusRow);

        const buttonBorderWidthRow = this._createSpinButtonToggleRow(_('Border Width'),
            'menu-button-border-width', 0, 5, _('Background colors required if set to 0'));
        stylingGroup.add(buttonBorderWidthRow);

        const buttonBorderColorRow = this._createButtonColorRow(_('Border Color'), 'menu-button-border-color');
        stylingGroup.add(buttonBorderColorRow);

        this.restoreDefaults = () => {
            menuButtonAppearanceRow.selected = 0;
            menuButtonCustomTextEntry.set_text('Apps');
            paddingScale.set_value(-1);
            menuButtonIconSizeScale.set_value(20);
            offsetScale.set_value(0);

            buttonFGColorRow.restoreDefaults();
            buttonHoverBGColorRow.restoreDefaults();
            buttonHoverFGColorRow.restoreDefaults();
            buttonActiveBGColorRow.restoreDefaults();
            buttonActiveFGColorRow.restoreDefaults();
            buttonBorderRadiusRow.restoreDefaults();
            buttonBorderWidthRow.restoreDefaults();
            buttonBorderColorRow.restoreDefaults();

            this._settings.reset('menu-button-icon');
            this._settings.reset('menu-button-position-offset');
            this._settings.reset('menu-button-fg-color');
            this._settings.reset('menu-button-bg-color');
            this._settings.reset('menu-button-hover-bg-color');
            this._settings.reset('menu-button-hover-fg-color');
            this._settings.reset('menu-button-active-bg-color');
            this._settings.reset('menu-button-active-fg-color');
            this._settings.reset('menu-button-border-radius');
            this._settings.reset('menu-button-border-width');
            this._settings.reset('menu-button-border-color');
        };
    }

    _createSpinButtonToggleRow(title, setting, lower, upper, subtitle = '') {
        const [enabled, value] = this._settings.get_value(setting).deep_unpack();

        const enabledSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        enabledSwitch.connect('notify::active', widget => {
            const [oldEnabled_, oldValue] = this._settings.get_value(setting).deep_unpack();
            this._settings.set_value(setting, new GLib.Variant('(bi)', [widget.get_active(), oldValue]));
            if (widget.get_active())
                spinButton.set_sensitive(true);
            else
                spinButton.set_sensitive(false);
        });
        const spinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower,
                upper,
                step_increment: 1,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
            value,
            sensitive: enabled,
        });
        spinButton.connect('value-changed', widget => {
            const [oldEnabled, oldValue_] = this._settings.get_value(setting).deep_unpack();
            this._settings.set_value(setting, new GLib.Variant('(bi)', [oldEnabled, widget.get_value()]));
        });

        const spinRow = new Adw.ActionRow({
            title: _(title),
            subtitle: subtitle ? _(subtitle) : '',
            activatable_widget: enabledSwitch,
        });
        spinRow.add_suffix(enabledSwitch);
        spinRow.add_suffix(new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10,
        }));
        spinRow.add_suffix(spinButton);

        enabledSwitch.set_active(enabled);

        spinRow.restoreDefaults = () => {
            const [defaultEnabled, defaultValue] = this._settings.get_default_value(setting).deep_unpack();
            enabledSwitch.set_active(defaultEnabled);
            spinButton.value = defaultValue;
        };
        return spinRow;
    }

    _createButtonColorRow(title, setting) {
        const [enabled, color] = this._settings.get_value(setting).deep_unpack();

        const enabledSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        enabledSwitch.connect('notify::active', widget => {
            const [oldEnabled_, oldColor] = this._settings.get_value(setting).deep_unpack();
            this._settings.set_value(setting, new GLib.Variant('(bs)', [widget.get_active(), oldColor]));
            if (widget.get_active())
                colorButton.set_sensitive(true);
            else
                colorButton.set_sensitive(false);
        });

        const colorButton = new Gtk.ColorButton({
            use_alpha: true,
            valign: Gtk.Align.CENTER,
            rgba: SettingsUtils.parseRGBA(color),
            sensitive: enabled,
        });
        colorButton.connect('notify::rgba', widget => {
            const colorString = widget.get_rgba().to_string();
            const [oldEnabled, oldColor_] = this._settings.get_value(setting).deep_unpack();
            this._settings.set_value(setting, new GLib.Variant('(bs)', [oldEnabled, colorString]));
        });

        const colorRow = new Adw.ActionRow({
            title: _(title),
            activatable_widget: enabledSwitch,
        });
        colorRow.add_suffix(enabledSwitch);
        colorRow.add_suffix(new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10,
        }));
        colorRow.add_suffix(colorButton);

        enabledSwitch.set_active(enabled);

        colorRow.restoreDefaults = () => {
            const [defaultEnabled, defaultColor] = this._settings.get_default_value(setting).deep_unpack();
            enabledSwitch.set_active(defaultEnabled);
            colorButton.rgba = SettingsUtils.parseRGBA(defaultColor);
        };
        return colorRow;
    }
});
