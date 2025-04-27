import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import * as PlaceDisplay from '../placeDisplay.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            search_results_spacing: 4,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 415,
            icon_grid_size: Constants.GridIconSize.SMALL,
            ...getOrientationProp(false),
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
            ...getOrientationProp(true),
        });

        this.rightBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            ...getOrientationProp(true),
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        this.add_child(horizontalFlip ? this.rightBox : mainBox);
        this.add_child(verticalSeparator);
        this.add_child(horizontalFlip ? mainBox : this.rightBox);
        this.rightBox.style += horizontalFlip ? 'margin-right: 0px' : 'margin-left: 0px';

        this.navBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'padding-bottom: 5px;',
        });
        mainBox.add_child(this.navBox);

        const defaultMenuView = ArcMenuManager.settings.get_enum('default-menu-view-redmond');
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
            ...getOrientationProp(true),
            style: 'margin: 2px 0px;',
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        mainBox.add_child(this.applicationsScrollBox);

        const searchbarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.add_style_class_name('arcmenu-search-top');
            mainBox.insert_child_at_index(this.searchEntry, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.add_style_class_name('arcmenu-search-bottom');
            mainBox.add_child(this.searchEntry);
        }

        const userAvatar = ArcMenuManager.settings.get_boolean('disable-user-avatar');
        if (!userAvatar) {
            const avatarMenuItem = new MW.AvatarMenuItem(this, Constants.DisplayType.LIST);
            this.rightBox.add_child(avatarMenuItem);
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.rightBox.add_child(separator);
        }

        this.shortcutsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.shortcutsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this._addChildToParent(this.shortcutsScrollBox, this.shortcutsBox);
        this.rightBox.add_child(this.shortcutsScrollBox);

        // Add place shortcuts to menu (Home,Documents,Downloads,Music,Pictures,Videos)
        this._displayPlaces();

        const haveDirectoryShortcuts = ArcMenuManager.settings.get_value('directory-shortcuts').deep_unpack().length > 0;
        const haveApplicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack().length > 0;

        // check to see if should draw separator
        const needsSeparator = haveDirectoryShortcuts &&
                               (ArcMenuManager.settings.get_boolean('show-external-devices') || haveApplicationShortcuts ||
                                ArcMenuManager.settings.get_boolean('show-bookmarks'));
        if (needsSeparator) {
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.SHORT,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.shortcutsBox.add_child(separator);
        }

        // External Devices and Bookmarks Shortcuts
        const externalDevicesBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
        });
        this.shortcutsBox.add_child(externalDevicesBox);

        this._placesSections = {};
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            const id = Constants.SECTIONS[i];
            this._placesSections[id] = new St.BoxLayout({...getOrientationProp(true)});
            this.placesManager.connectObject(`${id}-updated`, () => this._redisplayPlaces(id), this);

            this._createPlaces(id);
            externalDevicesBox.add_child(this._placesSections[id]);
        }

        const applicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.LIST, false);
            if (shortcutMenuItem.shouldShow)
                this.shortcutsBox.add_child(shortcutMenuItem);
            else
                shortcutMenuItem.destroy();
        }

        let powerOptionsDisplay;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
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
        this._connectAppChangedEvents();
    }

    updateWidth(setDefaultMenuView) {
        const rightPanelWidth = ArcMenuManager.settings.get_int('right-panel-width');
        this.rightBox.style = `width: ${rightPanelWidth}px;`;

        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
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

        const defaultMenuView = ArcMenuManager.settings.get_enum('default-menu-view-redmond');
        if (defaultMenuView === Constants.DefaultMenuViewRedmond.PINNED_APPS)
            this.displayPinnedApps();
        else if (defaultMenuView === Constants.DefaultMenuViewRedmond.ALL_PROGRAMS)
            this.displayAllApps();
    }

    displayPinnedApps() {
        const defaultMenuView = ArcMenuManager.settings.get_enum('default-menu-view-redmond');
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

        const defaultMenuView = ArcMenuManager.settings.get_enum('default-menu-view-redmond');
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

    _onSearchEntryChanged(searchEntry, searchString) {
        if (!searchEntry.isEmpty())
            this.navBox.hide();
        super._onSearchEntryChanged(searchEntry, searchString);
    }
}
