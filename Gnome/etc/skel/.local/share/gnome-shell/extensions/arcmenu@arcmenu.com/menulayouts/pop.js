import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import {DragMotionResult} from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as ParentalControlsManager from 'resource:///org/gnome/shell/misc/parentalControlsManager.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {AppContextMenu} from '../appMenu.js';
import {ArcMenuManager} from '../arcmenuManager.js';
import {BaseMenuLayout} from './baseMenuLayout.js';
import * as Constants from '../constants.js';
import {IconGrid} from '../iconGrid.js';
import * as MW from '../menuWidgets.js';
import * as Utils from '../utils.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const FolderIconSize = 32;

/**
 * Retrieves the folder's name, optionally translating it if the folder has a 'translate' flag.
 *
 * @param {object} folder - The folder object containing properties.
 * @returns {string} The folder name, translated if applicable.
 */
function getFolderName(folder) {
    const name = folder.get_string('name');

    if (folder.get_boolean('translate')) {
        const translated = Shell.util_get_translated_folder_name(name);
        if (translated !== null)
            return translated;
    }

    return name;
}

/**
 * Checks whether two arrays have at least one common element.
 *
 * @param {Array} a - The first array to check for intersection.
 * @param {Array} b - The second array to check for intersection.
 * @returns {boolean} Returns `true` if the two arrays have at least one common element; otherwise, `false`.
 */
function listsIntersect(a, b) {
    for (const itemA of a) {
        if (b.includes(itemA))
            return true;
    }
    return false;
}

export class Layout extends BaseMenuLayout {
    static {
        GObject.registerClass(this);
    }

