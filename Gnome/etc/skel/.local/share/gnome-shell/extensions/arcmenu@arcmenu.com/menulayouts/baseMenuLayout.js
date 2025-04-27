import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GMenu from 'gi://GMenu';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import * as PlaceDisplay from '../placeDisplay.js';
import {RecentFilesManager} from '../recentFilesManager.js';
import {SearchResults} from '../search.js';
import * as Utils from '../utils.js';

import {IconGrid} from '../iconGrid.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const MAX_RECENT_FILES = 25;

// This class handles the core functionality of all the menu layouts.
// Each menu layout extends this class.
export class BaseMenuLayout extends St.BoxLayout {
    static [GObject.properties] = {
        'display-type': GObject.ParamSpec.uint(
            'display-type', 'display-type', 'display-type',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'search-display-type': GObject.ParamSpec.uint(
            'search-display-type', 'search-display-type', 'search-display-type',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'context-menu-location': GObject.ParamSpec.uint(
            'context-menu-location', 'context-menu-location', 'context-menu-location',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'column-spacing': GObject.ParamSpec.uint(
            'column-spacing', 'column-spacing', 'column-spacing',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'row-spacing': GObject.ParamSpec.uint(
            'row-spacing', 'row-spacing', 'row-spacing',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'search-results-spacing': GObject.ParamSpec.uint(
            'search-results-spacing', 'search-results-spacing',
            'search-results-spacing',  GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 0),
        'is_dual_panel': GObject.ParamSpec.boolean(
            'is_dual_panel', 'is_dual_panel', 'is_dual_panel',
            GObject.ParamFlags.READWRITE, false),
        'supports_category_hover_activation': GObject.ParamSpec.boolean(
            'supports_category_hover_activation', 'supports_category_hover_activation',
            'supports_category_hover_activation',
            GObject.ParamFlags.READWRITE, false),
        'is_standalone_runner': GObject.ParamSpec.boolean(
            'is_standalone_runner', 'is_standalone_runner', 'is_standalone_runner',
            GObject.ParamFlags.READWRITE, false),
        'menu-width': GObject.ParamSpec.uint(
            'menu-width', 'menu-width', 'menu-width',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'default-menu-width': GObject.ParamSpec.uint(
            'default-menu-width', 'default-menu-width', 'default-menu-width',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'icon-grid-size': GObject.ParamSpec.uint(
            'icon-grid-size', 'icon-grid-size', 'icon-grid-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 5),
        'category-icon-size': GObject.ParamSpec.uint(
            'category-icon-size', 'category-icon-size', 'category-icon-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'apps-icon-size': GObject.ParamSpec.uint(
            'apps-icon-size', 'apps-icon-size', 'apps-icon-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'quicklinks-icon-size': GObject.ParamSpec.uint(
            'quicklinks-icon-size', 'quicklinks-icon-size', 'quicklinks-icon-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'buttons-icon-size': GObject.ParamSpec.uint(
            'buttons-icon-size', 'buttons-icon-size', 'buttons-icon-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
        'pinned-apps-icon-size': GObject.ParamSpec.uint(
            'pinned-apps-icon-size', 'pinned-apps-icon-size', 'pinned-apps-icon-size',
            GObject.ParamFlags.READWRITE, 0, GLib.MAXINT32, 0),
    };

    static {
        GObject.registerClass(this);
    }

    constructor(menuButton, params) {
        super({
            ...params,
            reactive: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
        });
        this._delegate = this;

        this._menuButton = menuButton;
        this.contextMenuManager = menuButton.contextMenuManager;
        this.subMenuManager = menuButton.subMenuManager;
        this.arcMenu = menuButton.arcMenu;

        if (this.arcMenu === null)
            throw new Error('ArcMenu null');

        this.hasPinnedApps = false;
        this.activeCategoryType = -1;
        this._disableFadeEffect = ArcMenuManager.settings.get_boolean('disable-scrollview-fade-effect');
        this.iconTheme = new St.IconTheme();
        this.appSys = Shell.AppSystem.get_default();
        this._tree = new GMenu.Tree({menu_basename: 'applications.menu'});

        this.searchResults = new SearchResults(this);
        this.searchEntry = new MW.SearchEntry(this);

        this.applicationsGrid = new IconGrid({
            halign: this.display_type === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER,
            column_spacing: this.column_spacing,
            row_spacing: this.row_spacing,
        });

        this._pinnedAppsGrid = new IconGrid({
            columns: 4,
            halign: this.display_type === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER,
            column_spacing: this.column_spacing,
            row_spacing: this.row_spacing,
            accept_drop: true,
        });

        this.connect('key-press-event', this._onMainBoxKeyPress.bind(this));
        this.connect('destroy', () => this._onDestroy());
        this.searchEntry.connectObject('search-changed', this._onSearchEntryChanged.bind(this), this);
        this.searchEntry.connectObject('entry-key-press', this._onSearchEntryKeyPress.bind(this), this);
    }

    _connectAppChangedEvents() {
        this._tree.connectObject('changed', () => this.reloadApplications(), this);
        ArcMenuManager.settings.connectObject('changed::recently-installed-apps', () => this.reloadApplications(), this);
        AppFavorites.getAppFavorites().connectObject('changed', () => {
            if (this.categoryDirectories) {
                const categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FAVORITES);
                if (categoryMenuItem)
                    this._loadGnomeFavorites(categoryMenuItem);
            }
        }, this);
    }

    get menuButton() {
        return this._menuButton;
    }

    setDefaultMenuView() {
        this.searchEntry.clearWithoutSearchChangeEvent();
        this.searchResults.setTerms([]);
        // Search results have been cleared, set category box active if needed.
        this._setCategoriesBoxInactive(false);

        this._clearActorsFromBox();
        this.resetScrollBarPosition();
    }

    _addChildToParent(parent, child) {
        Utils.addChildToParent(parent, child);
    }

    updateWidth(setDefaultMenuView, leftPanelWidthOffset = 0, rightPanelWidthOffset = 0) {
        if (this.is_dual_panel) {
            const leftPanelWidth = ArcMenuManager.settings.get_int('left-panel-width') + leftPanelWidthOffset;
            const rightPanelWidth = ArcMenuManager.settings.get_int('right-panel-width') + rightPanelWidthOffset;
            this.leftBox.style = `width: ${leftPanelWidth}px;`;
            this.rightBox.style = `width: ${rightPanelWidth}px;`;
        } else {
            const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
            let menuWidth = this.default_menu_width + widthAdjustment;
            // Set a 300px minimum limit for the menu width
            menuWidth = Math.max(300, menuWidth);
            this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
            this.menu_width = menuWidth;
        }

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    getBestFitColumnsForGrid(iconWidth, grid) {
        const padding = 12;
        const width = this.menu_width - padding;
        const spacing = grid.layout_manager.column_spacing;
        const columns = Math.floor(width / (iconWidth + spacing));
        return columns;
    }

    getIconWidthFromSetting() {
        const gridIconPadding = 10;
        const iconSizeEnum = ArcMenuManager.settings.get_enum('menu-item-grid-icon-size');

        const {width, height_, iconSize_} = Utils.getGridIconSize(iconSizeEnum, this.icon_grid_size);
        return width + gridIconPadding;
    }

    _setGridColumns(grid) {
        let columns = 1;
        if (grid.layout_manager.forceColumns) {
            columns = grid.layout_manager.forceColumns;
        } else if (this.display_type === Constants.DisplayType.GRID) {
            const iconWidth = this.getIconWidthFromSetting();
            columns = this.getBestFitColumnsForGrid(iconWidth, grid);
        }
        grid.setColumns(columns);
    }

    resetScrollBarPosition() {
        const scrollViews = [this.applicationsScrollBox, this.categoriesScrollBox, this.shortcutsScrollBox, this.actionsScrollBox];

        scrollViews.forEach(scrollView => {
            if (scrollView)
                Utils.getScrollViewAdjustments(scrollView).vadjustment.set_value(0);
        });
    }

    _disconnectReloadApps() {
        if (this._reloadAppsOnMenuClosedID) {
            this.arcMenu.disconnect(this._reloadAppsOnMenuClosedID);
            this._reloadAppsOnMenuClosedID = null;
        }
    }

    reloadApplications() {
        // Only reload applications if the menu is closed.
        if (this.arcMenu.isOpen) {
            this.reloadQueued = true;
            if (!this._reloadAppsOnMenuClosedID) {
                this._reloadAppsOnMenuClosedID = this.arcMenu.connect('menu-closed', () => {
                    this.reloadApplications();
                    this.reloadQueued = false;
                    this._disconnectReloadApps();
                });
            }
            return;
        }

        this.searchResults?.setTerms([]);

        this._destroyMenuItems();

        this.activeCategoryItem = null;
        this.activeMenuItem = null;

        this.loadCategories();

        if (this._createExtraButtons)
            this._createExtraButtons();
        if (this._createExtraShortcuts)
            this._createExtraShortcuts();

        this.loadPinnedApps();

        this.setDefaultMenuView();
    }

    _createSortedAppsList() {
        const appList = [];
        this.applicationsMap.forEach((value, key, _map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            const nameA = a.get_name();
            const nameB = b.get_name();
            return nameA.localeCompare(nameB);
        });
        return appList;
    }

    loadCategories(displayType = Constants.DisplayType.LIST) {
        this.applicationsMap = new Map();
        this._tree.load_sync();
        const root = this._tree.get_root_directory();
        const iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) !== GMenu.TreeItemType.INVALID) {
            if (nextType !== GMenu.TreeItemType.DIRECTORY)
                continue;

            const dir = iter.get_directory();
            if (dir.get_is_nodisplay())
                continue;

            const categoryId = dir.get_menu_id();
            const categoryMenuItem = new MW.CategoryMenuItem(this, dir, displayType);
            this.categoryDirectories.set(categoryId, categoryMenuItem);
            this._loadCategory(categoryMenuItem, dir);
        }

        this._sortedAppsList = this._createSortedAppsList();

        let categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.ALL_PROGRAMS);
        if (categoryMenuItem) {
            this.applicationsMap.forEach((value, _key, _map) => {
                // Show Recently Installed Indicator on All Programs category
                if (value.isRecentlyInstalled && !categoryMenuItem.isRecentlyInstalled)
                    categoryMenuItem.setNewAppIndicator(true);
            });

            categoryMenuItem.appList = this._sortedAppsList;
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FAVORITES);
        if (categoryMenuItem)
            this._loadGnomeFavorites(categoryMenuItem);

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FREQUENT_APPS);
        if (categoryMenuItem) {
            const mostUsed = Shell.AppUsage.get_default().get_most_used();
            for (let i = 0; i < mostUsed.length; i++) {
                if (mostUsed[i] && mostUsed[i].get_app_info().should_show())
                    categoryMenuItem.appList.push(mostUsed[i]);
            }
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.PINNED_APPS);
        if (categoryMenuItem) {
            this.hasPinnedApps = true;
            categoryMenuItem.appList = categoryMenuItem.appList.concat(this.pinnedAppsArray);
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.RECENT_FILES);
        if (categoryMenuItem)
            this._loadRecentFiles(categoryMenuItem);
    }

    _loadCategory(categoryMenuItem, dir) {
        const showNewAppsIndicator = !ArcMenuManager.settings.get_boolean('disable-recently-installed-apps');
        const iter = dir.iter();
        let nextType;
        while ((nextType = iter.next()) !== GMenu.TreeItemType.INVALID) {
            if (nextType === GMenu.TreeItemType.ENTRY) {
                const entry = iter.get_entry();
                let id;
                try {
                    id = entry.get_desktop_file_id();
                } catch (e) {
                    continue;
                }

                let app = this.appSys.lookup_app(id);
                if (!app)
                    app = new Shell.App({app_info: entry.get_app_info()});

                const appInfo = app.get_app_info();
                if (!appInfo.should_show())
                    continue;

                let item = this.applicationsMap.get(app);

                if (categoryMenuItem instanceof MW.SubCategoryMenuItem) {
                    const subMenuItem = new MW.ApplicationMenuItem(this, app, Constants.DisplayType.GRID, null, true);
                    categoryMenuItem.appList.push(subMenuItem);
                    continue;
                } else if (!item) {
                    const isContainedInCategory = true;
                    item = new MW.ApplicationMenuItem(this, app, this.display_type, null, isContainedInCategory);
                    categoryMenuItem.appList.push(app);
                    this.applicationsMap.set(app, item);
                }

                if (showNewAppsIndicator && item.isRecentlyInstalled)
                    categoryMenuItem.setNewAppIndicator(true);
            } else if (nextType === GMenu.TreeItemType.DIRECTORY) {
                const subdir = iter.get_directory();
                if (subdir.get_is_nodisplay())
                    continue;

                const showSubMenus = ArcMenuManager.settings.get_boolean('show-category-sub-menus');
                if (showSubMenus) {
                    // Only go one layer deep for sub menus
                    if (categoryMenuItem instanceof MW.SubCategoryMenuItem) {
                        this._loadCategory(categoryMenuItem, subdir);
                    } else {
                        const subCategoryMenuItem = new MW.SubCategoryMenuItem(this, dir, subdir, this.display_type);
                        categoryMenuItem.appList.push(subdir);
                        this.applicationsMap.set(subdir, subCategoryMenuItem);

                        this._loadCategory(subCategoryMenuItem, subdir);
                        subCategoryMenuItem._updateIcon();
                    }
                } else {
                    this._loadCategory(categoryMenuItem, subdir);
                }
            }
        }
        if (categoryMenuItem instanceof MW.SubCategoryMenuItem) {
            categoryMenuItem.populateMenu();
        } else {
            categoryMenuItem.appList.sort((a, b) => {
                const nameA = a.get_name();
                const nameB = b.get_name();
                return nameA.localeCompare(nameB);
            });
        }
    }

    setNewAppIndicator() {
        const disabled = ArcMenuManager.settings.get_boolean('disable-recently-installed-apps');
        if (!disabled && this.categoryDirectories) {
            for (const categoryMenuItem of this.categoryDirectories.values()) {
                categoryMenuItem.setNewAppIndicator(false);
                for (let i = 0; i < categoryMenuItem.appList.length; i++) {
                    const item = this.applicationsMap.get(categoryMenuItem.appList[i]);
                    if (!item)
                        continue;
                    if (item.isRecentlyInstalled) {
                        categoryMenuItem.setNewAppIndicator(true);
                        break;
                    }
                }
            }
        }
    }

    displayCategories(categoriesBox) {
        if (!categoriesBox)
            categoriesBox = this.applicationsBox;

        this._clearActorsFromBox(categoriesBox);

        this._futureActiveItem = false;
        let hasExtraCategory = false;
        let separatorAdded = false;

        for (const categoryMenuItem of this.categoryDirectories.values()) {
            if (categoryMenuItem.get_parent())
                continue;

            const isExtraCategory = categoryMenuItem.isExtraCategory();

            if (!hasExtraCategory) {
                hasExtraCategory = isExtraCategory;
            } else if (!isExtraCategory && !separatorAdded) {
                categoriesBox.add_child(new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL));
                separatorAdded = true;
            }

            categoriesBox.add_child(categoryMenuItem);
            if (!this._futureActiveItem)
                this._futureActiveItem = categoryMenuItem;
        }

        this.activeMenuItem = this._futureActiveItem;
    }

    _loadGnomeFavorites(categoryMenuItem) {
        const appList = AppFavorites.getAppFavorites().getFavorites();

        // Show Recently Installed Indicator on GNOME favorites category
        for (let i = 0; i < appList.length; i++) {
            const item = this.applicationsMap.get(appList[i]);
            if (item && item.isRecentlyInstalled && !categoryMenuItem.isRecentlyInstalled)
                categoryMenuItem.setNewAppIndicator(true);
        }

        categoryMenuItem.appList = appList;
        if (this.activeCategoryType === Constants.CategoryType.FAVORITES)
            categoryMenuItem.displayAppList();
    }

    _loadRecentFiles() {
        if (!this.recentFilesManager)
            this.recentFilesManager = new RecentFilesManager();
    }

    displayRecentFiles(box = this.applicationsBox) {
        this._clearActorsFromBox(box);
        this._futureActiveItem = false;

        const recentFiles = this.recentFilesManager.getRecentFiles();

        let showMoreItem;
        if (recentFiles.length > MAX_RECENT_FILES) {
            // Display MAX_RECENT_FILES amount of most recent items.
            // Show a 'More Recents Files...' menu item at bottom of list.
            recentFiles.splice(MAX_RECENT_FILES);
            const isContainedInCategory = true;
            const placeInfo = new PlaceDisplay.PlaceInfo('special', Gio.File.new_for_uri('recent:///'));
            showMoreItem = new MW.PlaceMenuItem(this, placeInfo, Constants.DisplayType.LIST, isContainedInCategory);
            showMoreItem.forceTitle(_('More Recent Files...'));
            box.add_child(showMoreItem);
        }

        for (const fileUri of recentFiles) {
            this.recentFilesManager.queryInfoAsync(fileUri).then(result => {
                const {recentFile} = result;
                const {error} = result;

                if (error)
                    return;

                const filePath = recentFile.get_path();
                const name = recentFile.get_basename();
                const mimeType = this.recentFilesManager.getMimeType(fileUri);
                const icon = Gio.content_type_get_symbolic_icon(mimeType)?.to_string();
                const isContainedInCategory = true;

                const placeMenuItem = this.createMenuItem({name, icon, 'id': filePath},
                    Constants.DisplayType.LIST, isContainedInCategory);
                if (!(placeMenuItem instanceof MW.PlaceMenuItem))
                    return;
                placeMenuItem.setAsRecentFile(recentFile, () => {
                    try {
                        this.recentFilesManager.removeItem(placeMenuItem.fileUri);
                    } catch (err) {
                        log(err);
                    }
                    box.remove_child(placeMenuItem);
                    box.queue_relayout();
                });
                if (showMoreItem)
                    box.insert_child_below(placeMenuItem, showMoreItem);
                else
                    box.add_child(placeMenuItem);

                if (!this._futureActiveItem) {
                    this._futureActiveItem = placeMenuItem;
                    this.activeMenuItem = this._futureActiveItem;
                }
            }).catch(error => log(error));
        }
    }

    _displayPlaces() {
        const directoryShortcuts = ArcMenuManager.settings.get_value('directory-shortcuts').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            const directoryData = directoryShortcuts[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directoryData, Constants.DisplayType.LIST, isContainedInCategory);
            if (placeMenuItem)
                this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    createMenuItem(itemData, displayType, isContainedInCategory) {
        let {id} = itemData;
        const {name, icon} = itemData;
        let app;

        // Guard against undefined 'id' in itemData
        if (id)
            app = this.appSys.lookup_app(id);

        // Ubunutu 22.04 uses old version of GNOME settings
        if (id === 'org.gnome.Settings.desktop' && !app) {
            id = 'gnome-control-center.desktop';
            app = this.appSys.lookup_app(id);
        }
        if (app)
            return new MW.ShortcutMenuItem(this, itemData, displayType, isContainedInCategory);

        switch (id) {
        case Constants.ShortcutCommands.SEPARATOR: {
            const item = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            item.shouldShow = displayType === Constants.DisplayType.LIST;

            return item;
        }
        case Constants.ShortcutCommands.SPACER: {
            const item = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.EMPTY,
                Constants.SeparatorAlignment.HORIZONTAL);
            item.shouldShow = displayType === Constants.DisplayType.LIST;

            return item;
        }
        case Constants.ShortcutCommands.SOFTWARE: {
            const softwareId = Utils.findSoftwareManager();
            return new MW.ShortcutMenuItem(this, {id: softwareId, name, icon},
                displayType, isContainedInCategory);
        }
        case Constants.ShortcutCommands.SUSPEND:
        case Constants.ShortcutCommands.LOG_OUT:
        case Constants.ShortcutCommands.POWER_OFF:
        case Constants.ShortcutCommands.LOCK:
        case Constants.ShortcutCommands.RESTART:
        case Constants.ShortcutCommands.HYBRID_SLEEP:
        case Constants.ShortcutCommands.HIBERNATE:
        case Constants.ShortcutCommands.SWITCH_USER: {
            const item = new MW.ShortcutMenuItem(this, itemData, displayType, isContainedInCategory);
            item.powerType = Utils.getPowerTypeFromShortcutCommand(id);
            const binding = MW.bindPowerItemVisibility(item);
            item.connect('destroy', () => binding?.unbind());
            return item;
        }
        case Constants.ShortcutCommands.ARCMENU_SETTINGS:
        case Constants.ShortcutCommands.OVERVIEW:
        case Constants.ShortcutCommands.SHOW_APPS:
        case Constants.ShortcutCommands.RUN_COMMAND:
            return new MW.ShortcutMenuItem(this, itemData, displayType, isContainedInCategory);
        default: {
            const placeInfo = this._getPlaceInfo(id, name);
            if (placeInfo)
                return new MW.PlaceMenuItem(this, placeInfo, displayType, isContainedInCategory);
            else
                return new MW.ShortcutMenuItem(this, itemData, displayType, isContainedInCategory);
        }
        }
    }

    _getPlaceInfo(shortcutCommand, shortcutName) {
        let path;
        switch (shortcutCommand) {
        case Constants.ShortcutCommands.DOCUMENTS:
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS);
            break;
        case Constants.ShortcutCommands.DOWNLOADS:
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);
            break;
        case Constants.ShortcutCommands.MUSIC:
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC);
            break;
        case Constants.ShortcutCommands.PICTURES:
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
            break;
        case Constants.ShortcutCommands.VIDEOS:
            path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS);
            break;
        case Constants.ShortcutCommands.HOME:
            path = GLib.get_home_dir();
            break;
        case Constants.ShortcutCommands.NETWORK:
            return new PlaceDisplay.PlaceInfo('network', Gio.File.new_for_uri('network:///'));
        case Constants.ShortcutCommands.RECENT:
            return new PlaceDisplay.PlaceInfo('special', Gio.File.new_for_uri('recent:///'));
        case Constants.ShortcutCommands.COMPUTER:
            return new PlaceDisplay.RootInfo();
        default: {
            if (!shortcutCommand)
                return null;

            const file = Gio.File.new_for_path(shortcutCommand);
            if (file.query_exists(null))
                return new PlaceDisplay.PlaceInfo('special', file, _(shortcutName));
            else
                return null;
        }
        }
        if (!path)
            return null;

        return new PlaceDisplay.PlaceInfo('special', Gio.File.new_for_path(path));
    }

