import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {ArcMenuManager} from './arcmenuManager.js';
import * as Utils from './utils.js';

Gio._promisify(Gio._LocalFilePrototype, 'query_info_async', 'query_info_finish');
Gio._promisify(Gio._LocalFilePrototype, 'set_attributes_async', 'set_attributes_finish');

const DESKTOP_ICONS_UUIDS = [
    'ding@rastersoft.com', 'gtk4-ding@smedius.gitlab.com',
    'desktopicons-neo@darkdemon',
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

export const AppContextMenu = class ArcMenuAppContextMenu extends AppMenu {
    constructor(sourceActor, menuLayout) {
        super(sourceActor, St.Side.TOP);

        this._menuLayout = menuLayout;
        this._menuButton = this._menuLayout.menuButton;

        this._pinnedAppData = this.sourceActor.pinnedAppData;

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
        this.actor.connect('key-press-event', this._menuKeyPress.bind(this));

        this._newWindowItem.connect('activate', () => this.closeMenus());
        this._onGpuMenuItem.connect('activate', () => this.closeMenus());
        this._detailsItem.connect('activate', () => this.closeMenus());

        this._arcMenuPinnedItem = this._createMenuItem(_('Pin to ArcMenu'), 8, () => {
            this.close();

            if (this._pinnedAppData) {
                let sourceSettings;
                const isFolder = this.sourceActor.folderSettings;
                if (isFolder)
                    sourceSettings = this.sourceActor.folderSettings;
                else
                    sourceSettings = ArcMenuManager.settings;

                const pinnedAppsList = sourceSettings.get_value('pinned-apps').deepUnpack();
                for (let i = 0; i < pinnedAppsList.length; i++) {
                    if (pinnedAppsList[i].id === this._app.get_id()) {
                        pinnedAppsList.splice(i, 1);
                        sourceSettings.set_value('pinned-apps',  new GLib.Variant('aa{ss}', pinnedAppsList));
                        break;
                    }
                }
            } else {
                const pinnedAppsList = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();
                const newPinnedAppData = {
                    id: this._app.get_id(),
                };
                pinnedAppsList.push(newPinnedAppData);
                ArcMenuManager.settings.set_value('pinned-apps',  new GLib.Variant('aa{ss}', pinnedAppsList));
            }
        });

        this._createDesktopShortcutItem = this._createMenuItem(_('Create Desktop Shortcut'), 7, () => {
            const [exists, src, dst] = this.getDesktopShortcut();
            if (exists && src && dst) {
                try {
                    dst.delete(null);
                } catch (e) {
                    console.log(`Failed to delete shortcut: ${e.message}`);
                }
            } else if (src && dst) {
                try {
                    src.copy(dst, Gio.FileCopyFlags.OVERWRITE, null, null);
                    const info = new Gio.FileInfo();
                    info.set_attribute_string('metadata::trusted', 'true');
                    dst.set_attributes_from_info(info,
                        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                    dst.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o0755,
                        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                } catch (e) {
                    console.log(`Failed to copy to desktop: ${e.message}`);
                }
            }
            this.close();
            this._updateDesktopShortcutItem();
        });
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 8);

        ArcMenuManager.settings.connectObject('changed::pinned-apps', () => this._updateArcMenuPinnedItem(), this.actor);
        Main.extensionManager.connectObject('extension-state-changed', (data, changedExtension) => {
            if (DESKTOP_ICONS_UUIDS.includes(changedExtension.uuid))
                this._updateDesktopShortcutItem();
        });

        this.connect('active-changed', () => this._activeChanged());
    }

    _activeChanged() {
        if (this._activeMenuItem)
            Utils.ensureActorVisibleInScrollView(this._activeMenuItem);
    }

    open(animate) {
        this._menuButton.clearTooltipShowingId();
        this._menuButton.hideTooltip();

        this._updateDesktopShortcutItem();

        super.open(animate);
        this.sourceActor.add_style_pseudo_class('active');
    }

    destroy() {
        this.destroyed = true;
        this._createDesktopShortcutItem = null;
        this._arcMenuPinnedItem = null;
        this._disconnectSignals();

        Main.extensionManager.disconnectObject(this);

        this._menuButton = null;
        this._pinnedAppData = null;
        this._menuLayout = null;

        super.destroy();
    }

    closeMenus() {
        this.close();
        this._menuLayout.arcMenu.toggle();
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

        if (this.destroyed)
            return;

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

    isDesktopActive() {
        let hasActiveDesktop = false;

        DESKTOP_ICONS_UUIDS.forEach(uuid => {
            const extension = Main.extensionManager.lookup(uuid);
            if (extension?.state === Utils.ExtensionState.ACTIVE)
                hasActiveDesktop = true;
        });

        return hasActiveDesktop;
    }

    getDesktopShortcut() {
        if (!this._app)
            return [false, null, null];

        const desktop = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        const src = Gio.File.new_for_path(this._app.get_app_info().get_filename());
        const dst = Gio.File.new_for_path(GLib.build_filenamev([desktop, src.get_basename()]));
        const exists = dst.query_exists(null);
        return [exists, src, dst];
    }

    _updateDesktopShortcutItem() {
        const isDesktopActive = this.isDesktopActive();

        if (!this._app || !isDesktopActive)
            return;

        this._createDesktopShortcutItem.visible = true;

        const [exists] = this.getDesktopShortcut();

        this._createDesktopShortcutItem.label.text = exists ?  _('Delete Desktop Shortcut')
            : _('Create Desktop Shortcut');
    }

    // For Custom Shortcuts in Pinned Apps category. ie ArcMenu Settings
    addUnpinItem(id, folder = null) {
        this._disconnectSignals();
        this.removeAll();
        this._id = id;
        this._arcMenuPinnedItem = this._createMenuItem(_('Unpin from ArcMenu'), 0, () => {
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
                    sourceSettings.set_value('pinned-apps',  new GLib.Variant('aa{ss}', pinnedAppsList));
                    break;
                }
            }
        });
    }

    _updateArcMenuPinnedItem() {
        if (!this._app) {
            this._arcMenuPinnedItem.visible = false;
            return;
        }

        this._arcMenuPinnedItem.visible = this._menuLayout.hasPinnedApps;

        this._arcMenuPinnedItem.label.text = this._pinnedAppData ?  _('Unpin from ArcMenu') : _('Pin to ArcMenu');
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

    _menuKeyPress(actor, event) {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Menu) {
            this.toggle();
            this.sourceActor.sync_hover();
        }
    }

    _onKeyPress() {
        return Clutter.EVENT_PROPAGATE;
    }
};
