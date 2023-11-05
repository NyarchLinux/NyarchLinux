/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sergio Costas (sergio.costas@canonical.com)
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
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
var GnomeAutoar = null;
try {
    GnomeAutoar = imports.gi.GnomeAutoar;
} catch (e) {
}

const Enums = imports.enums;
const FileUtils = imports.fileUtils;
const Prefs = imports.preferences;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var AutoAr = class {
    constructor(desktopManager) {
        this._desktopManager = desktopManager;
        this._progressWindow = new Gtk.Window({
            title: 'Archives Operations',
            resizable: false,
            deletable: false,
            modal: false,
            default_height: 100,
            window_position: Gtk.WindowPosition.CENTER_ALWAYS,
        });
        this._progressWindow.connect('delete-event', () => {
            return true;
        });
        this._progressContainer = new Gtk.Box({
            spacing: 12,
            margin_top: 15,
            margin_bottom: 15,
            margin_start: 30,
            margin_end: 30,
            halign: Gtk.Align.CENTER,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._inhibitCookie = null;
        this._progressContainer.connect('remove', () => {
            this._progressElements--;
            if (this._progressElements == 0) {
                this._progressWindow.hide();
                if (this._inhibitCookie !== null) {
                    this._desktopManager.mainApp.uninhibit(this._inhibitCookie);
                    this._inhibitCookie = null;
                }
            }

            this.emit('progress-elements-changed', this._progressElements);
        });
        this._progressElements = 0;
        const scroll = new Gtk.ScrolledWindow({
            propagate_natural_width: true,
            min_content_height: 300,
        });
        scroll.hscrollbar_policy = Gtk.PolicyType.NEVER;
        scroll.vscrollbar_policy = Gtk.PolicyType.AUTOMATIC;
        this._progressWindow.add(scroll);
        const viewport = new Gtk.Viewport();
        scroll.add(viewport);
        viewport.add(this._progressContainer);
        this._refreshExtensions();
    }

    checkAutoAr() {
        if (GnomeAutoar === null) {
            this._desktopManager.dbusManager.doNotify(_('AutoAr is not installed'),
                _('To be able to work with compressed files, install file-roller and/or gir-1.2-gnomeAutoAr'));
        }
        return GnomeAutoar !== null;
    }

    _refreshExtensions() {
        this._formats = [];
        this._filters = [];
        this._extensions = {};
        this._combinedExtensions = {};
        if (!GnomeAutoar) {
            return;
        }
        const lastFormat = GnomeAutoar.format_last();
        const lastFilter = GnomeAutoar.filter_last();
        for (let format = 0; format <= lastFormat; format++) {
            try {
                if (!GnomeAutoar.format_is_valid(format)) {
                    continue;
                }
            } catch (e) {
                continue;
            }
            this._formats.push(format);
            const extension = GnomeAutoar.format_get_extension(format);
            if (!extension) {
                continue;
            }
            this._extensions[extension] = {
                extension,
                format,
                filter: null,
            };
        }
        for (let filter = 0; filter <= lastFilter; filter++) {
            try {
                if (!GnomeAutoar.filter_is_valid(filter)) {
                    continue;
                }
            } catch (e) {
                continue;
            }
            this._filters.push(filter);
            const extension = GnomeAutoar.filter_get_extension(filter);
            if (!extension) {
                continue;
            }
            this._extensions[extension] = {
                extension,
                format: null,
                filter,
            };
        }
        for (let format of this._formats) {
            for (let filter of this._filters) {
                const extension = GnomeAutoar.format_filter_get_extension(format, filter);
                if (!extension) {
                    continue;
                }
                this._combinedExtensions[extension] = {
                    extension,
                    format,
                    filter,
                };
            }
        }
    }

    extensionIsAvailable(extension) {
        return (extension in this._extensions) || (extension in this._combinedExtensions);
    }

    getFormatAndFilterForExtension(extension) {
        if (extension in this._extensions) {
            return this._extensions[extension];
        }
        if (extension in this._combinedExtensions) {
            return this._combinedExtensions[extension];
        }
        return null;
    }

    _getFormatAndFilterForFilename(fileName) {
        for (let extension in this._combinedExtensions) {
            if (fileName.endsWith(`.${extension}`)) {
                return this._combinedExtensions[extension];
            }
        }
        for (let extension in this._extensions) {
            if (fileName.endsWith(`.${extension}`)) {
                return this._extensions[extension];
            }
        }
        return null;
    }

    fileIsCompressed(fileName) {
        return this._getFormatAndFilterForFilename(fileName) !== null;
    }

    runToolAsync(autoArTool, cancellable) {
        return new Promise((resolve, reject) => {
            const connections = [];

            connections.push(autoArTool.connect('cancelled', () => {
                connections.forEach(c => autoArTool.disconnect(c));
                reject(new GLib.Error(Gio.IOErrorEnum,
                    Gio.IOErrorEnum.CANCELLED,
                    'Operation was cancelled'));
            }));

            connections.push(autoArTool.connect('error', (w, error) => {
                connections.forEach(c => autoArTool.disconnect(c));
                reject(error);
            }));

            connections.push(autoArTool.connect('completed', () => {
                connections.forEach(c => autoArTool.disconnect(c));
                resolve();
            }));

            autoArTool.start_async(cancellable);
        });
    }

    extractFile(fileName) {
        if (!this.checkAutoAr()) {
            return;
        }
        const fullPath = GLib.build_filenamev([GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP), fileName]);
        const formatFilter = this._getFormatAndFilterForFilename(fileName);
        const extSize = formatFilter.extension.length;
        const total = fullPath.length;
        const folderName = fullPath.substring(0, total - extSize);
        const folder = Gio.File.new_for_path(folderName);
        const doExtract = new progressDialog(this, _('Extracting files'));
        this._password = null;
        doExtract.doExtractFile(fullPath, folder, folderName).catch(
            e => logError(e));
    }

    compressFileItems(fileList, destinationFolder) {
        if (!this.checkAutoAr()) {
            return;
        }
        new CompressDialog(this._desktopManager, fileList, destinationFolder);
    }

    compressFiles(fileList, outputFile, format, filter, password = null) {
        if (!this.checkAutoAr()) {
            return;
        }
        const doCompress = new progressDialog(this, _('Compressing files'));
        doCompress.doCompressFiles(fileList, outputFile, format, filter, password).catch(
            e => logError(e));
    }

    notify(title, text) {
        this._desktopManager.dbusManager.doNotify(title, text);
    }

    getProgressElements() {
        return this._progressContainer.get_children();
    }

    addProgress(progressElement, message) {
        this._progressContainer.pack_start(progressElement, false, true, 0);
        if (this._progressElements == 0) {
            this._inhibitCookie = this._desktopManager.mainApp.inhibit(null,
                Gtk.ApplicationInhibitFlags.LOGOUT | Gtk.ApplicationInhibitFlags.SUSPEND,
                message);
        }
        this._progressElements++;
        this._progressWindow.show_all();
        this._progressWindow.present();
        this.emit('progress-elements-changed', this._progressElements);
    }
};

Signals.addSignalMethods(AutoAr.prototype);

const progressDialog = class {
    constructor(autoArClass, message) {
        this._autoAr = autoArClass;
        this._waitingForPassword = false;
        this._currentPassword = null;
        this._buttonPromiseAccept = null;
        this._container = new Gtk.Box({
            spacing: 0,
            halign: Gtk.Align.END,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._processLabel = new Gtk.Label();
        this._processBar = new Gtk.ProgressBar();
        const container2 = new Gtk.Box({
            spacing: 12,
            margin_top: 15,
            margin_bottom: 15,
            margin_start: 30,
            margin_end: 30,
            halign: Gtk.Align.CENTER,
            orientation: Gtk.Orientation.HORIZONTAL,
        });
        const container3 = new Gtk.Box({
            spacing: 10,
            halign: Gtk.Align.END,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._cancelButton = new Gtk.Button({label: _('Cancel')});
        this._cancelButton.connect('clicked', () => {
            if (this._buttonPromiseAccept) {
                this._buttonPromiseAccept(false);
                return;
            }
            this._cancellable.cancel();
        });
        this._passOkButton = new Gtk.Button({label: _('OK')});
        this._passOkButton.get_style_context().add_class('suggested-action');
        const passOKfunc = function () {
            this._processBar.show();
            this._passEntry.hide();
            this._passOkButton.hide();
            this._currentPassword = this._passEntry.get_text();
            if (this._buttonPromiseAccept) {
                this._buttonPromiseAccept(true);
            }
        }.bind(this);
        this._passOkButton.connect('clicked', passOKfunc);
        this._passEntry = new Gtk.Entry({
            placeholder_text: _('Enter a password here'),
            input_purpose: Gtk.InputPurpose.PASSWORD,
            visibility: false,
            secondary_icon_name: 'view-conceal',
            secondary_icon_activatable: true,
            secondary_icon_sensitive: true,
        });
        container3.pack_start(this._processLabel, false, true, 0);
        container3.pack_start(this._processBar, false, true, 0);
        container3.pack_start(this._passEntry, false, true, 0);
        container2.pack_start(container3, false, true, 0);
        container2.pack_start(this._passOkButton, false, false, 0);
        container2.pack_start(this._cancelButton, false, false, 0);
        this._container.pack_start(container2, false, false, 0);
        this._passEntry.connect('icon-release', () => {
            this._passEntry.visibility = !this._passEntry.visibility;
        });
        this._passEntry.connect('activate', passOKfunc);

        const separator = new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL});
        this._container.pack_start(separator, false, true, 4);
        const updateSeparatorVisibility = () => {
            const progressElements = this._autoAr.getProgressElements();
            separator.visible = progressElements.length &&
                this._container != progressElements[progressElements.length - 1];
        };
        updateSeparatorVisibility();
        this._elementsChangedId = this._autoAr.connect('progress-elements-changed',
            updateSeparatorVisibility);

        this._cancellable = new Gio.Cancellable();
        this._autoAr.addProgress(this._container, message);
        this._passEntry.hide();
        this._passOkButton.hide();
    }

    async _cleanupFile(file, cancellable) {
        if (!file.query_exists(null)) {
            return;
        }
        this._processBar.set_fraction(0);
        this._processLabel.set_label(_("Removing partial file '${outputFile}'").replace(
            '${outputFile}', file.get_basename()));

        this._removeTimer();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._processBar.pulse();
            return true;
        });

        try {
            await FileUtils.deleteFile(file, null, cancellable);
        } catch (e) {
            logError(e, `Failed to remove ${file.get_path()}: ${e.message}`);
        } finally {
            this._removeTimer();
        }
    }

    async doExtractFile(fullPath, folder, folderName, counter = 1) {
        this._processLabel.set_label(_('Creating destination folder'));
        this._processBar.pulse();

        try {
            await folder.make_directory_async_promise(GLib.PRIORITY_DEFAULT, this._cancellable);

            const info = new Gio.FileInfo();
            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o700);

            try {
                await folder.set_attributes_async_promise(info,
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    this._cancellable);
            } catch (e) {
                logError(e, `Failed to set attributes to ${folder.get_path()}`);
            }
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                this._destroy();
                return;
            }

            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                const newFolder = Gio.File.new_for_path(`${folderName} (${counter})`);
                await this.doExtractFile(fullPath, newFolder, folderName, counter + 1);
                return;
            }

            throw e;
        }

        this._processLabel.set_label(_("Extracting files into '${outputPath}'").replace(
            '${outputPath}', folder.get_basename()));

        const fullPathFile = Gio.File.new_for_path(fullPath);
        const extractor = GnomeAutoar.Extractor.new(fullPathFile, folder);
        extractor.set_output_is_dest(true);
        if (extractor.set_passphrase && (this._currentPassword !== null)) {
            extractor.set_passphrase(this._currentPassword);
        }

        this._removeTimer();
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._processBar.pulse();
            return true;
        });

        let progressTotal = -1;
        const progressID = extractor.connect('progress', (w, completedSize) => {
            this._removeTimer();

            if (progressTotal <= 0) {
                progressTotal = extractor.get_total_size();
            }

            if (progressTotal > 0) {
                this._processBar.set_fraction(completedSize / progressTotal);
            }
        });

        try {
            await this._autoAr.runToolAsync(extractor, this._cancellable);

            this._autoAr.notify(_('Extraction completed'),
                _("Extracting '${fullPathFile}' has been completed.").replace(
                    '${fullPathFile}', fullPathFile.get_basename()));
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                this._cancellable = new Gio.Cancellable();
                await this._cleanupFile(folder, this._cancellable);
                this._autoAr.notify(_('Extraction cancelled'),
                    _("Extracting '${fullPathFile}' has been cancelled by the user.").replace(
                        '${fullPathFile}', fullPathFile.get_basename()));
            } else {
                if ((e.code == GnomeAutoar.PASSPHRASE_REQUIRED_ERRNO) && (e.domain == GnomeAutoar.Extractor.quark())) {
                    this._waitingForPassword = true;
                    this._processBar.hide();
                    this._passEntry.show();
                    this._passOkButton.show();
                    this._passOkButton.set_receives_default(true);
                    const tmpfile = Gio.File.new_for_path(fullPath);
                    this._processLabel.set_label(_('Passphrase required for ${filename}').replace('${filename}', tmpfile.get_basename()));
                } else {
                    this._waitingForPassword = false;
                    this._autoAr.notify(_('Error during extraction'), e.message);
                }
                await this._cleanupFile(folder, this._cancellable);
            }
        } finally {
            this._removeTimer();
            extractor.disconnect(progressID);
            if (!this._waitingForPassword) {
                this._destroy();
            }
        }
        if (this._waitingForPassword) {
            const retval = await this._waitButtons();
            this._buttonPromiseAccept = null;
            this._waitingForPassword = false;
            if (retval) {
                await this.doExtractFile(fullPath, folder, folderName);
            }
        }
    }

    _waitButtons() {
        return new Promise(accept => {
            this._buttonPromiseAccept = accept;
        });
    }

    async doCompressFiles(fileList, outputFile, format, filter, password = null) {
        const output = Gio.File.new_for_path(outputFile);
        this._processLabel.set_label(_("Compressing files into '${outputFile}'").replace(
            '${outputFile}', output.get_basename()));
        const compressor = GnomeAutoar.Compressor.new(fileList, output, format, filter, false);
        compressor.set_output_is_dest(true);
        if (password) {
            compressor.set_passphrase(password);
        }

        const progressID = compressor.connect('progress', () => this._processBar.pulse());

        try {
            await this._autoAr.runToolAsync(compressor, this._cancellable);

            this._autoAr.notify(_('Compression completed'),
                _("Compressing files into '${outputFile}' has been completed.").replace(
                    '${outputFile}', output.get_basename()));
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                this._autoAr.notify(_('Cancelled compression'),
                    _("The output file '${outputFile}' already exists.").replace(
                        '${outputFile}', output.get_basename()));
            } else {
                this._cancellable = new Gio.Cancellable();
                await this._cleanupFile(output, this._cancellable);
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                    this._autoAr.notify(_('Cancelled compression'),
                        _("Compressing files into '${outputFile}' has been cancelled by the user.").replace(
                            '${outputFile}', output.get_basename()));
                } else {
                    this._autoAr.notify(_('Error during compression'), e.message);
                }
            }
        } finally {
            compressor.disconnect(progressID);
            this._destroy();
        }
    }

    _removeTimer() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
    }

    _destroy() {
        this._autoAr.disconnect(this._elementsChangedId);
        this._cancellable.cancel();
        this._container.destroy();
    }
};


