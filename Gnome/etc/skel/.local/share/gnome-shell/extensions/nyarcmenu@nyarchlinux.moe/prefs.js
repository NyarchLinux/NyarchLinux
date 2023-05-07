/* eslint-disable no-unused-vars */
/* eslint-disable jsdoc/require-jsdoc */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Gdk, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Settings = Me.imports.settings;
const _ = Gettext.gettext;

const {AboutPage} = Settings.AboutPage;
const {GeneralPage} = Settings.GeneralPage;
const {MenuButtonPage} = Me.imports.settings.MenuButtonPage;
const {MenuPage} = Me.imports.settings.MenuPage;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function populateWindow(window, settings) {
    if (window.pages?.length > 0)
        window.pages.forEach(page => window.remove(page));


    window.pages = [];

    const generalPage = new GeneralPage(settings);
    window.add(generalPage);
    window.pages.push(generalPage);

    const menuPage = new MenuPage(settings, window);
    window.add(menuPage);
    window.pages.push(menuPage);

    const menuButtonPage = new MenuButtonPage(settings);
    window.add(menuButtonPage);
    window.pages.push(menuButtonPage);

    const aboutPage = new AboutPage(settings, window);
    window.add(aboutPage);
    window.pages.push(aboutPage);

    setVisiblePage(window, settings);
}

function setVisiblePage(window, settings) {
    const prefsVisiblePage = settings.get_int('prefs-visible-page');

    if (prefsVisiblePage === Constants.SettingsPage.MAIN) {
        window.close_subpage();
        window.set_visible_page_name('GeneralPage');
    } else if (prefsVisiblePage === Constants.SettingsPage.CUSTOMIZE_MENU) {
        window.close_subpage();
        window.set_visible_page_name('MenuPage');
    } else if (prefsVisiblePage === Constants.SettingsPage.MENU_LAYOUT) {
        window.set_visible_page_name('MenuPage');
        const page = window.get_visible_page();
        page.presentSubpage(Constants.SettingsPage.MENU_LAYOUT);
    } else if (prefsVisiblePage === Constants.SettingsPage.MENU_THEME) {
        window.set_visible_page_name('MenuPage');
        const page = window.get_visible_page();
        page.presentSubpage(Constants.SettingsPage.MENU_THEME);
    } else if (prefsVisiblePage === Constants.SettingsPage.BUTTON_APPEARANCE) {
        window.close_subpage();
        window.set_visible_page_name('MenuButtonPage');
    } else if (prefsVisiblePage === Constants.SettingsPage.RUNNER_TWEAKS) {
        window.set_visible_page_name('MenuPage');
        const page = window.get_visible_page();
        page.presentSubpage(Constants.SettingsPage.RUNNER_TWEAKS);
    } else if (prefsVisiblePage === Constants.SettingsPage.ABOUT) {
        window.close_subpage();
        window.set_visible_page_name('AboutPage');
    } else if (prefsVisiblePage === Constants.SettingsPage.GENERAL) {
        window.close_subpage();
        window.set_visible_page_name('GeneralPage');
    }

    settings.set_int('prefs-visible-page', Constants.SettingsPage.MAIN);
}

function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings();

    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    if (!iconTheme.get_search_path().includes(`${Me.path}/media/icons/prefs_icons`))
        iconTheme.add_search_path(`${Me.path}/media/icons/prefs_icons`);

    window.set_search_enabled(true);
    window.can_navigate_back = true;
    window.default_width = settings.get_int('settings-width');
    window.default_height = settings.get_int('settings-height');
    window.set_title(_('ArcMenu Settings'));

    let pageChangedId = settings.connect('changed::prefs-visible-page', () => {
        if (settings.get_int('prefs-visible-page') !== Constants.SettingsPage.MAIN)
            setVisiblePage(window, settings);
    });

    let pinnedAppsChangedId = settings.connect('changed::pinned-app-list', () => {
        for (const page of window.pages) {
            if (page instanceof MenuPage) {
                const {settingPage} = page.pinnedAppsRow;
                settingPage.updatePinnedApps();
            }
        }
    });

    window.connect('notify::visible-page', () => {
        const page = window.visible_page;
        const maybeScrolledWindowChild = [...page][0];

        if (maybeScrolledWindowChild instanceof Gtk.ScrolledWindow)
            maybeScrolledWindowChild.vadjustment.value = 0;
    });

    window.connect('close-request', () => {
        if (pageChangedId) {
            settings.disconnect(pageChangedId);
            pageChangedId = null;
        }

        if (pinnedAppsChangedId) {
            settings.disconnect(pinnedAppsChangedId);
            pinnedAppsChangedId = null;
        }
    });

    populateWindow(window, settings);
}