    constructor(menuButton) {
        super(menuButton, {
            display_type: Constants.DisplayType.GRID,
            search_display_type: Constants.DisplayType.GRID,
            search_results_spacing: 4,
            column_spacing: 12,
            row_spacing: 12,
            default_menu_width: 1050,
            ...Utils.getOrientationProp(true),
            icon_grid_size: Constants.GridIconSize.EXTRA_LARGE,
            category_icon_size: Constants.MEDIUM_ICON_SIZE,
            apps_icon_size: Constants.EXTRA_LARGE_ICON_SIZE,
            quicklinks_icon_size: Constants.MEDIUM_ICON_SIZE,
            buttons_icon_size: Constants.LARGE_ICON_SIZE,
            pinned_apps_icon_size: Constants.MEDIUM_ICON_SIZE,
        });

        this._folders = new Map();
        this._orderedItems = [];

        this.draggableApps = true;
        this.topBox = new St.BoxLayout({
            x_expand: true,
            y_expand: false,
            ...Utils.getOrientationProp(false),
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
        });
        this.topBox.add_child(this.searchEntry);

        // Applications Box - Contains Favorites, Categories or programs
        this.applicationsScrollBox = this._createScrollView({
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: this._disableFadeEffect ? '' : 'small-vfade',
        });
        this.applicationsBox = new St.BoxLayout({
            ...Utils.getOrientationProp(true),
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        this._addChildToParent(this.applicationsScrollBox, this.applicationsBox);

        this.foldersContainer = new St.BoxLayout({
            ...Utils.getOrientationProp(true),
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        this.foldersGrid = new IconGrid({
            column_spacing: 6,
            row_spacing: 6,
            halign: Clutter.ActorAlign.CENTER,
        });
        this._setFolderGridColumns();
        this.foldersContainer.add_child(this.foldersGrid);

        const homeFolderItem = new HomeFolderItem(this);
        this._addItem(homeFolderItem);
        const newFolderItem = new GroupFolderItem(this, 'New Folder', null);
        this._addItem(newFolderItem);

        const searchBarLocation = ArcMenuManager.settings.get_enum('searchbar-default-top-location');
        if (searchBarLocation === Constants.SearchbarLocation.BOTTOM) {
            this.searchEntry.style = 'margin: 10px 220px;';
            this.topBox.style = 'padding-top: 0.5em;';

            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.add_child(this.foldersContainer);
            this.foldersContainer.set({
                y_align: Clutter.ActorAlign.START,
                y_expand: false,
            });
            this.add_child(separator);

            this.add_child(this.applicationsScrollBox);

            this.add_child(this.topBox);
        } else if (searchBarLocation === Constants.SearchbarLocation.TOP) {
            this.searchEntry.style = 'margin: 10px 220px;';
            this.topBox.style = 'padding-bottom: 0.5em;';
            this.add_child(this.topBox);

            this.add_child(this.applicationsScrollBox);

            const separator = new MW.ArcMenuSeparator(this, Constants.SeparatorStyle.MEDIUM,
                Constants.SeparatorAlignment.HORIZONTAL);
            this.foldersContainer.insert_child_at_index(separator, 0);
            this.add_child(this.foldersContainer);
        }

        this._redisplayWorkId = Main.initializeDeferredWork(this, () => this._redisplay());

        this._folderSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders'});
        this._folderSettings.connectObject('changed::folder-children', () => Main.queueDeferredWork(this._redisplayWorkId), this);
        this._parentalControlsManager = ParentalControlsManager.getDefault();
        this._parentalControlsManager.connectObject('app-filter-changed', () => Main.queueDeferredWork(this._redisplayWorkId), this);
        Shell.AppSystem.get_default().connectObject('installed-changed', () => Main.queueDeferredWork(this._redisplayWorkId), this);

        this.updateWidth();
        this._redisplay();
        this.setDefaultMenuView();
        this._setGridColumns(this.applicationsGrid);

        ArcMenuManager.settings.connectObject('changed::pop-default-view', () => this.setDefaultMenuView(), this);
        this._connectAppChangedEvents();

        // We don't use GMenu tree for Pop layout
        this._tree.disconnectObject(this);
    }

    reloadApplications() {
    }

    _redisplay() {
        const oldFolders = this._orderedItems.slice();
        const oldFoldersIds = oldFolders.map(icon => icon.folder_id);

        const newFolders = this._loadFolders();
        const newFoldersIds = newFolders.map(icon => icon.folder_id);

        const addedFolders = newFolders.filter(icon => !oldFoldersIds.includes(icon.folder_id));
        const removedFolders = oldFolders.filter(icon => !newFoldersIds.includes(icon.folder_id));

        // Remove old app icons
        removedFolders.forEach(item => {
            this._removeItem(item);
            item.destroy();
        });

        // Add new app icons, or move existing ones
        newFolders.forEach(item => {
            const index = newFolders.indexOf(item);
            const position = this.foldersGrid.getItemPosition(item);
            if (addedFolders.includes(item))
                this._addItem(item, index);
            else if (position !== index)
                this._moveItem(item, index);
        });

        this._orderedItems.forEach(icon => {
            icon.refreshContents();
        });

        if (!this.activeCategoryItem || this.activeCategoryItem?.appIds.length === 0)
            this.activateFolder();

        this.fadeOutNewFolder();
        this.maybeShowHomeFolder();
    }

    _addItem(item, position = 0) {
        this._folders.set(item.folder_id, item);
        this.foldersGrid.addItem(item, position);

        this._orderedItems.splice(position, 0, item);
    }

    _moveItem(item, newPosition) {
        this.foldersGrid.moveItem(item, newPosition);

        // Update the _orderedItems array
        this._orderedItems.splice(this._orderedItems.indexOf(item), 1);
        this._orderedItems.splice(newPosition, 0, item);
    }

    _removeItem(item) {
        const iconIndex = this._orderedItems.indexOf(item);

        this._orderedItems.splice(iconIndex, 1);
        this._folders.delete(item.folder_id);
        this.foldersGrid.removeItem(item);
    }

    updateWidth(setDefaultMenuView) {
        const widthAdjustment = ArcMenuManager.settings.get_int('menu-width-adjustment');
        let menuWidth = this.default_menu_width + widthAdjustment;
        // Set a 300px minimum limit for the menu width
        menuWidth = Math.max(300, menuWidth);
        this.applicationsScrollBox.style = `width: ${menuWidth}px;`;
        this.menu_width = menuWidth;

        if (setDefaultMenuView)
            this.setDefaultMenuView();

        this._setFolderGridColumns();
        this._setGridColumns(this.applicationsGrid);
    }

    _loadFolders() {
        const newFolders = [];
        const foldersData = {'Library Home': _('Library Home')};
        const homeFolderItem = this._folders.get('Library Home');
        newFolders.push(homeFolderItem);

        this._appInfoList = Shell.AppSystem.get_default().get_installed().filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch {
                return false;
            }
            return this._parentalControlsManager.shouldShowApp(appInfo);
        });

        const apps = this._appInfoList.map(app => app.get_id());

        const appSys = Shell.AppSystem.get_default();

        const appsInsideFolders = new Set();

        // Load and Create GroupFolderItems
        const folders = this._folderSettings.get_strv('folder-children');
        folders.forEach(id => {
            const path = `${this._folderSettings.path}folders/${id}/`;
            let folderIcon = this._folders.get(id);
            if (!folderIcon) {
                folderIcon = new GroupFolderItem(this, id, path);
                folderIcon.connect('apps-changed', () => {
                    this._redisplay();
                });

                this._folders.set(id, folderIcon);
            }

            // Don't try to display empty folders
            if (!folderIcon.visible)
                return;

            folderIcon.appIds.forEach(appId => appsInsideFolders.add(appId));
            foldersData[id] = folderIcon.folder_name;
            newFolders.push(folderIcon);
        });

        // Store the id and name of each folder in 'pop-folders-data'
        ArcMenuManager.settings.set_value('pop-folders-data', new GLib.Variant('a{ss}', foldersData));

        // Find any remaining apps not contained within a folder.
        const remainingApps = [];
        apps.forEach(appId => {
            if (appsInsideFolders.has(appId))
                return;
            const app = appSys.lookup_app(appId);
            if (app)
                remainingApps.push(app);
        });
        remainingApps.sort((a, b) => {
            const nameA = Utils.getAppDisplayName(a);
            const nameB = Utils.getAppDisplayName(b);
            return nameA.localeCompare(nameB);
        });
        homeFolderItem.appIds = remainingApps.map(app => app.id);

        const homeFolderHasApps = homeFolderItem.appIds.length > 0;
        homeFolderItem.set({
            visible: homeFolderHasApps,
            opacity: homeFolderHasApps ? 225 : 0,
            scale_x: homeFolderHasApps ? 1 : 0,
            scale_y: homeFolderHasApps ? 1 : 0,
        });

        const newFolderItem = this._folders.get('New Folder');
        newFolderItem.set({
            visible: false,
            opacity: 0,
            scale_x: 0,
            scale_y: 0,
        });
        newFolders.push(newFolderItem);
        return newFolders;
    }

    loadCategories() {
    }

    createNewFolder(app) {
        const newFolderId = GLib.uuid_string_random();

        const folders = this._folderSettings.get_strv('folder-children');
        folders.push(newFolderId);

        const newFolderPath = this._folderSettings.path.concat('folders/', newFolderId, '/');
        let newFolderSettings;
        try {
            newFolderSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.app-folders.folder',
                path: newFolderPath,
            });
        } catch {
            console.log('Error creating new folder');
            return;
        }

        const appIds = [app.id];
        let folderName = Utils.findBestFolderName([app]);
        if (!folderName)
            folderName = _('Unnamed Folder');

        newFolderSettings.delay();
        newFolderSettings.set_string('name', folderName);
        newFolderSettings.set_strv('apps', appIds);
        newFolderSettings.apply();

        this._folderSettings.set_strv('folder-children', folders);
    }

