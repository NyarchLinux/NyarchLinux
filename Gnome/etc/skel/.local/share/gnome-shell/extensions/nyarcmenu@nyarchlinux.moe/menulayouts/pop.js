
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ParentalControlsManager from 'resource:///org/gnome/shell/misc/parentalControlsManager.js';

import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

function _getFolderName(folder) {
    const name = folder.get_string('name');

    if (folder.get_boolean('translate')) {
        const translated = Shell.util_get_translated_folder_name(name);
        if (translated !== null)
            return translated;
    }

    return name;
}

function _getCategories(info) {
    const categoriesStr = info.get_categories();
    if (!categoriesStr)
        return [];
    return categoriesStr.split(';');
}

function _listsIntersect(a, b) {
    for (const itemA of a) {
        if (b.includes(itemA))
            return true;
    }
    return false;
}

function _findBestFolderName(apps) {
    const appInfos = apps.map(app => app.get_app_info());

    const categoryCounter = {};
    const commonCategories = [];

    appInfos.reduce((categories, appInfo) => {
        for (const category of _getCategories(appInfo)) {
            if (!(category in categoryCounter))
                categoryCounter[category] = 0;

            categoryCounter[category] += 1;

            // If a category is present in all apps, its counter will
            // reach appInfos.length
            if (category.length > 0 &&
                categoryCounter[category] === appInfos.length)
                categories.push(category);
        }
        return categories;
    }, commonCategories);

    for (const category of commonCategories) {
        const directory = `${category}.directory`;
        const translated = Shell.util_get_translated_folder_name(directory);
        if (translated !== null)
            return translated;
    }

    return null;
}

