import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 290,
            ...getOrientationProp(true),
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
            ...getOrientationProp(false),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.add_child(this._mainBox);

        // Contains the app list and the searchbar
        this.appBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            ...getOrientationProp(true),
            y_align: Clutter.ActorAlign.FILL,
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.appBox.add_child(this.applicationsScrollBox);
        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);

        this.navigateBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.backButton = new MW.BackButton(this);
        this.navigateBox.add_child(new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL));
        this.navigateBox.add_child(this.backButton);
        this.appBox.add_child(this.navigateBox);

        const searchbarLocation = ArcMenuManager.settings.get_enum('searchbar-default-bottom-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.add_style_class_name('arcmenu-search-top');
            this.appBox.insert_child_at_index(this.searchEntry, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.add_style_class_name('arcmenu-search-bottom');
            this.appBox.add_child(this.searchEntry);
        }

        // Contains shortcutsBox and power buttons
        this.quickBox = new St.BoxLayout({
            ...getOrientationProp(true),
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            style: 'spacing: 6px;',
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.appBox : this.quickBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.quickBox : this.appBox);

        this.shortcutsBox = new St.BoxLayout({
            ...getOrientationProp(true),
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
        this._addChildToParent(this.shortcutsScrollBox, this.shortcutsBox);
        this.quickBox.add_child(this.shortcutsScrollBox);

        this._displayPlaces();

        const haveDirectoryShortcuts = ArcMenuManager.settings.get_value('directory-shortcuts').deep_unpack().length > 0;
        const haveApplicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack().length > 0;
        if (haveDirectoryShortcuts && haveApplicationShortcuts) {
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.LONG,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        const applicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.BUTTON, false);
            if (shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
            else
                shortcutMenuItem.destroy();
        }

        let leaveButton;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            leaveButton = new MW.PowerOptionsBox(this, true);
        else
            leaveButton = new MW.LeaveButton(this);

        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.LONG,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.quickBox.add_child(separator);
        this.quickBox.add_child(leaveButton);

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    updateWidth(setDefaultMenuView) {
        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 175px minimum limit for the menu width
        menuWidth = Math.max(175, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;
        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    _displayPlaces() {
        const directoryShortcuts = ArcMenuManager.settings.get_value('directory-shortcuts').deep_unpack();
        for (let i = 0; i < directoryShortcuts.length; i++) {
            const directoryData = directoryShortcuts[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directoryData, Constants.DisplayType.BUTTON, isContainedInCategory);
            this.shortcutsBox.add_child(placeMenuItem);
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        const extraCategories = ArcMenuManager.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const [categoryEnum, shouldShow] = extraCategories[i];
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

        const defaultMenuView = ArcMenuManager.settings.get_enum('default-menu-view-tognee');
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

    _onSearchEntryChanged(searchEntry, searchString) {
        super._onSearchEntryChanged(searchEntry, searchString);
        if (searchEntry.isEmpty()) {
            this.navigateBox.hide();
        } else if (!searchEntry.isEmpty()) {
            this.navigateBox.show();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }
}
