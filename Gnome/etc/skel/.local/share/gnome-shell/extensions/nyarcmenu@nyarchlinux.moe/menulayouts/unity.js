/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GLib, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MW = Me.imports.menuWidgets;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.UNITY;
}

var Menu = class ArcMenuUnityLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 15,
            row_spacing: 15,
            vertical: true,
            default_menu_width: 750,
            icon_grid_style: 'LargeIconGrid',
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        const homeScreen = Me.settings.get_boolean('enable-unity-homescreen');
        this.activeCategoryName = homeScreen ? _('Pinned') : _('All Programs');

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
            style: 'padding-bottom: 10px; padding-right: 15px;',
        });
        this.add_child(this.topBox);

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });
        this.add_child(this._mainBox);

        this.searchBox.set({
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
            style: 'margin: 0px 15px 0px 15px;',
        });
        this.topBox.add_child(this.searchBox);

        this.categoriesButton = new MW.CategoriesButton(this);
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
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            vertical: false,
            style: 'spacing: 10px;',
        });
        this.actionsContainerBox.add_child(this.actionsBox);

        this.widgetBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            vertical: false,
            style_class: 'datemenu-displays-box',
            style: 'margin: 0px; spacing: 10px; padding-bottom: 6px;',
        });

        this._weatherItem = new MW.WeatherSection(this);
        this._clocksItem = new MW.WorldClocksSection(this);

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

        Me.settings.connectObject('changed::unity-extra-buttons', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateStyle();
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this._createCategoriesMenu();

        this.setDefaultMenuView();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();
        const extraButtons = Me.settings.get_value('unity-extra-buttons').deep_unpack();

        if (extraButtons.length === 0)
            return;

        const isContainedInCategory = false;
        for (let i = 0; i < extraButtons.length; i++) {
            const command = extraButtons[i][2];
            if (command === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.VERTICAL);
                this.actionsBox.add_child(separator);
            } else {
                const item = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON, isContainedInCategory);
                if (item.shouldShow)
                    this.actionsBox.add_child(item);
            }
        }
    }

    updateWidth(setDefaultMenuView) {
        super.updateWidth(setDefaultMenuView);

        if (!this.applicationsBox.get_stage())
            return;

        const width = this.menu_width - 80;
        this._weatherItem.style = `width: ${Math.round(5 * width / 8)}px;`;
        this._clocksItem.style = `width: ${Math.round(3 * width / 8)}px;`;
    }

    _createCategoriesMenu() {
        this.categoriesMenu = new PopupMenu.PopupMenu(this.categoriesButton, 0.5, St.Side.TOP);
        this.categoriesMenu.actor.add_style_class_name('popup-menu arcmenu-menu');
        this.categoriesMenu.blockSourceEvents = true;
        this.categoriesMenu.connect('open-state-changed', (menu, open) => {
            if (open) {
                this.categoriesButton.add_style_pseudo_class('active');
                if (this.menuButton.tooltipShowingID) {
                    GLib.source_remove(this.menuButton.tooltipShowingID);
                    this.menuButton.tooltipShowingID = null;
                    this.menuButton.tooltipShowing = false;
                }
                if (this.categoriesButton.tooltip) {
                    this.categoriesButton.tooltip.hide();
                    this.menuButton.tooltipShowing = false;
                }
            } else {
                this.categoriesButton.remove_style_pseudo_class('active');
                this.categoriesButton.active = false;
                this.categoriesButton.sync_hover();
                this.categoriesButton.hovered = this.categoriesButton.hover;
            }
        });
        const section = new PopupMenu.PopupMenuSection();
        this.categoriesMenu.addMenuItem(section);

        const categoriesPopupBox = new St.BoxLayout({vertical: true});
        section.actor.add_child(categoriesPopupBox);
        categoriesPopupBox._delegate = categoriesPopupBox;

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        categoriesPopupBox.add_child(this.categoriesScrollBox);

        this.categoriesBox = new St.BoxLayout({vertical: true});
        this.categoriesScrollBox.add_actor(this.categoriesBox);

        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const scaleFactor = themeContext.scale_factor;
        const height =  Math.round(350 / scaleFactor);

        categoriesPopupBox.style = `max-height: ${height}px`;

        this._displayCategories();
        this.subMenuManager.addMenu(this.categoriesMenu);
        this.categoriesMenu.actor.hide();
        Main.uiGroup.add_child(this.categoriesMenu.actor);
    }

    toggleCategoriesMenu() {
        const appsScrollBoxAdj = this.categoriesScrollBox.get_vscroll_bar().get_adjustment();
        appsScrollBoxAdj.set_value(0);

        this.categoriesMenu.toggle();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        const homeScreen = Me.settings.get_boolean('enable-unity-homescreen');
        if (homeScreen) {
            this.activeCategoryName = _('Pinned');
            this.activeCategoryType = Constants.CategoryType.HOME_SCREEN;
            this.displayPinnedApps();
        } else {
            this.activeCategoryName = _('All Programs');
            const isGridLayout = true;
            this.displayAllApps(isGridLayout);
            this.activeCategoryType = Constants.CategoryType.ALL_PROGRAMS;
        }
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');
        const monitorIndex = Main.layoutManager.findIndexForActor(this.menuButton);
        const scaleFactor = Main.layoutManager.monitors[monitorIndex].geometry_scale;
        borderRadius /= scaleFactor;

        const borderRadiusStyle = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const style = `margin: 0px; spacing: 0px; background-color: rgba(10, 10, 15, 0.1); padding: 5px 5px;
                       border-color: rgba(186, 196,201, 0.2); border-top-width: 1px;`;

        this.actionsContainerBox.style = style + borderRadiusStyle;
        this.arcMenu.box.style = 'padding-bottom: 0px; padding-left: 0px; padding-right: 0px;';
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        const categoryMenuItem = new MW.CategoryMenuItem(this, Constants.CategoryType.HOME_SCREEN,
            Constants.DisplayType.LIST);
        this.categoryDirectories.set(Constants.CategoryType.HOME_SCREEN, categoryMenuItem);
        this.hasPinnedApps = true;

        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];
            if (categoryEnum === Constants.CategoryType.PINNED_APPS || !shouldShow)
                continue;

            const extraCategoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum,
                Constants.DisplayType.LIST);
            this.categoryDirectories.set(categoryEnum, extraCategoryMenuItem);
        }

        super.loadCategories();
    }

    _displayCategories() {
        let hasExtraCategory = false;
        let separatorAdded = false;

        for (const categoryMenuItem of this.categoryDirectories.values()) {
            const isExtraCategory = categoryMenuItem.isExtraCategory();

            if (!hasExtraCategory) {
                hasExtraCategory = isExtraCategory;
            } else if (!isExtraCategory && !separatorAdded) {
                this.categoriesBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL));
                separatorAdded = true;
            }

            this.categoriesBox.add_actor(categoryMenuItem);
        }
    }

    displayPinnedApps() {
        if (this.activeCategoryType === Constants.CategoryType.HOME_SCREEN)
            this._clearActorsFromBox(this.applicationsBox);
        else
            this._clearActorsFromBox();

        this._mainBox.remove_child(this.actionsContainerBox);

        this.activeCategoryName = _('Pinned');
        this._displayAppList(this.pinnedAppsArray, Constants.CategoryType.PINNED_APPS, this.applicationsGrid);
        this.activeCategoryName = _('Shortcuts');
        this._displayAppList(this.appShortcuts, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);

        if (!this.applicationsBox.contains(this.shortcutsBox))
            this.applicationsBox.add_child(this.shortcutsBox);

        this.widgetBox.remove_all_children();

        if (Me.settings.get_boolean('enable-clock-widget-unity'))
            this.widgetBox.add_child(this._clocksItem);
        if (Me.settings.get_boolean('enable-weather-widget-unity'))
            this.widgetBox.add_child(this._weatherItem);
        if (!this._mainBox.contains(this.widgetBox))
            this._mainBox.add_child(this.widgetBox);

        this._mainBox.add_child(this.actionsContainerBox);
    }

    displayRecentFiles() {
        super.displayRecentFiles();
        const label = this._createLabelWithSeparator(_('Recent Files'));
        this.applicationsBox.insert_child_at_index(label, 0);
        this.activeCategoryType = Constants.CategoryType.RECENT_FILES;
    }

    displayCategoryAppList(appList, category) {
        this._clearActorsFromBox();
        this._displayAppList(appList, category, this.applicationsGrid);
    }

    _clearActorsFromBox(box) {
        if (this.categoriesMenu.isOpen)
            this.categoriesMenu.toggle();
        if (this._mainBox.contains(this.widgetBox))
            this._mainBox.remove_child(this.widgetBox);

        super._clearActorsFromBox(box);
    }

    _displayAppList(apps, category, grid) {
        super._displayAppList(apps, category, grid);

        const label = this._createLabelWithSeparator(this.activeCategoryName);
        if (grid === this.applicationsGrid)
            this.applicationsBox.insert_child_at_index(label, 0);
        else
            this.applicationsBox.insert_child_at_index(label, 2);
    }

    destroy() {
        if (this._clocksItem)
            this._clocksItem.destroy();
        if (this._weatherItem)
            this._weatherItem.destroy();

        this.arcMenu.box.style = null;

        super.destroy();
    }
};
