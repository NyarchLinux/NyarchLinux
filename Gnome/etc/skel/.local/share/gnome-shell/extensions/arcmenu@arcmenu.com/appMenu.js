import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Utils from './utils.js';

Gio._promisify(Gio._LocalFilePrototype, 'query_info_async', 'query_info_finish');
Gio._promisify(Gio._LocalFilePrototype, 'set_attributes_async', 'set_attributes_finish');

const DESKTOP_ICONS_UUIDS = [
    'ding@rastersoft.com', 'gtk4-ding@smedius.gitlab.com',
    'zorin-desktop-icons@zorinos.com',
];

/**
 *
 * @param {Actor} child
 */
function isPopupMenuItemVisible(child) {
    if (child._delegate instanceof PopupMenu.PopupMenuSection) {
        if (child._delegate.isEmpty())
            return false;
    }
    return child.visible;
}

class DesktopTarget extends EventEmitter {
    constructor() {
        super();

        this._hasDesktop = false;

        Main.extensionManager.connectObject('extension-state-changed', (data, changedExtension) => {
            if (DESKTOP_ICONS_UUIDS.includes(changedExtension.uuid))
                this._checkDesktopExists();
        }, this);

        this._checkDesktopExists();
    }

    get hasDesktop() {
        return this._hasDesktop;
    }

    _checkDesktopExists() {
        const hasDesktop = DESKTOP_ICONS_UUIDS.some(uuid => {
            const extension = Main.extensionManager.lookup(uuid);
            return extension?.state === Utils.ExtensionState.ACTIVE;
        });

        if (hasDesktop !== this._hasDesktop) {
            this._hasDesktop = hasDesktop;
            this.emit('desktop-changed');
        }
    }

    getDesktopShortcutInfo(appInfo) {
        const filename = appInfo.get_filename();
        if (!filename)
            return {error: true, exists: false, sourceFile: null, desktopFile: null};

        const desktopDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        if (!desktopDir)
            return {error: true, exists: false, sourceFile: null, desktopFile: null};

        const sourceFile = Gio.File.new_for_path(filename);
        const desktopFile = Gio.File.new_for_path(GLib.build_filenamev([desktopDir, sourceFile.get_basename()]));
        const exists = desktopFile.query_exists(null);

        return {
            error: false,
            exists,
            sourceFile,
            desktopFile,
        };
    }

    async createDesktopShortcut(appInfo) {
        const {error, exists, sourceFile, desktopFile} = this.getDesktopShortcutInfo(appInfo);

        if (exists || error)
            return;

        try {
            sourceFile.copy(desktopFile, Gio.FileCopyFlags.OVERWRITE, null, null);
            await this._markTrusted(desktopFile);
        } catch (e) {
            console.log(`Failed to copy to desktop: ${e.message}`);
        }
    }

    deleteDesktopShortcut(appInfo) {
        const {error, exists, desktopFile} = this.getDesktopShortcutInfo(appInfo);

        if (!exists || error)
            return;

        try {
            desktopFile.delete(null);
        } catch (e) {
            console.log(`Failed to delete shortcut: ${e.message}`);
        }
    }

    async _markTrusted(file) {
        const modeAttr = Gio.FILE_ATTRIBUTE_UNIX_MODE;
        const trustedAttr = 'metadata::trusted';
        const queryFlags = Gio.FileQueryInfoFlags.NONE;
        const ioPriority = GLib.PRIORITY_DEFAULT;

        try {
            let info = await file.query_info_async(modeAttr, queryFlags, ioPriority, null);

            const mode = info.get_attribute_uint32(modeAttr) | 0o00100;
            info.set_attribute_uint32(modeAttr, mode);
            info.set_attribute_string(trustedAttr, 'true');
            await file.set_attributes_async(info, queryFlags, ioPriority, null);

            // Hack: force nautilus to reload file info
            info = new Gio.FileInfo();
            info.set_attribute_uint64(Gio.FILE_ATTRIBUTE_TIME_ACCESS, GLib.get_real_time());

            await file.set_attributes_async(info, queryFlags, ioPriority, null);
        } catch (e) {
            console.log(`Failed to mark file as trusted: ${e.message}`);
        }
    }

    destroy() {
        Main.extensionManager.disconnectObject(this);
    }
}

