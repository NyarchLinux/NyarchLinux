/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.RAVEN;
}

var Menu = class ArcMenuRavenLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Me.settings.get_enum('raven-search-display-style'),
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 415,
            icon_grid_style: 'SmallIconGrid',
            vertical: false,
            supports_category_hover_activation: true,
            category_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.arcMenu.box.style = 'padding: 0px; margin: 0px; border-radius: 0px;';
        this.searchBox.style = 'margin: 10px 10px 10px 10px;';

        Me.settings.connectObject('changed::raven-position', () => this._updatePosition(), this);

        this.updateLocation();

        // store old ArcMenu variables
        this.oldSourceActor = this.arcMenu.sourceActor;
        this.oldFocusActor = this.arcMenu.focusActor;
        this.oldArrowAlignment = this.arcMenu.actor._arrowAlignment;

        this.arcMenu.sourceActor = Main.layoutManager.dummyCursor;
        this.arcMenu.focusActor = Main.layoutManager.dummyCursor;
        this.arcMenu._boxPointer.setPosition(Main.layoutManager.dummyCursor, 0);
        this.arcMenu.close();
        this.arcMenu._boxPointer.hide();

        const homeScreen = Me.settings.get_boolean('enable-unity-homescreen');
        this.activeCategoryName = homeScreen ? _('Pinned') : _('All Programs');

        this.ravenMenuActorStyle = "-arrow-base: 0px; -arrow-rise: 0px; -boxpointer-gap: 0px; -arrow-border-radius: 0px; margin: 0px;";
        this.arcMenu.box.style = "padding: 0px; margin: 0px; border-radius: 25px;";
        this.actionsBoxContainer = new St.BoxLayout({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style_class: "actionsBox",
        });

        this.actionsBox = new St.BoxLayout({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: true,
        });
        this.actionsBoxContainer.add_child(this.actionsBox);
        this.actionsBox.style = "spacing: 5px;";
        this.actionsBoxContainerStyle =  "margin: 0px 0px 0px 0px; spacing: 10px; padding: 5px 0px;"+
                                         "border: none;";


        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
        });
        this.topBox.add_child(this.searchBox);

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });
        this._mainBox.add_child(this.topBox);
        this.add_child(this._mainBox);

        this.applicationsBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            vertical: true,
            style: 'padding-bottom: 10px;',
            style_class: 'arcmenu-margin-box',
        });

        this.applicationsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });

        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this.weatherBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            vertical: true,
            style: 'margin: 0px 10px 10px 10px; spacing: 10px;',
        });

        this._weatherItem = new MW.WeatherSection(this);
        this._clocksItem = new MW.WorldClocksSection(this);
        this._clocksItem.set({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });

        this.weatherBox.add_child(this._clocksItem);
        this.weatherBox.add_child(this._weatherItem);

        this.appShortcuts = [];
        this.shortcutsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: true,
        });

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.column_spacing,
            row_spacing: this.row_spacing,
        });
        this.shortcutsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            layout_manager: layout,
        });
        layout.hookup_style(this.shortcutsGrid);

        this.shortcutsBox.add_child(this.shortcutsGrid);

        const applicationShortcuts = Me.settings.get_value('application-shortcuts-list').deep_unpack();
        for (let i = 0; i < applicationShortcuts.length; i++) {
            const shortcutMenuItem = this.createMenuItem(applicationShortcuts[i], Constants.DisplayType.GRID, false);
            if (shortcutMenuItem.shouldShow)
                this.appShortcuts.push(shortcutMenuItem);
        }

        this.updateLocation();
        this.updateWidth();
        this._updatePosition();
        this.loadCategories();
        this.loadPinnedApps();

        this.setDefaultMenuView();
    }

    _updatePosition() {
        const style = `spacing: 5px;`;

        if (this.contains(this.actionsBoxContainer))
            this.remove_child(this.actionsBoxContainer);

        const ravenPosition = Me.settings.get_enum('raven-position');
        if (ravenPosition === Constants.RavenPosition.LEFT) {
            this.insert_child_at_index(this.actionsBoxContainer, 0);
            this.actionsBoxContainer.style = `border-right-width: 0px;${style}`;
        } else if (ravenPosition === Constants.RavenPosition.RIGHT) {
            this.insert_child_at_index(this.actionsBoxContainer, 1);
            this.actionsBoxContainer.style = `border-left-width: 0px;${style}`;
        }
    }

    updateLocation() {
        const ravenPosition = Me.settings.get_enum('raven-position');

        const alignment = ravenPosition === Constants.RavenPosition.LEFT ? 0 : 1;
        this.arcMenu._boxPointer.setSourceAlignment(alignment);
        this.arcMenu._arrowAlignment = alignment;

        const monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        const monitorWorkArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

        const positionX = ravenPosition === Constants.RavenPosition.LEFT ? monitorWorkArea.x
            : monitorWorkArea.x + monitorWorkArea.width - 1;
        const positionY = this.arcMenu._arrowSide === St.Side.BOTTOM ? monitorWorkArea.y + monitorWorkArea.height
            : monitorWorkArea.y;

        Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);
        const scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        const screenHeight = monitorWorkArea.height;

        const height = Math.round(screenHeight / scaleFactor);
        const style = '-arrow-base: 0px; -arrow-rise: 0px; -boxpointer-gap: 0px;' +
            '-arrow-border-radius: 0px; margin: 0px;';
        this.arcMenu.actor.style = `height: ${height}px;${style}`;
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        const homeScreen = Me.settings.get_boolean('enable-unity-homescreen');
        if (homeScreen) {
            this.activeCategoryName = _('Pinned');
            this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
            this.displayPinnedApps();
            const topCategory = this.categoryDirectories.values().next().value;
            this.setActiveCategory(topCategory);
        } else {
            this.activeCategoryName = _('All Programs');
            const isGridLayout = true;
            this.displayAllApps(isGridLayout);
            this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;
        }
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        const categoryMenuItem = new MW.CategoryMenuItem(this, Constants.CategoryType.HOME_SCREEN,
            Constants.DisplayType.BUTTON);
        this.categoryDirectories.set(Constants.CategoryType.HOME_SCREEN, categoryMenuItem);
        this.hasPinnedApps = true;

        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];

            if (categoryEnum === Constants.CategoryType.PINNED_APPS || !shouldShow)
                continue;

            const extraCategoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.BUTTON);
            this.categoryDirectories.set(categoryEnum, extraCategoryMenuItem);
        }

        super.loadCategories(Constants.DisplayType.BUTTON);
        this.displayCategories();
    }

    displayCategories() {
        for (const categoryMenuItem of this.categoryDirectories.values()) {
            this.actionsBox.add_child(categoryMenuItem);
        }
    }

    displayPinnedApps() {
        if (this.activeCategoryType === Constants.CategoryType.HOME_SCREEN)
            this._clearActorsFromBox(this.applicationsBox);
        else
            this._clearActorsFromBox();

        this.activeCategoryName = _('Pinned');
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
        this.activeCategoryName = _('Shortcuts');
        this._displayAppList(this.appShortcuts, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);

        if (!this.applicationsBox.contains(this.shortcutsBox))
            this.applicationsBox.add_child(this.shortcutsBox);

        const actors = this.weatherBox.get_children();
        for (let i = 0; i < actors.length; i++)
            this.weatherBox.remove_child(actors[i]);

        if (Me.settings.get_boolean('enable-clock-widget-raven'))
            this.weatherBox.add_child(this._clocksItem);

        if (Me.settings.get_boolean('enable-weather-widget-raven'))
            this.weatherBox.add_child(this._weatherItem);

        if (!this._mainBox.contains(this.weatherBox))
            this._mainBox.add_child(this.weatherBox);
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        const label = this._createLabelWithSeparator(_('Recent Files'));
        label.style += 'padding-left: 10px;';
        this.applicationsBox.insert_child_at_index(label, 0);
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _clearActorsFromBox(box) {
        if (this._mainBox.contains(this.weatherBox))
            this._mainBox.remove_child(this.weatherBox);

        super._clearActorsFromBox(box);
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);
        const label = this._createLabelWithSeparator(this.activeCategoryName);

        if (grid === this.applicationsGrid) {
            label.style += 'padding-left: 10px;';
            this.applicationsBox.insert_child_at_index(label, 0);
        } else {
            label.style += 'padding-left: 10px; padding-top: 20px;';
            this.applicationsBox.insert_child_at_index(label, 2);
        }
    }

    destroy() {
        if (this._clocksItem)
            this._clocksItem.destroy();
        if (this._weatherItem)
            this._weatherItem.destroy();

        this.arcMenu.actor.style = null;
        this.arcMenu.box.style = null;
        this.arcMenu.sourceActor = this.oldSourceActor;
        this.arcMenu.focusActor = this.oldFocusActor;
        this.arcMenu._boxPointer.setPosition(this.oldSourceActor, this.oldArrowAlignment);
        this.arcMenu.close();
        this.arcMenu._boxPointer.hide();

        super.destroy();
    }
};
