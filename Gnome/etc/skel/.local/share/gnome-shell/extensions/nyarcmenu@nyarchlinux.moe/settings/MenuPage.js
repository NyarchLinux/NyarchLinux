/* exported MenuPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gio, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Settings = Me.imports.settings;
const _ = Gettext.gettext;

const {FineTunePage} = Settings.Menu.FineTunePage;
const {LayoutsPage} = Settings.Menu.LayoutsPage;
const {LayoutTweaksPage} = Settings.Menu.LayoutTweaksPage;
const {ListOtherPage} = Settings.Menu.ListOtherPage;
const {ListPinnedPage} = Settings.Menu.ListPinnedPage;
const {SearchOptionsPage} = Settings.Menu.SearchOptionsPage;
const {ThemePage} = Settings.Menu.ThemePage;
const {VisualSettingsPage} = Settings.Menu.VisualSettings;
const {SettingsUtils} = Settings;

var MenuPage = GObject.registerClass(
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

        this.layoutRow = new SettingRow({
            title: _('Menu Layout'),
            subtitle: _('Choose a layout style for the menu'),
            icon_name: 'settings-layouts-symbolic',
        });
        this._addSubPageToRow(this.layoutRow, {
            pageClass: LayoutsPage,
        });
        this.layoutRow.settingPage.connect('response', (_w, response) => {
            if (response === Gtk.ResponseType.APPLY)
                this.tweaksRow.title = _(SettingsUtils.getMenuLayoutTweaksName(this._settings.get_enum('menu-layout')));
        });
        menuLooksGroup.add(this.layoutRow);

        this.themeRow = new SettingRow({
            title: _('Menu Theme'),
            subtitle: _('Modify menu colors, font size, and border'),
            icon_name: 'settings-theme-symbolic',
        });
        this._addSubPageToRow(this.themeRow, {
            pageClass: ThemePage,
        });
        menuLooksGroup.add(this.themeRow);

        const visualSettingsRow = new SettingRow({
            title: _('Menu Visual Appearance'),
            subtitle: _('Change menu height, width, location, and icon sizes'),
            icon_name: 'settings-settings-symbolic',
        });
        this._addSubPageToRow(visualSettingsRow, {
            pageClass: VisualSettingsPage,
        });
        menuLooksGroup.add(visualSettingsRow);

        const fineTuneRow = new SettingRow({
            title: _('Fine Tune'),
            subtitle: _('Adjust less commonly used visual settings'),
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

        this.tweaksRow = new SettingRow({
            title: _(SettingsUtils.getMenuLayoutTweaksName(this._settings.get_enum('menu-layout'))),
            subtitle: _('Settings specific to the current menu layout'),
            icon_name: 'emblem-system-symbolic',
        });
        this._addSubPageToRow(this.tweaksRow, {
            pageClass: LayoutTweaksPage,
        });
        whatToShowGroup.add(this.tweaksRow);

        this.pinnedAppsRow = new SettingRow({
            title: _('Pinned Apps'),
            icon_name: 'view-pin-symbolic',
        });
        this._addSubPageToRow(this.pinnedAppsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.PINNED_APPS,
        });
        whatToShowGroup.add(this.pinnedAppsRow);
        visibleRow[Constants.SettingsPage.PINNED_APPS] = this.pinnedAppsRow;

        const directoryShortcutsRow = new SettingRow({
            title: _('Directory Shortcuts'),
            icon_name: 'folder-symbolic',
        });
        this._addSubPageToRow(directoryShortcutsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.DIRECTORIES,
        });
        whatToShowGroup.add(directoryShortcutsRow);
        visibleRow[Constants.SettingsPage.DIRECTORY_SHORTCUTS] = directoryShortcutsRow;

        const applicationShortcutsRow = new SettingRow({
            title: _('Application Shortcuts'),
            icon_name: 'view-grid-symbolic',
        });
        this._addSubPageToRow(applicationShortcutsRow, {
            pageClass: ListPinnedPage,
            pageClassParams: Constants.MenuSettingsListType.APPLICATIONS,
        });
        whatToShowGroup.add(applicationShortcutsRow);
        visibleRow[Constants.SettingsPage.APPLICATION_SHORTCUTS] = applicationShortcutsRow;

        const searchOptionsRow = new SettingRow({
            title: _('Search Options'),
            icon_name: 'preferences-system-search-symbolic',
        });
        this._addSubPageToRow(searchOptionsRow, {
            pageClass: SearchOptionsPage,
        });
        whatToShowGroup.add(searchOptionsRow);
        visibleRow[Constants.SettingsPage.SEARCH_OPTIONS] = searchOptionsRow;

        const powerOptionsRow = new SettingRow({
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

        const extraCategoriesRow = new SettingRow({
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

        const contextMenuRow = new SettingRow({
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
            if (settingPage.setActiveLayout)
                settingPage.setActiveLayout(this._settings.get_enum('menu-layout'));

            this._window.present_subpage(settingPage);
            settingPage.resetScrollAdjustment();
        });
    }

    presentSubpage(subpage) {
        if (subpage === Constants.SettingsPage.MENU_LAYOUT) {
            const row = this.layoutRow;
            this._window.present_subpage(row.settingPage);
        }
        if (subpage === Constants.SettingsPage.MENU_THEME) {
            const row = this.themeRow;
            this._window.present_subpage(row.settingPage);
        } else if (subpage === Constants.SettingsPage.RUNNER_TWEAKS) {
            const row = this.tweaksRow;
            this._window.present_subpage(row.settingPage);
            row.settingPage.setActiveLayout(Constants.MenuLayout.RUNNER);
        }
    }
});

var SettingRow = GObject.registerClass(
class ArcMenuMenuLayoutRow extends Adw.ActionRow {
    _init(params) {
        super._init({
            activatable: true,
            ...params,
        });

        const goNextImage = new Gtk.Image({
            gicon: Gio.icon_new_for_string('go-next-symbolic'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
        });

        this.add_suffix(goNextImage);
    }
});
