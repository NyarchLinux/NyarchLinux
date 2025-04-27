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
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.LIST,
            search_results_spacing: 8,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 375,
            icon_grid_size: Constants.GridIconSize.LARGE_RECT,
            ...getOrientationProp(false),
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.MEDIUM_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.connect('button-press-event', (actor, event) => {
            if (this.backButton.visible && event.get_button() === 8)
                this.backButton.activate(event);
        });

        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';

        const mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'padding: 6px;',
        });

        this.rightBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            ...getOrientationProp(true),
            clip_to_allocation: true,
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        this.add_child(horizontalFlip ? this.rightBox : mainBox);
        this.add_child(verticalSeparator);
        this.add_child(horizontalFlip ? mainBox : this.rightBox);

        this.navBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
            style: 'padding: 8px 0px;',
        });
        mainBox.add_child(this.navBox);

        this.backButton = this._createNavigationRow(_('All Apps'), Constants.Direction.GO_PREVIOUS,
            _('Back'), () => this.setDefaultMenuView());
        this._viewAllAppsButton = this._createNavigationRow(_('Pinned'), Constants.Direction.GO_NEXT,
            _('All Apps'), () => this.displayAllApps());

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

        const userMenuBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(true),
            style: 'padding-bottom: 16px; spacing: 4px;',
        });
        const avatarMenuIcon = new MW.AvatarMenuIcon(this, 75, true);
        avatarMenuIcon.label.set({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: large;',
        });
        userMenuBox.add_child(avatarMenuIcon);
        userMenuBox.add_child(avatarMenuIcon.label);
        this.rightBox.add_child(userMenuBox);

        this.shortcutsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            style: 'spacing: 8px;',
        });
        this.shortcutsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this._addChildToParent(this.shortcutsScrollBox, this.shortcutsBox);
        this.rightBox.add_child(this.shortcutsScrollBox);

        ArcMenuManager.settings.connectObject('changed::sleek-layout-extra-shortcuts', () => this._createExtraShortcuts(), this);
        this._createExtraShortcuts();

        let powerOptionsDisplay;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE) {
            powerOptionsDisplay = new MW.PowerOptionsBox(this);
            powerOptionsDisplay.set({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
        } else {
            powerOptionsDisplay = new MW.LeaveButton(this);
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

    loadCategories() {
        this.setGridLayout(Constants.DisplayType.LIST, 8);
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    loadPinnedApps() {
        this.setGridLayout(Constants.DisplayType.GRID, 10, false);
        super.loadPinnedApps();
    }

    _createExtraShortcuts() {
        this.shortcutsBox.destroy_all_children();
        const extraShortcuts = ArcMenuManager.settings.get_value('sleek-layout-extra-shortcuts').deep_unpack();

        if (extraShortcuts.length === 0)
            return;

        const isContainedInCategory = false;

        for (let i = 0; i < extraShortcuts.length; i++) {
            const {id} = extraShortcuts[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.SHORT,
                    Constants.SeparatorAlignment.HORIZONTAL);
                this.shortcutsBox.add_child(separator);
            } else {
                const item = this.createMenuItem(extraShortcuts[i], Constants.DisplayType.LIST, isContainedInCategory);
                if (item.shouldShow)
                    this.shortcutsBox.add_child(item);
                else
                    item.destroy();
            }
        }
    }

    updateWidth(setDefaultMenuView) {
        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        borderRadius /= scaleFactor;

        const panelWidth = ArcMenuManager.settings.get_int('sleek-layout-panel-width');
        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        const rightRoundedCorners = `border-radius: 0px ${borderRadius}px ${borderRadius}px 0px;`;
        const leftRoundedCorners = `border-radius: ${borderRadius}px 0px 0px ${borderRadius}px;`;
        const roundedCorners = horizontalFlip ? leftRoundedCorners : rightRoundedCorners;

        this.rightBox.style = `${roundedCorners} padding: 6px;
                                background-color: rgba(10, 10, 15, 0.2); width: ${panelWidth}px;`;
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';
    }

    setDefaultMenuView() {
        this.setGridLayout(Constants.DisplayType.GRID, 10);
        super.setDefaultMenuView();

        this.navBox.show();
        this._viewAllAppsButton.show();
        this.backButton.hide();

        this.displayPinnedApps();
    }

    displayPinnedApps() {
        this._viewAllAppsButton.show();
        this.backButton.hide();

        super.displayPinnedApps();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayAllApps() {
        this.setGridLayout(Constants.DisplayType.LIST, 8);
        super.displayAllApps();

        this._viewAllAppsButton.hide();
        this.backButton.show();
    }

    setGridLayout(displayType, spacing, setStyle = true) {
        if (setStyle) {
            if (displayType === Constants.DisplayType.LIST)
                this.applicationsScrollBox.style_class = this._disableFadeEffect ? '' : 'small-vfade';
            else
                this.applicationsScrollBox.style_class = this._disableFadeEffect ? '' : 'vfade';
            this.applicationsGrid.halign = displayType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER;
        }

        this.applicationsGrid.column_spacing = spacing;
        this.applicationsGrid.row_spacing = spacing;
        this.display_type = displayType;
    }

    _onSearchEntryChanged(searchEntry, searchString) {
        if (!searchEntry.isEmpty())
            this.navBox.hide();
        super._onSearchEntryChanged(searchEntry, searchString);
    }

    _onDestroy() {
        if (this.arcMenu)
            this.arcMenu.box.style = null;
        super._onDestroy();
    }
}
