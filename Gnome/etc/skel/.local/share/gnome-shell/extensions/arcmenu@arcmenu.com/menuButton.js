import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PointerWatcher from 'resource:///org/gnome/shell/ui/pointerWatcher.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import * as LayoutHandler from './menulayouts/layoutHandler.js';
import * as MW from './menuWidgets.js';
import * as Utils from './utils.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

class MenuButtonWidget extends St.BoxLayout {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            style_class: 'panel-status-menu-box',
        });

        this._icon = new St.Icon({
            style_class: 'arcmenu-menu-button',
            track_hover: true,
            reactive: true,
        });
        this._label = new St.Label({
            text: _('Apps'),
            y_expand: true,
            style_class: 'arcmenu-menu-button',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._icon);
        this.add_child(this._label);
    }

    addStylePseudoClass(style) {
        this._icon.add_style_pseudo_class(style);
        this._label.add_style_pseudo_class(style);
    }

    removeStylePseudoClass(style) {
        this._icon.remove_style_pseudo_class(style);
        this._label.remove_style_pseudo_class(style);
    }

    showIcon() {
        this._icon.show();
        this._label.hide();

        this.set_child_at_index(this._icon, 0);
    }

    showText() {
        this._icon.hide();
        this._label.show();

        this.set_child_at_index(this._label, 0);
    }

    showIconText() {
        this._icon.show();
        this._label.show();

        this.set_child_at_index(this._icon, 0);
    }

    showTextIcon() {
        this._icon.show();
        this._label.show();

        this.set_child_at_index(this._label, 0);
    }

    getPanelLabel() {
        return this._label;
    }

    getPanelIcon() {
        return this._icon;
    }

    setLabelStyle(style) {
        this._label.style = style;
    }
}

