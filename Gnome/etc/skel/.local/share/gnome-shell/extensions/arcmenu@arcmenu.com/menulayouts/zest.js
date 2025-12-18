import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import {getOrientationProp} from '../utils.js';
import * as MW from '../menuWidgets.js';

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
            ...getOrientationProp(false),
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.MEDIUM_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';
        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');

        this._leftPanelBox = new St.BoxLayout({
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            ...getOrientationProp(true),
            clip_to_allocation: true,
        });

        const userAvatar = ArcMenuManager.settings.get_boolean('disable-user-avatar');
        if (!userAvatar) {
            const userMenuBox = new St.BoxLayout({
                x_expand: true,
                y_expand: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.START,
                ...getOrientationProp(true),
                style: 'padding: 10px 0px; spacing: 4px;',
            });
            const avatarMenuIcon = new MW.AvatarMenuIcon(this, 75, true);
            avatarMenuIcon.label.set({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'font-size: large;',
            });
            userMenuBox.add_child(avatarMenuIcon);
            userMenuBox.add_child(avatarMenuIcon.label);
            this._leftPanelBox.add_child(userMenuBox);

            const userSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this._leftPanelBox.add_child(userSeparator);
        }

        this.shortcutsBox = new St.BoxLayout({
            ...getOrientationProp(true),
            style: 'spacing: 8px;',
        });
        this.shortcutsScrollBox = this._createScrollView({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
            style: 'padding: 6px 0px;',
        });
        this._addChildToParent(this.shortcutsScrollBox, this.shortcutsBox);
        this._leftPanelBox.add_child(this.shortcutsScrollBox);

        ArcMenuManager.settings.connectObject('changed::zest-layout-extra-shortcuts', () => this._createExtraShortcuts(), this);
        this._createExtraShortcuts();

        this._rightPanelBox = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });

        const topSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
            Constants.SeparatorAlignment.HORIZONTAL);
        topSeparator.style = 'padding: 0px; margin: 0px;';
        this.searchEntry.style = 'margin: 12px;';
        this.searchEntry.bind_property('visible', topSeparator, 'visible', GObject.BindingFlags.SYNC_CREATE);

        this._rightPanelBox.add_child(this.searchEntry);
        this._rightPanelBox.add_child(topSeparator);

        this._applicationsBox = new St.BoxLayout({
            ...getOrientationProp(false),
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            style: 'margin: 12px 6px;',
        });

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
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

        this.categoriesScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.categoriesScrollBox, this.categoriesBox);

        const verticalSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);
        this._applicationsBox.add_child(this.leftBox);
        this._applicationsBox.add_child(verticalSeparator);
        this._applicationsBox.add_child(this.rightBox);
        this._rightPanelBox.add_child(this._applicationsBox);

        const bottomSeparator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MAX,
            Constants.SeparatorAlignment.HORIZONTAL);
        bottomSeparator.style = 'padding: 0px; margin: 0px;';

        this._rightPanelBox.add_child(bottomSeparator);

        let powerOptionsItem;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.MENU)
            powerOptionsItem = new MW.LeaveButton(this, true);
        else
            powerOptionsItem = new MW.PowerOptionsBox(this);

        powerOptionsItem.x_align = horizontalFlip ? Clutter.ActorAlign.START : Clutter.ActorAlign.END;
        powerOptionsItem.x_expand = false;
        powerOptionsItem.style = 'margin: 12px;';
        this._rightPanelBox.add_child(powerOptionsItem);

        this.add_child(horizontalFlip ? this._rightPanelBox : this._leftPanelBox);
        this.add_child(horizontalFlip ? this._leftPanelBox : this._rightPanelBox);

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidthOffset = -70;
        const rightPanelWidthOffset = 40;
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

    _createExtraShortcuts() {
        this.shortcutsBox.destroy_all_children();
        const extraShortcuts = ArcMenuManager.settings.get_value('zest-layout-extra-shortcuts').deep_unpack();

        if (extraShortcuts.length === 0)
            return;

        const isContainedInCategory = false;

        for (let i = 0; i < extraShortcuts.length; i++) {
            const {id} = extraShortcuts[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
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

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        borderRadius /= scaleFactor;

        const panelWidth = ArcMenuManager.settings.get_int('zest-layout-panel-width');
        const horizontalFlip = ArcMenuManager.settings.get_boolean('enable-horizontal-flip');
        const rightRoundedCorners = `border-radius: 0px ${borderRadius}px ${borderRadius}px 0px;`;
        const leftRoundedCorners = `border-radius: ${borderRadius}px 0px 0px ${borderRadius}px;`;
        const roundedCorners = horizontalFlip ? leftRoundedCorners : rightRoundedCorners;

        this._rightPanelBox.style = `${roundedCorners} background-color: rgba(10, 10, 15, 0.2);`;
        this._leftPanelBox.style = `width: ${panelWidth}px; padding: 6px;`;
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';
    }

    _onDestroy() {
        if (this.arcMenu)
            this.arcMenu.box.style = null;
        super._onDestroy();
    }
}
