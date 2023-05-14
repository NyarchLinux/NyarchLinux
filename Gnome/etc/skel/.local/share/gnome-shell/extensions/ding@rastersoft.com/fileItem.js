/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 * SwitcherooControl code based on code original from Marsch84
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const DesktopIconsUtil = imports.desktopIconsUtil;
const desktopIconItem = imports.desktopIconItem;
const ShowErrorPopup = imports.showErrorPopup;

const Prefs = imports.preferences;
const Enums = imports.enums;
const DBusUtils = imports.dbusUtils;

const Signals = imports.signals;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var FileItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, file, fileInfo, fileExtra, custom) {
        super(desktopManager, fileExtra);
        this._fileInfo = fileInfo;
        this._custom = custom;
        this._isSpecial = this._fileExtra != Enums.FileType.NONE;
        this._file = file;
        this.isStackTop = false;
        this.stackUnique = false;
        this._realizeId = 0;

        this._savedCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-icon-position');
        this._dropCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-drop-position');

        this._createIconActor();
        this._setFileName(this._getVisibleName());

        /* Set the metadata and update relevant UI */
        this._updateMetadataFromFileInfo(fileInfo);

        this._updateIcon().catch(e => {
            print(`Exception while updating an icon: ${e.message}\n${e.stack}`);
        });

        if (this._attributeCanExecute && !this._isValidDesktopFile) {
            this._execLine = this.file.get_path();
        } else {
            this._execLine = null;
        }
        if (fileExtra == Enums.FileType.USER_DIRECTORY_TRASH) {
            // if this icon is the trash, monitor the state of the directory to update the icon
            this._trashChanged = false;
            this._queryTrashInfoCancellable = null;
            this._scheduleTrashRefreshId = 0;
            this._monitorTrashDir = this._file.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._monitorTrashId = this._monitorTrashDir.connect('changed', (obj, file, otherFile, eventType) => {
                switch (eventType) {
                case Gio.FileMonitorEvent.DELETED:
                case Gio.FileMonitorEvent.MOVED_OUT:
                case Gio.FileMonitorEvent.CREATED:
                case Gio.FileMonitorEvent.MOVED_IN:
                    if (this._queryTrashInfoCancellable || this._scheduleTrashRefreshId) {
                        if (this._scheduleTrashRefreshId) {
                            GLib.source_remove(this._scheduleTrashRefreshId);
                        }
                        if (this._queryTrashInfoCancellable) {
                            this._queryTrashInfoCancellable.cancel();
                            this._queryTrashInfoCancellable = null;
                        }
                        this._scheduleTrashRefreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                            this._refreshTrashIcon();
                            this._scheduleTrashRefreshId = 0;
                            return GLib.SOURCE_REMOVE;
                        });
                    } else {
                        this._refreshTrashIcon();
                        // after a refresh, don't allow more refreshes until 200ms after, to coalesce extra events
                        this._scheduleTrashRefreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                            this._scheduleTrashRefreshId = 0;
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                    break;
                }
            });
        } else {
            this._monitorTrashId = 0;
        }
        this._updateName();
        if (this._dropCoordinates) {
            this.setSelected();
        }
    }

    setRenamePopup(renameWindow) {
        if (this._realizeId) {
            this.container.disconnect(this._realizeId);
        }
        this._realizeId = this.container.connect_after('realize', () => {
            renameWindow.updateFileItem(this);
            this.container.disconnect(this._realizeId);
            this._realizeId = 0;
        });
    }

    /** *********************
     * Destroyers *
     ***********************/

    _destroy() {
        /* Trash */
        if (this._monitorTrashId) {
            this._monitorTrashDir.disconnect(this._monitorTrashId);
            this._monitorTrashDir.cancel();
            this._monitorTrashId = 0;
        }
        if (this._queryTrashInfoCancellable) {
            this._queryTrashInfoCancellable.cancel();
        }
        if (this._scheduleTrashRefreshId) {
            GLib.source_remove(this._scheduleTrashRefreshId);
            this._scheduleTrashRefreshId = 0;
        }
        /* Metadata */
        if (this._setMetadataTrustedCancellable) {
            this._setMetadataTrustedCancellable.cancel();
        }
        if (this._realizeId && this.container) {
            this.container.disconnect(this._realizeId);
            this._realizeId = 0;
        }
        // call super() after disconnecting everything, because it destroys
        // the top widget, and that will destroy also all the other widgets.
        super._destroy();
    }

    /** *********************
     * Creators *
     ***********************/

    _getVisibleName(useAttributes) {
        if (this._fileExtra == Enums.FileType.EXTERNAL_DRIVE) {
            return this._custom.get_name();
        } else {
            return this._fileInfo.get_display_name();
        }
    }

    _setFileName(text) {
        if (this._fileExtra == Enums.FileType.USER_DIRECTORY_HOME) {
            // TRANSLATORS: "Home" is the text that will be shown in the user's personal folder
            text = _('Home');
        }
        this._setLabelName(text);
    }

    _readCoordinatesFromAttribute(fileInfo, attribute) {
        let savedCoordinates = fileInfo.get_attribute_as_string(attribute);
        if ((savedCoordinates != null) && (savedCoordinates != '')) {
            savedCoordinates = savedCoordinates.split(',');
            if (savedCoordinates.length >= 2) {
                if (!isNaN(savedCoordinates[0]) && !isNaN(savedCoordinates[1])) {
                    return [Number(savedCoordinates[0]), Number(savedCoordinates[1])];
                }
            }
        }
        return null;
    }

    _doLabelSizeAllocated() {
        super._doLabelSizeAllocated();
        this._checkForRename();
    }

    _checkForRename() {
        if (this._desktopManager.newFolderDoRename) {
            if (this._desktopManager.newFolderDoRename == this.fileName) {
                this._desktopManager.doRename(this, true);
            }
        }
    }

    _refreshMetadataAsync(rebuild) {
        if (this._destroyed) {
            return;
        }

        if (this._queryFileInfoCancellable) {
            this._queryFileInfoCancellable.cancel();
        }
        this._queryFileInfoCancellable = new Gio.Cancellable();
        this._file.query_info_async(Enums.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            this._queryFileInfoCancellable,
            (source, result) => {
                try {
                    this._queryFileInfoCancellable = null;
                    let newFileInfo = source.query_info_finish(result);
                    this._updateMetadataFromFileInfo(newFileInfo);
                    newFileInfo = undefined;
                    if (rebuild) {
                        this._updateIcon().catch(e => {
                            print(`Exception while updating the icon after a metadata update: ${e.message}\n${e.stack}`);
                        });
                    }
                    this._updateName();
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        print(`Error getting the file info: ${error}`);
                    }
                }
            }
        );
    }

    _updateMetadataFromFileInfo(fileInfo) {
        this._fileInfo = fileInfo;

        let oldLabelText = this._currentFileName;

        this._displayName = this._getVisibleName();
        this._attributeCanExecute = fileInfo.get_attribute_boolean('access::can-execute');
        this._unixmode = fileInfo.get_attribute_uint32('unix::mode');
        this._writableByOthers = (this._unixmode & Enums.S_IWOTH) != 0;
        this._trusted = fileInfo.get_attribute_as_string('metadata::trusted') == 'true';
        this._attributeContentType = fileInfo.get_content_type();
        this._isDesktopFile = this._attributeContentType == 'application/x-desktop';

        if (this._isDesktopFile && this._writableByOthers) {
            log(`desktop-icons: File ${this._displayName} is writable by others - will not allow launching`);
        }

        if (this._isDesktopFile) {
            try {
                this._desktopFile = Gio.DesktopAppInfo.new_from_filename(this._file.get_path());
                if (!this._desktopFile) {
                    log(`Couldn’t parse ${this._displayName} as a desktop file, will treat it as a regular file.`);
                    this._isValidDesktopFile = false;
                } else {
                    this._isValidDesktopFile = true;
                }
            } catch (e) {
                print(`Error reading Desktop file ${this.uri}: ${e}`);
            }
        } else {
            this._isValidDesktopFile = false;
        }

        if (this.displayName != oldLabelText) {
            this._setFileName(this.displayName);
        }

        this._fileType = fileInfo.get_file_type();
        this._isDirectory = this._fileType == Gio.FileType.DIRECTORY;
        this._isSpecial = this._fileExtra != Enums.FileType.NONE;
        this._isHidden = fileInfo.get_is_hidden() | fileInfo.get_is_backup();
        this._isSymlink = fileInfo.get_is_symlink();
        this._modifiedTime = fileInfo.get_attribute_uint64('time::modified');
        /*
         * This is a glib trick to detect broken symlinks. If a file is a symlink, the filetype
         * points to the final file, unless it is broken; thus if the file type is SYMBOLIC_LINK,
         * it must be a broken link.
         * https://developer.gnome.org/gio/stable/GFile.html#g-file-query-info
         */
        this._isBrokenSymlink = this._isSymlink && this._fileType == Gio.FileType.SYMBOLIC_LINK;
    }

    _doOpenContext(context, fileList) {
        if (!fileList) {
            fileList = [];
        }
        if (this._isBrokenSymlink) {
            log(`Error: Can’t open ${this.file.get_uri()} because it is a broken symlink.`);
            let title = _('Broken Link');
            let error = _('Can not open this File because it is a Broken Symlink');
            this._showerrorpopup(title, error);
            return;
        }

        if (this._isDesktopFile) {
            this._launchDesktopFile(context, fileList);
            return;
        }

        if (this._isDirectory && this._desktopManager.useNemo) {
            try {
                DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', this.file.get_uri()], DesktopIconsUtil.getFilteredEnviron());
                return;
            } catch (err) {
                log(`Error trying to launch Nemo: ${err.message}\n${err}`);
            }
        }

        if (!DBusUtils.GnomeArchiveManager.isAvailable &&
            this._fileType === Gio.FileType.REGULAR &&
            this._desktopManager.autoAr.fileIsCompressed(this.fileName)) {
            this._desktopManager.autoAr.extractFile(this.fileName);
            return;
        }
        Gio.AppInfo.launch_default_for_uri_async(this.file.get_uri(),
            null, null,
            (source, result) => {
                try {
                    Gio.AppInfo.launch_default_for_uri_finish(result);
                } catch (e) {
                    log(`Error opening file ${this.file.get_uri()}: ${e.message}`);
                }
            }
        );
    }

    _showerrorpopup(title, error) {
        new ShowErrorPopup.ShowErrorPopup(
            title,
            error,
            true
        );
    }

    _launchDesktopFile(context, fileList) {
        if (this.trustedDesktopFile) {
            this._desktopFile.launch_uris_as_manager(fileList, context, GLib.SpawnFlags.SEARCH_PATH, null, null);
            return;
        }

        let error;

        if (!this._isValidDesktopFile) {
            let title = _('Broken Desktop File');
            let error = _('This .desktop file has errors or points to a program without permissions. It can not be executed.\n\n\t<b>Edit the file to set the correct executable Program.</b>');
            this._showerrorpopup(title, error);
            return;
        }

        if (this._writableByOthers || !this._attributeCanExecute) {
            let title = _('Invalid Permissions on Desktop File');
            let error = _('This .desktop File has incorrect Permissions. Right Click to edit Properties, then:\n');
            if (this._writableByOthers) {
                error += _('\n<b>Set Permissions, in "Others Access", "Read Only" or "None"</b>');
            }
            if (!this._attributeCanExecute) {
                error += _('\n<b>Enable option, "Allow Executing File as a Program"</b>');
            }
            this._showerrorpopup(title, error);
            return;
        }

        if (!this.trustedDesktopFile) {
            let title = 'Untrusted Desktop File';
            let error = _('This .desktop file is not trusted, it can not be launched. To enable launching, right-click, then:\n\n<b>Enable "Allow Launching"</b>');
            this._showerrorpopup(title, error);
        }
    }

    _updateName() {
        if (this._isValidDesktopFile && !this._desktopManager.writableByOthers && !this._writableByOthers && this.trustedDesktopFile) {
            this._setFileName(this._desktopFile.get_locale_string('Name'));
        } else {
            this._setFileName(this._getVisibleName());
        }
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _doButtonOnePressed(event, shiftPressed, controlPressed) {
        super._doButtonOnePressed(event, shiftPressed, controlPressed);
        if (this.getClickCount() == 2 && !Prefs.CLICK_POLICY_SINGLE) {
            this.doOpen();
        }
    }

    _doButtonOneReleased(event) {
        // primaryButtonPressed is TRUE only if the user has pressed the button
        // over an icon, and if (s)he has not started a drag&drop operation
        if (this._primaryButtonPressed) {
            this._primaryButtonPressed = false;
            let shiftPressed = !!(event.get_state()[1] & Gdk.ModifierType.SHIFT_MASK);
            let controlPressed = !!(event.get_state()[1] & Gdk.ModifierType.CONTROL_MASK);
            if (!shiftPressed && !controlPressed) {
                this._desktopManager.selected(this, Enums.Selection.RELEASE);
                if (Prefs.CLICK_POLICY_SINGLE) {
                    this.doOpen();
                }
            }
        }
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    _setDropDestination(dropDestination) {
        dropDestination.drag_dest_set(Gtk.DestDefaults.MOTION | Gtk.DestDefaults.DROP, null,
            Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.DEFAULT);
        if ((this._fileExtra == Enums.FileType.USER_DIRECTORY_TRASH) ||
            (this._fileExtra == Enums.FileType.USER_DIRECTORY_HOME) ||
            (this._fileExtra != Enums.FileType.EXTERNAL_DRIVE) ||
            this._isDirectory) {
            let targets = new Gtk.TargetList(null);
            targets.add(Gdk.atom_intern('x-special/gnome-icon-list', false), 0, 1);
            targets.add(Gdk.atom_intern('text/uri-list', false), 0, 2);
            dropDestination.drag_dest_set_target_list(targets);
            targets = undefined;
            this._connectSignal(dropDestination, 'drag-data-received', (widget, context, x, y, selection, info, time) => {
                const forceCopy = context.get_selected_action() === Gdk.DragAction.COPY;
                if (info === Enums.DndTargetInfo.GNOME_ICON_LIST ||
                        info === Enums.DndTargetInfo.URI_LIST) {
                    let fileList = DesktopIconsUtil.getFilesFromNautilusDnD(selection, info);
                    if (fileList.length != 0) {
                        if (this._hasToRouteDragToGrid()) {
                            this._grid.receiveDrop(context, this._x1 + x, this._y1 + y, selection, info, true, forceCopy);
                            return;
                        }
                        if (this._desktopManager.dragItem && ((this._desktopManager.dragItem.uri == this._file.get_uri()) || !(this._isValidDesktopFile || this.isDirectory))) {
                            // Dragging a file/folder over itself or over another file will do nothing, allow drag to directory or validdesktop file
                            Gtk.drag_finish(context, false, false, time);
                            return;
                        }
                        if (this._isValidDesktopFile) {
                            // open the desktopfile with these dropped files as the arguments
                            this.doOpen(fileList);
                            Gtk.drag_finish(context, true, false, time);
                            return;
                        }
                        if (this._fileExtra != Enums.FileType.USER_DIRECTORY_TRASH) {
                            let data = Gio.File.new_for_uri(fileList[0]).query_info('id::filesystem', Gio.FileQueryInfoFlags.NONE, null);
                            let idFS = data.get_attribute_string('id::filesystem');
                            if ((this._desktopManager.desktopFsId == idFS) && !forceCopy) {
                                DBusUtils.RemoteFileOperations.MoveURIsRemote(fileList, this._file.get_uri());
                                Gtk.drag_finish(context, true, true, time);
                            } else {
                                DBusUtils.RemoteFileOperations.CopyURIsRemote(fileList, this._file.get_uri());
                                Gtk.drag_finish(context, true, false, time);
                            }
                        } else {
                            DBusUtils.RemoteFileOperations.TrashURIsRemote(fileList);
                            Gtk.drag_finish(context, true, true, time);
                        }
                    }
                } else {
                    Gtk.drag_finish(context, false, false, time);
                }
            });
        }
    }

    _hasToRouteDragToGrid() {
        return this._isSelected && (this._desktopManager.dragItem !== null) && (this._desktopManager.dragItem.uri !== this._file.get_uri());
    }

    /** *********************
     * Icon Rendering *
     ***********************/

    _refreshTrashIcon() {
        if (this._queryTrashInfoCancellable) {
            this._queryTrashInfoCancellable.cancel();
            this._queryTrashInfoCancellable = null;
        }
        if (!this._file.query_exists(null)) {
            return false;
        }
        this._queryTrashInfoCancellable = new Gio.Cancellable();

        this._file.query_info_async(Enums.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            this._queryTrashInfoCancellable,
            (source, result) => {
                try {
                    this._queryTrashInfoCancellable = null;
                    this._fileInfo = source.query_info_finish(result);
                    this._updateIcon().catch(e => {
                        print(`Exception while updating the trash icon: ${e.message}\n${e.stack}`);
                    });
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        print(`Error getting the number of files in the trash: ${error.message}\n${error.stack}`);
                    }
                }
            });
        return false;
    }


    /** *********************
     * Class Methods *
     ***********************/

    onAttributeChanged() {
        if (this._destroyed) {
            return;
        }
        if (this._isDesktopFile) {
            this._refreshMetadataAsync(true);
        }
    }

    updatedMetadata() {
        this._refreshMetadataAsync(true);
    }

    onFileRenamed(file) {
        this._file = file;
        this._refreshMetadataAsync(false);
    }

    eject() {
        if (this._custom) {
            this._custom.eject_with_operation(Gio.MountUnmountFlags.NONE, null, null, (obj, res) => {
                obj.eject_with_operation_finish(res);
            });
        }
    }

    unmount() {
        if (this._custom) {
            this._custom.unmount_with_operation(Gio.MountUnmountFlags.NONE, null, null, (obj, res) => {
                obj.unmount_with_operation_finish(res);
            });
        }
    }

    doOpen(fileList) {
        if (!fileList) {
            fileList = [];
        }
        this._doOpenContext(null, fileList);
    }

    onAllowDisallowLaunchingClicked() {
        this.metadataTrusted = !this.trustedDesktopFile;

        /*
         * we're marking as trusted, make the file executable too. Note that we
         * do not ever remove the executable bit, since we don't know who set
         * it.
         */
        if (this.metadataTrusted && !this._attributeCanExecute) {
            let info = new Gio.FileInfo();
            let newUnixMode = this._unixmode | Enums.S_IXUSR;
            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, newUnixMode);
            this._file.set_attributes_async(info,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_LOW,
                null,
                (source, result) => {
                    try {
                        source.set_attributes_finish(result);
                    } catch (error) {
                        log(`Failed to set execution flag: ${error.message}`);
                    }
                });
        }
        this._updateName();
    }

    doDiscreteGpu() {
        if (!DBusUtils.discreteGpuAvailable) {
            log('Could not apply discrete GPU environment, switcheroo-control not available');
            return;
        }
        let gpus = DBusUtils.SwitcherooControl.proxy.GPUs;
        if (!gpus) {
            log('Could not apply discrete GPU environment. No GPUs in list.');
            return;
        }

        for (let gpu in gpus) {
            if (!gpus[gpu]) {
                continue;
            }

            let default_variant = gpus[gpu]['Default'];
            if (!default_variant || default_variant.get_boolean()) {
                continue;
            }

            let env = gpus[gpu]['Environment'];
            if (!env) {
                continue;
            }

            let envS = env.get_strv();
            let context = new Gio.AppLaunchContext();
            for (let i = 0; i < envS.length; i += 2) {
                context.setenv(envS[i], envS[i + 1]);
            }
            this._doOpenContext(context, null);
            return;
        }
        log('Could not find discrete GPU data in switcheroo-control');
    }

    _onOpenTerminalClicked() {
        DesktopIconsUtil.launchTerminal(this.file.get_path(), null);
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get attributeContentType() {
        return this._attributeContentType;
    }

    get attributeCanExecute() {
        return this._attributeCanExecute;
    }

    get canEject() {
        if (this._custom) {
            return this._custom.can_eject();
        } else {
            return false;
        }
    }

    get canRename() {
        return !this.trustedDesktopFile && (this._fileExtra == Enums.FileType.NONE);
    }

    get canUnmount() {
        if (this._custom) {
            return this._custom.can_unmount();
        } else {
            return false;
        }
    }

    get displayName() {
        if (this.trustedDesktopFile) {
            return this._desktopFile.get_name();
        }
        return this._displayName || null;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    set dropCoordinates(pos) {
        try {
            let info = new Gio.FileInfo();
            if (pos != null) {
                this._dropCoordinates = [pos[0], pos[1]];
                info.set_attribute_string('metadata::nautilus-drop-position', `${pos[0]},${pos[1]}`);
            } else {
                this._dropCoordinates = null;
                info.set_attribute_string('metadata::nautilus-drop-position', '');
            }
            this.file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            print(`Failed to store the desktop coordinates for ${this.uri}: ${e}`);
        }
    }

    get execLine() {
        return this._execLine;
    }

    get file() {
        return this._file;
    }

    get fileName() {
        return this._fileInfo.get_name();
    }

    get fileSize() {
        return this._fileInfo.get_size();
    }

    get isAllSelectable() {
        return this._fileExtra == Enums.FileType.NONE;
    }

    get isDirectory() {
        return this._isDirectory;
    }

    get isHidden() {
        return this._isHidden;
    }

    get isTrash() {
        return this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH;
    }

    get metadataTrusted() {
        return this._trusted;
    }

    set metadataTrusted(value) {
        this._trusted = value;

        if (this._setMetadataTrustedCancellable) {
            this._setMetadataTrustedCancellable.cancel();
        }
        this._setMetadataTrustedCancellable = new Gio.Cancellable();
        let info = new Gio.FileInfo();
        info.set_attribute_string('metadata::trusted',
            value ? 'true' : 'false');
        this._file.set_attributes_async(info,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW,
            this._setMetadataTrustedCancellable,
            (source, result) => {
                try {
                    this._setMetadataTrustedCancellable = null;
                    source.set_attributes_finish(result);
                    this._refreshMetadataAsync(true);
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        log(`Failed to set metadata::trusted: ${error.message}`);
                    }
                }
            });
    }

    get modifiedTime() {
        return this._modifiedTime;
    }

    get path() {
        return this._file.get_path();
    }

    get savedCoordinates() {
        return this._savedCoordinates;
    }

    set savedCoordinates(pos) {
        try {
            let info = new Gio.FileInfo();
            if (pos != null) {
                this._savedCoordinates = [pos[0], pos[1]];
                info.set_attribute_string('metadata::nautilus-icon-position', `${pos[0]},${pos[1]}`);
            } else {
                this._savedCoordinates = null;
                info.set_attribute_string('metadata::nautilus-icon-position', '');
            }
            this.file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            print(`Failed to store the desktop coordinates for ${this.uri}: ${e}`);
        }
    }

    get trustedDesktopFile() {
        return this._isValidDesktopFile &&
               this._attributeCanExecute &&
               this.metadataTrusted &&
               !this._desktopManager.writableByOthers &&
               !this._writableByOthers;
    }

    get uri() {
        return this._file.get_uri();
    }

    get isValidDesktopFile() {
        return this._isValidDesktopFile;
    }

    get writableByOthers() {
        return this._writableByOthers;
    }

    get isStackMarker() {
        if (this.isStackTop && !this.stackUnique) {
            return true;
        } else {
            return false;
        }
    }
};
Signals.addSignalMethods(FileItem.prototype);