    getSettings(schema, path) {
        const schemaDir = ArcMenuManager.extension.dir.get_child('schemas');
        let schemaSource;
        if (schemaDir.query_exists(null)) {
            schemaSource = Gio.SettingsSchemaSource.new_from_directory(
                schemaDir.get_path(),
                Gio.SettingsSchemaSource.get_default(),
                false
            );
        } else {
            schemaSource = Gio.SettingsSchemaSource.get_default();
        }

        const schemaObj = schemaSource.lookup(schema, true);
        if (!schemaObj) {
            log(
                `Schema ${schema} could not be found for extension ${
                    ArcMenuManager.extension.metadata.uuid}. Please check your installation.`
            );
            return null;
        }

        const args = {settings_schema: schemaObj};
        if (path)
            args.path = path;

        return new Gio.Settings(args);
    }

    _createPinnedAppItem(pinnedAppData) {
        const categoryMenuItem = this.categoryDirectories
            ? this.categoryDirectories.get(Constants.CategoryType.PINNED_APPS) : null;
        const isContainedInCategory = !!categoryMenuItem;

        let pinnedAppsMenuItem;
        if (pinnedAppData.isFolder) {
            const folderSchema = `${ArcMenuManager.settings.schema_id}.pinned-apps-folders`;
            const folderPath = `${ArcMenuManager.settings.path}pinned-apps-folders/${pinnedAppData.id}/`;
            try {
                const folderSettings = this.getSettings(folderSchema, folderPath);

                const folderAppList = folderSettings.get_value('pinned-apps').deepUnpack();
                pinnedAppsMenuItem = new MW.PinnedAppsFolderMenuItem(this, pinnedAppData, folderSettings, folderAppList,
                    this.display_type, isContainedInCategory);
            } catch (e) {
                console.log(`Error creating new pinned apps folder: ${e}`);
                return null;
            }
        } else {
            pinnedAppsMenuItem = new MW.PinnedAppsMenuItem(this, pinnedAppData,
                this.display_type, isContainedInCategory);
        }

        pinnedAppsMenuItem.connectObject('pinned-apps-changed', (_self, newPinnedAppsList) => {
            this.pinnedAppsArray = newPinnedAppsList;
            const array = [];
            for (let j = 0; j < newPinnedAppsList.length; j++)
                array.push(newPinnedAppsList[j].pinnedAppData);

            ArcMenuManager.settings.set_value('pinned-apps', new GLib.Variant('aa{ss}', array));
        }, this);

        pinnedAppsMenuItem.connect('destroy', () => pinnedAppsMenuItem.disconnectObject(this));

        return pinnedAppsMenuItem;
    }

