import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export const Layout = class BriskLayout extends BaseMenuLayout {
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
            supports_category_hover_activation: true,
            vertical: true,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this._mainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.add_child(this._mainBox);

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
        });

        this.applicationsBox = new St.BoxLayout({vertical: true});
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
            vertical: true,
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);
        const horizontalFlip = this._settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.rightBox : this.leftBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.leftBox : this.rightBox);

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({vertical: true});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

        this.actionsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.leftBox.add_child(this.actionsBox);

        let powerOptionsItem;
        const powerDisplayStyle = this._settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.MENU) {
            powerOptionsItem = new MW.LeaveButton(this, true);
        } else {
            powerOptionsItem = new MW.PowerOptionsBox(this);
            powerOptionsItem.x_align = Clutter.ActorAlign.CENTER;
        }

        powerOptionsItem.y_align = Clutter.ActorAlign.END;
        this.leftBox.add_child(powerOptionsItem);

        const searchBarLocation = this._settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.add_style_class_name('arcmenu-search-top');
            this.searchEntry.style = 'margin-bottom: 0px;';
            this.insert_child_at_index(this.searchEntry, 0);

            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.insert_child_at_index(separator, 1);
        } else if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.add_style_class_name('arcmenu-search-bottom');
            this.add_child(this.searchEntry);
        }

        this._settings.connectObject('changed::brisk-layout-extra-shortcuts', () => this._createExtraShortcuts(), this);
        this._createExtraShortcuts();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this.setDefaultMenuView();
    }

    _createExtraShortcuts() {
        this.actionsBox.destroy_all_children();
        const extraShortcuts = this._settings.get_value('brisk-layout-extra-shortcuts').deep_unpack();

        if (extraShortcuts.length === 0)
            return;

        const isContainedInCategory = false;

        for (let i = 0; i < extraShortcuts.length; i++) {
            const {id} = extraShortcuts[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL);
                this.actionsBox.add_child(separator);
            } else {
                const item = this.createMenuItem(extraShortcuts[i], Constants.DisplayType.LIST, isContainedInCategory);
                if (item.shouldShow)
                    this.actionsBox.add_child(item);
                else
                    item.destroy();
            }
        }

        let separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.actionsBox.insert_child_at_index(separator, 0);
        separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.actionsBox.add_child(separator);
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidthOffset = -70;
        const rightPanelWidthOffset = 70;
        super.updateWidth(setDefaultMenuView, leftPanelWidthOffset, rightPanelWidthOffset);
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

        const extraCategories = this._settings.get_value('extra-categories').deep_unpack();

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
};
