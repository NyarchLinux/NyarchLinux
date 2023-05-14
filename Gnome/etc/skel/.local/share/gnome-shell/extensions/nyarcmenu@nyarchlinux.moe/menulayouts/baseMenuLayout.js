/* exported getMenuLayoutEnum, BaseMenuLayout */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GLib, Gio, GMenu, GObject, Shell, St} = imports.gi;
const AppFavorites = imports.ui.appFavorites;
const Config = imports.misc.config;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const {RecentFilesManager} = Me.imports.recentFilesManager;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

const Search = Config.PACKAGE_VERSION < '43' ? Me.imports.search : Me.imports.gnome43.search;
const MAX_RECENT_FILES = 25;

/**
 * @returns Returns the current Constants.MenuLayout Enum
 */
function getMenuLayoutEnum() {
    return null;
}

// This class handles the core functionality of all the menu layouts.
// Each menu layout extends this class.
var BaseMenuLayout = class ArcMenuBaseMenuLayout extends St.BoxLayout {
    static [GObject.properties] = {
        'has-search': GObject.ParamSpec.boolean(
            'has-search', 'has-search', 'has-search',
            GObject.ParamFlags.READWRITE, true),
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
        'icon-grid-style': GObject.ParamSpec.string(
            'icon-grid-style', 'icon-grid-style', 'icon-grid-style',
            GObject.ParamFlags.READWRITE, ''),
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
        this.menuButton = menuButton;

        this.contextMenuManager = menuButton.contextMenuManager;
        this.subMenuManager = menuButton.subMenuManager;
        this.arcMenu = menuButton.arcMenu;
        this._focusChild = null;
        this.hasPinnedApps = false;
        this.activeCategoryType = -1;
        this._disableFadeEffect = Me.settings.get_boolean('disable-scrollview-fade-effect');

        this.connect('key-press-event', this._onMainBoxKeyPress.bind(this));

        this._tree = new GMenu.Tree({menu_basename: 'applications.menu'});
        this._tree.connectObject('changed', () => this.reloadApplications(), this);

        AppFavorites.getAppFavorites().connectObject('changed', () => {
            if (this.categoryDirectories) {
                const categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FAVORITES);
                if (categoryMenuItem)
                    this._loadGnomeFavorites(categoryMenuItem);
            }
        }, this);

        if (this.has_search) {
            this.searchResults = new Search.SearchResults(this);
            this.searchBox = new MW.SearchBox(this);
            this.searchBox.connectObject('search-changed', this._onSearchBoxChanged.bind(this), this);
            this.searchBox.connectObject('entry-key-press', this._onSearchBoxKeyPress.bind(this), this);
        }

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.column_spacing,
            row_spacing: this.row_spacing,
        });
        this.applicationsGrid = new St.Widget({
            x_expand: true,
            x_align: this.display_type === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER,
            layout_manager: layout,
        });
        layout.hookup_style(this.applicationsGrid);

        this.connect('destroy', () => this._onDestroy());
    }

    setDefaultMenuView() {
        if (this.has_search) {
            this.searchBox.clearWithoutSearchChangeEvent();
            this.searchResults.setTerms([]);
        }

        this._clearActorsFromBox();
        this.resetScrollBarPosition();
    }

    updateWidth(setDefaultMenuView, leftPanelWidthOffset = 0, rightPanelWidthOffset = 0) {
        if (this.is_dual_panel) {
            const leftPanelWidth = Me.settings.get_int('left-panel-width') + leftPanelWidthOffset;
            const rightPanelWidth = Me.settings.get_int('right-panel-width') + rightPanelWidthOffset;
            this.leftBox.style = `width: ${leftPanelWidth}px;`;
            this.rightBox.style = `width: ${rightPanelWidth}px;`;
        } else {
            const widthAdjustment = Me.settings.get_int('menu-width-adjustment');
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
        let gridIconWidth;
        const iconSizeEnum = Me.settings.get_enum('menu-item-grid-icon-size');

        if (iconSizeEnum === Constants.GridIconSize.DEFAULT) {
            return this.getIconWidthFromStyleClass(this.icon_grid_style);
        } else {
            Constants.GridIconInfo.forEach(info => {
                if (iconSizeEnum === info.ENUM)
                    gridIconWidth = info.SIZE;
            });
        }
        return gridIconWidth;
    }

    getIconWidthFromStyleClass(name) {
        let gridIconWidth;

        Constants.GridIconInfo.forEach(info => {
            if (name === info.NAME)
                gridIconWidth = info.SIZE;
        });
        return gridIconWidth;
    }

    resetScrollBarPosition() {
        this.applicationsScrollBox?.vscroll.adjustment.set_value(0);
        this.categoriesScrollBox?.vscroll.adjustment.set_value(0);
        this.shortcutsScrollBox?.vscroll.adjustment.set_value(0);
        this.actionsScrollBox?.vscroll.adjustment.set_value(0);
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

        this.searchResults.setTerms([]);

        if (this.applicationsMap) {
            this.applicationsMap.forEach((value, _key, _map) => {
                value.destroy();
            });
            this.applicationsMap = null;
        }

        if (this.categoryDirectories) {
            this.categoryDirectories.forEach((value, _key, _map) => {
                value.destroy();
            });
            this.categoryDirectories = null;
        }
        this.activeCategoryItem = null;
        this.activeMenuItem = null;

        this.loadCategories();

        if (this._createExtraButtons)
            this._createExtraButtons();
        if (this._createExtraShortcuts)
            this._createExtraShortcuts();

        this.setDefaultMenuView();
    }

    loadCategories(displayType = Constants.DisplayType.LIST) {
        this.applicationsMap = new Map();
        this._tree.load_sync();
        const root = this._tree.get_root_directory();
        const iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) !== GMenu.TreeItemType.INVALID) {
            if (nextType === GMenu.TreeItemType.DIRECTORY) {
                const dir = iter.get_directory();
                if (!dir.get_is_nodisplay()) {
                    const categoryId = dir.get_menu_id();
                    const categoryMenuItem = new MW.CategoryMenuItem(this, dir, displayType);
                    this.categoryDirectories.set(categoryId, categoryMenuItem);
                    this._loadCategory(categoryMenuItem, dir);
                }
            }
        }

        let categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.ALL_PROGRAMS);
        if (categoryMenuItem) {
            const appList = [];
            this.applicationsMap.forEach((value, key, _map) => {
                appList.push(key);
                // Show Recently Installed Indicator on All Programs category
                if (value.isRecentlyInstalled && !categoryMenuItem.isRecentlyInstalled)
                    categoryMenuItem.setNewAppIndicator(true);
            });
            appList.sort((a, b) => {
                return a.get_name().toLowerCase() > b.get_name().toLowerCase();
            });
            categoryMenuItem.appList = appList;
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
        const showNewAppsIndicator = !Me.settings.get_boolean('disable-recently-installed-apps');
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
                let app = Shell.AppSystem.get_default().lookup_app(id);
                if (!app)
                    app = new Shell.App({app_info: entry.get_app_info()});
                if (app.get_app_info().should_show()) {
                    let item = this.applicationsMap.get(app);
                    if (!item) {
                        const isContainedInCategory = true;
                        item = new MW.ApplicationMenuItem(this, app, this.display_type, null, isContainedInCategory);
                    }
                    categoryMenuItem.appList.push(app);
                    this.applicationsMap.set(app, item);

                    if (showNewAppsIndicator && item.isRecentlyInstalled)
                        categoryMenuItem.setNewAppIndicator(true);
                }
            } else if (nextType === GMenu.TreeItemType.DIRECTORY) {
                const subdir = iter.get_directory();
                if (!subdir.get_is_nodisplay())
                    this._loadCategory(categoryMenuItem, subdir);
            }
        }
    }

    setNewAppIndicator() {
        const disabled = Me.settings.get_boolean('disable-recently-installed-apps');
        if (!disabled) {
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
                categoriesBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
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

        for (const file of recentFiles) {
            this.recentFilesManager.queryInfoAsync(file).then(result => {
                const {recentFile} = result;
                const {error} = result;

                if (error)
                    return;

                const gioFile = Gio.File.new_for_uri(recentFile.get_uri());
                const filePath = gioFile.get_path();
                const name = recentFile.get_display_name();
                const icon = Gio.content_type_get_symbolic_icon(recentFile.get_mime_type()).to_string();
                const isContainedInCategory = true;

                const placeMenuItem = this.createMenuItem([name, icon, filePath],
                    Constants.DisplayType.LIST, isContainedInCategory);
                placeMenuItem.setAsRecentFile(recentFile, () => {
                    try {
                        const {recentManager} = this.recentFilesManager;
                        recentManager.remove_item(placeMenuItem.fileUri);
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
        const directoryShortcuts = Me.settings.get_value('directory-shortcuts-list').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            const directory = directoryShortcuts[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.LIST, isContainedInCategory);
            if (placeMenuItem)
                this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    createMenuItem(menuItemArray, displayType, isContainedInCategory) {
        let [shortcutName, shortcutIcon, shortcutCommand] = menuItemArray;
        let app = Shell.AppSystem.get_default().lookup_app(shortcutCommand);

        // Ubunutu 22.04 uses old version of GNOME settings
        if (shortcutCommand === 'org.gnome.Settings.desktop' && !app) {
            shortcutCommand = 'gnome-control-center.desktop';
            app = Shell.AppSystem.get_default().lookup_app(shortcutCommand);
        }

        if (app)
            return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);

        switch (shortcutCommand) {
        case Constants.ShortcutCommands.SOFTWARE: {
            const software = Utils.findSoftwareManager();
            return new MW.ShortcutMenuItem(this, [shortcutName, shortcutIcon, software],
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
            const item = new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);
            item.powerType = Utils.getPowerTypeFromShortcutCommand(shortcutCommand);
            MW.bindPowerItemVisibility(item);
            return item;
        }
        case Constants.ShortcutCommands.ARCMENU_SETTINGS:
        case Constants.ShortcutCommands.OVERVIEW:
        case Constants.ShortcutCommands.SHOW_APPS:
        case Constants.ShortcutCommands.RUN_COMMAND:
            return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);
        default: {
            const placeInfo = this._getPlaceInfo(shortcutCommand, shortcutName);
            if (placeInfo)
                return new MW.PlaceMenuItem(this, placeInfo, displayType, isContainedInCategory);
            else
                return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);
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

    loadPinnedApps() {
        const pinnedApps = Me.settings.get_strv('pinned-app-list');

        this.pinnedAppsArray = null;
        this.pinnedAppsArray = [];

        const categoryMenuItem = this.categoryDirectories
            ? this.categoryDirectories.get(Constants.CategoryType.PINNED_APPS) : null;
        const isContainedInCategory = !!categoryMenuItem;

        for (let i = 0; i < pinnedApps.length; i += 3) {
            const pinnedAppData = [pinnedApps[i], pinnedApps[i + 1], pinnedApps[i + 2]];
            const pinnedAppsMenuItem = new MW.PinnedAppsMenuItem(this, pinnedAppData,
                this.display_type, isContainedInCategory);
            pinnedAppsMenuItem.connectObject('saveSettings', () => {
                const array = [];
                for (let j = 0; j < this.pinnedAppsArray.length; j++) {
                    array.push(this.pinnedAppsArray[j]._name);
                    array.push(this.pinnedAppsArray[j]._icon);
                    array.push(this.pinnedAppsArray[j]._command);
                }
                Me.settings.set_strv('pinned-app-list', array);
            }, this);
            this.pinnedAppsArray.push(pinnedAppsMenuItem);
        }

        if (categoryMenuItem) {
            categoryMenuItem.appList = null;
            categoryMenuItem.appList = [];
            categoryMenuItem.appList = categoryMenuItem.appList.concat(this.pinnedAppsArray);
        }
    }

    displayPinnedApps() {
        this._clearActorsFromBox();
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
    }

    _redisplayPlaces(id) {
        this._placesSections[id].destroy_all_children();
        this._createPlaces(id);
    }

    _createPlaces(id) {
        const places = this.placesManager.get(id);

        const haveApplicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack().length > 0;
        const haveNetworkDevices = this.placesManager.get('network').length > 0;
        const haveExternalDevices = this.placesManager.get('devices').length > 0;
        const haveBookmarks = this.placesManager.get('bookmarks').length > 0;

        if (Me.settings.get_boolean('show-bookmarks')) {
            if (id === 'bookmarks' && haveBookmarks) {
                const needsSeparator = haveApplicationShortcuts;
                this._addPlacesToMenu(id, places, needsSeparator);
            }
        }
        if (Me.settings.get_boolean('show-external-devices')) {
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
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT,
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

        this._futureActiveItem = categoryItem;
        this.activeMenuItem = categoryItem;
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
        this.blockActiveState = true;
        this.recentFilesManager?.cancelCurrentQueries();
        if (!box) {
            box = this.applicationsBox;
            this.activeCategoryType = -1;
        }
        const parent = box.get_parent();
        if (parent && parent instanceof St.ScrollView)
            parent.vscroll.adjustment.set_value(0);
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
        grid.remove_all_children();
        let count = 0;
        let top = -1;
        let left = 0;
        this._futureActiveItem = false;
        let currentCharacter;
        const alphabetizeAllPrograms = Me.settings.get_boolean('alphabetize-all-programs') &&
            this.display_type === Constants.DisplayType.LIST;
        const rtl = this.get_text_direction() === Clutter.TextDirection.RTL;

        let columns = 1;
        if (grid.layout_manager.forceGridColumns) {
            columns = grid.layout_manager.forceGridColumns;
        } else if (this.display_type === Constants.DisplayType.GRID) {
            const iconWidth = this.getIconWidthFromSetting();
            columns = this.getBestFitColumnsForGrid(iconWidth, grid);
        }
        grid.layout_manager.gridColumns = columns;

        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            let item;
            let shouldShow = true;

            if (category === Constants.CategoryType.PINNED_APPS || category === Constants.CategoryType.HOME_SCREEN) {
                item = app;
                if (!item.shouldShow)
                    shouldShow = false;
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

            if (shouldShow) {
                if (!rtl && (count % columns === 0)) {
                    top++;
                    left = 0;
                } else if (rtl && (left === 0)) {
                    top++;
                    left = columns;
                }

                if (alphabetizeAllPrograms && category === Constants.CategoryType.ALL_PROGRAMS) {
                    const appNameFirstChar = app.get_name().charAt(0).toLowerCase();
                    if (currentCharacter !== appNameFirstChar) {
                        currentCharacter = appNameFirstChar;

                        const label = this._createLabelWithSeparator(currentCharacter.toUpperCase());
                        grid.layout_manager.attach(label, left, top, 1, 1);
                        top++;
                    }
                }

                grid.layout_manager.attach(item, left, top, 1, 1);
                item.gridLocation = [left, top];

                if (!rtl)
                    left++;
                else if (rtl)
                    left--;
                count++;

                if (!this._futureActiveItem && grid === this.applicationsGrid)
                    this._futureActiveItem = item;
            }
        }
        if (this.applicationsBox && !this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);
        if (this._futureActiveItem)
            this.activeMenuItem = this._futureActiveItem;
    }

    displayAllApps() {
        const appList = [];
        this.applicationsMap.forEach((value, key, _map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        this._clearActorsFromBox();
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);
    }

    get activeMenuItem() {
        return this._activeMenuItem;
    }

    set activeMenuItem(item) {
        const itemChanged = item !== this._activeMenuItem;
        if (itemChanged) {
            this._activeMenuItem = item;
            if (this.arcMenu.isOpen && item && this.supports_category_hover_activation)
                item.grab_key_focus();
        }
    }

    _onSearchBoxChanged(searchBox, searchString) {
        if (searchBox.isEmpty()) {
            if (this.applicationsBox.contains(this.searchResults))
                this.applicationsBox.remove_child(this.searchResults);

            this.setDefaultMenuView();
        } else {
            if (this.activeCategoryItem)
                this.setActiveCategory(null, false);

            this.applicationsScrollBox.vscroll.adjustment.set_value(0);

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
                this.blockActiveState = true;

                this.searchResults.setTerms(searchString.split(/\s+/));
            }
        }
    }

    _onSearchBoxKeyPress(searchBox, event) {
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

            let cursorPosition = this.searchBox.clutter_text.get_cursor_position();

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
        const symbol = event.get_key_symbol();
        const unicode = Clutter.keysym_to_unicode(symbol);

        /*
        * Pass ctrl key event to searchbox.
        * Useful for paste event (ctrl+v),
        * if searchbox entry doesn't have key focus
        */
        if (this.searchBox && (symbol === Clutter.KEY_Control_L || symbol === Clutter.KEY_Control_R)) {
            global.stage.set_key_focus(this.searchBox.clutter_text);
            this.searchBox.clutter_text.event(event, false);
            return Clutter.EVENT_PROPAGATE;
        }

        switch (symbol) {
        case Clutter.KEY_BackSpace:
            if (this.searchBox && !this.searchBox.hasKeyFocus() && !this.searchBox.isEmpty()) {
                this.searchBox.grab_key_focus();
                const newText = this.searchBox.getText().slice(0, -1);
                this.searchBox.setText(newText);
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

            if (this.has_search && this.searchBox.hasKeyFocus() &&
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
            if (unicode !== 0 && this.searchBox) {
                global.stage.set_key_focus(this.searchBox.clutter_text);
                this.searchBox.clutter_text.event(event, false);
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        this._disconnectReloadApps();

        if (this.recentFilesManager) {
            this.recentFilesManager.destroy();
            this.recentFilesManager = null;
        }

        this._tree.disconnectObject(this);
        this._tree = null;

        if (this.applicationsBox) {
            if (this.applicationsBox.contains(this.applicationsGrid))
                this.applicationsBox.remove_child(this.applicationsGrid);
        }

        if (this.network) {
            this.network.destroy();
            this.networkMenuItem.destroy();
        }

        if (this.computer) {
            this.computer.destroy();
            this.computerMenuItem.destroy();
        }

        if (this.placesManager) {
            for (const id in this._placesSections) {
                this._placesSections[id].get_children().forEach(child => {
                    child.destroy();
                });
            }
            this.placesManager.destroy();
            this.placesManager = null;
        }

        if (this.searchBox)
            this.searchBox.destroy();

        if (this.searchResults) {
            this.searchResults.setTerms([]);
            this.searchResults.destroy();
            this.searchResults = null;
        }

        if (this.pinnedAppsArray) {
            for (let i = 0; i < this.pinnedAppsArray.length; i++)
                this.pinnedAppsArray[i].destroy();

            this.pinnedAppsArray = null;
        }

        if (this.applicationsMap) {
            this.applicationsMap.forEach((value, _key, _map) => {
                value.destroy();
            });
            this.applicationsMap = null;
        }

        if (this.categoryDirectories) {
            this.categoryDirectories.forEach((value, _key, _map) => {
                value.destroy();
            });
            this.categoryDirectories = null;
        }
    }

    _createScrollBox(params) {
        const scrollBox = new St.ScrollView({
            ...params,
            clip_to_allocation: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
        });
        const panAction = new Clutter.PanAction({interpolate: false});
        panAction.connectObject('pan', action => {
            // blocks activate event while panning scroll view
            this.blockActivateEvent = true;
            if (this.menuButton.tooltipShowingID) {
                GLib.source_remove(this.menuButton.tooltipShowingID);
                this.menuButton.tooltipShowingID = null;
            }
            if (this.menuButton.tooltip.visible)
                this.menuButton.tooltip.hide(true);
            this.onPan(action, scrollBox);
        }, this);
        panAction.connectObject('gesture-cancel', action => this.onPanEnd(action, scrollBox), this);
        panAction.connectObject('gesture-end', action => this.onPanEnd(action, scrollBox), this);
        scrollBox.add_action(panAction);

        return scrollBox;
    }

    _createLabelWithSeparator(headerLabel) {
        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.HEADER_LABEL,
            Constants.SeparatorAlignment.HORIZONTAL, headerLabel);
        return separator;
    }

    createLabelRow(title) {
        const labelRow = new St.BoxLayout({
            style: 'padding: 9px 12px;',
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
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

    _keyFocusIn(actor) {
        if (this._focusChild === actor)
            return;
        this._focusChild = actor;
        Utils.ensureActorVisibleInScrollView(actor);
    }

    onPan(action, scrollbox) {
        const [dist_, dx_, dy] = action.get_motion_delta(0);
        const {adjustment} = scrollbox.vscroll;
        adjustment.value -=  dy;
        return false;
    }

    onPanEnd(action, scrollbox) {
        const velocity = -action.get_velocity(0)[2];
        const {adjustment} = scrollbox.vscroll;
        const endPanValue = adjustment.value + velocity * 2;
        adjustment.value = endPanValue;
    }
};