    maybeShowHomeFolder() {
        const homeFolderItem = this._folders.get('Library Home');
        const homeFolderHasApps = homeFolderItem.appIds.length > 0;

        if (!homeFolderItem.visible && homeFolderHasApps) {
            homeFolderItem.visible = true;
            homeFolderItem.ease({
                opacity: 255,
                duration: 200,
                scale_x: 1,
                scale_y: 1,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
            });
        } else if (!homeFolderHasApps) {
            homeFolderItem.ease({
                opacity: 0,
                scale_x: 0,
                scale_y: 0,
                duration: 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    homeFolderItem.visible = false;
                },
            });
        }
    }

    fadeInHomeFolder() {
        const homeFolderItem = this._folders.get('Library Home');
        if (homeFolderItem.visible)
            return;

        homeFolderItem.visible = true;
        homeFolderItem.ease({
            opacity: 255,
            duration: 200,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
    }

    fadeInNewFolder() {
        const newFolderItem = this._folders.get('New Folder');
        newFolderItem.visible = true;
        newFolderItem.ease({
            opacity: 255,
            duration: 200,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
    }

    fadeOutNewFolder() {
        const newFolderItem = this._folders.get('New Folder');
        newFolderItem.ease({
            opacity: 0,
            scale_x: 0,
            scale_y: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                newFolderItem.visible = false;
            },
        });
    }

    _setFolderGridColumns() {
        const gridIconPadding = 10;
        const iconWidth = 110 + gridIconPadding;

        const padding = 12;
        const totalWidth = this.menu_width - padding;
        const spacing = this.foldersGrid.layout_manager.column_spacing;
        const columns = Math.floor(totalWidth / (iconWidth + spacing));
        this.foldersGrid.setColumns(columns);
    }

    getAppInfos() {
        return this._appInfoList;
    }

    setDefaultMenuView() {
        super.setDefaultMenuView();

        this.activateFolder();
    }

    activateFolder() {
        const defaultView = ArcMenuManager.settings.get_string('pop-default-view');
        let folder = this._folders.get(defaultView);

        if (folder?.visible) {
            folder.displayMenuItems();
            this.setActiveCategory(folder);
            return;
        }

        for (const folderIter of this._folders.values()) {
            if (folderIter.visible) {
                folder = folderIter;
                break;
            }
        }

        folder.displayMenuItems();
        this.setActiveCategory(folder);
    }

    _onSearchEntryChanged(searchEntry, searchString) {
        super._onSearchEntryChanged(searchEntry, searchString);
        if (!searchEntry.isEmpty())
            this.activeCategoryType = Constants.CategoryType.SEARCH_RESULTS;
    }

    _onDestroy() {
        this._folderSettings.disconnectObject(this);
        if (this._folders) {
            this._folders.forEach((value, _key, _map) => {
                value.destroy();
            });
            this._folders = null;
        }

        this._orderedItems = null;
        this._appInfoList = null;
        this._folderSettings = null;
        super._onDestroy();
    }
}

class BaseFolderItem extends MW.DraggableMenuItem {
    static [GObject.properties] = {
        'folder-name': GObject.ParamSpec.string('folder-name', 'folder-name', 'folder-name',
            GObject.ParamFlags.READWRITE, ''),
        'folder-id': GObject.ParamSpec.string('folder-id', 'folder-id', 'folder-id',
            GObject.ParamFlags.READWRITE, ''),
        'home-folder': GObject.ParamSpec.boolean('home-folder', 'home-folder', 'home-folder',
            GObject.ParamFlags.READWRITE, false),
        'new-folder': GObject.ParamSpec.boolean('new-folder', 'new-folder', 'new-folder',
            GObject.ParamFlags.READWRITE, false),
    };

    static [GObject.signals] = {
        'apps-changed': {},
        'folder-moved': {},
    };

    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout, isDraggable) {
        const displayType = Constants.DisplayType.GRID;
        super(menuLayout, displayType, isDraggable);

        this._grid = menuLayout.applicationsGrid;
        this._menuItems = [];
        this._menuItemsMap = new Map();

        this.add_style_class_name('ArcMenuIconGrid ArcMenuGroupFolder');

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);
        this.add_child(this.label);
        this._updateIcon();

        this.bind_property('folder-name', this.label, 'text', GObject.BindingFlags.SYNC_CREATE);

        this.set({
            ...Utils.getOrientationProp(true),
            x_expand: false,
            tooltipLocation: Constants.TooltipLocation.BOTTOM_CENTERED,
            style: `width: ${110}px; height: ${72}px;`,
        });
    }

    get isActiveFolder() {
        return this._menuLayout.activeCategoryItem === this;
    }

    _compareItems(a, b) {
        return a.name.localeCompare(b.name);
    }

    getDragActor() {
        return this.createIcon();
    }

    _canAccept(source) {
        return source !== this && source instanceof ApplicationMenuItem && !this._menuItems.includes(source);
    }

    acceptDrop(source, actor, x, y) {
        const acceptDrop = super.acceptDrop(source, actor, x, y);
        if (!acceptDrop)
            return false;

        const {folderMenuItem, _app: app} = source;

        if (!app || !folderMenuItem)
            return false;

        source.dragDropAccepted = true;

        if (!folderMenuItem.homeFolder)
            folderMenuItem.removeApp(app);

        if (this.new_folder) {
            this._menuLayout.createNewFolder(app);
            return true;
        }

        if (!this.home_folder)
            this.addApp(app);

        return true;
    }

    _showFolderPreview() {
    }

    _hideFolderPreview() {
    }

    _loadApps() {
        const apps = [];
        const excludedApps = this._folder?.get_strv('excluded-apps') || [];
        const appSys = Shell.AppSystem.get_default();
        const addAppId = appId => {
            if (excludedApps.includes(appId))
                return;

            const app = appSys.lookup_app(appId);
            if (!app)
                return;

            if (!ParentalControlsManager.getDefault().shouldShowApp(app.get_app_info()))
                return;

            if (apps.indexOf(app) !== -1)
                return;

            apps.push(app);
        };

        this.appIds.forEach(addAppId);

        if (this._folder) {
            const folderCategories = this._folder.get_strv('categories');
            const appInfos = this._menuLayout.getAppInfos();
            appInfos.forEach(appInfo => {
                const appCategories = Utils.getCategories(appInfo);
                if (!listsIntersect(folderCategories, appCategories))
                    return;

                addAppId(appInfo.get_id());
            });
        }

        const items = [];
        apps.forEach(app => {
            let icon = this._menuItemsMap.get(app.get_id());
            if (!icon) {
                icon = new ApplicationMenuItem(this._menuLayout, app, this._menuLayout.display_type);
                icon.setFolderGroup(this);
            }

            items.push(icon);
        });

        return items;
    }

    refreshContents() {
        if (this.new_folder)
            return;

        const oldApps = this._menuItems.slice();
        const oldAppIds = oldApps.map(icon => icon._app.id);

        const newApps = this._loadApps();
        const newAppIds = newApps.map(icon => icon._app.id);

        const addedApps = newApps.filter(icon => !oldAppIds.includes(icon._app.id));
        const removedApps = oldApps.filter(icon => !newAppIds.includes(icon._app.id));

        // Remove old app icons
        removedApps.forEach(item => {
            this._removeItem(item);
            item.destroy();
        });

        // Add new app icons, or move existing ones
        newApps.forEach(item => {
            const index = newApps.indexOf(item);
            const position = this._menuItems.indexOf(item);
            if (addedApps.includes(item))
                this._addItem(item, index);
            else if (position !== index)
                this._moveItem(item, index);
        });
    }

    displayMenuItems() {
        this._menuLayout._clearActorsFromBox();
        this._menuLayout.searchEntry?.clearWithoutSearchChangeEvent();
        this._grid.removeAllItems();
        this._menuLayout._setGridColumns(this._grid);
        const groupAllAppsGridView = ArcMenuManager.settings.get_boolean('group-apps-alphabetically-grid-layouts');
        let currentCharacter;

        for (let i = 0; i < this._menuItems.length; i++) {
            const item = this._menuItems[i];
            const parent = item.get_parent();
            if (parent)
                parent.remove_child(item);

            if (groupAllAppsGridView && this.home_folder) {
                const appNameFirstChar = Utils.getAppDisplayName(item._app).charAt(0).toLowerCase();
                if (currentCharacter !== appNameFirstChar) {
                    currentCharacter = appNameFirstChar;

                    const label = this._menuLayout._createLabelWithSeparator(currentCharacter.toUpperCase());
                    this._grid.appendItem(label);
                }
            }

            this._grid.appendItem(item);
        }

        if (this._menuLayout.applicationsBox && !this._menuLayout.applicationsBox.contains(this._grid))
            this._menuLayout.applicationsBox.add_child(this._grid);

        this._menuLayout.activeMenuItem = this._menuItems[0];
    }

    _addItem(item, position) {
        this._menuItemsMap.set(item._app.id, item);

        if (this.isActiveFolder)
            this._grid.addItem(item, position);

        this._menuItems.splice(position, 0, item);
    }

    _moveItem(item, newPosition) {
        if (this.isActiveFolder)
            this._grid.moveItem(item, newPosition);

        const oldIndex = this._menuItems.indexOf(item);
        this._menuItems.splice(oldIndex, 1);
        this._menuItems.splice(newPosition, 0, item);
    }

    _removeItem(item) {
        const oldIndex = this._menuItems.indexOf(item);
        this._menuItems.splice(oldIndex, 1);
        this._menuItemsMap.delete(item._app.id);

        if (this.isActiveFolder)
            this._grid.removeItem(item);
    }

    activate(event) {
        super.activate(event);
        this._menuLayout.setActiveCategory(this);
        this.displayMenuItems();
    }

    _onDestroy() {
        if (this._menuLayout.activeCategoryItem === this)
            this._menuLayout.setActiveCategory(null, false);

        super._onDestroy();
    }
}

