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

        this.set({
            x_expand: false,
        });

        this.add_style_class_name('arcmenu-panel-menu');

        // Link search providers to this menu
        this.searchProviderDisplayId = `ArcMenu_${monitorIndex}`;

        this._panel = panelInfo.panel;
        this._panelBox = panelInfo.panelBox;
        this._panelParent = panelInfo.panelParent;
        this._monitorIndex = monitorIndex;

        this.menu.destroy();
        this.menu = null;

        this._tooltipShowingID = null;
        this._tooltip = new MW.Tooltip(this);

        this._intellihideRelease = false;

        // Create Main Menus - ArcMenu and ArcMenu's context menu
        this.arcMenu = new ArcMenu(this, 0.5, St.Side.TOP);
        this.arcMenu.connectObject('open-state-changed', this._onOpenStateChanged.bind(this), this);

        this.arcMenuContextMenu = new ArcMenuContextMenu(this, 0.5, St.Side.TOP);
        this.arcMenuContextMenu.connectObject('open-state-changed', this._onOpenStateChanged.bind(this), this);

        this.menuManager = new PopupMenu.PopupMenuManager();
        this.menuManager._changeMenu = () => {};
        this.menuManager.addMenu(this.arcMenu);
        this.menuManager.addMenu(this.arcMenuContextMenu);

        // Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager();
        this.contextMenuManager._changeMenu = () => {};

        // Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager();
        this.subMenuManager._changeMenu = () => {};

        this.menuButtonWidget = new MenuButtonWidget();
        this.add_child(this.menuButtonWidget);
    }

    initiate() {
        this._dtp = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);

        if (this._dtp?.state === Utils.ExtensionState.ACTIVE && global.dashToPanel)
            this.syncWithDashToPanel();

        Main.layoutManager.connectObject('monitors-changed', () => this.updateHeight(), this);
        Main.layoutManager.connectObject('startup-complete', () => this.updateHeight(), this);

        this.setMenuPositionAlignment();
        this.createMenuLayout();
    }

    syncWithDashToPanel() {
        const dtp = Extension.lookupByUUID(Constants.DASH_TO_PANEL_UUID);
        this._dtpSettings = dtp.getSettings('org.gnome.shell.extensions.dash-to-panel');
        this._dtpActive = true;

        const side = this._panelParent.getPosition();
        this.updateArrowSide(side);

        this._dtpSettings.connectObject('changed::panel-positions', () => {
            const newSide = this._panelParent.getPosition();
            this.updateArrowSide(newSide);
        }, this);
    }

    createMenuLayout() {
        this.clearTooltipShowingId();
        this.hideTooltip(true);

        this._destroyMenuLayout();

        const layout = ArcMenuManager.settings.get_enum('menu-layout');

        this._menuLayout = LayoutHandler.createMenuLayout(this, layout);

        if (this._menuLayout) {
            this.arcMenu.box.add_child(this._menuLayout);
            this.setMenuPositionAlignment();
            this.forceMenuLocation();
            this.updateHeight();
        }
    }

    setMenuPositionAlignment() {
        const layout = ArcMenuManager.settings.get_enum('menu-layout');
        const arrowAlignment = 1 - (ArcMenuManager.settings.get_int('menu-position-alignment') / 100);
        const panelPosition = ArcMenuManager.settings.get_enum('position-in-panel');

        if (layout !== Constants.MenuLayout.RUNNER) {
            if (panelPosition === Constants.MenuPosition.CENTER) {
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment;
                this.arcMenu._arrowAlignment = arrowAlignment;
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
                this.arcMenu._boxPointer.setSourceAlignment(.5);
            } else if (this._dtpActive) {
                const side = this._panelParent.getPosition();
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
            menu._boxPointer.setSourceAlignment(arrowAlignment);
            menu._arrowAlignment = arrowAlignment;
            menu._boxPointer._border.queue_repaint();
        }

        if (setAlignment)
            this.setMenuPositionAlignment();
    }

    _getDashToPanelGeom() {
        if (!this._dtpActive || !this._panelParent.intellihide?.enabled)
            return {width: 0, height: 0};

        const dtpPostion = this._panelParent.getPosition();
        const menuLocation = ArcMenuManager.settings.get_enum('force-menu-location');

        const width = this._panelParent.geom?.w ?? 0;
        const height = this._panelParent.geom?.h ?? 0;

        const {MenuLocation} = Constants;
        const topLocations = [MenuLocation.TOP_CENTERED, MenuLocation.TOP_LEFT, MenuLocation.TOP_RIGHT];
        const bottomLocations = [MenuLocation.BOTTOM_CENTERED, MenuLocation.BOTTOM_LEFT, MenuLocation.BOTTOM_RIGHT];
        const leftLocations = [MenuLocation.BOTTOM_LEFT, MenuLocation.TOP_LEFT, MenuLocation.LEFT_CENTERED];
        const rightLocations = [MenuLocation.BOTTOM_RIGHT, MenuLocation.TOP_RIGHT, MenuLocation.RIGHT_CENTERED];
        const xCenterLocations = [MenuLocation.BOTTOM_CENTERED, MenuLocation.TOP_CENTERED];
        const yCenterLocations = [MenuLocation.LEFT_CENTERED, MenuLocation.RIGHT_CENTERED];

        const needsTopAdjustment = topLocations.includes(menuLocation) || yCenterLocations.includes(menuLocation);
        const needsBottomAdjustment = bottomLocations.includes(menuLocation) || yCenterLocations.includes(menuLocation);
        const needsLeftAdjustment = leftLocations.includes(menuLocation) || xCenterLocations.includes(menuLocation);
        const needsRightAdjustment = rightLocations.includes(menuLocation) || xCenterLocations.includes(menuLocation);

        if (dtpPostion === St.Side.TOP && needsTopAdjustment)
            return {width: 0, height};
        if (dtpPostion === St.Side.BOTTOM && needsBottomAdjustment)
            return {width: 0, height};
        if (dtpPostion === St.Side.LEFT && needsLeftAdjustment)
            return {width, height: 0};
        if (dtpPostion === St.Side.RIGHT && needsRightAdjustment)
            return {width, height: 0};

        return {width: 0, height: 0};
    }

    forceMenuLocation() {
        const layout = ArcMenuManager.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER ||
            layout === Constants.MenuLayout.RAVEN ||
            layout === Constants.MenuLayout.GNOME_OVERVIEW)
            return;

        this.arcMenu.actor.remove_style_class_name('bottomOfScreenMenu');

        const newMenuLocation = ArcMenuManager.settings.get_enum('force-menu-location');
        if (this._menuLocation !== newMenuLocation) {
            this._menuLocation = newMenuLocation;

            if (newMenuLocation === Constants.MenuLocation.OFF) {
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

        if (newMenuLocation === Constants.MenuLocation.OFF)
            return;

        const monitor = Main.layoutManager.findMonitorForActor(this);
        const workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
        const menuHeight = ArcMenuManager.settings.get_int('menu-height');

        // Offset width and height of DtP when intellihide is enabled.
        const {width: dtpWidth, height: dtpHeight} = this._getDashToPanelGeom();

        const xLeft = workArea.x + dtpWidth;
        const xRight = workArea.x + workArea.width - 1 - dtpWidth;
        const yTop = workArea.y + dtpHeight;
        const yBottom = workArea.y + workArea.height - 1 - dtpHeight;
        const xCentered = Math.round(monitor.x + (monitor.width / 2));
        const yCentered = Math.round(monitor.y + (monitor.height / 2) - (menuHeight / 2));
        let x, y;
        let side = St.Side.TOP;

        if (newMenuLocation === Constants.MenuLocation.TOP_CENTERED) {
            x = xCentered;
            y = yTop;
        } else if (newMenuLocation === Constants.MenuLocation.TOP_LEFT) {
            side = St.Side.LEFT;
            x = xLeft;
            y = yTop;
        } else if (newMenuLocation === Constants.MenuLocation.TOP_RIGHT) {
            side = St.Side.RIGHT;
            x = xRight;
            y = yTop;
        } else if (newMenuLocation === Constants.MenuLocation.BOTTOM_CENTERED) {
            x = xCentered;
            y = yBottom;
            this.arcMenu.actor.add_style_class_name('bottomOfScreenMenu');
        }  else if (newMenuLocation === Constants.MenuLocation.BOTTOM_LEFT) {
            side = St.Side.LEFT;
            x = xLeft;
            y = yBottom;
            this.arcMenu.actor.add_style_class_name('bottomOfScreenMenu');
        } else if (newMenuLocation === Constants.MenuLocation.BOTTOM_RIGHT) {
            side = St.Side.RIGHT;
            x = xRight;
            y = yBottom;
            this.arcMenu.actor.add_style_class_name('bottomOfScreenMenu');
        } else if (newMenuLocation === Constants.MenuLocation.LEFT_CENTERED) {
            x = xLeft;
            y = yCentered;
        } else if (newMenuLocation === Constants.MenuLocation.RIGHT_CENTERED) {
            x = xRight;
            y = yCentered;
        } else if (newMenuLocation === Constants.MenuLocation.MONITOR_CENTERED) {
            x = xCentered;
            y = yCentered;
        }

        this.updateArrowSide(side, false);
        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
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
            return ArcMenuManager.settings.get_enum('menu-button-left-click-action');
        else if (button === Clutter.BUTTON_SECONDARY)
            return ArcMenuManager.settings.get_enum('menu-button-right-click-action');
        else if (button === Clutter.BUTTON_MIDDLE)
            return ArcMenuManager.settings.get_enum('menu-button-middle-click-action');
        else
            return -1;
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

    closeContextMenu() {
        if (this.arcMenuContextMenu.isOpen)
            this.arcMenuContextMenu.toggle();
    }

    toggleMenu() {
        this._closeOtherMenus();

        const layout = ArcMenuManager.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.GNOME_OVERVIEW) {
            if (ArcMenuManager.settings.get_boolean('gnome-dash-show-applications'))
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

        if (this.arcMenu.isOpen) {
            this._menuLayout?.grab_key_focus();
            this.forceMenuLocation();
        }
    }

    updateHeight() {
        if (!this._menuLayout)
            return;

        const layout = ArcMenuManager.settings.get_enum('menu-layout');
        if (layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN) {
            this._menuLayout.style = '';
            return;
        }

        const height = ArcMenuManager.settings.get_int('menu-height');
        this._menuLayout.style = `height: ${height}px;`;
    }

    updateWidth() {
        if (this._menuLayout?.updateWidth)
            this._menuLayout.updateWidth(true);
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

    _onDestroy() {
        this._stopTrackingMouse();
        Main.layoutManager.disconnectObject(this);
        this.clearTooltipShowingId();

        if (this._dtpSettings) {
            this._dtpSettings.disconnectObject(this);
            this._dtpSettings = null;
        }

        if (this.dtp)
            this.dtp = null;

        this._destroyMenuLayout();

        this._tooltip?.destroy();
        this._tooltip = null;
        this.arcMenu?.destroy();
        this.arcMenu = null;
        this.arcMenuContextMenu?.destroy();
        this.arcMenuContextMenu = null;

        this.menuManager = null;
        this.contextMenuManager = null;
        this.subMenuManager = null;

        this.menuButtonWidget.destroy();
        this.menuButtonWidget = null;

        this._panel.statusArea['ArcMenu'] = null;
        this._panel = null;
        this._panelBox = null;
        this._panelParent = null;

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

            if (!this._intellihideRelease && this._panelParent.intellihide?.enabled)
                this._intellihideRelease = true;
        } else {
            if (!this.arcMenu.isOpen) {
                this.clearTooltipShowingId();
                this.hideTooltip(true);
            }

            if (!this.arcMenu.isOpen && !this.arcMenuContextMenu.isOpen) {
                this.menuButtonWidget.removeStylePseudoClass('active');
                this.remove_style_pseudo_class('active');

                if (this._intellihideRelease && !this._panelNeedsHiding) {
                    this._intellihideRelease = false;
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
        return this._panelHasMousePointer(x, y);
    }

    _panelChildHasGrab() {
        const grabActor = global.stage.get_grab_actor();
        if (!grabActor)
            return false;

        const statusArea = this._panelParent.statusArea ?? this._panel.statusArea;
        const quickSettingsMenu = statusArea?.quickSettings?.menu.actor;

        const sourceActor = grabActor._sourceActor || grabActor;

        return this._panelParent.contains(sourceActor) || quickSettingsMenu?.contains(sourceActor);
    }

    _panelHasMousePointer(x, y) {
        const panelBoxRect = this._panelBox.get_transformed_extents();
        const cursorLocation = new Graphene.Point({x, y});

        return panelBoxRect.contains_point(cursorLocation);
    }

    _startTrackingMouse(callback) {
        if (this._pointerWatch)
            return;

        this._pointerWatch = PointerWatcher.getPointerWatcher().addWatch(500, (pX, pY) => {
            const panelChildHasGrab = this._panelChildHasGrab();
            if (!this._panelHasMousePointer(pX, pY) && !panelChildHasGrab) {
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
            this._menuButton?.setDefaultMenuView();
        }
        super.open(animate);
    }

    close(animate) {
        this._menuButton?.onArcMenuClose();

        super.close(animate);
    }

    destroy() {
        this._boxPointer.remove_effect_by_name('dim');
        super.destroy();
        this._dimEffect = null;
        this._menuButton = null;
    }
};

var ArcMenuContextMenu = class ArcMenuArcMenuContextMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._systemActions = SystemActions.getDefault();

        this.actor.add_style_class_name('panel-menu app-menu');
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();

        ArcMenuManager.settings.connectObject('changed::context-menu-items',
            () => this.populateMenuItems(), this);

        this.populateMenuItems();
    }

    destroy() {
        this.disconnectPowerOptions();
        ArcMenuManager.settings.disconnectObject(this);

        this._systemActions = null;
        super.destroy();
    }

    populateMenuItems() {
        this.disconnectPowerOptions();
        this.removeAll();

        const contextMenuShortcuts = ArcMenuManager.settings.get_value('context-menu-items').deep_unpack();

        for (let i = 0; i < contextMenuShortcuts.length; i++) {
            const {name, id} = contextMenuShortcuts[i];

            if (id.endsWith('.desktop')) {
                this.addSettingsAction(name, id);
            } else if (id === Constants.ShortcutCommands.SEPARATOR) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if (id === Constants.ShortcutCommands.SETTINGS) {
                this.addAction(_('ArcMenu Settings'), () => ArcMenuManager.extension.openPreferences());
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
            ArcMenuManager.settings.set_int('prefs-visible-page', prefsVisiblePage);
            ArcMenuManager.extension.openPreferences();
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
        const powerOptionsItem = new PopupMenu.PopupSubMenuMenuItem(_('Power Off'));

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
