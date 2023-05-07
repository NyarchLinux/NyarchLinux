/* exported LayoutTweaksPage */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Adw, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const {SettingsUtils} = Me.imports.settings;
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const {SubPage} = Settings.Menu.SubPage;
const {ListPinnedPage} = Me.imports.settings.Menu.ListPinnedPage;
const {ListOtherPage} = Me.imports.settings.Menu.ListOtherPage;

var LayoutTweaksPage = GObject.registerClass(
class ArcMenuLayoutTweaksPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.restoreDefaultsButton.visible = false;
        this._createLayout();
    }

    setActiveLayout(menuLayout) {
        this.headerLabel.title = _(SettingsUtils.getMenuLayoutTweaksName(menuLayout));

        for (const child of this.page.children)
            this.page.remove(child);

        this.page.children = [];
        this._createLayout(menuLayout);
    }

    _createLayout(menuLayout) {
        if (!menuLayout)
            menuLayout = this._settings.get_enum('menu-layout');

        switch (menuLayout) {
        case Constants.MenuLayout.ARCMENU:
            this._loadArcMenuTweaks();
            break;
        case Constants.MenuLayout.BRISK:
            this._loadBriskMenuTweaks();
            break;
        case Constants.MenuLayout.WHISKER:
            this._loadWhiskerMenuTweaks();
            break;
        case Constants.MenuLayout.GNOME_MENU:
            this._loadGnomeMenuTweaks();
            break;
        case Constants.MenuLayout.MINT:
            this._loadMintMenuTweaks();
            break;
        case Constants.MenuLayout.ELEMENTARY:
            this._loadElementaryTweaks();
            break;
        case Constants.MenuLayout.GNOME_OVERVIEW:
            this._loadGnomeOverviewTweaks();
            break;
        case Constants.MenuLayout.REDMOND:
            this._loadRedmondMenuTweaks();
            break;
        case Constants.MenuLayout.UNITY:
            this._loadUnityTweaks();
            break;
        case Constants.MenuLayout.RAVEN:
            this._loadRavenTweaks();
            break;
        case Constants.MenuLayout.BUDGIE:
            this._loadBudgieMenuTweaks();
            break;
        case Constants.MenuLayout.INSIDER:
            this._loadInsiderMenuTweaks();
            break;
        case Constants.MenuLayout.RUNNER:
            this._loadRunnerMenuTweaks();
            break;
        case Constants.MenuLayout.CHROMEBOOK:
            this._loadChromebookTweaks();
            break;
        case Constants.MenuLayout.TOGNEE:
            this._loadTogneeMenuTweaks();
            break;
        case Constants.MenuLayout.PLASMA:
            this._loadPlasmaMenuTweaks();
            break;
        case Constants.MenuLayout.WINDOWS:
            this._loadWindowsTweaks();
            break;
        case Constants.MenuLayout.ELEVEN:
            this._loadElevenTweaks();
            break;
        case Constants.MenuLayout.AZ:
            this._loadAZTweaks();
            break;
        case Constants.MenuLayout.ENTERPRISE:
            this._loadEnterpriseTweaks();
            break;
        default:
            this._loadPlaceHolderTweaks();
            break;
        }
    }

    _createVertSeparatorRow() {
        const vertSeparatorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('vert-separator'),
        });
        vertSeparatorSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('vert-separator', widget.get_active());
        });
        const vertSeparatorRow = new Adw.ActionRow({
            title: _('Vertical Separator'),
            activatable_widget: vertSeparatorSwitch,
        });
        vertSeparatorRow.add_suffix(vertSeparatorSwitch);
        return vertSeparatorRow;
    }

    _createActivateOnHoverRow() {
        const hoverOptions = new Gtk.StringList();
        hoverOptions.append(_('Mouse Click'));
        hoverOptions.append(_('Mouse Hover'));

        const activateOnHoverRow = new Adw.ComboRow({
            title: _('Category Activation'),
            model: hoverOptions,
        });

        if (this._settings.get_boolean('activate-on-hover'))
            activateOnHoverRow.selected = 1;
        else
            activateOnHoverRow.selected = 0;

        activateOnHoverRow.connect('notify::selected', widget => {
            let activateOnHover;
            if (widget.selected === 0)
                activateOnHover = false;
            if (widget.selected === 1)
                activateOnHover = true;

            this._settings.set_boolean('activate-on-hover', activateOnHover);
        });
        return activateOnHoverRow;
    }

    _createAvatarShapeRow() {
        const avatarStyles = new Gtk.StringList();
        avatarStyles.append(_('Round'));
        avatarStyles.append(_('Square'));
        const avatarStyleRow = new Adw.ComboRow({
            title: _('Avatar Icon Shape'),
            model: avatarStyles,
            selected: this._settings.get_enum('avatar-style'),
        });

        avatarStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('avatar-style', widget.selected);
        });
        return avatarStyleRow;
    }

    _createSearchBarLocationRow(bottomDefault) {
        const searchBarLocationSetting = bottomDefault ? 'searchbar-default-bottom-location'
            : 'searchbar-default-top-location';

        const searchbarLocations = new Gtk.StringList();
        searchbarLocations.append(_('Bottom'));
        searchbarLocations.append(_('Top'));

        const searchbarLocationRow = new Adw.ComboRow({
            title: _('Searchbar Location'),
            model: searchbarLocations,
            selected: this._settings.get_enum(searchBarLocationSetting),
        });

        searchbarLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum(searchBarLocationSetting, widget.selected);
        });

        return searchbarLocationRow;
    }

    _createFlipHorizontalRow() {
        const horizontalFlipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        horizontalFlipSwitch.set_active(this._settings.get_boolean('enable-horizontal-flip'));
        horizontalFlipSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('enable-horizontal-flip', widget.get_active());
        });
        const horizontalFlipRow = new Adw.ActionRow({
            title: _('Flip Layout Horizontally'),
            activatable_widget: horizontalFlipSwitch,
        });
        horizontalFlipRow.add_suffix(horizontalFlipSwitch);
        return horizontalFlipRow;
    }

    _disableAvatarRow() {
        const disableAvatarSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        disableAvatarSwitch.set_active(this._settings.get_boolean('disable-user-avatar'));
        disableAvatarSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('disable-user-avatar', widget.get_active());
        });
        const disableAvatarRow = new Adw.ActionRow({
            title: _('Disable User Avatar'),
            activatable_widget: disableAvatarSwitch,
        });
        disableAvatarRow.add_suffix(disableAvatarSwitch);
        return disableAvatarRow;
    }

    _loadEnterpriseTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _loadElevenTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        const disableFrequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        disableFrequentAppsSwitch.set_active(this._settings.get_boolean('eleven-disable-frequent-apps'));
        disableFrequentAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('eleven-disable-frequent-apps', widget.get_active());
        });
        const disableFrequentAppsRow = new Adw.ActionRow({
            title: _('Disable Frequent Apps'),
            activatable_widget: disableFrequentAppsSwitch,
        });
        disableFrequentAppsRow.add_suffix(disableFrequentAppsSwitch);
        tweaksGroup.add(disableFrequentAppsRow);
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'eleven-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadAZTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'az-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadGnomeOverviewTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        const appsGridSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        appsGridSwitch.set_active(this._settings.get_boolean('gnome-dash-show-applications'));
        appsGridSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('gnome-dash-show-applications', widget.get_active());
        });
        const appsGridRow = new Adw.ActionRow({
            title: _('Show Apps Grid'),
            activatable_widget: appsGridSwitch,
        });
        appsGridRow.add_suffix(appsGridSwitch);
        tweaksGroup.add(appsGridRow);
        this.add(tweaksGroup);
    }

    _loadWindowsTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createVertSeparatorRow());
        const frequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        frequentAppsSwitch.set_active(this._settings.get_boolean('windows-disable-frequent-apps'));
        frequentAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('windows-disable-frequent-apps', widget.get_active());
        });
        const frequentAppsRow = new Adw.ActionRow({
            title: _('Disable Frequent Apps'),
            activatable_widget: frequentAppsSwitch,
        });
        frequentAppsRow.add_suffix(frequentAppsSwitch);
        tweaksGroup.add(frequentAppsRow);

        const pinnedAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        pinnedAppsSwitch.set_active(this._settings.get_boolean('windows-disable-pinned-apps'));
        pinnedAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('windows-disable-pinned-apps', widget.get_active());
        });
        const pinnedAppsRow = new Adw.ActionRow({
            title: _('Disable Pinned Apps'),
            activatable_widget: pinnedAppsSwitch,
        });
        pinnedAppsRow.add_suffix(pinnedAppsSwitch);
        tweaksGroup.add(pinnedAppsRow);

        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'windows-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadPlasmaMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());

        const hoverSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        hoverSwitch.set_active(this._settings.get_boolean('plasma-enable-hover'));
        hoverSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('plasma-enable-hover', widget.get_active());
        });
        const hoverRow = new Adw.ActionRow({
            title: _('Activate on Hover'),
            activatable_widget: hoverSwitch,
        });
        hoverRow.add_suffix(hoverSwitch);
        tweaksGroup.add(hoverRow);

        this.add(tweaksGroup);
    }

    _loadBriskMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Extra Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Extra Shortcuts'),
            preferences_page: false,
            setting_string: 'brisk-extra-shortcuts',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadChromebookTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());
        this.add(tweaksGroup);
    }

    _loadElementaryTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());
        this.add(tweaksGroup);
    }

    _loadBudgieMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());

        const enableActivitiesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        enableActivitiesSwitch.set_active(this._settings.get_boolean('enable-activities-shortcut'));
        enableActivitiesSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('enable-activities-shortcut', widget.get_active());
        });
        const enableActivitiesRow = new Adw.ActionRow({
            title: _('Enable Activities Overview Shortcut'),
            activatable_widget: enableActivitiesSwitch,
        });
        enableActivitiesRow.add_suffix(enableActivitiesSwitch);
        tweaksGroup.add(enableActivitiesRow);

        this.add(tweaksGroup);
    }

    _loadRunnerMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        const runnerPositions = new Gtk.StringList();
        runnerPositions.append(_('Top'));
        runnerPositions.append(_('Centered'));
        const runnerPositionRow = new Adw.ComboRow({
            title: _('Position'),
            model: runnerPositions,
            selected: this._settings.get_enum('runner-position'),
        });

        runnerPositionRow.connect('notify::selected', widget => {
            this._settings.set_enum('runner-position', widget.selected);
        });
        tweaksGroup.add(runnerPositionRow);

        const runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_('List'));
        runnerSearchStyles.append(_('Grid'));
        const runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('runner-search-display-style'),
        });

        runnerSearchStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('runner-search-display-style', widget.selected);
        });
        tweaksGroup.add(runnerSearchStyleRow);

        const runnerWidthScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerWidthScale.set_value(this._settings.get_int('runner-menu-width'));
        runnerWidthScale.connect('value-changed', widget => {
            this._settings.set_int('runner-menu-width', widget.get_value());
        });
        const runnerWidthRow = new Adw.ActionRow({
            title: _('Width'),
            activatable_widget: runnerWidthScale,
        });
        runnerWidthRow.add_suffix(runnerWidthScale);
        tweaksGroup.add(runnerWidthRow);

        const runnerHeightScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerHeightScale.set_value(this._settings.get_int('runner-menu-height'));
        runnerHeightScale.connect('value-changed', widget => {
            this._settings.set_int('runner-menu-height', widget.get_value());
        });
        const runnerHeightRow = new Adw.ActionRow({
            title: _('Height'),
            activatable_widget: runnerHeightScale,
        });
        runnerHeightRow.add_suffix(runnerHeightScale);
        tweaksGroup.add(runnerHeightRow);

        const runnerFontSizeScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 30,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerFontSizeScale.set_value(this._settings.get_int('runner-font-size'));
        runnerFontSizeScale.connect('value-changed', widget => {
            this._settings.set_int('runner-font-size', widget.get_value());
        });
        const runnerFontSizeRow = new Adw.ActionRow({
            title: _('Font Size'),
            subtitle: _('%d Default Theme Value').format(0),
            activatable_widget: runnerFontSizeScale,
        });
        runnerFontSizeRow.add_suffix(runnerFontSizeScale);
        tweaksGroup.add(runnerFontSizeRow);

        const frequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        frequentAppsSwitch.set_active(this._settings.get_boolean('runner-show-frequent-apps'));
        frequentAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('runner-show-frequent-apps', widget.get_active());
        });
        const frequentAppsRow = new Adw.ActionRow({
            title: _('Show Frequent Apps'),
            activatable_widget: frequentAppsSwitch,
        });
        frequentAppsRow.add_suffix(frequentAppsSwitch);
        tweaksGroup.add(frequentAppsRow);

        this.add(tweaksGroup);
    }

    _loadUnityTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Home'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1,
        });
        defaultViewRow.connect('notify::selected', widget => {
            const enable =  widget.selected === 0;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        tweaksGroup.add(defaultViewRow);

        const widgetGroup = this._createWidgetsRows(Constants.MenuLayout.UNITY);
        this.add(widgetGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'unity-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadRavenTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Home'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1,
        });
        defaultViewRow.connect('notify::selected', widget => {
            const enable =  widget.selected === 0;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        tweaksGroup.add(defaultViewRow);

        const runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_('List'));
        runnerSearchStyles.append(_('Grid'));
        const runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('raven-search-display-style'),
        });

        runnerSearchStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('raven-search-display-style', widget.selected);
        });
        tweaksGroup.add(runnerSearchStyleRow);

        const ravenPositions = new Gtk.StringList();
        ravenPositions.append(_('Left'));
        ravenPositions.append(_('Right'));
        const ravenPositionRow = new Adw.ComboRow({
            title: _('Position on Monitor'),
            model: ravenPositions,
            selected: this._settings.get_enum('raven-position'),
        });
        ravenPositionRow.connect('notify::selected', widget => {
            this._settings.set_enum('raven-position', widget.selected);
        });
        tweaksGroup.add(ravenPositionRow);
        tweaksGroup.add(this._createActivateOnHoverRow());
        const widgetGroup = this._createWidgetsRows(Constants.MenuLayout.RAVEN);
        this.add(widgetGroup);
    }

    _loadMintMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'mint-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadWhiskerMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _loadRedmondMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('All Programs'));
        defaulViews.append(_('Pinned Apps'));

        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-redmond'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-redmond', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._disableAvatarRow());
        tweaksGroup.add(this._createVertSeparatorRow());

        this.add(tweaksGroup);

        const placesGroup = new Adw.PreferencesGroup({
            title: _('Extra Shortcuts'),
        });
        this.add(placesGroup);

        const externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        const externalDeviceRow = new Adw.ActionRow({
            title: _('External Devices'),
            activatable_widget: externalDeviceButton,
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesGroup.add(externalDeviceRow);

        const bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        const bookmarksRow = new Adw.ActionRow({
            title: _('Bookmarks'),
            activatable_widget: bookmarksButton,
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesGroup.add(bookmarksRow);
    }

    _loadInsiderMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createVertSeparatorRow());
        tweaksGroup.add(this._createAvatarShapeRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup({
            title: _('Button Shortcuts'),
        });
        const extraShortcutsPage = new ListPinnedPage(this._settings, {
            title: _('Button Shortcuts'),
            preferences_page: false,
            setting_string: 'insider-extra-buttons',
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        extraShortcutsGroup.set_header_suffix(extraShortcutsPage.restoreDefaultsButton);
        extraShortcutsGroup.add(extraShortcutsPage);
        this.add(extraShortcutsGroup);
    }

    _loadGnomeMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _loadPlaceHolderTweaks() {
        const placeHolderGroup = new Adw.PreferencesGroup();
        const placeHolderRow = new Adw.ActionRow({
            title: _('Nothing Yet!'),
        });
        placeHolderGroup.add(placeHolderRow);
        this.add(placeHolderGroup);
    }

    _loadTogneeMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Categories List'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-tognee'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-tognee', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        const searchBarBottomDefault = true;
        tweaksGroup.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _loadArcMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Pinned Apps'));
        defaulViews.append(_('Categories List'));
        defaulViews.append(_('Frequent Apps'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        const searchBarBottomDefault = true;
        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._disableAvatarRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const placesGroup = new Adw.PreferencesGroup({
            title: _('Extra Shortcuts'),
        });

        const externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        const externalDeviceRow = new Adw.ActionRow({
            title: _('External Devices'),
            activatable_widget: externalDeviceButton,
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesGroup.add(externalDeviceRow);

        const bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        const bookmarksRow = new Adw.ActionRow({
            title: _('Bookmarks'),
            activatable_widget: bookmarksButton,
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesGroup.add(bookmarksRow);
        this.add(placesGroup);

        const extraCategoriesGroup = new Adw.PreferencesGroup({
            title: _('Category Quick Links'),
            description: _('Display quick links of extra categories on the home page\n' +
                "Must also be enabled in 'Menu -> Extra Categories' section"),
        });
        const extraCategoriesLinksBox = new ListOtherPage(this._settings, {
            preferences_page: false,
            list_type: Constants.MenuSettingsListType.QUICK_LINKS,
        });
        extraCategoriesGroup.add(extraCategoriesLinksBox);
        this.add(extraCategoriesGroup);

        const extraCategoriesLocationGroup = new Adw.PreferencesGroup();
        const locations = new Gtk.StringList();
        locations.append(_('Bottom'));
        locations.append(_('Top'));
        const extraCategoriesLocationRow = new Adw.ComboRow({
            title: _('Quick Links Location'),
            model: locations,
            selected: this._settings.get_enum('arcmenu-extra-categories-links-location'),
        });
        extraCategoriesLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum('arcmenu-extra-categories-links-location', widget.selected);
        });
        extraCategoriesLocationGroup.add(extraCategoriesLocationRow);
        this.add(extraCategoriesLocationGroup);
    }

    _createWidgetsRows(layout) {
        let weatherWidgetSetting = 'enable-weather-widget-raven';
        let clockWidgetSetting = 'enable-clock-widget-raven';
        if (layout === Constants.MenuLayout.RAVEN) {
            weatherWidgetSetting = 'enable-weather-widget-raven';
            clockWidgetSetting = 'enable-clock-widget-raven';
        } else {
            weatherWidgetSetting = 'enable-weather-widget-unity';
            clockWidgetSetting = 'enable-clock-widget-unity';
        }

        const widgetGroup = new Adw.PreferencesGroup();

        const weatherWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        weatherWidgetSwitch.set_active(this._settings.get_boolean(weatherWidgetSetting));
        weatherWidgetSwitch.connect('notify::active', widget => {
            this._settings.set_boolean(weatherWidgetSetting, widget.get_active());
        });
        const weatherWidgetRow = new Adw.ActionRow({
            title: _('Enable Weather Widget'),
            activatable_widget: weatherWidgetSwitch,
        });
        weatherWidgetRow.add_suffix(weatherWidgetSwitch);
        widgetGroup.add(weatherWidgetRow);

        const clockWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        clockWidgetSwitch.set_active(this._settings.get_boolean(clockWidgetSetting));
        clockWidgetSwitch.connect('notify::active', widget => {
            this._settings.set_boolean(clockWidgetSetting, widget.get_active());
        });
        const clockWidgetRow = new Adw.ActionRow({
            title: _('Enable Clock Widget'),
            activatable_widget: clockWidgetSwitch,
        });
        clockWidgetRow.add_suffix(clockWidgetSwitch);
        widgetGroup.add(clockWidgetRow);

        return widgetGroup;
    }
});