export const Layout = class PopLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            column_spacing: 12,
            row_spacing: 12,
            default_menu_width: 1050,
            vertical: true,
            icon_grid_size: Constants.GridIconSize.EXTRA_LARGE,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.LARGE_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.draggableApps = true;
        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
        });
        this.topBox.add_child(this.searchEntry);

        // Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.HORIZONTAL,
            column_spacing: 6,
            row_spacing: 6,
        });
        this.categoriesContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.categoriesGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_expand: false,
            y_align: Clutter.ActorAlign.END,
            layout_manager: layout,
        });
        this.categoriesContainer.add_child(this.categoriesGrid);
        layout.hookup_style(this.categoriesGrid);

        const searchBarLocation = this._settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.style = 'margin: 10px 220px;';
            this.topBox.style = 'padding-top: 0.5em;';

            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(this.categoriesContainer);
            this.categoriesContainer.set({
                y_align: Clutter.ActorAlign.START,
                y_expand: false,
            });
            this.add_child(separator);

            this.add_child(this.applicationsScrollBox);

            this.add_child(this.topBox);
        } else if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.style = 'margin: 10px 220px;';
            this.topBox.style = 'padding-bottom: 0.5em;';
            this.add_child(this.topBox);

            this.add_child(this.applicationsScrollBox);

            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.categoriesContainer.insert_child_at_index(separator, 0);
            this.add_child(this.categoriesContainer);
        }

        this._redisplayWorkId = Main.initializeDeferredWork(this, () => {
            this.reloadApplications(true);
        });

        this._folderSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders'});
        this._folderSettings.connectObject('changed::folder-children', () =>
            Main.queueDeferredWork(this._redisplayWorkId), this);
        this._parentalControlsManager = ParentalControlsManager.getDefault();
        this._parentalControlsManager.connectObject('app-filter-changed',
            () => Main.queueDeferredWork(this._redisplayWorkId), this);

        this.updateWidth();
        this.loadCategories();
        this.setDefaultMenuView();
        global.settings.connectObject('changed::app-picker-layout',
            this.syncLibraryHomeAppList.bind(this), this);

        this._settings.connectObject('changed::pop-default-view', () => this.setDefaultMenuView(), this);
    }

    updateWidth(setDefaultMenuView) {
        const widthAdjustment = this._settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    loadCategories() {
        this.categoriesGrid.destroy_all_children();
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        this.applicationsMap = new Map();

        this._appInfoList = Shell.AppSystem.get_default().get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch (e) {
                return false;
            }
            return this._parentalControlsManager.shouldShowApp(appInfo);
        });

        this.loadGroups();
    }

    _syncFolder(folderMenuItem) {
        const {folderSettings} = folderMenuItem;
        const name = _getFolderName(folderSettings);

        const foldersData = this._settings.get_value('pop-folders-data').deep_unpack();
        const folderEntryId = folderMenuItem.folder_id;
        foldersData[folderEntryId] = name;
        this._settings.set_value('pop-folders-data', new GLib.Variant('a{ss}', foldersData));

        this._loadFolderApps(folderMenuItem);
        folderMenuItem.folder_name = name;
        folderMenuItem.createIcon();

        if (this.activeCategoryItem === folderMenuItem)
            folderMenuItem.displayAppList();
    }

    loadGroups() {
        const foldersData = {'Library Home': _('Library Home')};
        const homeGroupMenuItem = new MW.GroupFolderMenuItem(this, null, {
            folder_name: _('Library Home'),
            home_folder: true,
        });
        this.categoryDirectories.set('Library Home', homeGroupMenuItem);

        let usedApps = [];

        const folders = this._folderSettings.get_strv('folder-children');
        folders.forEach(id => {
            const path = `${this._folderSettings.path}folders/${id}/`;
            const folderSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.app-folders.folder',
                path,
            });

            const name = _getFolderName(folderSettings);
            const categoryMenuItem = new MW.GroupFolderMenuItem(this, folderSettings, {
                folder_name: name,
                folder_id: id,
            });
            this._loadFolderApps(categoryMenuItem);

            // Don't display empty folders
            if (categoryMenuItem.appList.length > 0) {
                foldersData[id] = name;
                this.categoryDirectories.set(id, categoryMenuItem);

                usedApps = usedApps.concat(categoryMenuItem.appList);

                folderSettings.connectObject('changed', () =>
                    this._syncFolder(categoryMenuItem), categoryMenuItem);
            } else {
                categoryMenuItem.destroy();
            }
        });

        this._settings.set_value('pop-folders-data', new GLib.Variant('a{ss}', foldersData));

        const remainingApps = [];
        const apps = this._appInfoList.map(app => app.get_id());
        apps.forEach(appId => {
            const app = Shell.AppSystem.get_default().lookup_app(appId);

            if (!this.applicationsMap.get(app)) {
                const item = new MW.ApplicationMenuItem(this, app, this.display_type);
                item.setFolderGroup(homeGroupMenuItem);
                this.applicationsMap.set(app, item);
                remainingApps.push(app);
            }
        });
        remainingApps.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        homeGroupMenuItem.appList = remainingApps;

        this.placeHolderFolderItem = new MW.GroupFolderMenuItem(this, null, {
            folder_name: _('New Folder'),
            new_folder: true,
        });
        this.categoryDirectories.set('New Folder', this.placeHolderFolderItem);
        this.placeHolderFolderItem.set({
            visible: false,
            opacity: 0,
            scale_x: 0,
            scale_y: 0,
        });
        this.displayCategories();
    }

    createNewFolder(app) {
        const newFolderId = GLib.uuid_string_random();

        const folders = this._folderSettings.get_strv('folder-children');
        folders.push(newFolderId);

        const newFolderPath = this._folderSettings.path.concat('folders/', newFolderId, '/');
        let newFolderSettings;
        try {
            newFolderSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.app-folders.folder',
                path: newFolderPath,
            });
        } catch (e) {
            log('Error creating new folder');
            return;
        }

        const appIds = [app.id];
        let folderName = _findBestFolderName([app]);
        if (!folderName)
            folderName = _('Unnamed Folder');

        newFolderSettings.delay();
        newFolderSettings.set_string('name', folderName);
        newFolderSettings.set_strv('apps', appIds);
        newFolderSettings.apply();

        this._folderSettings.set_strv('folder-children', folders);
    }

    removeFolder(folderMenuItem) {
        const {folderSettings, folder_id: folderId} = folderMenuItem;

        // Resetting all keys deletes the relocatable schema
        const keys = folderSettings.settings_schema.list_keys();
        for (const key of keys)
            folderSettings.reset(key);

        const settings = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders'});
        const folders = settings.get_strv('folder-children');
        folders.splice(folders.indexOf(folderId), 1);
        settings.set_strv('folder-children', folders);
    }

    removeAppFromFolder(app, folder) {
        if (!folder)
            return;

        const appId = app.id;
        const isHomeFolder = folder.home_folder;
        const folderAppList = folder.appList;

        const isAppInFolder = folderAppList.includes(app);
        if (isAppInFolder && !isHomeFolder) {
            const {folderSettings} = folder;
            const folderApps = folderSettings.get_strv('apps');
            const index = folderApps.indexOf(appId);

            if (index >= 0)
                folderApps.splice(index, 1);

            if (folderApps.length === 0) {
                this.removeFolder(folder);
            } else {
                const categories = folderSettings.get_strv('categories');
                if (categories.length > 0) {
                    const excludedApps = folderSettings.get_strv('excluded-apps');
                    excludedApps.push(appId);
                    folderSettings.set_strv('excluded-apps', excludedApps);
                }
                folderSettings.set_strv('apps', folderApps);
            }
        }
    }

    addAppToFolder(app, folder) {
        const appId = app.id;

        if (folder.home_folder)
            return;

        const {folderSettings} = folder;
        const folderApps = folderSettings.get_strv('apps');
        folderApps.push(appId);
        folderSettings.set_strv('apps', folderApps);

        const excludedApps = folderSettings.get_strv('excluded-apps');
        const index = excludedApps.indexOf(appId);
        if (index >= 0) {
            excludedApps.splice(index, 1);
            folderSettings.set_strv('excluded-apps', excludedApps);
        }
    }

    reorderFolderApps(folder, appList) {
        const {folderSettings} = folder;
        folderSettings.set_strv('apps', appList);
    }

    syncLibraryHomeAppList() {
        const layout = global.settings.get_value('app-picker-layout');
        const appPages = layout.recursiveUnpack();
        const appSys = Shell.AppSystem.get_default();

        const appList = [];
        for (const page of appPages) {
            for (const [appId, properties_] of Object.entries(page)) {
                const app = appSys.lookup_app(appId);
                if (app)
                    appList.push(app);
            }
        }
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });

        const folder = this.categoryDirectories.get('Library Home');
        folder.appList = appList;
        if (this.activeCategoryItem === folder)
            folder.displayAppList();
    }

    reorderFolders(orderedList) {
        const orderedFolders = [];
        orderedList.forEach(child => {
            if (child.folder_id)
                orderedFolders.push(child.folder_id);
        });
        this._folderSettings.set_strv('folder-children', orderedFolders);
    }

    _loadFolderApps(folderMenuItem) {
        const {folderSettings} = folderMenuItem;
        const apps = [];
        const excludedApps = folderSettings.get_strv('excluded-apps');
        const appSys = Shell.AppSystem.get_default();
        const addAppId = appId => {
            if (excludedApps.includes(appId))
                return;

            const app = appSys.lookup_app(appId);
            if (!app)
                return;

            if (!this._parentalControlsManager.shouldShowApp(app.get_app_info()))
                return;

            if (apps.indexOf(app) !== -1)
                return;

            apps.push(app);
        };

        const folderApps = folderSettings.get_strv('apps');
        folderApps.forEach(addAppId);

        const folderCategories = folderSettings.get_strv('categories');
        const appInfos = this._appInfoList;

        appInfos.forEach(appInfo => {
            const appCategories = _getCategories(appInfo);
            if (!_listsIntersect(folderCategories, appCategories))
                return;

            addAppId(appInfo.get_id());
        });

        const items = [];
        apps.forEach(app => {
            let item = this.applicationsMap.get(app);
            if (!item) {
                item = new MW.ApplicationMenuItem(this, app, this.display_type);
                this.applicationsMap.set(app, item);
            }
            item.setFolderGroup(folderMenuItem);

            items.push(app);
        });

        folderMenuItem.appList = items;
    }

    fadeInPlaceHolder() {
        this.placeHolderFolderItem.visible = true;
        this.placeHolderFolderItem.ease({
            opacity: 255,
            duration: 200,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
    }

    fadeOutPlaceHolder() {
        this.placeHolderFolderItem.ease({
            opacity: 0,
            scale_x: 0,
            scale_y: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this.placeHolderFolderItem.visible = false;
            },
        });
    }

    displayCategories() {
        const gridIconPadding = 10;
        const iconWidth = 110 + gridIconPadding;

        const padding = 12;
        const totalWidth = this.menu_width - padding;
        const spacing = this.categoriesGrid.layout_manager.column_spacing;
        const columns = Math.floor(totalWidth / (iconWidth + spacing));
        this.categoriesGrid.layout_manager.gridColumns = columns;

        this._futureActiveItem = false;

        const rtl = this.get_text_direction() === Clutter.TextDirection.RTL;
        let count = 0;
        let top = -1;
        let left = 0;

        for (const categoryMenuItem of this.categoryDirectories.values()) {
            if (categoryMenuItem.get_parent())
                continue;
            if (!rtl && (count % columns === 0)) {
                top++;
                left = 0;
            } else if (rtl && (left === 0)) {
                top++;
                left = columns;
            }

            this.categoriesGrid.layout_manager.attach(categoryMenuItem, left, top, 1, 1);
            categoryMenuItem.gridLocation = [left, top];
            if (!rtl)
                left++;
            else
                left--;
            count++;
            if (!this._futureActiveItem)
                this._futureActiveItem = categoryMenuItem;
        }

        this.activeMenuItem = this._futureActiveItem;
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        const defaultView = this._settings.get_string('pop-default-view');
        let category = this.categoryDirectories.get(defaultView);

        if (!category)
            category = this.categoryDirectories.values().next().value;

        category.displayAppList();
        this.setActiveCategory(category, true);
    }

    _onSearchEntryChanged(searchEntry, searchString) {
        super._onSearchEntryChanged(searchEntry, searchString);
        if (!searchEntry.isEmpty())
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
    }
};
