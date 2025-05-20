import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            search_results_spacing: 4,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 4,
            row_spacing: 4,
            ...getOrientationProp(true),
            default_menu_width: 460,
            icon_grid_size: Constants.GridIconSize.LARGE_RECT,
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

        this.searchEntry.style = 'margin: 5px 10px;';
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
        });
        this.add_child(this._mainBox);

        this.topBox = new St.BoxLayout({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(false),
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
            ...getOrientationProp(true),
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
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this.bottomBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            ...getOrientationProp(false),
        });
        this._mainBox.add_child(this.bottomBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(false),
        });
        this.actionsBox.style = 'margin: 0px 10px; spacing: 10px;';

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.topBox.add_child(this.searchEntry);
            this.bottomBox.add_child(this.actionsBox);
        } else {
            this.topBox.add_child(this.actionsBox);
            this.bottomBox.add_child(this.searchEntry);
        }

        ArcMenuManager.settings.connectObject('changed::az-layout-extra-shortcuts', () => this._createExtraButtons(), this);
        this._createExtraButtons();

        this.updateStyle();
        this.updateWidth();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this._connectAppChangedEvents();
    }

    _createExtraButtons() {
        this.actionsBox.destroy_all_children();

        const avatarMenuItem = new MW.AvatarMenuItem(this, Constants.DisplayType.LIST);
        this.actionsBox.add_child(avatarMenuItem);

        const isContainedInCategory = false;
        const extraButtons = ArcMenuManager.settings.get_value('az-layout-extra-shortcuts').deep_unpack();

        for (let i = 0; i < extraButtons.length; i++) {
            const {id} = extraButtons[i];
            if (id === Constants.ShortcutCommands.SEPARATOR) {
                const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.LONG,
                    Constants.SeparatorAlignment.VERTICAL);
                separator.x_expand = false;
                this.actionsBox.add_child(separator);
            } else {
                const button = this.createMenuItem(extraButtons[i], Constants.DisplayType.BUTTON,
                    isContainedInCategory);
                if (button.shouldShow)
                    this.actionsBox.add_child(button);
                else
                    button.destroy();
            }
        }

        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
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
        this.setGridLayout(Constants.DisplayType.LIST, 4);
        super.displayAllApps();
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
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        borderRadius /= scaleFactor;

        const roundBottomBorder = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const roundTopBorder = `border-radius: ${borderRadius}px ${borderRadius}px 0px 0px;`;
        this._setBoxStyle(this.bottomBox, roundBottomBorder);
        this._setBoxStyle(this.topBox, roundTopBorder);
        this.arcMenu.box.style = 'padding: 0px; margin: 0px;';
    }

    setGridLayout(displayType, spacing, setStyle = true) {
        if (setStyle) {
            if (displayType === Constants.DisplayType.LIST)
                this.applicationsScrollBox.style_class = this._disableFadeEffect ? '' : 'small-vfade';
            else
                this.applicationsScrollBox.style_class = this._disableFadeEffect ? '' : 'vfade';
            this.applicationsGrid.halign = displayType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
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
        super.displayPinnedApps();
        this._hideNavigationRow();

        this.allAppsButton.visible = true;
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

    _onSearchEntryChanged(searchEntry, searchString) {
        if (!searchEntry.isEmpty())
            this._hideNavigationRow();
        super._onSearchEntryChanged(searchEntry, searchString);
    }

    _onDestroy() {
        if (this.arcMenu)
            this.arcMenu.box.style = null;
        this.backButton.destroy();
        this.allAppsButton.destroy();
        super._onDestroy();
    }
}
