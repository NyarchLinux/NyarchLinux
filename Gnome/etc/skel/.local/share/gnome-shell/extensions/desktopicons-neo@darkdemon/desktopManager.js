/* LICENSE INFORMATION
 * 
 * Desktop Icons: Neo - A desktop icons extension for GNOME with numerous features, 
 * customizations, and optimizations.
 * 
 * Copyright 2021 Abdurahman Elmawi (cooper64doom@gmail.com)
 * 
 * This project is based on Desktop Icons NG (https://gitlab.com/rastersoft/desktop-icons-ng),
 * a desktop icons extension for GNOME licensed under the GPL v3.
 * 
 * This project is free and open source software as described in the GPL v3.
 * 
 * This project (Desktop Icons: Neo) is licensed under the GPL v3. To view the details of this license, 
 * visit https://www.gnu.org/licenses/gpl-3.0.html for the necessary information
 * regarding this project's license.
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;

const FileItem = imports.fileItem;
const DesktopGrid = imports.desktopGrid;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Prefs = imports.preferences;
const Enums = imports.enums;
const DBusUtils = imports.dbusUtils;
const AskNamePopup = imports.askNamePopup;
const AskRenamePopup = imports.askRenamePopup;
const ShowErrorPopup = imports.showErrorPopup;
const TemplateManager = imports.templateManager;

const Gettext = imports.gettext.domain('desktopicons-neo');

const _ = Gettext.gettext;

var DesktopManager = class {
    constructor(desktopList, codePath, asDesktop, primaryIndex) {

        DBusUtils.init();
        this._premultiplied = false;
        try {
            for (let f of Prefs.mutterSettings.get_strv('experimental-features')) {
                if (f == 'scale-monitor-framebuffer') {
                    this._premultiplied = true;
                    break;
                }
            }
        } catch(e) {
        }
        this._primaryIndex = primaryIndex;
        this._primaryScreen = desktopList[primaryIndex];
        this._clickX = 0;
        this._clickY = 0;
        this._dragList = null;
        this.dragItem = null;
        this._templateManager = new TemplateManager.TemplateManager();
        this._codePath = codePath;
        this._asDesktop = asDesktop;
        this._desktopList = desktopList;
        this._desktops = [];
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = true;
        this._scriptFilesChanged = false;
        this._desktopDir = DesktopIconsUtil.getDesktopDir();
        this._scriptsDir = DesktopIconsUtil.getScriptsDir();
        this.desktopFsId = this._desktopDir.query_info('id::filesystem', Gio.FileQueryInfoFlags.NONE, null).get_attribute_string('id::filesystem');
        this._updateWritableByOthers();
        try{
              this._monitorDesktopDir = this._desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        } catch(e){
              logError(e, "schemaSource errored out. Fixing desktop-directory..");
              Prefs.desktopSettings.set_string('desktop-directory', GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP));
              this._monitorDesktopDir = this._desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        }
        this._monitorDesktopDir.set_rate_limit(1000);
        this._monitorDesktopDir.connect('changed', (obj, file, otherFile, eventType) => this._updateDesktopIfChanged(file, otherFile, eventType));
        this._monitorScriptDir = this._scriptsDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorScriptDir.set_rate_limit(1000);
        this._monitorScriptDir.connect('changed', (obj, file, otherFile, eventType) => this._updateScriptFileList());
        this._showHidden = Prefs.gtkSettings.get_boolean('show-hidden');
        this._curvedCorners = Prefs.desktopSettings.get_boolean('curved-corners');
        this.showDropPlace = Prefs.desktopSettings.get_boolean('show-drop-place');
        this._settingsId = Prefs.desktopSettings.connect('changed', (obj, key) => {
            if (key == 'icon-size') {
                this._removeAllFilesFromGrids();
                this._createGrids();
            }
            if (key == Enums.SortOrder.ORDER) {
                this.doArrangeRadioButtons();
                this.doSorts();
                return;
            }
            this.showDropPlace = Prefs.desktopSettings.get_boolean('show-drop-place');
            this._updateDesktop();
        });
        Prefs.gtkSettings.connect('changed', (obj, key) => {
            if (key == 'show-hidden') {
                this._showHidden = Prefs.gtkSettings.get_boolean('show-hidden');
                this._updateDesktop();
            }
        });
        Prefs.desktopSettings.connect('changed', (obj, key) => {
            if (key == 'curved-corners') {
                this._curvedCorners = Prefs.desktopSettings.get_boolean('curved-corners');
                this._updateDesktop();
            }
        });
        Prefs.nautilusSettings.connect('changed', (obj, key) => {
            if (key == 'show-image-thumbnails') {
                this._updateDesktop();
            }
        });
        Prefs.gtkSettings.connect('changed', (obj, key) => {
            if (key == 'desktop-directory') {
                this._desktopDir = Prefs.gtkSettings.get_string('desktop-directory');
                this._updateDesktop();
            }
        });
        this._gtkIconTheme = Gtk.IconTheme.get_default()
        this._gtkIconTheme.connect('changed', () => {
            this._updateDesktop();
        });
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._volumeMonitor.connect('mount-added', () => { this._updateDesktop() });
        this._volumeMonitor.connect('mount-removed', () => { this._updateDesktop() });

        this.rubberBand = false;

        let cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_file(Gio.File.new_for_path(GLib.build_filenamev([codePath, "stylesheet.css"])));
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), cssProvider, 600);

        this._configureSelectionColor();
        this._createDesktopBackgroundMenu();
        this._createGrids();

        DBusUtils.NautilusFileOperations2Proxy.connect('g-properties-changed', this._undoStatusChanged.bind(this));
        DBusUtils.GtkVfsMetadataProxy.connectSignal('AttributeChanged', this._metadataChanged.bind(this));
        this._fileList = [];
        this._readFileList();

        this._scriptsList = [];
        this._readScriptFileList();

        this.decompressibleTypes = [];
        this.getExtractionSupportedTypes();

        // Check if Nautilus is available
        try {
            DesktopIconsUtil.trySpawn(null, ["nautilus", "--version"]);
        } catch(e) {
            this._errorWindow = new ShowErrorPopup.ShowErrorPopup(_("Nautilus File Manager not found"),
                                                                  _("The Nautilus File Manager is mandatory to work with Desktop Icons: Neo."),
                                                                  null,
                                                                  true);
        }
        this._pendingDropFiles = {};
        if (this._asDesktop) {
            this._sigtermID = GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
                GLib.source_remove(this._sigtermID);
                for(let desktop of this._desktops) {
                    desktop.destroy();
                }
                Gtk.main_quit();
                return false;
            });
        }
    }

    _metadataChanged(proxy, nameOwner, args) {
        let filepath = GLib.build_filenamev([GLib.get_home_dir(), args[1]]);
        if (this._desktopDir.get_path() == GLib.path_get_dirname(filepath)) {
            for(let file of this._fileList) {
                if (file.file.get_path() == filepath) {
                    file.updatedMetadata();
                    break;
                }
            }
        }
    }

    _createGrids() {
        for(let desktop of this._desktops) {
            desktop.destroy();
        }
        this._desktops = [];
        for(let desktopIndex in this._desktopList) {
            let desktop = this._desktopList[desktopIndex];
            if (this._asDesktop) {
                var desktopName = `@!${desktop.x},${desktop.y};BDHF`;
            } else {
                var desktopName = `Desktop Icons: Neo ${desktopIndex}`;
            }
            this._desktops.push(new DesktopGrid.DesktopGrid(this, desktopName, desktop, this._asDesktop, this._premultiplied));
        }
    }

    _configureSelectionColor() {
        this._contextWidget = new Gtk.WidgetPath();
        this._contextWidget.append_type(Gtk.Widget);

        this._styleContext = new Gtk.StyleContext();
        this._styleContext.set_path(this._contextWidget);
        this._styleContext.add_class('view');
        this._cssProviderSelection = new Gtk.CssProvider();
        this._styleContext.connect('changed', () => {
            Gtk.StyleContext.remove_provider_for_screen(Gdk.Screen.get_default(), this._cssProviderSelection);
            this._setSelectionColor();
        });
        this._setSelectionColor();
    }

    _setSelectionColor() {
        this.selectColor = this._styleContext.get_background_color(Gtk.StateFlags.SELECTED);
        let style = `.desktop-icons-selected {
            background-color: rgba(${this.selectColor.red * 255},${this.selectColor.green * 255}, ${this.selectColor.blue * 255}, 0.6);
        }`;
        this._cssProviderSelection.load_from_data(style);
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), this._cssProviderSelection, 600);
    }

    clearFileCoordinates(fileList, dropCoordinates) {
        for(let element of fileList) {
            let file = Gio.File.new_for_uri(element);
            if (!file.is_native() || !file.query_exists(null)) {
                if (dropCoordinates != null) {
                    this._pendingDropFiles[file.get_basename()] = dropCoordinates;
                }
                continue;
            }
            let info = new Gio.FileInfo();
            info.set_attribute_string('metadata::nautilus-icon-position', '');
            if (dropCoordinates != null) {
                info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
            }
            try {
                file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
            } catch(e) {}
        }
    }

    doMoveWithDragAndDrop(xOrigin, yOrigin, xDestination, yDestination) {
        if ( this.sortSpecialFolders && this.keepArranged ) {
            return;
        }
        // Find the grid where the destination lies
        for(let desktop of this._desktops) {
            let grid = desktop.getGridAt(xDestination, yDestination, true);
            if (grid !== null) {
                xDestination = grid[0];
                yDestination = grid[1];
                break;
            }
        }
        let deltaX = xDestination - xOrigin;
        let deltaY = yDestination - yOrigin;
        let fileItems = [];
        for(let item of this._fileList) {
            if (item.isSelected) {
                if (this.keepArranged) {
                    if (item.isSpecial) {
                        fileItems.push(item);
                        item.removeFromGrid();
                        let [x, y, a, b, c] = item.getCoordinates();
                        item.savedCoordinates = [x + deltaX, y + deltaY];
                    } else {
                        continue;
                    }
                } else {
                    fileItems.push(item);
                    item.removeFromGrid();
                    let [x, y, a, b, c] = item.getCoordinates();
                    item.savedCoordinates = [x + deltaX, y + deltaY];
                }
            }
        }
        // force to store the new coordinates
        this._addFilesToDesktop(fileItems, Enums.StoredCoordinates.OVERWRITE);
        if (this.keepArranged) {
            this._updateDesktop();
        }
    }

    onDragBegin(item) {
        this.dragItem = item;
    }

    onDragMotion(x, y) {
        if (this.dragItem === null) {
            for(let desktop of this._desktops) {
                desktop.refreshDrag([[0, 0]], x, y);
            }
            return;
        }
        if (this._dragList === null) {
            let itemList = this.getCurrentSelection(false);
            if (!itemList) {
                return;
            }
            let [x1, y1, x2, y2, c] = this.dragItem.getCoordinates();
            let oX = x1;
            let oY = y1;
            this._dragList = [];
            for (let item of itemList) {
                [x1, y1, x2, y2, c] = item.getCoordinates();
                this._dragList.push([x1 - oX, y1 - oY]);
            }
        }
        for(let desktop of this._desktops) {
            desktop.refreshDrag(this._dragList, x, y);
        }
    }

    onDragLeave() {
        this._dragList = null;
        for(let desktop of this._desktops) {
            desktop.refreshDrag(null, 0, 0);
        }
    }

    onDragEnd() {
        this.dragItem = null;
    }

    onDragDataReceived(xDestination, yDestination, selection, info) {
        this.onDragLeave();
        let fileList = DesktopIconsUtil.getFilesFromNautilusDnD(selection, info);
        switch(info) {
        case 0:
            if (fileList.length != 0) {
                let [xOrigin, yOrigin, a, b, c] = this.dragItem.getCoordinates();
                this.doMoveWithDragAndDrop(xOrigin, yOrigin, xDestination, yDestination);
            }
            break;
        case 1:
        case 2:
            if (fileList.length != 0) {
                this.clearFileCoordinates(fileList, [xDestination, yDestination]);
                let data = Gio.File.new_for_uri(fileList[0]).query_info('id::filesystem', Gio.FileQueryInfoFlags.NONE, null);
                let id_fs = data.get_attribute_string('id::filesystem');
                if (this.desktopFsId == id_fs) {
                    DBusUtils.NautilusFileOperations2Proxy.MoveURIsRemote(
                        fileList,
                        "file://" + GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP),
                        DBusUtils.NautilusFileOperations2Proxy.platformData(),
                        (result, error) => {
                            if (error)
                                throw new Error('Error moving files: ' + error.message);
                            }
                    );
                } else {
                    DBusUtils.NautilusFileOperations2Proxy.CopyURIsRemote(
                        fileList,
                        "file://" + GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP),
                        DBusUtils.NautilusFileOperations2Proxy.platformData(),
                        (result, error) => {
                            if (error)
                                throw new Error('Error moving files: ' + error.message);
                            }
                    );
                }
            }
            break;
        case 3:
            if (fileList.length != 0 ) {
                let dropCoordinates = [ xDestination, yDestination ];
                this.detectURLorText(fileList, dropCoordinates);
            }
            break;
        }
    }

    detectURLorText(fileList, dropCoordinates) {
        function isValidURL(str) {
            var pattern = new RegExp('^(https|http|ftp|rtsp|mms)?:\\/\\/?'+ 
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+
            '((\\d{1,3}\\.){3}\\d{1,3}))'+ 
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ 
            '(\\?[;&a-z\\d%_.~+=-]*)?'+ 
            '(\\#[-a-z\\d_]*)?$','i'); 
            return !!pattern.test(str);
        }
        let text = fileList.toString();
        if (isValidURL(text)) {
            this.writeURLlinktoDesktop(text, dropCoordinates);
        } else {
            let filename = "Dragged Text";
            let now = Date().valueOf().split(" ").join("").replace( /:/g , '-');
            filename = filename + "-" + now;
            DesktopIconsUtil.writeTextFileToDesktop(text, filename, dropCoordinates);
        }
    }

    writeURLlinktoDesktop(link, dropCoordinates) {
        let filename = link.split("?")[0];
        filename = filename.split("//")[1];
        filename = filename.split("/")[0] ;
        let now = Date().valueOf().split(" ").join("").replace( /:/g , '-' );
        filename = filename + "-" + now ;
        this.writeHTMLTypeLink(filename, link, dropCoordinates);
    }


    writeHTMLTypeLink(filename, link, dropCoordinates) {
        filename = filename + ".html";
        let body = [ '<html>', '<head>', '<meta http-equiv="refresh" content="0; url=' + link + '" />', '</head>', '<body>', '</body>', '</html>' ];
        body = body.join('\n');
        DesktopIconsUtil.writeTextFileToDesktop(body, filename, dropCoordinates);
    }

    fillDragDataGet(info) {
        let fileList = this.getCurrentSelection(false);
        if (fileList == null) {
            return null;
        }
        let atom;
        switch(info) {
            case 0:
                atom = Gdk.atom_intern('x-special/desktopicons-neo-icon-list', false);
                break;
            case 1:
                atom = Gdk.atom_intern('x-special/gnome-icon-list', false);
                break;
            case 2:
                atom = Gdk.atom_intern('text/uri-list', false);
                break;
            default:
                return null;
        }
        let data = "";
        for (let fileItem of fileList) {
            data += fileItem.uri;
            if (info == 1) {
                let coordinates = fileItem.getCoordinates();
                if (coordinates != null) {
                    data += `\r${coordinates[0]}:${coordinates[1]}:${coordinates[2] - coordinates[0] + 1}:${coordinates[3] - coordinates[1] + 1}`
                }
            }
            data += '\r\n';
        }
        return [atom, data];
    }

    onPressButton(x, y, event, grid) {

        this._clickX = Math.floor(x);
        this._clickY = Math.floor(y);
        let button = event.get_button()[1];
        let state = event.get_state()[1];
        if (button == 1) {
            let shiftPressed = !!(state & Gdk.ModifierType.SHIFT_MASK);
            let controlPressed = !!(state & Gdk.ModifierType.CONTROL_MASK);
            if (!shiftPressed && !controlPressed) {
                // clear selection
                for(let item of this._fileList) {
                    item.unsetSelected();
                }
            }
            this._startRubberband(x, y);
        }
        if (button == 3) {
            let templates = this._templateManager.getTemplates();
            if (templates.length == 0) {
                this._newDocumentItem.hide();
            } else {
                let templateMenu = new Gtk.Menu();
                this._newDocumentItem.set_submenu(templateMenu);
                for(let template of templates) {
                    let box = new Gtk.Box({"orientation":Gtk.Orientation.HORIZONTAL, "spacing": 6});
                    let icon = Gtk.Image.new_from_gicon(template["icon"], Gtk.IconSize.MENU);
                    let text = new Gtk.Label({"label": template["name"]});
                    box.add(icon);
                    box.add(text);
                    let entry = new Gtk.MenuItem({"label": template["name"]});
                    //entry.add(box);
                    templateMenu.add(entry);
                    entry.connect("activate", ()=>{
                        this._newDocument(template);
                    });
                }
                this._newDocumentItem.show_all();
            }
            this._syncUndoRedo();
            let atom = Gdk.Atom.intern('CLIPBOARD', false);
            let clipboard = Gtk.Clipboard.get(atom);
            clipboard.request_text((clipboard, text) => {
                let [valid, is_cut, files] = this._parseClipboardText(text);
                this._pasteMenuItem.set_sensitive(valid);
            });
            this._menu.popup_at_pointer(event);
        }
    }

    _syncUndoRedo() {
        switch (DBusUtils.NautilusFileOperations2Proxy.UndoStatus) {
            case Enums.UndoStatus.UNDO:
                this._undoMenuItem.show();
                this._redoMenuItem.hide();
                break;
            case Enums.UndoStatus.REDO:
                this._undoMenuItem.hide();
                this._redoMenuItem.show();
                break;
            default:
                this._undoMenuItem.hide();
                this._redoMenuItem.hide();
                break;
        }
    }

    _undoStatusChanged(proxy, properties, test) {
        if ('UndoStatus' in properties.deep_unpack())
            this._syncUndoRedo();
    }

    _doUndo() {
        DBusUtils.NautilusFileOperations2Proxy.UndoRemote(
            DBusUtils.NautilusFileOperations2Proxy.platformData(),
            (result, error) => {
                if (error)
                    throw new Error('Error performing undo: ' + error.message);
            }
        );
    }

    _doRedo() {
        DBusUtils.NautilusFileOperations2Proxy.RedoRemote(
            DBusUtils.NautilusFileOperations2Proxy.platformData(),
            (result, error) => {
                if (error)
                    throw new Error('Error performing redo: ' + error.message);
            }
        );
    }

    onKeyPress(event, grid) {
        let symbol = event.get_keyval()[1];
        let isCtrl = (event.get_state()[1] & Gdk.ModifierType.CONTROL_MASK) != 0;
        let isShift = (event.get_state()[1] & Gdk.ModifierType.SHIFT_MASK) != 0;
        let isAlt = (event.get_state()[1] & Gdk.ModifierType.MOD1_MASK) != 0;
        if (isCtrl && isShift && ((symbol == Gdk.KEY_Z) || (symbol == Gdk.KEY_z))) {
            this._doRedo();
            return true;
        } else if (isCtrl && ((symbol == Gdk.KEY_Z) || (symbol == Gdk.KEY_z))) {
            this._doUndo();
            return true;
        } else if (isCtrl && ((symbol == Gdk.KEY_C) || (symbol == Gdk.KEY_c))) {
            this.doCopy();
            return true;
        } else if (isCtrl && ((symbol == Gdk.KEY_X) || (symbol == Gdk.KEY_x))) {
            this.doCut();
            return true;
        } else if (isCtrl && ((symbol == Gdk.KEY_V) || (symbol == Gdk.KEY_v))) {
            this._doPaste();
            return true;
        } else if (isAlt && (symbol == Gdk.KEY_Return)) {
            let selection = this.getCurrentSelection(true);
            DBusUtils.FreeDesktopFileManagerProxy.ShowItemPropertiesRemote(selection, '',
                (result, error) => {
                    if (error)
                        log('Error showing properties: ' + error.message);
                    }
                );
            return true;
        } else if (symbol == Gdk.KEY_Return) {
            let selection = this.getCurrentSelection(false);
            if (selection && (selection.length == 1)) {
                selection[0].doOpen();
                return true;
            }
        } else if (symbol == Gdk.KEY_Delete) {
            if (isShift) {
                this.doDeletePermanently();
            } else {
                this.doTrash();
            }
            return true;
        } else if (symbol == Gdk.KEY_F2) {
            let selection = this.getCurrentSelection(false);
            if (selection && (selection.length == 1)) {
                // Support renaming other grids file items.
                this.doRename(selection[0]);
                return true;
            }
        } else if (symbol == Gdk.KEY_space) {
            let selection = this.getCurrentSelection(false);
            if (selection) {
                // Support renaming other grids file items.
                DBusUtils.GnomeNautilusPreviewProxy.ShowFileRemote(selection[0].uri, 0, true);
                return true;
            }
        } else if (isCtrl && ((symbol == Gdk.KEY_A) || (symbol == Gdk.KEY_a))) {
            this._selectAll();
            return true;
        } else if (symbol == Gdk.KEY_F5) {
            this._updateDesktop();
            return true;
        } else if (isCtrl && ((symbol == Gdk.KEY_H) || (symbol == Gdk.KEY_h))) {
            Prefs.gtkSettings.set_boolean('show-hidden', !this._showHidden);
            return true;
        }
        return false;
    }

    _createDesktopBackgroundMenu() {
        this._menu = new Gtk.Menu();
        let newFolder = new Gtk.MenuItem({label: _("New Folder")});
        newFolder.connect("activate", () => this._newFolder());
        this._menu.add(newFolder);

        this._newDocumentItem = new Gtk.MenuItem({label: _("New Document")});
        this._menu.add(this._newDocumentItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._pasteMenuItem = new Gtk.MenuItem({label: _("Paste")});
        this._pasteMenuItem.connect("activate", () => this._doPaste());
        this._menu.add(this._pasteMenuItem);

        this._undoMenuItem = new Gtk.MenuItem({label: _("Undo")});
        this._undoMenuItem.connect("activate", () => this._doUndo());
        this._menu.add(this._undoMenuItem);

        this._redoMenuItem = new Gtk.MenuItem({label: _("Redo")});
        this._redoMenuItem.connect("activate", () => this._doRedo());
        this._menu.add(this._redoMenuItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        let selectAll = new Gtk.MenuItem({label: _("Select all")});
        selectAll.connect("activate", () => this._selectAll());
        this._menu.add(selectAll);

        this._addSortingMenu();

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._showDesktopInFilesMenuItem = new Gtk.MenuItem({label: _("Show Desktop in Files")});
        this._showDesktopInFilesMenuItem.connect("activate", () => this._onOpenDesktopInFilesClicked());
        this._menu.add(this._showDesktopInFilesMenuItem);

        this._openTerminalMenuItem = new Gtk.MenuItem({label: _("Open in Terminal")});
        this._openTerminalMenuItem.connect("activate", () => this._onOpenTerminalClicked());
        this._menu.add(this._openTerminalMenuItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._changeBackgroundMenuItem = new Gtk.MenuItem({label: _("Change Background…")});
        this._changeBackgroundMenuItem.connect("activate", () => {
            let desktopFile = Gio.DesktopAppInfo.new('gnome-background-panel.desktop');
            desktopFile.launch([], null);
        });
        this._menu.add(this._changeBackgroundMenuItem);

        this._menu.add(new Gtk.SeparatorMenuItem());

        this._displaySettingsMenuItem = new Gtk.MenuItem({label: _("Display Settings")});
        this._displaySettingsMenuItem.connect("activate", () => {
            let desktopFile = Gio.DesktopAppInfo.new('gnome-display-panel.desktop');
            desktopFile.launch([], null);
        });
        this._menu.add(this._displaySettingsMenuItem);

        this._settingsMenuItem = new Gtk.MenuItem({label: _("Desktop Icons Settings")});
        this._settingsMenuItem.connect("activate", () => Prefs.showPreferences());
        this._menu.add(this._settingsMenuItem);
        this._menu.show_all();
    }

    _createScriptsMenu(Menu) {
        if ( this._scriptsList.length == 0 ) {
            return;
        }
        this._ScriptSubMenu = new Gtk.Menu();
        this._ScriptMenuItem = new Gtk.MenuItem({label: _("Scripts")});
        this._ScriptMenuItem.set_submenu(this._ScriptSubMenu);
        Menu.add(this._ScriptMenuItem);
        Menu.add(new Gtk.SeparatorMenuItem());
        for ( let fileItem of this._scriptsList ) {
            if ( fileItem[0].get_attribute_boolean('access::can-execute') ) {
                let menuItemName = fileItem[0].get_name();
                let menuItemPath = fileItem[1].get_path();
                let menuItem = new Gtk.MenuItem({label: _(`${menuItemName}`)});
                menuItem.connect("activate", () =>  this._onScriptClicked(menuItemPath));
                this._ScriptSubMenu.add(menuItem);
            }
        }
        this._ScriptSubMenu.show_all();
    }

    _selectAll() {
        for(let fileItem of this._fileList) {
            if (fileItem.isAllSelectable) {
                fileItem.setSelected();
            }
        }
    }

    _onOpenDesktopInFilesClicked() {
        Gio.AppInfo.launch_default_for_uri_async(this._desktopDir.get_uri(),
            null, null,
            (source, result) => {
                try {
                    Gio.AppInfo.launch_default_for_uri_finish(result);
                } catch (e) {
                   log('Error opening Desktop in Files: ' + e.message);
                }
            }
        );
    }

    _onOpenTerminalClicked() {
        let desktopPath = this._desktopDir.get_path();
        DesktopIconsUtil.launchTerminal(desktopPath, null);
    }

    _doPaste() {
        let atom = Gdk.Atom.intern('CLIPBOARD', false);
        let clipboard = Gtk.Clipboard.get(atom);
        clipboard.request_text((clipboard, text) => {
            let [valid, is_cut, files] = this._parseClipboardText(text);
            if (!valid) {
                return;
            }

            let desktopDir = this._desktopDir.get_uri();
            if (is_cut) {
                DBusUtils.NautilusFileOperations2Proxy.MoveURIsRemote(files, desktopDir,
                    DBusUtils.NautilusFileOperations2Proxy.platformData(),
                    (result, error) => {
                        if (error)
                            throw new Error('Error moving files: ' + error.message);
                    }
                );
            } else {
                DBusUtils.NautilusFileOperations2Proxy.CopyURIsRemote(files, desktopDir,
                    DBusUtils.NautilusFileOperations2Proxy.platformData(),
                    (result, error) => {
                        if (error)
                            throw new Error('Error copying files: ' + error.message);
                    }
                );
            }
        });
    }

    _parseClipboardText(text) {
        if (text === null)
            return [false, false, null];

        let lines = text.split('\n');
        let [mime, action, ...files] = lines;

        if (mime != 'x-special/nautilus-clipboard')
            return [false, false, null];

        if (!(['copy', 'cut'].includes(action)))
            return [false, false, null];
        let isCut = action == 'cut';

        /* Last line is empty due to the split */
        if (files.length <= 1)
            return [false, false, null];
        /* Remove last line */
        files.pop();

        return [true, isCut, files];
    }

    onMotion(x, y) {
        if (this.rubberBand) {
            this.mouseX = x;
            this.mouseY = y;
            this.x1 = Math.min(x, this.rubberBandInitX);
            this.x2 = Math.max(x, this.rubberBandInitX);
            this.y1 = Math.min(y, this.rubberBandInitY);
            this.y2 = Math.max(y, this.rubberBandInitY);
            this.selectionRectangle = new Gdk.Rectangle({'x':this.x1, 'y':this.y1, 'width':(this.x2-this.x1), 'height':(this.y2-this.y1)});
            for(let grid of this._desktops) {
                grid.queue_draw();
            }
            for(let item of this._fileList) {
                let labelintersect = item._labelRectangle.intersect(this.selectionRectangle)[0];
                let iconintersect = item._iconRectangle.intersect(this.selectionRectangle)[0];
                if (labelintersect || iconintersect) {
                    item.setSelected();
                    item.touchedByRubberband = true;
                } else {
                    if (item.touchedByRubberband) {
                        item.unsetSelected();
                    }
                }
            }
        }
        return false;
    }

    onReleaseButton(grid) {
        if (this.rubberBand) {
            this.rubberBand = false;
            this.selectionRectangle = null;
        }
        for(let grid of this._desktops) {
            grid.queue_draw();
        }
        return false;
    }

    _startRubberband(x, y) {
        this.rubberBandInitX = x;
        this.rubberBandInitY = y;
        this.rubberBand = true;
        for(let item of this._fileList) {
            item.touchedByRubberband = false;
        }
    }

    selected(fileItem, action) {
        switch(action) {
        case Enums.Selection.ALONE:
            if (!fileItem.isSelected) {
                for(let item of this._fileList) {
                    if (item === fileItem) {
                        item.setSelected();
                    } else {
                        item.unsetSelected();
                    }
                }
            }
            break;
        case Enums.Selection.WITH_SHIFT:
            fileItem.toggleSelected();
            break;
        case Enums.Selection.RIGHT_BUTTON:
            if (!fileItem.isSelected) {
                for(let item of this._fileList) {
                    if (item === fileItem) {
                        item.setSelected();
                    } else {
                        item.unsetSelected();
                    }
                }
            }
            break;
        case Enums.Selection.ENTER:
            if (this.rubberBand) {
                fileItem.setSelected();
            }
            break;
        case Enums.Selection.RELEASE:
            for(let item of this._fileList) {
                if (item === fileItem) {
                    item.setSelected();
                } else {
                    item.unsetSelected();
                }
            }
            break;
        }
    }

    _removeAllFilesFromGrids() {
        for(let fileItem of this._fileList) {
            fileItem.removeFromGrid();
        }
        this._fileList = [];
    }

    _updateScriptFileList() {
        if ( this._scriptsEnumerateCancellable ) {
            this._scriptFilesChanged = true;
            return;
        }
        this._readScriptFileList();
    }

    _readScriptFileList() {
        if (!this._scriptsDir.query_exists(null)) {
            this._scriptsList = [];
            return;
        }
        this._scriptFilesChanged = false;
        if (this._scriptsEnumerateCancellable) {
            this._scriptsEnumerateCancellable.cancel();
        }
        this._scriptsEnumerateCancellable = new Gio.Cancellable();
        this._scriptsDir.enumerate_children_async(
            Enums.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            this._scriptsEnumerateCancellable,
            (source, result) => {
                this._scriptsEnumerateCancellable = null;
                try {
                    if ( ! this._scriptFilesChanged ) {
                        let fileEnum = source.enumerate_children_finish(result);
                        let scriptsList = [];
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            scriptsList.push([info, fileEnum.get_child(info)]);
                        }
                        this._scriptsList = scriptsList.sort(
                            (a,b) => {
                                return a[0].get_name().localeCompare(b[0].get_name(),
                                { sensitivity: 'accent' , numeric: 'true', localeMatcher: 'lookup' });
                            }
                        );
                    } else {
                        this._readScriptFileList();
                    }
                } catch(e) {
                }
            }
        );
    }

    _readFileList() {
        this._readingDesktopFiles = true;
        this._desktopFilesChanged = false;
        if (this._desktopEnumerateCancellable)
            this._desktopEnumerateCancellable.cancel();

        this._desktopEnumerateCancellable = new Gio.Cancellable();
        this._desktopDir.enumerate_children_async(
            Enums.DEFAULT_ATTRIBUTES,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            this._desktopEnumerateCancellable,
            (source, result) => {
                try {
                    let fileEnum = source.enumerate_children_finish(result);
                    if (!this._desktopFilesChanged) {
                        let fileList = [];
                        // if no file changed while reading the desktop folder, the fileItems list if right
                        this._readingDesktopFiles = false;
                        for (let [newFolder, extras] of DesktopIconsUtil.getExtraFolders()) {
                            fileList.push(
                                new FileItem.FileItem(
                                    this,
                                    newFolder,
                                    newFolder.query_info(Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                    extras,
                                    this._codePath,
                                    null
                                )
                            );
                        }
                        let info;
                        while ((info = fileEnum.next_file(null))) {
                            let fileItem = new FileItem.FileItem(
                                this,
                                fileEnum.get_child(info),
                                info,
                                Enums.FileType.NONE,
                                this._codePath,
                                null
                            );
                            if (fileItem.isHidden && !this._showHidden) {
                                /* if there are hidden files in the desktop and the user doesn't want to
                                   show them, remove the coordinates. This ensures that if the user enables
                                   showing them, they won't fight with other icons for the same place
                                */
                                if (fileItem.savedCoordinates) {
                                    // only overwrite them if needed
                                    fileItem.savedCoordinates = null;
                                }
                                continue;
                            }
                            fileList.push(fileItem);
                            if (fileItem.dropCoordinates == null) {
                                let basename = fileItem.file.get_basename();
                                if (basename in this._pendingDropFiles) {
                                    fileItem.dropCoordinates = this._pendingDropFiles[basename];
                                    delete this._pendingDropFiles[basename];
                                }
                            }
                        }
                        for (let [newFolder, extras, volume] of DesktopIconsUtil.getMounts(this._volumeMonitor)) {
                            try {
                                fileList.push(
                                    new FileItem.FileItem(
                                        this,
                                        newFolder,
                                        newFolder.query_info(Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null),
                                        extras,
                                        this._codePath,
                                        volume
                                    )
                                );
                            } catch (e) {
                                print(`Failed with ${e} while adding volume ${newFolder}`);
                            }
                        }
                        this._removeAllFilesFromGrids();
                        this._fileList = fileList;
                        this.keepArranged = Prefs.desktopSettings.get_boolean('keep-arranged');
                        this.sortSpecialFolders = Prefs.desktopSettings.get_boolean('sort-special-folders');
                        if (this.keepArranged) {
                            this.doSorts();
                        } else {
                            this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
                        }
                    } else {
                        // But if there was a file change, we must re-read it to be sure that the list is complete
                        this._readFileList();
                    }
                } catch(e) {
                    GLib.idle_add(GLib.PRIORITY_LOW, () => {
                        this._readFileList();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
        );
    }

    _addFilesToDesktop(fileList, storeMode) {
        let outOfDesktops = [];
        let notAssignedYet = [];
        // First, add those icons that fit in the current desktops
        for(let fileItem of fileList) {
            if (fileItem.savedCoordinates == null) {
                notAssignedYet.push(fileItem);
                continue;
            }
            if (fileItem.dropCoordinates != null) {
                fileItem.dropCoordinates = null;
            }
            let [itemX, itemY] = fileItem.savedCoordinates;
            let addedToDesktop = false;
            for(let desktop of this._desktops) {
                if (desktop.getDistance(itemX, itemY) == 0) {
                    addedToDesktop = true;
                    desktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
                    break;
                }
            }
            if (!addedToDesktop) {
                outOfDesktops.push(fileItem);
            }
        }
        // Now, assign those icons that are outside the current desktops,
        // but have assigned coordinates
        for(let fileItem of outOfDesktops) {
            let minDistance = -1;
            let [itemX, itemY] = fileItem.savedCoordinates;
            let newDesktop = null;
            for (let desktop of this._desktops) {
                let distance = desktop.getDistance(itemX, itemY);
                if (distance == -1) {
                    continue;
                }
                if ((minDistance == -1) || (distance < minDistance)) {
                    minDistance = distance;
                    newDesktop = desktop;
                }
            }
            if (newDesktop == null) {
                print("Not enough space to add icons");
                break;
            } else {
                newDesktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
            }
        }
        // Finally, assign those icons that still don't have coordinates
        for (let fileItem of notAssignedYet) {
            let x, y;
            if (fileItem.dropCoordinates == null) {
                x = this._primaryScreen.x;
                y = this._primaryScreen.y;
                storeMode = Enums.StoredCoordinates.ASSIGN;
            } else {
                [x, y] = fileItem.dropCoordinates;
                fileItem.dropCoordinates = null;
                storeMode = Enums.StoredCoordinates.OVERWRITE;
            }
            // try first in the designated desktop
            let assigned = false;
            for (let desktop of this._desktops) {
                if (desktop.getDistance(x, y) == 0) {
                    desktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                    assigned = true;
                    break;
                }
            }
            if (assigned) {
                continue;
            }
            // if there is no space in the designated desktop, try in another
            for (let desktop of this._desktops) {
                if (desktop.getDistance(x, y) != -1) {
                    desktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                    break;
                }
            }
        }
    }

    _updateWritableByOthers() {
        let info = this._desktopDir.query_info(Gio.FILE_ATTRIBUTE_UNIX_MODE,
                                               Gio.FileQueryInfoFlags.NONE,
                                               null);
        this.unixMode = info.get_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE);
        let writableByOthers = (this.unixMode & Enums.S_IWOTH) != 0;
        if (writableByOthers != this.writableByOthers) {
            this.writableByOthers = writableByOthers;
            if (this.writableByOthers) {
                print(`desktop-icons: Desktop is writable by others - will not allow launching any desktop files`);
            }
            return true;
        } else {
            return false;
        }
    }

    _updateDesktop() {
        if (this._readingDesktopFiles) {
            // just notify that the files changed while being read from the disk.
            this._desktopFilesChanged = true;
        } else {
            this._readFileList();
        }
    }

    _updateDesktopIfChanged(file, otherFile, eventType) {
        if (eventType == Gio.FileMonitorEvent.CHANGED) {
            // use only CHANGES_DONE_HINT
            return;
        }
        if (!this._showHidden && (file.get_basename()[0] == '.')) {
            // If the file is not visible, we don't need to refresh the desktop
            // Unless it is a hidden file being renamed to visible
            if (!otherFile || (otherFile.get_basename()[0] == '.')) {
                return;
            }
        }
        if (this._readingDesktopFiles) {
            // just notify that the files changed while being read from the disk.
            this._desktopFilesChanged = true;
            return;
        }
        switch(eventType) {
            case Gio.FileMonitorEvent.MOVED_IN:
            case Gio.FileMonitorEvent.MOVED_CREATED:
                /* Remove the coordinates that could exist to avoid conflicts between
                   files that are already in the desktop and the new one
                 */
                try {
                    let info = new Gio.FileInfo();
                    info.set_attribute_string('metadata::nautilus-icon-position', '');
                    file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
                } catch (e) {} // can happen if a file is created and deleted very fast
                break;
            case Gio.FileMonitorEvent.ATTRIBUTE_CHANGED:
                /* The desktop is what changed, and not a file inside it */
                if (file.get_uri() == this._desktopDir.get_uri()) {
                    if (this._updateWritableByOthers()) {
                        this._readFileList();
                    }
                    return;
                }
                break;
        }
        this._readFileList();
    }

    _getClipboardText(isCopy) {
        let selection = this.getCurrentSelection(true);
        if (selection) {
            let atom = Gdk.Atom.intern('CLIPBOARD', false);
            let clipboard = Gtk.Clipboard.get(atom);
            let text = 'x-special/nautilus-clipboard\n' + (isCopy ? 'copy' : 'cut') + '\n';
            for (let item of selection) {
                text += item + '\n';
            }
            clipboard.set_text(text, -1);
        }
    }

    doCopy() {
        this._getClipboardText(true);
    }

    doCut() {
        this._getClipboardText(false);
    }

    doTrash() {
        const selection = this._fileList.filter(i => i.isSelected && !i.isSpecial).map(i =>
            i.file.get_uri());

        if (selection.length) {
            DBusUtils.NautilusFileOperations2Proxy.TrashURIsRemote(selection,
                DBusUtils.NautilusFileOperations2Proxy.platformData(),
                (source, error) => {
                    if (error)
                        throw new Error('Error trashing files on the desktop: ' + error.message);
                }
            );
        }
    }

    doDeletePermanently() {
        const toDelete = this._fileList.filter(i => i.isSelected && !i.isSpecial).map(i =>
            i.file.get_uri());

        if (!toDelete.length) {
            if (this._fileList.some(i => i.isSelected && i.isTrash))
                this.doEmptyTrash();
            return;
        }

        DBusUtils.NautilusFileOperations2Proxy.DeleteURIsRemote(toDelete,
            DBusUtils.NautilusFileOperations2Proxy.platformData(),
            (_source, error) => {
                if (error)
                    throw new Error('Error deleting files on the desktop: ' + error.message);
            });
    }

    doEmptyTrash(askConfirmation = true) {
        DBusUtils.NautilusFileOperations2Proxy.EmptyTrashRemote(
            askConfirmation,
            DBusUtils.NautilusFileOperations2Proxy.platformData(),
            (source, error) => {
                if (error)
                    throw new Error('Error trashing files on the desktop: ' + error.message);
        });
    }

    checkIfSpecialFilesAreSelected() {
        for(let item of this._fileList) {
            if (item.isSelected && item.isSpecial) {
                return true;
            }
        }
        return false;
    }

    checkIfDirectoryIsSelected() {
        for(let item of this._fileList) {
            if (item.isSelected && item.isDirectory) {
                return true;
            }
        }
        return false;
    }

    getCurrentSelection(getUri) {
        let listToTrash = [];
        for(let fileItem of this._fileList) {
            if (fileItem.isSelected) {
                if (getUri) {
                    listToTrash.push(fileItem.file.get_uri());
                } else {
                    listToTrash.push(fileItem);
                }
            }
        }
        if (listToTrash.length != 0) {
            return listToTrash;
        } else {
            return null;
        }
    }

    getExtractable() {
        for (let item of this._fileList) {
            if (item.isSelected) {
                return this.decompressibleTypes.includes(item._attributeContentType);
            }
        }
    }

    getNumberOfSelectedItems() {
        let count = 0;
        for(let item of this._fileList) {
            if (item.isSelected) {
                count++;
            }
        }
        return count;
    }

    doRename(fileItem) {
        for(let fileItem2 of this._fileList) {
            fileItem2.unsetSelected();
        }
        this._renameWindow = new AskRenamePopup.AskRenamePopup(fileItem);
    }

    doOpenWith() {
        let fileItems = this.getCurrentSelection(false);
        if (fileItems) {
            let mimetype = Gio.content_type_guess(fileItems[0].fileName, null)[0];
            let chooser = Gtk.AppChooserDialog.new_for_content_type(null,
                                                                    Gtk.DialogFlags.MODAL + Gtk.DialogFlags.USE_HEADER_BAR,
                                                                    mimetype);
            chooser.show_all();
            let retval = chooser.run();
            chooser.hide();
            if (retval == Gtk.ResponseType.OK) {
                let appInfo = chooser.get_app_info();
                if (appInfo) {
                    let fileList = [];
                    for (let item of fileItems) {
                        fileList.push(item.file);
                    }
                    appInfo.launch(fileList, null);
                }
            }

        }
    }

    _newFolder(position) {
        let X;
        let Y;
        if (position) {
            [X, Y] = position;
        } else {
            [X, Y] = [this._clickX, this._clickY];
        }
        for(let fileItem of this._fileList) {
            fileItem.unsetSelected();
        }
        let newFolderWindow = new AskNamePopup.AskNamePopup(null, _("New folder"), null);
        let newName = newFolderWindow.run();
        if (newName) {
            let dir = DesktopIconsUtil.getDesktopDir().get_child(newName);
            try {
                dir.make_directory(null);
                let info = new Gio.FileInfo();
                info.set_attribute_string('metadata::nautilus-drop-position', `${X},${Y}`);
                info.set_attribute_string('metadata::nautilus-icon-position', '');
                dir.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
                if (position) {
                    return dir.get_uri();
                }
            } catch(e) {
                print(`Failed to create folder ${e.message}`);
            }
        }
    }

    _newDocument(template) {
        let file = this._templateManager.getTemplateFile(template["file"]);
        if (file == null) {
            return;
        }
        let counter = 0;
        let finalName = `${template["name"]}${template["extension"]}`;
        let destination;
        do {
            if (counter != 0) {
                finalName = `${template["name"]} ${counter}${template["extension"]}`
            }
            destination = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP), finalName]));
            counter++;
        } while(destination.query_exists(null));
        try {
            file.copy(destination, Gio.FileCopyFlags.NONE, null, null);
            let info = new Gio.FileInfo();
            info.set_attribute_string('metadata::nautilus-drop-position', `${this._clickX},${this._clickY}`);
            info.set_attribute_string('metadata::nautilus-icon-position', '');
            destination.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        } catch(e) {
            print(`Failed to create template ${e.message}`);
        }
    }

    _onScriptClicked(menuItemPath) {
        let pathList = [];
        let uriList = [];
        for ( let item of this._fileList ) {
            if ( item.isSelected &&  ! item.isSpecial ) {
                pathList.push(`'` + item.file.get_path() + `\n'`);
                uriList.push(`'` + item.file.get_uri() + `\n'`);
            }
        }
        pathList = pathList.join("");
        uriList = uriList.join("");
        let deskTop = `'` + DesktopIconsUtil.getDesktopDir().get_uri() + `'`;
        let execline = `/bin/bash -c "`;
        execline += `NAUTILUS_SCRIPT_SELECTED_FILE_PATHS=${pathList} `;
        execline += `NAUTILUS_SCRIPT_SELECTED_URIS=${uriList} `;
        execline += `NAUTILUS_SCRIPT_CURRENT_URI=${deskTop} `;
        execline += `'${menuItemPath}'"`;
        DesktopIconsUtil.spawnCommandLine(execline);
    }

    doMultiOpen() {
        let openFileListItems = this.getCurrentSelection();
        for ( let fileItem of openFileListItems ) {
            fileItem.unsetSelected();
            fileItem.doOpen() ;
        }
    }

    mailFilesFromSelection() {
        if (this.checkIfDirectoryIsSelected()) {
            let WindowError = new ShowErrorPopup.ShowErrorPopup(_("Can not email a Directory"),
                                                                _("Selection includes a Directory, compress the directory to a file first."),
                                                                null,
                                                                false);
            WindowError.run();
            return;
        }
        let xdgEmailCommand = [];
        xdgEmailCommand.push('xdg-email')
        for (let fileItem of this._fileList) {
            if (fileItem.isSelected) {
                fileItem.unsetSelected;
                xdgEmailCommand.push('--attach');
                xdgEmailCommand.push(fileItem.file.get_path());
            }
        }
        DesktopIconsUtil.trySpawn(null, xdgEmailCommand);
    }

    _addSortingMenu() {
        this._menu.add(new Gtk.SeparatorMenuItem());

        this._cleanUpMenuItem = new Gtk.MenuItem({label: _("Arrange Icons")});
        this._cleanUpMenuItem.connect("activate", () => this._sortAllFilesFromGridsByPosition());
        this._menu.add(this._cleanUpMenuItem);

        this._ArrangeByMenuItem = new Gtk.MenuItem({label: _("Arrange By...")});
        this._menu.add(this._ArrangeByMenuItem);
        this._addSortingSubMenu();
    }

    _addSortingSubMenu() {
        this._arrangeSubMenu = new Gtk.Menu();
        this._ArrangeByMenuItem.set_submenu(this._arrangeSubMenu);

        this._keepArrangedMenuItem = new Gtk.CheckMenuItem({label: _("Keep Arranged...")});
        Prefs.desktopSettings.bind('keep-arranged', this._keepArrangedMenuItem, 'active', 3);
        this._keepArrangedMenuItem.bind_property('active', this._cleanUpMenuItem, 'sensitive', 6);
        this._arrangeSubMenu.add(this._keepArrangedMenuItem);

        this._sortSpecialFilesMenuItem = new Gtk.CheckMenuItem({label: _("Sort Home/Drives/Trash...")});
        Prefs.desktopSettings.bind('sort-special-folders', this._sortSpecialFilesMenuItem, 'active', 3);
        this._arrangeSubMenu.add(this._sortSpecialFilesMenuItem);

        this._arrangeSubMenu.add(new Gtk.SeparatorMenuItem());

        this._radioName = new Gtk.RadioMenuItem({label: _("Sort by Name")});
        this._arrangeSubMenu.add(this._radioName);
        this._radioDescName = new Gtk.RadioMenuItem({label: _("Sort by Name Descending")});
        this._radioDescName.join_group(this._radioName);
        this._arrangeSubMenu.add (this._radioDescName);
        this._radioTimeName = new Gtk.RadioMenuItem({label: _("Sort by Modified Time")});
        this._radioTimeName.join_group(this._radioName);
        this._arrangeSubMenu.add (this._radioTimeName);
        this._radioKindName = new Gtk.RadioMenuItem({label: _("Sort by Type")});
        this._radioKindName.join_group(this._radioName);
        this._arrangeSubMenu.add (this._radioKindName);
        this._radioSizeName = new Gtk.RadioMenuItem({label: _("Sort by Size")});
        this._radioSizeName.join_group(this._radioName);
        this._arrangeSubMenu.add (this._radioSizeName);
        this.doArrangeRadioButtons();
        this._radioName.connect("activate", () => {this.setIfActive(this._radioName, Enums.SortOrder.NAME)});
        this._radioDescName.connect("activate", () => {this.setIfActive(this._radioDescName, Enums.SortOrder.DESCENDINGNAME)});
        this._radioTimeName.connect("activate", () => {this.setIfActive(this._radioTimeName, Enums.SortOrder.MODIFIEDTIME)});
        this._radioKindName.connect("activate", () => {this.setIfActive(this._radioKindName, Enums.SortOrder.KIND)});
        this._radioSizeName.connect("activate", () => {this.setIfActive(this._radioSizeName, Enums.SortOrder.SIZE)});
        this._arrangeSubMenu.show_all();
    }

    setIfActive(buttonname, choice) {
        if(buttonname.get_active()) {
            Prefs.setSortOrder(choice);
        }
    }

    _sortByName(fileList) {
        function byName(a, b) {
            //sort by label name instead of the the fileName or displayName so that the "Home" folder is sorted in the correct order
            //alphabetical sort taking into account accent characters & locale, natural language sort for numbers, ie 10.etc before 2.etc
            //other options for locale are best fit, or by specifying directly in function below for translators
            return a._label.get_text().localeCompare(b._label.get_text(), { sensitivity: 'accent' , numeric: 'true', localeMatcher: 'lookup' } );
        }
        fileList.sort(byName);
    }

    _sortByKindByName(fileList) {
        function byKindByName(a, b) {
            return a._attributeContentType.localeCompare(b._attributeContentType) ||
             a._label.get_text().localeCompare(b._label.get_text(), { sensitivity: 'accent' , numeric: 'true', localeMatcher: 'lookup' } );
        }
        fileList.sort(byKindByName);
    }

    _sortAllFilesFromGridsByName(order) {
        this._sortByName(this._fileList)
        if ( order == Enums.SortOrder.DESCENDINGNAME ) {
            this._fileList.reverse();
        }
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByPosition() {
        if (this.keepArranged) {
            return;
        }
        let cornerInversion = Prefs.get_start_corner();
        if (!cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {   if (a._x1 < b._x1) return -1;
                                                if (a._x1 > b._x1) return 1;
                                                if (a._y1 < b._y1) return -1;
                                                if (a._y1 > b._y1) return 1;
                                                return 0;
                                            });
        }
        if (cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {   if (a._x1 < b._x1) return 1;
                                                if (a._x1 > b._x1) return -1;
                                                if (a._y1 < b._y1) return 1;
                                                if (a._y1 > b._y1) return -1;
                                                return 0;
                                            });
        }
        if (cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {   if (a._x1 < b._x1) return 1;
                                                if (a._x1 > b._x1) return -1;
                                                if (a._y1 < b._y1) return -1;
                                                if (a._y1 > b._y1) return 1;
                                                return 0;
                                            });
        }
        if (!cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {   if (a._x1 < b._x1) return -1;
                                                if (a._x1 > b._x1) return 1;
                                                if (a._y1 < b._y1) return 1;
                                                if (a._y1 > b._y1) return -1;
                                                return 0;
                                            });
        }
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByModifiedTime() {
        function byTime(a, b) {
            return ( a._modifiedTime - b._modifiedTime )
        }
        this._fileList.sort(byTime);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsBySize() {
        function bySize(a, b) {
            return ( a.fileSize - b.fileSize );
        }
        this._fileList.sort(bySize);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByKind() {
        let specialFiles = [];
        let directoryFiles = [];
        let validDesktopFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for(let fileItem of this._fileList) {
            if (fileItem._isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (fileItem._isDirectory) {
                directoryFiles.push(fileItem);
                continue;
            }
            if (fileItem._isValidDesktopFile) {
                validDesktopFiles.push(fileItem);
                continue;
            } else {
                otherFiles.push(fileItem);
                continue;
            }
        }
        this._sortByName(specialFiles);
        this._sortByName(directoryFiles);
        this._sortByName(validDesktopFiles);
        this._sortByKindByName(otherFiles);
        newFileList.push(...specialFiles);
        newFileList.push(...validDesktopFiles);
        newFileList.push(...directoryFiles);
        newFileList.push(...otherFiles)
        if ( this._fileList.length == newFileList.length) {
            this._fileList = newFileList ;
        }
        this._reassignFilesToDesktop();
    }

    _reassignFilesToDesktop() {
        if ( ! this.sortSpecialFolders) {
            this._reassignFilesToDesktopPreserveSpecialFiles();
            return;
        }
        for(let fileItem of this._fileList){
            fileItem.savedCoordinates = null;
            fileItem.dropCoordinates = null;
            fileItem.removeFromGrid();
        }
        this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.ASSIGN);
    }

    _reassignFilesToDesktopPreserveSpecialFiles() {
        let specialFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for(let fileItem of this._fileList){
            if ( fileItem._isSpecial) {
                specialFiles.push(fileItem);
                fileItem.removeFromGrid();
                continue;
            }
            if (! fileItem._isSpecial) {
                otherFiles.push(fileItem);
                fileItem.savedCoordinates = null;
                fileItem.dropCoordinates = null;
                fileItem.removeFromGrid();
                continue;
            }
        }
        newFileList.push(...specialFiles);
        newFileList.push(...otherFiles);
        if ( this._fileList.length == newFileList.length) {
            this._fileList = newFileList ;
        }
        this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
    }

    doNewFolderFromSelection(position) {
        let newFolderFileItems = this.getCurrentSelection(true);
        for (let fileItem of this._fileList) {
           fileItem.unsetSelected();
        }
        let newFolder = this._newFolder(position);
        if (newFolder) {
            DBusUtils.NautilusFileOperations2Proxy.MoveURIsRemote(
                newFolderFileItems, newFolder,
                DBusUtils.NautilusFileOperations2Proxy.platformData(),
                (result, error) => {
                    if (error) {
                        throw new Error('Error moving files: ' + error.message);
                    }
                }
            );
        }
    }

    doCompressFilesFromSelection() {
        let compressFileItems = this.getCurrentSelection(true);
        for (let fileItem of this._fileList) {
            fileItem.unsetSelected();
        }
        let desktopFolder = this._desktopDir.get_uri();
        if (desktopFolder) {
            DBusUtils.GnomeArchiveManagerProxy.CompressRemote(compressFileItems, desktopFolder, true,
                (result, error) => {
                    if (error) {
                        throw new Error('Error compressing files: ' + error.message);
                    }
                }
            );
        }
    }

    extractFileFromSelection(extracthere) {
        let extractFileItem = '';
        let folder = ''
        for ( let fileItem of this._fileList) {
            if (fileItem.isSelected) {
                extractFileItem = fileItem.file.get_uri();
                fileItem.unsetSelected();
            }
        }
        if (extracthere) {
            folder = this._desktopDir.get_uri();
        } else {
            let dialog = new Gtk.FileChooserDialog({title: _('Select Extract Destination')});
            dialog.set_action(Gtk.FileChooserAction.SELECT_FOLDER);
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
            DesktopIconsUtil.windowHidePagerTaskbarModal(dialog, true);
            let response = dialog.run();
            if (response === Gtk.ResponseType.ACCEPT) {
                folder = dialog.get_uri();
            }
            dialog.destroy();
        }
        if (folder) {
            DBusUtils.GnomeArchiveManagerProxy.ExtractRemote(extractFileItem, folder, true,
                (result, error) => {
                    if (error) {
                        throw new Error('Error extracting files: ' + error.message);
                    }
                }
            );
        }
    }

    getExtractionSupportedTypes() {
        DBusUtils.GnomeArchiveManagerProxy.GetSupportedTypesRemote('extract',
            (result, error) => {
                if (error) {
                    throw new Error('Error getting extractable Types' + error.message);
                }
                for ( let key of result.values()) {
                    for (let type of key.values()) {
                        this.decompressibleTypes.push(Object.values(type)[0]);
                    }
                }
            }
        );
    }
    
    doArrangeRadioButtons() {
        switch(Prefs.getSortOrder()) {
                case Enums.SortOrder.NAME:
                    this._radioName.set_active(true);
                    break;
                case Enums.SortOrder.DESCENDINGNAME:
                    this._radioDescName.set_active(true);
                    break;
                case Enums.SortOrder.MODIFIEDTIME:
                    this._radioTimeName.set_active(true);
                    break;
                case Enums.SortOrder.KIND:
                    this._radioKindName.set_active(true);
                    break;
                case Enums.SortOrder.SIZE:
                    this._radioSizeName.set_active(true);
                    break;
                default:
                    this._radioName.set_active(true);
                    Prefs.setSortOrder(Enums.SortOrder.NAME);
                    break;
        }
    }

    doSorts() {
        switch (Prefs.getSortOrder()) {
            case Enums.SortOrder.NAME:
                this._sortAllFilesFromGridsByName();
                break;
            case Enums.SortOrder.DESCENDINGNAME:
                this._sortAllFilesFromGridsByName(Enums.SortOrder.DESCENDINGNAME);
                break;
            case Enums.SortOrder.MODIFIEDTIME:
                this._sortAllFilesFromGridsByModifiedTime();
                break;
            case Enums.SortOrder.KIND:
                this._sortAllFilesFromGridsByKind();
                break;
            case Enums.SortOrder.SIZE:
                this._sortAllFilesFromGridsBySize();
                break;
            default:
                this._addFilesToDesktop(this._fileList, Enums.StoredCoordinates.PRESERVE);
                break;
        }
    }
}
