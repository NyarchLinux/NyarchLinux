const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, GLib, Gtk, Shell, St } = imports.gi;
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.UNITY; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DisplayType: Constants.DisplayType.GRID,
            SearchDisplayType: Constants.DisplayType.GRID,
            ShortcutContextMenuLocation: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            ColumnSpacing: 15,
            RowSpacing: 15,
            VerticalMainBox: true,
            DefaultMenuWidth: 750,
            DefaultIconGridStyle: "LargeIconGrid",
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.EXTRA_LARGE_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultButtonsIconSize: Constants.SMALL_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }

    createLayout(){
        super.createLayout();
        let homeScreen = this._settings.get_boolean('enable-unity-homescreen');
        if(homeScreen)
            this.activeCategory = _("Pinned");
        else
            this.activeCategory = _("All Programs");

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
            style: 'padding-bottom: 10px; padding-right: 15px;'
        });

        this.mainBox.add_child(this.topBox);
        this.categoriesButton = new MW.CategoriesButton(this);

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true
        });
        this.mainBox.add_child(this.subMainBox);

        this.searchBox.y_align = Clutter.ActorAlign.CENTER;
        this.searchBox.y_expand = true;
        this.searchBox.style = "margin: 0px 15px 0px 15px;";
        this.topBox.add_child(this.searchBox);
        this.topBox.add_child(this.categoriesButton);

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'arcmenu-margin-box',
            y_align: Clutter.ActorAlign.START,
        });

        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class: this.disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        this.actionsContainerBoxStyle = "margin: 0px; spacing: 0px;background-color:rgba(10, 10, 15, 0.1) ; padding: 5px 5px;"+
                                            "border-color:rgba(186, 196,201, 0.2) ; border-top-width: 1px;";
        this.themeNodeBorderRadius = "";
        this.actionsContainerBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
            style: this.actionsContainerBoxStyle + this.themeNodeBorderRadius
        });

        this.subMainBox.add_child(this.actionsContainerBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false
        });
        this.actionsBox.style = "spacing: 10px;";
        this.actionsContainerBox.add_child(this.actionsBox);

        this.widgetBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
            style_class: 'datemenu-displays-box'
        });

        this.widgetBox.style = "margin: 0px; spacing: 10px; padding-bottom: 6px;";
        this._weatherItem = new MW.WeatherSection(this);
        this._clocksItem = new MW.WorldClocksSection(this);

        this.appShortcuts = [];
        this.shortcutsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: true
        });

        let layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.layoutProperties.ColumnSpacing,
            row_spacing: this.layoutProperties.RowSpacing
        });
        this.shortcutsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            layout_manager: layout
        });
        layout.hookup_style(this.shortcutsGrid);

        this.shortcutsBox.add_child(this.shortcutsGrid);

        let applicationShortcuts = this._settings.get_value('application-shortcuts-list').deep_unpack();
        for(let i = 0; i < applicationShortcuts.length; i++){
            let shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.GRID, false);
            if(shortcutMenuItem.shouldShow)
                this.appShortcuts.push(shortcutMenuItem);
        }

        this.updateStyle();
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this._createCategoriesMenu();
        this.loadExtraPinnedApps();

        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView){
        super.updateWidth(setDefaultMenuView);

        if(!this.applicationsBox.get_stage())
            return;

        let width = this.layoutProperties.MenuWidth - 80;
        this._weatherItem.style = `width: ${Math.round(5 * width / 8)}px;`;
        this._clocksItem.style = `width: ${Math.round(3 * width / 8)}px;`;
    }

    _addSeparator(){
        let verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.ALWAYS_SHOW, Constants.SeparatorAlignment.VERTICAL);
        this.actionsBox.add_child(verticalSeparator);
    }

    loadExtraPinnedApps(){
        this.actionsContainerBox.remove_child(this.actionsBox);
        this.actionsBox.destroy_all_children();
        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false
        });
        this.actionsBox.style = "spacing: 10px; padding: 5px 0px;";
        this.actionsContainerBox.add_child(this.actionsBox);

        super.loadExtraPinnedApps(this._settings.get_strv('unity-pinned-app-list'), this._settings.get_int('unity-separator-index'));
    }

    _createExtraPinnedAppsList(){
        let pinnedApps = [];
        pinnedApps.push(_("Home"), "ArcMenu_Home", "ArcMenu_Home");
        pinnedApps.push(_("Documents"), "ArcMenu_Documents", "ArcMenu_Documents");
        pinnedApps.push(_("Downloads"), "ArcMenu_Downloads", "ArcMenu_Downloads");

        let software = Utils.findSoftwareManager();
        if(software)
            pinnedApps.push(_("Software"), '', software);
        else
            pinnedApps.push(_("Computer"), "ArcMenu_Computer", "ArcMenu_Computer");

        pinnedApps.push(_("Files"), "", "org.gnome.Nautilus.desktop");
        pinnedApps.push(_("Log Out..."), "application-exit-symbolic", "ArcMenu_LogOut");
        pinnedApps.push(_("Lock"), "changes-prevent-symbolic", "ArcMenu_Lock");
        pinnedApps.push(_("Power Off..."), "system-shutdown-symbolic", "ArcMenu_PowerOff");

        this.shouldLoadPinnedApps = false; // We don't want to trigger a setting changed event
        this._settings.set_strv('unity-pinned-app-list', pinnedApps);
        this.shouldLoadPinnedApps = true;
        return pinnedApps;
    }

    _createCategoriesMenu(){
        this.categoriesMenu = new PopupMenu.PopupMenu(this.categoriesButton, 0.5, St.Side.TOP);
        this.categoriesMenu.actor.add_style_class_name('popup-menu arcmenu-menu');
        this.categoriesMenu.blockSourceEvents = true;
        this.categoriesMenu.connect('open-state-changed', (menu, open) => {
            if(open){
                this.categoriesButton.add_style_pseudo_class('active');
                if(this.menuButton.tooltipShowingID){
                    GLib.source_remove(this.menuButton.tooltipShowingID);
                    this.menuButton.tooltipShowingID = null;
                    this.menuButton.tooltipShowing = false;
                }
                if(this.categoriesButton.tooltip){
                    this.categoriesButton.tooltip.hide();
                    this.menuButton.tooltipShowing = false;
                }
            }
            else{
                this.categoriesButton.remove_style_pseudo_class('active');
                this.categoriesButton.active = false;
                this.categoriesButton.sync_hover();
                this.categoriesButton.hovered = this.categoriesButton.hover;
            }
        });
        this.section = new PopupMenu.PopupMenuSection();
        this.categoriesMenu.addMenuItem(this.section);

        this.leftPanelPopup = new St.BoxLayout({
            vertical: true
        });
        this.leftPanelPopup._delegate = this.leftPanelPopup;
        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this.disableFadeEffect ? '' : 'small-vfade',
            overlay_scrollbars: true,
            reactive:true
        });
        this.leftPanelPopup.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({
            vertical: true,
        });
        this.categoriesScrollBox.add_actor(this.categoriesBox);
        this.categoriesScrollBox.clip_to_allocation = true;

        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        let scaleFactor = themeContext.scale_factor;
        let height =  Math.round(350 / scaleFactor);
        this.leftPanelPopup.style = `max-height: ${height}px`;
        this.section.actor.add_child(this.leftPanelPopup);
        this._displayCategories();
        this.subMenuManager.addMenu(this.categoriesMenu);
        this.categoriesMenu.actor.hide();
        Main.uiGroup.add_child(this.categoriesMenu.actor);
    }

    toggleCategoriesMenu(){
        let appsScrollBoxAdj = this.categoriesScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        this.categoriesMenu.toggle();
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        let homeScreen = this._settings.get_boolean('enable-unity-homescreen');
        if(homeScreen){
            this.activeCategory = _("Pinned");
            this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
            this.displayPinnedApps();
        }
        else{
            this.activeCategory = _("All Programs");
            let isGridLayout = true;
            this.displayAllApps(isGridLayout);
            this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;
        }
    }

    updateStyle(){
        let themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        let monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        let scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        borderRadius = borderRadius / scaleFactor;
        this.themeNodeBorderRadius = "border-radius: 0px 0px " + borderRadius + "px " + borderRadius + "px;";
        this.actionsContainerBox.style = this.actionsContainerBoxStyle + this.themeNodeBorderRadius;

        this.arcMenu.box.style = "padding-bottom: 0px; padding-left: 0px; padding-right: 0px;";
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        let categoryMenuItem = new MW.CategoryMenuItem(this, Constants.CategoryType.HOME_SCREEN, Constants.DisplayType.LIST);
        this.categoryDirectories.set(Constants.CategoryType.HOME_SCREEN, categoryMenuItem);
        this.hasPinnedApps = true;

        let extraCategories = this._settings.get_value("extra-categories").deep_unpack();

        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let shouldShow = extraCategories[i][1];
            if(categoryEnum == Constants.CategoryType.PINNED_APPS)
                shouldShow = false;
            if(shouldShow){
                let categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    _displayCategories(){
        for(let categoryMenuItem of this.categoryDirectories.values()){
            this.categoriesBox.add_actor(categoryMenuItem);
        }
    }

    displayPinnedApps() {
        if(this.activeCategoryType === Constants.CategoryType.HOME_SCREEN)
            this._clearActorsFromBox(this.applicationsBox);
        else
            this._clearActorsFromBox();
        this.subMainBox.remove_child(this.actionsContainerBox);
        this.activeCategory = _("Pinned");
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
        this.activeCategory = _("Shortcuts");
        this._displayAppList(this.appShortcuts, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);
        if(!this.applicationsBox.contains(this.shortcutsBox))
            this.applicationsBox.add_child(this.shortcutsBox);
        this.widgetBox.remove_all_children();
        if(this._settings.get_boolean('enable-clock-widget-unity'))
            this.widgetBox.add_child(this._clocksItem);
        if(this._settings.get_boolean('enable-weather-widget-unity'))
            this.widgetBox.add_child(this._weatherItem);
        if(!this.subMainBox.contains(this.widgetBox))
            this.subMainBox.add_child(this.widgetBox);
        this.subMainBox.add_child(this.actionsContainerBox);
    }

    displayRecentFiles(){
        super.displayRecentFiles();
        let label = this._createLabelWithSeparator(_("Recent Files"));
        this.applicationsBox.insert_child_at_index(label, 0);
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
    }

    displayCategoryAppList(appList, category){
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _clearActorsFromBox(box) {
        if(this.categoriesMenu.isOpen)
            this.categoriesMenu.toggle();
        if(this.subMainBox.contains(this.widgetBox)){
            this.subMainBox.remove_child(this.widgetBox);
        }
        super._clearActorsFromBox(box);
    }

    _displayAppList(apps, category, grid){
        super._displayAppList(apps, category, grid);

        let label = this._createLabelWithSeparator(this.activeCategory);
        if(grid === this.applicationsGrid)
            this.applicationsBox.insert_child_at_index(label, 0);
        else
            this.applicationsBox.insert_child_at_index(label, 2);
    }

    destroy(){
        if(this._clocksItem)
            this._clocksItem.destroy();
        if(this._weatherItem)
            this._weatherItem.destroy();

        this.arcMenu.box.style = null;

        super.destroy();
    }
}