class HomeFolderItem extends BaseFolderItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super(menuLayout, false);

        this.hasContextMenu = false;
        this.folder_id = 'Library Home';
        this.folder_name = _('Library Home');
        this.home_folder = true;
        this._appIds = [];
    }

    get appIds() {
        return this._appIds;
    }

    set appIds(appIds) {
        this._appIds = appIds;
    }

    createIcon() {
        const icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_size: FolderIconSize,
            icon_name: 'user-home-symbolic',
        });
        return icon;
    }
}

class GroupFolderItem extends BaseFolderItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout, id, path) {
        super(menuLayout, true);

        if (path) {
            this._folder = new Gio.Settings({
                schema_id: 'org.gnome.desktop.app-folders.folder',
                path,
            });
            this._folder.connectObject('changed', this._sync.bind(this), this);
        } else {
            this.new_folder = true;
        }

        this.hasContextMenu = true;
        this.folder_id = id;
        this.hasContextMenu = true;

        this.refreshContents();
        this._sync();
    }

    get appIds() {
        return this._folder?.get_strv('apps') || [];
    }

    createIcon() {
        if (!this._menuItems.length || this.new_folder) {
            const icon = new St.Icon({
                style_class: 'popup-menu-icon',
                icon_size: FolderIconSize,
                icon_name: 'folder-directory-symbolic',
            });
            return icon;
        }

        const layout = new Clutter.GridLayout({
            row_homogeneous: true,
            column_homogeneous: true,
        });
        const icon = new St.Widget({
            layout_manager: layout,
            x_align: Clutter.ActorAlign.CENTER,
            style: `width: ${FolderIconSize}px; height: ${FolderIconSize}px;`,
        });

        const subSize = Math.floor(.4 * FolderIconSize);

        const numItems = this._menuItems.length;
        const rtl = icon.get_text_direction() === Clutter.TextDirection.RTL;
        for (let i = 0; i < 4; i++) {
            const style = `width: ${subSize}px; height: ${subSize}px;`;
            const bin = new St.Bin({style});
            if (i < numItems)
                bin.child = this._menuItems[i]._app.create_icon_texture(subSize);
            layout.attach(bin, rtl ? (i + 1) % 2 : i % 2, Math.floor(i / 2), 1, 1);
        }

        return icon;
    }

    _updateName() {
        if (this.new_folder) {
            this.folder_name = _('New Folder');
            return;
        }

        const name = getFolderName(this._folder);
        if (this.folder_name !== name)
            this.folder_name = name;
    }

    _sync() {
        if (this._deletingFolder)
            return;

        this.emit('apps-changed');

        this._updateName();

        if (!this.new_folder)
            this.visible = this._menuItems.length > 0;

        this._updateIcon();
    }

    addApp(app) {
        const folderApps = this._folder.get_strv('apps');
        folderApps.push(app.id);
        this._folder.set_strv('apps', folderApps);

        const excludedApps = this._folder.get_strv('excluded-apps');
        const index = excludedApps.indexOf(app.id);
        if (index >= 0) {
            excludedApps.splice(index, 1);
            this._folder.set_strv('excluded-apps', excludedApps);
        }
    }

    _removeFolder() {
        this._deletingFolder = true;

        // Resetting all keys deletes the relocatable schema
        const keys = this._folder.settings_schema.list_keys();
        for (const key of keys)
            this._folder.reset(key);

        const settings = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders'});
        const folders = settings.get_strv('folder-children');
        folders.splice(folders.indexOf(this.folder_id), 1);
        settings.set_strv('folder-children', folders);

        this._deletingFolder = false;
    }

    removeApp(app) {
        const folderApps = this._folder.get_strv('apps');
        const index = folderApps.indexOf(app.id);
        if (index >= 0)
            folderApps.splice(index, 1);

        // Remove the folder if this is the last app icon; otherwise, just remove the icon
        if (folderApps.length === 0) {
            this._removeFolder();
        } else {
            // If this is a categories-based folder, also add it to
            // the list of excluded apps
            const categories = this._folder.get_strv('categories');
            if (categories.length > 0) {
                const excludedApps = this._folder.get_strv('excluded-apps');
                excludedApps.push(app.id);
                this._folder.set_strv('excluded-apps', excludedApps);
            }

            this._folder.set_strv('apps', folderApps);
        }
    }

    popupContextMenu() {
        if (this.contextMenu === undefined) {
            this.contextMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
            this.contextMenu.connect('open-state-changed', (menu, isOpen) => {
                if (isOpen)
                    this.add_style_pseudo_class('active');
                else  if (!this.isActiveCategory)
                    this.remove_style_pseudo_class('active');
            });
            this.contextMenu.actor.add_style_class_name('arcmenu-menu app-menu');
            Main.uiGroup.add_child(this.contextMenu.actor);
            this._menuLayout.contextMenuManager.addMenu(this.contextMenu);

            this.contextMenu.addAction(_('Rename Folder'), () => this._createRenameDialog());
            this.contextMenu.addAction(_('Delete Folder'), () => this._createDeleteDialog());
        }

        this.contextMenu.open(BoxPointer.PopupAnimation.FULL);
    }

    _createDeleteDialog() {
        this.contextMenu.close();
        const dialog = new ModalDialog.ModalDialog();
        const content = new Dialog.MessageDialogContent({
            title: _('Permanently delete %s folder?').format(this.folder_name),
        });
        dialog.contentLayout.add_child(content);

        dialog.addButton({
            label: _('No'),
            action: () => {
                dialog.close();
            },
            default: true,
            key: Clutter.KEY_Escape,
        });
        dialog.addButton({
            label: _('Yes'),
            action: () => {
                this._removeFolder(this);
                dialog.close();
            },
            default: false,
            key: null,
        });
        dialog.open();
    }

    _createRenameDialog() {
        this.contextMenu.close();
        const dialog = new ModalDialog.ModalDialog();
        const content = new Dialog.MessageDialogContent({
            title: _('Rename %s folder').format(this.folder_name),
        });
        dialog.contentLayout.add_child(content);

        const entry = new St.Entry({
            style_class: 'folder-name-entry',
            text: this.folder_name,
            reactive: true,
            can_focus: true,
        });
        entry.clutter_text.set({
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        content.add_child(entry);
        dialog.setInitialKeyFocus(entry);

        const saveName = () => {
            const newFolderName = entry.text.trim();

            if (newFolderName.length === 0 || newFolderName === this.folder_name) {
                dialog.close();
                return;
            }

            this._folder.set_string('name', newFolderName);
            this._folder.set_boolean('translate', false);
            dialog.close();
        };

        entry.clutter_text.set_selection(0, -1);
        entry.clutter_text.connect('activate', () => saveName());

        dialog.addButton({
            label: _('Cancel'),
            action: () => {
                dialog.close();
            },
            default: false,
            key: Clutter.KEY_Escape,
        });
        dialog.addButton({
            label: _('Apply'),
            action: () => saveName(),
            default: false,
            key: null,
        });
        dialog.open();
    }

    _getDropTarget(x, y, source, layoutManager) {
        const [targetIndex, dragLocation] = super._getDropTarget(x, y, source, layoutManager);

        if (targetIndex === 0)
            return [-1, 0];

        return [targetIndex, dragLocation];
    }

    _onDragEnd() {
        super._onDragEnd();

        const parent = this.get_parent();
        if (!parent)
            return;

        const layoutManager = parent.layout_manager;
        const orderedList = layoutManager.getChildren();
        const orderedFolders = [];
        orderedList.forEach(child => {
            if (!child.home_folder && !child.new_folder)
                orderedFolders.push(child.folder_id);
        });
        this._menuLayout._folderSettings.set_strv('folder-children', orderedFolders);
    }
}

export class ApplicationMenuItem extends MW.DraggableMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout, app, displayType) {
        super(menuLayout, displayType);
        this._app = app;
        this._displayType = displayType;

