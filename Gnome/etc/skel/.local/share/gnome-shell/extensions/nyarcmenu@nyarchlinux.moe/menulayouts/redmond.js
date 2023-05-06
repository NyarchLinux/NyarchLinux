const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, Gtk, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.REDMOND; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.GRID,
            SearchDisplayType: Constants.DisplayType.GRID,
            ColumnSpacing: 10,
            RowSpacing: 10,
            DefaultMenuWidth: 415,
            DefaultIconGridStyle: "SmallIconGrid",
            VerticalMainBox: false,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.LARGE_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }
    createLayout(){
        super.createLayout();

        this.navBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style: 'padding-bottom: 5px;'
        });

        this.defaultMenuView = this._settings.get_enum('default-menu-view-redmond');

        if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS){
            this.backButton = this._createNavigationRow(_("All Apps"), Constants.Direction.GO_PREVIOUS, _("Back"), () => this.setDefaultMenuView());
            this.viewProgramsButton = this._createNavigationRow(_("Pinned"), Constants.Direction.GO_NEXT, _("All Apps"), () => this.displayAllApps());
        }
        else if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS){
            this.backButton = this._createNavigationRow(_("Pinned"), Constants.Direction.GO_PREVIOUS, _("Back"), () => this.setDefaultMenuView());
            this.viewProgramsButton = this._createNavigationRow(_("All Apps"), Constants.Direction.GO_NEXT, _("Pinned"), () => this.displayPinnedApps());
        }

        this.backButton.style = 'padding: 0px 10px;';
        this.viewProgramsButton.style = 'padding: 0px 10px;';

        this.navBox.add_child(this.backButton);
        this.navBox.add_child(this.viewProgramsButton);

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true
        });
        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.TOP){
            this.searchBox.add_style_class_name('arcmenu-search-top');
            this.subMainBox.add_child(this.searchBox);
        }

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            style: "margin: 2px 0px;"
        });

        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class: this.disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.subMainBox.add_child(this.navBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.BOTTOM){
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            this.subMainBox.add_child(this.searchBox);
        }

        this.rightBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            vertical: true,
        });

        this.placesShortcuts = false;
        this.externalDevicesShorctus = false;
        this.networkDevicesShorctus = false;
        this.bookmarksShorctus = false;
        this.softwareShortcuts = false;

        if(!this._settings.get_boolean('disable-user-avatar')){
            this.user = new MW.UserMenuItem(this, Constants.DisplayType.LIST);
            this.rightBox.add_child(this.user);
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT, Constants.SeparatorAlignment.HORIZONTAL);
            this.rightBox.add_child(separator);
        }

        this.shortcutsBox = new St.BoxLayout({
            vertical: true
        });

        this.shortcutsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class: (this.disableFadeEffect ? '' : 'small-vfade'),
        });

        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.rightBox.add_child(this.shortcutsScrollBox);

        // Add place shortcuts to menu (Home,Documents,Downloads,Music,Pictures,Videos)
        this._displayPlaces();

        //draw bottom right horizontal separator + logic to determine if should show
        let shouldDraw = false;
        if(this._settings.get_value('directory-shortcuts-list').deep_unpack().length>0){
            this.placesShortcuts = true;
        }
        if(this._settings.get_value('application-shortcuts-list').deep_unpack().length>0){
            this.softwareShortcuts = true;
        }

        //check to see if should draw separator
        if(this.placesShortcuts && (this._settings.get_boolean('show-external-devices') || this.softwareShortcuts || this._settings.get_boolean('show-bookmarks'))  )
            shouldDraw = true;
        if(shouldDraw){
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT, Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        //External Devices and Bookmarks Shortcuts
        this.externalDevicesBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this.shortcutsBox.add_child(this.externalDevicesBox);

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

        let applicationShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack();
        for(let i = 0; i < applicationShortcuts.length; i++){
            let shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.LIST, false);
            if(shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
        }

        let powerDisplayStyle = this._settings.get_enum('power-display-style');
        if(powerDisplayStyle === Constants.PowerDisplayStyle.MENU)
            this.powerOptionsBox = new MW.LeaveButton(this, true);
        else{
            this.powerOptionsBox = new MW.PowerOptionsBox(this, 6);
            this.powerOptionsBox.x_expand = true;
            this.powerOptionsBox.x_align = Clutter.ActorAlign.CENTER;
        }

        this.powerOptionsBox.y_expand = true;
        this.powerOptionsBox.y_align = Clutter.ActorAlign.END;

        this.rightBox.add_child(this.powerOptionsBox);

        let horizonalFlip = this._settings.get_boolean("enable-horizontal-flip");
        this.mainBox.add_child(horizonalFlip ? this.rightBox : this.subMainBox);
        let verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.VERTICAL);
        this.mainBox.add_child(verticalSeparator);
        this.mainBox.add_child(horizonalFlip ? this.subMainBox: this.rightBox);
        horizonalFlip ? this.rightBox.style += "margin-right: 0px" : this.rightBox.style += "margin-left: 0px";

        this.hasPinnedApps = true;
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView){
        const rightPanelWidth = this._settings.get_int("right-panel-width");
        this.rightBox.style = `width: ${rightPanelWidth}px;`;

        const widthAdjustment = this._settings.get_int("menu-width-adjustment");
        let menuWidth = this.layoutProperties.DefaultMenuWidth + widthAdjustment;
        //Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.layoutProperties.MenuWidth = menuWidth;

        if(setDefaultMenuView)
            this.setDefaultMenuView();
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();

        this.navBox.show();
        this.viewProgramsButton.show();
        this.backButton.hide();

        if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS){
            this.displayPinnedApps();
        }
        else if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS){
            this.displayAllApps();
        }
    }

    displayPinnedApps(){
        if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS){
            this.viewProgramsButton.show();
            this.backButton.hide();
        }
        else if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS){
            this.viewProgramsButton.hide();
            this.backButton.show();
        }
        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayAllApps(){
        super.displayAllApps();

        if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS){
            this.viewProgramsButton.hide();
            this.backButton.show();
        }
        else if(this.defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS){
            this.viewProgramsButton.show();
            this.backButton.hide();
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        super.loadCategories();
    }

    _onSearchBoxChanged(searchBox, searchString){
        if(!searchBox.isEmpty())
            this.navBox.hide();
        super._onSearchBoxChanged(searchBox, searchString);
    }
}
