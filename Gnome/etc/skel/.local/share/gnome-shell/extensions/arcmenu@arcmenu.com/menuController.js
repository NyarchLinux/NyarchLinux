import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

import {InputSourceManager} from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import {Keybinder} from './keybinder.js';
import {MenuButton} from './menuButton.js';
import {StandaloneRunner} from './standaloneRunner.js';
import * as Utils from './utils.js';

export const MenuController = class {
    constructor(panelInfo, monitorIndex) {
        this.panelInfo = panelInfo;
        this.panel = panelInfo.panel;
        this.monitorIndex = monitorIndex;
        this.isFirstPanel = panelInfo.isFirstPanel;
        this._debouncer = new Utils.Debouncer();

        // Allow other extensions and DBus command to open/close ArcMenu and Standalone Runner
        if (!global.toggleArcMenu && this.isFirstPanel) {
            global.toggleArcMenu = () => this._toggleArcMenu();
            this._service = new Utils.DBusService();
            this._service.ToggleArcMenu = () => {
                this._toggleArcMenu();
            };
            this._service.ToggleStandaloneRunner = () => {
                if (this._runnerMenu)
                    this._toggleRunnerMenu();
            };
        }

        this._menuButton = new MenuButton(panelInfo, this.monitorIndex);

        if (this.isFirstPanel) {
            this._keybinder = new Keybinder(ArcMenuManager.settings);
            this._keybinder.toggleArcMenu = () => this._toggleArcMenu();
            this._keybinder.toggleRunnerMenu = () => this._toggleRunnerMenu();
            this._keybinder.connectObject('runner-menu-active', this._setRunnerMenuActive.bind(this), this);
            this._appSystem = Shell.AppSystem.get_default();
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

    get menuButton() {
        return this._menuButton;
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
        const {menuControllers} = ArcMenuManager;
        for (let i = 0; i < menuControllers.length; i++) {
            const {menuButton} = menuControllers[i];
            menus.push(menuButton.arcMenu);
        }
        if (this._runnerMenu)
            menus.push(this._runnerMenu.arcMenu);

        return menus;
    }

    connectSettingsEvents() {
        Utils.connectSettings(
            ['position-in-panel', 'menu-button-position-offset'],
            this._setButtonPosition.bind(this),
            this
        );

        Utils.connectSettings(
            ['directory-shortcuts', 'application-shortcuts', 'extra-categories', 'custom-grid-icon-size',
                'power-options', 'show-external-devices', 'show-bookmarks', 'show-user-avatar', 'runner-search-display-style',
                'avatar-style', 'enable-activities-shortcut', 'enable-horizontal-flip', 'power-display-style',
                'searchbar-default-bottom-location', 'searchbar-default-top-location', 'multi-lined-labels',
                'apps-show-extra-details', 'apps-show-generic-names', 'show-search-result-details', 'search-provider-open-windows',
                'search-provider-recent-files', 'misc-item-icon-size', 'windows-show-pinned-apps',
                'scrollview-fade-effect', 'windows-show-frequent-apps', 'default-menu-view',
                'default-menu-view-tognee', 'group-apps-alphabetically-list-layouts', 'group-apps-alphabetically-grid-layouts',
                'menu-item-grid-icon-size', 'menu-item-icon-size', 'button-item-icon-size', 'quicklinks-item-icon-size',
                'menu-item-category-icon-size', 'category-icon-type', 'shortcut-icon-type', 'show-category-sub-menus',
                'arcmenu-extra-categories-links', 'arcmenu-extra-categories-links-location', 'raven-search-display-style',
                'default-menu-view-redmond', 'show-recently-installed-apps', 'az-layout-merge-panels',
                'scrollbars-visible', 'scrollbars-overlay'],
            this._recreateMenuLayout.bind(this),
            this
        );

        Utils.connectSettings(
            ['left-panel-width', 'right-panel-width', 'menu-width-adjustment'],
            this._updateMenuWidth.bind(this),
            this
        );

        Utils.connectSettings(['pinned-apps'], this._updatePinnedApps.bind(this), this);
        Utils.connectSettings(['menu-position-alignment'], this._setMenuPositionAlignment.bind(this), this);
        Utils.connectSettings(['menu-button-icon'], this._setButtonIcon.bind(this), this);
        Utils.connectSettings(['menu-button-appearance'], this._setButtonAppearance.bind(this), this);
        Utils.connectSettings(['menu-button-text'], this._setButtonText.bind(this), this);
        Utils.connectSettings(['menu-button-icon-size'], this._setButtonIconSize.bind(this), this);
        Utils.connectSettings(['menu-button-padding'], this._setButtonIconPadding.bind(this), this);
        Utils.connectSettings(['menu-height'], this._updateMenuHeight.bind(this), this);
        Utils.connectSettings(['menu-layout'], this._changeMenuLayout.bind(this), this);
        Utils.connectSettings(['runner-position'], this._updateLocation.bind(this), this);
        Utils.connectSettings(['show-activities-button'], this._configureActivitiesButton.bind(this), this);
        Utils.connectSettings(['force-menu-location'], this._forceMenuLocation.bind(this), this);
    }

    _recreateMenuLayout() {
        if (!this.isFirstPanel)
            return;

        this._debouncer.debounce('createMenuLayout', () => {
            const {menuControllers} = ArcMenuManager;
            for (let i = 0; i < menuControllers.length; i++) {
                const {menuButton} = menuControllers[i];
                menuButton.createMenuLayout();
            }
            if (this._runnerMenu)
                this._runnerMenu.createMenuLayout();
        });
    }

    _forceMenuLocation() {
        this._menuButton.forceMenuLocation();
    }

    _initRecentAppsTracker() {
        this._appList = this._listAllApps();
        this._appSystem.connectObject('installed-changed', () => this._setRecentlyInstalledApps(), this);
    }

    _setRecentlyInstalledApps() {
        const showNewApps = ArcMenuManager.settings.get_boolean('show-recently-installed-apps');
        if (!showNewApps)
            return;

        const appList = this._listAllApps();

        // Filter to find if a new application has been installed
        const newAppsList = appList.filter(app => !this._appList.includes(app));
        this._appList = appList;

        if (newAppsList.length) {
            // A new app has been installed, Save it in settings
            const recentApps = ArcMenuManager.settings.get_strv('recently-installed-apps');
            const newRecentApps = [...new Set(recentApps.concat(newAppsList))];
            ArcMenuManager.settings.set_strv('recently-installed-apps', newRecentApps);
        }
    }

    _listAllApps() {
        const appList = this._appSystem.get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch {
                return false;
            }
            return appInfo.should_show();
        });
        return appList.map(app => app.get_id());
    }

    _updateLocation() {
        this._menuButton.updateLocation();
        if (this._runnerMenu)
            this._runnerMenu.updateLocation();
    }

    _changeMenuLayout() {
        this._debouncer.debounce('createMenuLayout', () => {
            this._menuButton.createMenuLayout();
        });
    }

    _setRunnerMenuActive(sender, enabled) {
        if (enabled && !this._runnerMenu) {
            this._runnerMenu = new StandaloneRunner();
        } else if (!enabled && this._runnerMenu) {
            this._runnerMenu.destroy();
            this._runnerMenu = null;
        }
    }

    _toggleRunnerMenu() {
        this._closeAllArcMenus();
        if (this._runnerMenu)
            this._runnerMenu.toggleMenu();
    }

    _toggleArcMenu() {
        if (this._runnerMenu?.isOpen)
            this._runnerMenu.toggleMenu();

        const multipleArcMenus = ArcMenuManager.menuControllers.length > 1;
        if (multipleArcMenus) {
            const openOnPrimaryMonitor = ArcMenuManager.settings.get_boolean('hotkey-open-primary-monitor');
            const monitor = openOnPrimaryMonitor ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;
            this._toggleMenuOnMonitor(monitor);
            return;
        }

        this._menuButton.toggleMenu();
    }

    _toggleMenuOnMonitor(monitor) {
        let menuButtonOnMonitor = null;
        const {menuControllers} = ArcMenuManager;
        for (let i = 0; i < menuControllers.length; i++) {
            const {menuButton, monitorIndex} = menuControllers[i];

            if (monitor.index === monitorIndex) {
                menuButtonOnMonitor = menuButton;
            } else {
                if (menuButton.isOpen)
                    menuButton.toggleMenu();
                menuButton.closeContextMenu();
            }
        }

        if (menuButtonOnMonitor)
            menuButtonOnMonitor.toggleMenu();
        else
            this._menuButton.toggleMenu();
    }

    _closeAllArcMenus() {
        const {menuControllers} = ArcMenuManager;
        for (let i = 0; i < menuControllers.length; i++) {
            const {menuButton} = menuControllers[i];
            if (menuButton.isOpen)
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

    _setButtonPosition() {
        if (this._isButtonEnabled()) {
            this._removeMenuButtonFromPanel();
            this._addMenuButtonToMainPanel();
            this._setMenuPositionAlignment();
        }
    }

    _setMenuPositionAlignment() {
        this._menuButton.setMenuPositionAlignment();
    }

    _setButtonAppearance() {
        const menuButtonAppearance = ArcMenuManager.settings.get_enum('menu-button-appearance');
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

        const customTextLabel = ArcMenuManager.settings.get_string('menu-button-text');
        label.set_text(customTextLabel);
    }

    _setButtonIcon() {
        const {menuButtonWidget} = this._menuButton;
        const paneIcon = menuButtonWidget.getPanelIcon();
        paneIcon.gicon = this._getButtonIcon();
    }

    _getButtonIcon() {
        const iconPath = ArcMenuManager.settings.get_string('menu-button-icon');
        if (iconPath)
            return Gio.Icon.new_for_string(iconPath);
        else
            return Gio.Icon.new_for_string('start-here-symbolic');
    }

    _setButtonIconSize() {
        const iconSize = ArcMenuManager.settings.get_int('menu-button-icon-size');

        const {menuButtonWidget} = this._menuButton;
        const paneIcon = menuButtonWidget.getPanelIcon();
        paneIcon.icon_size = iconSize;
    }

    _setButtonIconPadding() {
        const padding = ArcMenuManager.settings.get_int('menu-button-padding');
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
        const offset = ArcMenuManager.settings.get_int('menu-button-position-offset');
        const positionInPanel = ArcMenuManager.settings.get_enum('position-in-panel');
        switch (positionInPanel) {
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
        const showActivities = ArcMenuManager.settings.get_boolean('show-activities-button');
        if (this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = showActivities;
    }

    _addMenuButtonToMainPanel() {
        const [position, box] = this._getMenuPosition();
        this.panel.addToStatusArea('ArcMenu', this._menuButton, position, box);
    }

    _removeMenuButtonFromPanel() {
        this.panel.statusArea['ArcMenu'] = null;
    }

    enableButton() {
        this._addMenuButtonToMainPanel();
        this._menuButton.initiate();
    }

    _disableButton() {
        this._removeMenuButtonFromPanel();
        if (this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = true;
        this._menuButton.destroy();
    }

    _isButtonEnabled() {
        return this.panel && this.panel.statusArea['ArcMenu'] !== null;
    }

    destroy() {
        this._appList = null;

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
        this._inputSourcesSettings = null;

        this._debouncer.destroy();
        this._debouncer = null;

        if (this._appSystem)
            this._appSystem.disconnectObject(this);
        this._appSystem = null;

        if (this._runnerMenu) {
            this._runnerMenu.destroy();
            this._runnerMenu = null;
        }

        ArcMenuManager.settings.disconnectObject(this);

        if (this._isButtonEnabled())
            this._disableButton();
        else
            this._menuButton.destroy();

        if (this.isFirstPanel) {
            this._keybinder.disconnectObject(this);
            this._keybinder.destroy();
            this._keybinder = null;
        }

        this._menuButton = null;
        this.panelInfo = null;
        this.panel = null;
        this.isFirstPanel = null;
    }
};
