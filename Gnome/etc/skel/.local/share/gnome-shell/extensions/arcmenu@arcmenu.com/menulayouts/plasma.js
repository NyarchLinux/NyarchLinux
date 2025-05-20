import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import * as PlaceDisplay from '../placeDisplay.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 450,
            ...getOrientationProp(true),
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
            ...getOrientationProp(false),
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
        });
        this.leftTopBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            ...getOrientationProp(false),
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding-left: 10px; margin-left: 0.4em',
        });
        this.rightTopBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            ...getOrientationProp(true),
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            style_class: 'popup-menu-item',
            style: 'padding: 0px; margin: 0px; spacing: 0px;',
        });

        const avatarMenuIcon = new MW.AvatarMenuIcon(this, 55, true);
        avatarMenuIcon.set({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        avatarMenuIcon.label.set({
            style: 'padding-left: 0.4em; margin: 0px 10px 0px 15px; font-weight: bold;',
            y_expand: false,
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
        });

        this.leftTopBox.add_child(avatarMenuIcon);
        this.rightTopBox.add_child(avatarMenuIcon.label);
        this.rightTopBox.add_child(this.searchEntry);
        this.topBox.add_child(this.leftTopBox);
        this.topBox.add_child(this.rightTopBox);

        // Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);

        this.navigateBoxContainer = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            ...getOrientationProp(true),
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

        this.pinnedAppsButton = new PlasmaMenuItem(this, _('Pinned'), `${ArcMenuManager.extension.path}/${Constants.ArcMenuLogoSymbolic}`);
        this.pinnedAppsButton.connect('activate', () => this.displayPinnedApps());
        this.grid.layout_manager.attach(this.pinnedAppsButton, 0, 0, 1, 1);
        this.pinnedAppsButton.setActive(true);

        this.applicationsButton = new PlasmaMenuItem(this, _('Apps'), 'preferences-desktop-apps-symbolic');
        this.applicationsButton.connect('activate', () => this.displayCategories());
        this.grid.layout_manager.attach(this.applicationsButton, 1, 0, 1, 1);

        this.computerButton = new PlasmaMenuItem(this, _('Computer'), 'computer-symbolic');
        this.computerButton.connect('activate', () => this.displayComputerCategory());
        this.grid.layout_manager.attach(this.computerButton, 2, 0, 1, 1);

        this.leaveButton = new PlasmaMenuItem(this, _('Leave'), 'system-shutdown-symbolic');
        this.leaveButton.connect('activate', () => this.displayPowerItems());
        this.grid.layout_manager.attach(this.leaveButton, 3, 0, 1, 1);

        this.categoryHeader = new PlasmaCategoryHeader(this);

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.style = 'margin: 3px 10px 5px 10px;';
            this.topBox.style = 'padding-top: 0.5em;';
            this.navigateBoxContainer.set({
                y_expand: false,
                y_align: Clutter.ActorAlign.START,
            });

            this.navigateBoxContainer.add_child(this.navigateBox);

            let separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);

            this.add_child(this.navigateBoxContainer);
            this.add_child(this.applicationsScrollBox);

            separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(separator);

            this.add_child(this.topBox);
        } else if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.style = 'margin: 3px 10px 10px 10px;';
            this.navigateBoxContainer.set({
                y_expand: true,
                y_align: Clutter.ActorAlign.END,
            });

            this.add_child(this.topBox);

            let separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(separator);

            this.add_child(this.applicationsScrollBox);

            separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.navigateBoxContainer.add_child(separator);

            this.navigateBoxContainer.add_child(this.navigateBox);
            this.add_child(this.navigateBoxContainer);
        }

        const applicationShortcutsList = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        this.applicationShortcuts = [];
        for (let i = 0; i < applicationShortcutsList.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcutsList[i],
                Constants.DisplayType.LIST, false);
            if (shortcutMenuItem.shouldShow)
                this.applicationShortcuts.push(shortcutMenuItem);
            else
                shortcutMenuItem.destroy();
        }

        const directoryShortcutsList = ArcMenuManager.settings.get_value('directory-shortcuts').deep_unpack();
        this._loadPlaces(directoryShortcutsList);

        this.externalDevicesBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
        });

        this._placesSections = {};
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            const id = Constants.SECTIONS[i];
            this._placesSections[id] = new St.BoxLayout({...getOrientationProp(true)});
            this.placesManager.connectObject(`${id}-updated`, () => this._redisplayPlaces(id), this);

            this._createPlaces(id);
            this.externalDevicesBox.add_child(this._placesSections[id]);
        }

        this.updateWidth();
        this._createPowerItems();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
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
        const extraCategories = ArcMenuManager.settings.get_value('extra-categories').deep_unpack();

        for (let i = 0; i < extraCategories.length; i++) {
            const [categoryEnum, shouldShow] = extraCategories[i];
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
            const directoryData = directoryShortcutsList[i];
            const placeMenuItem = this.createMenuItem(directoryData, Constants.DisplayType.LIST, isContainedInCategory);
            this.directoryShortcuts.push(placeMenuItem);
        }
    }

    _createPowerItems() {
        this.sessionBox = new St.BoxLayout({...getOrientationProp(true)});
        this._destroyableObjects.push(this.sessionBox);
        this.sessionBox.add_child(this.createLabelRow(_('Session')));

        this.systemBox = new St.BoxLayout({...getOrientationProp(true)});
        this._destroyableObjects.push(this.systemBox);
        this.systemBox.add_child(this.createLabelRow(_('System')));

        this.hasSessionOption = false;
        this.hasSystemOption = false;

        const powerOptions = ArcMenuManager.settings.get_value('power-options').deep_unpack();
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
                this.applicationsBox.add_child(new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
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
        this.pinnedAppsButton.setActive(true);
        this.displayPinnedApps();
    }

    _insertCategoryHeader() {
        if (this.contains(this.categoryHeader))
            this.remove_child(this.categoryHeader);

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
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

    _onSearchEntryChanged(searchEntry, searchString) {
        super._onSearchEntryChanged(searchEntry, searchString);
        if (!searchEntry.isEmpty()) {
            this.clearActiveItem();
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
        }
    }

    _onDestroy() {
        for (const obj of this._destroyableObjects)
            obj.destroy();


        for (const item of this.applicationShortcuts)
            item.destroy();


        super._onDestroy();
    }
}

class PlasmaMenuItem extends MW.BaseMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout, title, iconPath) {
        super(menuLayout);
        this.iconPath = iconPath;

        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
        this.set({
            ...getOrientationProp(true),
        });

