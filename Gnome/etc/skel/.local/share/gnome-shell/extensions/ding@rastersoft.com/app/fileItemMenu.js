/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2021 Sergio Costas (rastersoft@gmail.com)
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
const DBusUtils = imports.dbusUtils;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const TemplatesScriptsManager = imports.templatesScriptsManager;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Prefs = imports.preferences;
const ShowErrorPopup = imports.showErrorPopup;

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var FileItemMenu = class {
    constructor(desktopManager) {
        this._currentFileItem = null;
        this._menu = null;
        this._desktopManager = desktopManager;
        DBusUtils.GnomeArchiveManager.connect('changed-status', () => {
            // wait a second to ensure that everything has settled
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._getExtractionSupportedTypes();
                return false;
            });
        });
        this._askedSupportedTypes = false;
        this._scriptsMonitor = new TemplatesScriptsManager.TemplatesScriptsManager(
            DesktopIconsUtil.getScriptsDir(),
            TemplatesScriptsManager.TemplatesScriptsManagerFlags.ONLY_EXECUTABLE,
            this._onScriptClicked.bind(this));
    }

    _getExtractionSupportedTypes() {
        this._decompressibleTypes = [];
        try {
            if (DBusUtils.GnomeArchiveManager.isAvailable) {
                DBusUtils.GnomeArchiveManager.proxy.GetSupportedTypesRemote('extract',
                    (result, error) => {
                        if (error) {
                            logError(error, "Can't get the extractable types; ensure that File-Roller is installed.\n");
                            return;
                        }
                        for (let key of result.values()) {
                            for (let type of key.values()) {
                                this._decompressibleTypes.push(Object.values(type)[0]);
                            }
                        }
                    }
                );
            }
            this._askedSupportedTypes = true;
        } catch (e) {
            logError(e, 'Error while getting supported types.');
        }
    }

    _onScriptClicked(menuItemPath) {
        let pathList = 'NAUTILUS_SCRIPT_SELECTED_FILE_PATHS=';
        let uriList = 'NAUTILUS_SCRIPT_SELECTED_URIS=';
        let currentUri = `NAUTILUS_SCRIPT_CURRENT_URI=${DesktopIconsUtil.getDesktopDir().get_uri()}`;
        let params = [menuItemPath];
        for (let item of this._desktopManager.getCurrentSelection(false)) {
            if (!item.isSpecial) {
                pathList += `${item.file.get_path()}\n`;
                uriList += `${item.file.get_uri()}\n`;
                params.push(item.file.get_path());
            }
        }

        let environ = DesktopIconsUtil.getFilteredEnviron();
        environ.push(pathList);
        environ.push(uriList);
        environ.push(currentUri);
        DesktopIconsUtil.trySpawn(null, params, environ);
    }

    refreshedIcons() {
        if (!this._menu) {
            return;
        }
        this._currentFileItem = this._desktopManager.getFileItemFromURI(this._currentFileItem.uri);
        if (!this._currentFileItem) {
            this._menu.destroy();
            this._menu = null;
        }
    }

    _addSeparator() {
        this._menu.add(new Gtk.SeparatorMenuItem());
    }

    _addElementToMenu(label, action = null) {
        let element = new Gtk.MenuItem({label});
        this._menu.add(element);
        if (action) {
            element.connect('activate', action);
        }
        return element;
    }

    showMenu(fileItem, event, atWidget = false) {
        if (!this._askedSupportedTypes) {
            this._getExtractionSupportedTypes();
        }
        this._currentFileItem = fileItem;

        let selectedItemsNum = this._desktopManager.getNumberOfSelectedItems();

        this._menu = new Gtk.Menu();
        const menuStyleContext = this._menu.get_style_context();
        menuStyleContext.add_class('desktopmenu');
        menuStyleContext.add_class('fileitemmenu');

        if (!fileItem.isStackMarker) {
            this._addElementToMenu(
                selectedItemsNum > 1 ? _('Open All...') : _('Open'),
                this._doMultiOpen.bind(this)
            );
        }

        this._menu.connect_after('selection-done', () => {
            this._menu.destroy();
            this._menu = null;
        });

        let keepStacked = Prefs.desktopSettings.get_boolean('keep-stacked');
        if (keepStacked && !fileItem.stackUnique) {
            if (!fileItem.isSpecial && !fileItem.isDirectory && !fileItem.isValidDesktopFile) {
                let unstackList = Prefs.getUnstackList();
                let typeInList = unstackList.includes(fileItem.attributeContentType);
                this._addElementToMenu(
                    typeInList ? _('Stack This Type') : _('Unstack This Type'),
                    () => {
                        this._desktopManager.onToggleStackUnstackThisTypeClicked(this._currentFileItem.attributeContentType, typeInList, unstackList);
                    }
                );
            }
        }

        // fileExtra == NONE

        if (fileItem.isAllSelectable &&  !fileItem.isStackMarker) {
            let submenu = this._scriptsMonitor.createMenu();
            if (submenu !== null) {
                this._addElementToMenu(_('Scripts')).set_submenu(submenu);
                this._addSeparator();
            }

            if (!fileItem.isDirectory) {
                this._addElementToMenu(
                    selectedItemsNum > 1 ? _('Open All With Other Application...') : _('Open With Other Application'),
                    this._doOpenWith.bind(this)
                ).set_sensitive(selectedItemsNum > 0);

                if (DBusUtils.discreteGpuAvailable && fileItem.trustedDesktopFile && (selectedItemsNum == 1)) {
                    this._addElementToMenu(
                        _('Launch using Dedicated Graphics Card'),
                        () => {
                            this._currentFileItem.doDiscreteGpu();
                        }
                    );
                }
            }

            this._addSeparator();

            if (fileItem.attributeCanExecute && !fileItem.isDirectory && !fileItem.isValidDesktopFile && fileItem.execLine && Gio.content_type_can_be_executable(fileItem.attributeContentType)) {
                let execLine = fileItem.execLine;
                this._addElementToMenu(_('Run as a program'), () => {
                    DesktopIconsUtil.spawnCommandLine(`"${execLine}"`);
                });
                this._addSeparator();
            }

            let allowCutCopyTrash = this._desktopManager.checkIfSpecialFilesAreSelected();
            this._addElementToMenu(
                _('Cut'),
                () => {
                    this._desktopManager.doCut();
                }
            ).set_sensitive(!allowCutCopyTrash);

            this._addElementToMenu(
                _('Copy'),
                () => {
                    this._desktopManager.doCopy();
                }
            ).set_sensitive(!allowCutCopyTrash);

            if (fileItem.canRename && (selectedItemsNum == 1)) {
                this._addElementToMenu(
                    _('Rename…'),
                    () => {
                        this._desktopManager.doRename(this._currentFileItem, false);
                    }
                );
            }

            this._addSeparator();

            this._addElementToMenu(
                _('Move to Trash'),
                () => {
                    this._desktopManager.doTrash();
                }
            ).set_sensitive(!allowCutCopyTrash);

            if (Prefs.nautilusSettings.get_boolean('show-delete-permanently')) {
                this._addElementToMenu(
                    _('Delete permanently'),
                    () => {
                        this._desktopManager.doDeletePermanently();
                    }
                ).set_sensitive(!allowCutCopyTrash);
            }

            if (fileItem.isValidDesktopFile && !this._desktopManager.writableByOthers && !fileItem.writableByOthers && (selectedItemsNum == 1)) {
                this._addSeparator();
                this._addElementToMenu(
                    fileItem.trustedDesktopFile ? _("Don't Allow Launching") : _('Allow Launching'),
                    () => {
                        this._currentFileItem.onAllowDisallowLaunchingClicked();
                    }
                );
            }
        }

        // fileExtra == TRASH

        if (fileItem.isTrash) {
            this._addSeparator();
            this._addElementToMenu(
                _('Empty Trash'),
                () => {
                    this._desktopManager.doEmptyTrash();
                }
            );
        }

        // fileExtra == EXTERNAL_DRIVE

        if (fileItem.isDrive) {
            this._addSeparator();
            if (fileItem.canEject) {
                this._addElementToMenu(
                    _('Eject'),
                    () => {
                        this._currentFileItem.eject();
                    }
                );
            }
            if (fileItem.canUnmount) {
                this._addElementToMenu(
                    _('Unmount'),
                    () => {
                        this._currentFileItem.unmount();
                    }
                );
            }
        }

        if (fileItem.isAllSelectable && !this._desktopManager.checkIfSpecialFilesAreSelected() && (selectedItemsNum >= 1)) {
            this._addSeparator();
            let addedExtractHere = false;
            if (this._getExtractableAutoAr()) {
                addedExtractHere = true;
                this._addElementToMenu(
                    _('Extract Here'),
                    () => this._desktopManager.getCurrentSelection(false).forEach(f =>
                        this._desktopManager.autoAr.extractFile(f.fileName)));
            }
            if (selectedItemsNum == 1 && this._getExtractable()) {
                if (!addedExtractHere) {
                    this._addElementToMenu(
                        _('Extract Here'),
                        () => {
                            this._extractFileFromSelection(true);
                        }
                    );
                }
                this._addElementToMenu(
                    _('Extract To...'),
                    () => {
                        this._extractFileFromSelection(false);
                    }
                );
            }

            if (!fileItem.isDirectory) {
                this._addElementToMenu(
                    _('Send to...'),
                    this._mailFilesFromSelection.bind(this)
                );
            }

            if (this._desktopManager.getCurrentSelection().every(f => f.isDirectory)) {
                this._addElementToMenu(
                    Gettext.ngettext(
                        'Compress {0} folder', 'Compress {0} folders', selectedItemsNum).replace(
                        '{0}', selectedItemsNum),
                    () => this._doCompressFilesFromSelection()
                );
            } else {
                this._addElementToMenu(
                    Gettext.ngettext(
                        'Compress {0} file', 'Compress {0} files', selectedItemsNum).replace(
                        '{0}', selectedItemsNum),
                    () => this._doCompressFilesFromSelection()
                );
            }


            this._addElementToMenu(
                Gettext.ngettext('New Folder with {0} item', 'New Folder with {0} items', selectedItemsNum).replace('{0}', selectedItemsNum),
                () => {
                    this._doNewFolderFromSelection(this._currentFileItem);
                }
            );

            this._addSeparator();
        }

        if (!fileItem.isStackMarker) {
            this._addElementToMenu(
                selectedItemsNum > 1 ? _('Common Properties') : _('Properties'),
                this._onPropertiesClicked.bind(this)
            );

            this._addSeparator();

            this._addElementToMenu(
                selectedItemsNum > 1 ? _('Show All in Files') : _('Show in Files'),
                this._onShowInFilesClicked.bind(this)
            );
        }

        if (fileItem.isDirectory && (fileItem.path != null) && (selectedItemsNum == 1)) {
            this._addElementToMenu(
                _('Open in Terminal'),
                () => {
                    DesktopIconsUtil.launchTerminal(this._currentFileItem.path, null);
                }
            );
        }

        this._menu.show_all();
        if (atWidget) {
            this._menu.popup_at_widget(fileItem.container, Gdk.Gravity.CENTER, Gdk.Gravity.NORTH_WEST, event);
        } else {
            this._menu.popup_at_pointer(event);
        }
    }

    _onPropertiesClicked() {
        let propertiesFileList = this._desktopManager.getCurrentSelection(true);
        const timestamp = Gtk.get_current_event_time();
        DBusUtils.RemoteFileOperations.ShowItemPropertiesRemote(propertiesFileList, timestamp);
    }

    _onShowInFilesClicked() {
        let showInFilesList = this._desktopManager.getCurrentSelection(true);
        if (this._desktopManager.useNemo) {
            try {
                for (let element of showInFilesList) {
                    DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', element], DesktopIconsUtil.getFilteredEnviron());
                }
                return;
            } catch (err) {
                logError(err, 'Error trying to launch Nemo.');
            }
        }
        const timestamp = Gtk.get_current_event_time();
        DBusUtils.RemoteFileOperations.ShowItemsRemote(showInFilesList, timestamp);
    }

    _doMultiOpen() {
        for (let fileItem of this._desktopManager.getCurrentSelection(false)) {
            fileItem.unsetSelected();
            fileItem.doOpen();
        }
    }

    _doOpenWith() {
        let fileItems = this._desktopManager.getCurrentSelection(false);
        if (fileItems) {
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gtk.get_current_event_time());
            let mimetype = Gio.content_type_guess(fileItems[0].fileName, null)[0];
            let chooser = Gtk.AppChooserDialog.new_for_content_type(null,
                Gtk.DialogFlags.MODAL + Gtk.DialogFlags.USE_HEADER_BAR,
                mimetype);
            chooser.show_all();
            chooser.connect('close', () => {
                chooser.response(Gtk.ResponseType.CANCEL);
            });
            chooser.connect('response', (actor, retval) => {
                if (retval == Gtk.ResponseType.OK) {
                    let appInfo = chooser.get_app_info();
                    if (appInfo) {
                        let fileList = [];
                        for (let item of fileItems) {
                            fileList.push(item.file);
                        }
                        appInfo.launch(fileList, context);
                    }
                }
                chooser.hide();
            });
        }
    }

    _extractFileFromSelection(extractHere) {
        let extractFileItemURI;
        let extractFolderName;
        let position;
        const header = _('No Extraction Folder');
        const text = _('Unable to extract File, extraction Folder Does not Exist');

        for (let fileItem of this._desktopManager.getCurrentSelection(false)) {
            extractFileItemURI = fileItem.file.get_uri();
            extractFolderName = fileItem.fileName;
            position = fileItem.getCoordinates().slice(0, 2);
            fileItem.unsetSelected();
        }

        if (extractHere) {
            extractFolderName = DesktopIconsUtil.getFileExtensionOffset(extractFolderName).basename;
            const targetURI = this._desktopManager.doNewFolder(position, extractFolderName, {rename: false});
            if (targetURI) {
                DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, targetURI, true);
            } else {
                this._desktopManager.DBusManager.doNotify(header, text);
            }
            return;
        }

        const dialog = new Gtk.FileChooserDialog({title: _('Select Extract Destination')});
        dialog.set_action(Gtk.FileChooserAction.SELECT_FOLDER);
        dialog.set_create_folders(true);
        dialog.set_current_folder_uri(DesktopIconsUtil.getDesktopDir().get_uri());
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
        DesktopIconsUtil.windowHidePagerTaskbarModal(dialog, true);
        dialog.show_all();
        dialog.connect('close', () => {
            dialog.response(Gtk.ResponseType.CANCEL);
        });
        dialog.connect('response', (actor, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const folder = dialog.get_uri();
                if (folder) {
                    DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, folder, true);
                } else {
                    this._desktopManager.DBusManager.doNotify(header, text);
                }
            }
            dialog.destroy();
        });
    }

    _getExtractableAutoAr() {
        let fileList = this._desktopManager.getCurrentSelection(false);
        if (DBusUtils.GnomeArchiveManager.isAvailable && (fileList.length == 1)) {
            return false;
        }
        for (let item of fileList) {
            if (!this._desktopManager.autoAr.fileIsCompressed(item.fileName)) {
                return false;
            }
        }
        return true;
    }

    _getExtractable() {
        for (let item of this._desktopManager.getCurrentSelection(false)) {
            return this._decompressibleTypes.includes(item.attributeContentType);
        }
        return false;
    }

    _mailFilesFromSelection() {
        if (this._desktopManager.checkIfDirectoryIsSelected()) {
            let WindowError = new ShowErrorPopup.ShowErrorPopup(_('Can not email a Directory'),
                _('Selection includes a Directory, compress the directory to a file first.'),
                false);
            WindowError.run();
            return;
        }
        let xdgEmailCommand = [];
        xdgEmailCommand.push('xdg-email');
        for (let fileItem of this._desktopManager.getCurrentSelection(false)) {
            fileItem.unsetSelected();
            xdgEmailCommand.push('--attach');
            xdgEmailCommand.push(fileItem.file.get_path());
        }
        DesktopIconsUtil.trySpawn(null, xdgEmailCommand);
    }

    _doCompressFilesFromSelection() {
        let desktopFolder = DesktopIconsUtil.getDesktopDir();
        if (desktopFolder) {
            if (DBusUtils.GnomeArchiveManager.isAvailable) {
                const toCompress = this._desktopManager.getCurrentSelection(true);
                DBusUtils.RemoteFileOperations.CompressRemote(toCompress, desktopFolder.get_uri(), true);
            } else {
                const toCompress = this._desktopManager.getCurrentSelection(false);
                this._desktopManager.autoAr.compressFileItems(toCompress, desktopFolder.get_path());
            }
        }
        this._desktopManager.unselectAll();
    }

    _doNewFolderFromSelection(clickedItem) {
        if (!clickedItem) {
            return;
        }
        let position = clickedItem.savedCoordinates;
        let newFolderFileItems = this._desktopManager.getCurrentSelection(true);
        this._desktopManager.unselectAll();
        clickedItem.removeFromGrid(true);
        let newFolder = this._desktopManager.doNewFolder(position);
        if (newFolder) {
            DBusUtils.RemoteFileOperations.MoveURIsRemote(newFolderFileItems, newFolder);
        }
    }
};
