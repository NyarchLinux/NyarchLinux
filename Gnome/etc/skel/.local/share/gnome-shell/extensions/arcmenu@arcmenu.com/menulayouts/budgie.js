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
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            column_spacing: 0,
            row_spacing: 0,
            supports_category_hover_activation: true,
            ...getOrientationProp(true),
            category_icon_size: Constants.ICON_HIDDEN,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this._mainBox = new St.BoxLayout({
            ...getOrientationProp(false),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.add_child(this._mainBox);

        this.rightBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });

        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.applicationsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this.rightBox.add_child(this.applicationsScrollBox);

        this.leftBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);
        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.rightBox : this.leftBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.leftBox : this.rightBox);

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

        if (ArcMenuManager.settings.get_boolean('enable-activities-shortcut')) {
            this.activitiesBox = new St.BoxLayout({
                ...getOrientationProp(true),
                x_expand: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.END,
            });
            this.activities = new MW.ActivitiesMenuItem(this);
            this.activitiesBox.add_child(this.activities);
            this.leftBox.add_child(this.activitiesBox);
        }

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
                Constants.SeparatorAlignment.HORIZONTAL);
            separator.style += 'margin-bottom: 6px;';

            this.searchEntry.add_style_class_name('arcmenu-search-top');
            this.searchEntry.style = 'margin-bottom: 0px;';

            this.insert_child_at_index(this.searchEntry, 0);
            this.insert_child_at_index(separator, 1);
        } else if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
                Constants.SeparatorAlignment.HORIZONTAL);
            separator.style += 'margin-top: 6px;';

            this.searchEntry.add_style_class_name('arcmenu-search-bottom');
            this.searchEntry.style = 'margin-top: 0px;';

            this.add_child(separator);
            this.add_child(this.searchEntry);
        }

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
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
