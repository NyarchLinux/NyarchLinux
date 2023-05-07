/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, Shell, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.ELEVEN;
}

var Menu = class ArcMenuElevenLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 0,
            row_spacing: 0,
            vertical: true,
            default_menu_width: 650,
            icon_grid_style: 'MediumRectIconGrid',
            category_icon_size: Constants.LARGE_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.LARGE_ICON_SIZE,
        });

        this.connect('button-press-event', (actor, event) => {
            if (this.backButton.visible && event.get_button() === 8)
                this.backButton.activate(event);
        });

        this.searchBox.style = 'margin: 5px 15px 10px 15px;';

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });
        this.add_child(this._mainBox);

        const navButtonsStyle = 'padding: 0px 20px 10px 25px;';
        this.backButton = this._createNavigationRow(_('All Apps'), Constants.Direction.GO_PREVIOUS,
            _('Back'), () => this.setDefaultMenuView());
        this.backButton.set({
            style: navButtonsStyle,
            visible: false,
        });
        this._mainBox.add_child(this.backButton);

        this.allAppsButton = this._createNavigationRow(_('Pinned'), Constants.Direction.GO_NEXT,
            _('All Apps'), () => this.displayAllApps());
        this.allAppsButton.set({
            style: navButtonsStyle,
            visible: false,
        });
        this._mainBox.add_child(this.allAppsButton);

        this.frequentAppsHeader = this.createLabelRow(_('Frequent'));

        this.frequentAppsHeader.label.y_align = Clutter.ActorAlign.CENTER;
        this.frequentAppsHeader.style = 'padding: 10px 20px;';

        const topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
        });
        topBox.add_child(this.searchBox);
        this.insert_child_at_index(topBox, 0);

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            style: 'padding-bottom: 10px; spacing: 8px;',
            style_class: 'arcmenu-margin-box',
        });
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this.actionsContainerBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
        });
        this._mainBox.add_child(this.actionsContainerBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false,
        });
        this.actionsBox.style = 'spacing: 10px;';
        this.actionsContainerBox.add_child(this.actionsBox);

        this.shortcutsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: true,
            style: 'padding: 0px 25px;',
        });

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: 10,
            row_spacing: 5,
            column_homogeneous: true,
        });
        this.shortcutsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            layout_manager: layout,
        });
        layout.hookup_style(this.shortcutsGrid);
        layout.forceGridColumns = 2;
        this.shortcutsBox.add_child(this.shortcutsGrid);

        Me.settings.connectObject('changed::eleven-extra-buttons', () => this._createExtraButtons(), this);
        Me.settings.connectObject('changed::eleven-disable-frequent-apps', () => this.setDefaultMenuView(), this);

        this._createExtraButtons();
        this.updateStyle();
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        const userMenuItem = new MW.UserMenuItem(this, Constants.DisplayType.LIST);
        this.actionsBox.add_child(userMenuItem);

        const isContainedInCategory = false;
        const extraButtons = Me.settings.get_value('eleven-extra-buttons').deep_unpack();

        for (let i = 0; i < extraButtons.length; i++) {
            const command = extraButtons[i][2];
            if (command === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.VERTICAL);
                separator.x_expand = false;
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
            leaveButton = new MW.PowerOptionsBox(this);
        else
            leaveButton = new MW.LeaveButton(this);

        this.actionsBox.add_child(leaveButton);
    }

    loadPinnedApps() {
        this.display_type = Constants.DisplayType.GRID;
        super.loadPinnedApps();
    }

    loadFrequentApps() {
        this.frequentAppsList = [];

        if (Me.settings.get_boolean('eleven-disable-frequent-apps'))
            return;

        const mostUsed = Shell.AppUsage.get_default().get_most_used();

        if (mostUsed.length < 1)
            return;

        const pinnedApps = Me.settings.get_strv('pinned-app-list');

        for (let i = 0; i < mostUsed.length; i++) {
            if (!mostUsed[i])
                continue;

            const appInfo = mostUsed[i].get_app_info();
            if (appInfo.should_show() && !pinnedApps.includes(appInfo.get_id())) {
                const item = new MW.ApplicationMenuItem(this, mostUsed[i], Constants.DisplayType.LIST);
                this.frequentAppsList.push(item);
            }
        }

        const MaxItems = 8;
        if (this.frequentAppsList.length > MaxItems)
            this.frequentAppsList.splice(MaxItems);
    }

    setDefaultMenuView() {
        this.setGridLayout(Constants.DisplayType.GRID, 0);
        super.setDefaultMenuView();
        this.displayPinnedApps();
    }

    _clearActorsFromBox(box) {
        super._clearActorsFromBox(box);
    }

    displayAllApps() {
        this.setGridLayout(Constants.DisplayType.LIST, 5);
        const appList = [];
        this.applicationsMap.forEach((value, key, _map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        this._clearActorsFromBox();
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);
        this.setGridLayout(Constants.DisplayType.GRID, 0, false);
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        const monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        const scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        borderRadius /= scaleFactor;

        const borderRadiusStyle = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const style = `margin: 0px; spacing: 0px; background-color:rgba(10, 10, 15, 0.1); padding: 12px 25px;
                       border-color: rgba(186, 196,201, 0.2); border-top-width: 1px;`;

        this.actionsContainerBox.style = style + borderRadiusStyle;
        this.arcMenu.box.style = 'padding-bottom: 0px; padding-left: 0px; padding-right: 0px;';
    }

    setGridLayout(displayType, spacing, setStyle = true) {
        if (setStyle) {
            this.applicationsGrid.x_align = displayType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER;
        }

        this.applicationsGrid.layout_manager.column_spacing = spacing;
        this.applicationsGrid.layout_manager.row_spacing = spacing;
        this.display_type = displayType;
    }

    loadCategories() {
        this.display_type = Constants.DisplayType.LIST;
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    displayPinnedApps() {
        this.loadFrequentApps();
        this._clearActorsFromBox(this.applicationsBox);
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);

        if (this.frequentAppsList.length > 0 && !Me.settings.get_boolean('eleven-disable-frequent-apps')) {
            this.setGridLayout(Constants.DisplayType.GRID, 0);
            this._displayAppList(this.frequentAppsList, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);
            this.setGridLayout(Constants.DisplayType.GRID, 0);
            if (!this.applicationsBox.contains(this.shortcutsBox))
                this.applicationsBox.add_child(this.shortcutsBox);
        } else if (this.applicationsBox.contains(this.shortcutsBox)) {
            this.applicationsBox.remove_child(this.shortcutsBox);
        }
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);

        this._hideNavigationButtons();

        if (category === Constants.CategoryType.HOME_SCREEN || category === Constants.CategoryType.PINNED_APPS) {
            this.allAppsButton.visible = true;
            if (!this.applicationsBox.contains(this.frequentAppsHeader))
                this.applicationsBox.insert_child_at_index(this.frequentAppsHeader, 2);
        } else if (category === Constants.CategoryType.ALL_PROGRAMS) {
            this.backButton.visible = true;
        }
    }

    _hideNavigationButtons() {
        this.allAppsButton.visible = false;
        this.backButton.visible = false;
    }

    _onSearchBoxChanged(searchBox, searchString) {
        if (!searchBox.isEmpty())
            this._hideNavigationButtons();
        super._onSearchBoxChanged(searchBox, searchString);
    }

    destroy() {
        this.arcMenu.box.style = null;
        this.backButton.destroy();
        this.allAppsButton.destroy();

        super.destroy();
    }
};
