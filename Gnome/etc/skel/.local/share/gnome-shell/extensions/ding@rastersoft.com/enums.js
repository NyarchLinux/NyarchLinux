/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
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
var ICON_SIZE = {'tiny': 36, 'small': 48, 'standard': 64, 'large': 96};
var ICON_WIDTH = {'tiny': 70, 'small': 90, 'standard': 120, 'large': 130};
var ICON_HEIGHT = {'tiny': 80, 'small': 90, 'standard': 106, 'large': 138};

var START_CORNER = {
    'top-left': [false, false],
    'top-right': [true, false],
    'bottom-left': [false, true],
    'bottom-right': [true, true],
};

var FileType = {
    NONE: null,
    USER_DIRECTORY_HOME: 'show-home',
    USER_DIRECTORY_TRASH: 'show-trash',
    EXTERNAL_DRIVE: 'external-drive',
    STACK_TOP: 'stack-top',
};

var StoredCoordinates = {
    PRESERVE: 0,
    OVERWRITE: 1,
    ASSIGN: 2,
};

var Selection = {
    ALONE: 0,
    WITH_SHIFT: 1,
    RIGHT_BUTTON: 2,
    ENTER: 3,
    LEAVE: 4,
    RELEASE: 5,
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
    SKIP: 3,
};

var WhatToDoWithExecutable = {
    EXECUTE: 0,
    EXECUTE_IN_TERMINAL: 1,
    DISPLAY: 2,
    CANCEL: 3,
};

var SortOrder = {
    ORDER: 'arrangeorder',
    NAME: 'name',
    DESCENDINGNAME: 'descendingname',
    MODIFIEDTIME: 'modifiedtime',
    KIND: 'kind',
    SIZE: 'size',
};

var CompressionType = {
    ZIP: 0,
    TAR_XZ: 1,
    SEVEN_ZIP: 2,
    ENCRYPTED_ZIP: 3,
};

var DndTargetInfo = {
    DING_ICON_LIST: 0,
    GNOME_ICON_LIST: 1,
    URI_LIST: 2,
    TEXT_PLAIN: 3,
};

var DEFAULT_ATTRIBUTES = 'metadata::*,standard::*,access::*,time::modified,unix::mode';
var TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
var SCHEMA_NAUTILUS = 'org.gnome.nautilus.preferences';
var SCHEMA_NAUTILUS_COMPRESSION = 'org.gnome.nautilus.compression';
var SCHEMA_GTK = 'org.gtk.Settings.FileChooser';
var SCHEMA = 'org.gnome.shell.extensions.ding';
var SCHEMA_MUTTER = 'org.gnome.mutter';
var EXEC_KEY = 'exec';
var NAUTILUS_SCRIPTS_DIR = '.local/share/nautilus/scripts';
var SCHEMA_DARK_SETTINGS = 'org.gnome.desktop.interface';

var S_IXUSR = 0o00100;
var S_IWOTH = 0o00002;