        this.add_style_class_name('arcmenu-plasma-button');

        this._iconBin = new St.Bin({
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _(title),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.label.get_clutter_text().set_line_wrap(true);
        this.add_child(this.label);
    }

    createIcon() {
        return new St.Icon({
            gicon: Gio.icon_new_for_string(this.iconPath),
            icon_size: Constants.MEDIUM_ICON_SIZE,
        });
    }

    _onHover() {
        if (this.hover) {
            const description = null;
            this._menuButton.tooltip.showTooltip(this, this.tooltipLocation, this.label,
                description, Constants.DisplayType.LIST);
        } else {
            this._menuButton.tooltip.hide();
        }
        const shouldHover = ArcMenuManager.settings.get_boolean('plasma-enable-hover');
        if (shouldHover && this.hover && !this.isActive)
            this.activate(Clutter.get_current_event());
    }

    set active(active) {
        const activeChanged = active !== this.active;
        if (activeChanged) {
            this._active = active;
            if (active) {
                this._setSelectedStyle();
                this._menuLayout.activeMenuItem = this;
                if (this.can_focus)
                    this.grab_key_focus();
            } else if (!this._activeCategory) {
                this._removeSelectedStyle();
            }
            this.notify('active');
        }
    }

    setActive(active) {
        if (active) {
            this._activeCategory = true;
            this.add_style_pseudo_class('active');
        } else {
            this._activeCategory = false;
            this.remove_style_pseudo_class('active');
            this._removeSelectedStyle();
        }
    }

    _setSelectedStyle() {
        if (ShellVersion >= 47)
            this.add_style_pseudo_class('selected');
        else
            this.add_style_class_name('selected');
    }

    _removeSelectedStyle() {
        if (ShellVersion >= 47)
            this.remove_style_pseudo_class('selected');
        else
            this.remove_style_class_name('selected');
    }

    activate(event) {
        this._menuLayout.searchEntry.clearWithoutSearchChangeEvent();
        this._menuLayout.clearActiveItem();
        this.setActive(true);
        super.activate(event);
    }
}

class PlasmaCategoryHeader extends St.BoxLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super({
            style_class: 'popup-menu-item',
            style: 'padding: 0px;',
            reactive: true,
            track_hover: false,
            can_focus: false,
            accessible_role: Atk.Role.MENU_ITEM,
        });
        this._menuLayout = menuLayout;

        this.backButton = new MW.BaseMenuItem(this._menuLayout);
        this.backButton.set({
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this.label = new St.Label({
            text: _('Apps'),
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold',
        });

        this.backButton.add_child(this.label);

        this.add_child(this.backButton);
        this.backButton.connect('activate', () => this._menuLayout.displayCategories());

        this.categoryLabel = new St.Label({
            text: '',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this.categoryLabel);
        this.connect('destroy', () => {
            this._menuLayout = null;
        });
    }

    setActiveCategory(categoryText) {
        if (categoryText) {
            this.categoryLabel.text = _(categoryText);
            this.categoryLabel.show();
        } else {
            this.categoryLabel.hide();
        }
    }
}
