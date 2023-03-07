const Me = imports.misc.extensionUtils.getCurrentExtension();

const { Gio, GLib, Gtk, Shell, St } = imports.gi;
const Constants = Me.imports.constants;
const { InputSourceManager } = imports.ui.status.keyboard;
const Keybinder = Me.imports.keybinder;
const Main = imports.ui.main;
const MenuButton = Me.imports.menuButton;
const { StandaloneRunner } = Me.imports.standaloneRunner;
const Theming = Me.imports.theming;
const Utils = Me.imports.utils;

var MenuSettingsController = class {
    constructor(settings, settingsControllers, panel, isPrimaryPanel) {
        this._settings = settings;
        this.panel = panel;

        global.toggleArcMenu = () => this.toggleMenus();

        this._settingsConnections = new Utils.SettingsConnectionsHandler(this._settings);

        this.currentMonitorIndex = 0;
        this.isPrimaryPanel = isPrimaryPanel;

        this._menuButton = new MenuButton.MenuButton(settings, panel);

        this._settingsControllers = settingsControllers;

        if(this.isPrimaryPanel){
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

    _inputSourceManagerOverride(){
        //Add ArcMenu as a valid option for "per window" input source switching.
        this._inputSourcesSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.input-sources' });
        this._perWindowChangedId = this._inputSourcesSettings.connect('changed::per-window', () => {
            if(this._inputSourcesSettings.get_boolean('per-window'))
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
            let openedArcMenu = this._getOpenedArcMenu();
            if (openedArcMenu)
                return openedArcMenu;
            else if (Main.overview.visible)
                return Main.overview;
            else
                return global.display.focus_window;
        }
    }

    _getOpenedArcMenu(){
        const menus = this._getAllMenus();
        for (let i = 0; i < menus.length; i++) {
            if (menus[i].isOpen)
                return menus[i];
        }

        return null;
    }

    _getAllMenus(){
        let menus = [];
        for (let i = 0; i < this._settingsControllers.length; i++) {
            let menuButton = this._settingsControllers[i]._menuButton;
            menus.push(menuButton.arcMenu)
        }
        if(this.runnerMenu)
            menus.push(this.runnerMenu.arcMenu)

        return menus;
    }

    connectSettingsEvents() {
        this._settingsConnections.connectMultipleEvents(
            ['override-menu-theme', 'menu-background-color', 'menu-foreground-color', 'menu-border-color',
            'menu-border-width', 'menu-border-radius', 'menu-font-size', 'menu-separator-color',
            'menu-item-hover-bg-color', 'menu-item-hover-fg-color', 'menu-item-active-bg-color',
            'menu-item-active-fg-color', 'menu-button-fg-color', 'menu-button-hover-bg-color',
            'menu-button-hover-fg-color', 'menu-button-active-bg-color', 'menu-button-active-fg-color',
            'menu-button-border-radius', 'menu-button-border-width', 'menu-button-border-color', 'menu-arrow-rise',
            'search-entry-border-radius'],
            this._overrideMenuTheme.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['enable-menu-hotkey', 'menu-hotkey-type', 'runner-menu-hotkey-type', 'enable-standlone-runner-menu'],
            this._updateHotKeyBinder.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['position-in-panel', 'menu-button-position-offset'],
            this._setButtonPosition.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['menu-button-icon', 'distro-icon', 'arc-menu-icon', 'custom-menu-button-icon'],
            this._setButtonIcon.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['directory-shortcuts-list', 'application-shortcuts-list', 'extra-categories',
            'power-options','show-external-devices', 'show-bookmarks', 'disable-user-avatar',
            'avatar-style', 'enable-activities-shortcut', 'enable-horizontal-flip', 'power-display-style',
            'searchbar-default-bottom-location', 'searchbar-default-top-location', 'multi-lined-labels',
            'apps-show-extra-details', 'show-search-result-details', 'search-provider-open-windows',
            'search-provider-recent-files', 'misc-item-icon-size', 'windows-disable-pinned-apps',
            'disable-scrollview-fade-effect', 'windows-disable-frequent-apps', 'default-menu-view',
            'default-menu-view-tognee', 'alphabetize-all-programs', 'menu-item-grid-icon-size',
            'menu-item-icon-size', 'button-item-icon-size', 'quicklinks-item-icon-size',
            'menu-item-category-icon-size', 'category-icon-type', 'shortcut-icon-type',
            'arcmenu-extra-categories-links', 'arcmenu-extra-categories-links-location', 'runner-show-frequent-apps',
            'default-menu-view-redmond', 'disable-recently-installed-apps', 'runner-search-display-style',
            'raven-search-display-style'],
            this._reload.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['left-panel-width', 'right-panel-width', 'menu-width-adjustment'],
            this._updateMenuWidth.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['pinned-app-list', 'enable-weather-widget-unity', 'enable-clock-widget-unity',
            'enable-weather-widget-raven', 'enable-clock-widget-raven'],
            this._updatePinnedApps.bind(this)
        );

        this._settingsConnections.connectMultipleEvents(
            ['brisk-shortcuts-list', 'mint-pinned-app-list', 'mint-separator-index',
            'unity-pinned-app-list', 'unity-separator-index'],
            this._updateExtraPinnedApps.bind(this)
        );

        this._settingsConnections.connect('menu-position-alignment', this._setMenuPositionAlignment.bind(this));
        this._settingsConnections.connect('menu-button-appearance', this._setButtonAppearance.bind(this));
        this._settingsConnections.connect('custom-menu-button-text', this._setButtonText.bind(this));
        this._settingsConnections.connect('custom-menu-button-icon-size', this._setButtonIconSize.bind(this));
        this._settingsConnections.connect('button-padding', this._setButtonIconPadding.bind(this));
        this._settingsConnections.connect('menu-height', this._updateMenuHeight.bind(this));
        this._settingsConnections.connect('enable-unity-homescreen', this._setDefaultMenuView.bind(this));
        this._settingsConnections.connect('menu-layout', this._updateMenuLayout.bind(this));
        this._settingsConnections.connect('runner-position', this._updateLocation.bind(this));
        this._settingsConnections.connect('show-activities-button', this._configureActivitiesButton.bind(this));
        this._settingsConnections.connect('force-menu-location', this._forceMenuLocation.bind(this));
    }

    _overrideMenuTheme(){
        if(!this.isPrimaryPanel)
            return;

        if (this._writeTimeoutId)
            GLib.source_remove(this._writeTimeoutId);

        this._writeTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            Theming.updateStylesheet(this._settings);
            this._writeTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _reload(){
        this._menuButton.reload();
        if(this.runnerMenu)
            this.runnerMenu.reload();
    }

    _forceMenuLocation(){
        this._menuButton.forceMenuLocation();
    }

    _initRecentAppsTracker(){
        this._appList = this._listAllApps();

        this._installedChangedId = this._appSystem.connect('installed-changed', () => {
            const isDisabled = this._settings.get_boolean('disable-recently-installed-apps')
            let appList = this._listAllApps();

            //Filter to find if a new application has been installed
            let newAppsList = appList.filter(app => !this._appList.includes(app));
            this._appList = appList;

            if(newAppsList.length && !isDisabled){
                //A new app has been installed, Save it in settings
                let recentApps = this._settings.get_strv('recently-installed-apps');
                let newRecentApps = [...new Set(recentApps.concat(newAppsList))];
                this._settings.set_strv('recently-installed-apps', newRecentApps);
            }

            for (let i = 0; i < this._settingsControllers.length; i++) {
                let menuButton = this._settingsControllers[i]._menuButton;
                menuButton.MenuLayout?.reloadApplications();
            }

            if(this.runnerMenu)
                this.runnerMenu.MenuLayout?.reloadApplications();
        });
    }

    _listAllApps(){
        let appList = this._appSystem.get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch (e) {
                return false;
            }
            return appInfo.should_show();
        });
        return appList.map(app => app.get_id());
    }

    _updateLocation(){
        this._menuButton.updateLocation();
        if(this.runnerMenu)
            this.runnerMenu.updateLocation();
    }

    _updateMenuLayout(){
        this._menuButton.updateMenuLayout();
    }

    _setDefaultMenuView(){
        this._menuButton.setDefaultMenuView();
    }

    toggleStandaloneRunner(){
        this._closeAllArcMenus();
        if(this.runnerMenu)
            this.runnerMenu.toggleMenu();
    }

    toggleMenus(){
        if(this.runnerMenu && this.runnerMenu.arcMenu.isOpen)
            this.runnerMenu.toggleMenu();
        if(global.dashToPanel || global.azTaskbar){
            const MultipleArcMenus = this._settingsControllers.length > 1;
            const ShowArcMenuOnPrimaryMonitor = this._settings.get_boolean('hotkey-open-primary-monitor');
            if(MultipleArcMenus && ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.primaryMonitor);
            else if(MultipleArcMenus && !ShowArcMenuOnPrimaryMonitor)
                this._toggleMenuOnMonitor(Main.layoutManager.currentMonitor);
            else
                this._menuButton.toggleMenu();
        }
        else
            this._menuButton.toggleMenu();
    }

    _toggleMenuOnMonitor(monitor){
        for (let i = 0; i < this._settingsControllers.length; i++) {
            let menuButton = this._settingsControllers[i]._menuButton;
            let monitorIndex = this._settingsControllers[i].monitorIndex;
            if(monitor.index === monitorIndex)
                this.currentMonitorIndex = i;
            else{
                if(menuButton.arcMenu.isOpen)
                    menuButton.toggleMenu();
                if(menuButton.arcMenuContextMenu.isOpen)
                    menuButton.toggleArcMenuContextMenu();
            }
        }
        //open the current monitors menu
        this._settingsControllers[this.currentMonitorIndex]._menuButton.toggleMenu();
    }

    _closeAllArcMenus(){
        for (let i = 0; i < this._settingsControllers.length; i++) {
            let menuButton = this._settingsControllers[i]._menuButton;
            if(menuButton.arcMenu.isOpen)
                menuButton.toggleMenu();
            if(menuButton.arcMenuContextMenu.isOpen)
                menuButton.toggleArcMenuContextMenu();
        }
    }

    _updateMenuHeight(){
        this._menuButton.updateHeight();
    }

    _updateMenuWidth(){
        this._menuButton.updateWidth();
    }

    _updatePinnedApps(){
        if(this._menuButton.shouldLoadPinnedApps())
            this._menuButton.loadPinnedApps();

        //If the active category is Pinned Apps, redisplay the new Pinned Apps
        const activeCategory = this._menuButton.MenuLayout?.activeCategoryType;
        if(!activeCategory)
            return;
        if(activeCategory === Constants.CategoryType.PINNED_APPS || activeCategory === Constants.CategoryType.HOME_SCREEN)
            this._menuButton.displayPinnedApps();
    }

    _updateExtraPinnedApps(){
        let layout = this._settings.get_enum('menu-layout');
        if(layout == Constants.MenuLayout.UNITY || layout == Constants.MenuLayout.MINT || layout == Constants.MenuLayout.BRISK){
            if(this._menuButton.shouldLoadPinnedApps())
                this._menuButton.loadExtraPinnedApps();
        }
    }

    _updateHotKeyBinder() {
        if (this.isPrimaryPanel) {
            const enableMenuHotkey = this._settings.get_boolean('enable-menu-hotkey');
            const enableStandaloneRunnerMenu = this._settings.get_boolean('enable-standlone-runner-menu');

            const runnerHotKey = this._settings.get_enum('runner-menu-hotkey-type');
            const menuHotkey = this._settings.get_enum('menu-hotkey-type');

            this._customKeybinding.unbind('ToggleArcMenu');
            this._customKeybinding.unbind('ToggleRunnerMenu');
            this._overrideOverlayKey.disable();

            if(enableStandaloneRunnerMenu){
                if(!this.runnerMenu){
                    this.runnerMenu = new StandaloneRunner(this._settings);
                    this.runnerMenu.initiate();
                }
                if(runnerHotKey === Constants.HotkeyType.CUSTOM)
                    this._customKeybinding.bind('ToggleRunnerMenu', 'runner-menu-custom-hotkey', () => this.toggleStandaloneRunner());
                else if(runnerHotKey === Constants.HotkeyType.SUPER_L)
                    this._overrideOverlayKey.enable(() => this.toggleStandaloneRunner());
            }
            else if(this.runnerMenu){
                this.runnerMenu.destroy();
                this.runnerMenu = null;
            }

            if(enableMenuHotkey){
                if(menuHotkey === Constants.HotkeyType.CUSTOM)
                    this._customKeybinding.bind('ToggleArcMenu', 'arcmenu-custom-hotkey', () => this.toggleMenus());
                else if(menuHotkey === Constants.HotkeyType.SUPER_L){
                    this._overrideOverlayKey.disable();
                    this._overrideOverlayKey.enable(() => this.toggleMenus());
                }
            }
        }
    }

    _setButtonPosition() {
        if (this._isButtonEnabled()) {
            this._removeMenuButtonFromMainPanel();
            this._addMenuButtonToMainPanel();
            this._setMenuPositionAlignment();
        }
    }

    _setMenuPositionAlignment(){
        this._menuButton.setMenuPositionAlignment();
    }

    _setButtonAppearance() {
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        this._menuButton.container.set_width(-1);
        this._menuButton.container.set_height(-1);
        menuButtonWidget.show();
        switch (this._settings.get_enum('menu-button-appearance')) {
            case Constants.MenuButtonAppearance.TEXT:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.showPanelText();
                break;
            case Constants.MenuButtonAppearance.ICON_TEXT:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelIcon();
                menuButtonWidget.showPanelText();
                menuButtonWidget.setPanelTextStyle('padding-left: 5px;');
                break;
            case Constants.MenuButtonAppearance.TEXT_ICON:
                menuButtonWidget.hidePanelIcon();
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelText();
                menuButtonWidget.setPanelTextStyle('padding-right: 5px;');
                menuButtonWidget.showPanelIcon();
                break;
            case Constants.MenuButtonAppearance.NONE:
                menuButtonWidget.hide();
                this._menuButton.container.set_width(0);
                this._menuButton.container.set_height(0);
                break;
            case Constants.MenuButtonAppearance.ICON:
            default:
                menuButtonWidget.hidePanelText();
                menuButtonWidget.showPanelIcon();
        }
    }

    _setButtonText() {
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let label = menuButtonWidget.getPanelLabel();

        let customTextLabel = this._settings.get_string('custom-menu-button-text');
        label.set_text(customTextLabel);
    }

    _setButtonIcon() {
        let path = this._settings.get_string('custom-menu-button-icon');
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let stIcon = menuButtonWidget.getPanelIcon();

        let iconString = Utils.getMenuButtonIcon(this._settings, path);
        stIcon.set_gicon(Gio.icon_new_for_string(iconString));
    }

    _setButtonIconSize() {
        let menuButtonWidget = this._menuButton.menuButtonWidget;
        let stIcon = menuButtonWidget.getPanelIcon();
        let iconSize = this._settings.get_double('custom-menu-button-icon-size');
        let size = iconSize;
        stIcon.icon_size = size;
    }

    _setButtonIconPadding() {
        let padding = this._settings.get_int('button-padding');
        if(padding > -1)
            this._menuButton.style = "-natural-hpadding: " + (padding  * 2 ) + "px; -minimum-hpadding: " + padding + "px;";
        else
            this._menuButton.style = null;

        let parent = this._menuButton.get_parent();
        if(!parent)
            return;
        let children = parent.get_children();
        let actorIndex = 0;

        if (children.length > 1) {
            actorIndex = children.indexOf(this._menuButton);
        }

        parent.remove_child(this._menuButton);
        parent.insert_child_at_index(this._menuButton, actorIndex);
    }

    _getMenuPosition() {
        let offset = this._settings.get_int('menu-button-position-offset');
        switch (this._settings.get_enum('position-in-panel')) {
            case Constants.MenuPosition.CENTER:
                return [offset, 'center'];
            case Constants.MenuPosition.RIGHT:
                // get number of childrens in rightBox (without arcmenu)
                let n_children = this.panel._rightBox.get_n_children();
                n_children -= this.panel.statusArea.ArcMenu !== undefined;
                // position where icon should go,
                // offset = 0, icon should be last
                // offset = 1, icon should be second last
                const order = Math.clamp(n_children - offset, 0, n_children);
                return [order, 'right'];
            case Constants.MenuPosition.LEFT:
            default:
                return [offset, 'left'];
        }
    }

    _configureActivitiesButton(){
        let showActivities = this._settings.get_boolean('show-activities-button');
        if(this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = showActivities;
    }

    _addMenuButtonToMainPanel() {
        let [position, box] = this._getMenuPosition();
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
        if(this.panel.statusArea.activities)
            this.panel.statusArea.activities.visible = true;
        this._menuButton.destroy();
    }

    _isButtonEnabled() {
        return this.panel.statusArea['ArcMenu'] !== null;
    }

    destroy() {
        if(this._inputSourceManagerProto){
            this._inputSourceManagerProto._getCurrentWindow = this._origGetCurrentWindow;
            delete this._inputSourceManagerProto;
        }
        
        if(this._perWindowChangedId){
            this._inputSourcesSettings.disconnect(this._perWindowChangedId);
            this._perWindowChangedId = null;
        }

        if(this._writeTimeoutId){
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = null;
        }

        if(this._installedChangedId){
            this._appSystem.disconnect(this._installedChangedId);
            this._installedChangedId = null;
        }

        if(this.runnerMenu)
            this.runnerMenu.destroy();

        this._settingsConnections.destroy();
        this._settingsConnections = null;

        if(this.panel === undefined)
            this._menuButton.destroy();
        else if(this._isButtonEnabled())
            this._disableButton();

        if(this.isPrimaryPanel){
            this._overrideOverlayKey.destroy();
            this._customKeybinding.destroy();
        }

        this._settings = null;
        this._menuButton = null;
        delete global.toggleArcMenu;
  }
};
