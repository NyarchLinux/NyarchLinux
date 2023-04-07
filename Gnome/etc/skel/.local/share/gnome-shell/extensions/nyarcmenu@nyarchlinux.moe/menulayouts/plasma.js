/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, Shell, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.PLASMA;
}

var Menu = class ArcMenuPlasmaLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 450,
            vertical: true,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.MEDIUM_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        // Some menu items might not be on the menu at the time of destroy();
        // Track them here.
        this._destroyableObjects = [];

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
        });
        this.leftTopBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding-left: 10px; margin-left: 0.4em',
        });
        this.rightTopBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            style_class: 'popup-menu-item',
            style: 'padding: 0px; margin: 0px; spacing: 0px;',
        });

        const userMenuIcon = new MW.UserMenuIcon(this, 55, true);
        userMenuIcon.set({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        userMenuIcon.label.set({
            style: 'padding-left: 0.4em; margin: 0px 10px 0px 15px; font-weight: bold;',
            y_expand: false,
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });

        this.leftTopBox.add_child(userMenuIcon);
        this.rightTopBox.add_child(userMenuIcon.label);
        this.rightTopBox.add_child(this.searchBox);
        this.topBox.add_child(this.leftTopBox);
        this.topBox.add_child(this.rightTopBox);

        // Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBoxContainer = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
        });
        this.navigateBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 6px;',
        });

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_homogeneous: true,
            column_spacing: 10,
            row_spacing: 10,
        });
        this.grid = new St.Widget({layout_manager: layout});
        layout.hookup_style(this.grid);
        this.navigateBox.add_child(this.grid);

        this.pinnedAppsButton = new MW.PlasmaMenuItem(this, _('Pinned'), Constants.ArcMenuLogoSymbolic);
        this.pinnedAppsButton.connect('activate', () => this.displayPinnedApps());
        this.grid.layout_manager.attach(this.pinnedAppsButton, 0, 0, 1, 1);
        this.pinnedAppsButton.set_style_pseudo_class('active-item');

        this.applicationsButton = new MW.PlasmaMenuItem(this, _('Apps'), 'preferences-desktop-apps-symbolic');
        this.applicationsButton.connect('activate', () => this.displayCategories());
        this.grid.layout_manager.attach(this.applicationsButton, 1, 0, 1, 1);

        this.computerButton = new MW.PlasmaMenuItem(this, _('Computer'), 'computer-symbolic');
        this.computerButton.connect('activate', () => this.displayComputerCategory());
        this.grid.layout_manager.attach(this.computerButton, 2, 0, 1, 1);

        this.leaveButton = new MW.PlasmaMenuItem(this, _('Leave'), 'system-shutdown-symbolic');
        this.leaveButton.connect('activate', () => this.displayPowerItems());
        this.grid.layout_manager.attach(this.leaveButton, 3, 0, 1, 1);

        this.categoryHeader = new MW.PlasmaCategoryHeader(this);

        const searchBarLocation = Me.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchBox.style = 'margin: 3px 10px 5px 10px;';
            this.topBox.style = 'padding-top: 0.5em;';
            this.navigateBoxContainer.set({
                y_expand: false,
                y_align: Clutter.ActorAlign.START,
            });

            this.navigateBoxContainer.add_child(this.navigateBox);

            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);

            this.add_child(this.navigateBoxContainer);
            this.add_child(this.applicationsScrollBox);

            separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(separator);

            this.add_child(this.topBox);
        } else if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchBox.style = 'margin: 3px 10px 10px 10px;';
            this.navigateBoxContainer.set({
                y_expand: true,
                y_align: Clutter.ActorAlign.END,
            });

            this.add_child(this.topBox);

            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(separator);

            this.add_child(this.applicationsScrollBox);

            separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);

            this.navigateBoxContainer.add_child(this.navigateBox);
            this.add_child(this.navigateBoxContainer);
        }

        const applicationShortcutsList = Me.settings.get_value('application-shortcuts-list').deep_unpack();
        this.applicationShortcuts = [];
        for (let i = 0; i < applicationShortcutsList.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcutsList[i],
                Constants.DisplayType.LIST, false);
            if (shortcutMenuItem.shouldShow)
                this.applicationShortcuts.push(shortcutMenuItem);
        }

        const directoryShortcutsList = Me.settings.get_value('directory-shortcuts-list').deep_unpack();
        this._loadPlaces(directoryShortcutsList);

        this.externalDevicesBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
        });

        this._placesSections = {};
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            const id = Constants.SECTIONS[i];
            this._placesSections[id] = new St.BoxLayout({vertical: true});
            this.placesManager.setConnection(`${id}-updated`, () => this._redisplayPlaces(id), this);

            this._createPlaces(id);
            this.externalDevicesBox.add_child(this._placesSections[id]);
        }

        this.updateWidth();
        this._createPowerItems();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    populateFrequentAppsList(categoryMenuItem) {
        categoryMenuItem.appList = [];
        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()) {
                categoryMenuItem.appList.push(mostUsed[i]);
                let item = this.applicationsMap.get(mostUsed[i]);
                if (!item) {
                    item = new MW.ApplicationMenuItem(this, mostUsed[i], this.display_type);
                    this.applicationsMap.set(mostUsed[i], item);
                }
            }
        }
    }

    _clearActorsFromBox(box) {
        this.categoryHeader.setActiveCategory(null);
        if (this.contains(this.categoryHeader))
            this.remove_child(this.categoryHeader);
        super._clearActorsFromBox(box);
    }

    clearActiveItem() {
        this.pinnedAppsButton.setActive(false);
        this.computerButton.setActive(false);
        this.applicationsButton.setActive(false);
        this.leaveButton.setActive(false);
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();

        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];

            if (categoryEnum === Constants.CategoryType.PINNED_APPS || !shouldShow)
                continue;

            const categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
            this.categoryDirectories.set(categoryEnum, categoryMenuItem);
        }

        super.loadCategories();
    }

    displayComputerCategory() {
        this._clearActorsFromBox(this.applicationsBox);
        this.applicationsBox.add_child(this.createLabelRow(_('Application Shortcuts')));

        for (let i = 0; i < this.applicationShortcuts.length; i++)
            this.applicationsBox.add_child(this.applicationShortcuts[i]);

        this.applicationsBox.add_child(this.createLabelRow(_('Places')));

        for (let i = 0; i < this.directoryShortcuts.length; i++)
            this.applicationsBox.add_child(this.directoryShortcuts[i]);

        this.applicationsBox.add_child(this.externalDevicesBox);
        this.activeMenuItem = this.applicationShortcuts[0];
    }

    _createPlaces(id) {
        const places = this.placesManager.get(id);

        if (places.length === 0)
            return;
        else if (id === 'bookmarks')
            this._placesSections[id].add_child(this.createLabelRow(_('Bookmarks')));
        else if (id === 'devices')
            this._placesSections[id].add_child(this.createLabelRow(_('Devices')));
        else if (id === 'network')
            this._placesSections[id].add_child(this.createLabelRow(_('Network')));
        else
            return;

        for (let i = 0; i < places.length; i++) {
            const item = new MW.PlaceMenuItem(this, places[i], Constants.DisplayType.LIST);
            this._placesSections[id].add_child(item);
        }
    }

    displayPinnedApps() {
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        super.displayPinnedApps();
    }

    _loadPlaces(directoryShortcutsList) {
        this.directoryShortcuts = [];
        for (let i = 0; i < directoryShortcutsList.length; i++) {
            const isContainedInCategory = false;
            const directory = directoryShortcutsList[i];
            const placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.LIST, isContainedInCategory);
            this.directoryShortcuts.push(placeMenuItem);
        }
    }

    _createPowerItems() {
        this.sessionBox = new St.BoxLayout({vertical: true});
        this._destroyableObjects.push(this.sessionBox);
        this.sessionBox.add_child(this.createLabelRow(_('Session')));

        this.systemBox = new St.BoxLayout({vertical: true});
        this._destroyableObjects.push(this.systemBox);
        this.systemBox.add_child(this.createLabelRow(_('System')));

        this.hasSessionOption = false;
        this.hasSystemOption = false;

        const powerOptions = Me.settings.get_value('power-options').deep_unpack();
        for (let i = 0; i < powerOptions.length; i++) {
            const powerType = powerOptions[i][0];
            const shouldShow = powerOptions[i][1];

            if (!shouldShow)
                continue;

            const powerButton = new MW.PowerMenuItem(this, powerType);
            if (powerType === Constants.PowerType.LOCK || powerType === Constants.PowerType.LOGOUT ||
                powerType === Constants.PowerType.SWITCH_USER) {
                this.hasSessionOption = true;
                this.sessionBox.add_child(powerButton);
            } else {
                this.hasSystemOption = true;
                this.systemBox.add_child(powerButton);
            }
        }
    }

    displayPowerItems() {
        this._clearActorsFromBox(this.applicationsBox);
        if (this.hasSessionOption)
            this.applicationsBox.add_child(this.sessionBox);
        if (this.hasSystemOption)
            this.applicationsBox.add_child(this.systemBox);
    }

    displayCategories() {
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
        this._clearActorsFromBox(this.applicationsBox);

        this.categoryHeader.setActiveCategory(null);
        this._insertCategoryHeader();

        let isActiveMenuItemSet = false;
        let hasExtraCategory = false;
        let separatorAdded = false;

        for (const categoryMenuItem of this.categoryDirectories.values()) {
            const isExtraCategory = categoryMenuItem.isExtraCategory();

            if (!hasExtraCategory) {
                hasExtraCategory = isExtraCategory;
            } else if (!isExtraCategory && !separatorAdded) {
                this.applicationsBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL));
                separatorAdded = true;
            }

            this.applicationsBox.add_child(categoryMenuItem);
            if (!isActiveMenuItemSet) {
                isActiveMenuItemSet = true;
                this.activeMenuItem = categoryMenuItem;
            }
        }
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.clearActiveItem();
        this.pinnedAppsButton.set_style_pseudo_class('active-item');
        this.displayPinnedApps();
    }

    _insertCategoryHeader() {
        if (this.contains(this.categoryHeader))
            this.remove_child(this.categoryHeader);

        const searchBarLocation = Me.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.BOTTOM)
            this.insert_child_at_index(this.categoryHeader, 1);
        else
            this.insert_child_at_index(this.categoryHeader, 2);
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._insertCategoryHeader();
        this.categoryHeader.setActiveCategory(this.activeCategoryName);
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        this._insertCategoryHeader();
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
        this.categoryHeader.setActiveCategory(this.activeCategoryName);
    }

    _onSearchBoxChanged(searchBox, searchString) {
        super._onSearchBoxChanged(searchBox, searchString);
        if (!searchBox.isEmpty()) {
            this.clearActiveItem();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }

    destroy() {
        for (const obj of this._destroyableObjects)
            obj.destroy();


        for (const item of this.applicationShortcuts)
            item.destroy();


        super.destroy();
    }
};
