import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenu} from './menuButton.js';
import * as Constants from './constants.js';
import * as LayoutHandler from './menulayouts/layoutHandler.js';
import * as MW from './menuWidgets.js';

export const StandaloneRunner = class ArcMenuStandaloneRunner {
    constructor() {
        // Link search providers to this menu
        this.searchProviderDisplayId = 'StandaloneRunner';

        this._tooltipShowingID = null;
        this._tooltip = new MW.Tooltip(this);

        // Create Main Menus - ArcMenu and arcMenu's context menu
        this.arcMenu = new ArcMenu(Main.layoutManager.dummyCursor, 0.5, St.Side.TOP, this);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager();
        this.menuManager._changeMenu = () => {};
        this.menuManager.addMenu(this.arcMenu);

        // Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager();
        this.contextMenuManager._changeMenu = () => {};

        // Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager();
        this.subMenuManager._changeMenu = () => {};

        this.createMenuLayout();
    }

    createMenuLayout() {
        this.clearTooltipShowingId();
        this.hideTooltip(true);

        this._forcedMenuLocation = false;

        this._destroyMenuLayout();

        const standaloneRunner = true;
        this._menuLayout = LayoutHandler.createMenuLayout(this, Constants.MenuLayout.RUNNER, standaloneRunner);

        if (this._menuLayout)
            this.arcMenu.box.add_child(this._menuLayout);
    }

    onArcMenuClose() {
        // Clear active state for activeMenuItem
        if (this._menuLayout?.activeMenuItem)
            this._menuLayout.activeMenuItem.active = false;

        this._closeOtherMenus();
    }

    _closeOtherMenus() {
        if (this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if (this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();
    }

    toggleMenu() {
        this._closeOtherMenus();

        if (!this.arcMenu.isOpen)
            this._menuLayout.updateLocation();

        this.arcMenu.toggle();

        if (this.arcMenu.isOpen)
            this._menuLayout?.grab_key_focus();
    }

    _destroyMenuLayout() {
        if (this._menuLayout) {
            this._menuLayout.destroy();
            this._menuLayout = null;
        }
    }

    clearTooltipShowingId() {
        if (this._tooltipShowingID) {
            GLib.source_remove(this._tooltipShowingID);
            this._tooltipShowingID = null;
        }
    }

    showTooltip(sourceActor, location, titleLabel, description, displayType) {
        this.clearTooltipShowingId();
        this._tooltipShowingID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 750, () => {
            this._tooltip.setTooltipData(sourceActor, location, titleLabel, description, displayType);
            this._tooltip.show();
            this._tooltipShowingID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    hideTooltip(instant) {
        this._tooltip.hide(instant);
    }

    destroy() {
        this.clearTooltipShowingId();
        this.hideTooltip(true);
        this._destroyMenuLayout();

        this._tooltip?.destroy();
        this._tooltip = null;

        this.arcMenu?.destroy();
        this.arcMenu = null;

        this.menuManager = null;
        this.contextMenuManager = null;
        this.subMenuManager = null;
    }

    updateLocation() {
        this._menuLayout?.updateLocation();
    }

    getActiveCategoryType() {
        return this._menuLayout?.activeCategoryType;
    }

    reloadApplications() {
        this._menuLayout?.reloadApplications();
    }

    displayPinnedApps() {
        this._menuLayout?.displayPinnedApps();
    }

    loadPinnedApps() {
        this._menuLayout?.loadPinnedApps();
    }

    setDefaultMenuView() {
        this._menuLayout?.setDefaultMenuView();
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            if (Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();
        } else  if (!this.arcMenu.isOpen) {
            this.clearTooltipShowingId();
            this.hideTooltip(true);
        }
    }
};
