import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../constants.js';
import * as PW from '../prefsWidgets.js';
import * as SettingsUtils from './settingsUtils.js';

import {FineTunePage} from './menuSettings/fineTunePage.js';
import {LayoutsPage} from './menuSettings/layoutsPage.js';
import {LayoutTweaksPage} from './menuSettings/layoutTweaksPage.js';
import {ListOtherPage} from './menuSettings/listOtherPage.js';
import {ListPinnedPage} from './menuSettings/listPinnedPage.js';
import {SearchOptionsPage} from './menuSettings/searchOptionsPage.js';
import {ThemePage} from './menuSettings/themePage.js';
import {VisualSettingsPage} from './menuSettings/visualSettings.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const MenuPage = GObject.registerClass(
class ArcMenuMenuPage extends Adw.PreferencesPage {
    _init(settings, window) {
        super._init({
            title: _('Menu'),
            icon_name: 'settings-settings-symbolic',
            name: 'MenuPage',
        });
        this._settings = settings;
        this._window = window;

        const menuLooksGroup = new Adw.PreferencesGroup({
            title: _('How should the menu look?'),
        });
        this.add(menuLooksGroup);

        const visibleRow = { };

        this.layoutRow = new PW.SettingRow({
            title: _('Menu Layout'),
            subtitle: _('Choose a layout style for the menu'),
            icon_name: 'settings-layouts-symbolic',
        });
        this._addSubPageToRow(this.layoutRow, {
            pageClass: LayoutsPage,
        });
        this.layoutRow.settingPage.connect('response', (_w, response) => {
            if (response === Gtk.ResponseType.APPLY) {
                const layoutName = SettingsUtils.getMenuLayoutName(this._settings.get_enum('menu-layout'));
                this.tweaksRow.title = _('%s Layout Tweaks').format(_(layoutName));
            }
        });
        menuLooksGroup.add(this.layoutRow);

        this.themeRow = new PW.SettingRow({
            title: _('Menu Theme'),
            subtitle: _('Modify menu colors, font size, and border'),
            icon_name: 'settings-theme-symbolic',
        });
        this._addSubPageToRow(this.themeRow, {
            pageClass: ThemePage,
        });
        menuLooksGroup.add(this.themeRow);

        const visualSettingsRow = new PW.SettingRow({
            title: _('Menu Visual Appearance'),
            subtitle: _('Change menu height, width, location, and icon sizes'),
            icon_name: 'settings-settings-symbolic',
        });
        this._addSubPageToRow(visualSettingsRow, {
            pageClass: VisualSettingsPage,
        });
        menuLooksGroup.add(visualSettingsRow);

        const fineTuneRow = new PW.SettingRow({
            title: _('Fine Tune'),
            subtitle: _('Adjust less commonly used settings'),
            icon_name: 'settings-finetune-symbolic',
        });
        this._addSubPageToRow(fineTuneRow, {
            pageClass: FineTunePage,
        });
        menuLooksGroup.add(fineTuneRow);

        const whatToShowGroup = new Adw.PreferencesGroup({
            title: _('What should show on the menu?'),
        });
        this.add(whatToShowGroup);

        const layoutName = SettingsUtils.getMenuLayoutName(this._settings.get_enum('menu-layout'));
        this.tweaksRow = new PW.SettingRow({
            title: _('%s Layout Tweaks').format(_(layoutName)),
            subtitle: _('Settings specific to the current menu layout'),
            icon_name: 'applications-system-symbolic',
        });
        this._addSubPageToRow(this.tweaksRow, {
            pageClass: LayoutTweaksPage,
        });
        whatToShowGroup.add(this.tweaksRow);

        this.pinnedAppsRow = new PW.SettingRow({
            title: _('Pinned Apps'),
            icon_name: 'view-pin-symbolic',
        });
        this._addSubPageToRow(this.pinnedAppsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.PINNED_APPS,
        });
        whatToShowGroup.add(this.pinnedAppsRow);
        visibleRow[Constants.SettingsPage.PINNED_APPS] = this.pinnedAppsRow;