        this.hasContextMenu = !!this._app;

        const showNewApps = ArcMenuManager.settings.get_boolean('show-recently-installed-apps');
        if (showNewApps) {
            const recentApps = ArcMenuManager.settings.get_strv('recently-installed-apps');
            this.isRecentlyInstalled = recentApps.some(appIter => appIter === this._app.get_id());
        }

        this._updateIcon();

        this.label.text = Utils.getAppDisplayName(this._app);
        this.description = this._app.get_description();

        this.add_child(this.label);

        if (this.isRecentlyInstalled) {
            this._indicator = new St.Label({
                text: _('New'),
                style_class: 'arcmenu-text-indicator',
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._indicator);
        }

        this.connect('notify::hover', () => this.removeIndicator());
        this.connect('key-focus-in', () => this.removeIndicator());
    }

    _onDestroy() {
        this._indicator?.destroy();
        this._indicator = null;
        super._onDestroy();
    }

    setFolderGroup(folderMenuItem) {
        this.folderMenuItem = folderMenuItem;
    }

    getDragActor() {
        const icon = this.createIcon();
        icon.set({
            scale_x: 0.8,
            scale_y: 0.8,
        });
        return icon;
    }

    _onDragBegin() {
        this._menuLayout.fadeInNewFolder();
        this._menuLayout.fadeInHomeFolder();
        super._onDragBegin();
    }

