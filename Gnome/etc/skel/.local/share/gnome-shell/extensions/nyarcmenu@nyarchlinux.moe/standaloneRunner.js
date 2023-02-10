const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, GLib, Shell, St} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuButton = Me.imports.menuButton;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const Utils = Me.imports.utils;
const _ = Gettext.gettext;

var StandaloneRunner = class ArcMenu_StandaloneRunner{
    constructor(settings) {
        this._settings = settings;

        this.tooltipShowing = false;
        this.tooltipShowingID = null;

        this.tooltip = new MW.Tooltip(this);

        this.dummyWidget = new St.Widget({ width: 0, height: 0, opacity: 0 });
        Main.uiGroup.add_child(this.dummyWidget);

        //Create Main Menus - ArcMenu and arcMenu's context menu
        this.arcMenu = new MenuButton.ArcMenu(this.dummyWidget, 0.5, St.Side.TOP, this);
        this.arcMenu.connect('open-state-changed', this._onOpenStateChanged.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(Main.panel);
        this.menuManager._changeMenu = (menu) => {};
        this.menuManager.addMenu(this.arcMenu);

        let rect = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryMonitor.index);

        //Position the runner menu in the center of the current monitor, at top of screen.
        let positionX = Math.round(rect.x + (rect.width / 2));
        let positionY = rect.y;
        this.dummyWidget.set_position(positionX, positionY);

        //Context Menus for applications and other menu items
        this.contextMenuManager = new PopupMenu.PopupMenuManager(this.dummyWidget);
        this.contextMenuManager._changeMenu = (menu) => {};
        this.contextMenuManager._onMenuSourceEnter = (menu) =>{
            if (this.contextMenuManager.activeMenu && this.contextMenuManager.activeMenu != menu)
                return Clutter.EVENT_STOP;

            return Clutter.EVENT_PROPAGATE;
        }

        //Sub Menu Manager - Control all other popup menus
        this.subMenuManager = new PopupMenu.PopupMenuManager(this.dummyWidget);
        this.subMenuManager._changeMenu = (menu) => {};
    }

    initiate(){
        this.clearMenuLayoutTimeouts();
        this.createLayoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.createMenuLayout();
            this.createLayoutID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    createMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._forcedMenuLocation = false;
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

        const StandaloneRunner = true;
        this.MenuLayout = Utils.getMenuLayout(this, Constants.MenuLayout.RUNNER, StandaloneRunner);
        if(this.arcMenu.isOpen){
            if(this.MenuLayout.activeMenuItem)
                this.MenuLayout.activeMenuItem.active = true;
            else
                this.mainBox.grab_key_focus();
        }
    }

    reloadMenuLayout(){
        if(this.tooltip)
            this.tooltip.sourceActor = null;
        this._forcedMenuLocation = false;

        this.MenuLayout.destroy();
        this.MenuLayout = null;

        const StandaloneRunner = true;
        this.MenuLayout = Utils.getMenuLayout(this, Constants.MenuLayout.RUNNER, StandaloneRunner);

        if(this.arcMenu.isOpen){
            if(this.MenuLayout.activeMenuItem)
                this.MenuLayout.activeMenuItem.active = true;
            else
                this.mainBox.grab_key_focus();
        }
    }

    toggleMenu(){
        if(this.contextMenuManager.activeMenu)
            this.contextMenuManager.activeMenu.toggle();
        if(this.subMenuManager.activeMenu)
            this.subMenuManager.activeMenu.toggle();

        if(!this.arcMenu.isOpen){
            this.MenuLayout.updateLocation();
            this.arcMenu.toggle();
            if(this.arcMenu.isOpen)
                this.mainBox.grab_key_focus();
        }
        else if(this.arcMenu.isOpen){
            this.arcMenu.toggle();
        }
    }

    destroy(){
        this.clearMenuLayoutTimeouts();
        if (this.tooltipShowingID) {
            GLib.source_remove(this.tooltipShowingID);
            this.tooltipShowingID = null;
        }

        this.tooltip?.destroy();
        this.MenuLayout?.destroy();
        this.arcMenu?.destroy();
        this.dummyWidget?.destroy();
    }

    clearMenuLayoutTimeouts(){
        if(this.createLayoutID){
            GLib.source_remove(this.createLayoutID);
            this.createLayoutID = null;
        }
    }

    updateMenuLayout(){
    }

    loadExtraPinnedApps(){
        this.MenuLayout?.loadExtraPinnedApps();
    }

    updateLocation(){
        this.MenuLayout?.updateLocation();
    }

    displayPinnedApps() {
        this.MenuLayout?.displayPinnedApps();
    }

    loadPinnedApps() {
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
        this.MenuLayout?.setDefaultMenuView();
    }

    _onOpenStateChanged(menu, open) {
        if(open){
            if(Main.panel.menuManager && Main.panel.menuManager.activeMenu)
                Main.panel.menuManager.activeMenu.toggle();
        }
        else{
            if(!this.arcMenu.isOpen){
                if (this.tooltipShowingID) {
                    GLib.source_remove(this.tooltipShowingID);
                    this.tooltipShowingID = null;
                }
                this.tooltipShowing = false;
                if(this.activeTooltip){
                    this.activeTooltip.hide();
                }
            }
        }
    }
};
