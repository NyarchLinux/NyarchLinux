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
    return Constants.MenuLayout.MINT;
}

var Menu = class ArcMenuMintLayout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            has_search: true,
            is_dual_panel: true,
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            context_menu_location: Constants.ContextMenuLocation.RIGHT,
            column_spacing: 0,
            row_spacing: 0,
            supports_category_hover_activation: true,
            vertical: false,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.MEDIUM_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        // Stores the Pinned Icons on the left side
        this.actionsScrollBox = this._createScrollBox({
            x_expand: false,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'small-vfade',
            style: `padding: 10px 0px; width: 62px; margin: 0px 8px 0px 0px; 
                    background-color:rgba(10, 10, 15, 0.1); border-color:rgba(186, 196,201, 0.2); 
                    border-width: 1px; border-radius: 8px;`,
        });
        this.actionsScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
        this.actionsBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 10px;',
        });
        this.actionsScrollBox.add_actor(this.actionsBox);
        this.add_child(this.actionsScrollBox);

        // contains searchbar, rightBox, leftBox
        this.rightPanelParentBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
            vertical: true,
        });
        this.add_child(this.rightPanelParentBox);

        this._mainBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.FILL,
        });
        this.rightPanelParentBox.add_child(this._mainBox);

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

        this.categoriesScrollBox = this._createScrollBox({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.leftBox.add_child(this.categoriesScrollBox);
        this.categoriesBox = new St.BoxLayout({vertical: true});
        this.categoriesScrollBox.add_actor(this.categoriesBox);

        this.searchBox.style = 'margin: 0px;';
        const searchBarLocation = Me.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchBox.add_style_class_name('arcmenu-search-top');
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MAX,
                Constants.SeparatorAlignment.HORIZONTAL);

            this.rightPanelParentBox.insert_child_at_index(this.searchBox, 0);
            this.rightPanelParentBox.insert_child_at_index(separator, 1);
        } else if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchBox.add_style_class_name('arcmenu-search-bottom');
            const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MAX,
                Constants.SeparatorAlignment.HORIZONTAL);

            this.rightPanelParentBox.add_child(separator);
            this.rightPanelParentBox.add_child(this.searchBox);
        }

        Me.settings.connectObject('changed::mint-extra-buttons', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();
        const extraButtons = Me.settings.get_value('mint-extra-buttons').deep_unpack();

        if (extraButtons.length === 0)
            return;

        const isContainedInCategory = false;

        for (let i = 0; i < extraButtons.length; i++) {
            const command = extraButtons[i][2];
            if (command === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(Constants.SeparatorStyle.MEDIUM,
                    Constants.SeparatorAlignment.HORIZONTAL);
                this.actionsBox.add_child(separator);
            } else {
                const item = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON, isContainedInCategory);
                if (item.shouldShow)
                    this.actionsBox.add_child(item);
            }
        }
    }

    updateWidth(setDefaultMenuView) {
        const leftPanelWidthOffset = 0;
        const rightPanelWidthOffset = 45;
        super.updateWidth(setDefaultMenuView, leftPanelWidthOffset, rightPanelWidthOffset);
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