    _loadPinnedApps() {
        this.pinnedAppsArray = [];

        const pinnedAppsList = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();

        pinnedAppsList.forEach(pinnedAppData => {
            const id = pinnedAppData.id;

            let item = this.pinnedAppsMap.get(id);
            if (item) {
                item.updateData(pinnedAppData);
            } else {
                item = this._createPinnedAppItem(pinnedAppData);
                if (item.shouldShow)
                    this.pinnedAppsMap.set(id, item);
            }
            if (item.shouldShow && !this.pinnedAppsArray.includes(item))
                this.pinnedAppsArray.push(item);
        });
        return this.pinnedAppsArray;
    }

    _removePinnedApp(item) {
        this.pinnedAppsMap.delete(item.pinnedAppData.id);
        this._pinnedAppsGrid.removeItem(item);
    }

    loadPinnedApps() {
        if (!this.pinnedAppsMap) {
            this.pinnedAppsMap = new Map();
            this.pinnedAppsArray = [];
            this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        }

        const oldPinnedApps = this.pinnedAppsArray;
        const oldPinnedAppIds = this.pinnedAppsArray.map(item => item.pinnedAppData.id);

        const newPinnedApps = this._loadPinnedApps();
        const newPinnedAppIds = newPinnedApps.map(item => item.pinnedAppData.id);

        const addedPinnedApps = newPinnedApps.filter(item => !oldPinnedAppIds.includes(item.pinnedAppData.id));
        const removedPinnedApps = oldPinnedApps.filter(item => !newPinnedAppIds.includes(item.pinnedAppData.id));

        // Remove old app icons
        removedPinnedApps.forEach(item => {
            this._removePinnedApp(item);
            item.disconnectObject(this);
            item.destroy();
        });

        // Add new app icons, or move existing ones
        newPinnedApps.forEach(item => {
            const index = this.pinnedAppsArray.indexOf(item);
            const position = this._pinnedAppsGrid.getItemPosition(item);
            if (addedPinnedApps.includes(item))
                this._pinnedAppsGrid.addItem(item, index);
            else if (position !== index)
                this._pinnedAppsGrid.moveItem(item, index);
        });
    }

