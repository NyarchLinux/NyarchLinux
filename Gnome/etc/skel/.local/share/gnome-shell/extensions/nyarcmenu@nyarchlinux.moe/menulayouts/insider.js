const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, GLib, Gio, Gtk, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.INSIDER; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.GRID,
            SearchDisplayType: Constants.DisplayType.GRID,
            ShortcutContextMenuLocation: Constants.ContextMenuLocation.RIGHT,
            ColumnSpacing: 10,
            RowSpacing: 10,
            PinnedAppsColumns: 1,
            DefaultMenuWidth: 525,
            DefaultIconGridStyle: "SmallIconGrid",
            VerticalMainBox: false,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.LARGE_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }
    createLayout(){
        super.createLayout();
        this.actionsBox = new St.BoxLayout({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true
        });
        this.actionsBox.style = "margin: 0px; spacing: 6px;";
        this.mainBox.add_child(this.actionsBox);

        this.pinnedAppsButton = new MW.PinnedAppsButton(this);
        this.pinnedAppsButton.y_expand = true;
        this.pinnedAppsButton.y_align= Clutter.ActorAlign.START;
        this.actionsBox.add_child(this.pinnedAppsButton);

        let isContainedInCategory = false;
        let filesButton = this.createMenuItem([_("Files"), "", "org.gnome.Nautilus.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        this.actionsBox.add_child(filesButton);

        let terminalButton = this.createMenuItem([_("Terminal"), "", "org.gnome.Terminal.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        this.actionsBox.add_child(terminalButton);

        let settingsButton = this.createMenuItem([_("Settings"),"", "org.gnome.Settings.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        if(settingsButton.shouldShow)
            this.actionsBox.add_child(settingsButton);

        let powerDisplayStyle = this._settings.get_enum('power-display-style');
        if(powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            this.leaveButton = new MW.PowerOptionsBox(this, 6, true);
        else
            this.leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(this.leaveButton);

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            vertical: true
        });
        this.mainBox.add_child(this.subMainBox);

        let userMenuBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
            style: 'padding-top: 9px;'
        })
        this.user = new MW.UserMenuIcon(this, 75, true);
        this.user.x_align = Clutter.ActorAlign.CENTER;
        this.user.y_align = Clutter.ActorAlign.CENTER;
        this.user.label.x_align = Clutter.ActorAlign.CENTER;
        this.user.label.style = "font-size: large;"
        userMenuBox.add_child(this.user);
        userMenuBox.add_child(this.user.label);
        this.subMainBox.add_child(userMenuBox);

        this.searchBox.style = "margin: 10px;";
        this.subMainBox.add_child(this.searchBox);

        this.applicationsBox = new St.BoxLayout({
            vertical: true
        });

        this.applicationsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class:  this.disableFadeEffect ? '' : 'vfade',
        });

        this.applicationsScrollBox.add_actor( this.applicationsBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this._createPinnedAppsMenu();
        this.setDefaultMenuView();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    loadPinnedApps(){
        this.layoutProperties.DisplayType = Constants.DisplayType.LIST;
        super.loadPinnedApps();
        this.layoutProperties.DisplayType = Constants.DisplayType.GRID;
    }

    _createPinnedAppsMenu(){
        this.dummyCursor = new St.Widget({ width: 0, height: 0, opacity: 0 });
        Main.uiGroup.add_child(this.dummyCursor);

        this.pinnedAppsMenu = new PopupMenu.PopupMenu(this.dummyCursor, 0, St.Side.TOP);
        this.pinnedAppsMenu.actor.add_style_class_name('popup-menu arcmenu-menu');

        this.section = new PopupMenu.PopupMenuSection();
        this.pinnedAppsMenu.addMenuItem(this.section);

        this.leftPanelPopup = new St.BoxLayout({
            vertical: true,
        });
        this.leftPanelPopup._delegate = this.leftPanelPopup;
        this.section.actor.add_child(this.leftPanelPopup);

        let headerBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: true
        });
        this.leftPanelPopup.add_child(headerBox);

        this.backButton = new MW.BackMenuItem(this);
        this.backButton.connect("activate", () => this.togglePinnedAppsMenu());
        headerBox.add_child(this.backButton);

        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
        headerBox.add_child(separator);
        headerBox.add_child(this.createLabelRow(_("Pinned")));

        this.pinnedAppsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this.disableFadeEffect ? '' : 'small-vfade',
            overlay_scrollbars: true,
            reactive: true
        });

        this.leftPanelPopup.add_child(this.pinnedAppsScrollBox);

        this.pinnedAppsBox = new St.BoxLayout({
            vertical: true
        });
        this.pinnedAppsScrollBox.add_actor(this.pinnedAppsBox);

        let layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: 0,
            row_spacing: 0
        });
        this.pinnedAppsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            layout_manager: layout
        });
        layout.forceGridColumns = 1;
        layout.hookup_style(this.pinnedAppsGrid);

        let height = this._settings.get_int('menu-height');
        this.pinnedAppsMenu.actor.style = `height: ${height}px;`;

        this.displayPinnedApps();
        this.subMenuManager.addMenu(this.pinnedAppsMenu);
        this.pinnedAppsMenu.actor.hide();
        Main.uiGroup.add_child(this.pinnedAppsMenu.actor);
        this.pinnedAppsMenu.connect('open-state-changed', (menu, open) => {
            if(!open){
                this.pinnedAppsButton.active = false;
                this.pinnedAppsButton.sync_hover();
                this.pinnedAppsButton.hovered = this.pinnedAppsButton.hover;
            }
        });
    }

    togglePinnedAppsMenu(){
        let appsScrollBoxAdj = this.pinnedAppsScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        let themeNode = this.arcMenu.actor.get_theme_node();

        this.arcMenu.actor.get_allocation_box();
        let [x, y] = this.arcMenu.actor.get_transformed_position();
        let rise = themeNode.get_length('-arrow-rise');

        if(this.arcMenu._arrowSide != St.Side.TOP)
            y -= rise;
        if(this.arcMenu._arrowSide === St.Side.LEFT)
            x += rise;

        this.dummyCursor.set_position(x, y);
        this.pinnedAppsMenu.toggle();
        if(this.pinnedAppsMenu.isOpen){
            this.activeMenuItem = this.backButton;
            this.backButton.grab_key_focus();
        }
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        this.displayAllApps();
        this.activeMenuItem = this.applicationsGrid.layout_manager.get_child_at(0, 0);
        if(!this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);
        let appsScrollBoxAdj = this.pinnedAppsScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    _clearActorsFromBox(box){
        super._clearActorsFromBox(box);
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayPinnedApps() {
        this._clearActorsFromBox(this.pinnedAppsBox);
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.pinnedAppsGrid);
        if(!this.pinnedAppsBox.contains(this.pinnedAppsGrid))
            this.pinnedAppsBox.add_child(this.pinnedAppsGrid);
    }
}
