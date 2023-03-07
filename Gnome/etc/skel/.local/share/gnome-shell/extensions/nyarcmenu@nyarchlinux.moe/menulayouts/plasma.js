const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, Gio, GLib, Gtk, Shell, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.PLASMA; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.LIST,
            SearchDisplayType: Constants.DisplayType.LIST,
            ColumnSpacing: 0,
            RowSpacing: 0,
            DefaultMenuWidth: 450,
            VerticalMainBox: true,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }

    createLayout(){
        super.createLayout();

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START
        });
        this.leftTopBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: "padding-left: 10px; margin-left: 0.4em"
        });
        this.rightTopBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            style_class: 'popup-menu-item',
            style: "padding: 0px; margin: 0px; spacing: 0px;"
        });

        this.user = new MW.UserMenuIcon(this, 55, true);
        this.user.x_expand = false;
        this.user.y_expand = true;
        this.user.x_align = Clutter.ActorAlign.CENTER;
        this.user.y_align = Clutter.ActorAlign.CENTER;
        this.leftTopBox.add_child(this.user);
        this.rightTopBox.add_child(this.user.label);
        this.user.label.style = "padding-left: 0.4em; margin: 0px 10px 0px 15px; font-weight: bold;";
        this.user.label.y_expand = false;
        this.user.label.x_expand = true;
        this.user.label.x_align = Clutter.ActorAlign.START;
        this.rightTopBox.add_child(this.searchBox);

        this.topBox.add_child(this.leftTopBox);
        this.topBox.add_child(this.rightTopBox);

        this.searchBarLocation = this._settings.get_enum('searchbar-default-top-location');

        //Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this.disableFadeEffect ? '' : 'small-vfade',
            overlay_scrollbars: true,
            reactive:true,
        });

        this.applicationsBox = new St.BoxLayout({
            vertical: true
        });

        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBoxContainer = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START
        });
        this.navigateBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: "spacing: 6px;",
        });
        let layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_homogeneous: true,
            column_spacing: 10,
            row_spacing: 10
        });
        this.grid = new St.Widget({
            layout_manager: layout
        });
        layout.hookup_style(this.grid);
        this.navigateBox.add_child(this.grid);

        this.pinnedAppsButton = new MW.PlasmaMenuItem(this, _("Pinned"), Constants.ArcMenuLogoSymbolic);
        this.pinnedAppsButton.connect("activate", () => this.displayPinnedApps() );
        this.grid.layout_manager.attach(this.pinnedAppsButton, 0, 0, 1, 1);
        this.pinnedAppsButton.set_style_pseudo_class("active-item");

        this.applicationsButton = new MW.PlasmaMenuItem(this, _("Apps"), 'preferences-desktop-apps-symbolic');
        this.applicationsButton.connect("activate", () => this.displayCategories() );
        this.grid.layout_manager.attach(this.applicationsButton, 1, 0, 1, 1);

        this.computerButton = new MW.PlasmaMenuItem(this, _("Computer"), 'computer-symbolic');
        this.computerButton.connect("activate", () => this.displayComputerCategory() );
        this.grid.layout_manager.attach(this.computerButton, 2, 0, 1, 1);

        this.leaveButton = new MW.PlasmaMenuItem(this, _("Leave"), 'system-shutdown-symbolic');
        this.leaveButton.connect("activate", () => this.displayPowerItems() );
        this.grid.layout_manager.attach(this.leaveButton, 3, 0, 1, 1);

        this.categoryHeader = new MW.PlasmaCategoryHeader(this);

        if(this.searchBarLocation === Constants.SearchbarLocation.BOTTOM){
            this.searchBox.style = "margin: 3px 10px 5px 10px;";
            this.topBox.style = 'padding-top: 0.5em;'

            this.navigateBoxContainer.add_child(this.navigateBox);
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);
            this.navigateBoxContainer.y_expand = false;
            this.navigateBoxContainer.y_align = Clutter.ActorAlign.START;
            this.mainBox.add_child(this.navigateBoxContainer);
            this.mainBox.add_child(this.applicationsScrollBox);
            separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
            this.mainBox.add_child(separator);

            this.mainBox.add_child(this.topBox);
        }
        else if(this.searchBarLocation === Constants.SearchbarLocation.TOP){
            this.searchBox.style = "margin: 3px 10px 10px 10px;";

            this.mainBox.add_child(this.topBox);
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
            this.mainBox.add_child(separator);
            this.mainBox.add_child(this.applicationsScrollBox);
            this.navigateBoxContainer.y_expand = true;
            this.navigateBoxContainer.y_align = Clutter.ActorAlign.END;
            separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);
            this.navigateBoxContainer.add_child(this.navigateBox);
            this.mainBox.add_child(this.navigateBoxContainer);
        }

        let applicationShortcutsList = this._settings.get_value('application-shortcuts-list').deep_unpack();
        this.applicationShortcuts = [];
        for(let i = 0; i < applicationShortcutsList.length; i++){
            let shortcutMenuItem = this.createMenuItem(applicationShortcutsList[i], Constants.DisplayType.LIST, false)
            if(shortcutMenuItem.shouldShow)
                this.applicationShortcuts.push(shortcutMenuItem);
        }

        let directoryShortcutsList = this._settings.get_value('directory-shortcuts-list').deep_unpack();
        this._loadPlaces(directoryShortcutsList);

        this.externalDevicesBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this._sections = { };
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            let id = Constants.SECTIONS[i];
            this._sections[id] = new St.BoxLayout({
                vertical: true
            });
            this.placeManagerUpdatedID = this.placesManager.connect(`${id}-updated`, () => {
                this._redisplayPlaces(id);
            });

            this._createPlaces(id);
            this.externalDevicesBox.add_child(this._sections[id]);
        }
        this.updateWidth();
        this._createPowerItems();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    setFrequentAppsList(categoryMenuItem){
        categoryMenuItem.appList = [];
        let mostUsed = Shell.AppUsage.get_default().get_most_used();
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()){
                categoryMenuItem.appList.push(mostUsed[i]);
                let item = this.applicationsMap.get(mostUsed[i]);
                if (!item) {
                    item = new MW.ApplicationMenuItem(this, mostUsed[i], this.layoutProperties.DisplayType);
                    this.applicationsMap.set(mostUsed[i], item);
                }
            }
        }
    }

    _clearActorsFromBox(box){
        this.categoryHeader.setActiveCategory(null);
        if(this.mainBox.contains(this.categoryHeader))
            this.mainBox.remove_child(this.categoryHeader);
        super._clearActorsFromBox(box);
    }

    clearActiveItem(){
        this.pinnedAppsButton.setActive(false);
        this.computerButton.setActive(false);
        this.applicationsButton.setActive(false);
        this.leaveButton.setActive(false);
    }

    loadCategories(){
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        let extraCategories = this._settings.get_value("extra-categories").deep_unpack();

        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let shouldShow = extraCategories[i][1];
            if(categoryEnum === Constants.CategoryType.PINNED_APPS)
                shouldShow = false;
            if(shouldShow){
                let categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    displayComputerCategory(){
        this._clearActorsFromBox(this.applicationsBox);
        this.applicationsBox.add_child(this.createLabelRow(_("Application Shortcuts")));
        for(let i = 0; i < this.applicationShortcuts.length; i++){
            this.applicationsBox.add_child(this.applicationShortcuts[i]);
        }
        this.applicationsBox.add_child(this.createLabelRow(_("Places")));
        for(let i = 0; i < this.directoryShortcuts.length; i++){
            this.applicationsBox.add_child(this.directoryShortcuts[i]);
        }
        this.applicationsBox.add_child(this.externalDevicesBox);
        this.activeMenuItem = this.applicationShortcuts[0];
    }

    _createPlaces(id) {
        let places = this.placesManager.get(id);

        if(id === 'bookmarks' && places.length > 0){
            this._sections[id].add_child(this.createLabelRow(_("Bookmarks")));
            for (let i = 0; i < places.length; i++){
                let item = new MW.PlaceMenuItem(this, places[i], Constants.DisplayType.LIST);
                this._sections[id].add_child(item);
            }
        }

        if(id === 'devices' && places.length > 0){
            this._sections[id].add_child(this.createLabelRow(_("Devices")));
            for (let i = 0; i < places.length; i++){
                let item = new MW.PlaceMenuItem(this, places[i], Constants.DisplayType.LIST);
                this._sections[id].add_child(item);
            }
        }

        if(id === 'network' && places.length > 0){
            this._sections[id].add_child(this.createLabelRow(_("Network")));
            for (let i = 0; i < places.length; i++){
                let item = new MW.PlaceMenuItem(this, places[i], Constants.DisplayType.LIST);
                this._sections[id].add_child(item);
            }
        }
    }

    displayPinnedApps(){
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        super.displayPinnedApps();
    }

    _loadPlaces(directoryShortcutsList) {
        this.directoryShortcuts = [];
        for (let i = 0; i < directoryShortcutsList.length; i++) {
            let isContainedInCategory = false;
            let directory = directoryShortcutsList[i];
            let placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.LIST, isContainedInCategory);
            this.directoryShortcuts.push(placeMenuItem);
        }
    }

    _createPowerItems(){
        this.sessionBox = new St.BoxLayout({
            vertical: true,
        });
        this.sessionBox.add_child(this.createLabelRow(_("Session")));

        this.systemBox = new St.BoxLayout({
            vertical: true,
        });
        this.systemBox.add_child(this.createLabelRow(_("System")));

        this.hasSessionOption = false;
        this.hasSystemOption = false;
        let powerOptions = this._settings.get_value("power-options").deep_unpack();
        for(let i = 0; i < powerOptions.length; i++){
            let powerType = powerOptions[i][0];
            let shouldShow = powerOptions[i][1];
            if(shouldShow){
                let powerButton = new MW.PowerMenuItem(this, powerType);
                if(powerType === Constants.PowerType.LOCK || powerType === Constants.PowerType.LOGOUT || powerType === Constants.PowerType.SWITCH_USER){
                    this.hasSessionOption = true;
                    this.sessionBox.add_child(powerButton);
                }
                else{
                    this.hasSystemOption = true;
                    this.systemBox.add_child(powerButton);
                }
            }
        }
    }

    displayPowerItems(){
        this._clearActorsFromBox(this.applicationsBox);
        if(this.hasSessionOption)
            this.applicationsBox.add_child(this.sessionBox);
        if(this.hasSystemOption)
            this.applicationsBox.add_child(this.systemBox);
    }

    displayCategories(){
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
        this._clearActorsFromBox(this.applicationsBox);

        this.categoryHeader.setActiveCategory(null);
        this._insertCategoryHeader();

        let isActiveMenuItemSet = false;
        for(let categoryMenuItem of this.categoryDirectories.values()){
            this.applicationsBox.add_child(categoryMenuItem);
            if(!isActiveMenuItemSet){
                isActiveMenuItemSet = true;
                this.activeMenuItem = categoryMenuItem;
            }
        }
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        this.clearActiveItem();
        this.pinnedAppsButton.set_style_pseudo_class("active-item");
        this.displayPinnedApps();
    }

    _insertCategoryHeader(){
        if(this.mainBox.contains(this.categoryHeader))
            this.mainBox.remove_child(this.categoryHeader);
        if(this.searchBarLocation === Constants.SearchbarLocation.BOTTOM)
            this.mainBox.insert_child_at_index(this.categoryHeader, 1);
        else
            this.mainBox.insert_child_at_index(this.categoryHeader, 2);
    }

    displayCategoryAppList(appList, category){
        this._clearActorsFromBox();
        this._insertCategoryHeader();
        this.categoryHeader.setActiveCategory(this.activeCategory);
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    displayRecentFiles(){
        super.displayRecentFiles();
        this._insertCategoryHeader();
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
        this.categoryHeader.setActiveCategory(this.activeCategory);
    }

    _onSearchBoxChanged(searchBox, searchString){
        super._onSearchBoxChanged(searchBox, searchString);
        if(!searchBox.isEmpty()){
            this.clearActiveItem();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }

    destroy(){
        this.systemBox.destroy();
        this.sessionBox.destroy();

        super.destroy();
    }
}
