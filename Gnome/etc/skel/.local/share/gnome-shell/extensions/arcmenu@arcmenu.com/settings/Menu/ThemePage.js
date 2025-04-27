import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as SettingsUtils from '../SettingsUtils.js';
import {SubPage} from './SubPage.js';
import {SaveThemeDialog, ManageThemesDialog} from './ThemingDialog.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const ThemePage = GObject.registerClass(
class ArcMenuThemePage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);
        this.restoreDefaultsButton.visible = false;

        const overrideThemeGroup = new Adw.PreferencesGroup();
        this.add(overrideThemeGroup);

        const overrideThemeSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        overrideThemeSwitch.connect('notify::active', widget => {
            if (widget.get_active()) {
                menuThemesGroup.show();
                menuGroup.show();
                menuItemsGroup.show();
            } else {
                menuThemesGroup.hide();
                menuGroup.hide();
                menuItemsGroup.hide();
            }
            this._settings.set_boolean('override-menu-theme', widget.get_active());
        });
        const overrideThemeRow = new Adw.ActionRow({
            title: _('Override Theme'),
            subtitle: _('Results may vary with third party themes'),
            activatable_widget: overrideThemeSwitch,
        });
        overrideThemeRow.add_suffix(overrideThemeSwitch);
        overrideThemeGroup.add(overrideThemeRow);

        const menuThemesGroup = new Adw.PreferencesGroup({
            title: _('Menu Themes'),
        });
        this.add(menuThemesGroup);

        // Theme Drop Down Section----------
        const themeList = new Gio.ListStore();
        this.createIconList(themeList);

        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', (factory_, listItem) => {
            const box = new Gtk.Grid({
                column_spacing: 8,
                valign: Gtk.Align.CENTER,
            });

            const image = new Gtk.Picture({
                content_fit: Gtk.ContentFit.SCALE_DOWN,
                valign: Gtk.Align.CENTER,
            });
            image.set_size_request(42, 14);
            const label = new Gtk.Label({
                valign: Gtk.Align.CENTER,
            });
            box.attach(image, 0, 0, 1, 1);
            box.attach(label, 1, 0, 1, 1);

            listItem.set_child(box);
        });

        factory.connect('bind', (factory_, listItem) => {
            const item = listItem.get_item();
            const box = listItem.get_child();
            const image = box.get_child_at(0, 0);
            const label = box.get_child_at(1, 0);

            const pixbuf = item.pixbuf;
            const texture = Gdk.Texture.new_for_pixbuf(pixbuf);

            label.set_label(item.name);
            image.set_paintable(texture);
        });

        const themeDropDown = new Gtk.DropDown({
            factory,
            model: themeList,
            valign: Gtk.Align.CENTER,
        });

        themeDropDown.connect('notify::selected-item', widget => {
            const index = widget.get_selected();
            if (index < 0 || index === Gtk.INVALID_LIST_POSITION)
                return;

            const menuThemes = this._settings.get_value('menu-themes').deep_unpack();

            menuBGColorRow.setColor(menuThemes[index][1]);
            menuFGColorRow.setColor(menuThemes[index][2]);
            menuBorderColorRow.setColor(menuThemes[index][3]);

            menuBorderWidthRow.setValue(menuThemes[index][4]);
            menuBorderRadiusRow.setValue(menuThemes[index][5]);
            menuFontSizeRow.setValue(menuThemes[index][6]);

            menuSeparatorColorRow.setColor(menuThemes[index][7]);
            itemHoverBGColorRow.setColor(menuThemes[index][8]);
            itemHoverFGColorRow.setColor(menuThemes[index][9]);
            itemActiveBGColorRow.setColor(menuThemes[index][10]);
            itemActiveFGColorRow.setColor(menuThemes[index][11]);

            this.checkIfThemeMatch();
        });
        const menuThemesRow = new Adw.ActionRow({
            title: _('Current Theme'),
            activatable_widget: themeDropDown,
        });
        menuThemesGroup.add(menuThemesRow);
        // ---------------------------------

        // Manage Themes Section------------
        const manageThemesButton = new Gtk.Button({
            icon_name: 'applications-system-symbolic',
            valign: Gtk.Align.CENTER,
        });
        manageThemesButton.connect('clicked', () => {
            const manageThemesDialog = new ManageThemesDialog(this._settings, this);
            manageThemesDialog.show();
            manageThemesDialog.connect('response', (_w, response) => {
                if (response === Gtk.ResponseType.APPLY) {
                    themeList.remove_all();
                    this.createIconList(themeList);
                    this.checkIfThemeMatch();
                }
            });
        });
        menuThemesRow.add_suffix(manageThemesButton);
        menuThemesRow.add_suffix(themeDropDown);
        // ---------------------------------

        // Save Theme Section---------------
        const menuThemeSaveButton = new Gtk.Button({
            label: _('Save as Theme'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        menuThemeSaveButton.connect('clicked', () => {
            const saveThemeDialog = new SaveThemeDialog(this._settings, this);
            saveThemeDialog.show();
            saveThemeDialog.connect('response', (_w, response) => {
                if (response === Gtk.ResponseType.APPLY) {
                    const menuThemes = this._settings.get_value('menu-themes').deep_unpack();
                    const currentSettingsArray = [saveThemeDialog.themeName, menuBGColorRow.getColor(),
                        menuFGColorRow.getColor(), menuBorderColorRow.getColor(),
                        menuBorderWidthRow.getValue().toString(), menuBorderRadiusRow.getValue().toString(),
                        menuFontSizeRow.getValue().toString(), menuSeparatorColorRow.getColor(),
                        itemHoverBGColorRow.getColor(), itemHoverFGColorRow.getColor(),
                        itemActiveBGColorRow.getColor(), itemActiveFGColorRow.getColor()];
                    menuThemes.push(currentSettingsArray);
                    this._settings.set_value('menu-themes', new GLib.Variant('aas', menuThemes));

                    themeList.remove_all();
                    this.createIconList(themeList);
                    this.checkIfThemeMatch();

                    saveThemeDialog.destroy();
                }
            });
        });
        // ---------------------------------

        const menuGroup = new Adw.PreferencesGroup({
            title: _('Menu Styling'),
            header_suffix: menuThemeSaveButton,
        });
        this.add(menuGroup);

        const menuBGColorRow = this._createColorRow(_('Background Color'), 'menu-background-color');
        menuGroup.add(menuBGColorRow);

        const menuFGColorRow = this._createColorRow(_('Foreground Color'), 'menu-foreground-color');
        menuGroup.add(menuFGColorRow);

        const menuBorderColorRow = this._createColorRow(_('Border Color'), 'menu-border-color');
        menuGroup.add(menuBorderColorRow);

        const menuBorderWidthRow = this._createSpinButtonRow(_('Border Width'), 'menu-border-width', 0, 5);
        menuGroup.add(menuBorderWidthRow);

        const menuBorderRadiusRow = this._createSpinButtonRow(_('Border Radius'), 'menu-border-radius', 0, 25);
        menuGroup.add(menuBorderRadiusRow);

        const menuFontSizeRow = this._createSpinButtonRow(_('Font Size'), 'menu-font-size', 8, 18);
        menuGroup.add(menuFontSizeRow);

        const menuSeparatorColorRow = this._createColorRow(_('Separator Color'), 'menu-separator-color');
        menuGroup.add(menuSeparatorColorRow);

        const menuItemsGroup = new Adw.PreferencesGroup({
            title: _('Menu Items Styling'),
        });
        this.add(menuItemsGroup);

        const itemHoverBGColorRow = this._createColorRow(`${_('Hover')} ${_('Background Color')}`, 'menu-item-hover-bg-color');
        menuItemsGroup.add(itemHoverBGColorRow);

        const itemHoverFGColorRow = this._createColorRow(`${_('Hover')} ${_('Foreground Color')}`, 'menu-item-hover-fg-color');
        menuItemsGroup.add(itemHoverFGColorRow);

        const itemActiveBGColorRow = this._createColorRow(`${_('Active')} ${_('Background Color')}`, 'menu-item-active-bg-color');
        menuItemsGroup.add(itemActiveBGColorRow);

        const itemActiveFGColorRow = this._createColorRow(`${_('Active')} ${_('Foreground Color')}`, 'menu-item-active-fg-color');
        menuItemsGroup.add(itemActiveFGColorRow);

        const overrideMenuTheme = this._settings.get_boolean('override-menu-theme');
        overrideThemeSwitch.set_active(overrideMenuTheme);
        if (!overrideMenuTheme) {
            menuThemesGroup.hide();
            menuGroup.hide();
            menuItemsGroup.hide();
        }

        this.checkIfThemeMatch = () => {
            const currentSettingsArray = ['', menuBGColorRow.getColor(), menuFGColorRow.getColor(),
                menuBorderColorRow.getColor(), menuBorderWidthRow.getValue().toString(),
                menuBorderRadiusRow.getValue().toString(), menuFontSizeRow.getValue().toString(),
                menuSeparatorColorRow.getColor(), itemHoverBGColorRow.getColor(), itemHoverFGColorRow.getColor(),
                itemActiveBGColorRow.getColor(), itemActiveFGColorRow.getColor()];

            const menuThemes = this._settings.get_value('menu-themes').deep_unpack();
            let index = 0;
            let matchFound = false;
            for (const theme of menuThemes) {
                for (let i = 1; i < currentSettingsArray.length - 1; i++) {
                    if (currentSettingsArray[i] !== theme[i]) {
                        matchFound = false;
                        break;
                    }
                    matchFound = true;
                }

                if (matchFound) {
                    themeDropDown.set_selected(index);
                    menuThemeSaveButton.set_sensitive(false);
                    break;
                }
                index++;
            }
            if (!matchFound) {
                menuThemeSaveButton.set_sensitive(true);
                themeDropDown.set_selected(Gtk.INVALID_LIST_POSITION);
            }
        };

        this.checkIfThemeMatch();
    }

    createIconList(store) {
        const menuThemes = this._settings.get_value('menu-themes').deep_unpack();
        for (const theme of menuThemes) {
            const pixbuf = SettingsUtils.createThemePreviewPixbuf(theme[1], theme[2], theme[3], theme[8]);

            const themeListItem = new ThemeListItem({
                name: theme[0],
            });
            themeListItem.pixbuf = pixbuf;

            store.append(themeListItem);
        }
    }

    _createColorRow(title, setting) {
        const colorButton = new Gtk.ColorButton({
            use_alpha: true,
            valign: Gtk.Align.CENTER,
            rgba: SettingsUtils.parseRGBA(this._settings.get_string(setting)),
        });
        colorButton.connect('notify::rgba', widget => {
            const colorString = widget.get_rgba().to_string();
            this._settings.set_string(setting, colorString);
            this.checkIfThemeMatch();
        });
        const colorRow = new Adw.ActionRow({
            title: _(title),
            activatable_widget: colorButton,
        });
        colorRow.add_suffix(colorButton);
        colorRow.setColor = color => {
            colorButton.set_rgba(SettingsUtils.parseRGBA(color));
        };
        colorRow.getColor = () => {
            return colorButton.get_rgba().to_string();
        };
        return colorRow;
    }

    _createSpinButtonRow(title, setting, lower, upper) {
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
            value: this._settings.get_int(setting),
        });
        spinButton.connect('notify::value', widget => {
            this.checkIfThemeMatch();
            this._settings.set_int(setting, widget.get_value());
        });

        const spinRow = new Adw.ActionRow({
            title: _(title),
            activatable_widget: spinButton,
        });
        spinRow.add_suffix(spinButton);
        spinRow.setValue = value => {
            spinButton.set_value(value);
        };
        spinRow.getValue = () => {
            return spinButton.get_value();
        };
        return spinRow;
    }
});

const ThemeListItem = GObject.registerClass({
    Properties: {
        'name': GObject.ParamSpec.string('name', 'Name', 'Name of the item', GObject.ParamFlags.READWRITE, ''),
    },
}, class Item extends GObject.Object {});
