/* exported MenuButton */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, GObject, Graphene, Shell, St} = imports.gi;
const Constants = Me.imports.constants;
const {ExtensionState} = ExtensionUtils;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PanelMenu = imports.ui.panelMenu;
const PointerWatcher = imports.ui.pointerWatcher;
const PopupMenu = imports.ui.popupMenu;
const SystemActions = imports.misc.systemActions;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var MenuButton = GObject.registerClass(
class ArcMenuMenuButton extends PanelMenu.Button {
    _init(panel, panelBox, panelParent) {
        super._init(0.5, null, true);

        this._panel = panel;
        this._panelBox = panelBox;
        this._panelParent = panelParent;
        this.menu.destroy();
        this.menu = null;
        this.add_style_class_name('arcmenu-panel-menu');
        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);
        this._dtpNeedsRelease = false;

        // Create Main Menus - ArcMenu and ArcMenu's context menu
        this.arcMenu = new ArcMenu(this, 0.5, St.Side.TOP);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.arcMenuContextMenu = new ArcMenuContextMenu(this, 0.5, St.Side.TOP);
        this.arcMenuContextMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(this._panel);
        this.menuManager._changeMenu = () => {};
        this.menuManager.addMenu(this.arcMenu);
        this.menuManager.addMenu(this.arcMenuContextMenu);

        // Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this);
        this.contextMenuManager._changeMenu = () => {};
        this.contextMenuManager._onMenuSourceEnter = menu => {
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu !== menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        };

        // Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this);
        this.subMenuManager._changeMenu = () => {};

        this.menuButtonWidget = new MW.MenuButtonWidget();
        this.add_child(this.menuButtonWidget);
    }

    initiate() {
        this.dashToPanel = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);

        if (this.dashToPanel?.state === ExtensionState.ENABLED && global.dashToPanel)
            this.syncWithDashToPanel();

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.updateHeight());
        this._startupCompleteId = Main.layoutManager.connect('startup-complete', () => this.updateHeight());

        this.setMenuPositionAlignment();
        this.createMenuLayoutTimeout();
    }

    syncWithDashToPanel() {
        const monitorIndex = Main.layoutManager.findIndexForActor(this);
        const side = Utils.getDashToPanelPosition(this.dashToPanel.settings, monitorIndex);
        this.updateArrowSide(side);

        this.dtpPostionChangedID = this.dashToPanel.settings.connect('changed::panel-positions', () => {
            const newMonitorIndex = Main.layoutManager.findIndexForActor(this);
            const newSide = Utils.getDashToPanelPosition(this.dashToPanel.settings, newMonitorIndex);
            this.updateArrowSide(newSide);
        });
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

        this._destroyMenuLayout();

        this._createMenuLayoutTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._menuLayout = Utils.getMenuLayout(this, Me.settings.get_enum('menu-layout'));

            if (this._menuLayout) {
                this.arcMenu.box.add_child(this._menuLayout);
                this.setMenuPositionAlignment();
                this.forceMenuLocation();
                this.updateHeight();
            }

            this._createMenuLayoutTimeoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    setMenuPositionAlignment() {
        const layout = Me.settings.get_enum('menu-layout');
        const arrowAlignment = 1 - (Me.settings.get_int('menu-position-alignment') / 100);
        const panelPosition = Me.settings.get_enum('position-in-panel');

        if (layout !== Constants.MenuLayout.RUNNER) {
            if (panelPosition === Constants.MenuPosition.CENTER) {
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment;
                this.arcMenu._arrowAlignment = arrowAlignment;
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
                this.arcMenu._boxPointer.setSourceAlignment(.5);
            } else if (this.dashToPanel?.state === ExtensionState.ENABLED) {
                const monitorIndex = Main.layoutManager.findIndexForActor(this);
                const side = Utils.getDashToPanelPosition(this.dashToPanel.settings, monitorIndex);
                this.updateArrowSide(side, false);
            } else {
                this.updateArrowSide(St.Side.TOP, false);
            }
        } else {
            this.updateArrowSide(St.Side.TOP, false);
            if (panelPosition === Constants.MenuPosition.CENTER) {
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment;
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
            }
        }
    }

    updateArrowSide(side, setAlignment = true) {
        let arrowAlignment;
        if (side === St.Side.RIGHT || side === St.Side.LEFT)
            arrowAlignment = 1.0;
        else
            arrowAlignment = 0.5;

        const menus = [this.arcMenu, this.arcMenuContextMenu];
        for (const menu of menus) {
            menu._arrowSide = side;
            menu._boxPointer._arrowSide = side;
            menu._boxPointer._userArrowSide = side;
            menu._boxPointer.setSourceAlignment(0.5);
            menu._arrowAlignment = arrowAlignment;
            menu._boxPointer._border.queue_repaint();
        }

        if (setAlignment)
            this.setMenuPositionAlignment();
    }

    forceMenuLocation() {
        const layout = Me.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER ||
            layout === Constants.MenuLayout.RAVEN ||
            layout === Constants.MenuLayout.GNOME_OVERVIEW)
            return;

        this.arcMenu.actor.remove_style_class_name('bottomOfScreenMenu');

        const newMenuLocation = Me.settings.get_enum('force-menu-location');
        if (this._menuLocation !== newMenuLocation) {
            this._menuLocation = newMenuLocation;

            if (newMenuLocation === Constants.ForcedMenuLocation.OFF) {
                this.arcMenu.sourceActor = this.arcMenu.focusActor = this;
                this.arcMenu._boxPointer.setPosition(this, 0.5);
                this.setMenuPositionAlignment();
                return;
            }

            this.arcMenu.sourceActor = this.arcMenu.focusActor = Main.layoutManager.dummyCursor;
            this.arcMenu._boxPointer.setPosition(Main.layoutManager.dummyCursor, 0.5);
            this.arcMenu._boxPointer.setSourceAlignment(0.5);
            this.arcMenu._arrowAlignment = 0.5;
        }

        if (newMenuLocation === Constants.ForcedMenuLocation.OFF)
            return;

        this.updateArrowSide(St.Side.TOP);
        const monitorIndex = Main.layoutManager.findIndexForActor(this);
        const rect = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        const positionX = Math.round(rect.x + (rect.width / 2));
        let positionY;

        if (newMenuLocation === Constants.ForcedMenuLocation.TOP_CENTERED) {
            positionY = rect.y;
        } else if (newMenuLocation === Constants.ForcedMenuLocation.BOTTOM_CENTERED) {
            positionY = rect.y + rect.height - 1;
            this.arcMenu.actor.add_style_class_name('bottomOfScreenMenu');
        }

        Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            if (event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE)
                this.toggleMenu();
            else if (event.get_button() === Clutter.BUTTON_SECONDARY)
                this.arcMenuContextMenu.toggle();
        } else if (event.type() === Clutter.EventType.TOUCH_BEGIN) {
            this.toggleMenu();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    closeOtherMenus() {
        if (this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if (this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();
    }

    closeContextMenu() {
        if (this.arcMenuContextMenu.isOpen)
            this.arcMenuContextMenu.toggle();
    }

    toggleMenu() {
        this.closeOtherMenus();

        this.forceMenuLocation();

        const layout = Me.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.GNOME_OVERVIEW) {
            if (Me.settings.get_boolean('gnome-dash-show-applications'))
                Main.overview._overview._controls._toggleAppsPage();
            else
                Main.overview.toggle();
            return;
        }

        if (!this.arcMenu.isOpen) {
            if (this._menuLayout?.updateLocation)
                this._menuLayout.updateLocation();

            if (this._menuLayout?.updateStyle)
                this._menuLayout.updateStyle();

            this._maybeShowPanel();
        }

        this.arcMenu.toggle();

        if (this.arcMenu.isOpen)
            this._menuLayout?.grab_key_focus();
    }

    _maybeShowPanel() {
        if (this._panelParent.intellihide && this._panelParent.intellihide.enabled) {
            this._panelParent.intellihide._revealPanel(true);
            this._panelParent.intellihide.revealAndHold(1);
        } else if (!this._panelBox.visible) {
            this._panelBox.visible = true;
            this._panelNeedsHiding = true;
        }
    }

    updateHeight() {
        if (!this._menuLayout)
            return;

        const layout = Me.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN) {
            this.arcMenu.actor.style = '';
            return;
        }

        const height = Me.settings.get_int('menu-height');
        this.arcMenu.actor.style = `height: ${height}px;`;
    }

    updateWidth() {
        if (this._menuLayout?.updateWidth)
            this._menuLayout.updateWidth(true);
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

    _onDestroy() {
        this._removePointerWatcher();

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        if (this._startupCompleteId) {
            Main.layoutManager.disconnect(this._startupCompleteId);
            this._startupCompleteId = null;
        }

        this._clearMenuLayoutTimeouts();
        this._clearTooltipShowingId();

        if (this.dtpPostionChangedID && this.dashToPanel.settings) {
            this.dashToPanel.settings.disconnect(this.dtpPostionChangedID);
            this.dtpPostionChangedID = null;
        }

        this._destroyMenuLayout();

        this.tooltip?.destroy();
        this.tooltip = null;
        this.arcMenu?.destroy();
        this.arcMenuContextMenu?.destroy();

        super._onDestroy();
    }

    _destroyMenuLayout() {
        if (this._menuLayout) {
            this._menuLayout.destroy();
            this._menuLayout = null;
        }
    }

    updateLocation() {
        if (this._menuLayout && this._menuLayout.updateLocation)
            this._menuLayout.updateLocation();
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
        if (!this._menuLayout)
            return;

        if (!this._menuLayout.reloadQueued)
            this._menuLayout.setDefaultMenuView();
    }

    _onOpenStateChanged(_menu, open) {
        if (open) {
            this.menuButtonWidget.addStylePseudoClass('active');
            this.add_style_pseudo_class('active');

            if (Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();

            if (!this._dtpNeedsRelease && this._panelParent.intellihide?.enabled)
                this._dtpNeedsRelease = true;
        } else {
            if (!this.arcMenu.isOpen) {
                this._clearTooltipShowingId();
                this._clearTooltip();
            }

            if (!this.arcMenu.isOpen && !this.arcMenuContextMenu.isOpen) {
                this.menuButtonWidget.removeStylePseudoClass('active');
                this.remove_style_pseudo_class('active');

                if (this._dtpNeedsRelease && !this._panelNeedsHiding) {
                    this._dtpNeedsRelease = false;
                    const hidePanel = () => this._panelParent.intellihide?.release(1);

                    const shouldHidePanel = this._maybeHidePanel(hidePanel);
                    if (!shouldHidePanel)
                        return;

                    hidePanel();
                }
                if (this._panelNeedsHiding) {
                    this._panelNeedsHiding = false;
                    const hidePanel = () => (this._panelBox.visible = false);

                    const shouldHidePanel = this._maybeHidePanel(hidePanel);
                    if (!shouldHidePanel)
                        return;

                    hidePanel();
                }
            }
        }
    }

    _maybeHidePanel(hidePanelCallback) {
        const [x, y] = global.get_pointer();
        const mouseOnPanel = this._panelHasMousePointer(x, y);

        const actor = global.stage.get_event_actor(Clutter.get_current_event());
        if (actor === this._panelParent || this._panelParent.contains(actor) || mouseOnPanel) {
            if (this._pointerWatch)
                return false;

            this._pointerWatch = PointerWatcher.getPointerWatcher().addWatch(200, (pX, pY) => {
                if (!this._panelHasMousePointer(pX, pY))
                    hidePanelCallback();
            });

            return false;
        }

        return true;
    }

    _panelHasMousePointer(x, y) {
        const grabActor = global.stage.get_grab_actor();
        const sourceActor = grabActor?._sourceActor || grabActor;
        const statusArea = this._panelParent.statusArea ?? this._panel.statusArea;

        if (sourceActor && (sourceActor === Main.layoutManager.dummyCursor ||
                            statusArea?.quickSettings?.menu.actor.contains(sourceActor) ||
                            this._panelParent.contains(sourceActor)))
            return true;


        const panelBoxRect = this._panelBox.get_transformed_extents();
        const cursorLocation = new Graphene.Point({x, y});

        if (panelBoxRect.contains_point(cursorLocation)) {
            return true;
        } else {
            this._removePointerWatcher();
            return false;
        }
    }

    _removePointerWatcher() {
        if (this._pointerWatch) {
            PointerWatcher.getPointerWatcher()._removeWatch(this._pointerWatch);
            this._pointerWatch = null;
        }
    }
});

var ArcMenu = class ArcMenuArcMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide, parent) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._menuButton = parent || sourceActor;
        Main.uiGroup.add_child(this.actor);
        this.actor.add_style_class_name('panel-menu arcmenu-menu');
        this.actor.hide();
        this._menuClosedID = this.connect('menu-closed', () => this._menuButton.setDefaultMenuView());
        this.connect('destroy', () => this._onDestroy());

        this.actor.connectObject('captured-event', this._onCapturedEvent.bind(this), this);
    }

    _onCapturedEvent(actor, event) {
        if (Main.keyboard.maybeHandleEvent(event))
            return Clutter.EVENT_STOP;

        return Clutter.EVENT_PROPAGATE;
    }

    open(animate) {
        if (!this.isOpen) {
            this._menuButton.arcMenu.actor._muteInput = false;
            this._menuButton.arcMenu.actor._muteKeys = false;
        }
        super.open(animate);
    }

    close(animate) {
        if (this.isOpen)
            this._menuButton.closeOtherMenus();

        super.close(animate);
    }

    _onDestroy() {
        if (this._menuClosedID) {
            this.disconnect(this._menuClosedID);
            this._menuClosedID = null;
        }
    }
};

