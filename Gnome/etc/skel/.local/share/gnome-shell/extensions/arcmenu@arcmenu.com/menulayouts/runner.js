import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import * as MW from '../menuWidgets.js';
import {getOrientationProp} from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const Spacing = 6;

export const MenuView = {
    DEFAULT: 0,
    PINNED_APPS: 1,
    FREQUENT_APPS: 2,
};

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton, isStandalone) {
        super(menuButton, {
            display_type: Constants.DisplayType.LIST,
            search_display_type: Constants.DisplayType.LIST,
            column_spacing: 0,
            row_spacing: 0,
            ...getOrientationProp(true),
            icon_grid_size: Constants.GridIconSize.MEDIUM_RECT,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            quicklinks_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            buttons_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            pinned_apps_icon_size: Constants.EXTRA_SMALL_ICON_SIZE,
            is_standalone_runner: !!isStandalone,
            can_hide_search: false,
        });

        this.style = `spacing: ${Spacing}px;`;

        this.activeMenuItem = null;

        this.updateLocation();

        // store old ArcMenu variables
        this.oldSourceActor = this.arcMenu.sourceActor;
        this.oldFocusActor = this.arcMenu.focusActor;
        this.oldArrowAlignment = this.arcMenu.actor._arrowAlignment;

        this.arcMenu.sourceActor = Main.layoutManager.dummyCursor;
        this.arcMenu.focusActor = Main.layoutManager.dummyCursor;
        this.arcMenu._boxPointer.setPosition(Main.layoutManager.dummyCursor, 0.5);

        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            y_align: Clutter.ActorAlign.START,
            ...getOrientationProp(false),
            style: `spacing: ${Spacing}px;`,
        });
        this.runnerTweaksButton = new RunnerTweaksButton(this);
        this.runnerTweaksButton.set({
            x_expand: false,
            y_expand: true,
            y_align: this.searchEntry.y_align = Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.topBox.add_child(this.searchEntry);
        this.topBox.add_child(this.runnerTweaksButton);
        ArcMenuManager.settings.bind('runner-show-settings-button', this.runnerTweaksButton, 'visible', Gio.SettingsBindFlags.DEFAULT);

        this.applicationsScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            x_align: Clutter.ActorAlign.FILL,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
            visible: false,
        });

        this.applicationsBox = new St.BoxLayout({
            ...getOrientationProp(true),
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);

        ArcMenuManager.settings.connectObject('changed::runner-searchbar-location', () => this._setSearchbarLocation(), this);
        ArcMenuManager.settings.connectObject('changed::runner-menu-height-static', () => this.updateLocation(), this);
        ArcMenuManager.settings.connectObject('changed::runner-search-display-style', () => this._updateSearchDisplayStyle(), this);
        this._setSearchbarLocation();

        this._updateSearchDisplayStyle();
        this.loadCategories();
        this.loadPinnedApps();
        this.setDefaultMenuView();
        this.updateWidth();
        this._connectAppChangedEvents();
    }

    _updateSearchDisplayStyle() {
        const searchDisplayStyle = ArcMenuManager.settings.get_enum('runner-search-display-style');

        let columnSpacing, rowSpacing;
        if (searchDisplayStyle === Constants.DisplayType.LIST) {
            columnSpacing = 0;
            rowSpacing = 0;
        } else {
            columnSpacing = 15;
            rowSpacing = 15;
        }

        this.set({
            search_display_type: searchDisplayStyle,
            column_spacing: columnSpacing,
            row_spacing: rowSpacing,
        });
    }

    _setSearchbarLocation() {
        this.remove_all_children();
        const searchbarLocation = ArcMenuManager.settings.get_enum('runner-searchbar-location');
        if (searchbarLocation === Constants.SearchbarLocation.TOP) {
            this.add_child(this.topBox);
            this.add_child(this.applicationsScrollBox);
            this.topBox.set({
                y_align: Clutter.ActorAlign.START,
                y_expand: false,
            });
        } else if (searchbarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.add_child(this.applicationsScrollBox);
            this.add_child(this.topBox);
            this.topBox.set({
                y_align: Clutter.ActorAlign.END,
                y_expand: true,
            });
        }
    }

    updateWidth(setDefaultMenuView) {
        const width = ArcMenuManager.settings.get_int('runner-menu-width') - Spacing;
        this.menu_width = width;
        if (setDefaultMenuView)
            this.setDefaultMenuView();
    }

    setDefaultMenuView() {
        this.activeMenuItem = null;
        super.setDefaultMenuView();
        const defaultView = ArcMenuManager.settings.get_enum('default-menu-view-runner');

        switch (defaultView) {
        case MenuView.PINNED_APPS:
            this.applicationsScrollBox.visible = true;
            this.displayPinnedApps();
            break;
        case MenuView.FREQUENT_APPS:
            this.applicationsScrollBox.visible = true;
            this.displayFrequentApps();
            break;
        case MenuView.DEFAULT:
        default:
            this.applicationsScrollBox.visible = false;
            break;
        }
    }

    displayPinnedApps() {
        const labelRow = this.createLabelRow(_('Pinned Apps'));
        labelRow.style = `padding-bottom: ${Spacing}px;`;

        super.displayPinnedApps();

        this.applicationsBox.insert_child_at_index(labelRow, 0);
    }

    displayFrequentApps() {
        const mostUsed = Shell.AppUsage.get_default().get_most_used();
        if (mostUsed.length < 1)
            return;

        const labelRow = this.createLabelRow(_('Frequent Apps'));
        labelRow.style = `padding-bottom: ${Spacing}px;`;
        this.applicationsBox.add_child(labelRow);

        const frequentAppsList = [];
        for (let i = 0; i < mostUsed.length; i++) {
            if (mostUsed[i] && mostUsed[i].get_app_info().should_show()) {
                const item = new MW.ApplicationMenuItem(this, mostUsed[i], Constants.DisplayType.LIST);
                frequentAppsList.push(item);
            }
        }
        let activeMenuItemSet = false;
        const maxApps = Math.min(10, frequentAppsList.length);
        for (let i = 0; i < maxApps; i++) {
            const item = frequentAppsList[i];
            if (item.get_parent())
                item.get_parent().remove_child(item);
            this.applicationsBox.add_child(item);
            if (!activeMenuItemSet) {
                activeMenuItemSet = true;
                this.activeMenuItem = item;
            }
        }
    }

    _onSearchEntryChanged(searchEntry, searchString) {
        if (!searchEntry.isEmpty())
            this.applicationsScrollBox.visible = true;

        super._onSearchEntryChanged(searchEntry, searchString);
    }

    /**
     * if button is hidden, menu should appear on current monitor,
     * unless preference is to always show on primary monitor
     *
     * @returns index of monitor where menu should appear
     */
    _getMonitorIndexForPlacement() {
        if (this.is_standalone_runner) {
            return ArcMenuManager.settings.get_boolean('runner-hotkey-open-primary-monitor')
                ? Main.layoutManager.primaryMonitor.index : Main.layoutManager.currentMonitor.index;
        } else if (ArcMenuManager.settings.get_enum('menu-button-appearance') === Constants.MenuButtonAppearance.NONE) {
            return ArcMenuManager.settings.get_boolean('hotkey-open-primary-monitor')
                ? Main.layoutManager.primaryMonitor.index : Main.layoutManager.currentMonitor.index;
        } else {
            return Main.layoutManager.findIndexForActor(this.menuButton);
        }
    }

    updateLocation() {
        this.arcMenu._boxPointer.setSourceAlignment(0.5);
        this.arcMenu._arrowAlignment = 0.5;

        const staticHeight = ArcMenuManager.settings.get_boolean('runner-menu-height-static');
        const runnerHeight = ArcMenuManager.settings.get_int('runner-menu-height');
        const runnerWidth = ArcMenuManager.settings.get_int('runner-menu-width');
        const runnerFontSize = ArcMenuManager.settings.get_int('runner-font-size');

        const rect = Main.layoutManager.getWorkAreaForMonitor(this._getMonitorIndexForPlacement());

        // Position the runner menu in the center of the current monitor, at top of screen.
        const positionX = Math.round(rect.x + (rect.width / 2));
        let positionY = rect.y;
        if (ArcMenuManager.settings.get_enum('runner-position') === 1)
            positionY = Math.round(rect.y + (rect.height / 2) - (runnerHeight / 2));
        Main.layoutManager.setDummyCursorGeometry(positionX, positionY, 0, 0);

        if (!this.topBox)
            return;
        const height = staticHeight ? 'height' : 'max-height';
        this.style = `${height}: ${runnerHeight}px; padding: ${Spacing}px; spacing: ${Spacing}px; width: ${runnerWidth}px;`;
        if (runnerFontSize > 0) {
            this.style += `font-size: ${runnerFontSize}pt;`;
            this.searchEntry.style += `font-size: ${runnerFontSize}pt;`;
        }
        this.updateWidth();
    }

    loadCategories() {
        this.categoryDirectories = null;
        this.categoryDirectories = new Map();
        this.hasPinnedApps = true;
        super.loadCategories();
    }

    _onDestroy() {
        if (this.arcMenu) {
            this.arcMenu.sourceActor = this.oldSourceActor;
            this.arcMenu.focusActor = this.oldFocusActor;
            this.arcMenu._boxPointer.setPosition(this.oldSourceActor, this.oldArrowAlignment);
        }

        this.oldSourceActor = null;
        this.oldFocusActor = null;
        this.oldArrowAlignment = null;

        super._onDestroy();
    }
}

class RunnerTweaksButton extends MW.ArcMenuButtonItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super(menuLayout, _('Configure Runner'), 'applications-system-symbolic');
        this.style_class = 'button arcmenu-button';
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
    }

    set active(active) {
        if (this.isDestroyed)
            return;

        const activeChanged = active !== this.active;
        if (activeChanged) {
            this._active = active;
            this.notify('active');
        }
    }

    activate(event) {
        super.activate(event);
        ArcMenuManager.settings.set_int('prefs-visible-page', Constants.SettingsPage.RUNNER_TWEAKS);
        ArcMenuManager.extension.openPreferences();
    }
}
