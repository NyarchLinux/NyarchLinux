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
            is_dual_panel: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            search_results_spacing: 4,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            supports_category_hover_activation: true,
            column_spacing: 4,
            row_spacing: 4,
            ...getOrientationProp(true),
            default_menu_width: 450,
            icon_grid_size: Constants.GridIconSize.LARGE_RECT,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(false),
            style: 'spacing: 6px; margin: 0px 6px; padding: 3px 0px;',
        });

        this.userMenuBox = new St.BoxLayout({
            ...getOrientationProp(false),
            x_expand: true,
        });
        this.avatarMenuIcon = new MW.AvatarMenuIcon(this, 36, true);
        this.avatarMenuIcon.set({
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
        });
        this.avatarMenuIcon.label.set({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold;',
        });

        this.searchEntry.set({
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(false),
        });
        this.add_child(this._mainBox);

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });

        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.applicationsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this.rightBox.add_child(this.applicationsScrollBox);

        this.leftBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.rightBox : this.leftBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.leftBox : this.rightBox);
        this.topBox.add_child(horizontalFlip ? this.searchEntry : this.userMenuBox);
        this.topBox.add_child(horizontalFlip ? this.userMenuBox : this.searchEntry);
        this.userMenuBox.add_child(horizontalFlip ? this.avatarMenuIcon.label : this.avatarMenuIcon);
        this.userMenuBox.add_child(horizontalFlip ? this.avatarMenuIcon : this.avatarMenuIcon.label);
        this.avatarMenuIcon.label.style += horizontalFlip ? 'padding-right: 14px;' : 'padding-left: 14px;';
        this.userMenuBox.x_align = horizontalFlip ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });

        this.leftBox.add_child(this.categoriesScrollBox);
        this.categoriesBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

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
        this.leftBox.add_child(new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL));
        this.leftBox.add_child(powerOptionsDisplay);

        const searchbarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);

        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.insert_child_at_index(separator, 0);
            this.insert_child_at_index(this.topBox, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.add_child(separator);
            this.add_child(this.topBox);
        }

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidthOffset = 70;
        const leftPanelWidth = ArcMenuManager.settings.get_int('left-panel-width') - leftPanelWidthOffset;
        this.leftBox.style = `width: ${leftPanelWidth}px;`;

        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        this.searchEntry.style = `width: ${menuWidth - 26}px;`;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.displayCategories();

        const topCategory = this.categoryDirectories.values().next().value;
        topCategory.displayAppList();
        this.setActiveCategory(topCategory);
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

    displayCategories() {
        super.displayCategories(this.categoriesBox);
    }
}
