/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, Shell, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PlaceDisplay = Me.imports.placeDisplay;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.WINDOWS;
}

var Menu = class ArcMenuWindowsLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            search_display_type: Constants.DisplayType.LIST,
            display_type: Constants.DisplayType.LIST,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            default_menu_width: 315,
            icon_grid_style: 'SmallIconGrid',
            vertical: false,
            category_icon_size: Constants.LARGE_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.LARGE_ICON_SIZE,
        });

        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style: 'spacing: 6px;',
        });
        this.add_child(this.actionsBox);

        const verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);
        this.add_child(verticalSeparator);

        this.subMainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style: 'spacing: 6px;',
        });
        this.add_child(this.subMainBox);

        this.pinnedAppsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this.pinnedAppsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });
        this.pinnedAppsScrollBox.add_actor(this.pinnedAppsBox);

        this.pinnedAppsVerticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: 10,
            row_spacing: 10,
        });
        this.pinnedAppsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            layout_manager: layout,
        });
        layout.hookup_style(this.pinnedAppsGrid);

        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.subMainBox.add_child(this.applicationsScrollBox);

        this.subMainBox.add_child(this.searchBox);

        const applicationShortcutsList = Me.settings.get_value('application-shortcuts-list').deep_unpack();
        this.applicationShortcuts = [];
        for (let i = 0; i < applicationShortcutsList.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcutsList[i],
                Constants.DisplayType.LIST, false);
            if (shortcutMenuItem.shouldShow)
                this.applicationShortcuts.push(shortcutMenuItem);
        }

        const directoryShortcutsList = Me.settings.get_value('directory-shortcuts-list').deep_unpack();
        this._loadPlaces(directoryShortcutsList);

        this.externalDevicesBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
        });
        this._placesSections = {};
        this.placesManager = new PlaceDisplay.PlacesManager();
        for (let i = 0; i < Constants.SECTIONS.length; i++) {
            const id = Constants.SECTIONS[i];
            this._placesSections[id] = new St.BoxLayout({vertical: true});
            this.placesManager.setConnection(`${id}-updated`, () => this._redisplayPlaces(id), this);

            this._createPlaces(id);
            this.externalDevicesBox.add_child(this._placesSections[id]);
        }

        Me.settings.connectObject('changed::windows-extra-buttons', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this._createExtrasMenu();
        this.setDefaultMenuView();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        this.extrasButton = new MW.ExtrasButton(this);
        this.extrasButton.set({
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this.actionsBox.add_child(this.extrasButton);

        const isContainedInCategory = false;

        const extraButtons = Me.settings.get_value('windows-extra-buttons').deep_unpack();
        for (let i = 0; i < extraButtons.length; i++) {
            const command = extraButtons[i][2];
            if (command === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.HORIZONTAL);
                this.actionsBox.add_child(separator);
            } else {
                const button = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON,
                    isContainedInCategory);
                if (button.shouldShow)
                    this.actionsBox.add_child(button);
            }
        }

        let leaveButton;
        const powerDisplayStyle = Me.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.IN_LINE)
            leaveButton = new MW.PowerOptionsBox(this, true);
        else
            leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(leaveButton);
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidth = Me.settings.get_int('left-panel-width');
        this.applicationsScrollBox.style = `width: ${leftPanelWidth}px;`;

        const widthAdjustment = Me.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.pinnedAppsScrollBox.style = `width: ${menuWidth}px; margin-left: 6px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    loadPinnedApps() {
        this.display_type = Constants.DisplayType.GRID;
        super.loadPinnedApps();
        this.display_type = Constants.DisplayType.LIST;
    }

    _createPlaces(id) {
        const places = this.placesManager.get(id);

        if (places.length === 0)
            return;
        else if (id === 'bookmarks')
            this._placesSections[id].add_child(this.createLabelRow(_('Bookmarks')));
        else if (id === 'devices')
            this._placesSections[id].add_child(this.createLabelRow(_('Devices')));
        else if (id === 'network')
            this._placesSections[id].add_child(this.createLabelRow(_('Network')));
        else
            return;

        for (let i = 0; i < places.length; i++) {
            const item = new MW.PlaceMenuItem(this, places[i], Constants.DisplayType.LIST);
            this._placesSections[id].add_child(item);
        }
    }

    _loadPlaces(directoryShortcutsList) {
        this.directoryShortcuts = [];
        for (let i = 0; i < directoryShortcutsList.length; i++) {
            const directory = directoryShortcutsList[i];
            const isContainedInCategory = false;
            const placeMenuItem = this.createMenuItem(directory, Constants.DisplayType.LIST, isContainedInCategory);
            this.directoryShortcuts.push(placeMenuItem);
        }
    }

    _createExtrasMenu() {
        this.extrasMenu = new PopupMenu.PopupMenu(Main.layoutManager.dummyCursor, 0, St.Side.TOP);
        this.extrasMenu.actor.add_style_class_name('popup-menu arcmenu-menu');

        const section = new PopupMenu.PopupMenuSection();
        this.extrasMenu.addMenuItem(section);

        const extrasMenuPopupBox = new St.BoxLayout({vertical: true});
        extrasMenuPopupBox._delegate = extrasMenuPopupBox;
        section.actor.add_child(extrasMenuPopupBox);

        const headerBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
        });
        extrasMenuPopupBox.add_child(headerBox);

        this.backButton = new MW.BackButton(this);
        this.backButton.connect('activate', () => this.toggleExtrasMenu());
        headerBox.add_child(this.backButton);

        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        headerBox.add_child(separator);

        this.computerScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });

        extrasMenuPopupBox.add_child(this.computerScrollBox);

        const computerBox = new St.BoxLayout({vertical: true});
        this.computerScrollBox.add_actor(computerBox);

        computerBox.add_child(this.createLabelRow(_('Application Shortcuts')));
        for (let i = 0; i < this.applicationShortcuts.length; i++)
            computerBox.add_child(this.applicationShortcuts[i]);

        computerBox.add_child(this.createLabelRow(_('Places')));
        for (let i = 0; i < this.directoryShortcuts.length; i++)
            computerBox.add_child(this.directoryShortcuts[i]);

        computerBox.add_child(this.externalDevicesBox);

        const height = Me.settings.get_int('menu-height');
        this.extrasMenu.actor.style = `height: ${height}px;`;

        this.subMenuManager.addMenu(this.extrasMenu);
        this.extrasMenu.actor.hide();
        Main.uiGroup.add_child(this.extrasMenu.actor);
        this.extrasMenu.connect('open-state-changed', (menu, open) => {
            if (!open) {
                this.extrasButton.active = false;
                this.extrasButton.sync_hover();
                this.extrasButton.hovered = this.extrasButton.hover;
            }
        });
    }

    toggleExtrasMenu() {
        const appsScrollBoxAdj = this.computerScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        const themeNode = this.arcMenu.actor.get_theme_node();

        let [x, y] = this.arcMenu.actor.get_transformed_position();
        const rise = themeNode.get_length('-arrow-rise');

        if (this.arcMenu._arrowSide !== St.Side.TOP)
            y -= rise;
        if (this.arcMenu._arrowSide === St.Side.LEFT)
            x += rise;

        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        this.extrasMenu.toggle();
        if (this.extrasMenu.isOpen) {
            this.activeMenuItem = this.backButton;
            this.backButton.grab_key_focus();
        }
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        this.displayAllApps();
        if (!Me.settings.get_boolean('windows-disable-pinned-apps'))
            this.displayPinnedApps();

        const appsScrollBoxAdj = this.pinnedAppsScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);
    }

    displayFrequentApps() {
        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        if (mostUsed.length < 1)
            return;

        const labelRow = this._createLabelWithSeparator(_('Frequent Apps'));
        this.applicationsBox.add_child(labelRow);

        const frequentAppsList = [];
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()) {
                const item = new MW.ApplicationMenuItem(this, mostUsed[i], Constants.DisplayType.LIST);
                frequentAppsList.push(item);
            }
        }
        let activeMenuItemSet = false;
        const maxApps = Math.min(8, frequentAppsList.length);
        for (let i = 0; i < maxApps; i++) {
            const item = frequentAppsList[i];
            if (item.get_parent())
                item.get_parent().remove_child(item);
            this.applicationsBox.add_actor(item);
            if (!activeMenuItemSet) {
                activeMenuItemSet = true;
                this.activeMenuItem = item;
            }
        }
    }

    displayAllApps() {
        this._clearActorsFromBox();
        this.activeMenuItemSet = false;

        if (!Me.settings.get_boolean('windows-disable-frequent-apps'))
            this.displayFrequentApps();

        const appList = [];
        this.applicationsMap.forEach((value, key, _map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        this.display_type = Constants.DisplayType.LIST;
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);

        if (this.activeMenuItemSet)
            this.activeMenuItem = this._frequentActiveItem;
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    _clearActorsFromBox(box) {
        super._clearActorsFromBox(box);
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    displayPinnedApps() {
        super._clearActorsFromBox(this.pinnedAppsBox);
        this.pinnedAppsGrid.remove_all_children();

        const pinnedApps = Me.settings.get_strv('pinned-app-list');

        if (pinnedApps.length < 1) {
            if (this.contains(this.pinnedAppsScrollBox)) {
                this.remove_child(this.pinnedAppsVerticalSeparator);
                this.remove_child(this.pinnedAppsScrollBox);
            }

            return;
        }

        if (!this.contains(this.pinnedAppsScrollBox)) {
            this.add_child(this.pinnedAppsVerticalSeparator);
            this.add_child(this.pinnedAppsScrollBox);
        }

        const label = this.createLabelRow(_('Pinned'));
        this.pinnedAppsBox.add_child(label);

        this.display_type = Constants.DisplayType.GRID;
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.HOME_SCREEN, this.pinnedAppsGrid);
        this.display_type = Constants.DisplayType.LIST;

        if (!this.pinnedAppsBox.contains(this.pinnedAppsGrid))
            this.pinnedAppsBox.add_child(this.pinnedAppsGrid);

        if (this.activeMenuItemSet)
            this.activeMenuItem = this._frequentActiveItem;
    }
};
