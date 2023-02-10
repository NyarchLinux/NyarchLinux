const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Clutter, GLib, Gio, Gtk, Shell, St } = imports.gi;
const appSys = Shell.AppSystem.get_default();
const { BaseMenuLayout } = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

function getMenuLayoutEnum() { return Constants.MenuLayout.MINT; }

var Menu = class extends BaseMenuLayout{
    constructor(menuButton) {
        super(menuButton, {
            Search: true,
            DualPanelMenu: true,
            DisplayType: Constants.DisplayType.LIST,
            SearchDisplayType: Constants.DisplayType.LIST,
            ShortcutContextMenuLocation: Constants.ContextMenuLocation.RIGHT,
            ColumnSpacing: 0,
            RowSpacing: 0,
            SupportsCategoryOnHover: true,
            VerticalMainBox: false,
            DefaultCategoryIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultApplicationIconSize: Constants.EXTRA_SMALL_ICON_SIZE,
            DefaultQuickLinksIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultButtonsIconSize: Constants.MEDIUM_ICON_SIZE,
            DefaultPinnedIconSize: Constants.MEDIUM_ICON_SIZE,
        });
    }
    createLayout(){
        super.createLayout();
        //Stores the Pinned Icons on the left side
        this.actionsScrollBox = new St.ScrollView({
            x_expand: false,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            overlay_scrollbars: true,
            style_class: 'small-vfade'
        });
        this.actionsScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
        this.actionsBox = new St.BoxLayout({
            vertical: true
        });
        this.actionsScrollBox.add_actor(this.actionsBox);
        this.actionsScrollBox.clip_to_allocation = true;

        this.actionsScrollBox.style = "padding: 10px 0px; width: 62px; margin: 0px 8px 0px 0px; background-color:rgba(10, 10, 15, 0.1); border-color:rgba(186, 196,201, 0.2); border-width: 1px; border-radius: 8px;";
        this.actionsBox.style = "spacing: 10px;";

        this.mainBox.add_child(this.actionsScrollBox);
        this.rightMenuBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true
        });
        this.mainBox.add_child(this.rightMenuBox);

        this.searchBox.style = "margin: 0px;";
        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.TOP){
            this.searchBox.add_style_class_name('arcmenu-search-top');
            this.rightMenuBox.add_child(this.searchBox);

            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MAX, Constants.SeparatorAlignment.HORIZONTAL);
            this.rightMenuBox.add_child(separator);
        }

        //Sub Main Box -- stores left and right box
        this.subMainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.rightMenuBox.add_child(this.subMainBox);

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });

        this.applicationsBox = new St.BoxLayout({
            vertical: true
        });

        this.applicationsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            overlay_scrollbars: true,
            style_class: (this.disableFadeEffect ? '' : 'small-vfade'),
        });

        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.rightBox.add_child(this.applicationsScrollBox);

        this.leftBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });

        let horizonalFlip = this._settings.get_boolean("enable-horizontal-flip");
        this.subMainBox.add_child(horizonalFlip ? this.rightBox : this.leftBox);
        let verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.VERTICAL);
        this.subMainBox.add_child(verticalSeparator);
        this.subMainBox.add_child(horizonalFlip ? this.leftBox : this.rightBox);

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            style_class: (this.disableFadeEffect ? '' : 'small-vfade'),
            overlay_scrollbars: true
        });

        this.leftBox.add_child(this.categoriesScrollBox);
        this.categoriesBox = new St.BoxLayout({ vertical: true });

        this.categoriesScrollBox.add_actor( this.categoriesBox);
        this.categoriesScrollBox.clip_to_allocation = true;
        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.BOTTOM){
            let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MAX, Constants.SeparatorAlignment.HORIZONTAL);
            this.rightMenuBox.add_child(separator);

            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            this.rightMenuBox.add_child(this.searchBox);
        }

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.loadExtraPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView){
        let leftPanelWidthOffset = 0;
        let rightPanelWidthOffset = 45;
        super.updateWidth(setDefaultMenuView, leftPanelWidthOffset, rightPanelWidthOffset);
    }

    _addSeparator(){
        let separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM, Constants.SeparatorAlignment.HORIZONTAL);
        this.actionsBox.add_child(separator);
    }

    setDefaultMenuView(){
        super.setDefaultMenuView();
        this.displayCategories();

        let topCategory = this.categoryDirectories.values().next().value;
        topCategory.displayAppList();
        this.setActiveCategory(topCategory);
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        let extraCategories = this._settings.get_value("extra-categories").deep_unpack();

        for(let i = 0; i < extraCategories.length; i++){
            let categoryEnum = extraCategories[i][0];
            let shouldShow = extraCategories[i][1];
            if(shouldShow){
                let categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    loadExtraPinnedApps(){
        this.actionsBox.destroy_all_children();
        super.loadExtraPinnedApps(this._settings.get_strv('mint-pinned-app-list'), this._settings.get_int('mint-separator-index'));
    }

    _createExtraPinnedAppsList(){
        let pinnedApps = [];
        //Find the Default Web Browser, if found add to pinned apps list, if not found delete the placeholder.
        //Will only run if placeholder is found. Placeholder only found with default settings set.
        let browserName = '';
        try{
            //user may not have xdg-utils package installed which will throw error
            let [res, stdout, stderr, status] = GLib.spawn_command_line_sync("xdg-settings get default-web-browser");
            let webBrowser = String.fromCharCode(...stdout);
            browserName = webBrowser.split(".desktop")[0];
            browserName += ".desktop";
        }
        catch(error){
            log("ArcMenu Error - Failed to find default web browser. Removing placeholder pinned app.")
        }
        this._app = appSys.lookup_app(browserName);
        if(this._app){
            let appIcon = this._app.create_icon_texture(25);
            let iconName = '';
            if(appIcon.icon_name)
                iconName = appIcon.icon_name;
            else if(appIcon.gicon)
                iconName = appIcon.gicon.to_string();
            pinnedApps.push(this._app.get_name(), iconName, this._app.get_id());
        }
        else{
            pinnedApps.push(_("Home"), "ArcMenu_Home", "ArcMenu_Home");
        }
        pinnedApps.push(_("Terminal"), "utilities-terminal", "org.gnome.Terminal.desktop");
        pinnedApps.push(_("Settings"), "emblem-system-symbolic", "org.gnome.Settings.desktop");

        let software = Utils.findSoftwareManager();
        if(software)
            pinnedApps.push(_("Software"), '', software);
        else
            pinnedApps.push(_("Documents"), "ArcMenu_Documents", "ArcMenu_Documents");

        pinnedApps.push(_("Files"), "system-file-manager", "org.gnome.Nautilus.desktop");
        pinnedApps.push(_("Log Out..."), "application-exit-symbolic", "ArcMenu_LogOut");
        pinnedApps.push(_("Lock"), "changes-prevent-symbolic", "ArcMenu_Lock");
        pinnedApps.push(_("Power Off..."), "system-shutdown-symbolic", "ArcMenu_PowerOff");

        this.shouldLoadPinnedApps = false; // We don't want to trigger a setting changed event
        this._settings.set_strv('mint-pinned-app-list', pinnedApps);
        this.shouldLoadPinnedApps = true;
        return pinnedApps;
    }

    displayCategories(){
        super.displayCategories(this.categoriesBox);
    }
}
