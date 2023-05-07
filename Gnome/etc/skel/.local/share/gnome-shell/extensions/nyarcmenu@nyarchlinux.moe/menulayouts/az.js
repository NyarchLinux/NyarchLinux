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
    return Constants.MenuLayout.AZ;
}

var Menu = class ArcMenuAzLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 4,
            row_spacing: 4,
            vertical: true,
            default_menu_width: 460,
            icon_grid_style: 'LargeRectIconGrid',
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.connect('button-press-event', (actor, event) => {
            if (this.backButton.visible && event.get_button() === 8)
                this.backButton.activate(event);
        });

        this.searchBox.style = 'margin: 5px 10px;';
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });
        this.add_child(this._mainBox);

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
        });
        this._mainBox.add_child(this.topBox);

        const navButtonsStyle = 'padding: 0px 10px 10px 15px;';
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

        this.applicationsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            style: 'padding-bottom: 10px;',
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

        this.bottomBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
        });
        this._mainBox.add_child(this.bottomBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false,
        });
        this.actionsBox.style = 'margin: 0px 10px; spacing: 10px;';

        const searchBarLocation = Me.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.topBox.add_child(this.searchBox);
            this.bottomBox.add_child(this.actionsBox);
        } else {
            this.topBox.add_child(this.actionsBox);
            this.bottomBox.add_child(this.searchBox);
        }

        Me.settings.connectObject('changed::az-extra-buttons', () => this._createExtraButtons(), this);
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
        const extraButtons = Me.settings.get_value('az-extra-buttons').deep_unpack();

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

        const powerDisplayStyle = Me.settings.get_enum('power-display-style');
        let leaveButton;
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

    setDefaultMenuView() {
        this.setGridLayout(Constants.DisplayType.GRID, 4);
        super.setDefaultMenuView();

        this.displayPinnedApps();
    }

    displayAllApps() {
        this.setGridLayout(Constants.DisplayType.LIST, 3);
        const appList = [];
        this.applicationsMap.forEach((value, key, _map) => {
            appList.push(key);
        });
        appList.sort((a, b) => {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        this._clearActorsFromBox();
        this._displayAppList(appList, Constants.CategoryType.ALL_PROGRAMS, this.applicationsGrid);
        this.setGridLayout(Constants.DisplayType.GRID, 4, false);
    }

    _setBoxStyle(box, additionalStyle) {
        const style = `margin: 0px; spacing: 0px; background-color: rgba(10, 10, 15, 0.1); padding: 11px 0px;
                       border-color:rgba(186, 196,201, 0.2);`;

        if (box === this.topBox)
            additionalStyle += 'border-bottom-width: 1px; margin-bottom: 10px;';
        else if (box === this.bottomBox)
            additionalStyle += 'border-top-width: 1px;';

        box.style = style + additionalStyle;
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        const monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        const scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        borderRadius /= scaleFactor;

        const roundBottomBorder = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const roundTopBorder = `border-radius: ${borderRadius}px ${borderRadius}px 0px 0px;`;
        this._setBoxStyle(this.bottomBox, roundBottomBorder);
        this._setBoxStyle(this.topBox, roundTopBorder);
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';
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
        this._clearActorsFromBox();
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);

        this._hideNavigationRow();

        if (category === Constants.CategoryType.PINNED_APPS)
            this.allAppsButton.visible = true;
        else if (category === Constants.CategoryType.ALL_PROGRAMS)
            this.backButton.visible = true;
    }

    _hideNavigationRow() {
        this.allAppsButton.visible = false;
        this.backButton.visible = false;
    }

    _onSearchBoxChanged(searchBox, searchString) {
        if (!searchBox.isEmpty())
            this._hideNavigationRow();
        super._onSearchBoxChanged(searchBox, searchString);
    }

    destroy() {
        this.arcMenu.box.style = null;
        this.backButton.destroy();
        this.allAppsButton.destroy();
        super.destroy();
    }
};
