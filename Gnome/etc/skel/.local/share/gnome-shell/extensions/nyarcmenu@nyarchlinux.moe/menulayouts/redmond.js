/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.REDMOND;
}

var Menu = class ArcMenuRedmondLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 415,
            icon_grid_style: 'SmallIconGrid',
            vertical: false,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.connect('button-press-event', (actor, event) => {
            if (this.backButton.visible && event.get_button() === 8)
                this.backButton.activate(event);
        });

        const mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });

        this.rightBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            vertical: true,
        });

        const verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = Me.settings.get_boolean('enable-horizontal-flip');
        this.add_child(horizontalFlip ? this.rightBox : mainBox);
        this.add_child(verticalSeparator);
        this.add_child(horizontalFlip ? mainBox : this.rightBox);
        this.rightBox.style += horizontalFlip ? 'margin-right: 0px' : 'margin-left: 0px';

        this.navBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style: 'padding-bottom: 5px;',
        });
        mainBox.add_child(this.navBox);

        const defaultMenuView = Me.settings.get_enum('default-menu-view-redmond');
        if (defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS) {
            this.backButton = this._createNavigationRow(_('All Apps'), Constants.Direction.GO_PREVIOUS,
                _('Back'), () => this.setDefaultMenuView());
            this._viewAllAppsButton = this._createNavigationRow(_('Pinned'), Constants.Direction.GO_NEXT,
                _('All Apps'), () => this.displayAllApps());
        } else if (defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS) {
            this.backButton = this._createNavigationRow(_('Pinned'), Constants.Direction.GO_PREVIOUS,
                _('Back'), () => this.setDefaultMenuView());
            this._viewAllAppsButton = this._createNavigationRow(_('All Apps'), Constants.Direction.GO_NEXT,
                _('Pinned'), () => this.displayPinnedApps());
        }

        this.backButton.style = 'padding: 0px 10px;';
        this._viewAllAppsButton.style = 'padding: 0px 10px;';

        this.navBox.add_child(this.backButton);
        this.navBox.add_child(this._viewAllAppsButton);

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            style: 'margin: 2px 0px;',
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        mainBox.add_child(this.applicationsScrollBox);

        const searchbarLocation = Me.settings.get_enum('searchbar-default-top-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.searchBox.add_style_class_name('arcmenu-search-top');
            mainBox.insert_child_at_index(this.searchBox, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            mainBox.add_child(this.searchBox);
        }

        const userAvatar = Me.settings.get_boolean('disable-user-avatar');
        if (!userAvatar) {
            const userMenuItem = new MW.UserMenuItem(this, Constants.DisplayType.LIST);
            this.rightBox.add_child(userMenuItem);
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.rightBox.add_child(separator);
        }

        this.shortcutsBox = new St.BoxLayout({vertical: true});
        this.shortcutsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.rightBox.add_child(this.shortcutsScrollBox);

        // Add place shortcuts to menu (Home,Documents,Downloads,Music,Pictures,Videos)
        this._displayPlaces();

        const haveDirectoryShortcuts = Me.settings.get_value('directory-shortcuts-list').deep_unpack().length > 0;
        const haveApplicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack().length > 0;

        // check to see if should draw separator
        const needsSeparator = haveDirectoryShortcuts &&
                               (Me.settings.get_boolean('show-external-devices') || haveApplicationShortcuts ||
                                Me.settings.get_boolean('show-bookmarks'));
        if (needsSeparator) {
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        // External Devices and Bookmarks Shortcuts
        const externalDevicesBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        this.shortcutsBox.add_child(externalDevicesBox);

        this._placesSections = {};
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            const id = Constants.SECTIONS[i];
            this._placesSections[id] = new St.BoxLayout({vertical: true});
            this.placesManager.setConnection(`${id}-updated`, () => this._redisplayPlaces(id), this);

            this._createPlaces(id);
            externalDevicesBox.add_child(this._placesSections[id]);
        }

        const applicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.LIST, false);
            if (shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
        }

        let powerOptionsDisplay;
        const powerDisplayStyle = Me.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.MENU) {
            powerOptionsDisplay = new MW.LeaveButton(this, true);
        } else {
            powerOptionsDisplay = new MW.PowerOptionsBox(this);
            powerOptionsDisplay.set({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
        }

        powerOptionsDisplay.set({
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.rightBox.add_child(powerOptionsDisplay);

        this.hasPinnedApps = true;
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView) {
        const rightPanelWidth = Me.settings.get_int('right-panel-width');
        this.rightBox.style = `width: ${rightPanelWidth}px;`;

        const widthAdjustment = Me.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        this.navBox.show();
        this._viewAllAppsButton.show();
        this.backButton.hide();

        const defaultMenuView = Me.settings.get_enum('default-menu-view-redmond');
        if (defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS)
            this.displayPinnedApps();
        else if (defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS)
            this.displayAllApps();
    }

    displayPinnedApps() {
        const defaultMenuView = Me.settings.get_enum('default-menu-view-redmond');
        if (defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS) {
            this._viewAllAppsButton.show();
            this.backButton.hide();
        } else if (defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS) {
            this._viewAllAppsButton.hide();
            this.backButton.show();
        }
        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayAllApps() {
        super.displayAllApps();

        const defaultMenuView = Me.settings.get_enum('default-menu-view-redmond');
        if (defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS) {
            this._viewAllAppsButton.hide();
            this.backButton.show();
        } else if (defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS) {
            this._viewAllAppsButton.show();
            this.backButton.hide();
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        super.loadCategories();
    }

    _onSearchBoxChanged(searchBox, searchString) {
        if (!searchBox.isEmpty())
            this.navBox.hide();
        super._onSearchBoxChanged(searchBox, searchString);
    }
};
