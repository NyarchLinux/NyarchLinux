const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, GLib, Gio, Gtk, Shell, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.TOGNEE; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.LIST,
            SearchDisplayType: Constants.DisplayType.LIST,
            ShortcutContextMenuLocation: Constants.ContextMenuLocation.RIGHT,
            ColumnSpacing: 0,
            RowSpacing: 0,
            DefaultMenuWidth: 290,
            VerticalMainBox: true,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }

    createLayout(){
        super.createLayout();

        //subMainBox stores left and right box
        this.subMainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.mainBox.add_child(this.subMainBox);

        // The "Left Box"
        // Contains the app list and the searchbar
        this.appBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            vertical: true,
            y_align: Clutter.ActorAlign.FILL,
        });

        //Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: (this.disableFadeEffect ? '' : 'small-vfade'),
            overlay_scrollbars: true,
            reactive:true
        });
        let horizonalFlip = this._settings.get_boolean("enable-horizontal-flip");

        if(this._settings.get_enum('searchbar-default-bottom-location') === Constants.SearchbarLocation.TOP){
            this.searchBox.add_style_class_name('arcmenu-search-top');
            this.appBox.add_child(this.searchBox);
        }
        this.appBox.add_child(this.applicationsScrollBox);
        this.applicationsBox = new St.BoxLayout({ vertical: true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.END
        });
        this.backButton = new MW.BackMenuItem(this);
        this.navigateBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL));
        this.navigateBox.add_child(this.backButton);
        this.appBox.add_child(this.navigateBox);
        if(this._settings.get_enum('searchbar-default-bottom-location') === Constants.SearchbarLocation.BOTTOM){
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            this.appBox.add_child(this.searchBox);
        }

        // The "Right Box"
        // Contains some useful shortcuts
        this.quickBox = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL
        });

        this.subMainBox.add_child(horizonalFlip ? this.appBox : this.quickBox);
        let verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.VERTICAL);
        this.subMainBox.add_child(verticalSeparator);
        this.subMainBox.add_child(horizonalFlip ? this.quickBox : this.appBox);

        this.placesShortcuts= this._settings.get_value('directory-shortcuts-list').deep_unpack().length>0;
        this.softwareShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack().length>0;

        this.shortcutsBox = new St.BoxLayout({
            vertical: true,
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            style: "spacing: 5px; padding-bottom: 5px;"
        });

        this.shortcutsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            overlay_scrollbars: true,
            style_class: this.disableFadeEffect ? '' : 'small-vfade',
        });
        this.shortcutsScrollBox.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.quickBox.add_child(this.shortcutsScrollBox);

        // Add place shortcuts to menu (Home,Documents,Downloads,Music,Pictures,Videos)
        this._displayPlaces();

        //check to see if should draw separator
        if(this.placesShortcuts && this.softwareShortcuts){
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG, Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        let applicationShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack();
        for(let i = 0; i < applicationShortcuts.length; i++){
            let shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.BUTTON, false);
            if(shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
        }

        // Bottom Section for Power etc...
        this.actionsScrollBox = new St.ScrollView({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.CENTER
        });
        this.actionsScrollBox.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
        this.actionsScrollBox.clip_to_allocation = true;

        //create new section for Leave Button
        this.actionsBox = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: "spacing: 5px;"
        });
        this.actionsScrollBox.add_actor(this.actionsBox);

        let powerDisplayStyle = this._settings.get_enum('power-display-style');
        if(powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            this.leaveButton = new MW.PowerOptionsBox(this, 5, true);
        else
            this.leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(this.leaveButton);

        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG, Constants.SeparatorAlignment.HORIZONTAL);
        this.actionsBox.insert_child_at_index(separator, 0);
        this.quickBox.add_child(this.actionsScrollBox);

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView){
        const widthAdjustment = this._settings.get_int("menu-width-adjustment");
        let menuWidth = this.layoutProperties.DefaultMenuWidth + widthAdjustment;
        //Set a 175px minimum limit for the menu width
        menuWidth = Math.max(175, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.layoutProperties.MenuWidth = menuWidth;
        if(setDefaultMenuView)
            this.setDefaultMenuView();
    }

    _displayPlaces() {
        let directoryShortcuts = this._settings.get_value('directory-shortcuts-list').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            let directory = directoryShortcuts[i];
            let isContainedInCategory = false;
            let placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.BUTTON, isContainedInCategory);
            this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    loadCategories(){
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        let extraCategories = this._settings.get_value("extra-categories").deep_unpack();

        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let shouldShow = extraCategories[i][1];
            if(shouldShow){
                let categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    displayPinnedApps(){
        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        this.navigateBox.show();
    }

    displayAllApps(){
        this.navigateBox.hide();
        super.displayAllApps()
    }

    displayCategories(){
        super.displayCategories();
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
        this.navigateBox.hide();
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        let defaultMenuView = this._settings.get_enum('default-menu-view-tognee');

        if(defaultMenuView === Constants.DefaultMenuViewTognee.CATEGORIES_LIST)
            this.displayCategories();
        else if(defaultMenuView === Constants.DefaultMenuViewTognee.ALL_PROGRAMS)
            this.displayAllApps();
    }

    displayCategoryAppList(appList, category){
        super.displayCategoryAppList(appList, category);
        this.navigateBox.show();
    }

    displayRecentFiles(){
        super.displayRecentFiles();
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
        this.navigateBox.show();
    }

    _onSearchBoxChanged(searchBox, searchString){
        super._onSearchBoxChanged(searchBox, searchString);
        if(searchBox.isEmpty()){
            this.navigateBox.hide();
        }
        else if(!searchBox.isEmpty()){
            this.navigateBox.show();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }
}
