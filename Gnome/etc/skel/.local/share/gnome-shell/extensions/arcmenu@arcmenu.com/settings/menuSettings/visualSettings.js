import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import {SubPage} from './subPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function createSpinButton(lower, upper, value, stepIncrement = 1, pageIncrement = 1, climbRate = 1) {
    return new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower, upper, step_increment: stepIncrement, page_increment: pageIncrement, page_size: 0,
        }),
        climb_rate: climbRate,
        digits: 0,
        numeric: true,
        valign: Gtk.Align.CENTER,
        value,
    });
}

export const VisualSettingsPage = GObject.registerClass(
class ArcMenuVisualSettingsPage extends SubPage {
    _init(extension, settings, params) {
        super._init(extension, settings, params);

        const menuSizeFrame = new Adw.PreferencesGroup({
            title: _('Menu Size'),
        });
        this.add(menuSizeFrame);

        const heightSpinButton = createSpinButton(300, 4320, this._settings.get_int('menu-height'), 25, 50, 25);
        heightSpinButton.connect('value-changed', widget => {
            this._settings.set_int('menu-height', widget.get_value());
        });
        const heightRow = new Adw.ActionRow({
            title: _('Height'),
            activatable_widget: heightSpinButton,
        });
        heightRow.add_suffix(heightSpinButton);
        menuSizeFrame.add(heightRow);

        const menuWidthSpinButton = createSpinButton(175, 2500, this._settings.get_int('left-panel-width'), 25, 50, 25);
        menuWidthSpinButton.connect('value-changed', widget => {
            this._settings.set_int('left-panel-width', widget.get_value());
        });
        const menuWidthRow = new Adw.ActionRow({
            title: _('Left-Panel Width'),
            subtitle: _('Traditional Layouts'),
            activatable_widget: menuWidthSpinButton,
        });
        menuWidthRow.add_suffix(menuWidthSpinButton);
        menuSizeFrame.add(menuWidthRow);

        const rightPanelWidthSpinButton = createSpinButton(200, 2500, this._settings.get_int('right-panel-width'), 25, 50, 25);
        rightPanelWidthSpinButton.connect('value-changed', widget => {
            this._settings.set_int('right-panel-width', widget.get_value());
        });
        const rightPanelWidthRow = new Adw.ActionRow({
            title: _('Right-Panel Width'),
            subtitle: _('Traditional Layouts'),
            activatable_widget: rightPanelWidthSpinButton,
        });
        rightPanelWidthRow.add_suffix(rightPanelWidthSpinButton);
        menuSizeFrame.add(rightPanelWidthRow);

        const widthSpinButton = createSpinButton(-350, 5000, this._settings.get_int('menu-width-adjustment'), 25, 50, 25);
        widthSpinButton.connect('value-changed', widget => {
            this._settings.set_int('menu-width-adjustment', widget.get_value());
        });
        const widthRow = new Adw.ActionRow({
            title: _('Width Offset'),
            subtitle: _('Non-Traditional Layouts'),
            activatable_widget: widthSpinButton,
        });
        widthRow.add_suffix(widthSpinButton);
        menuSizeFrame.add(widthRow);

        const generalSettingsFrame = new Adw.PreferencesGroup({
            title: _('Menu Location'),
        });
        this.add(generalSettingsFrame);

        const menuLocations = new Gtk.StringList();
        menuLocations.append(_('Off'));
        menuLocations.append(_('Top Centered'));
        menuLocations.append(_('Top Left'));
        menuLocations.append(_('Top Right'));
        menuLocations.append(_('Bottom Centered'));
        menuLocations.append(_('Bottom Left'));
        menuLocations.append(_('Bottom Right'));
        menuLocations.append(_('Left Centered'));
        menuLocations.append(_('Right Centered'));
        menuLocations.append(_('Monitor Centered'));
        const menuLocationRow = new Adw.ComboRow({
            title: _('Override Menu Location'),
            model: menuLocations,
            selected: this._settings.get_enum('force-menu-location'),
        });
        menuLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum('force-menu-location', widget.selected);
        });
        generalSettingsFrame.add(menuLocationRow);

        const [menuArrowRiseEnabled, menuArrowRiseValue] = this._settings.get_value('menu-arrow-rise').deep_unpack();

        const menuArrowRiseSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        menuArrowRiseSwitch.connect('notify::active', widget => {
            const [oldEnabled_, oldValue] = this._settings.get_value('menu-arrow-rise').deep_unpack();
            this._settings.set_value('menu-arrow-rise', new GLib.Variant('(bi)', [widget.get_active(), oldValue]));
            if (widget.get_active())
                menuArrowRiseSpinButton.set_sensitive(true);
            else
                menuArrowRiseSpinButton.set_sensitive(false);
        });

        const menuArrowRiseSpinButton = createSpinButton(-50, 50, menuArrowRiseValue);
        menuArrowRiseSpinButton.sensitive = menuArrowRiseEnabled;
        menuArrowRiseSpinButton.connect('value-changed', widget => {
            const [oldEnabled, oldValue_] = this._settings.get_value('menu-arrow-rise').deep_unpack();
            this._settings.set_value('menu-arrow-rise', new GLib.Variant('(bi)', [oldEnabled, widget.get_value()]));
        });

        const menuArrowRiseRow = new Adw.ActionRow({
            title: _('Override Menu Rise'),
            subtitle: _('Menu Distance from Panel and Screen Edge'),
            activatable_widget: menuArrowRiseSwitch,
        });
        menuArrowRiseRow.add_suffix(menuArrowRiseSwitch);
        menuArrowRiseRow.add_suffix(new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10,
        }));
        menuArrowRiseRow.add_suffix(menuArrowRiseSpinButton);
        menuArrowRiseSwitch.set_active(menuArrowRiseEnabled);
        generalSettingsFrame.add(menuArrowRiseRow);

        const iconsSizeFrame = new Adw.PreferencesGroup({
            title: _('Override Menu Item Icon Sizes'),
        });
        this.add(iconsSizeFrame);

        const sizeEntries = [
            [_('Small'), Constants.GridIconSizes.SMALL],
            [_('Medium'), Constants.GridIconSizes.MEDIUM],
            [_('Large'), Constants.GridIconSizes.LARGE],
            [_('Extra Large'), Constants.GridIconSizes.XL],
            [_('Small Wide'), Constants.GridIconSizes.SMALL_RECT],
            [_('Medium Wide'), Constants.GridIconSizes.MEDIUM_RECT],
            [_('Large Wide'), Constants.GridIconSizes.LARGE_RECT],
        ];

        let isUpdating = false;
        const updateGridIconSetting = value => {
            if (isUpdating)
                return;

            isUpdating = true;

            const isDefault = value.width === Constants.GridIconSizes.DEFAULT.width &&
                value.height === Constants.GridIconSizes.DEFAULT.height &&
                value.size === Constants.GridIconSizes.DEFAULT.size;
            menuButton.visible = !isDefault;

            iconSizeGridWidth.value = value.width;
            iconSizeGridHeight.value = value.height;
            iconSizeGridIconSize.value = value.size;
            this._settings.set_value('icon-size-grid', new GLib.Variant('a{si}', value));
            isUpdating = false;
        };
        const iconSizeGrid = this._settings.get_value('icon-size-grid').deepUnpack();
        const isDefault = iconSizeGrid.width === Constants.GridIconSizes.DEFAULT.width &&
            iconSizeGrid.height === Constants.GridIconSizes.DEFAULT.height &&
            iconSizeGrid.size === Constants.GridIconSizes.DEFAULT.size;

        const gridIconsSizeRow = new Adw.ExpanderRow({
            title: _('Grid Menu Items'),
            subtitle: _('Menu items displayed in grid style'),
            use_markup: true,
            show_enable_switch: true,
            expanded: !isDefault,
            enable_expansion: !isDefault,
        });
        iconsSizeFrame.add(gridIconsSizeRow);
        gridIconsSizeRow.connect('notify::enable-expansion', widget => {
            const value = widget.enable_expansion ? Constants.GridIconSizes.MEDIUM : Constants.GridIconSizes.DEFAULT;
            updateGridIconSetting(value);
        });

        const popoverBox = new Gtk.ListBox();
        sizeEntries.forEach(([label, value]) => {
            const row = new Gtk.ListBoxRow({
                child: new Gtk.Label({
                    label,
                    halign: Gtk.Align.START,
                }),
            });
            row.iconSize = value;

            popoverBox.append(row);
        });
        popoverBox.connect('row-activated', (_widget, row) => {
            updateGridIconSetting(row.iconSize);
            popover.popdown();
        });

        const popover = new Gtk.Popover({
            child: popoverBox,
            has_arrow: false,
            css_classes: ['menu'],
        });
        popover.set_offset(0, 6);
        const menuButton = new Gtk.MenuButton({
            popover,
            label: _('Presets'),
            valign: Gtk.Align.CENTER,
            visible: !isDefault,
        });
        gridIconsSizeRow.add_suffix(menuButton);

        const iconSizeGridRow = new Adw.ActionRow({
            title: _('Grid Icon Size'),
            subtitle: _('Width, Height, Icon Size'),
        });
        gridIconsSizeRow.add_row(iconSizeGridRow);

        const iconSizeGridWidth = createSpinButton(60, 250, iconSizeGrid.width);
        iconSizeGridWidth.connect('value-changed', widget => {
            const current = this._settings.get_value('icon-size-grid').deepUnpack();
            updateGridIconSetting({
                width: widget.value,
                height: current.height,
                size: current.size,
            });
        });
        iconSizeGridRow.add_suffix(iconSizeGridWidth);

        const iconSizeGridHeight = createSpinButton(60, 250, iconSizeGrid.height);
        iconSizeGridHeight.connect('value-changed', widget => {
            const current = this._settings.get_value('icon-size-grid').deepUnpack();
            updateGridIconSetting({
                width: current.width,
                height: widget.value,
                size: current.size,
            });
        });
        iconSizeGridRow.add_suffix(iconSizeGridHeight);

        const iconSizeGridIconSize = createSpinButton(16, 96, iconSizeGrid.size);
        iconSizeGridIconSize.connect('value-changed', widget => {
            const current = this._settings.get_value('icon-size-grid').deepUnpack();
            updateGridIconSetting({
                width: current.width,
                height: current.height,
                size: widget.value,
            });
        });
        iconSizeGridRow.add_suffix(iconSizeGridIconSize);

        const menuItemIconSizeRow = this.createIconSizeRow({
            title: _('Applications'),
            subtitle: _('Applications, pinned apps, and search results'),
            setting: 'icon-size-apps',
        });
        iconsSizeFrame.add(menuItemIconSizeRow);

        const quickLinksIconSizeRow = this.createIconSizeRow({
            title: _('Shortcuts'),
            subtitle: _('Menu items found in side panels on various layouts'),
            setting: 'icon-size-shortcuts',
        });
        iconsSizeFrame.add(quickLinksIconSizeRow);

        const menuCategoryIconSizeRow = this.createIconSizeRow({
            title: _('Categories'),
            setting: 'icon-size-categories',
        });
        iconsSizeFrame.add(menuCategoryIconSizeRow);

        const buttonIconSizeRow = this.createIconSizeRow({
            title: _('Buttons'),
            setting: 'icon-size-buttons',
        });
        iconsSizeFrame.add(buttonIconSizeRow);

        const miscIconSizeRow = this.createIconSizeRow({
            title: _('Miscellaneous'),
            subtitle: _('Avatar, search icons, navigation icons'),
            setting: 'icon-size-misc',
        });
        iconsSizeFrame.add(miscIconSizeRow);

        this.restoreDefaults = () => {
            heightSpinButton.set_value(this._settings.get_default_value('menu-height').unpack());
            widthSpinButton.set_value(this._settings.get_default_value('menu-width-adjustment').unpack());
            menuWidthSpinButton.set_value(this._settings.get_default_value('left-panel-width').unpack());
            rightPanelWidthSpinButton.set_value(this._settings.get_default_value('right-panel-width').unpack());
            menuItemIconSizeRow.selected = 0;
            menuCategoryIconSizeRow.selected = 0;
            buttonIconSizeRow.selected = 0;
            quickLinksIconSizeRow.selected = 0;
            miscIconSizeRow.selected = 0;
            menuLocationRow.selected = 0;
            const [menuRiseEnabled_, menuRiseDefault] =
                this._settings.get_default_value('menu-arrow-rise').deep_unpack();
            menuArrowRiseSpinButton.set_value(menuRiseDefault);
            menuArrowRiseSwitch.set_active(false);
        };
    }

    createIconSizeRow(rowDetails) {
        const sizeEntries = [
            [_('Small'), Constants.IconSizes.SMALL],
            [_('Medium'), Constants.IconSizes.MEDIUM],
            [_('Large'), Constants.IconSizes.LARGE],
            [_('Extra Large'), Constants.IconSizes.XL],
        ];

        const currentValue = this._settings.get_int(rowDetails.setting);
        const showHideOption = rowDetails.setting === 'icon-size-categories';
        const isDefault = currentValue === Constants.IconSizes.DEFAULT;
        const isHidden = currentValue === Constants.IconSizes.HIDDEN;

        const expanderRow = new Adw.ExpanderRow({
            title: _(rowDetails.title),
            subtitle: rowDetails.subtitle ? _(rowDetails.subtitle) : null,
            use_markup: true,
            show_enable_switch: true,
            expanded: !isDefault,
            enable_expansion: !isDefault,
        });
        expanderRow.connect('notify::enable-expansion', widget => {
            const value = widget.enable_expansion ? Constants.IconSizes.MEDIUM : Constants.IconSizes.DEFAULT;
            updateSetting(value);
        });

        const popoverBox = new Gtk.ListBox();
        sizeEntries.forEach(([label, value]) => {
            const row = new Gtk.ListBoxRow({
                child: new Gtk.Label({
                    label,
                    halign: Gtk.Align.START,
                }),
            });
            row.iconSize = value;

            popoverBox.append(row);
        });
        popoverBox.connect('row-activated', (_widget, row) => {
            updateSetting(row.iconSize);
            popover.popdown();
        });

        const popover = new Gtk.Popover({
            child: popoverBox,
            has_arrow: false,
            css_classes: ['menu'],
        });
        popover.set_offset(0, 6);
        const menuButton = new Gtk.MenuButton({
            popover,
            label: _('Presets'),
            valign: Gtk.Align.CENTER,
            visible: !isDefault,
        });
        expanderRow.add_suffix(menuButton);

        const spinButton = createSpinButton(10, 64, currentValue);
        spinButton.connect('value-changed', widget => {
            updateSetting(widget.value);
        });

        const hiddenLabel = new Gtk.Label({
            label: _('Hidden'),
            visible: false,
        });
        const iconsSizeRow = new Adw.ActionRow({
            title: _('Icon Size'),
            activatable_widget: spinButton,
        });
        iconsSizeRow.add_suffix(spinButton);
        iconsSizeRow.add_suffix(hiddenLabel);
        expanderRow.add_row(iconsSizeRow);

        let hideIconRow = null;
        if (showHideOption) {
            hideIconRow = new Adw.SwitchRow({
                title: _('Hide Icon'),
                active: isHidden,
            });
            hideIconRow.connect('notify::active', widget => {
                const value = widget.active ? Constants.IconSizes.HIDDEN : Constants.IconSizes.MEDIUM;
                updateSetting(value);
            });
            expanderRow.add_row(hideIconRow);
        }

        let isUpdating = false;
        const updateSetting = value => {
            if (isUpdating)
                return;

            isUpdating = true;

            // eslint-disable-next-line no-shadow
            const isDefault = value === Constants.IconSizes.DEFAULT;
            // eslint-disable-next-line no-shadow
            const isHidden = value === Constants.IconSizes.HIDDEN;

            spinButton.visible = !isHidden;
            menuButton.visible = !isDefault;
            hiddenLabel.visible = isHidden;

            if (hideIconRow)
                hideIconRow.active = isHidden;

            if (!isDefault && !isHidden)
                spinButton.set_value(value);

            this._settings.set_int(rowDetails.setting, value);
            isUpdating = false;
        };

        updateSetting(currentValue);

        return expanderRow;
    }
});