const CompressDialog = class {
    constructor(desktopManager, fileList, destinationFolder) {
        this._fileList = [];
        for (let file of fileList) {
            this._fileList.push(file.file);
        }
        this._desktopManager = desktopManager;
        this._destinationFolder = destinationFolder;
        this._dialog = new Gtk.Dialog({
            title: _('Create archive'),
            resizable: false,
            modal: true,
            use_header_bar: true,
            default_width: 500,
            default_height: 210,
            window_position: Gtk.WindowPosition.CENTER_ALWAYS,
        });
        const container = this._dialog.get_content_area();
        container.orientation = Gtk.Orientation.VERTICAL;
        container.margin_top = 30;
        container.margin_bottom = 30;
        container.margin_start = 30;
        container.margin_end = 30;
        container.width_request = 390;
        container.halign = Gtk.Align.CENTER;
        container.spacing = 6;

        if (Prefs.nautilusCompression) {
            this._selectedType = Prefs.nautilusCompression.get_enum('default-compression-format');
        } else {
            this._selectedType = Enums.CompressionType.ZIP;
        }

        const archiveLabel = new Gtk.Label({
            label: `<b>${_('Archive name')}</b>`,
            xalign: 0,
            use_markup: true,
        });
        container.pack_start(archiveLabel, false, true, 0);
        const box1 = new Gtk.Box({
            spacing: 12,
            orientation: Gtk.Orientation.HORIZONTAL,
        });
        this._nameEntry = new Gtk.Entry({
            hexpand: true,
            width_chars: 30,
        });

        this._extensionDropdown = new Gtk.Button();
        const extensionContainer = new Gtk.Box({
            spacing: 2,
            orientation: Gtk.Orientation.HORIZONTAL,
        });
        this._extensionLabel = new Gtk.Label();
        this._extensionLock = new Gtk.Image({icon_name: 'dialog-password'});
        extensionContainer.pack_start(this._extensionLabel, false, false, 0);
        extensionContainer.pack_start(this._extensionLock, false, false, 5);
        this._extensionDropdown.add(extensionContainer);
        this._extensionPopover = new Gtk.Popover({
            relative_to: this._extensionDropdown,
            border_width: 8,
        });
        this._extensionPopoverContainer = new Gtk.Box({
            spacing: 4,
            orientation: Gtk.Orientation.VERTICAL,
        });
        this._extensionPopover.add(this._extensionPopoverContainer);

        this._passLabel = new Gtk.Label({
            label: _('Password'),
            margin_top: 6,
            xalign: 0,
        });
        this._passEntry = new Gtk.Entry({
            placeholder_text: _('Enter a password here'),
            input_purpose: Gtk.InputPurpose.PASSWORD,
            visibility: false,
            secondary_icon_name: 'view-conceal',
            secondary_icon_activatable: true,
            secondary_icon_sensitive: true,
        });

        container.pack_start(box1, false, true, 0);
        box1.pack_start(this._nameEntry, false, true, 0);
        box1.pack_start(this._extensionDropdown, false, false, 0);
        container.pack_start(this._passLabel, false, false, 0);
        container.pack_start(this._passEntry, false, false, 0);

        this._okButton = this._dialog.add_button(_('Create'), Gtk.ResponseType.ACCEPT);
        this._okButton.get_style_context().add_class('suggested-action');
        this._okButton.set_receives_default(true);
        this._cancelButton = this._dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        this._cancelButton.set_receives_default(true);
        this._fillComboBox();
        this._dialog.show_all();
        this._updateStatus();
        this._extensionDropdown.connect('clicked', () => {
            this._extensionPopoverContainer.show_all();
            this._extensionPopover.popup();
            for (let index in this._compressOptions) {
                const data = this._compressOptions[index];
                data.selected_icon.visible = index == this._selectedType;
            }
        });
        this._nameEntry.connect('changed', () => this._updateStatus());
        this._passEntry.connect('changed', () => this._updateStatus());
        this._nameEntry.connect('activate', () => this._entryActivated());
        this._passEntry.connect('activate', () => this._entryActivated());
        this._passEntry.connect('icon-release', () => {
            this._passEntry.visibility = !this._passEntry.visibility;
        });
        this._dialog.connect('response', (dialog, id) => {
            if (id === Gtk.ResponseType.ACCEPT) {
                const data = this._desktopManager.autoAr.getFormatAndFilterForExtension(this._compressOptions[this._selectedType].extension);
                const outputFile = GLib.build_filenamev([this._destinationFolder, this._nameEntry.get_text() + data.extension]);
                const password = this._passEntry.get_text();
                this._desktopManager.autoAr.compressFiles(this._fileList, outputFile, data.format, data.filter, password);
            }
            this._dialog.close();
        });
    }

    _entryActivated() {
        this._updateStatus();
        if (this._okButton.sensitive) {
            this._dialog.response(Gtk.ResponseType.ACCEPT);
        }
    }

    _updateStatus() {
        if (Prefs.nautilusCompression) {
            Prefs.nautilusCompression.set_enum('default-compression-format', this._selectedType);
        }
        const label = this._compressOptions[this._selectedType].extension;
        this._extensionLabel.label = label;
        this._extensionLock.visible = this._compressOptions[this._selectedType].password;
        const password = this._compressOptions[this._selectedType].password;
        const outputfile = this._nameEntry.get_text() + label;
        this._passLabel.visible = password;
        this._passEntry.visible = password;
        let context = this._nameEntry.get_style_context();
        this._okButton.sensitive = true;
        if (this._desktopManager._fileList.map(f => f.fileName).includes(outputfile)) {
            this._okButton.sensitive = false;
            if (!context.has_class('not-found')) {
                context.add_class('not-found');
            }
        } else if (context.has_class('not-found')) {
            context.remove_class('not-found');
        }
        if (password && (this._passEntry.get_text_length() == 0)) {
            this._okButton.sensitive = false;
        }
        if (this._nameEntry.get_text_length() == 0) {
            this._okButton.sensitive = false;
        }
    }

    _fillComboBox() {
        this._compressOptions = {};
        this._addComboEntry(Enums.CompressionType.ZIP, {
            extension: '.zip',
            id: 'zip',
            description: _('Compatible with all operating systems.'),
            password: false,
        });
        this._addComboEntry(Enums.CompressionType.ENCRYPTED_ZIP, {
            extension: '.zip',
            id: 'encryptedzip',
            description: _('Password protected .zip, must be installed on Windows and Mac.'),
            password: true,
        });
        this._addComboEntry(Enums.CompressionType.TAR_XZ, {
            extension: '.tar.xz',
            id: 'tar.xz',
            description: _('Smaller archives but Linux and Mac only.'),
            password: false,
        });
        this._addComboEntry(Enums.CompressionType.SEVEN_ZIP, {
            extension: '.7z',
            id: '7z',
            description: _('Smaller archives but must be installed on Windows and Mac.'),
            password: false,
        });
    }

    _addComboEntry(type, data) {
        this._compressOptions[type] = data;
        if (!this._desktopManager.autoAr.extensionIsAvailable(data.extension)) {
            return;
        }
        const container = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        const container2 = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        const container3 = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
        container3.pack_start(new Gtk.Label({
            label: data.extension,
            justify: Gtk.Justification.LEFT,
            xalign: 0,
        }),
        false,
        false,
        0);
        if (data.password) {
            container3.pack_start(new Gtk.Image({icon_name: 'dialog-password'}),
                false,
                false,
                5);
        }
        container.pack_start(container3, false, false, 0);
        container.pack_start(new Gtk.Label({
            label: data.description,
            justify: Gtk.Justification.LEFT,
            xalign: 0,
        }),
        false,
        false,
        0);
        const button = new Gtk.Button();
        container2.pack_start(container, true, true, 0);
        data.selected_icon = new Gtk.Image({icon_name: 'emblem-default'});
        container2.pack_start(data.selected_icon, false, false, 0);
        button.add(container2);
        this._extensionPopoverContainer.pack_start(button, false, true, 0);
        button.connect('clicked', () => {
            this._selectedType = type;
            this._extensionPopover.popdown();
            this._updateStatus();
        });
    }
};