        const directoryShortcutsRow = new PW.SettingRow({
            title: _('Directory Shortcuts'),
            icon_name: 'folder-symbolic',
        });
        this._addSubPageToRow(directoryShortcutsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.DIRECTORIES,
        });
        whatToShowGroup.add(directoryShortcutsRow);
        visibleRow[Constants.SettingsPage.DIRECTORY_SHORTCUTS] = directoryShortcutsRow;

        const applicationShortcutsRow = new PW.SettingRow({
            title: _('Application Shortcuts'),
            icon_name: 'view-grid-symbolic',
        });
        this._addSubPageToRow(applicationShortcutsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.APPLICATIONS,
        });
        whatToShowGroup.add(applicationShortcutsRow);
        visibleRow[Constants.SettingsPage.APPLICATION_SHORTCUTS] = applicationShortcutsRow;

        const searchOptionsRow = new PW.SettingRow({
            title: _('Search Options'),
            icon_name: 'preferences-system-search-symbolic',
        });
        this._addSubPageToRow(searchOptionsRow, {
            pageClass: SearchOptionsPage,
        });
        whatToShowGroup.add(searchOptionsRow);
        visibleRow[Constants.SettingsPage.SEARCH_OPTIONS] = searchOptionsRow;

        const powerOptionsRow = new PW.SettingRow({
            title: _('Power Options'),
            subtitle: _('Choose which power options to show and the display style'),
            icon_name: 'gnome-power-manager-symbolic',
        });
        this._addSubPageToRow(powerOptionsRow, {
            pageClass: ListOtherPage,
            pageClassParams: Constants.MenuSettingsListType.POWER_OPTIONS,
        });
        whatToShowGroup.add(powerOptionsRow);
        visibleRow[Constants.SettingsPage.POWER_OPTIONS] = powerOptionsRow;

        const extraCategoriesRow = new PW.SettingRow({
            title: _('Extra Categories'),
            icon_name: 'view-list-symbolic',
            subtitle: _('Add or remove additional custom categories'),
        });
        this._addSubPageToRow(extraCategoriesRow, {
            pageClass: ListOtherPage,
            pageClassParams: Constants.MenuSettingsListType.EXTRA_CATEGORIES,
        });
        whatToShowGroup.add(extraCategoriesRow);
        visibleRow[Constants.SettingsPage.EXTRA_CATEGORIES] = extraCategoriesRow;

        const contextMenuGroup = new Adw.PreferencesGroup({
            title: _('What should show on the context menu?'),
        });
        this.add(contextMenuGroup);

        const contextMenuRow = new PW.SettingRow({
            title: _('Modify ArcMenu Context Menu'),
            icon_name: 'view-list-bullet-symbolic',
        });
        this._addSubPageToRow(contextMenuRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.CONTEXT_MENU,
        });
        contextMenuGroup.add(contextMenuRow);

        SettingsUtils.setVisibleRows(visibleRow, this._settings.get_enum('menu-layout'));
        this._settings.connect('changed::menu-layout', () =>
            SettingsUtils.setVisibleRows(visibleRow, this._settings.get_enum('menu-layout')));
    }

    _addSubPageToRow(row, pageParams) {
        const PageClass = pageParams.pageClass;
        const pageClassParams = pageParams.pageClassParams ?? 0;

        const settingPage = new PageClass(this._settings, {
            title: _(row.title),
            list_type: pageClassParams,
        });
        row.settingPage = settingPage;

        row.connect('activated', () => {
            this._window.push_subpage(settingPage);

            if (settingPage.setActiveLayout)
                settingPage.setActiveLayout(this._settings.get_enum('menu-layout'));

            settingPage.resetScrollAdjustment();
        });
    }

    presentSubpage(subpage) {
        if (subpage === Constants.SettingsPage.MENU_LAYOUT) {
            const row = this.layoutRow;
            this._window.push_subpage(row.settingPage);
        }
        if (subpage === Constants.SettingsPage.MENU_THEME) {
            const row = this.themeRow;
            this._window.push_subpage(row.settingPage);
        } else if (subpage === Constants.SettingsPage.RUNNER_TWEAKS) {
            const row = this.tweaksRow;
            this._window.push_subpage(row.settingPage);
            row.settingPage.setActiveLayout(Constants.MenuLayout.RUNNER);
        }
    }
});
