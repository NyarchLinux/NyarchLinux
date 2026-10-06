import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import * as LayoutHandler from './menulayouts/layoutHandler.js';
import * as MW from './menuWidgets.js';
import * as Utils from './utils.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

async function getPointerWatcher() {
    if (ShellVersion < 51) {
        const PointerWatcher = await import('resource:///org/gnome/shell/ui/pointerWatcher.js');
        return PointerWatcher;
    }
    return null;
};
const PointerWatcher = await getPointerWatcher();

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
    _init(monitor, panelInfo) {
        super._init(0.5, null, true);

        this.set({
            x_expand: false,
        });

        this.add_style_class_name('arcmenu-panel-menu');

        // Link search providers to this menu
        this.searchProviderDisplayId = `ArcMenu_${panelInfo.index}`;

        this._monitor = monitor;
        this._panel = panelInfo.panel;
        this._panelBox = panelInfo.panelBox;
        this._panelParent = panelInfo.panelParent;
        this._isPrimaryStandalone = panelInfo.isPrimaryStandalone;

        this.menu.destroy();
        this.menu = null;

        this._tooltipShowingID = null;
        this._tooltip = new MW.Tooltip(this);

        this._intellihideRelease = false;

        // A dummy widget used as the sourceActor of ArcMenu when 'force-menu-location' setting is enabled.
        this._dummyWidget = new St.Widget({width: 0, height: 0, opacity: 0, name: `ArcMenu_${panelInfo.index}`});
        Main.uiGroup.add_child(this._dummyWidget);

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

    get monitor() {
        return this._monitor;
    }

    get isOpen() {
        return this.arcMenu?.isOpen;
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
        // The menuButton is placed in the main panel - skip
        if (this._isPrimaryStandalone)
            return;

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

        const loadingPlaceholder = this._createLoadingPlaceholder();
        this.arcMenu.box.add_child(loadingPlaceholder);

        const layout = ArcMenuManager.settings.get_string('menu-layout');
        this._menuLayout = LayoutHandler.createMenuLayout(this, layout);

        loadingPlaceholder.destroy();
        if (this._menuLayout) {
            this.arcMenu.box.add_child(this._menuLayout);
            this.setMenuPositionAlignment();
            this.forceMenuLocation();
            this.updateHeight();

            // If ArcMenu is open while the new layout is loading,
            // the new layout needs these updated.
            if (this.arcMenu.isOpen) {
                this._menuLayout.updateLocation?.();
                this._menuLayout.updateStyle?.();
                this._menuLayout.grab_key_focus();
            }
        }
    }

    _createLoadingPlaceholder() {
        const boxLayout = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            style: 'spacing: 15px; padding: 35px 15px;',
        });
        const label = new St.Label({
            text: _('Loading Menu Layout...'),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: 14pt;',
        });
        boxLayout.add_child(label);
        return boxLayout;
    }

    setMenuPositionAlignment() {
        const layout = ArcMenuManager.settings.get_string('menu-layout');
        const arrowAlignment = 1 - (ArcMenuManager.settings.get_int('menu-position-alignment') / 100);
        const panelPosition = ArcMenuManager.settings.get_enum('position-in-panel');

        if (layout !== 'runner') {
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
        const layout = ArcMenuManager.settings.get_string('menu-layout');
        if (layout === 'runner' || layout === 'raven' || layout === 'gnome-overview')
            return;

        const menuLocation = ArcMenuManager.settings.get_enum('force-menu-location');

        const menuLocationChanged = this._menuLocation !== menuLocation;
        if (menuLocationChanged) {
            this._menuLocation = menuLocation;

            switch (menuLocation) {
            case Constants.MenuLocation.BOTTOM_CENTERED:
            case Constants.MenuLocation.BOTTOM_LEFT:
            case Constants.MenuLocation.BOTTOM_RIGHT:
                this.arcMenu.actor.add_style_class_name('arcmenu-menu-location-bottom');
                break;
            default:
                this.arcMenu.actor.remove_style_class_name('arcmenu-menu-location-bottom');
                break;
            }

            if (menuLocation === Constants.MenuLocation.OFF) {
                this.arcMenu.sourceActor = this.arcMenu.focusActor = this;
                this.arcMenu._boxPointer.setPosition(this, 0.5);
                this.setMenuPositionAlignment();
                return;
            }

            this.arcMenu.sourceActor = this.arcMenu.focusActor = this._dummyWidget;
            this.arcMenu._boxPointer.setPosition(this._dummyWidget, 0.5);
            this.arcMenu._boxPointer.setSourceAlignment(0.5);
            this.arcMenu._arrowAlignment = 0.5;
        }

        if (menuLocation === Constants.MenuLocation.OFF)
            return;

        const workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitor.index);
        const menuHeight = ArcMenuManager.settings.get_int('menu-height');

        // Offset width and height of DtP when intellihide is enabled.
        const {width: dtpWidth, height: dtpHeight} = this._getDashToPanelGeom();

        const xLeft = workArea.x + dtpWidth;
        const xRight = workArea.x + workArea.width - 1 - dtpWidth;
        const yTop = workArea.y + dtpHeight;
        const yBottom = workArea.y + workArea.height - 1 - dtpHeight;
        const xCentered = Math.round(this._monitor.x + (this._monitor.width / 2));
        const yCentered = Math.round(this._monitor.y + (this._monitor.height / 2) - (menuHeight / 2));
        let x, y;
        let side = St.Side.TOP;

        switch (menuLocation) {
        case Constants.MenuLocation.TOP_CENTERED:
            x = xCentered;
            y = yTop;
            break;
        case Constants.MenuLocation.TOP_LEFT:
            side = St.Side.LEFT;
            x = xLeft;
            y = yTop;
            break;
        case Constants.MenuLocation.TOP_RIGHT:
            side = St.Side.RIGHT;
            x = xRight;
            y = yTop;
            break;
        case Constants.MenuLocation.BOTTOM_CENTERED:
            x = xCentered;
            y = yBottom;
            break;
        case Constants.MenuLocation.BOTTOM_LEFT:
            side = St.Side.LEFT;
            x = xLeft;
            y = yBottom;
            break;
        case Constants.MenuLocation.BOTTOM_RIGHT:
            side = St.Side.RIGHT;
            x = xRight;
            y = yBottom;
            break;
        case Constants.MenuLocation.LEFT_CENTERED:
            x = xLeft;
            y = yCentered;
            break;
        case Constants.MenuLocation.RIGHT_CENTERED:
            x = xRight;
            y = yCentered;
            break;
        case Constants.MenuLocation.MONITOR_CENTERED:
            x = xCentered;
            y = yCentered;
            break;
        default:
            x = xCentered;
            y = yTop;
            break;
        }

        if (menuLocationChanged)
            this.updateArrowSide(side, false);

        this._dummyWidget.set_position(Math.round(x), Math.round(y));
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

        const layout = ArcMenuManager.settings.get_string('menu-layout');
        if (layout === 'gnome-overview') {
            if (ArcMenuManager.settings.get_boolean('gnome-dash-show-applications'))
                Main.overview._overview._controls._toggleAppsPage();
            else
                Main.overview.toggle();
            return;
        }

        if (!this.arcMenu.isOpen) {
            this._menuLayout.updateLocation?.();
            this._menuLayout.updateStyle?.();
            this._maybeShowPanel();
            this.forceMenuLocation();
        }

        this.arcMenu.toggle();

        if (this.arcMenu.isOpen)
            this._menuLayout?.grab_key_focus();
    }

    updateHeight() {
        if (!this._menuLayout)
            return;

        const layout = ArcMenuManager.settings.get_string('menu-layout');
        if (layout === 'runner' || layout === 'raven') {
            this._menuLayout.style = '';
            return;
        }

        const height = ArcMenuManager.settings.get_int('menu-height');
        this._menuLayout.style = `height: ${height}px;`;
    }

    updateWidth() {
        if (!this._menuLayout)
            return;

        this._menuLayout.updateWidth?.(true);
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
        this._tooltip?.hide(instant);
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
        this._dummyWidget.destroy();
        this._dummyWidget = null;

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
        this._menuLayout?.updateLocation?.();
    }

    getActiveCategoryType() {
        return this._menuLayout?.activeCategoryType;
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

    _onOpenStateChanged(menu, open) {
        const isArcMenu = menu === this.arcMenu;
        if (open) {
            this.menuButtonWidget.addStylePseudoClass('active');
            this.add_style_pseudo_class('active');

            const closeOverview = ArcMenuManager.settings.get_boolean('hide-overview-on-arcmenu-open');
            if (isArcMenu && closeOverview)
                Main.overview.hide();

            Main.panel.menuManager?.activeMenu?.toggle();

            if (!this._intellihideRelease && this._panelParent.intellihide?.enabled)
                this._intellihideRelease = true;
        } else {
            if (isArcMenu) {
                this.clearTooltipShowingId();
                this.hideTooltip(true);
            }

            if (this.arcMenu.isOpen || this.arcMenuContextMenu.isOpen)
                return;

            this.menuButtonWidget.removeStylePseudoClass('active');
            this.remove_style_pseudo_class('active');

            if (this._intellihideRelease && !this._panelNeedsHiding) {
                this._intellihideRelease = false;
                const hidePanel = () => this._panelParent.intellihide?.release(1);
                this._maybeHidePanel(hidePanel);
            }
            if (this._panelNeedsHiding) {
                this._panelNeedsHiding = false;
                // Hide panel if monitor inFullscreen, else show it
                const hidePanel = () => {
                    this._panelBox.visible = !(global.window_group.visible && this._monitor?.inFullscreen);
                };
                this._maybeHidePanel(hidePanel);
            }
        }
    }

    _maybeHidePanel(callback) {
        const isMouseOnPanel = this._isMouseOnPanel();
        if (isMouseOnPanel)
            this._startTrackingMouse(callback);
        else
            callback();
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
        if (this._panelBox.appIconsTaskbar?.menuManager?.activeMenu)
            return true;

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
        if (this._cursorTrackerId)
            return;

        const onPointerWatch = (x, y) => {
            const panelChildHasGrab = this._panelChildHasGrab();
            if (!this._panelHasMousePointer(x, y) && !panelChildHasGrab) {
                callback();
                this._stopTrackingMouse();
            }
        };

        if (ShellVersion >= 51) {
            const cursorTracker = global.backend.get_cursor_tracker();
            this._cursorTrackerId = cursorTracker.connect('position-invalidated', () => {
                const [coords] = cursorTracker.get_pointer();
                onPointerWatch(coords.x, coords.y);
            });
        } else {
            this._cursorTrackerId = PointerWatcher.getPointerWatcher().addWatch(500, (x, y) => {
                onPointerWatch(x, y);
            });
        }
    }

    _stopTrackingMouse() {
        if (!this._cursorTrackerId)
            return;

        if (ShellVersion >= 51) {
            const cursorTracker = global.backend.get_cursor_tracker();
            cursorTracker.disconnect(this._cursorTrackerId);
            this._cursorTrackerId = null;
        } else {
            PointerWatcher.getPointerWatcher()._removeWatch(this._cursorTrackerId);
            this._cursorTrackerId = null;
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

        if (ShellVersion < 51)
            this.actor.connectObject('captured-event', this._onCapturedEvent.bind(this), this);

        this.dimEffect = new Clutter.BrightnessContrastEffect({
            enabled: false,
        });
        this._boxPointer.add_effect_with_name('dim', this.dimEffect);
    }

    _onCapturedEvent(actor, event) {
        if (Main.keyboard.maybeHandleEvent(event))
            return Clutter.EVENT_STOP;

        return Clutter.EVENT_PROPAGATE;
    }

    setDimmed(dim) {
        const DIM_BRIGHTNESS = -0.4;
        const ANIMATION_TIME = 150;

        const val = 127 * (1 + (dim ? 1 : 0) * DIM_BRIGHTNESS);
        const colorValues = {
            red: val,
            green: val,
            blue: val,
            alpha: 255,
        };
        const color = Clutter.Color ? new Clutter.Color(colorValues) : new Cogl.Color(colorValues);

        this._boxPointer.ease_property('@effects.dim.brightness', color, {
            mode: Clutter.AnimationMode.LINEAR,
            duration: ANIMATION_TIME,
            onStopped: () => {
                this.dimEffect.enabled = dim;
            },
        });
        this.dimEffect.enabled = true;
    }

    open(animate) {
        if (!this.isOpen) {
            if (ShellVersion < 51) {
                this._menuButton.arcMenu.actor._muteInput = false;
                this._menuButton.arcMenu.actor._muteKeys = false;
            } else {
                this._menuButton.arcMenu.actor._muteInput.enabled = false;
                this._menuButton.arcMenu.actor._muteKeys.enabled = false;
            }

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
        this.dimEffect = null;
        this._menuButton = null;
    }
};

const ArcMenuContextMenu = class ArcMenuArcMenuContextMenu extends PopupMenu.PopupMenu {
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
