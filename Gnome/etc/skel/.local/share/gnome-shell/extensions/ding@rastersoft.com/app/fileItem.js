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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as desktopIconItem from './desktopIconItem.js';
import * as ShowErrorPopup from './showErrorPopup.js';

import * as Prefs from './preferences.js';
import * as Enums from './enums.js';
import * as DBusUtils from './dbusUtils.js';
import * as dndClipboardUtils from './dndClipboardUtils.js';

const Signals = imports.signals;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var FileItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, file, fileInfo, fileExtra, custom) {
        super(desktopManager, fileExtra);
        this._fileInfo = fileInfo;
        this._custom = custom;
        this._isSpecial = this._fileExtra !== Enums.FileType.NONE;
        this._file = file;
        this.isStackTop = false;
        this.stackUnique = false;
        this._realizeId = 0;

        this._savedCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-icon-position');
        this._dropCoordinates = this._readCoordinatesFromAttribute(fileInfo, 'metadata::nautilus-drop-position');

        this._createIconActor(Gtk.AccessibleRole.LABEL);

        /* Set the metadata and update relevant UI */
        this._updateMetadataFromFileInfo(fileInfo);
        this._setFileName(this._getVisibleName());

        this._updateIcon().catch(e => {
            print(`Exception while updating an icon: ${e.message}\n${e.stack}`);
        });

        if (this._attributeCanExecute && !this._isValidDesktopFile)
            this._execLine = this.file.get_path();
        else
            this._execLine = null;

        if (fileExtra === Enums.FileType.USER_DIRECTORY_TRASH) {
            // if this icon is the trash, monitor the state of the directory to update the icon
            this._trashChanged = false;
            this._queryTrashInfoCancellable = null;
            this._scheduleTrashRefreshId = 0;
            this._monitorTrashDir = this._file.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this.connectSignal(this._monitorTrashDir, 'changed', (obj, monitorFile, otherFile, eventType) => {
                switch (eventType) {
                case Gio.FileMonitorEvent.DELETED:
                case Gio.FileMonitorEvent.MOVED_OUT:
                case Gio.FileMonitorEvent.CREATED:
                case Gio.FileMonitorEvent.MOVED_IN:
                    if (this._queryTrashInfoCancellable || this._scheduleTrashRefreshId) {
                        if (this._scheduleTrashRefreshId)
                            GLib.source_remove(this._scheduleTrashRefreshId);

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
            }, {
                destroyCb: () => {
                    this._monitorTrashDir.cancel();
                },
            });
        } else {
            this._monitorTrashId = 0;
        }
        this._updateName();
        if (this._dropCoordinates)
            this.setSelected();

        if (this._desktopManager.showDropPlace) {
            this._setDropDestination(this.container);
        } else {
            this._setDropDestination(this._icon);
            this._setDropDestination(this._label);
        }
    }

    _getEmblems() {
        let emblem = null;

        if (this._isAppImageFile && !this._useSandboxing)
            emblem = Gio.ThemedIcon.new('dialog-warning');

        if (this._isAppImageFile && !this.trustedAppImageFile)
            emblem = Gio.ThemedIcon.new('emblem-unreadable');

        if (this._isDesktopFile && (!this._isValidDesktopFile || !this.trustedDesktopFile))
            emblem = Gio.ThemedIcon.new('emblem-unreadable');

        if (this._isSymlink && (Prefs.showLinkEmblem || this._isBrokenSymlink)) {
            if (this._isBrokenSymlink)
                emblem = Gio.ThemedIcon.new('emblem-unreadable');
            else
                emblem = Gio.ThemedIcon.new('emblem-symbolic-link');
        }

        if (emblem === null)
            return null;

        return [
            {
                icon: emblem,
                size: 3,
                position: Enums.EmblemPosition.TOP_LEFT,
            },
        ];
    }

    setAccessibleName(filename) {
        if (this._fileExtra === Enums.FileType.USER_DIRECTORY_HOME) {
            /** TRANSLATORS: when using a screen reader, this is the text read when the user's personal folder is
             * highlighted. */
            filename = _('Home');
        }
        if (this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH) {
            /** TRANSLATORS: when using a screen reader, this is the text read when the trash folder is
             * highlighted. */
            filename = _('Trash');
        }
        const specialCases = [
            [
                this._fileExtra === Enums.FileType.EXTERNAL_DRIVE,
                /** TRANSLATORS: when using a screen reader, this is the role used when an external drive is
                 * highlighted. Example: if a USB stick named "my_portable" is highlighted, it will say "my_portable Drive".
                 * It is mandatory to say the file name first and the role after. */
                _('{VisibleName} Drive'),
                /** TRANSLATORS: when using a screen reader, this is the role used when an external drive is
                 * highlighted and selected. Example: if a USB stick named "my_portable" is highlighted and selected, it
                 * will say "my_portable Drive Selected". It is mandatory to say the file name first, then the role, and
                 * finally "Selected". */
                _('{VisibleName} Drive Selected'),
            ], [
                this._isDirectory || (this._fileExtra === Enums.FileType.USER_DIRECTORY_HOME) || (this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH),
                /** TRANSLATORS: when using a screen reader, this is the role used when a folder is
                 * highlighted. Example: if a folder named "things" is highlighted, it will say "things Folder".
                 * It is mandatory to say the file name first and the role after. */
                _('{VisibleName} Folder'),
                /** TRANSLATORS: when using a screen reader, this is the role used when a folder is
                 * highlighted and selected. Example: if a folder named "things" is highlighted and selected, it will say
                 * "things Folder Selected". It is mandatory to say the file name first, then the role, and finally "Selected". */
                _('{VisibleName} Folder Selected'),
            ], [
                this._isDesktopFile && this.trustedDesktopFile,
                /** TRANSLATORS: when using a screen reader, this is the role used when a trusted desktop file is
                 * highlighted. Example: if a desktop file named "My App" is highlighted and it is trusted, it will
                 * say "My App Application". It is mandatory to say the file name first and the role after. */
                _('{VisibleName} Application'),
                /** TRANSLATORS: when using a screen reader, this is the role used when a trusted desktop file is
                 * highlighted. Example: if a desktop file named "My App" is highlighted and selected and it is trusted, it will
                 * say "My App Application Selected". It is mandatory to say the file name first and the role after. */
                _('{VisibleName} Application Selected'),
            ], [
                // The default value
                true,
                /** TRANSLATORS: when using a screen reader, this is the text read when a normal file is
                 * highlighted. Example: if a file named "my_picture.jpg" is highlighted, it will say "my_picture.jpg File" */
                _('{VisibleName} File'),
                /** TRANSLATORS: when using a screen reader, this is the text read when a normal file is highlighted and
                 * selected. Example: if a file named "my_picture.jpg" is highlighted and selected, it will say
                 * "my_picture.jpg File Selected". It is mandatory to say the file name first and the role after. */
                _('{VisibleName} File Selected'),
            ],
        ];

        var name = '';
        for (const c of specialCases) {
            if (c[0]) {
                name = this._isSelected ? c[2] : c[1];
                break;
            }
        }
        /** TRANSLATORS: the "selected" string is for screen readers. It is added at the end of the speaked sentence when the icon
            is selected. */
        const visibleNameAndRole = name.replace('{VisibleName}', filename);
        this._accessibleBox.update_property([Gtk.AccessibleProperty.LABEL, Gtk.AccessibleProperty.DESCRIPTION], [visibleNameAndRole, '']);
    }

    setRenamePopup(renameWindow) {
        if (this._realizeId)
            this.container.disconnect(this._realizeId);

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
        if (this._queryTrashInfoCancellable) {
            this._queryTrashInfoCancellable.cancel();
            this._queryTrashInfoCancellable = null;
        }
        if (this._scheduleTrashRefreshId) {
            GLib.source_remove(this._scheduleTrashRefreshId);
            this._scheduleTrashRefreshId = 0;
        }
        /* Metadata */
        if (this._setMetadataTrustedCancellable) {
            this._setMetadataTrustedCancellable.cancel();
            this._setMetadataTrustedCancellable = null;
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

    _getVisibleName() {
        if (this._fileExtra === Enums.FileType.EXTERNAL_DRIVE)
            return this._custom.get_name();
        else if (this._isValidDesktopFile && !this._desktopManager.writableByOthers && !this._writableByOthers && this.trustedDesktopFile)
            return this._desktopFile.get_locale_string('Name');
        else
            return this._fileInfo.get_display_name();
    }

    _setFileName(text) {
        if (this._fileExtra === Enums.FileType.USER_DIRECTORY_HOME) {
            // TRANSLATORS: "Home" is the text that will be shown in the user's personal folder
            text = _('Home');
        }
        this._setLabelName(text);
        this.setAccessibleName(text);
    }

    _readCoordinatesFromAttribute(fileInfo, attribute) {
        let savedCoordinates = fileInfo.get_attribute_as_string(attribute);
        if ((savedCoordinates !== null) && (savedCoordinates !== '')) {
            savedCoordinates = savedCoordinates.split(',');
            if (savedCoordinates.length >= 2) {
                if (!isNaN(savedCoordinates[0]) && !isNaN(savedCoordinates[1]))
                    return [Number(savedCoordinates[0]), Number(savedCoordinates[1])];
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
            if (this._desktopManager.newFolderDoRename === this.fileName)
                this._desktopManager.doRename(this, true);
        }
    }

    _refreshMetadataAsync(rebuild) {
        if (this._destroyed)
            return;


        if (this._queryFileInfoCancellable)
            this._queryFileInfoCancellable.cancel();

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
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        print(`Error getting the file info: ${error}`);
                }
            }
        );
    }

    _updateMetadataFromFileInfo(fileInfo) {
        this._fileInfo = fileInfo;

        const oldLabelText = this._currentFileName;

        this._displayName = this._getVisibleName();
        this._attributeCanExecute = fileInfo.get_attribute_boolean('access::can-execute');
        this._unixmode = fileInfo.get_attribute_uint32('unix::mode');
        this._writableByOthers = (this._unixmode & Enums.S_IWOTH) !== 0;
        this._trusted = fileInfo.get_attribute_as_string('metadata::trusted') === 'true';
        this._useSandboxing = fileInfo.get_attribute_as_string('metadata::nosandbox') === 'false';
        this._attributeContentType = fileInfo.get_content_type();
        this._isDesktopFile = this._attributeContentType === 'application/x-desktop';
        this._isAppImageFile = this._attributeContentType === 'application/vnd.appimage';

        if (this._isDesktopFile && this._writableByOthers)
            console.log(`desktop-icons: File ${this._displayName} is writable by others - will not allow launching`);


        if (this._isDesktopFile) {
            try {
                this._desktopFile = GioUnix.DesktopAppInfo.new_from_filename(this._file.get_path());
                if (!this._desktopFile) {
                    console.log(`Couldn’t parse ${this._displayName} as a desktop file, will treat it as a regular file.`);
                    this._isValidDesktopFile = false;
                } else {
                    this._isValidDesktopFile = true;
                }
            } catch (e) {
                const title = _('Error while reading Desktop file');
                const error = `${this.uri}: ${e}`;
                this._logAndPopupError(title, error, `${title}: ${error}`);
            }
        } else {
            this._isValidDesktopFile = false;
        }

        if (this.displayName !== oldLabelText)
            this._setFileName(this.displayName);


        this._fileType = fileInfo.get_file_type();
        this._isDirectory = this._fileType === Gio.FileType.DIRECTORY;
        this._isSpecial = this._fileExtra !== Enums.FileType.NONE;
        if (this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH) {
            this._isHidden = false;
            this._isSymlink = false;
        } else {
            this._isHidden = fileInfo.get_is_hidden() | fileInfo.get_is_backup();
            this._isSymlink = fileInfo.get_is_symlink();
        }
        this._modifiedTime = fileInfo.get_attribute_uint64('time::modified');
        /*
         * This is a glib trick to detect broken symlinks. If a file is a symlink, the filetype
         * points to the final file, unless it is broken; thus if the file type is SYMBOLIC_LINK,
         * it must be a broken link.
         * https://developer.gnome.org/gio/stable/GFile.html#g-file-query-info
         */
        this._isBrokenSymlink = this._isSymlink && this._fileType === Gio.FileType.SYMBOLIC_LINK;
        this._acceptsDrop = (this._fileExtra === Enums.FileType.USER_DIRECTORY_TRASH) ||
                            (this._fileExtra === Enums.FileType.USER_DIRECTORY_HOME) ||
                            (this._fileExtra === Enums.FileType.EXTERNAL_DRIVE) ||
                            this._isDirectory ||
                            this.trustedDesktopFile;
    }

    _logAndPopupError(title, error, logError) {
        log(`Error: ${logError}`);
        this._showerrorpopup(title, error);
    }

    _getDefaultLaunchContext(timestamp) {
        const launchContext = Gdk.Display.get_default().get_app_launch_context();
        if (timestamp)
            launchContext.set_timestamp(timestamp);
        else
            launchContext.set_timestamp(Gdk.CURRENT_TIME);

        return launchContext;
    }

    _doOpenContext(context, fileList) {
        if (!fileList)
            fileList = [];

        if (this._isBrokenSymlink) {
            const title = _('Broken Link');
            const error = _('Can not open this File because it is a Broken Symlink');
            const logError = `Error: Can’t open ${this.file.get_uri()} because it is a broken symlink.`;
            this._logAndPopupError(title, error, logError);
            return;
        }

        if (this._isDesktopFile) {
            this._launchDesktopFile(context, fileList);
            return;
        }

        if (this._isAppImageFile)
            this._launchAppImageFile(context, fileList);


        if (this._isDirectory && this._desktopManager.useNemo) {
            try {
                DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', this.file.get_uri()], DesktopIconsUtil.getFilteredEnviron());
                return;
            } catch (err) {
                console.log(`Couldn't launch Nemo: ${err.message}\n${err}`);
            }
        }

        if (!DBusUtils.GnomeArchiveManager.isAvailable &&
            this._fileType === Gio.FileType.REGULAR &&
            this._desktopManager.autoAr.fileIsCompressed(this.fileName)) {
            this._desktopManager.autoAr.extractFile(this.fileName);
            return;
        }
        Gio.AppInfo.launch_default_for_uri_async(this.file.get_uri(),
            context, null,
            (source, result) => {
                try {
                    Gio.AppInfo.launch_default_for_uri_finish(result);
                } catch (e) {
                    const title = _("Can't open the file");
                    const error = `${e.message}`;
                    const logError = `while opening file ${this.file.get_uri()}: ${e.message}`;
                    this._logAndPopupError(title, error, logError);
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

    _launchAppImageFile(_context, _fileList) {
        if (this.trustedAppImageFile) {
            let commandLine = `"${this._execLine}"`;
            if (!this._useSandboxing)
                commandLine += ' --no-sandbox';
            console.log(`Launching ${commandLine}`);
            DesktopIconsUtil.spawnCommandLine(commandLine);
            return;
        }

        if (this._writableByOthers || !this._attributeCanExecute) {
            const title = _('Invalid Permissions on AppImage File');
            let error = _('This .appimage File has incorrect Permissions. Right Click to edit Properties, then:\n');
            if (this._writableByOthers)
                error += _('\n<b>Set Permissions, in "Others Access", "Read Only" or "None"</b>');

            if (!this._attributeCanExecute)
                error += _('\n<b>Enable option, "Allow Executing File as a Program"</b>');

            this._showerrorpopup(title, error);
            return;
        }

        if (!this.trustedAppImageFile) {
            const title = 'Untrusted AppImage File';
            const error = _('This .appimage file is not trusted, it can not be launched. To enable launching, right-click, then:\n\n<b>Enable "Allow Launching"</b>');
            this._showerrorpopup(title, error);
        }
    }

    _launchDesktopFile(context, fileList) {
        if (this.trustedDesktopFile) {
            this._desktopFile.launch_uris_as_manager(fileList, context, GLib.SpawnFlags.SEARCH_PATH, null, null);
            return;
        }

        if (!this._isValidDesktopFile) {
            const title = _('Broken Desktop File');
            const error = _('This .desktop file has errors or points to a program without permissions. It can not be executed.\n\n\t<b>Edit the file to set the correct executable Program.</b>');
            this._showerrorpopup(title, error);
            return;
        }

        if (this._writableByOthers || !this._attributeCanExecute) {
            const title = _('Invalid Permissions on Desktop File');
            let error = _('This .desktop File has incorrect Permissions. Right Click to edit Properties, then:\n');
            if (this._writableByOthers)
                error += _('\n<b>Set Permissions, in "Others Access", "Read Only" or "None"</b>');

            if (!this._attributeCanExecute)
                error += _('\n<b>Enable option, "Allow Executing File as a Program"</b>');

            this._showerrorpopup(title, error);
            return;
        }

        if (!this.trustedDesktopFile) {
            const title = 'Untrusted Desktop File';
            const error = _('This .desktop file is not trusted, it can not be launched. To enable launching, right-click, then:\n\n<b>Enable "Allow Launching"</b>');
            this._showerrorpopup(title, error);
        }
    }

    _updateName() {
        this._setFileName(this._getVisibleName());
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _doButtonOnePressed(controller, nPress, x, y) {
        super._doButtonOnePressed(controller, nPress, x, y);
        if (nPress === 2 && !Prefs.CLICK_POLICY_SINGLE)
            this.doOpen(controller.get_current_event_time());
    }

    _doButtonOneReleased(controller, nPress, x, y, state) {
        super._doButtonOneReleased(controller, nPress, x, y);
        // primaryButtonPressed is TRUE only if the user has pressed the button
        // over an icon, and if (s)he has not started a drag&drop operation
        if (!state.shift && !state.control) {
            this._desktopManager.selected(this, Enums.Selection.RELEASE);
            if (Prefs.CLICK_POLICY_SINGLE)
                this.doOpen(controller.get_current_event_time());
        }
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    _setDropDestination(dropDestination) {
        if ((this._fileExtra !== Enums.FileType.USER_DIRECTORY_TRASH) &&
            (this._fileExtra !== Enums.FileType.USER_DIRECTORY_HOME) &&
            (this._fileExtra !== Enums.FileType.EXTERNAL_DRIVE) &&
            !this._isDirectory &&
            !this.trustedDesktopFile)
            return;

        const dropTarget = new Gtk.DropTargetAsync();
        const validFormats = Gdk.ContentFormats.new(Enums.MIME_TYPES);
        dropTarget.set_actions(Gdk.DragAction.MOVE | Gdk.DragAction.COPY | Gdk.DragAction.ASK);

        this.connectSignal(dropTarget, 'drag-enter', (widget, drop) => {
            drop.status(Gdk.DragAction.COPY | Gdk.DragAction.MOVE | Gdk.DragAction.LINK,
                Gdk.DragAction.MOVE);
            return Gdk.DragAction.MOVE;
        });

        this.connectSignal(dropTarget, 'drag-motion', (widget, drop, x, y) => {
            this.highLightDropTarget(x, y);
            return Gdk.DragAction.MOVE;
        });

        this.connectSignal(dropTarget, 'drag-leave', () => {
            this.unHighLightDropTarget();
        });

        this.connectSignal(dropTarget, 'drop', async (widget, drop, x, y) => {
            const dropInfo = await dndClipboardUtils.manageIconDrop(this, drop, x, y);
            if (dropInfo === null)
                return false;


            if (this.trustedDesktopFile) {
                this.doOpen(null, dropInfo.filelist);
                return true;
            }

            try {
                if (dropInfo.action === Gdk.DragAction.MOVE)
                    DBusUtils.RemoteFileOperations.MoveURIsRemote(dropInfo.filelist, this.uri);
                else
                    DBusUtils.RemoteFileOperations.CopyURIsRemote(dropInfo.filelist, this.uri);
            } catch (e) {
                print(`Error: ${e}\n`);
            }
            return true;
        });

        this.connectSignal(dropTarget, 'accept', (widget, drop) => {
            print(`Asking to drop formats: ${drop.get_formats().get_mime_types()}`);
            return drop.get_formats().match(validFormats);
        });

        dropDestination.add_controller(dropTarget);
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
        if (!this._file.query_exists(null))
            return false;

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
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        print(`Error getting the number of files in the trash: ${error.message}\n${error.stack}`);
                }
            });
        return false;
    }


    /** *********************
     * Class Methods *
     ***********************/

    onAttributeChanged() {
        if (this._destroyed)
            return;

        if (this._isDesktopFile)
            this._refreshMetadataAsync(true);
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

    doOpen(timestamp, fileList) {
        if (!fileList)
            fileList = [];

        this._doOpenContext(this._getDefaultLaunchContext(timestamp), fileList);
    }

    onAllowDisallowLaunchingClicked() {
        this.metadataTrusted = (this._isDesktopFile && !this.trustedDesktopFile) || (this._isAppImageFile && !this.trustedAppImageFile);

        /*
         * we're marking as trusted, make the file executable too. Note that we
         * do not ever remove the executable bit, since we don't know who set
         * it.
         */
        if (this.metadataTrusted && !this._attributeCanExecute) {
            const info = new Gio.FileInfo();
            const newUnixMode = this._unixmode | Enums.S_IXUSR;
            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, newUnixMode);
            this._file.set_attributes_async(info,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_LOW,
                null,
                (source, result) => {
                    try {
                        source.set_attributes_finish(result);
                    } catch (error) {
                        const title = _('Failed to set execution flag');
                        const err = error.message;
                        const logError = `${title}: ${err}`;
                        this._logAndPopupError(title, err, logError);
                    }
                });
        }
        this._updateName();
    }

    onToggleSandboxingClicked() {
        this.metadataUseSandboxing = !(this._isAppImageFile && this._useSandboxing);
        this._updateIcon().catch(e => {
            print(`Exception while updating the trash icon: ${e.message}\n${e.stack}`);
        });
    }

    doDiscreteGpu(timestamp) {
        if (!DBusUtils.discreteGpuAvailable) {
            const title = _('Could not apply discrete GPU environment');
            const error = 'switcheroo-control not available';
            this._logAndPopupError(title, error, `${title}: ${error}`);
            return;
        }
        const gpus = DBusUtils.SwitcherooControl.proxy.GPUs;
        if (!gpus) {
            const title = _('Could not apply discrete GPU environment');
            const error = 'No GPUs in list.';
            this._logAndPopupError(title, error, `${title}: ${error}`);
            return;
        }

        for (const gpu in gpus) {
            if (!gpus[gpu])
                continue;


            const defaultVariant = gpus[gpu]['Default'];
            if (!defaultVariant || defaultVariant.get_boolean())
                continue;


            const env = gpus[gpu]['Environment'];
            if (!env)
                continue;


            const envS = env.get_strv();
            const context = this._getDefaultLaunchContext(timestamp);
            for (let i = 0; i < envS.length; i += 2)
                context.setenv(envS[i], envS[i + 1]);

            this._doOpenContext(context, null);
            return;
        }
        const title = _('Could not find discrete GPU data');
        const error = 'Could not find discrete GPU data in switcheroo-control';
        this._logAndPopupError(title, error, error);
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
        if (this._custom)
            return this._custom.can_eject();
        else
            return false;
    }

    get canRename() {
        return !this.trustedDesktopFile && (this._fileExtra === Enums.FileType.NONE);
    }

    get canUnmount() {
        if (this._custom)
            return this._custom.can_unmount();
        else
            return false;
    }

    get displayName() {
        if (this.trustedDesktopFile)
            return this._desktopFile.get_name();

        return this._displayName || null;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    set dropCoordinates(pos) {
        try {
            const info = new Gio.FileInfo();
            if (pos !== null) {
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
        return this._fileExtra === Enums.FileType.NONE;
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

        if (this._setMetadataTrustedCancellable)
            this._setMetadataTrustedCancellable.cancel();

        this._setMetadataTrustedCancellable = new Gio.Cancellable();
        const info = new Gio.FileInfo();
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
                        const title = _('Failed to set metadata::trusted flag');
                        const err = error.message;
                        const logError = `${title}: ${err}`;
                        this._logAndPopupError(title, err, logError);
                    }
                }
            });
    }

    get metadataUseSandboxing() {
        return this._useSandboxing;
    }

    set metadataUseSandboxing(value) {
        this._useSandboxing = value;

        if (this._setMetadataSandboxingCancellable)
            this._setMetadataSandboxingCancellable.cancel();

        this._setMetadataSandboxingCancellable = new Gio.Cancellable();
        const info = new Gio.FileInfo();
        info.set_attribute_string('metadata::nosandbox',
            value ? 'false' : 'true');
        this._file.set_attributes_async(info,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_LOW,
            this._setMetadataSandboxingCancellable,
            (source, result) => {
                try {
                    this._setMetadataSandboxingCancellable = null;
                    source.set_attributes_finish(result);
                    this._refreshMetadataAsync(true);
                } catch (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        const title = _('Failed to set metadata::trusted flag');
                        const err = error.message;
                        const logError = `${title}: ${err}`;
                        this._logAndPopupError(title, err, logError);
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
            const info = new Gio.FileInfo();
            if (pos !== null) {
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

    get trustedAppImageFile() {
        return this._isAppImageFile &&
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

    get isAppImageFile() {
        return this._isAppImageFile;
    }

    get writableByOthers() {
        return this._writableByOthers;
    }

    get isStackMarker() {
        if (this.isStackTop && !this.stackUnique)
            return true;
        else
            return false;
    }
};
Signals.addSignalMethods(FileItem.prototype);
