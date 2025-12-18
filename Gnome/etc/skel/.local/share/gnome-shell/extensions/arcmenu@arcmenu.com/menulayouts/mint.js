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
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            supports_category_hover_activation: true,
            ...getOrientationProp(false),
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.MEDIUM_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        // Stores the Pinned Icons on the left side
        this.actionsScrollBox = this._createScrollView({
            x_expand: false,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'small-vfade',
            style: `padding: 10px 0px; width: 62px; margin: 0px 8px 0px 0px; 
                    background-color:rgba(10, 10, 15, 0.1); border-color:rgba(186, 196,201, 0.2); 
                    border-width: 1px; border-radius: 8px;`,
        });
        this.actionsScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
        this.actionsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            style: 'spacing: 10px;',
        });
        this._addChildToParent(this.actionsScrollBox, this.actionsBox);
        this.add_child(this.actionsScrollBox);

        // contains searchbar, rightBox, leftBox
        this._parentBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });
        this.add_child(this._parentBox);

        this._mainBox = new St.BoxLayout({
            ...getOrientationProp(false),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this._parentBox.add_child(this._mainBox);

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });

        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.applicationsScrollBox = this._createScrollView({
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

        this.categoriesScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.categoriesScrollBox);
        this.categoriesBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

        this.searchEntry.style = 'margin: 0px;';
        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
            Constants.SeparatorAlignment.HORIZONTAL);
        this.searchEntry.bind_property('visible', separator, 'visible', GObject.BindingFlags.SYNC_CREATE);

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.add_style_class_name('arcmenu-search-top');

            this._parentBox.insert_child_at_index(this.searchEntry, 0);
            this._parentBox.insert_child_at_index(separator, 1);
        } else if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.add_style_class_name('arcmenu-search-bottom');

            this._parentBox.add_child(separator);
            this._parentBox.add_child(this.searchEntry);
        }

        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
        ArcMenuManager.settings.connectObject('changed::mint-layout-extra-shortcuts', () => this._createExtraButtons(), this);
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();
        const extraButtons = ArcMenuManager.settings.get_value('mint-layout-extra-shortcuts').deep_unpack();

        if (extraButtons.length === 0)
            return;

        const isContainedInCategory = false;

        for (let i = 0; i < extraButtons.length; i++) {
            const {id} = extraButtons[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL);
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
        const leftPanelWidthOffset = 0;
        const rightPanelWidthOffset = 45;
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