export const AppContextMenu = class ArcMenuAppContextMenu extends AppMenu {
    constructor(sourceActor, menuLayout) {
        super(sourceActor, St.Side.TOP);

        this._menuLayout = menuLayout;
        this._menuButton = this._menuLayout.menuButton;

        this._isPinnedApp = false;

        this._enableFavorites = true;
        this._showSingleWindows = true;
        this.actor.add_style_class_name('arcmenu-menu app-menu');

        Main.uiGroup.add_child(this.actor);
        this._menuLayout.contextMenuManager.addMenu(this);

        this.sourceActor.connect('destroy', () => {
            if (this.isOpen)
                this.close();
            Main.uiGroup.remove_child(this.actor);
            this.destroy();
        });

        this._newWindowItem.connect('activate', () => this.closeMenus());
        this._onGpuMenuItem.connect('activate', () => this.closeMenus());
        this._detailsItem.connect('activate', () => this.closeMenus());

        this._arcMenuPinnedItem = this._createMenuItem(_('Pin to ArcMenu'), 8,
            () => this._pinAppsAction());

        this._desktopShortcutItem = this._createMenuItem(_('Create Desktop Shortcut'), 7,
            () => this._desktopShortcutAction());

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 8);

        ArcMenuManager.settings.connectObject('changed::pinned-apps', () => this._updateArcMenuPinnedItem(), this.actor);

        this._desktopTarget = new DesktopTarget();
        this._desktopTarget.connectObject('desktop-changed', () => this._updateDesktopShortcutItem(), this);

        this.connect('active-changed', () => this._activeChanged());

        this._updateDesktopShortcutItem();
    }

    _unpinAction(folder) {
        this.close();

        let sourceSettings;
        if (!folder && this.sourceActor.folderSettings)
            sourceSettings = this.sourceActor.folderSettings;
        else
            sourceSettings = ArcMenuManager.settings;

        // Unpinned the folder, reset all folder settings keys
        if (folder) {
            const keys = folder.settings_schema.list_keys();
            for (const key of keys)
                folder.reset(key);

            return;
        }

        const pinnedAppsList = sourceSettings.get_value('pinned-apps').deepUnpack();
        for (let i = 0; i < pinnedAppsList.length; i++) {
            if (pinnedAppsList[i].id === this._id) {
                pinnedAppsList.splice(i, 1);
                sourceSettings.set_value('pinned-apps', new GLib.Variant('aa{ss}', pinnedAppsList));
                break;
            }
        }
    }

    _pinAppsAction() {
        this.close();

        if (this._isPinnedApp) {
            const sourceSettings = this.sourceActor.folderSettings ?? ArcMenuManager.settings;

            const pinnedAppsList = sourceSettings.get_value('pinned-apps').deepUnpack();
            for (let i = 0; i < pinnedAppsList.length; i++) {
                if (pinnedAppsList[i].id === this._app.get_id()) {
                    pinnedAppsList.splice(i, 1);
                    sourceSettings.set_value('pinned-apps', new GLib.Variant('aa{ss}', pinnedAppsList));
                    break;
                }
            }
        } else {
            const pinnedAppsList = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();
            const newPinnedAppData = {
                id: this._app.get_id(),
            };
            pinnedAppsList.push(newPinnedAppData);
            ArcMenuManager.settings.set_value('pinned-apps', new GLib.Variant('aa{ss}', pinnedAppsList));
        }
    }

    _desktopShortcutAction() {
        if (!this._app)
            return;

        const appInfo = this._app.get_app_info();
        const {error, exists} = this._desktopTarget.getDesktopShortcutInfo(appInfo);

        if (error)
            return;

        if (exists)
            this._desktopTarget.deleteDesktopShortcut(appInfo);
        else
            this._desktopTarget.createDesktopShortcut(appInfo);

        this.close();
        this._updateDesktopShortcutItem();
    }

    _activeChanged() {
        if (this._activeMenuItem)
            Utils.ensureActorVisibleInScrollView(this._activeMenuItem);
    }

    open(animate) {
        this._menuButton.clearTooltipShowingId();
        this._menuButton.hideTooltip();

        super.open(animate);
        this.sourceActor.add_style_pseudo_class('active');
    }

    destroy() {
        this._desktopTarget.disconnectObject(this);
        this._desktopTarget.destroy();
        this._disconnectSignals();

        super.destroy();

        this._desktopTarget = null;
        this._desktopShortcutItem = null;
        this._arcMenuPinnedItem = null;
        this._menuButton = null;
        this._isPinnedApp = null;
        this._menuLayout = null;
    }

    closeMenus() {
        this.close();
        this._menuLayout.closeArcMenu();
    }

    _createMenuItem(labelText, position, callback) {
        const item = new PopupMenu.PopupMenuItem(labelText);
        item.connect('activate', () => callback());
        this.addMenuItem(item, position);
        return item;
    }

    setApp(app) {
        if (this._app === app)
            return;

        this._app?.disconnectObject(this);

        this._app = app;
        this._app?.connectObject('windows-changed',
            () => this._queueUpdateWindowsSection(), this);

        this._updateWindowsSection();

        const appInfo = app?.app_info;
        const actions = appInfo?.list_actions() ?? [];

        this._actionSection.removeAll();
        actions.forEach(action => {
            const label = appInfo.get_action_name(action);
            this._actionSection.addAction(label, event => {
                if (action === 'new-window')
                    this._animateLaunch();

                this._app.launch_action(action, event.get_time(), -1);
                this.closeMenus();
            });
        });

        this._updateQuitItem();
        this._updateNewWindowItem();
        this._updateFavoriteItem();
        this._updateGpuItem();
        this._updateArcMenuPinnedItem();
        this._updateDesktopShortcutItem();
    }

    _updateDesktopShortcutItem() {
        if (!this._app || !this._desktopShortcutItem)
            return;

        const appInfo = this._app.get_app_info();
        const {exists} = this._desktopTarget.getDesktopShortcutInfo(appInfo);

        this._desktopShortcutItem.label.text = exists ? _('Delete Desktop Shortcut')
            : _('Create Desktop Shortcut');
        this._desktopShortcutItem.visible = this._desktopTarget.hasDesktop;
    }

    // Add Unpin entry for pinned custom shortcuts and folders.
    addUnpinItem(id, folder = null) {
        this._disconnectSignals();
        this.removeAll();
        this._id = id;
        this._arcMenuPinnedItem = this._createMenuItem(_('Unpin from ArcMenu'), 0,
            () => this._unpinAction(folder));
    }

    _updateArcMenuPinnedItem() {
        if (!this._app) {
            this._arcMenuPinnedItem.visible = false;
            return;
        }

        let isPinned = false;
        const isFolder = this.sourceActor.folderSettings ?? false;
        const sourceSettings = this.sourceActor.folderSettings ?? ArcMenuManager.settings;
        const pinnedAppsList = sourceSettings.get_value('pinned-apps').deepUnpack();
        for (let i = 0; i < pinnedAppsList.length; i++) {
            if (pinnedAppsList[i].id === this._app.get_id()) {
                isPinned = true;
                break;
            }
        }

        this._isPinnedApp = isPinned;

        this._arcMenuPinnedItem.visible = this._menuLayout.hasPinnedApps;
        const unpinText = isFolder ? _('Unpin from Folder') : _('Unpin from ArcMenu');
        this._arcMenuPinnedItem.label.text = this._isPinnedApp ? unpinText : _('Pin to ArcMenu');
    }

    _updateWindowsSection() {
        if (this._updateWindowsLaterId) {
            const laters = global.compositor.get_laters();
            laters.remove(this._updateWindowsLaterId);
        }
        this._updateWindowsLaterId = 0;

        this._windowSection.removeAll();
        this._openWindowsHeader.hide();

        if (!this._app)
            return;

        const minWindows = this._showSingleWindows ? 1 : 2;
        const windows = this._app.get_windows().filter(w => !w.skip_taskbar);
        if (windows.length < minWindows)
            return;

        this._openWindowsHeader.show();

        windows.forEach(window => {
            const title = window.title || this._app.get_name();
            const item = this._windowSection.addAction(title, event => {
                this.closeMenus();
                Main.activateWindow(window, event.get_time());
            });
            window.connectObject('notify::title', () => {
                item.label.text = window.title || this._app.get_name();
            }, item);
        });
    }

    setFolderPath(path) {
        this._disconnectSignals();
        this.removeAll();

        this._openFolderLocationItem = this._createMenuItem(_('Open Folder Location'), 0, () => {
            const file = Gio.File.new_for_path(path);
            const context = global.create_app_launch_context(Clutter.get_current_event().get_time(), -1);
            new Promise((resolve, reject) => {
                Gio.AppInfo.launch_default_for_uri_async(file.get_uri(), context, null, (o, res) => {
                    try {
                        Gio.AppInfo.launch_default_for_uri_finish(res);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            this.closeMenus();
        });
    }

    addAdditionalAction(name, action) {
        if (!this._openFolderLocationItem) {
            this._disconnectSignals();
            this.removeAll();
        } else {
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        this._additionalAction = new PopupMenu.PopupMenuItem(_(name));
        this._additionalAction.connect('activate', () => {
            this.close();
            action();
        });
        this.addMenuItem(this._additionalAction);
    }

    isEmpty() {
        if (!this._app && !this._openFolderLocationItem && !this._id && !this._additionalAction)
            return true;

        const hasVisibleChildren = this.box.get_children().some(child => {
            if (child._delegate instanceof PopupMenu.PopupSeparatorMenuItem)
                return false;
            return isPopupMenuItemVisible(child);
        });

        return !hasVisibleChildren;
    }

    centerBoxPointerPosition() {
        this._boxPointer.setSourceAlignment(.50);
        this._arrowAlignment = .5;
        this._boxPointer._border.queue_repaint();
    }

    rightBoxPointerPosition() {
        this._arrowSide = St.Side.LEFT;
        this._boxPointer._arrowSide = St.Side.LEFT;
        this._boxPointer._userArrowSide = St.Side.LEFT;
        this._boxPointer.setSourceAlignment(.50);
        this._arrowAlignment = .5;
        this._boxPointer._border.queue_repaint();
    }

    _disconnectSignals() {
        ArcMenuManager.settings.disconnectObject(this.actor);
        this._appSystem.disconnectObject(this.actor);
        this._parentalControlsManager.disconnectObject(this.actor);
        this._appFavorites.disconnectObject(this.actor);
        global.settings.disconnectObject(this.actor);
        global.disconnectObject(this.actor);
    }

    close(animate) {
        super.close(animate);
        this.sourceActor.remove_style_pseudo_class('active');
        this.sourceActor.sync_hover();
    }

    _onKeyPress() {
        return Clutter.EVENT_PROPAGATE;
    }
};