var ArcMenuContextMenu = class ArcMenuArcMenuContextMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._menuButton = sourceActor;

        this.actor.add_style_class_name('panel-menu app-menu');
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();

        this.systemActions = SystemActions.getDefault();

        const menuItemsChangedId = Me.settings.connect('changed::context-menu-shortcuts',
            () => this.populateMenuItems());

        this.populateMenuItems();
        this.connect('destroy', () => {
            this.disconnectPowerOptions();
            Me.settings.disconnect(menuItemsChangedId);
        });
    }

    populateMenuItems() {
        this.disconnectPowerOptions();
        this.removeAll();

        const contextMenuShortcuts = Me.settings.get_value('context-menu-shortcuts').deep_unpack();

        for (let i = 0; i < contextMenuShortcuts.length; i++) {
            const [title, icon_, command] = contextMenuShortcuts[i];

            if (command.endsWith('.desktop')) {
                this.addSettingsAction(title, command);
            } else if (command === Constants.ShortcutCommands.SEPARATOR) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if (command === Constants.ShortcutCommands.SETTINGS) {
                this.addAction(_('ArcMenu Settings'), () => ExtensionUtils.openPrefs());
            } else if (command.includes(Constants.ShortcutCommands.SETTINGS)) {
                const settingsPage = command.replace(Constants.ShortcutCommands.SETTINGS, '');
                if (settingsPage === 'About')
                    this.addArcMenuSettingsItem(title, Constants.SettingsPage.ABOUT);
                else if (settingsPage === 'Menu')
                    this.addArcMenuSettingsItem(title, Constants.SettingsPage.CUSTOMIZE_MENU);
                else if (settingsPage === 'Layout')
                    this.addArcMenuSettingsItem(title, Constants.SettingsPage.MENU_LAYOUT);
                else if (settingsPage === 'Button')
                    this.addArcMenuSettingsItem(title, Constants.SettingsPage.BUTTON_APPEARANCE);
                else if (settingsPage === 'Theme')
                    this.addArcMenuSettingsItem(title, Constants.SettingsPage.MENU_THEME);
            } else if (command === Constants.ShortcutCommands.OVERVIEW) {
                this.addAction(_('Activities Overview'), () => Main.overview.toggle());
            } else if (command === Constants.ShortcutCommands.POWER_OPTIONS) {
                this.addPowerOptionsMenuItem();
            } else if (command === Constants.ShortcutCommands.SHOW_DESKTOP) {
                this.addShowDekstopItem();
            } else if (command === Constants.ShortcutCommands.PANEL_EXTENSION_SETTINGS) {
                this.addExtensionSettings();
            }
        }
    }

    addArcMenuSettingsItem(title, prefsVisiblePage) {
        const item = new PopupMenu.PopupMenuItem(_(title));
        item.connect('activate', () => {
            Me.settings.set_int('prefs-visible-page', prefsVisiblePage);
            ExtensionUtils.openPrefs();
        });
        this.addMenuItem(item);
    }

    disconnectPowerOptions() {
        if (this.canSuspendId)
            this.systemActions.disconnect(this.canSuspendId);
        if (this.canSwitchUserId)
            this.systemActions.disconnect(this.canSwitchUserId);

        this.canSuspendId = null;
        this.canSwitchUserId = null;
    }

    addShowDekstopItem() {
        this.addAction(_('Show Desktop'), () => {
            const currentWorkspace = global.workspace_manager.get_active_workspace();
            let windows = currentWorkspace.list_windows().filter(w => {
                return w.showing_on_its_workspace() && !w.skip_taskbar;
            });
            windows = global.display.sort_windows_by_stacking(windows);

            windows.forEach(w => {
                w.minimize();
            });
        });
    }

    addPowerOptionsMenuItem() {
        const powerOptionsItem = new PopupMenu.PopupSubMenuMenuItem(_('Power Off / Log Out'));

        const suspendItem = powerOptionsItem.menu.addAction(_('Suspend'),
            () => this.systemActions.activateSuspend());
        suspendItem.visible = this.systemActions.canSuspend;
        powerOptionsItem.menu.addAction(_('Restart...'), () => this.systemActions.activateRestart());
        powerOptionsItem.menu.addAction(_('Power Off...'), () => this.systemActions.activatePowerOff());

        powerOptionsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        powerOptionsItem.menu.addAction(_('Lock'), () => this.systemActions.activateLockScreen());
        powerOptionsItem.menu.addAction(_('Log Out...'), () => this.systemActions.activateLogout());
        const switchUserItem = powerOptionsItem.menu.addAction(_('Switch User'),
            () => this.systemActions.activateSwitchUser());
        switchUserItem.visible = this.systemActions.canSwitchUser;

        this.canSuspendId = this.systemActions.connect('notify::can-suspend',
            () => (suspendItem.visible = this.systemActions.canSuspend));
        this.canSwitchUserId = this.systemActions.connect('notify::can-switch-user',
            () => (switchUserItem.visible = this.systemActions.canSwitchUser));

        this.addMenuItem(powerOptionsItem);
    }

    addSettingsAction(title, desktopFile) {
        const app = Shell.AppSystem.get_default().lookup_app(desktopFile);
        if (!app)
            return;

        if (!title)
            title = app.get_name();


        super.addSettingsAction(title, desktopFile);
    }

    addExtensionSettings() {
        const dashToPanel = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);
        const azTaskbar = Main.extensionManager.lookup(Constants.AZTASKBAR_UUID);

        if (dashToPanel?.state === ExtensionState.ENABLED && global.dashToPanel) {
            const item = new PopupMenu.PopupMenuItem(_('Dash to Panel Settings'));
            item.connect('activate', () => Utils.openPrefs(Constants.DASH_TO_PANEL_UUID));
            this.addMenuItem(item);
        } else if (azTaskbar?.state === ExtensionState.ENABLED && global.azTaskbar) {
            const item = new PopupMenu.PopupMenuItem(_('App Icons Taskbar Settings'));
            item.connect('activate', () => Utils.openPrefs(Constants.AZTASKBAR_UUID));
            this.addMenuItem(item);
        }
    }
};
