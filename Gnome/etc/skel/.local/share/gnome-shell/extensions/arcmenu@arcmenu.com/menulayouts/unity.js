import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import {IconGrid} from '../iconGrid.js';
import * as MW from '../menuWidgets.js';
import {getScrollViewAdjustments, getOrientationProp} from '../utils.js';

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
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 15,
            row_spacing: 15,
            ...getOrientationProp(true),
            default_menu_width: 750,
            icon_grid_size: Constants.GridIconSize.LARGE,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        const homeScreen = ArcMenuManager.settings.get_boolean('enable-unity-homescreen');
        this.activeCategoryName = homeScreen ? _('Pinned') : _('All Programs');

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(false),
            style: 'padding-bottom: 10px; padding-right: 15px;',
        });
        this.add_child(this.topBox);

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });
        this.add_child(this._mainBox);

        this.searchEntry.set({
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            style: 'margin: 0px 15px 0px 15px;',
        });
        this.topBox.add_child(this.searchEntry);

        this.categoriesButton = new CategoriesButton(this);
        this.topBox.add_child(this.categoriesButton);

        this.applicationsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            style_class: 'arcmenu-margin-box',
            y_align: Clutter.ActorAlign.START,
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this._widgetBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            ...getOrientationProp(false),
            style_class: 'datemenu-displays-box',
            style: 'margin: 0px; spacing: 10px; padding-bottom: 6px;',
        });
        this._mainBox.add_child(this._widgetBox);
        this._widgetBox.hide();

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

        this.actionsContainerBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            ...getOrientationProp(false),
        });
        this._mainBox.add_child(this.actionsContainerBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(false),
            style: 'spacing: 10px;',
        });
        this.actionsContainerBox.add_child(this.actionsBox);

        const applicationShortcuts = ArcMenuManager.settings.get_value('application-shortcuts').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.GRID, false);
            if (shortcutMenuItem.shouldShow)
                this.appShortcuts.push(shortcutMenuItem);
            else
                shortcutMenuItem.destroy();
        }

        ArcMenuManager.settings.connectObject('changed::unity-layout-extra-shortcuts', () => this._createExtraButtons(), this);
        ArcMenuManager.settings.connectObject('changed::enable-clock-widget-unity', () => this._updateWidgets(), this);
        ArcMenuManager.settings.connectObject('changed::enable-weather-widget-unity', () => this._updateWidgets(), this);

        this._createExtraButtons();
        this._updateWidgets();

        this.updateStyle();
        this.updateWidth();
        this._createCategoriesMenu();
        this.loadCategories();
        this.loadPinnedApps();

        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    _updateWidgets() {
        const clockWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-clock-widget-unity');
        const weatherWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-weather-widget-unity');

        if (clockWidgetEnabled && !this._clocksItem) {
            this._clocksItem = new MW.WorldClocksWidget(this);
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

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();
        const extraButtons = ArcMenuManager.settings.get_value('unity-layout-extra-shortcuts').deep_unpack();

        if (extraButtons.length === 0)
            return;

        const isContainedInCategory = false;
        for (let i = 0; i < extraButtons.length; i++) {
            const {id} = extraButtons[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.VERTICAL);
                this.actionsBox.add_child(separator);
            } else {
                const item = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON, isContainedInCategory);
                if (item.shouldShow)
                    this.actionsBox.add_child(item);
                else
                    item.destroy();
            }
        }
    }

    updateWidth(setDefaultMenuView) {
        super.updateWidth(setDefaultMenuView);

        if (!this.applicationsBox.get_stage())
            return;

        const width = this.menu_width - 80;
        this._weatherItem.style = `width: ${Math.round(5 * width / 8)}px;`;
        this._clocksItem.style = `width: ${Math.round(3 * width / 8)}px;`;
    }

    _createCategoriesMenu() {
        this.categoriesMenu = new PopupMenu.PopupMenu(this.categoriesButton, 0.5, St.Side.TOP);
        this.categoriesMenu.actor.add_style_class_name('popup-menu arcmenu-menu');
        this.categoriesMenu.blockSourceEvents = true;
        this.categoriesMenu.connect('open-state-changed', (menu, open) => {
            if (open) {
                this.categoriesButton.add_style_pseudo_class('active');
                if (this.menuButton.tooltipShowingID) {
                    GLib.source_remove(this.menuButton.tooltipShowingID);
                    this.menuButton.tooltipShowingID = null;
                    this.menuButton.tooltipShowing = false;
                }
                if (this.categoriesButton.tooltip) {
                    this.categoriesButton.tooltip.hide();
                    this.menuButton.tooltipShowing = false;
                }
            } else {
                this.categoriesButton.remove_style_pseudo_class('active');
                this.categoriesButton.active = false;
                this.categoriesButton.sync_hover();
                this.categoriesButton.hovered = this.categoriesButton.hover;
            }
        });
        const section = new PopupMenu.PopupMenuSection();
        this.categoriesMenu.addMenuItem(section);

        const categoriesPopupBox = new St.BoxLayout({...getOrientationProp(true)});
        section.actor.add_child(categoriesPopupBox);
        categoriesPopupBox._delegate = categoriesPopupBox;

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        categoriesPopupBox.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const height =  Math.round(350 / scaleFactor);

        categoriesPopupBox.style = `max-height: ${height}px`;

        this.subMenuManager.addMenu(this.categoriesMenu);
        this.categoriesMenu.actor.hide();
        Main.uiGroup.add_child(this.categoriesMenu.actor);
    }

    toggleCategoriesMenu() {
        const {vadjustment} = getScrollViewAdjustments(this.categoriesScrollBox);
        vadjustment.set_value(0);

        this.categoriesMenu.toggle();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        const homeScreen = ArcMenuManager.settings.get_boolean('enable-unity-homescreen');
        if (homeScreen) {
            this.activeCategoryName = _('Pinned');
            this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
            this.displayPinnedApps();
        } else {
            this.activeCategoryName = _('All Programs');
            const isGridLayout = true;
            this.displayAllApps(isGridLayout);
            this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;
        }
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');

        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        borderRadius /= scaleFactor;

        const borderRadiusStyle = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const style = `margin: 6px 0px 0px 0px; spacing: 0px; background-color: rgba(10, 10, 15, 0.1); padding: 5px 5px;
                       border-color: rgba(186, 196,201, 0.2); border-top-width: 1px;`;

        this.actionsContainerBox.style = style + borderRadiusStyle;
        this.arcMenu.box.style = 'padding-bottom: 0px; padding-left: 0px; padding-right: 0px;';
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        const categoryMenuItem = new MW.CategoryMenuItem(this, Constants.CategoryType.HOME_SCREEN,
            Constants.DisplayType.LIST);
        this.categoryDirectories.set(Constants.CategoryType.HOME_SCREEN, categoryMenuItem);
        this.hasPinnedApps = true;

        const extraCategories = ArcMenuManager.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const [categoryEnum, shouldShow] = extraCategories[i];
            if (categoryEnum === Constants.CategoryType.PINNED_APPS || !shouldShow)
                continue;

            const extraCategoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum,
                Constants.DisplayType.LIST);
            this.categoryDirectories.set(categoryEnum, extraCategoryMenuItem);
        }

        super.loadCategories();
        this._displayCategories();
    }

    _displayCategories() {
        this.categoriesBox.destroy_all_children();
        let hasExtraCategory = false;
        let separatorAdded = false;

        for (const categoryMenuItem of this.categoryDirectories.values()) {
            const isExtraCategory = categoryMenuItem.isExtraCategory();

            if (!hasExtraCategory) {
                hasExtraCategory = isExtraCategory;
            } else if (!isExtraCategory && !separatorAdded) {
                this.categoriesBox.add_child(new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL));
                separatorAdded = true;
            }

            this.categoriesBox.add_child(categoryMenuItem);
        }
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

        const clockWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-clock-widget-unity');
        const weatherWidgetEnabled = ArcMenuManager.settings.get_boolean('enable-weather-widget-unity');

        if (clockWidgetEnabled || weatherWidgetEnabled)
            this._widgetBox.show();
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        const label = this._createLabelWithSeparator(_('Recent Files'));
        this.applicationsBox.insert_child_at_index(label, 0);
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _clearActorsFromBox(box) {
        if (this.categoriesMenu.isOpen)
            this.categoriesMenu.toggle();

        this._widgetBox.hide();

        super._clearActorsFromBox(box);
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);

        const label = this._createLabelWithSeparator(this.activeCategoryName);
        if (grid === this.applicationsGrid)
            this.applicationsBox.insert_child_at_index(label, 0);
        else if (grid === this.shortcutsGrid)
            this.applicationsBox.insert_child_at_index(label, 2);
    }

    _onDestroy() {
        if (this._clocksItem)
            this._clocksItem.destroy();
        if (this._weatherItem)
            this._weatherItem.destroy();

        if (this.arcMenu)
            this.arcMenu.box.style = null;

        super._onDestroy();
    }
}

export class CategoriesButton extends MW.ArcMenuButtonItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super(menuLayout, _('Categories'), 'open-menu-symbolic');
        this._closeMenuOnActivate = false;
    }

    activate(event) {
        super.activate(event);
        this._menuLayout.toggleCategoriesMenu();
    }
}
