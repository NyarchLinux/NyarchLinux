import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import * as PlaceDisplay from '../placeDisplay.js';
import {getScrollViewAdjustments, getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            search_display_type: Constants.DisplayType.LIST,
            display_type: Constants.DisplayType.LIST,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 315,
            icon_grid_size: Constants.GridIconSize.SMALL,
            ...getOrientationProp(false),
            category_icon_size: Constants.LARGE_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.LARGE_ICON_SIZE,
        });

        this._pinnedAppsGrid.layout_manager.set({
            column_spacing: 10,
            row_spacing: 10,
            halign: Clutter.ActorAlign.CENTER,
        });

        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'spacing: 6px;',
        });
        this.add_child(this.actionsBox);

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);
        this.add_child(verticalSeparator);

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'spacing: 6px;',
        });
        this.add_child(this.subMainBox);

        this.pinnedAppsScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this.pinnedAppsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        this._addChildToParent(this.pinnedAppsScrollBox, this.pinnedAppsBox);

        this.pinnedAppsVerticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.applicationsScrollBox = this._createScrollView({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        this.subMainBox.add_child(this.searchEntry);

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

        ArcMenuManager.settings.connectObject('changed::windows-layout-extra-shortcuts', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this._createExtrasMenu();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        this.extrasButton = new ExtrasButton(this);
        this.extrasButton.set({
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this.actionsBox.add_child(this.extrasButton);

        const isContainedInCategory = false;

        const extraButtons = ArcMenuManager.settings.get_value('windows-layout-extra-shortcuts').deep_unpack();
        for (let i = 0; i < extraButtons.length; i++) {
            const {id} = extraButtons[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.HORIZONTAL);
                this.actionsBox.add_child(separator);
            } else {
                const button = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON,
                    isContainedInCategory);
                if (button.shouldShow)
                    this.actionsBox.add_child(button);
                else
                    button.destroy();
            }
        }

        let leaveButton;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            leaveButton = new MW.PowerOptionsBox(this, true);
        else
            leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(leaveButton);
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidth = ArcMenuManager.settings.get_int('left-panel-width');
        this.applicationsScrollBox.style = `width: ${leftPanelWidth}px;`;

        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.pinnedAppsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    loadPinnedApps() {
        this.display_type = Constants.DisplayType.GRID;
        super.loadPinnedApps();
        this.display_type = Constants.DisplayType.LIST;
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

    _loadPlaces(directoryShortcutsList) {
        this.directoryShortcuts = [];
        for (let i = 0; i < directoryShortcutsList.length; i++) {
            const directoryData = directoryShortcutsList[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directoryData, Constants.DisplayType.LIST, isContainedInCategory);
            this.directoryShortcuts.push(placeMenuItem);
        }
    }

    _createExtrasMenu() {
        this._dummyCursor = new St.Widget({width: 0, height: 0, opacity: 0});
        Main.layoutManager.uiGroup.add_child(this._dummyCursor);

        this.extrasMenu = new PopupMenu.PopupMenu(this._dummyCursor, 0, St.Side.TOP);
        this.extrasMenu.actor.add_style_class_name('popup-menu arcmenu-menu');

        const section = new PopupMenu.PopupMenuSection();
        this.extrasMenu.addMenuItem(section);

        const extrasMenuPopupBox = new St.BoxLayout({...getOrientationProp(true)});
        extrasMenuPopupBox._delegate = extrasMenuPopupBox;
        section.actor.add_child(extrasMenuPopupBox);

        const headerBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(true),
        });
        extrasMenuPopupBox.add_child(headerBox);

        this.backButton = new MW.BackButton(this);
        this.backButton.connect('activate', () => this.toggleExtrasMenu());
        headerBox.add_child(this.backButton);

        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        headerBox.add_child(separator);

        this.computerScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });

        extrasMenuPopupBox.add_child(this.computerScrollBox);

        const computerBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.computerScrollBox, computerBox);

        computerBox.add_child(this.createLabelRow(_('Application Shortcuts')));
        for (let i = 0; i < this.applicationShortcuts.length; i++)
            computerBox.add_child(this.applicationShortcuts[i]);

        computerBox.add_child(this.createLabelRow(_('Places')));
        for (let i = 0; i < this.directoryShortcuts.length; i++)
            computerBox.add_child(this.directoryShortcuts[i]);

        computerBox.add_child(this.externalDevicesBox);

        this.subMenuManager.addMenu(this.extrasMenu);
        this.extrasMenu.actor.hide();
        Main.uiGroup.add_child(this.extrasMenu.actor);
        this.extrasMenu.connect('open-state-changed', (menu, open) => {
            if (!open) {
                this.extrasButton.active = false;
                this.extrasButton.sync_hover();
                this.extrasButton.hovered = this.extrasButton.hover;
            }
        });
    }

    toggleExtrasMenu() {
        const {vadjustment} = getScrollViewAdjustments(this.computerScrollBox);
        vadjustment.set_value(0);

        const themeNode = this.arcMenu.actor.get_theme_node();

        let [x, y] = this.arcMenu.actor.get_transformed_position();
        const rise = themeNode.get_length('-arrow-rise');

        if (this.arcMenu._arrowSide !== St.Side.TOP)
            y -= rise;
        if (this.arcMenu._arrowSide === St.Side.LEFT)
            x += rise;

        this._dummyCursor.set_position(Math.round(x), Math.round(y));

        const height = ArcMenuManager.settings.get_int('menu-height');
        this.extrasMenu.box.style = `height: ${height}px;`;

        this.extrasMenu.toggle();
        if (this.extrasMenu.isOpen) {
            this.activeMenuItem = this.backButton;
            this.backButton.grab_key_focus();
        }
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        this.displayAllApps();
        if (!ArcMenuManager.settings.get_boolean('windows-disable-pinned-apps'))
            this.displayPinnedApps();

        const {vadjustment} = getScrollViewAdjustments(this.pinnedAppsScrollBox);
        vadjustment.set_value(0);
    }

    displayFrequentApps() {
        this._firstFrequentApp = null;
        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        if (mostUsed.length < 1)
            return;

        const labelRow = this._createLabelWithSeparator(_('Frequent Apps'));
        this.applicationsBox.add_child(labelRow);

        const frequentAppsList = [];
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()) {
                const item = new MW.ApplicationMenuItem(this, mostUsed[i], Constants.DisplayType.LIST);
                frequentAppsList.push(item);
            }
        }
        let activeMenuItemSet = false;
        const maxApps = Math.min(8, frequentAppsList.length);
        for (let i = 0; i < maxApps; i++) {
            const item = frequentAppsList[i];
            if (item.get_parent())
                item.get_parent().remove_child(item);
            this.applicationsBox.add_child(item);
            if (!activeMenuItemSet) {
                activeMenuItemSet = true;
                this.activeMenuItem = item;
                this._firstFrequentApp = item;
            }
        }
    }

    displayAllApps() {
        this._clearActorsFromBox();

        if (!ArcMenuManager.settings.get_boolean('windows-disable-frequent-apps'))
            this.displayFrequentApps();

        const appList = [];
        this.applicationsMap.forEach((value, key) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            const nameA = a.get_name();
            const nameB = b.get_name();
            return nameA.localeCompare(nameB);
        });
        this.display_type = Constants.DisplayType.LIST;
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);

        if (this._firstFrequentApp)
            this.activeMenuItem = this._firstFrequentApp;
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    _clearActorsFromBox(box) {
        super._clearActorsFromBox(box);
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayPinnedApps() {
        super._clearActorsFromBox(this.pinnedAppsBox);

        const pinnedApps = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();

        if (pinnedApps.length < 1) {
            if (this.contains(this.pinnedAppsScrollBox)) {
                this.remove_child(this.pinnedAppsVerticalSeparator);
                this.remove_child(this.pinnedAppsScrollBox);
            }

            return;
        }

        if (!this.contains(this.pinnedAppsScrollBox)) {
            this.add_child(this.pinnedAppsVerticalSeparator);
            this.add_child(this.pinnedAppsScrollBox);
        }

        const label = this.createLabelRow(_('Pinned'));
        this.pinnedAppsBox.add_child(label);

        const iconWidth = this.getIconWidthFromSetting();
        const columns = this.getBestFitColumnsForGrid(iconWidth, this._pinnedAppsGrid);

        this._pinnedAppsGrid.setColumns(columns);

        if (!this.pinnedAppsBox.contains(this._pinnedAppsGrid))
            this.pinnedAppsBox.add_child(this._pinnedAppsGrid);
    }

    _onDestroy() {
        super._onDestroy();
        this._dummyCursor.destroy();
        this._dummyCursor = null;
    }
}

export class ExtrasButton extends MW.ArcMenuButtonItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super(menuLayout, _('Extras'), 'open-menu-symbolic');
        this._closeMenuOnActivate = false;
    }

    activate(event) {
        super.activate(event);
        this._menuLayout.toggleExtrasMenu();
    }
}
