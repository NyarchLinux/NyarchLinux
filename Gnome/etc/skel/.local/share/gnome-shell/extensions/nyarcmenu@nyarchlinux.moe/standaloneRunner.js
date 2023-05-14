/* exported StandaloneRunner */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, St} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuButton = Me.imports.menuButton;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var StandaloneRunner = class ArcMenuStandaloneRunner {
    constructor() {
        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);

        // Create Main Menus - ArcMenu and arcMenu's context menu
        this.arcMenu = new MenuButton.ArcMenu(Main.layoutManager.dummyCursor, 0.5, St.Side.TOP, this);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(Main.panel);
        this.menuManager._changeMenu = () => {};
        this.menuManager.addMenu(this.arcMenu);

        // Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this.arcMenu);
        this.contextMenuManager._changeMenu = () => {};
        this.contextMenuManager._onMenuSourceEnter = menu => {
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu !== menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        };

        // Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this.arcMenu);
        this.subMenuManager._changeMenu = () => {};
    }

    initiate() {
        this.createMenuLayoutTimeout();
    }

    _clearMenuLayoutTimeouts() {
        if (this._createMenuLayoutTimeoutID) {
            GLib.source_remove(this._createMenuLayoutTimeoutID);
            this._createMenuLayoutTimeoutID = null;
        }
    }

    createMenuLayoutTimeout() {
        this._clearMenuLayoutTimeouts();

        this._clearTooltipShowingId();
        this._clearTooltip();

        this._forcedMenuLocation = false;

        this._destroyMenuLayout();

        this._createMenuLayoutTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            const standaloneRunner = true;
            this._menuLayout = Utils.getMenuLayout(this, Constants.MenuLayout.RUNNER, standaloneRunner);
            this.arcMenu.box.add_child(this._menuLayout);

            this._createMenuLayoutTimeoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    closeOtherMenus() {
        if (this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if (this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();
    }

    toggleMenu() {
        this.closeOtherMenus();

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

    _clearTooltipShowingId() {
        if (this.tooltipShowingID) {
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }
    }

    _clearTooltip() {
        this.tooltipShowing = false;
        if (this.tooltip) {
            this.tooltip.hide();
            this.tooltip.sourceActor = null;
        }
    }

    destroy() {
        this._clearMenuLayoutTimeouts();

        this._clearTooltipShowingId();
        this._clearTooltip();
        this._destroyMenuLayout();

        this.tooltip?.destroy();
        this.tooltip = null;

        this.arcMenu?.destroy();
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
            this._clearTooltipShowingId();
            this._clearTooltip();
        }
    }
};
