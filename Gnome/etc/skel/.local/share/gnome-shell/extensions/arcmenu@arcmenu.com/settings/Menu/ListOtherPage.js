import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import * as PW from '../../prefsWidgets.js';
import {SubPage} from './SubPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const ListOtherPage = GObject.registerClass(
class ArcMenuListOtherPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.frameRows = [];

        if (this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS)
            this.settingString = 'power-options';
        else if (this.list_type === Constants.MenuSettingsListType.EXTRA_CATEGORIES)
            this.settingString = 'extra-categories';
        else if (this.list_type === Constants.MenuSettingsListType.QUICK_LINKS)
            this.settingString = 'arcmenu-extra-categories-links';

        this._mainGroup = new Adw.PreferencesGroup();
        this.add(this._mainGroup);

        this._addRowsToFrame(this._settings.get_value(this.settingString).deep_unpack());

        if (this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS) {
            this._mainGroup.set({
                description: _('Actions will be hidden from ArcMenu if not available on your system.'),
            });

            const powerDisplayStyleGroup = new Adw.PreferencesGroup({
                title: _('Power Off / Log Out Buttons'),
            });
            const powerDisplayStyles = new Gtk.StringList();
            powerDisplayStyles.append(_('Off'));
            powerDisplayStyles.append(_('Power Buttons'));
            powerDisplayStyles.append(_('Power Menu'));
            this.powerDisplayStyleRow = new Adw.ComboRow({
                title: _('Override Display Style'),
                model: powerDisplayStyles,
                selected: this._settings.get_enum('power-display-style'),
            });
            this.powerDisplayStyleRow.connect('notify::selected', widget => {
                this._settings.set_enum('power-display-style', widget.selected);
            });
            powerDisplayStyleGroup.add(this.powerDisplayStyleRow);

            this.add(powerDisplayStyleGroup);
        }

        this.restoreDefaults = () => {
            this.frameRows.forEach(child => {
                this._mainGroup.remove(child);
            });
            this.frameRows = [];

            if (this.powerDisplayStyleRow)
                this.powerDisplayStyleRow.selected = 0;

            this._addRowsToFrame(this._settings.get_default_value(this.settingString).deep_unpack());
            this.saveSettings();
        };
    }

    saveSettings() {
        const array = [];
        this.frameRows.sort((a, b) => {
            return a.get_index() - b.get_index();
        });
        this.frameRows.forEach(child => {
            array.push([child.setting_type, child.switch_active]);
        });

        this._settings.set_value(this.settingString, new GLib.Variant('a(ib)', array));
    }

    _addRowsToFrame(extraCategories) {
        for (let i = 0; i < extraCategories.length; i++) {
            const [categoryEnum, shouldShow] = extraCategories[i];

            let name, iconString;
            if (this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS) {
                name = Constants.PowerOptions[categoryEnum].NAME;
                iconString = Constants.PowerOptions[categoryEnum].ICON;
            } else {
                name = Constants.Categories[categoryEnum].NAME;
                iconString = Constants.Categories[categoryEnum].ICON;
            }

            const row = new PW.DragRow({
                gicon: Gio.icon_new_for_string(iconString),
                switch_enabled: true,
                switch_active: shouldShow,
            });
            row.activatable_widget = row.switch;
            row.setting_type = categoryEnum;
            row.title = _(name);

            row.connect('drag-drop-done', () => this.saveSettings());
            row.connect('switch-toggled', () => this.saveSettings());

            const editEntryButton = new PW.EditEntriesBox({row});
            editEntryButton.connect('entry-modified', (_self, startIndex, newIndex) => {
                const splicedItem = this.frameRows.splice(startIndex, 1)[0];

                if (newIndex >= 0)
                    this.frameRows.splice(newIndex, 0, splicedItem);

                this.saveSettings();
            });

            row.add_suffix(editEntryButton);
            this.frameRows.push(row);
            this._mainGroup.add(row);
        }
    }
});
