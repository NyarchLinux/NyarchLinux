/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.INSIDER;
}

var Menu = class ArcMenuInsiderLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 10,
            row_spacing: 10,
            default_menu_width: 525,
            icon_grid_style: 'SmallIconGrid',
            vertical: false,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.actionsBox = new St.BoxLayout({
            x_expand: false,
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

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
        });
        this.add_child(this._mainBox);

        const userMenuBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
            style: 'padding-top: 9px;',
        });
        const userMenuIcon = new MW.UserMenuIcon(this, 75, true);
        userMenuIcon.label.set({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-size: large;',
        });
        userMenuBox.add_child(userMenuIcon);
        userMenuBox.add_child(userMenuIcon.label);
        this._mainBox.add_child(userMenuBox);

        this.searchBox.style = 'margin: 10px;';
        this._mainBox.add_child(this.searchBox);

        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        Me.settings.connectObject('changed::insider-extra-buttons', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();

        this._createPinnedAppsMenu();
        this.setDefaultMenuView();
        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        this.pinnedAppsButton = new MW.PinnedAppsButton(this);
        this.pinnedAppsButton.y_expand = true;
        this.pinnedAppsButton.y_align = Clutter.ActorAlign.START;
        this.actionsBox.add_child(this.pinnedAppsButton);

        const isContainedInCategory = false;
        const extraButtons = Me.settings.get_value('insider-extra-buttons').deep_unpack();

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

    loadPinnedApps() {
        this.display_type = Constants.DisplayType.LIST;
        super.loadPinnedApps();
        this.display_type = Constants.DisplayType.GRID;
    }

    _createPinnedAppsMenu() {
        this.pinnedAppsMenu = new PopupMenu.PopupMenu(Main.layoutManager.dummyCursor, 0, St.Side.TOP);
        this.pinnedAppsMenu.actor.add_style_class_name('popup-menu arcmenu-menu');

        const section = new PopupMenu.PopupMenuSection();
        this.pinnedAppsMenu.addMenuItem(section);

        const pinnedAppsPopupBox = new St.BoxLayout({vertical: true});
        pinnedAppsPopupBox._delegate = pinnedAppsPopupBox;
        section.actor.add_child(pinnedAppsPopupBox);

        const headerBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: true,
        });
        pinnedAppsPopupBox.add_child(headerBox);

        this.backButton = new MW.BackButton(this);
        this.backButton.connectObject('activate', () => this.togglePinnedAppsMenu(), this);
        headerBox.add_child(this.backButton);

        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);
        headerBox.add_child(separator);
        headerBox.add_child(this.createLabelRow(_('Pinned')));

        this.pinnedAppsScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        pinnedAppsPopupBox.add_child(this.pinnedAppsScrollBox);

        this.pinnedAppsBox = new St.BoxLayout({vertical: true});
        this.pinnedAppsScrollBox.add_actor(this.pinnedAppsBox);

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: 0,
            row_spacing: 0,
        });
        this.pinnedAppsGrid = new St.Widget({
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            layout_manager: layout,
        });
        layout.forceGridColumns = 1;
        layout.hookup_style(this.pinnedAppsGrid);

        const height = Me.settings.get_int('menu-height');
        this.pinnedAppsMenu.actor.style = `height: ${height}px;`;

        this.displayPinnedApps();
        this.subMenuManager.addMenu(this.pinnedAppsMenu);
        this.pinnedAppsMenu.actor.hide();
        Main.uiGroup.add_child(this.pinnedAppsMenu.actor);
        this.pinnedAppsMenu.connectObject('open-state-changed', (menu, open) => {
            if (!open) {
                this.pinnedAppsButton.active = false;
                this.pinnedAppsButton.sync_hover();
                this.pinnedAppsButton.hovered = this.pinnedAppsButton.hover;
            }
        }, this);
    }

    togglePinnedAppsMenu() {
        const appsScrollBoxAdj = this.pinnedAppsScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        const themeNode = this.arcMenu.actor.get_theme_node();
        const rise = themeNode.get_length('-arrow-rise');

        this.arcMenu.actor.get_allocation_box();
        let [x, y] = this.arcMenu.actor.get_transformed_position();

        if (this.arcMenu._arrowSide !== St.Side.TOP)
            y -= rise;
        if (this.arcMenu._arrowSide === St.Side.LEFT)
            x += rise;

        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        this.pinnedAppsMenu.toggle();
        if (this.pinnedAppsMenu.isOpen) {
            this.activeMenuItem = this.backButton;
            this.backButton.grab_key_focus();
        }
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.displayAllApps();
        this.activeMenuItem = this.applicationsGrid.layout_manager.get_child_at(0, 0);

        if (!this.applicationsBox.contains(this.applicationsGrid))
            this.applicationsBox.add_child(this.applicationsGrid);

        const appsScrollBoxAdj = this.pinnedAppsScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
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
        this._clearActorsFromBox(this.pinnedAppsBox);
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.pinnedAppsGrid);
        if (!this.pinnedAppsBox.contains(this.pinnedAppsGrid))
            this.pinnedAppsBox.add_child(this.pinnedAppsGrid);
    }
};
