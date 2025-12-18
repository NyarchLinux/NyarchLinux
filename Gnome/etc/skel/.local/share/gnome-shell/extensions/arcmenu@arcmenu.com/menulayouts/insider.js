import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
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
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 525,
            icon_grid_size: Constants.GridIconSize.SMALL,
            ...getOrientationProp(false),
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.actionsBox = new St.BoxLayout({
            x_expand: false,
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

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(true),
        });
        this.add_child(this._mainBox);

        const userAvatar = ArcMenuManager.settings.get_boolean('disable-user-avatar');
        if (!userAvatar) {
            const userMenuBox = new St.BoxLayout({
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.START,
                ...getOrientationProp(true),
                style: 'padding-bottom: 6px;',
            });
            const avatarMenuIcon = new MW.AvatarMenuIcon(this, 75, true);
            avatarMenuIcon.label.set({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'font-size: large;',
            });
            userMenuBox.add_child(avatarMenuIcon);
            userMenuBox.add_child(avatarMenuIcon.label);
            this._mainBox.add_child(userMenuBox);
        }

        this.searchEntry.style = 'margin: 0px 10px 10px 10px;';
        this._mainBox.add_child(this.searchEntry);

        this.applicationsBox = new St.BoxLayout({...getOrientationProp(true)});
        this.applicationsScrollBox = this._createScrollView({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this._pinnedAppsGrid.layout_manager.set({
            column_spacing: 0,
            row_spacing: 0,
            halign: Clutter.ActorAlign.FILL,
        });

        ArcMenuManager.settings.connectObject('changed::insider-layout-extra-shortcuts', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this._createPinnedAppsMenu();
        this.setDefaultMenuView();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
        this._connectAppChangedEvents();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        this.pinnedAppsButton = new PinnedAppsButton(this);
        this.pinnedAppsButton.y_expand = true;
        this.pinnedAppsButton.y_align = Clutter.ActorAlign.START;
        this.actionsBox.add_child(this.pinnedAppsButton);

        const isContainedInCategory = false;
        const extraButtons = ArcMenuManager.settings.get_value('insider-layout-extra-shortcuts').deep_unpack();

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

    loadPinnedApps() {
        this.display_type = Constants.DisplayType.LIST;
        super.loadPinnedApps();
        this.display_type = Constants.DisplayType.GRID;
    }

    _createPinnedAppsMenu() {
        this._dummyCursor = new St.Widget({width: 0, height: 0, opacity: 0});
        Main.uiGroup.add_child(this._dummyCursor);

        this.pinnedAppsMenu = new PopupMenu.PopupMenu(this._dummyCursor, 0, St.Side.TOP);
        this.pinnedAppsMenu.actor.add_style_class_name('popup-menu arcmenu-menu');

        const section = new PopupMenu.PopupMenuSection();
        this.pinnedAppsMenu.addMenuItem(section);

        const pinnedAppsPopupBox = new St.BoxLayout({...getOrientationProp(true)});
        pinnedAppsPopupBox._delegate = pinnedAppsPopupBox;
        section.actor.add_child(pinnedAppsPopupBox);

        const headerBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(true),
        });
        pinnedAppsPopupBox.add_child(headerBox);

        this.backButton = new MW.BackButton(this);
        this.backButton.connectObject('activate', () => this.togglePinnedAppsMenu(), this);
        headerBox.add_child(this.backButton);

        const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        headerBox.add_child(separator);
        headerBox.add_child(this.createLabelRow(_('Pinned')));

        this.pinnedAppsScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        pinnedAppsPopupBox.add_child(this.pinnedAppsScrollBox);

        this.pinnedAppsBox = new St.BoxLayout({...getOrientationProp(true)});
        this._addChildToParent(this.pinnedAppsScrollBox, this.pinnedAppsBox);

        this.displayPinnedApps();
        this.subMenuManager.addMenu(this.pinnedAppsMenu);
        this.pinnedAppsMenu.actor.hide();
        Main.uiGroup.add_child(this.pinnedAppsMenu.actor);
        this.pinnedAppsMenu.connectObject('open-state-changed', (menu, open) => {
            if (!open) {
                this.pinnedAppsButton.active = false;
                this.pinnedAppsButton.sync_hover();
                this.pinnedAppsButton.hovered = this.pinnedAppsButton.hover;
            }
        }, this);
    }

    togglePinnedAppsMenu() {
        const {vadjustment} = getScrollViewAdjustments(this.pinnedAppsScrollBox);
        vadjustment.set_value(0);

        const themeNode = this.arcMenu.actor.get_theme_node();
        const rise = themeNode.get_length('-arrow-rise');

        this.arcMenu.actor.get_allocation_box();
        let [x, y] = this.arcMenu.actor.get_transformed_position();

        if (this.arcMenu._arrowSide !== St.Side.TOP)
            y -= rise;
        if (this.arcMenu._arrowSide === St.Side.LEFT)
            x += rise;

        this._dummyCursor.set_position(Math.round(x), Math.round(y));

        const height = ArcMenuManager.settings.get_int('menu-height');
        this.pinnedAppsMenu.box.style = `height: ${height}px; min-width: 250px;`;

        this.pinnedAppsMenu.toggle();
        if (this.pinnedAppsMenu.isOpen) {
            this.activeMenuItem = this.backButton;
            this.backButton.grab_key_focus();
        }
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.displayAllApps();
        this.activeMenuItem = this.applicationsGrid.getItemAt(0);

        if (!this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);

        const {vadjustment} = getScrollViewAdjustments(this.pinnedAppsScrollBox);
        vadjustment.set_value(0);

        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
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
        this._clearActorsFromBox(this.pinnedAppsBox);
        this.activeCategoryType = Constants.CategoryType.PINNED_APPS;

        if (!this.pinnedAppsBox.contains(this._pinnedAppsGrid))
            this.pinnedAppsBox.add_child(this._pinnedAppsGrid);

        this._pinnedAppsGrid.setColumns(1);
    }

    _onDestroy() {
        super._onDestroy();
        this._dummyCursor.destroy();
        this._dummyCursor = null;
    }
}

class PinnedAppsButton extends MW.ArcMenuButtonItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super(menuLayout, _('Pinned Apps'), 'open-menu-symbolic');
        this._closeMenuOnActivate = false;
    }

    activate(event) {
        super.activate(event);
        this._menuLayout.togglePinnedAppsMenu();
    }
}
