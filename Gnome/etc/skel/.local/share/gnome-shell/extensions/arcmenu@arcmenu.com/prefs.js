import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import * as Constants from './constants.js';

import {AboutPage} from './settings/AboutPage.js';
import {DonatePage} from './settings/DonatePage.js';
import {GeneralPage} from './settings/GeneralPage.js';
import {MenuButtonPage} from './settings/MenuButtonPage.js';
import {MenuPage} from './settings/MenuPage.js';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ArcMenuPrefs extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);

        const iconPath = `${this.path}/icons`;
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if (!iconTheme.get_search_path().includes(iconPath))
            iconTheme.add_search_path(iconPath);
    }

    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.set_search_enabled(true);
        window.set_default_size(settings.get_int('settings-width'), settings.get_int('settings-height'));

        let pageChangedId = settings.connect('changed::prefs-visible-page', () => {
            if (settings.get_int('prefs-visible-page') !== Constants.SettingsPage.MAIN)
                this._setVisiblePage(window, settings);
        });

        let pinnedAppsChangedId = settings.connect('changed::pinned-apps', () => {
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


        this._populateWindow(window, settings);
    }

    _populateWindow(window, settings) {
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

        const donatePage = new DonatePage(this.metadata);
        window.add(donatePage);
        window.pages.push(donatePage);

        const aboutPage = new AboutPage(settings, this.metadata, this.path);
        window.add(aboutPage);
        window.pages.push(aboutPage);

        this._setVisiblePage(window, settings);
    }

    _setVisiblePage(window, settings) {
        const prefsVisiblePage = settings.get_int('prefs-visible-page');

        window.pop_subpage();
        if (prefsVisiblePage === Constants.SettingsPage.MAIN) {
            window.set_visible_page_name('GeneralPage');
        } else if (prefsVisiblePage === Constants.SettingsPage.CUSTOMIZE_MENU) {
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
            window.set_visible_page_name('MenuButtonPage');
        } else if (prefsVisiblePage === Constants.SettingsPage.RUNNER_TWEAKS) {
            window.set_visible_page_name('MenuPage');
            const page = window.get_visible_page();
            page.presentSubpage(Constants.SettingsPage.RUNNER_TWEAKS);
        } else if (prefsVisiblePage === Constants.SettingsPage.ABOUT) {
            window.set_visible_page_name('AboutPage');
        } else if (prefsVisiblePage === Constants.SettingsPage.GENERAL) {
            window.set_visible_page_name('GeneralPage');
        } else if (prefsVisiblePage === Constants.SettingsPage.DONATE) {
            window.set_visible_page_name('DonatePage');
        } else if (prefsVisiblePage === Constants.SettingsPage.WHATS_NEW) {
            window.set_visible_page_name('AboutPage');
            const page = window.get_visible_page();
            page.showWhatsNewPage();
        }

        settings.set_int('prefs-visible-page', Constants.SettingsPage.MAIN);
    }
}
