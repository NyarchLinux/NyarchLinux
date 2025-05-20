import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
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
            ...getOrientationProp(true),
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.applicationsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            style: 'padding: 8px 0px;',
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            x_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this.add_child(this.applicationsScrollBox);

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.add_style_class_name('arcmenu-search-top');
            this.insert_child_at_index(this.searchEntry, 0);
        } else if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.add_style_class_name('arcmenu-search-bottom');
            this.add_child(this.searchEntry);
        }

        this.updateWidth();
        this.loadCategories();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.displayAllApps();
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        super.loadCategories();
    }
}
