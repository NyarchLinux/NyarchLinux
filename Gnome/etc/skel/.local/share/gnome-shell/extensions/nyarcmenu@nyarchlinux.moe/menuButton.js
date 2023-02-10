const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, GObject, Shell, St} = imports.gi;
const Constants = Me.imports.constants;
const { ExtensionState } = ExtensionUtils;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const SystemActions = imports.misc.systemActions;
const Util = imports.misc.util;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var MenuButton = GObject.registerClass(class ArcMenu_MenuButton extends PanelMenu.Button{
    _init(settings, panel) {
        super._init(0.5, null, true);
        this._settings = settings;
        this._panel = panel;
        this.menu.destroy();
        this.menu = null;
        this.add_style_class_name('arcmenu-panel-menu');
        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);
        this.dtpNeedsRelease = false;

        //Create Main Menus - ArcMenu and ArcMenu's context menu
        this.arcMenu = new ArcMenu(this, 0.5, St.Side.TOP);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.arcMenuContextMenu = new ArcMenuContextMenu(this, 0.5, St.Side.TOP);
        this.arcMenuContextMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(this._panel);
        this.menuManager._changeMenu = (menu) => {};
        this.menuManager.addMenu(this.arcMenu);
        this.menuManager.addMenu(this.arcMenuContextMenu);

        //Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this);
        this.contextMenuManager._changeMenu = (menu) => {};
        this.contextMenuManager._onMenuSourceEnter = (menu) =>{
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu != menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        }

        //Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this);
        this.subMenuManager._changeMenu = (menu) => {};

        this.menuButtonWidget = new MW.MenuButtonWidget();
        this.x_expand = false;
        this.y_expand = false;

        this.add_child(this.menuButtonWidget);
    }

    initiate(){
        this.dashToPanel = Main.extensionManager.lookup(Constants.DASH_TO_PANEL_UUID);
        this.azTaskbar = Main.extensionManager.lookup(Constants.AZTASKBAR_UUID);

        if(this.dashToPanel?.state === ExtensionState.ENABLED && global.dashToPanel)
            this.syncWithDashToPanel();

        if(this.azTaskbar?.state === ExtensionState.ENABLED && global.azTaskbar)
            this.syncWithAzTaskbar();

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () =>
            this.updateHeight());

        this._startupCompleteId = Main.layoutManager.connect('startup-complete', () => 
            this.updateHeight());

        this.setMenuPositionAlignment();

        this.clearMenuLayoutTimeouts();
        this.createLayoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.createMenuLayout();
            this.createLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    syncWithAzTaskbar(){
        this.arcMenuContextMenu.addExtensionSettings(_('App Icons Taskbar Settings'), Constants.AZTASKBAR_UUID);
    }

    syncWithDashToPanel(){
        this.arcMenuContextMenu.addExtensionSettings(_('Dash to Panel Settings'), Constants.DASH_TO_PANEL_UUID);

        let monitorIndex = Main.layoutManager.findIndexForActor(this);
        let side = Utils.getDashToPanelPosition(this.dashToPanel.settings, monitorIndex);
        this.updateArrowSide(side);

        this.dtpPostionChangedID = this.dashToPanel.settings.connect('changed::panel-positions', () => {
            let monitorIndex = Main.layoutManager.findIndexForActor(this);
            let side = Utils.getDashToPanelPosition(this.dashToPanel.settings, monitorIndex);
            this.updateArrowSide(side);
        });

        //Find the associated Dash to Panel panel.
        //Needed to show/hide DtP if intellihide is on
        global.dashToPanel.panels.forEach(p => {
            if(p.panel === this._panel){
                this.dtpPanel = p;
            }
        });
    }

    createMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._menuInForcedLocation = false;
        this.arcMenu.removeAll();
        this.section = new PopupMenu.PopupMenuSection();
        this.arcMenu.addMenuItem(this.section);
        this.mainBox = new St.BoxLayout({
            reactive: true,
            vertical: false,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });
        this.mainBox._delegate = this.mainBox;
        this.section.actor.add_child(this.mainBox);

        this.MenuLayout = Utils.getMenuLayout(this, this._settings.get_enum('menu-layout'));
        this.setMenuPositionAlignment();
        this.forceMenuLocation();
        this.updateHeight();
    }

    reloadMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._menuInForcedLocation = false;

        this.MenuLayout.destroy();
        this.MenuLayout = null;
        this.MenuLayout = Utils.getMenuLayout(this, this._settings.get_enum('menu-layout'));

        this.setMenuPositionAlignment();
        this.forceMenuLocation();
        this.updateHeight();
    }

    setMenuPositionAlignment(){
        let layout = this._settings.get_enum('menu-layout');

        let arrowAlignment = 1 - (this._settings.get_int('menu-position-alignment') / 100);
        if(layout !== Constants.MenuLayout.RUNNER){
            if(this._settings.get_enum('position-in-panel') == Constants.MenuPosition.CENTER){
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment
                this.arcMenu._arrowAlignment = arrowAlignment
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
                this.arcMenu._boxPointer.setSourceAlignment(.5);
            }
            else if(this.dashToPanel?.state === ExtensionState.ENABLED){
                let monitorIndex = Main.layoutManager.findIndexForActor(this);
                let side = Utils.getDashToPanelPosition(this.dashToPanel.settings, monitorIndex);
                this.updateArrowSide(side, false);
            }
            else{
                this.updateArrowSide(St.Side.TOP, false);
            }
        }
        else{
            this.updateArrowSide(St.Side.TOP, false);
            if(this._settings.get_enum('position-in-panel') == Constants.MenuPosition.CENTER){
                this.arcMenuContextMenu._arrowAlignment = arrowAlignment
                this.arcMenuContextMenu._boxPointer.setSourceAlignment(.5);
            }
        }
    }

    updateArrowSide(side, setAlignment = true){
        let arrowAlignment;
        if(side === St.Side.RIGHT || side === St.Side.LEFT)
            arrowAlignment = 1.0;
        else
            arrowAlignment = 0.5;

        let menus = [this.arcMenu, this.arcMenuContextMenu];
        for(let menu of menus){
            menu._arrowSide = side;
            menu._boxPointer._arrowSide = side;
            menu._boxPointer._userArrowSide = side;
            menu._boxPointer.setSourceAlignment(0.5);
            menu._arrowAlignment = arrowAlignment;
            menu._boxPointer._border.queue_repaint();
        }

        if(setAlignment)
            this.setMenuPositionAlignment();
    }

    forceMenuLocation(){
        let layout = this._settings.get_enum('menu-layout');
        let forcedMenuLocation = this._settings.get_enum('force-menu-location');
        if(layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN)
            return;

        if(forcedMenuLocation === Constants.ForcedMenuLocation.OFF){
            if(!this._menuInForcedLocation)
                return;
            this.arcMenu.sourceActor = this;
            this.arcMenu.focusActor = this;
            this.arcMenu._boxPointer.setPosition(this, 0.5);
            this.setMenuPositionAlignment();
            this._menuInForcedLocation = false;
            return;
        }

        if(!this.dummyWidget){
            this.dummyWidget = new St.Widget({ width: 0, height: 0, opacity: 0 });
            Main.uiGroup.add_child(this.dummyWidget);
        }

        if(!this._menuInForcedLocation){
            this.arcMenu.sourceActor = this.dummyWidget;
            this.arcMenu.focusActor = this.dummyWidget;
            this.arcMenu._boxPointer.setPosition(this.dummyWidget, 0.5);
            this.arcMenu._boxPointer.setSourceAlignment(0.5);
            this.arcMenu._arrowAlignment = 0.5;
            this._menuInForcedLocation = true;
        }

        let monitorIndex = Main.layoutManager.findIndexForActor(this);
        let rect = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

        //Position the runner menu in the center of the current monitor, at top of screen.
        let positionX = Math.round(rect.x + (rect.width / 2));
        let positionY;
        if(forcedMenuLocation === Constants.ForcedMenuLocation.TOP_CENTERED){
            this.updateArrowSide(St.Side.TOP);
            positionY = rect.y;
        }

        else if(forcedMenuLocation === Constants.ForcedMenuLocation.BOTTOM_CENTERED){
            this.updateArrowSide(St.Side.BOTTOM);
            positionY = rect.y + rect.height;
        }

        this.dummyWidget.set_position(positionX, positionY);
    }

    vfunc_event(event){
        if (event.type() === Clutter.EventType.BUTTON_PRESS){
            if(event.get_button() === Clutter.BUTTON_PRIMARY || event.get_button() === Clutter.BUTTON_MIDDLE)
                this.toggleMenu();
            else if(event.get_button() === Clutter.BUTTON_SECONDARY)
                this.arcMenuContextMenu.toggle();
        }
        else if(event.type() === Clutter.EventType.TOUCH_BEGIN){
            this.toggleMenu();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    toggleMenu(){
        if(this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if(this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();

        this.forceMenuLocation();
        let layout = this._settings.get_enum('menu-layout');
        if(layout === Constants.MenuLayout.GNOME_OVERVIEW){
            if(this._settings.get_boolean('gnome-dash-show-applications'))
                Main.overview._overview._controls._toggleAppsPage();
            else
                Main.overview.toggle();
        }
        else if(!this.arcMenu.isOpen){
            if(layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN)
                this.MenuLayout.updateLocation();

            if(this.MenuLayout?.updateStyle)
                this.MenuLayout.updateStyle();

            if(this.dtpPanel){
                if(this.dtpPanel.intellihide?.enabled){
                    this.dtpPanel.intellihide._revealPanel(true);
                    this.dtpPanel.intellihide.revealAndHold(1);
                }
                else if(!this.dtpPanel.panelBox.visible){
                    this.dtpPanel.panelBox.visible = true;
                    this.dtpNeedsHiding = true;
                }
            }
            else if(this._panel === Main.panel && !Main.layoutManager.panelBox.visible){
                Main.layoutManager.panelBox.visible = true;
                this.mainPanelNeedsHiding = true;
            }

            this.arcMenu.toggle();
            if(this.arcMenu.isOpen && this.MenuLayout)
                this.mainBox.grab_key_focus();
        }
        else if(this.arcMenu.isOpen)
            this.arcMenu.toggle();
    }

    toggleArcMenuContextMenu(){
        if(this.arcMenuContextMenu.isOpen)
            this.arcMenuContextMenu.toggle();
    }

    updateHeight(){
        if(!this.MenuLayout)
            return;

        let layout = this._settings.get_enum('menu-layout');
        let height = this._settings.get_int('menu-height');

        if(layout === Constants.MenuLayout.RUNNER || layout === Constants.MenuLayout.RAVEN){
            this.arcMenu.actor.style = '';
            return;
        }

        this.arcMenu.actor.style = `height: ${height}px;`;
    }

    updateWidth(){
        if(this.MenuLayout?.updateWidth)
            this.MenuLayout.updateWidth(true);
    }

    _onDestroy(){
        if(this._monitorsChangedId){
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if(this._startupCompleteId){
            Main.layoutManager.disconnect(this._startupCompleteId);
            this._startupCompleteId = null;
        }

        this.clearMenuLayoutTimeouts();

        if(this.tooltipShowingID){
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }
        if(this.dtpPostionChangedID && this.dashToPanel.settings){
            this.dashToPanel.settings.disconnect(this.dtpPostionChangedID);
            this.dtpPostionChangedID = null;
        }

        this.tooltip?.destroy();
        this.MenuLayout?.destroy();
        this.arcMenu?.destroy();
        this.arcMenuContextMenu?.destroy();
        this.dummyWidget?.destroy();

        super._onDestroy();
    }

    clearMenuLayoutTimeouts(){
        if(this.createLayoutID){
            GLib.source_remove(this.createLayoutID);
            this.createLayoutID = null;
        }
        if(this.updateMenuLayoutID){
            GLib.source_remove(this.updateMenuLayoutID);
            this.updateMenuLayoutID = null;
        }
    }

    updateMenuLayout(){
        this.clearMenuLayoutTimeouts();

        this.tooltipShowing = false;
        if (this.tooltipShowingID) {
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }
        if(this.MenuLayout){
            this.MenuLayout.destroy();
            this.MenuLayout = null;
        }
        this.updateMenuLayoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.createMenuLayout();
            this.updateMenuLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    loadExtraPinnedApps(){
        this.MenuLayout?.loadExtraPinnedApps();
    }

    updateLocation(){
        if(this.MenuLayout && this.MenuLayout.updateLocation)
            this.MenuLayout.updateLocation();
    }

    displayPinnedApps(){
        this.MenuLayout?.displayPinnedApps();
    }

    loadPinnedApps(){
        this.MenuLayout?.loadPinnedApps();
    }

    reload(){
        if(this.MenuLayout)
            this.reloadMenuLayout();
    }

    shouldLoadPinnedApps(){
        if(this.MenuLayout)
            return this.MenuLayout.shouldLoadPinnedApps;
    }

    setDefaultMenuView(){
        if(!this.MenuLayout)
            return;

        if(!this.MenuLayout.reloadQueued)
            this.MenuLayout.setDefaultMenuView();
    }

    _onOpenStateChanged(_menu, open){
        if(open){
            this.menuButtonWidget.setActiveStylePseudoClass(true);
            this.add_style_pseudo_class('active');

            if(Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();

            if(this.dtpPanel && !this.dtpNeedsRelease){
                if(this.dtpPanel.intellihide?.enabled){
                    this.dtpNeedsRelease = true;
                }
            }
        }
        else{
            if(!this.arcMenu.isOpen){
                if (this.tooltipShowingID) {
                    GLib.source_remove(this.tooltipShowingID);
                    this.tooltipShowingID = null;
                }
                this.tooltipShowing = false;
                if(this.tooltip){
                    this.tooltip.hide();
                    this.tooltip.sourceActor = null;
                }
            }
            if(!this.arcMenu.isOpen && !this.arcMenuContextMenu.isOpen){
                if(this.dtpPanel && this.dtpNeedsRelease && !this.dtpNeedsHiding){
                    this.dtpNeedsRelease = false;
                    this.dtpPanel.intellihide?.release(1);
                }
                if(this.dtpPanel && this.dtpNeedsHiding){
                    this.dtpNeedsHiding = false;
                    this.dtpPanel.panelBox.visible = false;
                }
                if(this.mainPanelNeedsHiding){
                    Main.layoutManager.panelBox.visible = false;
                    this.mainPanelNeedsHiding = false;
                }
                this.menuButtonWidget.setActiveStylePseudoClass(false);
                this.remove_style_pseudo_class('active');
            }
        }
    }
});

var ArcMenu = class ArcMenu_ArcMenu extends PopupMenu.PopupMenu{
    constructor(sourceActor, arrowAlignment, arrowSide, parent) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._settings = sourceActor._settings;
        this._menuButton = parent || sourceActor;
        Main.uiGroup.add_child(this.actor);
        this.actor.add_style_class_name('panel-menu arcmenu-menu');
        this.actor.hide();
        this._menuClosedID = this.connect('menu-closed', () => this._menuButton.setDefaultMenuView());
        this.connect('destroy', () => this._onDestroy());
    }

    open(animate){
        if(!this.isOpen){
            this._menuButton.arcMenu.actor._muteInput = false;
            this._menuButton.arcMenu.actor._muteKeys = false;
        }
        super.open(animate);
    }

    close(animate){
        if(this.isOpen){
            if(this._menuButton.contextMenuManager.activeMenu)
                this._menuButton.contextMenuManager.activeMenu.toggle();
            if(this._menuButton.subMenuManager.activeMenu)
                this._menuButton.subMenuManager.activeMenu.toggle();
        }

        super.close(animate);
    }

    _onDestroy(){
        if(this._menuClosedID){
            this.disconnect(this._menuClosedID)
            this._menuClosedID = null;
        }
    }
};

var ArcMenuContextMenu = class ArcMenu_ArcMenuContextMenu extends PopupMenu.PopupMenu {
    constructor(sourceActor, arrowAlignment, arrowSide) {
        super(sourceActor, arrowAlignment, arrowSide);
        this._settings = sourceActor._settings;
        this._menuButton = sourceActor;

        this.actor.add_style_class_name('panel-menu app-menu');
        Main.uiGroup.add_child(this.actor);
        this.actor.hide();

        this.addSettingsAction(_('Power Options'), 'gnome-power-panel.desktop');
        this.addSettingsAction(_('Event Logs'), 'org.gnome.Logs.desktop');
        this.addSettingsAction(_('System Details'), 'gnome-info-overview-panel.desktop');
        this.addSettingsAction(_('Display Settings'), 'gnome-display-panel.desktop');
        this.addSettingsAction(_('Disk Managament'), 'org.gnome.DiskUtility.desktop');
        this.addSettingsAction(_('Network Settings'), 'gnome-network-panel.desktop');

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.shortcutsMenu = new PopupMenu.PopupMenuSection();
        this.shortcutsMenu.addSettingsAction(_('Terminal'), 'org.gnome.Terminal.desktop');
        this.shortcutsMenu.addSettingsAction(_('System Monitor'), 'gnome-system-monitor.desktop');
        this.shortcutsMenu.addSettingsAction(_('Files'), 'org.gnome.Nautilus.desktop');
        this.shortcutsMenu.addSettingsAction(_('Extensions'), 'org.gnome.Extensions.desktop');
        this.shortcutsMenu.addAction(_('ArcMenu Settings'), () => ExtensionUtils.openPrefs());
        this.addMenuItem(this.shortcutsMenu);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let powerOptionsItem = new PopupMenu.PopupSubMenuMenuItem(_('Power Off / Log Out'));
        this.addMenuItem(powerOptionsItem);

        const systemActions = SystemActions.getDefault();

        let suspendItem = powerOptionsItem.menu.addAction(_('Suspend'), () => systemActions.activateSuspend());
        suspendItem.visible = systemActions.canSuspend;
        powerOptionsItem.menu.addAction(_('Restart...'), () => systemActions.activateRestart());
        powerOptionsItem.menu.addAction(_('Power Off...'), () => systemActions.activatePowerOff());

        powerOptionsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        powerOptionsItem.menu.addAction(_('Lock'), () => systemActions.activateLockScreen());
        powerOptionsItem.menu.addAction(_('Log Out...'), () => systemActions.activateLogout());
        let switchUserItem = powerOptionsItem.menu.addAction(_('Switch User'), () => systemActions.activateSwitchUser());
        switchUserItem.visible = systemActions.canSwitchUser;

        let canSuspendId = systemActions.connect('notify::can-suspend', () => suspendItem.visible = systemActions.canSuspend);
        let canSwitchUserId = systemActions.connect('notify::can-switch-user', () => switchUserItem.visible = systemActions.canSwitchUser);

        this.addAction(_('Activities Overview'), () => Main.overview.toggle());
        this.addAction(_('Show Desktop'), () => {
            let currentWorkspace = global.workspace_manager.get_active_workspace();
            let windows = currentWorkspace.list_windows().filter(function (w) {
                return w.showing_on_its_workspace() && !w.skip_taskbar;
            });
            windows = global.display.sort_windows_by_stacking(windows);

            windows.forEach(w => {
                w.minimize();
            });
        });

        this.connect('destroy', () => {
            if(canSuspendId)
                systemActions.disconnect(canSuspendId);
            if(canSwitchUserId)
                systemActions.disconnect(canSwitchUserId);
            
            canSuspendId = null;
            canSwitchUserId = null;
        });
    }

    addExtensionSettings(extensionName, extensionId){
        let item = new PopupMenu.PopupMenuItem(_(extensionName));
        item.connect('activate', () => Utils.openPrefs(extensionId) );
        this.shortcutsMenu.addMenuItem(item);
    }

    addSettingsAction(title, desktopFile){
        let app = Shell.AppSystem.get_default().lookup_app(desktopFile);
        if(!app)
            return;
        
        super.addSettingsAction(title, desktopFile);
    }
};