    displayPinnedApps() {
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        this._clearActorsFromBox(this.applicationsBox);

        this.applicationsBox.add_child(this._pinnedAppsGrid);
        this._setGridColumns(this._pinnedAppsGrid);
        const firstItem = this._pinnedAppsGrid.getItemAt(0);
        this.activeMenuItem = firstItem;
    }

    _redisplayPlaces(id) {
        this._placesSections[id].destroy_all_children();
        this._createPlaces(id);
    }

    _createPlaces(id) {
        const places = this.placesManager.get(id);

        const applicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        const haveApplicationShortcuts = applicationShortcuts.length > 0;
        const haveNetworkDevices = this.placesManager.get('network').length > 0;
        const haveExternalDevices = this.placesManager.get('devices').length > 0;
        const haveBookmarks = this.placesManager.get('bookmarks').length > 0;

        if (ArcMenuManager.settings.get_boolean('show-bookmarks')) {
            if (id === 'bookmarks' && haveBookmarks) {
                const needsSeparator = haveApplicationShortcuts;
                this._addPlacesToMenu(id, places, needsSeparator);
            }
        }
        if (ArcMenuManager.settings.get_boolean('show-external-devices')) {
            if (id === 'devices' && haveExternalDevices) {
                const needsSeparator = !haveNetworkDevices && (haveBookmarks || haveApplicationShortcuts);
                this._addPlacesToMenu(id, places, needsSeparator);
            }
            if (id === 'network' && haveNetworkDevices) {
                const needsSeparator = haveBookmarks || haveApplicationShortcuts;
                this._addPlacesToMenu(id, places, needsSeparator);
            }
        }
    }