    _onDragMotion(dragEvent) {
        if (!this.folderMenuItem || this.folderMenuItem.home_folder)
            return DragMotionResult.CONTINUE;

        return super._onDragMotion(dragEvent);
    }

    _canAccept() {
        return false;
    }

    acceptDrop() {
        return false;
    }

    _onDragEnd() {
        this._menuLayout?.fadeOutNewFolder();
        if (!this.dragDropAccepted)
            this._menuLayout?.maybeShowHomeFolder();
        super._onDragEnd();

        if (!this._menuLayout || this.dragDropAccepted)
            return;

        const parent = this.get_parent();
        if (!parent || this.folderMenuItem?.home_folder)
            return;

        const layoutManager = parent.layout_manager;
        const children = layoutManager.getChildren();
        const appIds = children.map(child => child._app.id);

        this.folderMenuItem._folder.set_strv('apps', appIds);
    }

    set folderPath(value) {
        this.hasContextMenu = value;
        this._folderPath = value;
    }

    get folderPath() {
        return this._folderPath;
    }

    createIcon() {
        this._iconBin.x_align = Clutter.ActorAlign.CENTER;

        const iconSizeEnum = ArcMenuManager.settings.get_enum('menu-item-grid-icon-size');
        const defaultIconSize = this._menuLayout.icon_grid_size;
        const {iconSize} = Utils.getGridIconSize(iconSizeEnum, defaultIconSize);

        const icon = this._app.create_icon_texture(iconSize);

        if (icon) {
            icon.style_class = this._displayType === Constants.DisplayType.GRID ? '' : 'popup-menu-icon';
            return icon;
        } else {
            return false;
        }
    }

    removeIndicator() {
        if (this.isRecentlyInstalled) {
            this.isRecentlyInstalled = false;
            const recentApps = ArcMenuManager.settings.get_strv('recently-installed-apps');
            const index = recentApps.indexOf(this._app.get_id());
            if (index > -1)
                recentApps.splice(index, 1);

            ArcMenuManager.settings.set_strv('recently-installed-apps', recentApps);

            this._indicator.hide();
            this._menuLayout.setNewAppIndicator();
        }
    }

    popupContextMenu() {
        this.removeIndicator();

        if (!this._app && !this.folderPath)
            return;

        if (this.contextMenu === undefined) {
            this.contextMenu = new AppContextMenu(this, this._menuLayout);
            this.contextMenu.setApp(this._app);
            this.contextMenu.centerBoxPointerPosition();
        }

        this.contextMenu.open(BoxPointer.PopupAnimation.FULL);
    }

    activate(event) {
        this.removeIndicator();

        MW.launchApp(this._app, event);

        this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }
}
