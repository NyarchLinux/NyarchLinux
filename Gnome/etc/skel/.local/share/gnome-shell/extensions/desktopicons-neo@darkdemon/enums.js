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

var ICON_SIZE = { 'tiny': 36, 'small': 48, 'standard': 64, 'large': 96 };
var ICON_WIDTH = { 'tiny': 70, 'small': 90, 'standard': 120, 'large': 130 };
//var ICON_HEIGHT = { 'tiny': 70, 'small': 90, 'standard': 106, 'large': 138 };
var ICON_HEIGHT = { 'tiny': 80, 'small': 90, 'standard': 106, 'large': 138 };

var START_CORNER = { 'top-left':     [false, false],
                     'top-right':    [true, false],
                     'bottom-left':  [false, true],
                     'bottom-right': [true, true]};

var FileType = {
    NONE: null,
    USER_DIRECTORY_HOME: 'show-home',
    USER_DIRECTORY_TRASH: 'show-trash',
    EXTERNAL_DRIVE: 'external-drive'
}

var StoredCoordinates = {
    PRESERVE: 0,
    OVERWRITE:1,
    ASSIGN:2,
};

var Selection = {
    ALONE: 0,
    WITH_SHIFT: 1,
    RIGHT_BUTTON: 2,
    ENTER: 3,
    LEAVE: 4,
    RELEASE: 5
};

/* From NautilusFileUndoManagerState */
var UndoStatus = {
    NONE: 0,
    UNDO: 1,
    REDO: 2,
};

var FileExistOperation = {
    ASK: 0,
    OVERWRITE: 1,
    RENAME: 2,
    SKIP: 3
};

var WhatToDoWithExecutable = {
    EXECUTE: 0,
    EXECUTE_IN_TERMINAL: 1,
    DISPLAY: 2,
    CANCEL: 3
};

var SortOrder = {
    ORDER: 'arrangeorder',
    NAME: 'name',
    DESCENDINGNAME: 'descendingname',
    MODIFIEDTIME: 'modifiedtime',
    KIND: 'kind',
    SIZE: 'size'
};

var DEFAULT_ATTRIBUTES = 'metadata::*,standard::*,access::*,time::modified,unix::mode';
var TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
var SCHEMA_NAUTILUS = 'org.gnome.nautilus.preferences';
var SCHEMA_GTK = 'org.gtk.Settings.FileChooser';
var SCHEMA = 'org.gnome.shell.extensions.desktopicons-neo';
var SCHEMA_MUTTER = 'org.gnome.mutter';
var EXEC_KEY = 'exec';
var NAUTILUS_SCRIPTS_DIR = '.local/share/nautilus/scripts';

var S_IXUSR = 0o00100;
var S_IWOTH = 0o00002;
