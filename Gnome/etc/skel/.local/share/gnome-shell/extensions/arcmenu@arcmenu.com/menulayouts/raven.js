import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import {IconGrid} from '../iconGrid.js';
import * as MW from '../menuWidgets.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.GRID,
            search_display_type: ArcMenuManager.settings.get_enum('raven-search-display-style'),
            search_results_spacing: 4,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 415,
            icon_grid_size: Constants.GridIconSize.SMALL,
            ...getOrientationProp(false),
            supports_category_hover_activation: true,
            category_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.arcMenu.box.style = 'padding: 0px; margin: 0px; border-radius: 0px;';
        this.searchEntry.style = 'margin: 10px 10px 10px 10px;';

        ArcMenuManager.settings.connectObject('changed::raven-position', () => this._updatePosition(), this);

        ArcMenuManager.settings.connectObject('changed::enable-clock-widget-raven', () => this._updateWidgets(), this);
        ArcMenuManager.settings.connectObject('changed::enable-weather-widget-raven', () => this._updateWidgets(), this);

        this.updateLocation();

        // store old ArcMenu variables
        this.oldSourceActor = this.arcMenu.sourceActor;
        this.oldFocusActor = this.arcMenu.focusActor;
        this.oldArrowAlignment = this.arcMenu.actor._arrowAlignment;

        this.arcMenu.sourceActor = Main.layoutManager.dummyCursor;
        this.arcMenu.focusActor = Main.layoutManager.dummyCursor;
        this.arcMenu._boxPointer.setPosition(Main.layoutManager.dummyCursor, 0);
        this.arcMenu.close();
        this.arcMenu._boxPointer.hide();

        const homeScreen = ArcMenuManager.settings.get_boolean('enable-unity-homescreen');
        this.activeCategoryName = homeScreen ? _('Pinned') : _('All Programs');

        this.categoriesBoxContainer = new St.BoxLayout({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });

        this.categoriesBox = new St.BoxLayout({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(true),
            style: 'spacing: 5px;',
        });
        this.categoriesBoxContainer.add_child(this.categoriesBox);

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(false),
        });
        this.topBox.add_child(this.searchEntry);

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });
        this._mainBox.add_child(this.topBox);
        this.add_child(this._mainBox);

        this.applicationsBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'padding-bottom: 10px;',
            style_class: 'arcmenu-margin-box',
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this._widgetBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            ...getOrientationProp(true),
            style: 'margin: 0px 10px 10px 10px; spacing: 10px;',
        });
        this._mainBox.add_child(this._widgetBox);

        this.appShortcuts = [];
        this.shortcutsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(true),
        });

        this.shortcutsGrid = new IconGrid({
            halign: Clutter.ActorAlign.CENTER,
            column_spacing: this.column_spacing,
            row_spacing: this.row_spacing,
        });
        this.shortcutsBox.add_child(this.shortcutsGrid);

        const applicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.GRID, false);
            if (shortcutMenuItem.shouldShow)
                this.appShortcuts.push(shortcutMenuItem);
            else
                shortcutMenuItem.destroy();
        }

        this._updateWidgets();
        this.updateLocation();
        this.updateWidth();
        this._updatePosition();
        this.loadCategories();
        this.loadPinnedApps();

        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    _updateWidgets() {
        const clockWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-clock-widget-raven');
        const weatherWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-weather-widget-raven');

        if (clockWidgetEnabled && !this._clocksItem) {
            this._clocksItem = new MW.WorldClocksWidget(this);
            this._clocksItem.set({
                x_expand: true,
                x_align: Clutter.ActorAlign.FILL,
            });
            this._widgetBox.add_child(this._clocksItem);
        } else if (!clockWidgetEnabled && this._clocksItem) {
            this._clocksItem.destroy();
            this._clocksItem = null;
        }

        if (weatherWidgetEnabled && !this._weatherItem) {
            this._weatherItem = new MW.WeatherWidget(this);
            this._widgetBox.add_child(this._weatherItem);
        } else if (!weatherWidgetEnabled && this._weatherItem) {
            this._weatherItem.destroy();
            this._weatherItem = null;
        }
    }

    _updatePosition() {
        const style = `margin: 0px 0px 0px 0px; spacing: 10px; background-color: rgba(10, 10, 15, 0.1);
                       padding: 5px 5px; border-color: rgba(186, 196,201, 0.2);`;

        if (this.contains(this.categoriesBoxContainer))
            this.remove_child(this.categoriesBoxContainer);

        const ravenPosition = ArcMenuManager.settings.get_enum('raven-position');
        if (ravenPosition === Constants.RavenPosition.LEFT) {
            this.insert_child_at_index(this.categoriesBoxContainer, 0);
            this.categoriesBoxContainer.style = `border-right-width: 1px;${style}`;
        } else if (ravenPosition === Constants.RavenPosition.RIGHT) {
            this.insert_child_at_index(this.categoriesBoxContainer, 1);
            this.categoriesBoxContainer.style = `border-left-width: 1px;${style}`;
        }
    }

    updateLocation() {
        const ravenPosition = ArcMenuManager.settings.get_enum('raven-position');

        const alignment = ravenPosition === Constants.RavenPosition.LEFT ? 0 : 1;
        this.arcMenu._boxPointer.setSourceAlignment(alignment);
        this.arcMenu._arrowAlignment = alignment;

        const monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        const monitorWorkArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

        const positionX = ravenPosition === Constants.RavenPosition.LEFT ? monitorWorkArea.x
            : monitorWorkArea.x + monitorWorkArea.width - 1;
        const positionY = this.arcMenu._arrowSide === St.Side.BOTTOM ? monitorWorkArea.y + monitorWorkArea.height
            : monitorWorkArea.y;

        Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const screenHeight = monitorWorkArea.height;

        const height = Math.round(screenHeight / scaleFactor);
        const style = '-arrow-base: 0px; -arrow-rise: 0px; -boxpointer-gap: 0px;' +
            '-arrow-border-radius: 0px; margin: 0px;';
        this.arcMenu.actor.style = `height: ${height}px;${style}`;
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        const homeScreen = ArcMenuManager.settings.get_boolean('enable-unity-homescreen');
        if (homeScreen) {
            this.activeCategoryName = _('Pinned');
            this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
            this.displayPinnedApps();
            const topCategory = this.categoryDirectories.values().next().value;
            this.setActiveCategory(topCategory);
        } else {
            this.activeCategoryName = _('All Programs');
            const isGridLayout = true;
            this.displayAllApps(isGridLayout);
            this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        const categoryMenuItem = new MW.CategoryMenuItem(this, Constants.CategoryType.HOME_SCREEN,
            Constants.DisplayType.BUTTON);
        this.categoryDirectories.set(Constants.CategoryType.HOME_SCREEN, categoryMenuItem);
        this.hasPinnedApps = true;

        const extraCategories = ArcMenuManager.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const [categoryEnum, shouldShow] = extraCategories[i];
            if (categoryEnum === Constants.CategoryType.PINNED_APPS || !shouldShow)
                continue;

            const extraCategoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.BUTTON);
            this.categoryDirectories.set(categoryEnum, extraCategoryMenuItem);
        }

        super.loadCategories(Constants.DisplayType.BUTTON);
        this.displayCategories();
    }

    displayCategories() {
        for (const categoryMenuItem of this.categoryDirectories.values())
            this.categoriesBox.add_child(categoryMenuItem);
    }

    displayPinnedApps() {
        this.activeCategoryName = _('Pinned');

        super.displayPinnedApps();
        const label = this._createLabelWithSeparator(this.activeCategoryName);
        this.applicationsBox.insert_child_at_index(label, 0);

        this.activeCategoryName = _('Shortcuts');
        this._displayAppList(this.appShortcuts, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);

        if (!this.applicationsBox.contains(this.shortcutsBox))
            this.applicationsBox.add_child(this.shortcutsBox);

        this._widgetBox.hide();
        const clockWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-clock-widget-raven');
        const weatherWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-weather-widget-raven');

        if (clockWidgetEnabled || weatherWidgetEnabled)
            this._widgetBox.show();
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        const label = this._createLabelWithSeparator(_('Recent Files'));
        label.style += 'padding-left: 10px;';
        this.applicationsBox.insert_child_at_index(label, 0);
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _clearActorsFromBox(box) {
        this._widgetBox.hide();

        super._clearActorsFromBox(box);
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);
        const label = this._createLabelWithSeparator(this.activeCategoryName);

        if (grid === this.applicationsGrid) {
            label.style += 'padding-left: 10px;';
            this.applicationsBox.insert_child_at_index(label, 0);
        } else {
            label.style += 'padding-left: 10px; padding-top: 20px;';
            this.applicationsBox.insert_child_at_index(label, 2);
        }
    }

    _onDestroy() {
        if (this._clocksItem)
            this._clocksItem.destroy();
        if (this._weatherItem)
            this._weatherItem.destroy();

        if (this.arcMenu) {
            this.arcMenu.actor.style = null;
            this.arcMenu.box.style = null;
            this.arcMenu.sourceActor = this.oldSourceActor;
            this.arcMenu.focusActor = this.oldFocusActor;
            this.arcMenu._boxPointer.setPosition(this.oldSourceActor, this.oldArrowAlignment);
            this.arcMenu.close();
            this.arcMenu._boxPointer.hide();
        }

        super._onDestroy();
    }
}
