import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import {IconGrid} from '../iconGrid.js';
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
            search_results_spacing: 5,
            context_menu_location: Constants.ContextMenuLocation.BOTTOM_CENTERED,
            column_spacing: 0,
            row_spacing: 0,
            ...getOrientationProp(true),
            default_menu_width: 650,
            icon_grid_size: Constants.GridIconSize.MEDIUM_RECT,
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

        this.searchEntry.style = 'margin: 5px 15px 10px 15px;';

        this._mainBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            ...getOrientationProp(true),
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
            ...getOrientationProp(false),
        });
        topBox.add_child(this.searchEntry);
        this.insert_child_at_index(topBox, 0);

        this.applicationsBox = new St.BoxLayout({
            ...getOrientationProp(true),
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
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);
        this._mainBox.add_child(this.applicationsScrollBox);

        this.actionsContainerBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.END,
            ...getOrientationProp(false),
        });
        this._mainBox.add_child(this.actionsContainerBox);

        this.actionsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(false),
        });
        this.actionsBox.style = 'spacing: 10px;';
        this.actionsContainerBox.add_child(this.actionsBox);

        this.shortcutsBox = new St.BoxLayout({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
            ...getOrientationProp(true),
            style: 'padding: 0px 25px;',
        });

        this.shortcutsGrid = new IconGrid({
            halign: Clutter.ActorAlign.FILL,
            column_spacing: 10,
            row_spacing: 5,
            force_columns: 2,
        });
        this.shortcutsBox.add_child(this.shortcutsGrid);

        this.applicationsGrid.layout_manager.set({
            force_columns: 1,
            column_spacing: 5,
            row_spacing: 5,
        });
        this.applicationsGrid.halign = Clutter.ActorAlign.FILL;

        ArcMenuManager.settings.connectObject('changed::eleven-layout-extra-shortcuts', () => this._createExtraButtons(), this);
        ArcMenuManager.settings.connectObject('changed::eleven-disable-frequent-apps', () => this.setDefaultMenuView(), this);

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
        const extraButtons = ArcMenuManager.settings.get_value('eleven-layout-extra-shortcuts').deep_unpack();

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

        let leaveButton;
        const powerDisplayStyle = ArcMenuManager.settings.get_enum('power-display-style');
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

        if (ArcMenuManager.settings.get_boolean('eleven-disable-frequent-apps'))
            return;

        const mostUsed = Shell.AppUsage.get_default().get_most_used();

        if (mostUsed.length < 1)
            return;

        const pinnedApps = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();
        const pinnedAppsIds = pinnedApps.map(item => item.id);

        for (let i = 0; i < mostUsed.length; i++) {
            if (!mostUsed[i])
                continue;

            const appInfo = mostUsed[i].get_app_info();
            if (appInfo.should_show() && !pinnedAppsIds.includes(appInfo.get_id())) {
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
        super.displayAllApps();
        this.setGridLayout(Constants.DisplayType.GRID, 0, false);
    }

    updateStyle() {
        const themeNode = this.arcMenu.box.get_theme_node();
        let borderRadius = themeNode.get_length('border-radius');

        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        borderRadius /= scaleFactor;

        const borderRadiusStyle = `border-radius: 0px 0px ${borderRadius}px ${borderRadius}px;`;
        const style = `margin: 0px; spacing: 0px; background-color:rgba(10, 10, 15, 0.1); padding: 12px 25px;
                       border-color: rgba(186, 196,201, 0.2); border-top-width: 1px;`;

        this.actionsContainerBox.style = style + borderRadiusStyle;
        this.arcMenu.box.style = 'padding-bottom: 0px; padding-left: 0px; padding-right: 0px;';
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
        this._hideNavigationButtons();
        this.allAppsButton.visible = true;

        this.loadFrequentApps();
        super.displayPinnedApps();

        if (this.frequentAppsList.length > 0 && !ArcMenuManager.settings.get_boolean('eleven-disable-frequent-apps')) {
            this._displayAppList(this.frequentAppsList, Constants.CategoryType.HOME_SCREEN, this.shortcutsGrid);
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

    _onSearchEntryChanged(searchEntry, searchString) {
        if (!searchEntry.isEmpty())
            this._hideNavigationButtons();
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
