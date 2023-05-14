/* exported AppContextMenu */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Clutter, Gio, GLib, Meta, St} = imports.gi;
const AppMenu = imports.ui.appMenu;
const {ExtensionState} = ExtensionUtils;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const _ = Gettext.gettext;

const DESKTOP_ICONS_UUIDS = [
    'ding@rastersoft.com', 'gtk4-ding@smedius.gitlab.com',
    'desktopicons-neo@darkdemon',
];

var AppContextMenu = class ArcMenuAppContextMenu extends AppMenu.AppMenu {
    constructor(sourceActor, menuLayout) {
        super(sourceActor, St.Side.TOP);

        this._menuButton = menuLayout.menuButton;
        this._menuLayout = menuLayout;
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
            const pinnedApps = Me.settings.get_strv('pinned-app-list');
            const _isPinnedApp = this._isPinnedApp();

            this.close();

            if (_isPinnedApp) {
                for (let i = 0; i < pinnedApps.length; i += 3) {
                    if (pinnedApps[i + 2] === this._app.get_id()) {
                        pinnedApps.splice(i, 3);
                        Me.settings.set_strv('pinned-app-list', pinnedApps);
                        break;
                    }
                }
            } else {
                pinnedApps.push(this._app.get_app_info().get_display_name());
                pinnedApps.push('');
                pinnedApps.push(this._app.get_id());
                Me.settings.set_strv('pinned-app-list', pinnedApps);
            }
        });

        this._createDesktopShortcutItem = this._createMenuItem(_('Create Desktop Shortcut'), 7, () => {
            const [exists, src, dst] = this.getDesktopShortcut();
            if (exists && src && dst) {
                try {
                    dst.delete(null);
                } catch (e) {
                    log(`Failed to delete shortcut: ${e.message}`);
                }
            } else if (src && dst) {
                try {
                    src.copy(dst, Gio.FileCopyFlags.OVERWRITE, null, null);
                } catch (e) {
                    log(`Failed to copy to desktop: ${e.message}`);
                }
            }
            this.close();
            this._updateDesktopShortcutItem();
        });
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 8);

        Me.settings.connectObject('changed::pinned-app-list', () => this._updateArcMenuPinnedItem(), this.actor);
        this.desktopExtensionStateChangedId =
            Main.extensionManager.connect('extension-state-changed', (data, extension) => {
                if (DESKTOP_ICONS_UUIDS.includes(extension.uuid))
                    this._updateDesktopShortcutItem();
            });

        this.connect('destroy', () => this._onDestroy());
    }

    _onDestroy() {
        this.destroyed = true;
        this._disconnectSignals();
        if (this.desktopExtensionStateChangedId) {
            Main.extensionManager.disconnect(this.desktopExtensionStateChangedId);
            this.desktopExtensionStateChangedId = null;
        }
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
            if (extension?.state === ExtensionState.ENABLED)
                hasActiveDesktop = true;
        });

        return hasActiveDesktop;
    }

    getDesktopShortcut() {
        if (!this._app)
            return [false, null, null];

        const fileDestination = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        const src = Gio.File.new_for_path(this._app.get_app_info().get_filename());
        const dst = Gio.File.new_for_path(GLib.build_filenamev([fileDestination, src.get_basename()]));
        const exists = dst.query_exists(null);
        return [exists, src, dst];
    }

    _updateDesktopShortcutItem() {
        const isDesktopActive = this.isDesktopActive();

        if (!this._app || !isDesktopActive) {
            this._createDesktopShortcutItem.visible = false;
            return;
        }
        this._createDesktopShortcutItem.visible = true;

        const [exists, src_, dst_] = this.getDesktopShortcut();

        this._createDesktopShortcutItem.label.text = exists ?  _('Delete Desktop Shortcut')
            : _('Create Desktop Shortcut');
    }

    // For Custom Shortcuts in Pinned Apps category. ie ArcMenu Settings
    addUnpinItem(command) {
        this._disconnectSignals();
        this.removeAll();
        this._command = command;
        this._arcMenuPinnedItem = this._createMenuItem(_('Unpin from ArcMenu'), 0, () => {
            this.close();
            const pinnedApps = Me.settings.get_strv('pinned-app-list');
            for (let i = 0; i < pinnedApps.length; i += 3) {
                if (pinnedApps[i + 2] === this._command) {
                    pinnedApps.splice(i, 3);
                    Me.settings.set_strv('pinned-app-list', pinnedApps);
                    break;
                }
            }
        });
    }

    _isPinnedApp() {
        const pinnedApps = Me.settings.get_strv('pinned-app-list');
        let matchFound = false;

        // 3rd entry contains the appID
        for (let i = 2; i < pinnedApps.length; i += 3) {
            if (pinnedApps[i] === this._app.get_id()) {
                matchFound = true;
                break;
            }
        }
        return matchFound;
    }

    _updateArcMenuPinnedItem() {
        if (!this._app) {
            this._arcMenuPinnedItem.visible = false;
            return;
        }

        this._arcMenuPinnedItem.visible = this._menuLayout.hasPinnedApps;
        const _isPinnedApp = this._isPinnedApp();

        this._arcMenuPinnedItem.label.text = _isPinnedApp ?  _('Unpin from ArcMenu') : _('Pin to ArcMenu');
    }

    _updateWindowsSection() {
        if (this._updateWindowsLaterId) {
            if (global.compositor.get_laters) {
                const laters = global.compositor.get_laters();
                laters.remove(this._updateWindowsLaterId);
            } else {
                Meta.later_remove(this._updateWindowsLaterId);
            }
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
        if (!this._app && !this._openFolderLocationItem && !this._command && !this._additionalAction)
            return true;

        const hasVisibleChildren = this.box.get_children().some(child => {
            if (child._delegate instanceof PopupMenu.PopupSeparatorMenuItem)
                return false;
            return PopupMenu.isPopupMenuItemVisible(child);
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
        Me.settings.disconnectObject(this.actor);
        this._appSystem.disconnectObject(this.actor);
        this._parentalControlsManager.disconnectObject(this.actor);
        this._appFavorites.disconnectObject(this.actor);
        global.settings.disconnectObject(this.actor);
        global.disconnectObject(this.actor);
    }

    open(animate) {
        if (this._menuButton.tooltipShowingID) {
            GLib.source_remove(this._menuButton.tooltipShowingID);
            this._menuButton.tooltipShowingID = null;
            this._menuButton.tooltipShowing = false;
        }
        if (this.sourceActor.tooltip) {
            this.sourceActor.tooltip.hide();
            this._menuButton.tooltipShowing = false;
        }

        super.open(animate);
        this.sourceActor.add_style_pseudo_class('active');
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
