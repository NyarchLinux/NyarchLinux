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
// SPDX-License-Identifier: GPL-3.0-only
'use strict';
export var ICON_SIZE = {'tiny': 36, 'small': 48, 'standard': 64, 'large': 96};
export var ICON_WIDTH = {'tiny': 70, 'small': 90, 'standard': 120, 'large': 130};
export var ICON_HEIGHT = {'tiny': 80, 'small': 90, 'standard': 106, 'large': 138};

export var START_CORNER = {
    'top-left': [false, false],
    'top-right': [true, false],
    'bottom-left': [false, true],
    'bottom-right': [true, true],
};

export var FileType = {
    NONE: null,
    USER_DIRECTORY_HOME: 'show-home',
    USER_DIRECTORY_TRASH: 'show-trash',
    EXTERNAL_DRIVE: 'external-drive',
    STACK_TOP: 'stack-top',
};

export var StoredCoordinates = {
    PRESERVE: 0,
    OVERWRITE: 1,
    ASSIGN: 2,
};

export var Selection = {
    ALONE: 0,
    WITH_SHIFT: 1,
    RIGHT_BUTTON: 2,
    ENTER: 3,
    LEAVE: 4,
    RELEASE: 5,
};

export var DBusBus = {
    SYSTEM: true,
    SESSION: false,
};

/* From NautilusFileUndoManagerState */
export var UndoStatus = {
    NONE: 0,
    UNDO: 1,
    REDO: 2,
};

export var FileExistOperation = {
    ASK: 0,
    OVERWRITE: 1,
    RENAME: 2,
    SKIP: 3,
};

export var WhatToDoWithExecutable = {
    EXECUTE: 0,
    EXECUTE_IN_TERMINAL: 1,
    DISPLAY: 2,
    CANCEL: 3,
};

export var SortOrder = {
    ORDER: 'arrangeorder',
    NAME: 'name',
    DESCENDINGNAME: 'descendingname',
    MODIFIEDTIME: 'modifiedtime',
    KIND: 'kind',
    SIZE: 'size',
};

export var CompressionType = {
    ZIP: 0,
    TAR_XZ: 1,
    SEVEN_ZIP: 2,
    ENCRYPTED_ZIP: 3,
};

export var EmblemPosition = {
    TOP_LEFT: 0,
    BOTTOM_RIGHT: 1,
};

export var DndTargetInfo = {
    DING_ICON_LIST: 'x-special/ding-icon-list',
    GNOME_ICON_LIST: 'x-special/gnome-icon-list',
    URI_LIST: 'text/uri-list',
    TEXT_PLAIN: 'text/plain',
    TEXT_PLAIN_UTF8: 'text/plain;charset=utf-8',
    GNOME_CLIPBOARD: 'x-special/gnome-copied-files',
};

export var MIME_TYPES = [DndTargetInfo.DING_ICON_LIST,
    DndTargetInfo.GNOME_ICON_LIST,
    DndTargetInfo.URI_LIST,
    DndTargetInfo.TEXT_PLAIN_UTF8,
    DndTargetInfo.TEXT_PLAIN];

export var DEFAULT_ATTRIBUTES = 'metadata::*,standard::*,access::*,time::modified,unix::mode';
export var TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
export var SCHEMA_NAUTILUS = 'org.gnome.nautilus.preferences';
export var SCHEMA_NAUTILUS_COMPRESSION = 'org.gnome.nautilus.compression';
export var SCHEMA_A11Y_KEYBOARD = 'org.gnome.desktop.a11y.keyboard';
export var SCHEMA_A11Y_APPLICATIONS = 'org.gnome.desktop.a11y.applications';
export var SCHEMA_GTK = 'org.gtk.Settings.FileChooser';
export var SCHEMA = 'org.gnome.shell.extensions.ding';
export var SCHEMA_MUTTER = 'org.gnome.mutter';
export var EXEC_KEY = 'exec';
export var NAUTILUS_SCRIPTS_DIR = '.local/share/nautilus/scripts';

export var S_IXUSR = 0o00111;
export var S_IWOTH = 0o00002;
