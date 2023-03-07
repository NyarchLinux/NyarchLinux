const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Adw, Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const PW = Me.imports.prefsWidgets;
const { SettingsUtils } = Me.imports.settings;
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const { SubPage } = Settings.Menu.SubPage;
const { ListPinnedPage } = Me.imports.settings.Menu.ListPinnedPage;
const { ListOtherPage } = Me.imports.settings.Menu.ListOtherPage;

var LayoutTweaksPage = GObject.registerClass(
class ArcMenu_LayoutTweaksPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.restoreDefaultsButton.visible = false;
        this._createLayout();
    }

    setActiveLayout(menuLayout){
        this.headerLabel.title = _(SettingsUtils.getMenuLayoutTweaksName(menuLayout));

        for(let child of this.page.children){
            this.page.remove(child);
        }
        this.page.children = [];
        this._createLayout(menuLayout);
    }

    _createLayout(menuLayout) {
        if(!menuLayout)
            menuLayout = this._settings.get_enum('menu-layout');

        if(menuLayout == Constants.MenuLayout.ARCMENU)
            this._loadArcMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.BRISK)
            this._loadBriskMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.WHISKER)
            this._loadWhiskerMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.GNOME_MENU)
            this._loadGnomeMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.MINT)
            this._loadMintMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.ELEMENTARY)
            this._loadElementaryTweaks();
        else if(menuLayout == Constants.MenuLayout.GNOME_OVERVIEW)
            this._loadGnomeOverviewTweaks();
        else if(menuLayout == Constants.MenuLayout.REDMOND)
            this._loadRedmondMenuTweaks()
        else if(menuLayout == Constants.MenuLayout.UNITY)
            this._loadUnityTweaks();
        else if(menuLayout == Constants.MenuLayout.RAVEN)
            this._loadRavenTweaks();
        else if(menuLayout == Constants.MenuLayout.BUDGIE)
            this._loadBudgieMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.INSIDER)
            this._loadInsiderMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.RUNNER)
            this._loadRunnerMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.CHROMEBOOK)
            this._loadChromebookTweaks();
        else if(menuLayout == Constants.MenuLayout.TOGNEE)
            this._loadTogneeMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.PLASMA)
            this._loadPlasmaMenuTweaks();
        else if(menuLayout == Constants.MenuLayout.WINDOWS)
            this._loadWindowsTweaks();
        else if(menuLayout == Constants.MenuLayout.ELEVEN)
            this._loadElevenTweaks();
        else if(menuLayout == Constants.MenuLayout.AZ)
            this._loadAZTweaks();
        else
            this._loadPlaceHolderTweaks();
    }

    _createVertSeparatorRow(){
        let vertSeparatorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('vert-separator')
        });
        vertSeparatorSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('vert-separator', widget.get_active());
        });
        let vertSeparatorRow = new Adw.ActionRow({
            title: _('Vertical Separator'),
            activatable_widget:  vertSeparatorSwitch
        });
        vertSeparatorRow.add_suffix(vertSeparatorSwitch);
        return vertSeparatorRow;
    }

    _createActivateOnHoverRow(){
        let hoverOptions = new Gtk.StringList();
        hoverOptions.append(_("Mouse Click"));
        hoverOptions.append(_("Mouse Hover"));

        let activateOnHoverRow = new Adw.ComboRow({
            title: _("Category Activation"),
            model: hoverOptions,
        });

        if(this._settings.get_boolean('activate-on-hover'))
            activateOnHoverRow.selected = 1;
        else
            activateOnHoverRow.selected = 0;

        activateOnHoverRow.connect('notify::selected', (widget) => {
            let activateOnHover;
            if(widget.selected === 0)
                activateOnHover = false;
            if(widget.selected === 1)
                activateOnHover = true;

            this._settings.set_boolean('activate-on-hover', activateOnHover);
        });
        return activateOnHoverRow;
    }

    _createAvatarShapeRow(){
        let avatarStyles = new Gtk.StringList();
        avatarStyles.append(_("Round"));
        avatarStyles.append(_("Square"));
        let avatarStyleRow = new Adw.ComboRow({
            title: _('Avatar Icon Shape'),
            model: avatarStyles,
            selected: this._settings.get_enum('avatar-style')
        });

        avatarStyleRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('avatar-style', widget.selected);
        });
        return avatarStyleRow;
    }

    _createSearchBarLocationRow(bottomDefault){
        let searchBarLocationSetting = bottomDefault ? 'searchbar-default-bottom-location' : 'searchbar-default-top-location';

        let searchbarLocations = new Gtk.StringList();
        searchbarLocations.append(_("Bottom"));
        searchbarLocations.append(_("Top"));

        let searchbarLocationRow = new Adw.ComboRow({
            title: _("Searchbar Location"),
            model: searchbarLocations,
            selected: this._settings.get_enum(searchBarLocationSetting)
        });

        searchbarLocationRow.connect('notify::selected', (widget) => {
            this._settings.set_enum(searchBarLocationSetting , widget.selected);
        });

        return searchbarLocationRow;
    }

    _createFlipHorizontalRow(){
        let horizontalFlipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        horizontalFlipSwitch.set_active(this._settings.get_boolean('enable-horizontal-flip'));
        horizontalFlipSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('enable-horizontal-flip', widget.get_active());
        });
        let horizontalFlipRow = new Adw.ActionRow({
            title: _("Flip Layout Horizontally"),
            activatable_widget: horizontalFlipSwitch
        });
        horizontalFlipRow.add_suffix(horizontalFlipSwitch);
        return horizontalFlipRow;
    }

    _disableAvatarRow(){
        let disableAvatarSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        disableAvatarSwitch.set_active(this._settings.get_boolean('disable-user-avatar'));
        disableAvatarSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('disable-user-avatar', widget.get_active());
        });
        let disableAvatarRow = new Adw.ActionRow({
            title: _('Disable User Avatar'),
            activatable_widget: disableAvatarSwitch
        });
        disableAvatarRow.add_suffix(disableAvatarSwitch);
        return disableAvatarRow;
    }

    _loadElevenTweaks(){
        let elevenTweaksFrame = new Adw.PreferencesGroup();
        let disableFrequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        disableFrequentAppsSwitch.set_active(this._settings.get_boolean('eleven-disable-frequent-apps'));
        disableFrequentAppsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('eleven-disable-frequent-apps', widget.get_active());
        });
        let disableFrequentAppsRow = new Adw.ActionRow({
            title: _("Disable Frequent Apps"),
            activatable_widget: disableFrequentAppsSwitch
        });
        disableFrequentAppsRow.add_suffix(disableFrequentAppsSwitch);
        elevenTweaksFrame.add(disableFrequentAppsRow);
        this.add(elevenTweaksFrame);
    }

    _loadAZTweaks(){
        let azTweaksFrame = new Adw.PreferencesGroup();
        azTweaksFrame.add(this._createSearchBarLocationRow());
        this.add(azTweaksFrame);
    }

    _loadGnomeOverviewTweaks(){
        let gnomeOverviewTweaksFrame = new Adw.PreferencesGroup();
        let appsGridSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        appsGridSwitch.set_active(this._settings.get_boolean('gnome-dash-show-applications'));
        appsGridSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('gnome-dash-show-applications', widget.get_active());
        });
        let appsGridRow = new Adw.ActionRow({
            title: _("Show Apps Grid"),
            activatable_widget: appsGridSwitch
        });
        appsGridRow.add_suffix(appsGridSwitch);
        gnomeOverviewTweaksFrame.add(appsGridRow);
        this.add(gnomeOverviewTweaksFrame);
    }

    _loadWindowsTweaks(){
        let windowsTweaksFrame = new Adw.PreferencesGroup();

        let frequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        frequentAppsSwitch.set_active(this._settings.get_boolean('windows-disable-frequent-apps'));
        frequentAppsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('windows-disable-frequent-apps', widget.get_active());
        });
        let frequentAppsRow = new Adw.ActionRow({
            title: _("Disable Frequent Apps"),
            activatable_widget: frequentAppsSwitch
        });
        frequentAppsRow.add_suffix(frequentAppsSwitch);
        windowsTweaksFrame.add(frequentAppsRow);

        let pinnedAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        pinnedAppsSwitch.set_active(this._settings.get_boolean('windows-disable-pinned-apps'));
        pinnedAppsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('windows-disable-pinned-apps', widget.get_active());
        });
        let pinnedAppsRow = new Adw.ActionRow({
            title: _("Disable Pinned Apps"),
            activatable_widget: pinnedAppsSwitch
        });
        pinnedAppsRow.add_suffix(pinnedAppsSwitch);
        windowsTweaksFrame.add(pinnedAppsRow);

        this.add(windowsTweaksFrame);
    }

    _loadPlasmaMenuTweaks(){
        let plasmaMenuTweaksFrame = new Adw.PreferencesGroup();
        plasmaMenuTweaksFrame.add(this._createSearchBarLocationRow());

        let hoverSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        hoverSwitch.set_active(this._settings.get_boolean('plasma-enable-hover'));
        hoverSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('plasma-enable-hover', widget.get_active());
        });
        let hoverRow = new Adw.ActionRow({
            title: _("Activate on Hover"),
            activatable_widget: hoverSwitch
        });
        hoverRow.add_suffix(hoverSwitch);
        plasmaMenuTweaksFrame.add(hoverRow);

        this.add(plasmaMenuTweaksFrame);
    }

    _loadBriskMenuTweaks(){
        let briskMenuTweaksFrame = new Adw.PreferencesGroup();
        briskMenuTweaksFrame.add(this._createActivateOnHoverRow());
        briskMenuTweaksFrame.add(this._createSearchBarLocationRow());
        briskMenuTweaksFrame.add(this._createFlipHorizontalRow());
        briskMenuTweaksFrame.add(this._createVertSeparatorRow());

        let pinnedAppsFrame = new Adw.PreferencesGroup({
            title: _("Brisk Menu Shortcuts")
        });
        let pinnedApps = new ListPinnedPage(this._settings, {
            preferences_page: false,
            setting_string: 'brisk-shortcuts-list',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS
        });
        pinnedAppsFrame.add(pinnedApps);
        this.add(briskMenuTweaksFrame);
        this.add(pinnedAppsFrame);
    }

    _loadChromebookTweaks(){
        let chromeBookTweaksFrame = new Adw.PreferencesGroup();
        chromeBookTweaksFrame.add(this._createSearchBarLocationRow());
        this.add(chromeBookTweaksFrame);
    }

    _loadElementaryTweaks(){
        let elementaryTweaksFrame = new Adw.PreferencesGroup();
        elementaryTweaksFrame.add(this._createSearchBarLocationRow());
        this.add(elementaryTweaksFrame);
    }

    _loadBudgieMenuTweaks(){
        let budgieMenuTweaksFrame = new Adw.PreferencesGroup();
        budgieMenuTweaksFrame.add(this._createActivateOnHoverRow());
        budgieMenuTweaksFrame.add(this._createSearchBarLocationRow());
        budgieMenuTweaksFrame.add(this._createFlipHorizontalRow());
        budgieMenuTweaksFrame.add(this._createVertSeparatorRow());
        
        let enableActivitiesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        enableActivitiesSwitch.set_active(this._settings.get_boolean('enable-activities-shortcut'));
        enableActivitiesSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('enable-activities-shortcut', widget.get_active());
        });
        let enableActivitiesRow = new Adw.ActionRow({
            title: _('Enable Activities Overview Shortcut'),
            activatable_widget: enableActivitiesSwitch
        });
        enableActivitiesRow.add_suffix(enableActivitiesSwitch);
        budgieMenuTweaksFrame.add(enableActivitiesRow);

        this.add(budgieMenuTweaksFrame);
    }

    _loadRunnerMenuTweaks(){
        let runnerMenuTweaksFrame = new Adw.PreferencesGroup();
        let runnerPositions = new Gtk.StringList();
        runnerPositions.append(_("Top"));
        runnerPositions.append(_("Centered"));
        let runnerPositionRow = new Adw.ComboRow({
            title: _('Position'),
            model: runnerPositions,
            selected: this._settings.get_enum('runner-position')
        });

        runnerPositionRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('runner-position', widget.selected);
        });
        runnerMenuTweaksFrame.add(runnerPositionRow);

        let runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_("List"));
        runnerSearchStyles.append(_("Grid"));
        let runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('runner-search-display-style')
        });

        runnerSearchStyleRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('runner-search-display-style', widget.selected);
        });
        runnerMenuTweaksFrame.add(runnerSearchStyleRow);

        let runnerWidthScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0
            }),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        runnerWidthScale.set_value(this._settings.get_int('runner-menu-width'));
        runnerWidthScale.connect('value-changed', (widget) => {
            this._settings.set_int('runner-menu-width', widget.get_value());
        });
        let runnerWidthRow = new Adw.ActionRow({
            title: _("Width"),
            activatable_widget: runnerWidthScale
        });
        runnerWidthRow.add_suffix(runnerWidthScale);
        runnerMenuTweaksFrame.add(runnerWidthRow);

        let runnerHeightScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0
            }),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        runnerHeightScale.set_value(this._settings.get_int('runner-menu-height'));
        runnerHeightScale.connect('value-changed', (widget) => {
            this._settings.set_int('runner-menu-height', widget.get_value());
        });
        let runnerHeightRow = new Adw.ActionRow({
            title: _("Height"),
            activatable_widget: runnerHeightScale
        });
        runnerHeightRow.add_suffix(runnerHeightScale);
        runnerMenuTweaksFrame.add(runnerHeightRow);

        let runnerFontSizeScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 30,
                step_increment: 1,
                page_increment: 1,
                page_size: 0
            }),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        runnerFontSizeScale.set_value(this._settings.get_int('runner-font-size'));
        runnerFontSizeScale.connect('value-changed', (widget) => {
            this._settings.set_int('runner-font-size', widget.get_value());
        });
        let runnerFontSizeRow = new Adw.ActionRow({
            title: _("Font Size"),
            subtitle: _("%d Default Theme Value").format(0),
            activatable_widget: runnerFontSizeScale
        });
        runnerFontSizeRow.add_suffix(runnerFontSizeScale);
        runnerMenuTweaksFrame.add(runnerFontSizeRow);

        let frequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        frequentAppsSwitch.set_active(this._settings.get_boolean('runner-show-frequent-apps'));
        frequentAppsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('runner-show-frequent-apps', widget.get_active());
        });
        let frequentAppsRow = new Adw.ActionRow({
            title: _("Show Frequent Apps"),
            activatable_widget: frequentAppsSwitch
        });
        frequentAppsRow.add_suffix(frequentAppsSwitch);
        runnerMenuTweaksFrame.add(frequentAppsRow);

        this.add(runnerMenuTweaksFrame);
    }

    _loadUnityTweaks(){
        let generalTweaksFrame = new Adw.PreferencesGroup();
        this.add(generalTweaksFrame);

        let defaulViews = new Gtk.StringList();
        defaulViews.append(_("Home"));
        defaulViews.append(_("All Programs"));
        let defaultViewRow = new Adw.ComboRow({
            title: _("Default View"),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1
        });
        defaultViewRow.connect('notify::selected', (widget) => {
            let enable =  widget.selected === 0 ? true : false;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        generalTweaksFrame.add(defaultViewRow);

        let widgetFrame = this._createWidgetsRows(Constants.MenuLayout.UNITY);
        this.add(widgetFrame);

        let pinnedAppsFrame = new Adw.PreferencesGroup({
            title: _("Unity Layout Buttons")
        });
        let pinnedApps = new ListPinnedPage(this._settings, {
            preferences_page: false,
            setting_string: 'unity-pinned-app-list',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS
        });
        pinnedAppsFrame.add(pinnedApps);
        this.add(pinnedAppsFrame);

        let pinnedAppsSeparatorFrame = new Adw.PreferencesGroup({
            title: _("Button Separator Position")
        });
        let pinnedAppsSeparatorScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 7, step_increment: 1, page_increment: 1, page_size: 0}),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        pinnedAppsSeparatorScale.set_value(this._settings.get_int('unity-separator-index'));
        pinnedAppsSeparatorScale.connect('value-changed', (widget) => {
            this._settings.set_int('unity-separator-index', widget.get_value());
        });

        let infoButton = new Gtk.Button({
            icon_name: 'help-about-symbolic',
            valign: Gtk.Align.CENTER
        });
        infoButton.connect('clicked', () => {
            let dialog = new Gtk.MessageDialog({
                text: "<b>" + _("Adjust the position of the separator in the button panel") + '</b>',
                use_markup: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true
            });
            dialog.connect('response', (widget, response) => {
                dialog.destroy();
            });
            dialog.show();
        });
        let pinnedAppsSeparatorRow = new Adw.ActionRow({
            title:  _("Separator Position"),
            activatable_widget: pinnedAppsSeparatorScale
        });
        pinnedAppsSeparatorRow.add_suffix(pinnedAppsSeparatorScale);
        pinnedAppsSeparatorRow.add_suffix(infoButton);
        pinnedAppsSeparatorFrame.add(pinnedAppsSeparatorRow);
        this.add(pinnedAppsSeparatorFrame);
    }

    _loadRavenTweaks(){
        let generalTweaksFrame = new Adw.PreferencesGroup();
        this.add(generalTweaksFrame);

        let defaulViews = new Gtk.StringList();
        defaulViews.append(_("Home"));
        defaulViews.append(_("All Programs"));
        let defaultViewRow = new Adw.ComboRow({
            title: _("Default View"),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1
        });
        defaultViewRow.connect('notify::selected', (widget) => {
            let enable =  widget.selected === 0 ? true : false;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        generalTweaksFrame.add(defaultViewRow);

        let runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_("List"));
        runnerSearchStyles.append(_("Grid"));
        let runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('raven-search-display-style')
        });

        runnerSearchStyleRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('raven-search-display-style', widget.selected);
        });
        generalTweaksFrame.add(runnerSearchStyleRow);

        let ravenPositions = new Gtk.StringList();
        ravenPositions.append(_("Left"));
        ravenPositions.append(_("Right"));
        let ravenPositionRow = new Adw.ComboRow({
            title: _('Position on Monitor'),
            model: ravenPositions,
            selected: this._settings.get_enum('raven-position')
        });
        ravenPositionRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('raven-position', widget.selected);
        });
        generalTweaksFrame.add(ravenPositionRow);
        generalTweaksFrame.add(this._createActivateOnHoverRow());
        let widgetFrame = this._createWidgetsRows(Constants.MenuLayout.RAVEN);
        this.add(widgetFrame);
    }

    _loadMintMenuTweaks(){
        let mintMenuTweaksFrame = new Adw.PreferencesGroup();
        mintMenuTweaksFrame.add(this._createActivateOnHoverRow());
        mintMenuTweaksFrame.add(this._createSearchBarLocationRow());
        mintMenuTweaksFrame.add(this._createFlipHorizontalRow());
        mintMenuTweaksFrame.add(this._createVertSeparatorRow());
        this.add(mintMenuTweaksFrame);

        let pinnedAppsFrame = new Adw.PreferencesGroup({
            title: _("Mint Layout Shortcuts")
        });
        let pinnedApps = new ListPinnedPage(this._settings, {
            preferences_page: false,
            setting_string: 'mint-pinned-app-list',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS
        });
        pinnedAppsFrame.add(pinnedApps);
        this.add(pinnedAppsFrame);

        let pinnedAppsSeparatorFrame = new Adw.PreferencesGroup({
            title: _("Shortcut Separator Position")
        });
        let pinnedAppsSeparatorScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 7, step_increment: 1, page_increment: 1, page_size: 0}),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        pinnedAppsSeparatorScale.set_value(this._settings.get_int('mint-separator-index'));
        pinnedAppsSeparatorScale.connect('value-changed', (widget) => {
            this._settings.set_int('mint-separator-index', widget.get_value());
        });

        let infoButton = new Gtk.Button({
            icon_name: 'help-about-symbolic',
            valign: Gtk.Align.CENTER
        });
        infoButton.connect('clicked', () => {
            let dialog = new Gtk.MessageDialog({
                text: "<b>" + _("Adjust the position of the separator in the button panel") + '</b>',
                use_markup: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true
            });
            dialog.connect('response', (widget, response) => {
                dialog.destroy();
            });
            dialog.show();
        });
        let pinnedAppsSeparatorRow = new Adw.ActionRow({
            title:_("Separator Position"),
            activatable_widget: pinnedAppsSeparatorScale
        });
        pinnedAppsSeparatorRow.add_suffix(pinnedAppsSeparatorScale);
        pinnedAppsSeparatorRow.add_suffix(infoButton);
        pinnedAppsSeparatorFrame.add(pinnedAppsSeparatorRow);
        this.add(pinnedAppsSeparatorFrame);
    }

    _loadWhiskerMenuTweaks(){
        let whiskerMenuTweaksFrame = new Adw.PreferencesGroup();
        whiskerMenuTweaksFrame.add(this._createActivateOnHoverRow());
        whiskerMenuTweaksFrame.add(this._createAvatarShapeRow());
        whiskerMenuTweaksFrame.add(this._createSearchBarLocationRow());
        whiskerMenuTweaksFrame.add(this._createFlipHorizontalRow());
        whiskerMenuTweaksFrame.add(this._createVertSeparatorRow());
        this.add(whiskerMenuTweaksFrame);
    }

    _loadRedmondMenuTweaks(){
        let redmondMenuTweaksFrame = new Adw.PreferencesGroup();

        let defaulViews = new Gtk.StringList();
        defaulViews.append(_("All Programs"));
        defaulViews.append(_("Pinned Apps"));
        
        let defaultViewRow = new Adw.ComboRow({
            title: _("Default View"),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-redmond')
        });
        defaultViewRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('default-menu-view-redmond', widget.selected);
        });
        redmondMenuTweaksFrame.add(defaultViewRow);

        redmondMenuTweaksFrame.add(this._createAvatarShapeRow());
        redmondMenuTweaksFrame.add(this._createSearchBarLocationRow());
        redmondMenuTweaksFrame.add(this._createFlipHorizontalRow());
        redmondMenuTweaksFrame.add(this._disableAvatarRow());
        redmondMenuTweaksFrame.add(this._createVertSeparatorRow());

        this.add(redmondMenuTweaksFrame);

        let placesFrame = new Adw.PreferencesGroup({
            title: _("Extra Shortcuts")
        });
        this.add(placesFrame);

        let externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        let externalDeviceRow = new Adw.ActionRow({
            title: _("External Devices"),
            activatable_widget: externalDeviceButton
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesFrame.add(externalDeviceRow);

        let bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        let bookmarksRow = new Adw.ActionRow({
            title: _("Bookmarks"),
            activatable_widget: bookmarksButton
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesFrame.add(bookmarksRow);
    }

    _loadInsiderMenuTweaks(){
        let insiderMenuTweaksFrame = new Adw.PreferencesGroup();
        insiderMenuTweaksFrame.add(this._createAvatarShapeRow());
        this.add(insiderMenuTweaksFrame);
    }

    _loadGnomeMenuTweaks(){
        let gnomeMenuTweaksFrame = new Adw.PreferencesGroup();
        gnomeMenuTweaksFrame.add(this._createActivateOnHoverRow());
        gnomeMenuTweaksFrame.add(this._createFlipHorizontalRow());
        gnomeMenuTweaksFrame.add(this._createVertSeparatorRow());
        this.add(gnomeMenuTweaksFrame);
    }

    _loadPlaceHolderTweaks(){
        let placeHolderFrame = new Adw.PreferencesGroup();
        let placeHolderRow = new Adw.ActionRow({
            title: _("Nothing Yet!"),
        });
        placeHolderFrame.add(placeHolderRow);
        this.add(placeHolderFrame);
    }

    _loadTogneeMenuTweaks(){
        let togneeMenuTweaksFrame = new Adw.PreferencesGroup();

        let defaulViews = new Gtk.StringList();
        defaulViews.append(_("Categories List"));
        defaulViews.append(_("All Programs"));
        let defaultViewRow = new Adw.ComboRow({
            title: _("Default View"),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-tognee')
        });
        defaultViewRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('default-menu-view-tognee', widget.selected);
        });
        togneeMenuTweaksFrame.add(defaultViewRow);

        let searchBarBottomDefault = true;
        togneeMenuTweaksFrame.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        togneeMenuTweaksFrame.add(this._createFlipHorizontalRow());
        togneeMenuTweaksFrame.add(this._createVertSeparatorRow());
        this.add(togneeMenuTweaksFrame);
    }

    _loadArcMenuTweaks(){
        let arcMenuTweaksFrame = new Adw.PreferencesGroup();

        let defaulViews = new Gtk.StringList();
        defaulViews.append(_("Pinned Apps"));
        defaulViews.append(_("Categories List"));
        defaulViews.append(_("Frequent Apps"));
        defaulViews.append(_("All Programs"));
        let defaultViewRow = new Adw.ComboRow({
            title: _("Default View"),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view')
        });
        defaultViewRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('default-menu-view', widget.selected);
        });
        arcMenuTweaksFrame.add(defaultViewRow);

        let searchBarBottomDefault = true;
        arcMenuTweaksFrame.add(this._createAvatarShapeRow());
        arcMenuTweaksFrame.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        arcMenuTweaksFrame.add(this._createFlipHorizontalRow());
        arcMenuTweaksFrame.add(this._disableAvatarRow());
        arcMenuTweaksFrame.add(this._createVertSeparatorRow());
        this.add(arcMenuTweaksFrame);

        let placesFrame = new Adw.PreferencesGroup({
            title: _("Extra Shortcuts")
        });

        let externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        let externalDeviceRow = new Adw.ActionRow({
            title: _("External Devices"),
            activatable_widget: externalDeviceButton
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesFrame.add(externalDeviceRow);

        let bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        let bookmarksRow = new Adw.ActionRow({
            title: _("Bookmarks"),
            activatable_widget: bookmarksButton
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesFrame.add(bookmarksRow);
        this.add(placesFrame);

        let extraCategoriesFrame = new Adw.PreferencesGroup({
            title: _("Category Quick Links"),
            description: _("Display quick links of extra categories on the home page\nMust also be enabled in 'Menu -> Extra Categories' section")
        });
        let extraCategoriesLinksBox = new ListOtherPage(this._settings, {
            preferences_page: false,
            list_type: Constants.MenuSettingsListType.QUICK_LINKS
        });
        extraCategoriesFrame.add(extraCategoriesLinksBox);
        this.add(extraCategoriesFrame);

        let extraCategoriesLocationFrame = new Adw.PreferencesGroup();
        let locations = new Gtk.StringList();
        locations.append(_("Bottom"));
        locations.append(_("Top"));
        let extraCategoriesLocationRow = new Adw.ComboRow({
            title: _("Quick Links Location"),
            model: locations,
            selected: this._settings.get_enum('arcmenu-extra-categories-links-location')
        });
        extraCategoriesLocationRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('arcmenu-extra-categories-links-location' , widget.selected);
        });
        extraCategoriesLocationFrame.add(extraCategoriesLocationRow);
        this.add(extraCategoriesLocationFrame);
    }

    _createWidgetsRows(layout){
        let weatherWidgetSetting = 'enable-weather-widget-raven';
        let clockWidgetSetting = 'enable-clock-widget-raven';
        if(layout == Constants.MenuLayout.RAVEN){
            weatherWidgetSetting = 'enable-weather-widget-raven';
            clockWidgetSetting = 'enable-clock-widget-raven';
        }
        else{
            weatherWidgetSetting = 'enable-weather-widget-unity';
            clockWidgetSetting = 'enable-clock-widget-unity';
        }

        let widgetFrame = new Adw.PreferencesGroup();

        let weatherWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        weatherWidgetSwitch.set_active(this._settings.get_boolean(weatherWidgetSetting));
        weatherWidgetSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean(weatherWidgetSetting, widget.get_active());
        });
        let weatherWidgetRow = new Adw.ActionRow({
            title: _("Enable Weather Widget"),
            activatable_widget: weatherWidgetSwitch
        });
        weatherWidgetRow.add_suffix(weatherWidgetSwitch);
        widgetFrame.add(weatherWidgetRow);

        let clockWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        clockWidgetSwitch.set_active(this._settings.get_boolean(clockWidgetSetting));
        clockWidgetSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean(clockWidgetSetting, widget.get_active());
        });
        let clockWidgetRow = new Adw.ActionRow({
            title: _("Enable Clock Widget"),
            activatable_widget: clockWidgetSwitch
        });
        clockWidgetRow.add_suffix(clockWidgetSwitch);
        widgetFrame.add(clockWidgetRow);

        return widgetFrame;
    }
});
