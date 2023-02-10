const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, GLib, Gio, GMenu, Gtk, Shell, St } = imports.gi;
const AppFavorites = imports.ui.appFavorites;
const Config = imports.misc.config;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuLayouts = Me.imports.menulayouts;
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const { RecentFilesManager } = Me.imports.recentFilesManager;
const Utils =  Me.imports.utils;

const Search = (Config.PACKAGE_VERSION < '43') ? Me.imports.search : Me.imports.gnome43.search;

function getMenuLayoutEnum() { return null; }

//This class handles the core functionality of all the menu layouts.
//Each menu layout extends this class.
var BaseMenuLayout = class {
    constructor(menuButton, layoutProperties){
        this.menuButton = menuButton;
        this._settings = menuButton._settings;
        this.mainBox = menuButton.mainBox;
        this.contextMenuManager = menuButton.contextMenuManager;
        this.subMenuManager = menuButton.subMenuManager;
        this.arcMenu = menuButton.arcMenu;
        this.section = menuButton.section;
        this.layout = this._settings.get_enum('menu-layout');
        this.layoutProperties = layoutProperties;
        this._focusChild = null;
        this.shouldLoadPinnedApps = true;
        this.hasPinnedApps = false;

        this._mainBoxKeyPressId = this.mainBox.connect('key-press-event', this._onMainBoxKeyPress.bind(this));

        this._tree = new GMenu.Tree({ menu_basename: 'applications.menu' });
        this._treeChangedId = this._tree.connect('changed', () => this.reloadApplications());

        this._gnomeFavoritesReloadID = AppFavorites.getAppFavorites().connect('changed', () => {
            if(this.categoryDirectories){
                let categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FAVORITES);
                if(categoryMenuItem)
                    this._loadGnomeFavorites(categoryMenuItem);
            }
        });

        this.mainBox.vertical = this.layoutProperties.VerticalMainBox;

        this.createLayout();
    }

    createLayout(){
        if(this.layoutProperties.Search){
            this.searchResults = new Search.SearchResults(this);
            this.searchBox = new MW.SearchBox(this);
            this._searchBoxChangedId = this.searchBox.connect('search-changed', this._onSearchBoxChanged.bind(this));
            this._searchBoxKeyPressId = this.searchBox.connect('entry-key-press', this._onSearchBoxKeyPress.bind(this));
        }

        this.disableFadeEffect = this._settings.get_boolean('disable-scrollview-fade-effect');
        this.activeCategoryType = -1;
        let layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.layoutProperties.ColumnSpacing,
            row_spacing: this.layoutProperties.RowSpacing
        });
        this.applicationsGrid = new St.Widget({
            x_expand: true,
            x_align: this.layoutProperties.DisplayType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL : Clutter.ActorAlign.CENTER,
            layout_manager: layout
        });
        layout.hookup_style(this.applicationsGrid);
    }

    setDefaultMenuView(){
        if(this.layoutProperties.Search){
            this.searchBox.clearWithoutSearchChangeEvent();
            this.searchResults.setTerms([]);
        }

        this._clearActorsFromBox();
        this.resetScrollBarPosition();
    }

    updateWidth(setDefaultMenuView, leftPanelWidthOffset = 0, rightPanelWidthOffset = 0){
        if(this.layoutProperties.DualPanelMenu){
            const leftPanelWidth = this._settings.get_int("left-panel-width") + leftPanelWidthOffset;
            const rightPanelWidth = this._settings.get_int("right-panel-width") + rightPanelWidthOffset;
            this.leftBox.style = `width: ${leftPanelWidth}px;`;
            this.rightBox.style = `width: ${rightPanelWidth}px;`;
        }
        else{
            const widthAdjustment = this._settings.get_int("menu-width-adjustment");
            let menuWidth = this.layoutProperties.DefaultMenuWidth + widthAdjustment;
            //Set a 300px minimum limit for the menu width
            menuWidth = Math.max(300, menuWidth);
            this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
            this.layoutProperties.MenuWidth = menuWidth;
        }

        if(setDefaultMenuView)
            this.setDefaultMenuView();
    }

    getBestFitColumnsForGrid(iconWidth, grid){
        const padding = 12;
        let width = this.layoutProperties.MenuWidth - padding;
        let spacing = grid.layout_manager.column_spacing;
        let columns = Math.floor(width / (iconWidth + spacing));
        return columns;
    }

    getIconWidthFromSetting(){
        let gridIconWidth;
        const iconSizeEnum = this._settings.get_enum("menu-item-grid-icon-size");

        if(iconSizeEnum === Constants.GridIconSize.DEFAULT)
            gridIconWidth = this.getIconWidthFromStyleClass(this.layoutProperties.DefaultIconGridStyle);
        else{
            Constants.GridIconInfo.forEach((info) => {
                if(iconSizeEnum === info.ENUM){
                    gridIconWidth = info.SIZE;
                    return;
                }
            });
        }
        return gridIconWidth;
    }

    getIconWidthFromStyleClass(name){
        let gridIconWidth;

        Constants.GridIconInfo.forEach((info) => {
            if(name === info.NAME){
                gridIconWidth = info.SIZE;
                return;
            }
        });
        return gridIconWidth;
    }

    resetScrollBarPosition(){
        this.applicationsScrollBox?.vscroll.adjustment.set_value(0);
        this.categoriesScrollBox?.vscroll.adjustment.set_value(0);
        this.shortcutsScrollBox?.vscroll.adjustment.set_value(0);
        this.actionsScrollBox?.vscroll.adjustment.set_value(0);
    }

    reloadApplications(){
        //Only reload applications if the menu is closed.
        if(this.arcMenu.isOpen){
            this.reloadQueued = true;
            if(!this._menuClosedID){
                this._menuClosedID = this.arcMenu.connect('menu-closed', () => {
                    this.reloadApplications();
                    this.reloadQueued = false;
                    if(this._menuClosedID){
                        this.arcMenu.disconnect(this._menuClosedID);
                        this._menuClosedID = null;
                    }
                });
            }
            return;
        }

        this.searchResults.setTerms([]);

        if(this.applicationsMap){
            this.applicationsMap.forEach((value,key,map)=>{
                value.destroy();
            });
            this.applicationsMap = null;
        }

        if(this.categoryDirectories){
            this.categoryDirectories.forEach((value,key,map)=>{
                value.destroy();
            });
            this.categoryDirectories = null;
        }
        this.activeCategoryItem = null;
        this.activeMenuItem = null;

        this.loadCategories();
        this.setDefaultMenuView();
    }

    loadCategories(displayType = Constants.DisplayType.LIST){
        this.applicationsMap = new Map();
        this._tree.load_sync();
        let root = this._tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) !== GMenu.TreeItemType.INVALID) {
            if (nextType === GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                if (!dir.get_is_nodisplay()) {
                    let categoryId = dir.get_menu_id();
                    let categoryMenuItem = new MW.CategoryMenuItem(this, dir, displayType);
                    this.categoryDirectories.set(categoryId, categoryMenuItem);
                    this._loadCategory(categoryMenuItem, dir);
                }
            }
        }

        let categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.ALL_PROGRAMS);
        if(categoryMenuItem){
            let appList = [];
            this.applicationsMap.forEach((value,key,map) => {
                appList.push(key);
                //Show Recently Installed Indicator on All Programs category
                if(value.isRecentlyInstalled && !categoryMenuItem.isRecentlyInstalled)
                    categoryMenuItem.setNewAppIndicator(true);
            });
            appList.sort((a, b) => {
                return a.get_name().toLowerCase() > b.get_name().toLowerCase();
            });
            categoryMenuItem.appList = appList;
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FAVORITES);
        if(categoryMenuItem)
            this._loadGnomeFavorites(categoryMenuItem);

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.FREQUENT_APPS);
        if(categoryMenuItem){
            let mostUsed = Shell.AppUsage.get_default().get_most_used();
            for (let i = 0; i < mostUsed.length; i++) {
                if (mostUsed[i] && mostUsed[i].get_app_info().should_show())
                    categoryMenuItem.appList.push(mostUsed[i]);
            }
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.PINNED_APPS);
        if(categoryMenuItem){
            this.hasPinnedApps = true;
            categoryMenuItem.appList = categoryMenuItem.appList.concat(this.pinnedAppsArray);
        }

        categoryMenuItem = this.categoryDirectories.get(Constants.CategoryType.RECENT_FILES);
        if(categoryMenuItem)
            this._loadRecentFiles(categoryMenuItem);
    }

    _loadCategory(categoryMenuItem, dir){
        const showNewAppsIndicator = !this._settings.get_boolean("disable-recently-installed-apps");
        let iter = dir.iter();
        let nextType;
        while((nextType = iter.next()) !== GMenu.TreeItemType.INVALID){
            if(nextType === GMenu.TreeItemType.ENTRY){
                let entry = iter.get_entry();
                let id;
                try{
                    id = entry.get_desktop_file_id();
                } catch(e){
                    continue;
                }
                let app = Shell.AppSystem.get_default().lookup_app(id);
                if(!app)
                    app = new Shell.App({ app_info: entry.get_app_info() });
                if(app.get_app_info().should_show()){
                    let item = this.applicationsMap.get(app);
                    if(!item){
                        let isContainedInCategory = true;
                        item = new MW.ApplicationMenuItem(this, app, this.layoutProperties.DisplayType, null, isContainedInCategory);
                    }
                    categoryMenuItem.appList.push(app);
                    this.applicationsMap.set(app, item);

                    if(showNewAppsIndicator && item.isRecentlyInstalled)
                        categoryMenuItem.setNewAppIndicator(true);
                }
            }
            else if(nextType === GMenu.TreeItemType.DIRECTORY){
                let subdir = iter.get_directory();
                if(!subdir.get_is_nodisplay())
                    this._loadCategory(categoryMenuItem, subdir);
            }
        }
    }

    setNewAppIndicator(){
        let disabled = this._settings.get_boolean("disable-recently-installed-apps")
        if(!disabled){
            for(let categoryMenuItem of this.categoryDirectories.values()){
                categoryMenuItem.setNewAppIndicator(false);
                for(let i = 0; i < categoryMenuItem.appList.length; i++){
                    let item = this.applicationsMap.get(categoryMenuItem.appList[i]);
                    if(!item)
                        continue;
                    if(item.isRecentlyInstalled){
                        categoryMenuItem.setNewAppIndicator(true);
                        break;
                    }
                }
            }
        }
    }

    displayCategories(categoriesBox){
        if(!categoriesBox){
            categoriesBox = this.applicationsBox;
        }
        this._clearActorsFromBox(categoriesBox);

        this._futureActiveItem = false;

        for(let categoryMenuItem of this.categoryDirectories.values()){
            if(categoryMenuItem.get_parent())
                continue;
            categoriesBox.add_child(categoryMenuItem);
            if(!this._futureActiveItem){
                this._futureActiveItem = categoryMenuItem;
            }
        }

        this.activeMenuItem = this._futureActiveItem;
    }

    _loadGnomeFavorites(categoryMenuItem){
        let appList = AppFavorites.getAppFavorites().getFavorites();

        //Show Recently Installed Indicator on GNOME favorites category
        for(let i = 0; i < appList.length; i++){
            let item = this.applicationsMap.get(appList[i]);
            if(item && item.isRecentlyInstalled && !categoryMenuItem.isRecentlyInstalled)
                categoryMenuItem.setNewAppIndicator(true);
        }

        categoryMenuItem.appList = appList;
        if(this.activeCategoryType === Constants.CategoryType.FAVORITES)
            categoryMenuItem.displayAppList();
    }

    _loadRecentFiles(){
        if(!this.recentFilesManager)
            this.recentFilesManager = new RecentFilesManager();
    }

    displayRecentFiles(box = this.applicationsBox){
        this._clearActorsFromBox(box);
        this._futureActiveItem = false;

        const recentFiles = this.recentFilesManager.getRecentFiles();

        for(const file of recentFiles) {
            this.recentFilesManager.queryInfoAsync(file).then(result => {
                const recentFile = result.recentFile;
                const error = result.error;

                if (error)
                    return;

                const gioFile = Gio.File.new_for_uri(recentFile.get_uri());
                const filePath = gioFile.get_path();
                const name = recentFile.get_display_name();
                const icon = Gio.content_type_get_symbolic_icon(recentFile.get_mime_type()).to_string();
                const isContainedInCategory = true;
    
                let placeMenuItem = this.createMenuItem([name, icon, filePath], Constants.DisplayType.LIST, isContainedInCategory);
                placeMenuItem.setAsRecentFile(recentFile, () => {
                    try {
                        let recentManager = this.recentFilesManager.recentManager;
                        recentManager.remove_item(placeMenuItem.fileUri);
                    } catch(err) {
                        log(err);
                    }
                    box.remove_child(placeMenuItem);
                    box.queue_relayout();
                });
                box.add_child(placeMenuItem);
    
                if(!this._futureActiveItem){
                    this._futureActiveItem = placeMenuItem;
                    this.activeMenuItem = this._futureActiveItem;
                }
            }).catch(error => log(error));
        }
    }

    _displayPlaces() {
        let directoryShortcuts = this._settings.get_value('directory-shortcuts-list').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            let directory = directoryShortcuts[i];
            let isContainedInCategory = false;
            let placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.LIST, isContainedInCategory);
            if(placeMenuItem)
                this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    loadExtraPinnedApps(pinnedAppsArray, separatorIndex){
        let pinnedApps = pinnedAppsArray;
        //if the extraPinnedApps array is empty, create a default list of apps.
        if(!pinnedApps.length || !Array.isArray(pinnedApps)){
            pinnedApps = this._createExtraPinnedAppsList();
        }

        for(let i = 0;i < pinnedApps.length; i += 3){
            if(i === separatorIndex * 3 && i !== 0)
                this._addSeparator();
            let isContainedInCategory = false;
            let placeMenuItem = this.createMenuItem([pinnedApps[i], pinnedApps[i + 1], pinnedApps[i + 2]], Constants.DisplayType.BUTTON, isContainedInCategory);
            placeMenuItem.x_expand = false;
            placeMenuItem.y_expand = false;
            placeMenuItem.y_align = Clutter.ActorAlign.CENTER;
            placeMenuItem.x_align = Clutter.ActorAlign.CENTER;
            this.actionsBox.add_child(placeMenuItem);
        }
    }

    createMenuItem(menuItemArray, displayType, isContainedInCategory){
        let [shortcutName, shortcutIcon, shortcutCommand] = menuItemArray;
        let app = Shell.AppSystem.get_default().lookup_app(shortcutCommand);

        //Ubunutu 22.04 uses old version of GNOME settings
        if(shortcutCommand === 'org.gnome.Settings.desktop' && !app){
            shortcutCommand = 'gnome-control-center.desktop';
            app = Shell.AppSystem.get_default().lookup_app(shortcutCommand);
        }

        if(app)
            return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);

        switch(shortcutCommand){
            case Constants.ShortcutCommands.SOFTWARE:
                let software = Utils.findSoftwareManager();
                return new MW.ShortcutMenuItem(this, [shortcutName, shortcutIcon, software], displayType, isContainedInCategory);
            case Constants.ShortcutCommands.ARCMENU_SETTINGS:
            case Constants.ShortcutCommands.SUSPEND:
            case Constants.ShortcutCommands.LOG_OUT:
            case Constants.ShortcutCommands.POWER_OFF:
            case Constants.ShortcutCommands.LOCK:
            case Constants.ShortcutCommands.RESTART:
            case Constants.ShortcutCommands.HYBRID_SLEEP:
            case Constants.ShortcutCommands.HIBERNATE:
            case Constants.ShortcutCommands.SWITCH_USER:
            case Constants.ShortcutCommands.OVERVIEW:
            case Constants.ShortcutCommands.SHOW_APPS:
            case Constants.ShortcutCommands.RUN_COMMAND:
                return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);
            default:
                let placeInfo = this._getPlaceInfo(shortcutCommand, shortcutName);
                if(placeInfo)
                    return new MW.PlaceMenuItem(this, placeInfo, displayType, isContainedInCategory);
                else
                    return new MW.ShortcutMenuItem(this, menuItemArray, displayType, isContainedInCategory);
        }
    }

    _getPlaceInfo(shortcutCommand, shortcutName){
        let path;
        switch(shortcutCommand){
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
                return new PlaceDisplay.PlaceInfo('special', Gio.File.new_for_uri("recent:///"));
            case Constants.ShortcutCommands.COMPUTER:
                return new PlaceDisplay.RootInfo();
            default:
                if(!shortcutCommand)
                    return null;

                let file = Gio.File.new_for_path(shortcutCommand);
                if(file.query_exists(null))
                    return new PlaceDisplay.PlaceInfo('special', file, _(shortcutName));
                else
                    return null;
        }
        if(!path)
            return null;

        return new PlaceDisplay.PlaceInfo('special', Gio.File.new_for_path(path));
    }

    loadPinnedApps(){
        let pinnedApps = this._settings.get_strv('pinned-app-list');

        this.pinnedAppsArray = null;
        this.pinnedAppsArray = [];

        let categoryMenuItem = this.categoryDirectories ? this.categoryDirectories.get(Constants.CategoryType.PINNED_APPS) : null;
        let isContainedInCategory = categoryMenuItem ? true : false;

        for(let i = 0; i < pinnedApps.length; i += 3){
            if(i === 0 && pinnedApps[0] === "ArcMenu_WebBrowser")
                this._updatePinnedAppsWebBrowser(pinnedApps);

            let pinnedAppsMenuItem = new MW.PinnedAppsMenuItem(this, pinnedApps[i], pinnedApps[i + 1], pinnedApps[i + 2], this.layoutProperties.DisplayType, isContainedInCategory);
            pinnedAppsMenuItem.connect('saveSettings', () => {
                let array = [];
                for(let i = 0; i < this.pinnedAppsArray.length; i++){
                    array.push(this.pinnedAppsArray[i]._name);
                    array.push(this.pinnedAppsArray[i]._icon);
                    array.push(this.pinnedAppsArray[i]._command);
                }
                this._settings.set_strv('pinned-app-list',array);
            });
            this.pinnedAppsArray.push(pinnedAppsMenuItem);
        }

        if(categoryMenuItem){
            categoryMenuItem.appList = null;
            categoryMenuItem.appList = [];
            categoryMenuItem.appList = categoryMenuItem.appList.concat(this.pinnedAppsArray);
        }
    }

    _updatePinnedAppsWebBrowser(pinnedApps){
        //Find the Default Web Browser, if found add to pinned apps list, if not found delete the placeholder.
        //Will only run if placeholder is found. Placeholder only found with default settings set.
        if(pinnedApps[0] === "ArcMenu_WebBrowser"){
            let browserName = '';
            try{
                //user may not have xdg-utils package installed which will throw error
                let [res, stdout, stderr, status] = GLib.spawn_command_line_sync("xdg-settings get default-web-browser");
                let webBrowser = String.fromCharCode(...stdout);
                browserName = webBrowser.split(".desktop")[0];
                browserName += ".desktop";
            }
            catch(error){
                log("ArcMenu Error - Failed to find default web browser. Removing placeholder pinned app.")
            }

            const app = Shell.AppSystem.get_default().lookup_app(browserName);
            if(app){
                pinnedApps[0] = app.get_name();
                pinnedApps[1] = '';
                pinnedApps[2] = app.get_id();
            }
            else
                pinnedApps.splice(0,3);

            this.shouldLoadPinnedApps = false; // We don't want to trigger a setting changed event
            this._settings.set_strv('pinned-app-list', pinnedApps);
            this.shouldLoadPinnedApps = true;
        }
    }

    displayPinnedApps(){
        this._clearActorsFromBox();
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
    }

    placesAddSeparator(id){
        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT, Constants.SeparatorAlignment.HORIZONTAL);
        this._sections[id].add_child(separator);
    }

    _redisplayPlaces(id) {
        if(this._sections[id].get_n_children() > 0){
            this.bookmarksShorctus = false;
            this.externalDevicesShorctus = false;
            this.networkDevicesShorctus = false;
            this._sections[id].destroy_all_children();
        }
        this._createPlaces(id);
    }

    _createPlaces(id) {
        let places = this.placesManager.get(id);
        if(this.placesManager.get('network').length > 0)
            this.networkDevicesShorctus = true;
        if(this.placesManager.get('devices').length > 0)
            this.externalDevicesShorctus = true;
        if(this.placesManager.get('bookmarks').length > 0)
            this.bookmarksShorctus = true;

        if(this._settings.get_boolean('show-bookmarks')){
            if(id === 'bookmarks' && places.length > 0){
                for (let i = 0; i < places.length; i++){
                    let item = new MW.PlaceMenuItem(this, places[i]);
                    this._sections[id].add_child(item);
                }
                //create a separator if bookmark and software shortcut are both shown
                if(this.bookmarksShorctus && this.softwareShortcuts){
                    this.placesAddSeparator(id);
                }
            }
        }
        if(this._settings.get_boolean('show-external-devices')){
            if(id === 'devices'){
                for (let i = 0; i < places.length; i++){
                    let item = new MW.PlaceMenuItem(this, places[i]);
                    this._sections[id].add_child(item);
                }
                if((this.externalDevicesShorctus && !this.networkDevicesShorctus) && (this.bookmarksShorctus || this.softwareShortcuts))
                    this.placesAddSeparator(id);
            }
            if(id === 'network'){
                for (let i = 0; i < places.length; i++){
                    let item = new MW.PlaceMenuItem(this, places[i]);
                    this._sections[id].add_child(item);
                }
                if(this.networkDevicesShorctus && (this.bookmarksShorctus || this.softwareShortcuts))
                    this.placesAddSeparator(id);
            }
        }
    }

    setActiveCategory(categoryItem, setActive = true){
        if(this.activeCategoryItem){
            this.activeCategoryItem.isActiveCategory = false;
            this.activeCategoryItem.remove_style_pseudo_class('active');
            this.activeCategoryItem = null;
        }

        if(!setActive)
            return;

        this.activeCategoryItem = categoryItem;
        this.activeCategoryItem.isActiveCategory = true;
        this.activeCategoryItem.add_style_pseudo_class('active');

        this._futureActiveItem = categoryItem;
        this.activeMenuItem = categoryItem;
    }

    setFrequentAppsList(categoryMenuItem){
        categoryMenuItem.appList = [];
        let mostUsed = Shell.AppUsage.get_default().get_most_used();
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show())
                categoryMenuItem.appList.push(mostUsed[i]);
        }
    }

    _clearActorsFromBox(box){
        this.blockActiveState = true;
        this.recentFilesManager?.cancelCurrentQueries();
        if(!box){
            box = this.applicationsBox;
            this.activeCategoryType = -1;
        }
        let parent = box.get_parent();
        if(parent && parent instanceof St.ScrollView)
            parent.vscroll.adjustment.set_value(0);
        let actors = box.get_children();
        for (let i = 0; i < actors.length; i++) {
            let actor = actors[i];
            box.remove_child(actor);
        }
    }

    displayCategoryAppList(appList, category){
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _displayAppList(apps, category, grid){
        this.activeCategoryType = category;
        grid.remove_all_children();
        let count = 0;
        let top = -1;
        let left = 0;
        this._futureActiveItem = false;
        let currentCharacter;
        const alphabetizeAllPrograms = this._settings.get_boolean("alphabetize-all-programs") && this.layoutProperties.DisplayType === Constants.DisplayType.LIST;
        const rtl = this.mainBox.get_text_direction() == Clutter.TextDirection.RTL;

        let columns = 1;
        if(grid.layout_manager.forceGridColumns)
            columns = grid.layout_manager.forceGridColumns;
        else if(this.layoutProperties.DisplayType === Constants.DisplayType.GRID){
            let iconWidth = this.getIconWidthFromSetting();
            columns = this.getBestFitColumnsForGrid(iconWidth, grid);
        }
        grid.layout_manager.gridColumns = columns;

        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];
            let item;
            let shouldShow = true;

            if(category === Constants.CategoryType.PINNED_APPS || category === Constants.CategoryType.HOME_SCREEN){
                item = app;
                if(!item.shouldShow)
                    shouldShow = false;
            }
            else{
                item = this.applicationsMap.get(app);
                if (!item) {
                    item = new MW.ApplicationMenuItem(this, app, this.layoutProperties.DisplayType);
                    this.applicationsMap.set(app, item);
                }
            }

            const parent = item.get_parent();
            if(parent)
                parent.remove_child(item);

            if(shouldShow){
                if(!rtl && (count % columns === 0)){
                    top++;
                    left = 0;
                }
                else if(rtl && (left === 0)){
                    top++;
                    left = columns;
                }

                if(alphabetizeAllPrograms && category === Constants.CategoryType.ALL_PROGRAMS){
                    const appNameFirstChar = app.get_name().charAt(0).toLowerCase();
                    if(currentCharacter !== appNameFirstChar){
                        currentCharacter = appNameFirstChar;

                        let label = this._createLabelWithSeparator(currentCharacter.toUpperCase());
                        grid.layout_manager.attach(label, left, top, 1, 1);
                        top++;
                    }
                }

                grid.layout_manager.attach(item, left, top, 1, 1);
                item.gridLocation = [left, top];

                if(!rtl)
                    left++;
                else if(rtl)
                    left--;
                count++;

                if(!this._futureActiveItem && grid === this.applicationsGrid)
                    this._futureActiveItem = item;
            }
        }
        if(this.applicationsBox && !this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);
        if(this._futureActiveItem)
            this.activeMenuItem = this._futureActiveItem;
    }

    displayAllApps(){
        let appList = [];
        this.applicationsMap.forEach((value,key,map) => {
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
        let itemChanged = item !== this._activeMenuItem;
        if(itemChanged){
            this._activeMenuItem = item;
            if(this.arcMenu.isOpen && item && this.layoutProperties.SupportsCategoryOnHover)
                item.grab_key_focus();
        }
    }

    _onSearchBoxChanged(searchBox, searchString) {
        if(searchBox.isEmpty()){
            if(this.applicationsBox.contains(this.searchResults))
                this.applicationsBox.remove_child(this.searchResults);

            this.setDefaultMenuView();
        }
        else{
            if(this.activeCategoryItem)
                this.setActiveCategory(null, false);

            this.applicationsScrollBox.vscroll.adjustment.set_value(0);

            if(!this.applicationsBox.contains(this.searchResults)){
                this._clearActorsFromBox();
                this.applicationsBox.add_child(this.searchResults);
            }

            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;

            searchString = searchString.replace(/^\s+/g, '').replace(/\s+$/g, '');
            if(searchString === '')
                this.searchResults.setTerms([]);
            else{
                //Prevent a mouse hover event from setting a new active menu item, until next mouse move event.
                //Used to prevent the top search result from instantly changing
                //if users mouse is over a differnt menu item.
                this.blockActiveState = true;

                this.searchResults.setTerms(searchString.split(/\s+/));
            }
        }
    }

    _onSearchBoxKeyPress(searchBox, event) {
        let symbol = event.get_key_symbol();
        switch (symbol) {
            case Clutter.KEY_Up:
            case Clutter.KEY_Down:
            case Clutter.KEY_Left:
            case Clutter.KEY_Right:
                let direction;
                if (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up)
                    return Clutter.EVENT_PROPAGATE;
                if (symbol === Clutter.KEY_Right)
                    direction = St.DirectionType.RIGHT;
                if (symbol === Clutter.KEY_Left)
                    direction = St.DirectionType.LEFT;

                let cursorPosition = this.searchBox.clutter_text.get_cursor_position();

                if(cursorPosition === Constants.CaretPosition.END && symbol === Clutter.KEY_Right)
                    cursorPosition = Constants.CaretPosition.END;
                else if(cursorPosition === Constants.CaretPosition.START && symbol === Clutter.KEY_Left)
                    cursorPosition = Constants.CaretPosition.START;
                else
                    cursorPosition = Constants.CaretPosition.MIDDLE;

                if(cursorPosition === Constants.CaretPosition.END || cursorPosition === Constants.CaretPosition.START){
                    let navigateActor = this.activeMenuItem;
                    if(this.searchResults.hasActiveResult()){
                        navigateActor = this.searchResults.getTopResult();
                        if(navigateActor.has_style_pseudo_class("active")){
                            navigateActor.grab_key_focus();
                            navigateActor.remove_style_pseudo_class('active');
                            return this.mainBox.navigate_focus(navigateActor, direction, false);
                        }
                        navigateActor.grab_key_focus();
                        return Clutter.EVENT_STOP;
                    }
                    if(!navigateActor)
                        return Clutter.EVENT_PROPAGATE;
                    return this.mainBox.navigate_focus(navigateActor, direction, false);
                }
                return Clutter.EVENT_PROPAGATE;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
    }

    _onMainBoxKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        let unicode = Clutter.keysym_to_unicode(symbol);

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
                if(this.searchBox && !this.searchBox.hasKeyFocus() && !this.searchBox.isEmpty()){
                    this.searchBox.grab_key_focus();
                    let newText = this.searchBox.getText().slice(0, -1);
                    this.searchBox.setText(newText);
                }
                return Clutter.EVENT_PROPAGATE;
            case Clutter.KEY_Tab:
            case Clutter.KEY_ISO_Left_Tab:
            case Clutter.KEY_Up:
            case Clutter.KEY_Down:
            case Clutter.KEY_Left:
            case Clutter.KEY_Right:
                let direction;
                if (symbol === Clutter.KEY_Down)
                    direction = St.DirectionType.DOWN;
                else if (symbol === Clutter.KEY_Right)
                    direction = St.DirectionType.RIGHT
                else if (symbol === Clutter.KEY_Up)
                    direction = St.DirectionType.UP;
                else if (symbol === Clutter.KEY_Left)
                    direction = St.DirectionType.LEFT;
                else if (symbol === Clutter.KEY_Tab)
                    direction = St.DirectionType.TAB_FORWARD;
                else if (symbol === Clutter.KEY_ISO_Left_Tab)
                    direction = St.DirectionType.TAB_BACKWARD;

                if(this.layoutProperties.Search && this.searchBox.hasKeyFocus() && this.searchResults.hasActiveResult() && this.searchResults.get_parent()){
                    const topSearchResult = this.searchResults.getTopResult();
                    if(topSearchResult.has_style_pseudo_class("active")){
                        topSearchResult.grab_key_focus();
                        topSearchResult.remove_style_pseudo_class('active');
                        return actor.navigate_focus(global.stage.key_focus, direction, false);
                    }
                    topSearchResult.grab_key_focus();
                    return Clutter.EVENT_STOP;
                }
                else if(global.stage.key_focus === this.mainBox && symbol === Clutter.KEY_Up){
                    return actor.navigate_focus(global.stage.key_focus, direction, true);
                }
                else if(global.stage.key_focus === this.mainBox){
                    this.activeMenuItem.grab_key_focus();
                    return Clutter.EVENT_STOP;
                }
                return actor.navigate_focus(global.stage.key_focus, direction, false);
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

    destroy(){
        if(this.recentFilesManager){
            this.recentFilesManager.destroy();
            this.recentFilesManager = null;
        }

        if(this._treeChangedId){
            this._tree.disconnect(this._treeChangedId);
            this._treeChangedId = null;
            this._tree = null;
        }

        if(this.applicationsBox){
            if(this.applicationsBox.contains(this.applicationsGrid))
                this.applicationsBox.remove_child(this.applicationsGrid);
        }

        if(this.network){
            this.network.destroy();
            this.networkMenuItem.destroy();
        }

        if(this.computer){
            this.computer.destroy();
            this.computerMenuItem.destroy();
        }

        if(this.placesManager){
            for(let id in this._sections){
                this._sections[id].get_children().forEach((child) =>{
                    child.destroy();
                });
            };
            if(this.placeManagerUpdatedID){
                this.placesManager.disconnect(this.placeManagerUpdatedID);
                this.placeManagerUpdatedID = null;
            }
            this.placesManager.destroy();
            this.placesManager = null
        }

        if(this._searchBoxChangedId){
            this.searchBox?.disconnect(this._searchBoxChangedId);
            this._searchBoxChangedId = null;;
        }
        if(this._searchBoxKeyPressId){
            this.searchBox?.disconnect(this._searchBoxKeyPressId);
            this._searchBoxKeyPressId = null;
        }
        if(this._searchBoxKeyFocusInId){
            this.searchBox?.disconnect(this._searchBoxKeyFocusInId);
            this._searchBoxKeyFocusInId = null;
        }

        if(this.searchBox)
            this.searchBox.destroy();

        if(this.searchResults){
            this.searchResults.setTerms([]);
            this.searchResults.destroy();
            this.searchResults = null;
        }

        if (this._mainBoxKeyPressId) {
            this.mainBox.disconnect(this._mainBoxKeyPressId);
            this._mainBoxKeyPressId = null;
        }

        if(this._gnomeFavoritesReloadID){
            AppFavorites.getAppFavorites().disconnect(this._gnomeFavoritesReloadID);
            this._gnomeFavoritesReloadID = null;
        }

        if(this.pinnedAppsArray){
            for(let i = 0; i < this.pinnedAppsArray.length; i++){
                this.pinnedAppsArray[i].destroy();
            }
            this.pinnedAppsArray = null;
        }

        if(this.applicationsMap){
            this.applicationsMap.forEach((value,key,map)=>{
                value.destroy();
            });
            this.applicationsMap = null;
        }

        if(this.categoryDirectories){
            this.categoryDirectories.forEach((value,key,map)=>{
                value.destroy();
            });
            this.categoryDirectories = null;
        }

        this.mainBox.destroy_all_children();
    }

    _createScrollBox(params){
        let scrollBox = new St.ScrollView(params);
        let panAction = new Clutter.PanAction({ interpolate: false });
        panAction.connect('pan', (action) => {
            //blocks activate event while panning scroll view
            this.blockActivateEvent = true;
            if(this.menuButton.tooltipShowingID) {
                GLib.source_remove(this.menuButton.tooltipShowingID);
                this.menuButton.tooltipShowingID = null;
            }
            if(this.menuButton.tooltip.visible)
                this.menuButton.tooltip.hide(true);
            this.onPan(action, scrollBox);
        });
        panAction.connect('gesture-cancel',(action) => this.onPanEnd(action, scrollBox));
        panAction.connect('gesture-end', (action) => this.onPanEnd(action, scrollBox));
        scrollBox.add_action(panAction);

        scrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        scrollBox.clip_to_allocation = true;

        return scrollBox;
    }

    _createLabelWithSeparator(headerLabel){
        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.HEADER_LABEL, Constants.SeparatorAlignment.HORIZONTAL, headerLabel);
        return separator;
    }

    createLabelRow(title){
        let labelRow = new St.BoxLayout({
            style: "padding: 9px 12px;",
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL
        });
        let label = new St.Label({
            text:_(title),
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold;'
        })
        labelRow.add_child(label);
        labelRow.label = label;
        return labelRow;
    }

    _createNavigationRow(labelTitle, buttonDirection, buttonTitle, buttonAction){
        let navButton = this.createLabelRow(labelTitle);
        navButton.style = 'padding: 0px 25px;';

        let button;
        if(buttonDirection === Constants.Direction.GO_NEXT)
            button = new MW.GoNextButton(this, buttonTitle, buttonAction);
        else if(buttonDirection === Constants.Direction.GO_PREVIOUS)
            button = new MW.GoPreviousButton(this, buttonAction);

        navButton.add_child(button);
        return navButton;
    }

    _keyFocusIn(actor) {
        if (this._focusChild == actor)
            return;
        this._focusChild = actor;
        Utils.ensureActorVisibleInScrollView(actor);
    }

    onPan(action, scrollbox) {
        let [dist_, dx_, dy] = action.get_motion_delta(0);
        let adjustment = scrollbox.vscroll.adjustment;
        adjustment.value -=  dy;
        return false;
    }

    onPanEnd(action, scrollbox) {
        let velocity = -action.get_velocity(0)[2];
        let adjustment = scrollbox.vscroll.adjustment;
        let endPanValue = adjustment.value + velocity * 2;
        adjustment.value = endPanValue;
    }
};
