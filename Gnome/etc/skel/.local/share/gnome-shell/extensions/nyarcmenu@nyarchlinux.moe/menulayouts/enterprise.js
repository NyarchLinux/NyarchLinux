/* eslint-disable jsdoc/require-jsdoc */
/* exported getMenuLayoutEnum, Menu */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, GObject, St} = imports.gi;
const {BaseMenuLayout} = Me.imports.menulayouts.baseMenuLayout;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const MW = Me.imports.menuWidgets;
const _ = Gettext.gettext;

function getMenuLayoutEnum() {
    return Constants.MenuLayout.ENTERPRISE;
}

var Menu = class ArcMenuEnterpriseLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            is_dual_panel: true,
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            supports_category_hover_activation: true,
            column_spacing: 4,
            row_spacing: 4,
            vertical: true,
            default_menu_width: 450,
            icon_grid_style: 'LargeRectIconGrid',
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            vertical: false,
            style: 'spacing: 6px; margin: 0px 6px; padding: 3px 0px;',
        });

        this.userMenuBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
        });
        this.userMenuIcon = new MW.UserMenuIcon(this, 36, true);
        this.userMenuIcon.set({
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
        });
        this.userMenuIcon.label.set({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold;',
        });

        this.searchBox.set({
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: false,
        });
        this.add_child(this._mainBox);

        this.rightBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });

        this.applicationsBox = new St.BoxLayout({vertical: true});
        this.applicationsScrollBox = this._createScrollBox({
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.rightBox.add_child(this.applicationsScrollBox);

        this.leftBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });

        const verticalSeparator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.VERTICAL);

        const horizontalFlip = Me.settings.get_boolean('enable-horizontal-flip');
        this._mainBox.add_child(horizontalFlip ? this.rightBox : this.leftBox);
        this._mainBox.add_child(verticalSeparator);
        this._mainBox.add_child(horizontalFlip ? this.leftBox : this.rightBox);
        this.topBox.add_child(horizontalFlip ? this.searchBox : this.userMenuBox);
        this.topBox.add_child(horizontalFlip ? this.userMenuBox : this.searchBox);
        this.userMenuBox.add_child(horizontalFlip ? this.userMenuIcon.label : this.userMenuIcon);
        this.userMenuBox.add_child(horizontalFlip ? this.userMenuIcon : this.userMenuIcon.label);
        this.userMenuIcon.label.style += horizontalFlip ? 'padding-right: 14px;' : 'padding-left: 14px;';
        this.userMenuBox.x_align = horizontalFlip ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });

        this.leftBox.add_child(this.categoriesScrollBox);
        this.categoriesBox = new St.BoxLayout({vertical: true});
        this.categoriesScrollBox.add_actor(this.categoriesBox);

        let powerOptionsDisplay;
        const powerDisplayStyle = Me.settings.get_enum('power-display-style');
        if (powerDisplayStyle === Constants.PowerDisplayStyle.MENU) {
            powerOptionsDisplay = new MW.LeaveButton(this, true);
        } else {
            powerOptionsDisplay = new MW.PowerOptionsBox(this);
            powerOptionsDisplay.set({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
        }
        this.leftBox.add_child(new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL));
        this.leftBox.add_child(powerOptionsDisplay);

        const searchbarLocation = Me.settings.get_enum('searchbar-default-top-location');
        const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
            Constants.SeparatorAlignment.HORIZONTAL);

        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.insert_child_at_index(separator, 0);
            this.insert_child_at_index(this.topBox, 0);
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.add_child(separator);
            this.add_child(this.topBox);
        }

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidthOffset = 70;
        const leftPanelWidth = Me.settings.get_int('left-panel-width') - leftPanelWidthOffset;
        this.leftBox.style = `width: ${leftPanelWidth}px;`;

        const widthAdjustment = Me.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        this.searchBox.style = `width: ${menuWidth - 26}px;`;

        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();
        this.displayCategories();

        const topCategory = this.categoryDirectories.values().next().value;
        topCategory.displayAppList();
        this.setActiveCategory(topCategory);
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();

        const extraCategories = Me.settings.get_value('extra-categories').deep_unpack();
        for (let i = 0; i < extraCategories.length; i++) {
            const categoryEnum = extraCategories[i][0];
            const shouldShow = extraCategories[i][1];
            if (shouldShow) {
                const categoryMenuItem = new MW.CategoryMenuItem(this, categoryEnum, Constants.DisplayType.LIST);
                this.categoryDirectories.set(categoryEnum, categoryMenuItem);
            }
        }

        super.loadCategories();
    }

    displayCategories() {
        super.displayCategories(this.categoriesBox);
    }
};
