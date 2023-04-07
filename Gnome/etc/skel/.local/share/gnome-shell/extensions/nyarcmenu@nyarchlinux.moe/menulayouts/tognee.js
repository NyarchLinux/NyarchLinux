/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.TOGNEE;
}

var Menu = class ArcMenuTogneeLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 290,
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

        this._mainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.add_child(this._mainBox);

        // Contains the app list and the searchbar
        this.appBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            vertical: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.appBox.add_child(this.applicationsScrollBox);
        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox.add_actor(this.applicationsBox);

        this.navigateBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.backButton = new MW.BackButton(this);
        this.navigateBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL));
        this.navigateBox.add_child(this.backButton);
        this.appBox.add_child(this.navigateBox);

        const searchbarLocation = Me.settings.get_enum('searchbar-default-bottom-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.searchBox.add_style_class_name('arcmenu-search-top');
            this.appBox.insert_child_at_index(this.searchBox, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            this.appBox.add_child(this.searchBox);
        }

        // Contains shortcutsBox and power buttons
        this.quickBox = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            style: 'spacing: 6px;',
        });

        const verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = Me.settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.appBox : this.quickBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.quickBox : this.appBox);

        this.shortcutsBox = new St.BoxLayout({
            vertical: true,
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            style: 'spacing: 6px;',
        });
        this.shortcutsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.shortcutsScrollBox.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
        this.shortcutsScrollBox.add_actor(this.shortcutsBox);
        this.quickBox.add_child(this.shortcutsScrollBox);

        this._displayPlaces();

        const haveDirectoryShortcuts = Me.settings.get_value('directory-shortcuts-list').deep_unpack().length > 0;
        const haveApplicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack().length > 0;
        if (haveDirectoryShortcuts && haveApplicationShortcuts) {
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        const applicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.BUTTON, false);
            if (shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
        }

        let leaveButton;
        const powerDisplayStyle = Me.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            leaveButton = new MW.PowerOptionsBox(this, true);
        else
            leaveButton = new MW.LeaveButton(this);

        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.quickBox.add_child(separator);
        this.quickBox.add_child(leaveButton);

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView) {
        const widthAdjustment = Me.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 175px minimum limit for the menu width
        menuWidth = Math.max(175, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;
        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    _displayPlaces() {
        const directoryShortcuts = Me.settings.get_value('directory-shortcuts-list').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            const directory = directoryShortcuts[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.BUTTON, isContainedInCategory);
            this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];
            if (shouldShow) {
                const categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    displayPinnedApps() {
        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;
        this.navigateBox.show();
    }

    displayAllApps() {
        this.navigateBox.hide();
        super.displayAllApps();
    }

    displayCategories() {
        super.displayCategories();
        this.activeCategoryType = Constants.CategoryType.CATEGORIES_LIST;
        this.navigateBox.hide();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        const defaultMenuView = Me.settings.get_enum('default-menu-view-tognee');
        if (defaultMenuView === Constants.DefaultMenuViewTognee.CATEGORIES_LIST)
            this.displayCategories();
        else if (defaultMenuView === Constants.DefaultMenuViewTognee.ALL_PROGRAMS)
            this.displayAllApps();
    }

    displayCategoryAppList(appList, category) {
        super.displayCategoryAppList(appList, category);
        this.navigateBox.show();
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
        this.navigateBox.show();
    }

    _onSearchBoxChanged(searchBox, searchString) {
        super._onSearchBoxChanged(searchBox, searchString);
        if (searchBox.isEmpty()) {
            this.navigateBox.hide();
        } else if (!searchBox.isEmpty()) {
            this.navigateBox.show();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }
};