export const MenuButton = GObject.registerClass(
class ArcMenuMenuButton extends PanelMenu.Button {
    _init(panelInfo, monitorIndex) {
        super._init(0.5, null, true);

        this._destroyed = false;

        this.set({
            x_expand: false,
        });

        this.add_style_class_name('arcmenu-panel-menu');

        this._extension = ArcMenuManager.extension;
        this._settings = ArcMenuManager.settings;

        // Link search providers to this menu
        this.searchProviderDisplayId = `ArcMenu_${monitorIndex}`;

        this._panel = panelInfo.panel;
        this._panelBox = panelInfo.panelBox;
        this._panelParent = panelInfo.panelParent;
        this._monitorIndex = monitorIndex;

        this.menu.destroy();
        this.menu = null;

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

        this.menuButtonWidget = new MenuButtonWidget();
        this.add_child(this.menuButtonWidget);
    }

    get extension() {
        return this._extension;
    }

    get settings() {
        return this._settings;
    }

    initiate() {
        this._dtp = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);

        if (this._dtp?.state === Utils.ExtensionState.ACTIVE && global.dashToPanel)
            this.syncWithDashToPanel();

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.updateHeight());
        this._startupCompleteId = Main.layoutManager.connect('startup-complete', () => this.updateHeight());

        this.setMenuPositionAlignment();
        this.createMenuLayout();
    }

    syncWithDashToPanel() {
        const dtp = Extension.lookupByUUID(Constants.DASH_TO_PANEL_UUID);
        this._dtpSettings = dtp.getSettings('org.gnome.shell.extensions.dash-to-panel');

        const side = Utils.getDashToPanelPosition(this._dtpSettings, this._monitorIndex);
        this.updateArrowSide(side);

        this.dtpPostionChangedID = this._dtpSettings.connect('changed::panel-positions', () => {
            const newSide = Utils.getDashToPanelPosition(this._dtpSettings, this._monitorIndex);
            this.updateArrowSide(newSide);
        });
    }

    async createMenuLayout() {
        this._clearTooltipShowingId();
        this._clearTooltip();

        this._destroyMenuLayout();

        const layout = this._settings.get_enum('menu-layout');

        if (this._destroyed)
            return;

        this._menuLayout = await LayoutHandler.createMenuLayout(this, layout);

        // MenuButton may be destroyed while createMenuLayout() is running
        if (this._destroyed && this._menuLayout) {
            this._menuLayout.arcMenu = null;
            this._menuLayout.destroy();
            return;
        }

        if (this._menuLayout) {
            this.arcMenu.box.add_child(this._menuLayout);
            this.setMenuPositionAlignment();
            this.forceMenuLocation();
            this.updateHeight();
        }
    }

    setMenuPositionAlignment() {
        const layout = this._settings.get_enum('menu-layout');
        const arrowAlignment = 1 - (this._settings.get_int('menu-position-alignment') / 100);
        const panelPosition = this._settings.get_enum('position-in-panel');

        if (layout !== Constants.MenuLayout.RUNNER) {
            if (panelPosition === Constants.MenuPosition.CENTER) {
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment;
                this.arcMenu._arrowAlignment = arrowAlignment;
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
                this.arcMenu._boxPointer.setSourceAlignment(.5);
            } else if (this._dtp?.state === Utils.ExtensionState.ACTIVE) {
                const side = Utils.getDashToPanelPosition(this._dtpSettings, this._monitorIndex);
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
        const layout = this._settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER ||
            layout === Constants.MenuLayout.RAVEN ||
            layout === Constants.MenuLayout.GNOME_OVERVIEW)
            return;

        this.arcMenu.actor.remove_style_class_name('bottomOfScreenMenu');

        const newMenuLocation = this._settings.get_enum('force-menu-location');
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

        this.updateArrowSide(St.Side.TOP, false);
        const rect = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
        const positionX = Math.round(rect.x + (rect.width / 2));
        let positionY;

        if (newMenuLocation === Constants.ForcedMenuLocation.TOP_CENTERED) {
            positionY = rect.y;
        } else if (newMenuLocation === Constants.ForcedMenuLocation.BOTTOM_CENTERED) {
            positionY = rect.y + rect.height - 1;
            this.arcMenu.actor.add_style_class_name('bottomOfScreenMenu');
        } else if (newMenuLocation === Constants.ForcedMenuLocation.MONITOR_CENTERED) {
            const menuHeight = this._settings.get_int('menu-height');
            const monitor = Main.layoutManager.findMonitorForActor(this);
            positionY = Math.round(monitor.y + (monitor.height / 2) - (menuHeight / 2));
            Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);
        }

        Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            const clickAction = this._getClickActionForButton(event.get_button());
            if (clickAction === Constants.MenuButtonClickAction.ARCMENU)
                this.toggleMenu();
            else if (clickAction === Constants.MenuButtonClickAction.CONTEXT_MENU)
                this.arcMenuContextMenu.toggle();
        } else if (event.type() === Clutter.EventType.TOUCH_BEGIN) {
            this.toggleMenu();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _getClickActionForButton(button) {
        if (button === Clutter.BUTTON_PRIMARY)
            return this._settings.get_enum('menu-button-left-click-action');
        else if (button === Clutter.BUTTON_SECONDARY)
            return this._settings.get_enum('menu-button-right-click-action');
        else if (button === Clutter.BUTTON_MIDDLE)
            return this._settings.get_enum('menu-button-middle-click-action');
        else
            return -1;
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

        const layout = this._settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.GNOME_OVERVIEW) {
            if (this._settings.get_boolean('gnome-dash-show-applications'))
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
        }

        this.arcMenu.toggle();

        if (this.arcMenu.isOpen)
            this._menuLayout?.grab_key_focus();
    }

    updateHeight() {
        if (!this._menuLayout)
            return;

        const layout = this._settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN) {
            this._menuLayout.style = '';
            return;
        }

        const height = this._settings.get_int('menu-height');
        this._menuLayout.style = `height: ${height}px;`;
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
        this._destroyed = true;
        this._stopTrackingMouse();

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        if (this._startupCompleteId) {
            Main.layoutManager.disconnect(this._startupCompleteId);
            this._startupCompleteId = null;
        }

        this._clearTooltipShowingId();

        if (this.dtpPostionChangedID && this._dtpSettings) {
            this._dtpSettings.disconnect(this.dtpPostionChangedID);
            this.dtpPostionChangedID = null;
        }

        this._destroyMenuLayout();

        this.tooltip?.destroy();
        this.tooltip = null;
        this.arcMenu?.destroy();
        this.arcMenu = null;
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
            this._maybeShowPanel();
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

                    const isMouseOnPanel = this._isMouseOnPanel();
                    if (isMouseOnPanel)
                        this._startTrackingMouse(hidePanel);
                    else
                        hidePanel();
                }
                if (this._panelNeedsHiding) {
                    this._panelNeedsHiding = false;
                    // Hide panel if monitor inFullscreen, else show it
                    const hidePanel = () => {
                        const monitor = Main.layoutManager.findMonitorForActor(this);
                        this._panelBox.visible = !(global.window_group.visible &&
                                                    monitor &&
                                                    monitor.inFullscreen);
                    };

                    const isMouseOnPanel = this._isMouseOnPanel();
                    if (isMouseOnPanel)
                        this._startTrackingMouse(hidePanel);
                    else
                        hidePanel();
                }
            }
        }
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

    _isMouseOnPanel() {
        const [x, y] = global.get_pointer();

        const mouseOnPanel = this._panelHasMousePointer(x, y);
        if (mouseOnPanel)
            return true;

        return false;
    }

    _panelHasMousePointer(x, y) {
        const panelBoxRect = this._panelBox.get_transformed_extents();
        const cursorLocation = new Graphene.Point({x, y});

        if (panelBoxRect.contains_point(cursorLocation))
            return true;

        // Check if panel or panel menus have grab actor
        const grabActor = global.stage.get_grab_actor();
        const sourceActor = grabActor?._sourceActor || grabActor;
        const statusArea = this._panelParent.statusArea ?? this._panel.statusArea;
        const quickSettingsMenu = statusArea?.quickSettings?.menu.actor;

        if (sourceActor && (quickSettingsMenu?.contains(sourceActor) || this._panelParent.contains(sourceActor)))
            return true;

        return false;
    }

    _startTrackingMouse(callback) {
        if (this._pointerWatch)
            return;

        this._pointerWatch = PointerWatcher.getPointerWatcher().addWatch(500, (pX, pY) => {
            if (!this._panelHasMousePointer(pX, pY)) {
                callback();
                this._stopTrackingMouse();
            }
        });
    }

    _stopTrackingMouse() {
        if (this._pointerWatch) {
            PointerWatcher.getPointerWatcher()._removeWatch(this._pointerWatch);
            this._pointerWatch = null;
        }
    }
});

