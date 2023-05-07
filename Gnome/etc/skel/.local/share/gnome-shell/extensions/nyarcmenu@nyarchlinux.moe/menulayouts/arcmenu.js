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
    return Constants.MenuLayout.ARCMENU;
}

var Menu = class ArcMenuArcMenuLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            is_dual_panel: true,
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            column_spacing: 0,
            row_spacing: 0,
            vertical: true,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.connect('button-press-event', (actor, event) => {
            if (this.backButton.visible && event.get_button() === 8)
                this.backButton.activate(event);
        });

        // mainBox stores left and right box
        const mainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.add_child(mainBox);

        this.leftBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            vertical: true,
            y_align: Clutter.ActorAlign.FILL,
        });

        this.rightBox = new St.BoxLayout({vertical: true});

        // Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.applicationsScrollBox);

        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.leftBox.add_child(this.navigateBox);

        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.navigateBox.add_child(separator);

        this.backButton = new MW.BackButton(this);
        this.navigateBox.add_child(this.backButton);

        this._viewAllAppsButton = new MW.ViewAllAppsButton(this);
        this.navigateBox.add_child(this._viewAllAppsButton);

        const searchbarLocation = Me.settings.get_enum('searchbar-default-bottom-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.searchBox.add_style_class_name('arcmenu-search-top');
            this.insert_child_at_index(this.searchBox, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            this.leftBox.add_child(this.searchBox);
        }

        const verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = Me.settings.get_boolean('enable-horizontal-flip');
        mainBox.add_child(horizontalFlip ? this.rightBox : this.leftBox);
        mainBox.add_child(verticalSeparator);
        mainBox.add_child(horizontalFlip ? this.leftBox : this.rightBox);

        const userAvatar = Me.settings.get_boolean('disable-user-avatar');
        if (!userAvatar) {
            const userMenuItem = new MW.UserMenuItem(this, Constants.DisplayType.LIST);
            this.rightBox.add_child(userMenuItem);
            const userAvatarSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.rightBox.add_child(userAvatarSeparator);
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
            const shortcutsSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(shortcutsSeparator);
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

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    _createExtraCategoriesLinks() {
        this.extraCategoriesLinksBox = new St.BoxLayout({vertical: true});
        this.extraCategoriesLinksBox.visible = false;

        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.extraCategoriesLinksBox.add_child(separator);

        const extraCategoriesLinksLocation = Me.settings.get_enum('arcmenu-extra-categories-links-location');
        if (extraCategoriesLinksLocation === Constants.MenuItemLocation.TOP)
            this.leftBox.insert_child_below(this.extraCategoriesLinksBox, this.applicationsScrollBox);
        else
            this.navigateBox.insert_child_above(this.extraCategoriesLinksBox, this.navigateBox.get_child_at_index(0));

        this.showExtraCategoriesLinksBox = false;
        const extraCategories = Me.settings.get_value('arcmenu-extra-categories-links').deep_unpack();
        const defaultMenuView = Me.settings.get_enum('default-menu-view');

        // Don't create extra categories quick links if
        // the default menu view is the categories list
        if (defaultMenuView === Constants.DefaultMenuView.CATEGORIES_LIST)
            return;

        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];
            const extraCategoryItem = this.categoryDirectories.get(categoryEnum);

            // Don't show the extra category if the default menu view is the same category.
            if (shouldShow && categoryEnum === Constants.CategoryType.PINNED_APPS &&
                defaultMenuView === Constants.DefaultMenuView.PINNED_APPS)
                continue;
            else if (shouldShow && categoryEnum === Constants.CategoryType.FREQUENT_APPS &&
                defaultMenuView === Constants.DefaultMenuView.FREQUENT_APPS)
                continue;
            else if (shouldShow && categoryEnum === Constants.CategoryType.ALL_PROGRAMS &&
                defaultMenuView === Constants.DefaultMenuView.ALL_PROGRAMS)
                continue;
            else if (!extraCategoryItem || !shouldShow)
                continue;

            this.showExtraCategoriesLinksBox = true;
            if (extraCategoryItem.get_parent())
                extraCategoryItem.get_parent().remove_child(extraCategoryItem);

            this.extraCategoriesLinksBox.insert_child_below(extraCategoryItem, separator);
        }
        this.extraCategoriesLinksBox.visible = this.showExtraCategoriesLinksBox;
    }

    loadCategories() {
        if (this.extraCategoriesLinksBox)
            this.extraCategoriesLinksBox.destroy();
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();
        const defaultMenuView = Me.settings.get_enum('default-menu-view');
        if (defaultMenuView === Constants.DefaultMenuView.PINNED_APPS)
            this.hasPinnedApps = true;

        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];

            // Don't show the extra category if the default menu view is the same category.
            if (shouldShow && categoryEnum === Constants.CategoryType.PINNED_APPS &&
                defaultMenuView === Constants.DefaultMenuView.PINNED_APPS)
                continue;
            else if (shouldShow && categoryEnum === Constants.CategoryType.FREQUENT_APPS &&
                defaultMenuView === Constants.DefaultMenuView.FREQUENT_APPS)
                continue;
            else if (!shouldShow)
                continue;

            const categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
            this.categoryDirectories.set(categoryEnum, categoryMenuItem);
        }

        super.loadCategories();

        this._createExtraCategoriesLinks();
    }

    displayPinnedApps() {
        const defaultMenuView = Me.settings.get_enum('default-menu-view');
        if (defaultMenuView === Constants.DefaultMenuView.PINNED_APPS) {
            this._viewAllAppsButton.show();
            this.backButton.hide();
        } else {
            this._viewAllAppsButton.hide();
            this.backButton.show();
        }

        this.extraCategoriesLinksBox.visible = this.showExtraCategoriesLinksBox;

        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayAllApps(showBackButton = true) {
        super.displayAllApps();
        this._viewAllAppsButton.hide();

        if (showBackButton) {
            this.extraCategoriesLinksBox.visible = false;
            this.backButton.show();
        } else {
            this.extraCategoriesLinksBox.visible = this.showExtraCategoriesLinksBox;
            this.backButton.hide();
        }
    }

    displayCategories() {
        const defaultMenuView = Me.settings.get_enum('default-menu-view');
        if (defaultMenuView === Constants.DefaultMenuView.PINNED_APPS ||
            defaultMenuView === Constants.DefaultMenuView.FREQUENT_APPS) {
            this._viewAllAppsButton.hide();
            this.backButton.show();
        } else {
            this._viewAllAppsButton.show();
            this.backButton.hide();
        }

        this.extraCategoriesLinksBox.visible = false;

        super.displayCategories();
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        const defaultMenuView = Me.settings.get_enum('default-menu-view');
        if (defaultMenuView === Constants.DefaultMenuView.PINNED_APPS)
            this.displayPinnedApps();
        else if (defaultMenuView === Constants.DefaultMenuView.CATEGORIES_LIST)
            this.displayCategories();
        else if (defaultMenuView === Constants.DefaultMenuView.FREQUENT_APPS)
            this.displayFrequentApps();
        else if (defaultMenuView === Constants.DefaultMenuView.ALL_PROGRAMS)
            this.displayAllApps(false);
    }

    displayCategoryAppList(appList, category) {
        this.extraCategoriesLinksBox.visible = false;
        this._viewAllAppsButton.hide();
        this.backButton.show();
        super.displayCategoryAppList(appList, category);
    }

    displayFrequentApps() {
        this._clearActorsFromBox();

        this.extraCategoriesLinksBox.visible = this.showExtraCategoriesLinksBox;
        this._viewAllAppsButton.show();
        this.backButton.hide();

        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        const appList = [];
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()) {
                const isContainedInCategory = false;
                const item = new MW.ApplicationMenuItem(this, mostUsed[i], Constants.DisplayType.LIST,
                    null, isContainedInCategory);
                appList.push(item);
            }
        }
        let activeMenuItemSet = false;
        for (let i = 0; i < appList.length; i++) {
            const item = appList[i];
            if (item.get_parent())
                item.get_parent().remove_child(item);
            this.applicationsBox.add_child(item);
            if (!activeMenuItemSet) {
                activeMenuItemSet = true;
                this.activeMenuItem = item;
            }
        }
    }

    displayRecentFiles() {
        this.extraCategoriesLinksBox.visible = false;
        this.backButton.show();
        this._viewAllAppsButton.hide();
        super.displayRecentFiles();
    }

    _clearActorsFromBox(box) {
        // keep track of the previous category for the back button.
        this.previousCategoryType = this.activeCategoryType;
        super._clearActorsFromBox(box);
    }

    _onSearchBoxChanged(searchBox, searchString) {
        super._onSearchBoxChanged(searchBox, searchString);
        if (!searchBox.isEmpty()) {
            this.extraCategoriesLinksBox.visible = false;
            this.backButton.show();
            this._viewAllAppsButton.hide();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }
};
