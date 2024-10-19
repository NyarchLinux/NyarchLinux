import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {InputSourceManager} from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import * as Keybinder from './keybinder.js';
import {MenuButton} from './menuButton.js';
import * as Theming from './theming.js';
import {StandaloneRunner} from './standaloneRunner.js';
import * as Utils from './utils.js';

export const MenuSettingsController = class {
    constructor(panelInfo, monitorIndex) {
        this.panelInfo = panelInfo;
        this.panel = panelInfo.panel;
        this.monitorIndex = monitorIndex;
        this.isPrimaryPanel = panelInfo.isPrimaryPanel;

        this._extension = ArcMenuManager.extension;
        this._settingsControllers = ArcMenuManager.settingsControllers;
        this._settings = ArcMenuManager.settings;

        // Allow other extensions and DBus command to open/close ArcMenu
        if (!global.toggleArcMenu) {
            global.toggleArcMenu = () => this.toggleMenus();
            this._service = new Utils.DBusService();
            this._service.ToggleArcMenu = () => {
                this.toggleMenus();
            };
        }

        this._settingsConnections = new Utils.SettingsConnectionsHandler(this._settings);
        this._menuButton = new MenuButton(panelInfo, this.monitorIndex);

        if (this.isPrimaryPanel) {
            this._overrideOverlayKey = new Keybinder.OverrideOverlayKey();
            this._customKeybinding = new Keybinder.CustomKeybinding(this._settings);
            this._appSystem = Shell.AppSystem.get_default();
            this._updateHotKeyBinder();
            this._initRecentAppsTracker();
            this._inputSourceManagerOverride();
        }

        this._setButtonAppearance();
        this._setButtonText();
        this._setButtonIcon();
        this._setButtonIconSize();
        this._setButtonIconPadding();
        this._configureActivitiesButton();
    }

    _inputSourceManagerOverride() {
        // Add ArcMenu as a valid option for "per window" input source switching.
        this._inputSourcesSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.input-sources'});
        this._perWindowChangedId = this._inputSourcesSettings.connect('changed::per-window', () => {
            if (this._inputSourcesSettings.get_boolean('per-window'))
                return;

            const menus = this._getAllMenus();
            menus.forEach(menu => {
                delete menu._inputSources;
                delete menu._currentSource;
            });
        });

        this._inputSourceManagerProto = InputSourceManager.prototype;
        this._origGetCurrentWindow = this._inputSourceManagerProto._getCurrentWindow;

        this._inputSourceManagerProto._getCurrentWindow = () => {
            const openedArcMenu = this._getOpenedArcMenu();
            if (openedArcMenu)
                return openedArcMenu;
            else if (Main.overview.visible)
                return Main.overview;
            else
                return global.display.focus_window;
        };
    }

    _getOpenedArcMenu() {
        const menus = this._getAllMenus();
        for (let i = 0; i < menus.length; i++) {
            if (menus[i].isOpen)
                return menus[i];
        }

        return null;
    }

    _getAllMenus() {
        const menus = [];
        for (let i = 0; i < this._settingsControllers.length; i++) {
            const menuButton = this._settingsControllers[i]._menuButton;
            menus.push(menuButton.arcMenu);
        }
        if (this.runnerMenu)
            menus.push(this.runnerMenu.arcMenu);

        return menus;
    }

    connectSettingsEvents() {
        this._settingsConnections.connect('override-menu-theme', 'menu-background-color', 'menu-foreground-color',
            'menu-border-color', 'menu-border-width', 'menu-border-radius', 'menu-font-size', 'menu-separator-color',
            'menu-item-hover-bg-color', 'menu-item-hover-fg-color', 'menu-item-active-bg-color',
            'menu-item-active-fg-color', 'menu-button-fg-color', 'menu-button-bg-color',
            'menu-button-hover-bg-color', 'menu-button-hover-fg-color', 'menu-button-active-bg-color',
            'menu-button-active-fg-color', 'menu-button-border-radius', 'menu-button-border-width',
            'menu-button-border-color', 'menu-arrow-rise', 'search-entry-border-radius',
            this._overrideMenuTheme.bind(this));

        this._settingsConnections.connect('arcmenu-hotkey', 'runner-hotkey', this._updateHotKeyBinder.bind(this));

        this._settingsConnections.connect('position-in-panel', 'menu-button-position-offset',
            this._setButtonPosition.bind(this));

        this._settingsConnections.connect('menu-button-icon', 'distro-icon', 'arc-menu-icon', 'custom-menu-button-icon',
            this._setButtonIcon.bind(this));

        this._settingsConnections.connect('directory-shortcuts', 'application-shortcuts', 'extra-categories',
            'power-options', 'show-external-devices', 'show-bookmarks', 'disable-user-avatar',
            'avatar-style', 'enable-activities-shortcut', 'enable-horizontal-flip', 'power-display-style',
            'searchbar-default-bottom-location', 'searchbar-default-top-location', 'multi-lined-labels',
            'apps-show-extra-details', 'show-search-result-details', 'search-provider-open-windows',
            'search-provider-recent-files', 'misc-item-icon-size', 'windows-disable-pinned-apps',
            'disable-scrollview-fade-effect', 'windows-disable-frequent-apps', 'default-menu-view',
            'default-menu-view-tognee', 'alphabetize-all-programs', 'menu-item-grid-icon-size',
            'menu-item-icon-size', 'button-item-icon-size', 'quicklinks-item-icon-size',
            'menu-item-category-icon-size', 'category-icon-type', 'shortcut-icon-type',
            'arcmenu-extra-categories-links', 'arcmenu-extra-categories-links-location',
            'runner-show-frequent-apps', 'default-menu-view-redmond', 'disable-recently-installed-apps',
            'runner-search-display-style', 'raven-search-display-style', 'custom-grid-icon-size', 'show-category-sub-menus',
            this._recreateMenuLayout.bind(this));

        this._settingsConnections.connect('left-panel-width', 'right-panel-width', 'menu-width-adjustment',
            this._updateMenuWidth.bind(this));

        this._settingsConnections.connect('pinned-apps', 'enable-weather-widget-unity', 'enable-clock-widget-unity',
            'enable-weather-widget-raven', 'enable-clock-widget-raven', this._updatePinnedApps.bind(this));

        this._settingsConnections.connect('menu-position-alignment', this._setMenuPositionAlignment.bind(this));
        this._settingsConnections.connect('menu-button-appearance', this._setButtonAppearance.bind(this));
        this._settingsConnections.connect('custom-menu-button-text', this._setButtonText.bind(this));
        this._settingsConnections.connect('custom-menu-button-icon-size', this._setButtonIconSize.bind(this));
        this._settingsConnections.connect('button-padding', this._setButtonIconPadding.bind(this));
        this._settingsConnections.connect('menu-height', this._updateMenuHeight.bind(this));
        this._settingsConnections.connect('enable-unity-homescreen', this._setDefaultMenuView.bind(this));
        this._settingsConnections.connect('menu-layout', this._changeMenuLayout.bind(this));
        this._settingsConnections.connect('runner-position', this._updateLocation.bind(this));
        this._settingsConnections.connect('show-activities-button', this._configureActivitiesButton.bind(this));
        this._settingsConnections.connect('force-menu-location', this._forceMenuLocation.bind(this));
    }

    _overrideMenuTheme() {
        if (!this.isPrimaryPanel)
            return;

        if (this._writeTimeoutId)
            GLib.source_remove(this._writeTimeoutId);

        this._writeTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            Theming.updateStylesheet();
            this._writeTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _recreateMenuLayout() {
        this._menuButton.createMenuLayout();
        if (this.runnerMenu)
            this.runnerMenu.createMenuLayout();
    }

    _forceMenuLocation() {
        this._menuButton.forceMenuLocation();
    }

    _initRecentAppsTracker() {
        this._appList = this._listAllApps();

        this._reloadApplicationsWorkId = Main.initializeDeferredWork(this._menuButton, () => this._reloadApplications());

        this._installedChangedId = this._appSystem.connect('installed-changed', () => {
            Main.queueDeferredWork(this._reloadApplicationsWorkId);
        });
    }

    _reloadApplications() {
        const isDisabled = this._settings.get_boolean('disable-recently-installed-apps');
        const appList = this._listAllApps();

        // Filter to find if a new application has been installed
        const newAppsList = appList.filter(app => !this._appList.includes(app));
        this._appList = appList;

        if (newAppsList.length && !isDisabled) {
            // A new app has been installed, Save it in settings
            const recentApps = this._settings.get_strv('recently-installed-apps');
            const newRecentApps = [...new Set(recentApps.concat(newAppsList))];
            this._settings.set_strv('recently-installed-apps', newRecentApps);
        }

        for (let i = 0; i < this._settingsControllers.length; i++) {
            const menuButton = this._settingsControllers[i]._menuButton;
            menuButton.reloadApplications();
        }

        if (this.runnerMenu)
            this.runnerMenu.reloadApplications();
    }

    _listAllApps() {
        const appList = this._appSystem.get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch (e) {
                return false;
            }
            return appInfo.should_show();
        });
        return appList.map(app => app.get_id());
    }

    _updateLocation() {
        this._menuButton.updateLocation();
        if (this.runnerMenu)
            this.runnerMenu.updateLocation();
    }

    _changeMenuLayout() {
        this._menuButton.createMenuLayout();
    }

    _setDefaultMenuView() {
        this._menuButton.setDefaultMenuView();
    }

    toggleStandaloneRunner() {
        this._closeAllArcMenus();
        if (this.runnerMenu)
            this.runnerMenu.toggleMenu();
    }

    toggleMenus() {
        if (this.runnerMenu && this.runnerMenu.arcMenu.isOpen)
            this.runnerMenu.toggleMenu();
        if (global.dashToPanel || global.azTaskbar) {
            const MultipleArcMenus = this._settingsControllers.length > 1;
            const ShowArcMenuOnPrimaryMonitor = this._settings.get_boolean('hotkey-open-primary-monitor');
            if (MultipleArcMenus && ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.primaryMonitor);
            else if (MultipleArcMenus && !ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.currentMonitor);
            else
                this._menuButton.toggleMenu();
        } else {
            this._menuButton.toggleMenu();
        }
    }

    _toggleMenuOnMonitor(monitor) {
        let currentMonitorIndex = 0;
        for (let i = 0; i < this._settingsControllers.length; i++) {
            const menuButton = this._settingsControllers[i]._menuButton;
            const {monitorIndex} = this._settingsControllers[i];

            if (monitor.index === monitorIndex) {
                currentMonitorIndex = i;
            } else {
                if (menuButton.arcMenu.isOpen)
                    menuButton.toggleMenu();
                menuButton.closeContextMenu();
            }
        }

        // open the current monitors menu
        this._settingsControllers[currentMonitorIndex]._menuButton.toggleMenu();
    }

    _closeAllArcMenus() {
        for (let i = 0; i < this._settingsControllers.length; i++) {
            const menuButton = this._settingsControllers[i]._menuButton;
            if (menuButton.arcMenu.isOpen)
                menuButton.toggleMenu();
            menuButton.closeContextMenu();
        }
    }

    _updateMenuHeight() {
        this._menuButton.updateHeight();
    }

    _updateMenuWidth() {
        this._menuButton.updateWidth();
    }

    _updatePinnedApps() {
        this._menuButton.loadPinnedApps();
    }

    _updateHotKeyBinder() {
        if (!this.isPrimaryPanel)
            return;

        const [runnerHotkey] = this._settings.get_strv('runner-hotkey');
        const [menuHotkey] = this._settings.get_strv('arcmenu-hotkey');

        this._customKeybinding.unbind('ToggleArcMenu');
        this._customKeybinding.unbind('ToggleRunnerMenu');
        this._overrideOverlayKey.disable();

        if (runnerHotkey) {
            if (!this.runnerMenu)
                this.runnerMenu = new StandaloneRunner();

            if (runnerHotkey === Constants.SUPER_L) {
                this._overrideOverlayKey.enable(() => this.toggleStandaloneRunner());
            } else {
                this._customKeybinding.bind('ToggleRunnerMenu', 'runner-hotkey',
                    () => this.toggleStandaloneRunner());
            }
        } else if (this.runnerMenu) {
            this.runnerMenu.destroy();
            this.runnerMenu = null;
        }

        if (menuHotkey === Constants.SUPER_L) {
            this._overrideOverlayKey.disable();
            this._overrideOverlayKey.enable(() => this.toggleMenus());
        } else if (menuHotkey) {
            this._customKeybinding.bind('ToggleArcMenu', 'arcmenu-hotkey',
                () => this.toggleMenus());
        }
    }

    _setButtonPosition() {
        if (this._isButtonEnabled()) {
            this._removeMenuButtonFromMainPanel();
            this._addMenuButtonToMainPanel();
            this._setMenuPositionAlignment();
        }
    }

    _setMenuPositionAlignment() {
        this._menuButton.setMenuPositionAlignment();
    }

    _setButtonAppearance() {
        const menuButtonAppearance = this._settings.get_enum('menu-button-appearance');
        const {menuButtonWidget} = this._menuButton;

        this._menuButton.container.set_width(-1);
        this._menuButton.container.set_height(-1);
        menuButtonWidget.show();

        switch (menuButtonAppearance) {
        case Constants.MenuButtonAppearance.TEXT:
            menuButtonWidget.showText();
            menuButtonWidget.setLabelStyle(null);
            break;
        case Constants.MenuButtonAppearance.ICON_TEXT:
            menuButtonWidget.showIconText();
            menuButtonWidget.setLabelStyle('padding-left: 5px;');
            break;
        case Constants.MenuButtonAppearance.TEXT_ICON:
            menuButtonWidget.showTextIcon();
            menuButtonWidget.setLabelStyle('padding-right: 5px;');
            break;
        case Constants.MenuButtonAppearance.NONE:
            menuButtonWidget.hide();
            this._menuButton.container.set_width(0);
            this._menuButton.container.set_height(0);
            break;
        case Constants.MenuButtonAppearance.ICON:
        default:
            menuButtonWidget.showIcon();
        }
    }

    _setButtonText() {
        const {menuButtonWidget} = this._menuButton;
        const label = menuButtonWidget.getPanelLabel();

        const customTextLabel = this._settings.get_string('custom-menu-button-text');
        label.set_text(customTextLabel);
    }

    _setButtonIcon() {
        const path = this._settings.get_string('custom-menu-button-icon');
        const {menuButtonWidget} = this._menuButton;
        const stIcon = menuButtonWidget.getPanelIcon();

        const iconString = Utils.getMenuButtonIcon(path);
        stIcon.set_gicon(Gio.icon_new_for_string(iconString));
    }

    _setButtonIconSize() {
        const {menuButtonWidget} = this._menuButton;
        const stIcon = menuButtonWidget.getPanelIcon();
        const iconSize = this._settings.get_double('custom-menu-button-icon-size');
        const size = iconSize;
        stIcon.icon_size = size;
    }

    _setButtonIconPadding() {
        const padding = this._settings.get_int('button-padding');
        if (padding > -1)
            this._menuButton.style = `-natural-hpadding: ${padding  * 2}px; -minimum-hpadding: ${padding}px;`;
        else
            this._menuButton.style = null;

        const parent = this._menuButton.get_parent();
        if (!parent)
            return;
        const children = parent.get_children();
        let actorIndex = 0;

        if (children.length > 1)
            actorIndex = children.indexOf(this._menuButton);


        parent.remove_child(this._menuButton);
        parent.insert_child_at_index(this._menuButton, actorIndex);
    }

    _getMenuPosition() {
        const offset = this._settings.get_int('menu-button-position-offset');
        switch (this._settings.get_enum('position-in-panel')) {
        case Constants.MenuPosition.CENTER:
            return [offset, 'center'];
        case Constants.MenuPosition.RIGHT: {
            // get number of childrens in rightBox (without arcmenu)
            let nChildren = this.panel._rightBox.get_n_children();
            nChildren -= this.panel.statusArea.ArcMenu !== undefined;
            // position where icon should go,
            // offset = 0, icon should be last
            // offset = 1, icon should be second last
            const order = Math.clamp(nChildren - offset, 0, nChildren);
            return [order, 'right'];
        }
        case Constants.MenuPosition.LEFT:
        default:
            return [offset, 'left'];
        }
    }

    _configureActivitiesButton() {
        const showActivities = this._settings.get_boolean('show-activities-button');
        if (this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = showActivities;
    }

    _addMenuButtonToMainPanel() {
        const [position, box] = this._getMenuPosition();
        this.panel.addToStatusArea('ArcMenu', this._menuButton, position, box);
    }

    _removeMenuButtonFromMainPanel() {
        this.panel.menuManager.removeMenu(this._menuButton.arcMenu);
        this.panel.menuManager.removeMenu(this._menuButton.arcMenuContextMenu);
        this.panel.statusArea['ArcMenu'] = null;
    }

    enableButton() {
        this._addMenuButtonToMainPanel();
        this._menuButton.initiate();
    }

    _disableButton() {
        this._removeMenuButtonFromMainPanel();
        if (this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = true;
        this._menuButton.destroy();
    }

    _isButtonEnabled() {
        return this.panel && this.panel.statusArea['ArcMenu'] !== null;
    }

    destroy() {
        if (this._service) {
            this._service.destroy();
            this._service = null;
        }

        if (global.toggleArcMenu)
            delete global.toggleArcMenu;

        if (this._inputSourceManagerProto) {
            this._inputSourceManagerProto._getCurrentWindow = this._origGetCurrentWindow;
            delete this._inputSourceManagerProto;
        }

        if (this._perWindowChangedId) {
            this._inputSourcesSettings.disconnect(this._perWindowChangedId);
            this._perWindowChangedId = null;
        }

        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = null;
        }

        if (this._installedChangedId) {
            this._appSystem.disconnect(this._installedChangedId);
            this._installedChangedId = null;
        }

        if (this.runnerMenu) {
            this.runnerMenu.destroy();
            this.runnerMenu = null;
        }

        this._settingsConnections.destroy();
        this._settingsConnections = null;

        if (this._isButtonEnabled())
            this._disableButton();
        else
            this._menuButton.destroy();

        if (this.isPrimaryPanel) {
            this._overrideOverlayKey.destroy();
            this._customKeybinding.destroy();
        }

        this._menuButton = null;
    }
};