    _addPlacesToMenu(id, places, needsSeparator) {
        for (let i = 0; i < places.length; i++) {
            const item = new MW.PlaceMenuItem(this, places[i]);
            this._placesSections[id].add_child(item);
        }

        if (needsSeparator) {
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this._placesSections[id].add_child(separator);
        }
    }

    setActiveCategory(categoryItem, setActive = true) {
        if (this.activeCategoryItem) {
            this.activeCategoryItem.isActiveCategory = false;
            this.activeCategoryItem.remove_style_pseudo_class('active');
            this.activeCategoryItem = null;
        }

        if (!setActive)
            return;

        this.activeCategoryItem = categoryItem;
        this.activeCategoryItem.isActiveCategory = true;
        this.activeCategoryItem.add_style_pseudo_class('active');
    }

    populateFrequentAppsList(categoryMenuItem) {
        categoryMenuItem.appList = [];
        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show())
                categoryMenuItem.appList.push(mostUsed[i]);
        }
    }

    _clearActorsFromBox(box) {
        this.blockHoverState = true;
        this.recentFilesManager?.cancelCurrentQueries();
        if (!box) {
            box = this.applicationsBox;
            this.activeCategoryType = -1;
        }
        const parent = box.get_parent();
        if (parent && parent instanceof St.ScrollView)
            Utils.getScrollViewAdjustments(parent).vadjustment.set_value(0);
        const actors = box.get_children();
        for (let i = 0; i < actors.length; i++) {
            const actor = actors[i];
            box.remove_child(actor);
        }
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _displayAppList(apps, category, grid) {
        this.activeCategoryType = category;
        if (grid.removeAllItems)
            grid.removeAllItems();
        else
            grid.remove_all_children();

        this._futureActiveItem = false;
        let currentCharacter;

        const groupAllAppsListView = ArcMenuManager.settings.get_boolean('group-apps-alphabetically-list-layouts');
        const groupAllAppsGridView = ArcMenuManager.settings.get_boolean('group-apps-alphabetically-grid-layouts');
        const isGrid = this.display_type === Constants.DisplayType.GRID;
        const isList = this.display_type === Constants.DisplayType.LIST;

        const groupAllAppsAlphabetically = (groupAllAppsListView && isList) || (groupAllAppsGridView && isGrid);

        this._setGridColumns(grid);

        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            let item;

            if (category === Constants.CategoryType.PINNED_APPS || category === Constants.CategoryType.HOME_SCREEN) {
                item = app;
                if (!item.shouldShow)
                    continue;
            } else {
                item = this.applicationsMap.get(app);
                if (!item) {
                    item = new MW.ApplicationMenuItem(this, app, this.display_type);
                    this.applicationsMap.set(app, item);
                }
            }

            const parent = item.get_parent();
            if (parent)
                parent.remove_child(item);

            if (groupAllAppsAlphabetically && category === Constants.CategoryType.ALL_PROGRAMS) {
                const appNameFirstChar = app.get_name().charAt(0).toLowerCase();
                if (currentCharacter !== appNameFirstChar) {
                    currentCharacter = appNameFirstChar;

                    const label = this._createLabelWithSeparator(currentCharacter.toUpperCase());
                    grid.appendItem(label);
                }
            }

            grid.appendItem(item);

            if (!this._futureActiveItem && grid === this.applicationsGrid)
                this._futureActiveItem = item;
        }

        if (this.applicationsBox && grid === this.applicationsGrid && !this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);
        if (this._futureActiveItem)
            this.activeMenuItem = this._futureActiveItem;
    }

    displayAllApps() {
        this._clearActorsFromBox();
        this._displayAppList(this._sortedAppsList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);
    }

    get activeMenuItem() {
        return this._activeMenuItem;
    }

    set activeMenuItem(item) {
        // track the active menu item for keyboard navigation
        const itemChanged = item !== this._activeMenuItem;
        if (itemChanged)
            this._activeMenuItem = item;
    }

    _onSearchEntryChanged(searchEntry, searchString) {
        if (searchEntry.isEmpty()) {
            if (this.applicationsBox.contains(this.searchResults))
                this.applicationsBox.remove_child(this.searchResults);

            this.setDefaultMenuView();
        } else {
            if (this.activeCategoryItem)
                this.setActiveCategory(null, false);

            Utils.getScrollViewAdjustments(this.applicationsScrollBox).vadjustment.set_value(0);

            if (!this.applicationsBox.contains(this.searchResults)) {
                this._clearActorsFromBox();
                this.applicationsBox.add_child(this.searchResults);
            }

            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;

            searchString = searchString.replace(/^\s+/g, '').replace(/\s+$/g, '');
            if (searchString === '') {
                this.searchResults.setTerms([]);
            } else {
                // Prevent a mouse hover event from setting a new active menu item, until next mouse move event.
                // Used to prevent the top search result from instantly changing
                // if users mouse is over a differnt menu item.
                this.blockHoverState = true;

                // Prevent Category Mouse Hover activation while search results are active.
                this._setCategoriesBoxInactive(true);

                this.searchResults.setTerms(searchString.split(/\s+/));
            }
        }
    }

    _onSearchEntryKeyPress(searchEntry, event) {
        const symbol = event.get_key_symbol();
        switch (symbol) {
        case Clutter.KEY_Up:
        case Clutter.KEY_Down:
        case Clutter.KEY_Left:
        case Clutter.KEY_Right: {
            let direction;
            if (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up)
                return Clutter.EVENT_PROPAGATE;
            if (symbol === Clutter.KEY_Right)
                direction = St.DirectionType.RIGHT;
            if (symbol === Clutter.KEY_Left)
                direction = St.DirectionType.LEFT;

            let cursorPosition = this.searchEntry.clutter_text.get_cursor_position();

            if (cursorPosition === Constants.CaretPosition.END && symbol === Clutter.KEY_Right)
                cursorPosition = Constants.CaretPosition.END;
            else if (cursorPosition === Constants.CaretPosition.START && symbol === Clutter.KEY_Left)
                cursorPosition = Constants.CaretPosition.START;
            else
                cursorPosition = Constants.CaretPosition.MIDDLE;

            if (cursorPosition === Constants.CaretPosition.END || cursorPosition === Constants.CaretPosition.START) {
                let navigateActor = this.activeMenuItem;
                if (this.searchResults.hasActiveResult()) {
                    navigateActor = this.searchResults.getTopResult();
                    if (navigateActor.has_style_pseudo_class('active')) {
                        navigateActor.grab_key_focus();
                        navigateActor.remove_style_pseudo_class('active');
                        return this.navigate_focus(navigateActor, direction, false);
                    }
                    navigateActor.grab_key_focus();
                    return Clutter.EVENT_STOP;
                }
                if (!navigateActor)
                    return Clutter.EVENT_PROPAGATE;
                return this.navigate_focus(navigateActor, direction, false);
            }
            return Clutter.EVENT_PROPAGATE;
        }
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }

    _onMainBoxKeyPress(actor, event) {
        // Prevent a mouse hover event from setting a new active menu item, until next mouse move event.
        this.blockHoverState = true;

        // Prevent Category Mouse Hover activation while search results are active.
        this._setCategoriesBoxInactive(true);

        const symbol = event.get_key_symbol();
        const unicode = Clutter.keysym_to_unicode(symbol);

        /*
        * Pass ctrl key event to searchEntry.
        * Useful for paste event (ctrl+v),
        * if searchEntry entry doesn't have key focus
        */
        if (this.searchEntry && (symbol === Clutter.KEY_Control_L || symbol === Clutter.KEY_Control_R)) {
            global.stage.set_key_focus(this.searchEntry.clutter_text);
            this.searchEntry.clutter_text.event(event, false);
            return Clutter.EVENT_PROPAGATE;
        }

        switch (symbol) {
        case Clutter.KEY_BackSpace:
            if (this.searchEntry && !this.searchEntry.hasKeyFocus() && !this.searchEntry.isEmpty()) {
                this.searchEntry.grab_key_focus();
                const newText = this.searchEntry.getText().slice(0, -1);
                this.searchEntry.setText(newText);
            }
            return Clutter.EVENT_PROPAGATE;
        case Clutter.KEY_Tab:
        case Clutter.KEY_ISO_Left_Tab:
        case Clutter.KEY_Up: case Clutter.KEY_KP_Up:
        case Clutter.KEY_Down: case Clutter.KEY_KP_Down:
        case Clutter.KEY_Left: case Clutter.KEY_KP_Left:
        case Clutter.KEY_Right: case Clutter.KEY_KP_Right: {
            let direction;
            if (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_KP_Down)
                direction = St.DirectionType.DOWN;
            else if (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_KP_Right)
                direction = St.DirectionType.RIGHT;
            else if (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_KP_Up)
                direction = St.DirectionType.UP;
            else if (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_KP_Left)
                direction = St.DirectionType.LEFT;
            else if (symbol === Clutter.KEY_Tab)
                direction = St.DirectionType.TAB_FORWARD;
            else if (symbol === Clutter.KEY_ISO_Left_Tab)
                direction = St.DirectionType.TAB_BACKWARD;

            if (this.searchEntry.hasKeyFocus() &&
                this.searchResults.hasActiveResult() && this.searchResults.get_parent()) {
                const topSearchResult = this.searchResults.getTopResult();
                if (topSearchResult.has_style_pseudo_class('active')) {
                    topSearchResult.grab_key_focus();
                    topSearchResult.remove_style_pseudo_class('active');
                    return actor.navigate_focus(global.stage.key_focus, direction, false);
                }
                topSearchResult.grab_key_focus();
                return Clutter.EVENT_STOP;
            } else if (global.stage.key_focus === this && symbol === Clutter.KEY_Up) {
                return actor.navigate_focus(global.stage.key_focus, direction, true);
            } else if (global.stage.key_focus === this) {
                this.activeMenuItem.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            return actor.navigate_focus(global.stage.key_focus, direction, false);
        }
        case Clutter.KEY_KP_Enter:
        case Clutter.KEY_Return:
        case Clutter.KEY_Escape:
            return Clutter.EVENT_PROPAGATE;
        default:
            if (unicode !== 0 && this.searchEntry) {
                global.stage.set_key_focus(this.searchEntry.clutter_text);
                this.searchEntry.clutter_text.event(event, false);
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        ArcMenuManager.settings.disconnectObject(this);
        this._disconnectReloadApps();

        AppFavorites.getAppFavorites().disconnectObject(this);

        if (this.recentFilesManager) {
            this.recentFilesManager.destroy();
            this.recentFilesManager = null;
        }

        this._tree.disconnectObject(this);
        delete this._tree;

        if (this.applicationsBox) {
            if (this.applicationsBox.contains(this.applicationsGrid))
                this.applicationsBox.remove_child(this.applicationsGrid);
        }

        if (this.network) {
            this.network.destroy();
            this.networkMenuItem.destroy();
            this.network = null;
            this.networkMenuItem = null;
        }

        if (this.computer) {
            this.computer.destroy();
            this.computerMenuItem.destroy();
            this.computer = null;
            this.computerMenuItem = null;
        }

        if (this.placesManager) {
            for (const id in this._placesSections) {
                if (Object.hasOwn(this._placesSections, id)) {
                    const children = this._placesSections[id].get_children();
                    children.forEach(child => {
                        child.destroy();
                        child = null;
                    });
                }
            }
            this.placesManager.destroy();
            this.placesManager = null;
        }

        if (this.searchEntry) {
            this.searchEntry.destroy();
            this.searchEntry = null;
        }

        if (this.searchResults) {
            this.searchResults.setTerms([]);
            this.searchResults.destroy();
            this.searchResults = null;
        }

        this._destroyMenuItems();

        this._pinnedAppsGrid.destroy();
        this._pinnedAppsGrid = null;
        this.applicationsGrid.destroy();
        this.applicationsGrid = null;

        this._sortedAppsList = null;
        this._delegate = null;
        this._menuButton = null;
        this.contextMenuManager = null;
        this.subMenuManager = null;
        this.arcMenu = null;
        this.iconTheme = null;
        this.appSys = null;
        this.activeCategoryItem = null;
        this.activeMenuItem = null;
        this._futureActiveItem = null;
    }

    _destroyMenuItems() {
        if (this.pinnedAppsMap) {
            this.pinnedAppsMap.forEach(menuItem => menuItem.destroy());
            this.pinnedAppsMap = null;
        }
        this.pinnedAppsArray = null;

        if (this.applicationsMap) {
            this.applicationsMap.forEach(menuItem => menuItem.destroy());
            this.applicationsMap = null;
        }

        if (this.categoryDirectories) {
            this.categoryDirectories.forEach(menuItem => menuItem.destroy());
            this.categoryDirectories = null;
        }
    }

    _setCategoriesBoxInactive(inactive) {
        const activateOnHover = ArcMenuManager.settings.get_boolean('activate-on-hover');
        if (!activateOnHover || !this.categoriesBox || !this.supports_category_hover_activation)
            return;

        this.blockCategoryHoverActivation = inactive;
        const ANIMATION_TIME = 200;

        this.categoriesBox.ease({
            mode: Clutter.AnimationMode.LINEAR,
            duration: ANIMATION_TIME,
            opacity: inactive ? 96 : 255,
        });
    }

    _createScrollBox(params) {
        const scrollBox = new St.ScrollView({
            ...params,
            clip_to_allocation: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
        });

        // With overlay_scrollbars = true, the scrollbar appears behind the menu items
        // Maybe a bug in GNOME? Fix it with this.
        scrollBox.get_children().forEach(child => {
            if (child instanceof St.ScrollBar)
                child.z_position = 1;
        });

        const panAction = new Clutter.PanAction({interpolate: true});
        panAction.connect('pan', action => this._onPan(action, scrollBox));
        this.add_action(panAction);

        return scrollBox;
    }

    _onPan(action, scrollBox) {
        if (this._menuButton.tooltipShowingID) {
            GLib.source_remove(this._menuButton.tooltipShowingID);
            this._menuButton.tooltipShowingID = null;
        }
        if (this._menuButton.tooltip.visible)
            this._menuButton.tooltip.hide(true);

        const [dist_, dx_, dy] = action.get_motion_delta(0);
        const {vadjustment} = Utils.getScrollViewAdjustments(scrollBox);
        vadjustment.value -=  dy;
        return false;
    }

    _createLabelWithSeparator(headerLabel) {
        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.HEADER_LABEL,
            Constants.SeparatorAlignment.HORIZONTAL, headerLabel);
        return separator;
    }

    createLabelRow(title) {
        const labelRow = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            style: 'padding-top: 9px; padding-bottom: 9px;',
            style_class: 'popup-menu-item arcmenu-menu-item',
            reactive: true,
            track_hover: false,
            can_focus: false,
        });
        const label = new St.Label({
            text: _(title),
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold;',
        });
        labelRow.add_child(label);
        labelRow.label = label;
        return labelRow;
    }

    _createNavigationRow(labelTitle, buttonDirection, buttonTitle, buttonAction) {
        const navButton = this.createLabelRow(labelTitle);

        navButton.style = 'padding: 0px 25px;';

        let button;
        if (buttonDirection === Constants.Direction.GO_NEXT)
            button = new MW.GoNextButton(this, buttonTitle, buttonAction);
        else if (buttonDirection === Constants.Direction.GO_PREVIOUS)
            button = new MW.GoPreviousButton(this, buttonAction);

        navButton.activate = event => button.activate(event);
        navButton.add_child(button);
        return navButton;
    }
}
