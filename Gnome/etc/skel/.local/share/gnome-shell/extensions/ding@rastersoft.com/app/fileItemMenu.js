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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
import * as DBusUtils from './dbusUtils.js';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';

import * as TemplatesScriptsManager from './templatesScriptsManager.js';
import * as DesktopIconsUtil from './desktopIconsUtil.js';
import * as Prefs from './preferences.js';
import * as ShowErrorPopup from './showErrorPopup.js';
import * as SignalManager from './signalManager.js';
import * as MenuHelper from './menuHelper.js';

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

export var FileItemMenu = class extends MenuHelper.MenuHelper {
    constructor(desktopManager, mainApp) {
        super(desktopManager, mainApp);
        this._lastMenu = null;
        this._menuSignals = new SignalManager.SignalManager();
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
            this._onScriptClicked.bind(this)
        );
        this._addActions();
    }

    _addActions() {
        this._addNewAction('open-selected-files', null, () => {
            for (const fileItem of this._desktopManager.getCurrentSelection(false)) {
                fileItem.unsetSelected();
                fileItem.doOpen();
            }
        });

        this._addNewAction('toggle-stack', null, this.onToggleStackUnstackThisTypeClicked.bind(this), 's');

        this._addNewAction('open-with', null, this._doOpenWith.bind(this));

        this._addNewAction('launch-with-discrete-gpu', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            if (file !== null)
                file.doDiscreteGpu();
        }, 's');

        this._addNewAction('run-as-a-program', null, (action, parameter) => {
            const execLine = parameter.get_string()[0];
            DesktopIconsUtil.spawnCommandLine(`"${execLine}"`);
        }, 's');

        this._actionCut = this._addNewAction('cut-file', ['<Control>x'], this._desktopManager.doCut.bind(this._desktopManager));

        this._actionCopy = this._addNewAction('copy-file', ['<Control>c'], this._desktopManager.doCopy.bind(this._desktopManager));

        this._addNewAction('rename-file', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            this._desktopManager.doRename(file, false);
        }, 's');

        this._actionTrash = this._addNewAction('trash-file', ['Delete'], this._desktopManager.doTrash.bind(this._desktopManager));

        this._actionDelete = this._addNewAction('delete-file', ['<Shift>Delete'], this._desktopManager.doDeletePermanently.bind(this._desktopManager));

        this._addNewAction('toggle-allow-launching', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            file.onAllowDisallowLaunchingClicked();
        }, 's');

        this._addNewAction('toggle-use-sandboxing', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            file.onToggleSandboxingClicked();
        }, 's');

        this._addNewAction('empty-trash', null, () => {
            this._desktopManager.doEmptyTrash();
        });

        this._addNewAction('eject-drive', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            file.eject();
        }, 's');

        this._addNewAction('umount-drive', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            file.unmount();
        }, 's');

        this._addNewAction('extract-here-autoar', null, () => {
            this._desktopManager.getCurrentSelection(false).forEach(f =>
                this._desktopManager.autoAr.extractFile(f.fileName));
        });

        this._addNewAction('extract-here', null, () => {
            this._extractFileFromSelection(true);
        });

        this._addNewAction('extract-to', null, () => {
            this._extractFileFromSelection(false);
        });

        this._addNewAction('send-to', null, () => {
            this._mailFilesFromSelection();
        });

        this._addNewAction('compress-file', null, (action, parameter) => {
            const fileObj = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            this._doCompressFilesFromSelection(fileObj.grid);
        }, 's');

        this._addNewAction('new-folder-from-selection', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            this._doNewFolderFromSelection(file);
        }, 's');

        this._addNewAction('show-properties', null, this._onPropertiesClicked.bind(this));

        this._addNewAction('show-files-in-files', null, this._onShowInFilesClicked.bind(this));

        this._addNewAction('open-in-terminal', null, (action, parameter) => {
            const file = this._desktopManager.getFileItemFromURI(parameter.get_string()[0]);
            DesktopIconsUtil.launchTerminal(file.path, null);
        }, 's');
    }

    _getExtractionSupportedTypes() {
        this._decompressibleTypes = [];
        try {
            if (DBusUtils.GnomeArchiveManager.isAvailable) {
                DBusUtils.GnomeArchiveManager.proxy.GetSupportedTypesRemote('extract',
                    (result, error) => {
                        if (error) {
                            console.error(error, "Can't get the extractable types; ensure that File-Roller is installed.\n");
                            return;
                        }
                        for (const key of result.values()) {
                            for (const type of key.values())
                                this._decompressibleTypes.push(Object.values(type)[0]);
                        }
                    }
                );
            }
            this._askedSupportedTypes = true;
        } catch (e) {
            console.error(e, 'Error while getting supported types.');
        }
    }

    _onScriptClicked(menuItemPath) {
        let pathList = 'NAUTILUS_SCRIPT_SELECTED_FILE_PATHS=';
        let uriList = 'NAUTILUS_SCRIPT_SELECTED_URIS=';
        const currentUri = `NAUTILUS_SCRIPT_CURRENT_URI=${DesktopIconsUtil.getDesktopDir().get_uri()}`;
        const params = [menuItemPath];
        for (const item of this._desktopManager.getCurrentSelection(false)) {
            if (!item.isSpecial) {
                pathList += `${item.file.get_path()}\n`;
                uriList += `${item.file.get_uri()}\n`;
                params.push(item.file.get_path());
            }
        }

        const environ = DesktopIconsUtil.getFilteredEnviron();
        environ.push(pathList);
        environ.push(uriList);
        environ.push(currentUri);
        DesktopIconsUtil.trySpawn(null, params, environ);
    }

    refreshedIcons() {
    }

    onToggleStackUnstackThisTypeClicked(menuItem, variantPath) {
        this._desktopManager.onToggleStackUnstackThisTypeClicked(variantPath.get_string()[0]);
    }

    showMenu(fileItem) {
        this._currentFileItem = fileItem;
        if (this._lastMenu !== null)
            this._lastMenu.menuPopover.unparent();

        const menu = this._createMenu(fileItem);
        const menuPopover = Gtk.PopoverMenu.new_from_model_full(menu, Gtk.PopoverMenuFlags.NESTED);
        menuPopover.add_css_class('fileitemmenu');
        menuPopover.set_parent(fileItem.container);
        menuPopover.show();
        menuPopover.popup();
        this._lastMenu = {menuPopover, fileItem};
    }

    _createMenu(fileItem) {
        if (!this._askedSupportedTypes)
            this._getExtractionSupportedTypes();


        const selectedItemsNum = this._desktopManager.getNumberOfSelectedItems();

        const menu = new Gio.Menu();

        let section = this._newSection(menu);
        let addedElement = false;
        if (!fileItem.isStackMarker) {
            this._newMenuElement(
                selectedItemsNum > 1 ? _('Open All...') : _('Open'),
                'open-selected-files',
                section
            );
            addedElement = true;
        }

        const keepStacked = Prefs.desktopSettings.get_boolean('keep-stacked');
        if (keepStacked && !fileItem.stackUnique) {
            if (!fileItem.isSpecial && !fileItem.isDirectory && !fileItem.isValidDesktopFile) {
                const unstackList = Prefs.getUnstackList();
                const typeInList = unstackList.includes(fileItem.attributeContentType);
                this._newMenuElement(
                    typeInList ? _('Stack This Type') : _('Unstack This Type'),
                    'toggle-stack',
                    section,
                    GLib.Variant.new('s', fileItem.attributeContentType)
                );
                addedElement = true;
            }
        }

        if (fileItem.isAllSelectable && !fileItem.isStackMarker) {
            const submenu = this._scriptsMonitor.createMenu();
            if (submenu !== null)
                addedElement = true;

            if (addedElement)
                section = this._newSection(menu);


            this._newMenuElement(
                selectedItemsNum > 1 ? _('Open All With Other Application...') : _('Open With Other Application'),
                'open-with',
                section
            );

            if (DBusUtils.discreteGpuAvailable && fileItem.trustedDesktopFile && (selectedItemsNum === 1)) {
                this._newMenuElement(
                    _('Launch using Dedicated Graphics Card'),
                    'launch-with-discrete-gpu',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            }

            section = this._newSection(menu);

            if (fileItem.attributeCanExecute && !fileItem.isDirectory && !fileItem.isValidDesktopFile && !fileItem.isAppImageFile && fileItem.execLine && Gio.content_type_can_be_executable(fileItem.attributeContentType)) {
                const execLine = fileItem.execLine;
                this._newMenuElement(_('Run as a program'),
                    'run-as-a-program',
                    section,
                    GLib.Variant.new('s', `"${execLine}"`)
                );
                section = this._newSection(menu);
            }

            const allowCutCopyTrash = !this._desktopManager.checkIfSpecialFilesAreSelected();
            this._actionCut.enabled = allowCutCopyTrash;
            this._actionCopy.enabled = allowCutCopyTrash;
            this._actionDelete.enabled = allowCutCopyTrash;
            this._actionTrash.enabled = allowCutCopyTrash;

            this._newMenuElement(
                _('Cut'),
                'cut-file',
                section
            );

            this._newMenuElement(
                _('Copy'),
                'copy-file',
                section
            );

            if (fileItem.canRename && (selectedItemsNum === 1)) {
                this._newMenuElement(
                    _('Rename…'),
                    'rename-file',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            }

            section = this._newSection(menu);

            this._newMenuElement(
                _('Move to Trash'),
                'trash-file',
                section
            );

            if (Prefs.nautilusSettings.get_boolean('show-delete-permanently')) {
                this._newMenuElement(
                    _('Delete permanently'),
                    'delete-file',
                    section
                );
            }

            if ((fileItem.isValidDesktopFile || fileItem.isAppImageFile) && !this._desktopManager.writableByOthers && !fileItem.writableByOthers && (selectedItemsNum === 1)) {
                section = this._newSection(menu);
                this._newMenuElement(
                    fileItem.trustedDesktopFile || fileItem.trustedAppImageFile ? _("Don't Allow Launching") : _('Allow Launching'),
                    'toggle-allow-launching',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
                if (fileItem.isAppImageFile) {
                    this._newMenuElement(
                        fileItem.metadataUseSandboxing ? _("Don't use sandboxing") : _('Use sandboxing if available'),
                        'toggle-use-sandboxing',
                        section,
                        GLib.Variant.new('s', fileItem.uri)
                    );
                }
            }
        }

        // fileExtra === TRASH

        if (fileItem.isTrash) {
            section = this._newSection(menu);
            this._newMenuElement(
                _('Empty Trash'),
                'empty-trash',
                section
            );
        }

        // fileExtra === EXTERNAL_DRIVE

        if (fileItem.isDrive && (selectedItemsNum === 1)) {
            section = this._newSection(menu);
            if (fileItem.canEject) {
                this._newMenuElement(
                    _('Eject'),
                    'eject-drive',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            }
            if (fileItem.canUnmount) {
                this._newMenuElement(
                    _('Unmount'),
                    'umount-drive',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            }
        }

        if (fileItem.isAllSelectable && !this._desktopManager.checkIfSpecialFilesAreSelected() && (selectedItemsNum >= 1)) {
            section = this._newSection(menu);
            let addedExtractHere = false;
            if (this._getExtractableAutoAr()) {
                addedExtractHere = true;
                this._newMenuElement(
                    _('Extract Here'),
                    'extract-here-autoar',
                    section
                );
            }
            if (selectedItemsNum === 1 && this._getExtractable()) {
                if (!addedExtractHere) {
                    this._newMenuElement(
                        _('Extract Here'),
                        'extract-here',
                        section
                    );
                }
                this._newMenuElement(
                    _('Extract To...'),
                    'extract-to',
                    section
                );
            }

            if (!fileItem.isDirectory) {
                this._newMenuElement(
                    _('Send to...'),
                    'send-to',
                    section
                );
            }

            if (this._desktopManager.getCurrentSelection().every(f => f.isDirectory)) {
                this._newMenuElement(
                    Gettext.ngettext(
                        'Compress {0} folder', 'Compress {0} folders', selectedItemsNum).replace(
                        '{0}', selectedItemsNum),
                    'compress-file',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            } else {
                this._newMenuElement(
                    Gettext.ngettext(
                        'Compress {0} file', 'Compress {0} files', selectedItemsNum).replace(
                        '{0}', selectedItemsNum),
                    'compress-file',
                    section,
                    GLib.Variant.new('s', fileItem.uri)
                );
            }


            this._newMenuElement(
                Gettext.ngettext('New Folder with {0} item', 'New Folder with {0} items', selectedItemsNum).replace('{0}', selectedItemsNum),
                'new-folder-from-selection',
                section,
                GLib.Variant.new('s', fileItem.uri)
            );

            section = this._newSection(menu);
        }

        if (!fileItem.isStackMarker) {
            this._newMenuElement(
                selectedItemsNum > 1 ? _('Common Properties') : _('Properties'),
                'show-properties',
                section
            );

            section = this._newSection(menu);

            this._newMenuElement(
                selectedItemsNum > 1 ? _('Show All in Files') : _('Show in Files'),
                'show-files-in-files',
                section
            );
        }

        if (fileItem.isDirectory && (fileItem.path !== null) && (selectedItemsNum === 1)) {
            this._newMenuElement(
                _('Open in Terminal'),
                'open-in-terminal',
                section,
                GLib.Variant.new('s', fileItem.uri)
            );
        }
        return menu;
    }

    _onPropertiesClicked() {
        const propertiesFileList = this._desktopManager.getCurrentSelection(true);
        DBusUtils.RemoteFileOperations.ShowItemPropertiesRemote(propertiesFileList);
    }

    _onShowInFilesClicked() {
        const showInFilesList = this._desktopManager.getCurrentSelection(true);
        if (this._desktopManager.useNemo) {
            try {
                for (const element of showInFilesList)
                    DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', element], DesktopIconsUtil.getFilteredEnviron());

                return;
            } catch (err) {
                console.error(err, 'Error trying to launch Nemo.');
            }
        }
        DBusUtils.RemoteFileOperations.ShowItemsRemote(showInFilesList);
    }

    _doMultiOpen() {
        for (const fileItem of this._desktopManager.getCurrentSelection(false)) {
            fileItem.unsetSelected();
            fileItem.doOpen();
        }
    }

    _doOpenWith() {
        const fileItems = this._desktopManager.getCurrentSelection(false);
        if (fileItems) {
            const context = Gdk.Display.get_default().get_app_launch_context();
            // context.set_timestamp(Gtk.get_current_event_time());
            let mimetype = Gio.content_type_guess(fileItems[0].fileName, null)[0];
            if (fileItems[0].isDirectory)
                mimetype = 'inode/directory';

            let chooser = Gtk.AppChooserDialog.new_for_content_type(
                this._currentFileItem.container.get_root(),
                Gtk.DialogFlags.MODAL | Gtk.DialogFlags.USE_HEADER_BAR,
                mimetype);
            let signals = new SignalManager.SignalManager();
            chooser.show();
            signals.connectSignal(chooser, 'close', () => {
                chooser.response(Gtk.ResponseType.CANCEL);
            });
            signals.connectSignal(chooser, 'response', (actor, retval) => {
                if (retval === Gtk.ResponseType.OK) {
                    const appInfo = chooser.get_app_info();
                    if (appInfo) {
                        const fileList = [];
                        for (const item of fileItems)
                            fileList.push(item.file);

                        appInfo.launch(fileList, context);
                    }
                }
                chooser.hide();
                signals.disconnectAllSignals();
                chooser = null;
                signals = null;
            });
        }
    }

    _extractFileFromSelection(extractHere) {
        let extractFileItemURI;
        let extractFolderName;
        let position;
        const header = _('No Extraction Folder');
        const text = _('Unable to extract File, extraction Folder Does not Exist');

        for (const fileItem of this._desktopManager.getCurrentSelection(false)) {
            extractFileItemURI = fileItem.file.get_uri();
            extractFolderName = fileItem.fileName;
            position = fileItem.getCoordinates().slice(0, 2);
            fileItem.unsetSelected();
        }

        if (extractHere) {
            extractFolderName = DesktopIconsUtil.getFileExtensionOffset(extractFolderName).basename;
            const targetURI = this._desktopManager.doNewFolder(position, extractFolderName, {rename: false});
            if (targetURI)
                DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, targetURI, true);
            else
                this._desktopManager.DBusManager.doNotify(header, text);

            return;
        }

        const dialog = new Gtk.FileChooserDialog({
            title: _('Select Extract Destination'),
            modal: true,
            transientFor: this._currentFileItem.container.get_root(),
        });
        dialog.set_action(Gtk.FileChooserAction.SELECT_FOLDER);
        dialog.set_create_folders(true);
        dialog.set_current_folder(DesktopIconsUtil.getDesktopDir());
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
        DesktopIconsUtil.windowHidePagerTaskbarModal(dialog, true);
        dialog.show();
        dialog.connect('close', () => {
            dialog.response(Gtk.ResponseType.CANCEL);
        });
        dialog.connect('response', (actor, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const folder = dialog.get_current_folder().get_uri();
                if (folder)
                    DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, folder, true);
                else
                    this._desktopManager.DBusManager.doNotify(header, text);
            }
            dialog.destroy();
        });
    }

    _getExtractableAutoAr() {
        const fileList = this._desktopManager.getCurrentSelection(false);
        if (DBusUtils.GnomeArchiveManager.isAvailable && (fileList.length === 1))
            return false;

        for (const item of fileList) {
            if (!this._desktopManager.autoAr.fileIsCompressed(item.fileName))
                return false;
        }
        return true;
    }

    _getExtractable() {
        for (const item of this._desktopManager.getCurrentSelection(false))
            return this._decompressibleTypes.includes(item.attributeContentType);

        return false;
    }

    _mailFilesFromSelection() {
        if (this._desktopManager.checkIfDirectoryIsSelected()) {
            const WindowError = new ShowErrorPopup.ShowErrorPopup(_('Can not email a Directory'),
                _('Selection includes a Directory, compress the directory to a file first.'),
                false);
            WindowError.run();
            return;
        }
        const xdgEmailCommand = [];
        xdgEmailCommand.push('xdg-email');
        for (const fileItem of this._desktopManager.getCurrentSelection(false)) {
            fileItem.unsetSelected();
            xdgEmailCommand.push('--attach');
            xdgEmailCommand.push(fileItem.file.get_path());
        }
        DesktopIconsUtil.trySpawn(null, xdgEmailCommand);
    }

    _doCompressFilesFromSelection(grid) {
        const desktopFolder = DesktopIconsUtil.getDesktopDir();
        if (desktopFolder) {
            if (DBusUtils.GnomeArchiveManager.isAvailable) {
                const toCompress = this._desktopManager.getCurrentSelection(true);
                DBusUtils.RemoteFileOperations.CompressRemote(toCompress, desktopFolder.get_uri(), true);
            } else {
                const toCompress = this._desktopManager.getCurrentSelection(false);
                this._desktopManager.autoAr.compressFileItems(toCompress, desktopFolder.get_path(), grid);
            }
        }
        this._desktopManager.unselectAll();
    }

    _doNewFolderFromSelection(clickedItem) {
        if (!clickedItem)
            return;

        const position = clickedItem.savedCoordinates;
        const newFolderFileItems = this._desktopManager.getCurrentSelection(true);
        this._desktopManager.unselectAll();
        clickedItem.removeFromGrid(true);
        const newFolder = this._desktopManager.doNewFolder(position);
        if (newFolder)
            DBusUtils.RemoteFileOperations.MoveURIsRemote(newFolderFileItems, newFolder);
    }
};
