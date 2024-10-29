import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

import * as Constants from '../constants.js';
import * as PW from '../prefsWidgets.js';
import * as SettingsUtils from './SettingsUtils.js';

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
        paddingScale.set_value(this._settings.get_int('button-padding'));
        paddingScale.connect('value-changed', () => {
            this._settings.set_int('button-padding', paddingScale.get_value());
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
        menuButtonCustomTextEntry.set_text(this._settings.get_string('custom-menu-button-text'));
        menuButtonCustomTextEntry.connect('changed', widget => {
            const customMenuButtonText = widget.get_text();
            this._settings.set_string('custom-menu-button-text', customMenuButtonText);
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
            const dialog = new ArcMenuIconsDialogWindow(this._settings, this);
            dialog.show();
            dialog.connect('response', () => {
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
        menuButtonIconSizeScale.set_value(this._settings.get_double('custom-menu-button-icon-size'));
        menuButtonIconSizeScale.connect('value-changed', () => {
            this._settings.set_double('custom-menu-button-icon-size', menuButtonIconSizeScale.get_value());
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
            this._settings.reset('arc-menu-icon');
            this._settings.reset('distro-icon');
            this._settings.reset('custom-menu-button-icon');
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

var ArcMenuIconsDialogWindow = GObject.registerClass(
class ArcMenuArcMenuIcons extends PW.DialogWindow {
    _init(settings, parent) {
        this._settings = settings;
        super._init(_('Menu Button Icons'), parent);
        this.set_default_size(475, 475);
        this.search_enabled = false;

        this.page.title = _('Icons');
        this.page.icon_name = 'icon-arcmenu-logo-symbolic';

        this._arcMenuIconsFlowBox = new PW.IconGrid(2);
        this._arcMenuIconsFlowBox.connect('child-activated', (_self, child) => {
            this._distroIconsFlowBox.unselect_all();
            this._customIconFlowBox.unselect_all();

            const selectedChildIndex = child.get_index();
            this._settings.set_enum('menu-button-icon', Constants.MenuIconType.MENU_ICON);
            this._settings.set_int('arc-menu-icon', selectedChildIndex);
        });
        this.pageGroup.add(this._arcMenuIconsFlowBox);

        Constants.MenuIcons.forEach(icon => {
            const iconTile = new PW.MenuButtonIconTile(icon.PATH);
            this._arcMenuIconsFlowBox.add(iconTile);
        });

        this.distroIconsPage = new Adw.PreferencesPage({
            title: _('Distros'),
            icon_name: 'distro-gnome-symbolic',
        });
        this.add(this.distroIconsPage);

        const distroInfoButton = new Gtk.Button({
            label: _('Legal Disclaimer'),
            css_classes: ['flat', 'accent'],
            margin_bottom: 8,
            halign: Gtk.Align.CENTER,
        });
        distroInfoButton.connect('clicked', () => {
            const dialog = new DistroIconsDisclaimerWindow(this._settings, this);
            dialog.connect('response', () => dialog.destroy());
            dialog.show();
        });

        const distroIconsGroup = new Adw.PreferencesGroup();
        distroIconsGroup.add(distroInfoButton);
        this.distroIconsPage.add(distroIconsGroup);

        this._distroIconsFlowBox = new PW.IconGrid(2);
        this._distroIconsFlowBox.connect('child-activated', (_self, child) => {
            this._arcMenuIconsFlowBox.unselect_all();
            this._customIconFlowBox.unselect_all();

            const selectedChildIndex = child.get_index();
            this._settings.set_enum('menu-button-icon', Constants.MenuIconType.DISTRO_ICON);
            this._settings.set_int('distro-icon', selectedChildIndex);
        });

        Constants.DistroIcons.forEach(icon => {
            const iconTile = new PW.MenuButtonIconTile(icon.PATH, icon.NAME);
            this._distroIconsFlowBox.add(iconTile);
        });
        distroIconsGroup.add(this._distroIconsFlowBox);

        this.customIconPage = new Adw.PreferencesPage({
            title: _('Custom'),
            icon_name: 'settings-customicon-symbolic',
        });
        this.add(this.customIconPage);

        const customIconGroup = new Adw.PreferencesGroup();
        this.customIconPage.add(customIconGroup);

        this._customIconFlowBox = new PW.IconGrid(2);
        this._customIconFlowBox.set({
            vexpand: false,
            homogeneous: false,
        });
        customIconGroup.add(this._customIconFlowBox);

        this._customIconFlowBox.connect('child-activated', () => {
            this._arcMenuIconsFlowBox.unselect_all();
            this._distroIconsFlowBox.unselect_all();

            const customIconPath = this._settings.get_string('custom-menu-button-icon');
            this._settings.set_string('custom-menu-button-icon', customIconPath);
            this._settings.set_enum('menu-button-icon', Constants.MenuIconType.CUSTOM);
        });

        const customIconTile = new PW.MenuButtonIconTile(this._settings.get_string('custom-menu-button-icon'));
        this._customIconFlowBox.add(customIconTile);

        const fileChooserFrame = new Adw.PreferencesGroup();
        this.customIconPage.add(fileChooserFrame);

        const fileFilter = new Gtk.FileFilter();
        fileFilter.add_pixbuf_formats();

        const fileChooserButton = new Gtk.Button({
            label: _('Browse Files...'),
            valign: Gtk.Align.CENTER,
        });
        fileChooserButton.connect('clicked', () => {
            const dialog = new Gtk.FileChooserDialog({
                title: _('Select an Image File'),
                transient_for: this.get_root(),
                modal: true,
                action: Gtk.FileChooserAction.OPEN,
                filter: fileFilter,
            });

            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);

            dialog.connect('response', (_self, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    this._arcMenuIconsFlowBox.unselect_all();
                    this._distroIconsFlowBox.unselect_all();

                    const iconPath = dialog.get_file().get_path();
                    customIconTile.setIcon(iconPath);
                    this._settings.set_string('custom-menu-button-icon', iconPath);
                    this._settings.set_enum('menu-button-icon', Constants.MenuIconType.CUSTOM);
                    this._customIconFlowBox.select_child(this._customIconFlowBox.get_child_at_index(0));
                }

                dialog.destroy();
            });
            dialog.show();
        });
        const iconChooserButton = new Gtk.Button({
            label: _('Browse Icons...'),
            valign: Gtk.Align.CENTER,
        });
        iconChooserButton.connect('clicked', () => {
            const dialog = new IconChooserDialog(this._settings, this.get_root());
            dialog.connect('response', (_self, response) => {
                if (response === Gtk.ResponseType.APPLY) {
                    this._arcMenuIconsFlowBox.unselect_all();
                    this._distroIconsFlowBox.unselect_all();

                    const newIcon = dialog.iconString;
                    customIconTile.setIcon(newIcon);
                    this._settings.set_string('custom-menu-button-icon', newIcon);
                    this._settings.set_enum('menu-button-icon', Constants.MenuIconType.CUSTOM);
                    this._customIconFlowBox.select_child(this._customIconFlowBox.get_child_at_index(0));
                }

                dialog.destroy();
            });
            dialog.show();
        });
        const fileChooserRow = new Adw.ActionRow();
        fileChooserRow.add_prefix(fileChooserButton);
        fileChooserRow.add_suffix(iconChooserButton);
        fileChooserFrame.add(fileChooserRow);

        this.setVisiblePage();

        this.connect('notify::visible-page', () => this._selectActiveIcon());
        this._selectActiveIcon();
    }

    _selectActiveIcon() {
        this._arcMenuIconsFlowBox.unselect_all();
        this._distroIconsFlowBox.unselect_all();
        this._customIconFlowBox.unselect_all();
        const menuButtonIconType = this._settings.get_enum('menu-button-icon');
        if (menuButtonIconType === Constants.MenuIconType.MENU_ICON) {
            const index = this._settings.get_int('arc-menu-icon');
            const selectedChild = this._arcMenuIconsFlowBox.get_child_at_index(index);
            this._arcMenuIconsFlowBox.select_child(selectedChild);
        } else if (menuButtonIconType === Constants.MenuIconType.DISTRO_ICON) {
            const index = this._settings.get_int('distro-icon');
            const selectedChild = this._distroIconsFlowBox.get_child_at_index(index);
            this._distroIconsFlowBox.select_child(selectedChild);
        } else if (menuButtonIconType === Constants.MenuIconType.CUSTOM) {
            const selectedChild = this._customIconFlowBox.get_child_at_index(0);
            this._customIconFlowBox.select_child(selectedChild);
        }
    }

    setVisiblePage() {
        if (this._settings.get_enum('menu-button-icon') === Constants.MenuIconType.MENU_ICON)
            this.set_visible_page(this.page);
        else if (this._settings.get_enum('menu-button-icon') === Constants.MenuIconType.DISTRO_ICON)
            this.set_visible_page(this.distroIconsPage);
        else if (this._settings.get_enum('menu-button-icon') === Constants.MenuIconType.CUSTOM)
            this.set_visible_page(this.customIconPage);
    }
});

var IconChooserDialog = GObject.registerClass(
class ArcMenuIconChooserDialog extends PW.DialogWindow {
    _init(settings, parent) {
        this._settings = settings;
        super._init(_('Select an Icon'), parent);
        this.set_default_size(475, 475);
        this.search_enabled = false;
        this.iconString = '';

        this.page.title = _('System Icons');
        this.page.icon_name = 'go-home-symbolic';

        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: _('Search...'),
            search_delay: 250,
            margin_bottom: 12,
        });
        searchEntry.connect('search-changed', () => {
            const query = searchEntry.text.trim().toLowerCase();
            if (!query) {
                filter.set_filter_func(null);
                return;
            }
            filter.set_filter_func(item => {
                return item.string.toLowerCase().includes(query);
            });
        });
        this.pageGroup.add(searchEntry);

        const iconThemeDefault = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());

        const iconTheme = new Gtk.IconTheme({
            resource_path: iconThemeDefault.resource_path,
            theme_name: iconThemeDefault.theme_name,
        });
        const iconNames = iconTheme.get_icon_names();

        iconNames.sort((a, b) => a.localeCompare(b));

        const listStore = new Gtk.StringList({strings: iconNames});
        const filter = new Gtk.CustomFilter();
        const filterListModel = new Gtk.FilterListModel({
            model: listStore,
            filter,
        });

        const factory = new Gtk.SignalListItemFactory();
        const iconGridView = new Gtk.ListView({
            model: new Gtk.SingleSelection({model: filterListModel, autoselect: false, selected: -1}),
            factory,
            vexpand: true,
            valign: Gtk.Align.FILL,
        });

        const scrollWindow = new Gtk.ScrolledWindow({
            child: iconGridView,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });

        factory.connect('setup', (factory_, item) => {
            item.connect('notify::selected', () => {
                applyButton.sensitive = true;
            });
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 3,
                margin_bottom: 3,
                margin_start: 12,
                margin_end: 12,
            });

            const image = new Gtk.Image({
                pixel_size: 32,
                hexpand: false,
                halign: Gtk.Align.START,
            });
            box.image = image;

            const label = new Gtk.Label({
                hexpand: false,
                halign: Gtk.Align.START,
                wrap: true,
                wrap_mode: Pango.WrapMode.WORD_CHAR,
            });
            box.label = label;

            box.append(image);
            box.append(label);

            item.set_child(box);
        });
        factory.connect('bind', (factory_, {child, item}) => {
            const iconName = item.string;
            child.image.icon_name = iconName;
            child.label.label = iconName;
        });

        this.pageGroup.add(scrollWindow);

        const applyButton = new Gtk.Button({
            label: _('Select'),
            sensitive: false,
            halign: Gtk.Align.END,
            valign: Gtk.Align.END,
            margin_top: 12,
            css_classes: ['suggested-action'],
        });
        applyButton.connect('clicked', () => {
            this.iconString = iconGridView.model.get_selected_item().string;
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        this.pageGroup.add(applyButton);
    }
});

var DistroIconsDisclaimerWindow = GObject.registerClass(
class ArcMenuDistroIconsDisclaimerWindow extends Gtk.MessageDialog {
    _init(settings, parent) {
        this._settings = settings;
        super._init({
            text: `<b>${_('Legal Disclaimer for Distro Icons')}</b>`,
            use_markup: true,
            message_type: Gtk.MessageType.OTHER,
            transient_for: parent.get_root(),
            modal: true,
            buttons: Gtk.ButtonsType.OK,
        });
        this.set_size_request(515, 470);

        const scrollWindow = new Gtk.ScrolledWindow();
        scrollWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.get_content_area().append(scrollWindow);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            vexpand: true,
            valign: Gtk.Align.FILL,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 16,
            margin_end: 16,
        });
        scrollWindow.set_child(box);

        const bodyLabel = new Gtk.Label({
            label: Constants.DistroIconsDisclaimer,
            use_markup: true,
            hexpand: false,
            halign: Gtk.Align.START,
            wrap: true,
        });
        box.append(bodyLabel);
    }
});
