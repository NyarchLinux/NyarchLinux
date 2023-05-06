const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, Gio, GLib, Gtk, Shell, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.AZ; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.GRID,
            SearchDisplayType: Constants.DisplayType.GRID,
            ShortcutContextMenuLocation: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            ColumnSpacing: 4,
            RowSpacing: 4,
            VerticalMainBox: true,
            DefaultMenuWidth: 460,
            DefaultIconGridStyle: 'LargeRectIconGrid',
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.LARGE_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }

    createLayout(){
        super.createLayout();

        this.searchBox.style = "margin: 5px 10px;";
        this.topBoxStyle = "margin: 0px 0px 10px 0px; spacing: 0px; background-color: rgba(10, 10, 15, 0.1); padding: 11px 0px;"+
                           "border-color:rgba(186, 196,201, 0.2); border-bottom-width: 1px;";
        this.arcMenu.box.style = "padding: 0px; margin: 0px;";

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true
        });
        this.mainBox.add_child(this.subMainBox);

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
            style: this.topBoxStyle
        });
        this.subMainBox.add_child(this.topBox);

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            style: "padding-bottom: 10px;",
            style_class: 'arcmenu-margin-box'
        });
        this.applicationsScrollBox = this._createScrollBox({
            clip_to_allocation: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class: this.disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        this.bottomBoxStyle = "margin: 0px; spacing: 0px; background-color:rgba(10, 10, 15, 0.1); padding: 11px 0px;" +
                              "border-color:rgba(186, 196,201, 0.2); border-top-width: 1px;";

        this.bottomBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
            style: this.bottomBoxStyle
        });
        this.subMainBox.add_child(this.bottomBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false
        });
        this.actionsBox.style = "margin: 0px 10px; spacing: 10px;";

        this.user = new MW.UserMenuItem(this, Constants.DisplayType.LIST);
        this.actionsBox.add_child(this.user);

        let isContainedInCategory = false;
        let filesButton = this.createMenuItem([_("Files"), "", "org.gnome.Nautilus.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        if(filesButton.shouldShow)
            this.actionsBox.add_child(filesButton);

        let terminalButton = this.createMenuItem([_("Terminal"), "", "org.gnome.Terminal.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        this.actionsBox.add_child(terminalButton);

        let settingsButton = this.createMenuItem([_("Settings"),"", "org.gnome.Settings.desktop"], Constants.DisplayType.BUTTON, isContainedInCategory);
        if(settingsButton.shouldShow)
            this.actionsBox.add_child(settingsButton);

        let powerDisplayStyle = this._settings.get_enum('power-display-style');
        if(powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            this.leaveButton = new MW.PowerOptionsBox(this, 10);
        else
            this.leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(this.leaveButton);

        this.backButton = this._createNavigationRow(_("All Apps"), Constants.Direction.GO_PREVIOUS, _("Back"), () => this.setDefaultMenuView());
        this.backButton.style = 'padding: 0px 10px 10px 15px;';
        this.allAppsButton = this._createNavigationRow(_("Pinned"), Constants.Direction.GO_NEXT, _("All Apps"), () => this.displayAllApps());
        this.allAppsButton.style = 'padding: 0px 10px 10px 15px;';

        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.TOP){
            this.topBox.add_child(this.searchBox);
            this.bottomBox.add_child(this.actionsBox);
        }
        else{
            this.topBox.add_child(this.actionsBox);
            this.bottomBox.add_child(this.searchBox);
        }

        this.updateStyle();
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    loadPinnedApps(){
        this.layoutProperties.DisplayType = Constants.DisplayType.GRID;
        super.loadPinnedApps();
    }

    setDefaultMenuView(){
        this.setGridLayout(Constants.DisplayType.GRID, 4);
        super.setDefaultMenuView();
        this.activeCategory = _("Pinned");
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
        this.displayPinnedApps();
    }

    displayAllApps(){
        this.activeCategory = _("All Apps");
        this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;

        this.setGridLayout(Constants.DisplayType.LIST, 3);
        let appList = [];
        this.applicationsMap.forEach((value,key,map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        this._clearActorsFromBox();
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);
        this.setGridLayout(Constants.DisplayType.GRID, 4, false);
    }

    updateStyle(){
        let themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        let monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        let scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        borderRadius = borderRadius / scaleFactor;

        const RoundBottomBorder = "border-radius: 0px 0px " + borderRadius + "px " + borderRadius + "px;";
        const RoundTopBorder = "border-radius: " + borderRadius + "px " + borderRadius + "px 0px 0px;";
        this.bottomBox.style = this.bottomBoxStyle + RoundBottomBorder;
        this.topBox.style = this.topBoxStyle + RoundTopBorder;
        this.arcMenu.box.style = "padding: 0px; margin: 0px;";
    }

    setGridLayout(displayType, spacing, setStyle = true){
        if(setStyle){
            this.applicationsGrid.x_align = displayType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL : Clutter.ActorAlign.CENTER;
        }

        this.applicationsGrid.layout_manager.column_spacing = spacing;
        this.applicationsGrid.layout_manager.row_spacing = spacing;
        this.layoutProperties.DisplayType = displayType;
    }

    loadCategories() {
        this.layoutProperties.DisplayType = Constants.DisplayType.LIST;
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    displayPinnedApps() {
        this._clearActorsFromBox();
        this.activeCategory = _("Pinned");
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
    }

    _displayAppList(apps, category, grid){
        super._displayAppList(apps, category, grid);

        this._hideNavigationRow();

        if(category === Constants.CategoryType.PINNED_APPS){
            this.subMainBox.insert_child_at_index(this.allAppsButton, 1);
        }
        else if(category === Constants.CategoryType.ALL_PROGRAMS){
            this.subMainBox.insert_child_at_index(this.backButton, 1);
        }
    }

    _hideNavigationRow(){
        if(this.subMainBox.contains(this.backButton))
            this.subMainBox.remove_child(this.backButton);
        if(this.subMainBox.contains(this.allAppsButton))
            this.subMainBox.remove_child(this.allAppsButton);
    }

    _onSearchBoxChanged(searchBox, searchString){
        if(!searchBox.isEmpty())
            this._hideNavigationRow();
        super._onSearchBoxChanged(searchBox, searchString);
    }

    destroy(){
        this.arcMenu.box.style = null;
        this.leaveButton.destroy();
        this.backButton.destroy();
        this.allAppsButton.destroy();
        super.destroy();
    }
}
