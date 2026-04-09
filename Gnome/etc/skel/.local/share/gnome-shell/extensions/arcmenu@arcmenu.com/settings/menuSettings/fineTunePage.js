import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {SubPage} from './subPage.js';
import * as SettingsUtils from '../settingsUtils.js';
import * as PW from '../../prefsWidgets.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const FineTunePage = GObject.registerClass(
class ArcMenuFineTunePage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        // Store settings used on this page to reset to default values.
        const settingsData = [];

        const createSwitchRow = (key, title, subtitle = null) => {
            const row = new PW.SwitchRow(this._settings, {setting_name: key, title, subtitle});
            settingsData.push({key});
            return row;
        };

        const miscGroup = new Adw.PreferencesGroup();
        this.add(miscGroup);

        const subMenusRow = createSwitchRow('show-category-sub-menus', _('Show Category Sub Menus'));
        miscGroup.add(subMenusRow);

        const appDescriptionsRow = createSwitchRow('apps-show-extra-details', _('Show Application Descriptions'));
        miscGroup.add(appDescriptionsRow);

        const genericNamesRow = createSwitchRow('apps-show-generic-names', _('Show Generic Application Names'));
        miscGroup.add(genericNamesRow);

        const hiddenFilesRow = createSwitchRow('show-hidden-recent-files', _('Show Hidden Recent Files'));
        miscGroup.add(hiddenFilesRow);

        const multiLinedLabelRow = createSwitchRow('multi-lined-labels',
            _('Show Multi Lined Labels'), _('Allow application labels to span multiple lines on grid style layouts'));
        miscGroup.add(multiLinedLabelRow);

        const tooltipRow = createSwitchRow('show-tooltips', _('Show Tooltips'));
        miscGroup.add(tooltipRow);

        const alphabeticalGroupingListRow = createSwitchRow('group-apps-alphabetically-list-layouts',
            _('Group Apps Alphabetically on List Views'), _('For All Apps sections'));
        miscGroup.add(alphabeticalGroupingListRow);

        const alphabeticalGroupingGridRow = createSwitchRow('group-apps-alphabetically-grid-layouts',
            _('Group Apps Alphabetically on Grid Views'), _('For All Apps sections'));
        miscGroup.add(alphabeticalGroupingGridRow);

        const activateOnLaunchRow = createSwitchRow('activate-on-launch', _('Activate App Window on Launch'),
            _('Launching an app activates its existing window if one is open; otherwise, it launches a new instance. Hold Ctrl while launching or middle-click to open a new window.'));
        miscGroup.add(activateOnLaunchRow);

        const scrollviewGroup = new Adw.PreferencesGroup({
            title: _('Scrollview Options'),
        });
        this.add(scrollviewGroup);

        const fadeEffectRow = createSwitchRow('scrollview-fade-effect', _('Scrollview Fade Effects'));
        scrollviewGroup.add(fadeEffectRow);

        settingsData.push({key: 'scrollbars-visible'});
        const showScrollbarsExpanderRow = new Adw.ExpanderRow({
            title: _('Show Scrollbars'),
            show_enable_switch: true,
            expanded: this._settings.get_boolean('scrollbars-visible'),
        });
        scrollviewGroup.add(showScrollbarsExpanderRow);
        this._settings.bind('scrollbars-visible', showScrollbarsExpanderRow, 'enable_expansion', Gio.SettingsBindFlags.DEFAULT);

        const overlayScrollbarsRow = createSwitchRow('scrollbars-overlay', _('Overlay Scrollbars'));
        showScrollbarsExpanderRow.add_row(overlayScrollbarsRow);

        const iconStyleGroup = new Adw.PreferencesGroup({
            title: _('Icon Style'),
        });
        this.add(iconStyleGroup);

        const iconTypes = new Gtk.StringList();
        iconTypes.append(_('Full Color'));
        iconTypes.append(_('Symbolic'));
        const categoryIconTypeRow = new Adw.ComboRow({
            title: _('Category Icon Type'),
            subtitle: _('Some icon themes may not include selected icon type'),
            model: iconTypes,
            selected: this._settings.get_enum('category-icon-type'),
        });
        categoryIconTypeRow.connect('notify::selected', widget => {
            this._settings.set_enum('category-icon-type', widget.selected);
        });
        iconStyleGroup.add(categoryIconTypeRow);

        settingsData.push({
            key: 'category-icon-type',
            widget: categoryIconTypeRow,
        });

        const shortcutsIconTypeRow = new Adw.ComboRow({
            title: _('Shortcuts Icon Type'),
            subtitle: _('Some icon themes may not include selected icon type'),
            model: iconTypes,
            selected: this._settings.get_enum('shortcut-icon-type'),
        });
        shortcutsIconTypeRow.connect('notify::selected', widget => {
            this._settings.set_enum('shortcut-icon-type', widget.selected);
        });
        iconStyleGroup.add(shortcutsIconTypeRow);

        settingsData.push({
            key: 'shortcut-icon-type',
            widget: shortcutsIconTypeRow,
        });

        const recentAppsGroup = new Adw.PreferencesGroup({
            title: _('New Apps Tracker'),
        });
        this.add(recentAppsGroup);

        const recentAppsRow = createSwitchRow('show-recently-installed-apps', _('Enable'));
        recentAppsGroup.add(recentAppsRow);

        const clearRecentAppsButton = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            label: _('Clear All'),
            sensitive: this._settings.get_strv('recently-installed-apps').length > 0,
        });
        clearRecentAppsButton.connect('clicked', () => {
            clearRecentAppsButton.set_sensitive(false);
            this._settings.reset('recently-installed-apps');
        });
        recentAppsRow.add_suffix(clearRecentAppsButton);

        this.restoreDefaults = () => {
            settingsData.forEach(data => {
                SettingsUtils.resetSetting(this._settings, data.key, data.widget);
            });
        };
    }
});