export const ArcMenu = class ArcMenuArcMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide, parent) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._menuButton = parent || sourceActor;
        Main.uiGroup.add_child(this.actor);
        this.actor.add_style_class_name('panel-menu arcmenu-menu');
        this.actor.hide();
        this._menuClosedID = this.connect('menu-closed', () => this._menuButton.setDefaultMenuView());
        this.connect('destroy', () => this._onDestroy());

        this.actor.connectObject('captured-event', this._onCapturedEvent.bind(this), this);

        this._dimEffect = new Clutter.BrightnessContrastEffect({
            enabled: false,
        });
        this._boxPointer.add_effect_with_name('dim', this._dimEffect);
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
        this._settings = ArcMenuManager.settings;
        this._extension = ArcMenuManager.extension;
        this._systemActions = SystemActions.getDefault();

        this.actor.add_style_class_name('panel-menu app-menu');
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();

        const menuItemsChangedId = this._settings.connect('changed::context-menu-items',
            () => this.populateMenuItems());

        this.populateMenuItems();
        this.connect('destroy', () => {
            this.disconnectPowerOptions();
            this._settings.disconnect(menuItemsChangedId);
        });
    }

    populateMenuItems() {
        this.disconnectPowerOptions();
        this.removeAll();

        const contextMenuShortcuts = this._settings.get_value('context-menu-items').deep_unpack();

        for (let i = 0; i < contextMenuShortcuts.length; i++) {
            const {name, id} = contextMenuShortcuts[i];

            if (id.endsWith('.desktop')) {
                this.addSettingsAction(name, id);
            } else if (id === Constants.ShortcutCommands.SEPARATOR) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if (id === Constants.ShortcutCommands.SETTINGS) {
                this.addAction(_('ArcMenu Settings'), () => this._extension.openPreferences());
            } else if (id.includes(Constants.ShortcutCommands.SETTINGS)) {
                const settingsPage = id.replace(Constants.ShortcutCommands.SETTINGS, '');
                if (settingsPage === 'About')
                    this.addArcMenuSettingsItem(name, Constants.SettingsPage.ABOUT);
                else if (settingsPage === 'Menu')
                    this.addArcMenuSettingsItem(name, Constants.SettingsPage.CUSTOMIZE_MENU);
                else if (settingsPage === 'Layout')
                    this.addArcMenuSettingsItem(name, Constants.SettingsPage.MENU_LAYOUT);
                else if (settingsPage === 'Button')
                    this.addArcMenuSettingsItem(name, Constants.SettingsPage.BUTTON_APPEARANCE);
                else if (settingsPage === 'Theme')
                    this.addArcMenuSettingsItem(name, Constants.SettingsPage.MENU_THEME);
            } else if (id === Constants.ShortcutCommands.OVERVIEW) {
                this.addAction(_('Activities Overview'), () => Main.overview.toggle());
            } else if (id === Constants.ShortcutCommands.POWER_OPTIONS) {
                this.addPowerOptionsMenuItem();
            } else if (id === Constants.ShortcutCommands.SHOW_DESKTOP) {
                this.addShowDekstopItem();
            } else if (id === Constants.ShortcutCommands.PANEL_EXTENSION_SETTINGS) {
                this.addExtensionSettings();
            }
        }
    }

    addArcMenuSettingsItem(title, prefsVisiblePage) {
        const item = new PopupMenu.PopupMenuItem(_(title));
        item.connect('activate', () => {
            this._settings.set_int('prefs-visible-page', prefsVisiblePage);
            this._extension.openPreferences();
        });
        this.addMenuItem(item);
    }

    disconnectPowerOptions() {
        if (this.canSuspendId)
            this._systemActions.disconnect(this.canSuspendId);
        if (this.canSwitchUserId)
            this._systemActions.disconnect(this.canSwitchUserId);

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
            () => this._systemActions.activateSuspend());
        suspendItem.visible = this._systemActions.canSuspend;
        powerOptionsItem.menu.addAction(_('Restart...'), () => this._systemActions.activateRestart());
        powerOptionsItem.menu.addAction(_('Power Off...'), () => this._systemActions.activatePowerOff());

        powerOptionsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        powerOptionsItem.menu.addAction(_('Lock'), () => this._systemActions.activateLockScreen());
        powerOptionsItem.menu.addAction(_('Log Out...'), () => this._systemActions.activateLogout());
        const switchUserItem = powerOptionsItem.menu.addAction(_('Switch User'),
            () => this._systemActions.activateSwitchUser());
        switchUserItem.visible = this._systemActions.canSwitchUser;

        this.canSuspendId = this._systemActions.connect('notify::can-suspend',
            () => (suspendItem.visible = this._systemActions.canSuspend));
        this.canSwitchUserId = this._systemActions.connect('notify::can-switch-user',
            () => (switchUserItem.visible = this._systemActions.canSwitchUser));

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

        if (dashToPanel?.state === Utils.ExtensionState.ACTIVE && global.dashToPanel) {
            const item = new PopupMenu.PopupMenuItem(_('Dash to Panel Settings'));
            item.connect('activate', () => Utils.openPrefs(Constants.DASH_TO_PANEL_UUID));
            this.addMenuItem(item);
        } else if (azTaskbar?.state === Utils.ExtensionState.ACTIVE && global.azTaskbar) {
            const item = new PopupMenu.PopupMenuItem(_('App Icons Taskbar Settings'));
            item.connect('activate', () => Utils.openPrefs(Constants.AZTASKBAR_UUID));
            this.addMenuItem(item);
        }
    }
};
