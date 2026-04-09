import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Constants from './constants.js';

import {AboutPage} from './settings/aboutPage.js';
import {DonatePage} from './settings/donatePage.js';
import {GeneralPage} from './settings/generalPage.js';
import {MenuButtonPage} from './settings/menuButtonPage.js';
import {MenuPage} from './settings/menuPage.js';

import {IconGroup} from './settings/iconChooserDialog.js';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const IconDataItem = GObject.registerClass({
    Properties: {
        'display-name': GObject.ParamSpec.string('display-name', 'Display Name', 'Display Name', GObject.ParamFlags.READWRITE, ''),
        'icon-string': GObject.ParamSpec.string('icon-string', 'Icon String', 'Icon String', GObject.ParamFlags.READWRITE, ''),
        'group': GObject.ParamSpec.int('group', 'Group', 'Group', GObject.ParamFlags.READWRITE, 0, 3, IconGroup.ALL),
    },
}, class Item extends GObject.Object {});

export default class ArcMenuPrefs extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);

        this._startTime = Date.now();
        this._systemIconsPromise = null;
        this._cachedSystemIcons = null;
        const resourcePath = '/org/gnome/shell/extensions/arcmenu/icons';
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if (!iconTheme.get_resource_path().includes(resourcePath))
            iconTheme.add_resource_path(resourcePath);

        const resource = Gio.Resource.load(`${this.path}/data/resources.gresource`);
        Gio.resources_register(resource);
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

            if (this._idleAddId) {
                GLib.source_remove(this._idleAddId);
                this._idleAddId = null;
            }

            this._cachedSystemIcons = null;
            this._systemIconsPromise = null;
        });

        this._populateWindow(window, settings);
        this._idleAddId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.getSystemIcons();
            this._idleAddId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _populateWindow(window, settings) {
        if (window.pages?.length > 0)
            window.pages.forEach(page => window.remove(page));

        window.pages = [];

        const generalPage = new GeneralPage(settings, window);
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

    getSystemIcons() {
        if (this._cachedSystemIcons)
            return Promise.resolve(this._cachedSystemIcons);

        if (this._systemIconsPromise)
            return this._systemIconsPromise;

        this._startSystemIconsPromise();
        return this._systemIconsPromise;
    }

    _startSystemIconsPromise() {
        this._systemIconsPromise = new Promise(resolve => {
            const startTime = Date.now();
            const iconsData = [];
            const distroIcons = [];
            const extensionIcons = [];

            const myResourcePath = '/org/gnome/shell/extensions/arcmenu/icons';
            const bundledIconsPath = `${myResourcePath}/scalable/actions`;

            try {
                const entries = Gio.resources_enumerate_children(bundledIconsPath, 0);
                for (const entry of entries) {
                    if (!entry.endsWith('.svg'))
                        continue;

                    const group = entry.startsWith('distro-') ? IconGroup.DISTRO : IconGroup.EXTENSION;
                    const name = entry.slice(0, -4);

                    const item = new IconDataItem({
                        display_name: name,
                        icon_string: `${Constants.RESOURCE_PATH}/actions/${entry}`,
                        group,
                    });

                    if (group === IconGroup.DISTRO)
                        distroIcons.push(item);
                    else
                        extensionIcons.push(item);
                }
            } catch {
                console.log('ArcMenu Error: Error gathering ArcMenu icons.');
            }

            distroIcons.sort((a, b) => a.display_name.localeCompare(b.display_name));
            extensionIcons.sort((a, b) => a.display_name.localeCompare(b.display_name));
            iconsData.push(...extensionIcons, ...distroIcons);

            // IconTheme without ArcMenu's own icons
            const iconThemeDefault = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            const resourcePaths = iconThemeDefault.resource_path.filter(p => p !== myResourcePath);

            const iconTheme = new Gtk.IconTheme({
                resource_path: resourcePaths,
                search_path: iconThemeDefault.get_search_path(),
                theme_name: iconThemeDefault.theme_name,
            });

            const iconNames = iconTheme.get_icon_names().sort((a, b) => a.localeCompare(b));
            for (const name of iconNames) {
                iconsData.push(new IconDataItem({
                    display_name: name,
                    icon_string: name,
                    group: IconGroup.SYSTEM,
                }));
            }
            this._cachedSystemIcons = iconsData;
            console.log(`ArcMenu: Build icon cache time: ${Date.now() - startTime}ms. Icons found: ${this._cachedSystemIcons.length}`);
            resolve(this._cachedSystemIcons);
            this._systemIconsPromise = null;
        });
    }
}
