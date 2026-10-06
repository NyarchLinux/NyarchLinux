/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2025 Sergio Costas <rastersoft@gmail.com>
 * Some pieces Copyright (C) Sundeep Mediratta (smedius@gmail.com)
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
import * as Enums from './enums.js';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import * as FileUtils from './fileUtils.js';

// Prepares a file list for cut or copy
/**
 *
 * @param {string} action
 */
export function manageCutCopy(action) {
    const uriList = fillDragDataGet(Enums.DndTargetInfo.URI_LIST, action.fileList);
    if (!uriList?.length)
        return;

    const clipboard = Gdk.Display.get_default().get_clipboard();
    const textCoder = new TextEncoder();

    let content = action.copy ? 'copy\n' : 'cut\n';
    content += uriList?.replaceAll('\r', '').trim();
    const encodedUriList = textCoder.encode(uriList);

    const gnomeContentProvider = Gdk.ContentProvider.new_for_bytes(Enums.DndTargetInfo.GNOME_CLIPBOARD,
        textCoder.encode(content));
    const textUriListContentProvider = Gdk.ContentProvider.new_for_bytes(Enums.DndTargetInfo.URI_LIST,
        encodedUriList);

    const clipboardContentProvider = Gdk.ContentProvider.new_union([
        gnomeContentProvider,
        textUriListContentProvider,
    ]);
    clipboard.set_content(clipboardContentProvider);
}

// Reads the clipboard for any of the supported mimetypes and returns the first matching type
/**
 *
 * @param {Array} mimetypes
 */
export async function readClipboard(mimetypes) {
    const clipboard = Gdk.Display.get_default().get_clipboard();
    const formats = clipboard.get_formats();
    if (!formats)
        return null;

    for (const mimetype of mimetypes) {
        if (!formats.contain_mime_type(mimetype))
            continue;

        try {
            // eslint-disable-next-line
            const success = await clipboard.read_async_promise([mimetype], GLib.PRIORITY_DEFAULT, null);
            // eslint-disable-next-line
            const bytes = await FileUtils.readAll(success[0]);
            return {mimetype, 'data': bytes};
        } catch (e) {
            console.log(`Exception while reading clipboard media-type "${mimetype}": ${e.message}\n${e.stack}`);
        }
    }
    return null;
}

/**
 *
 * @param {string} mimetype
 * @param {ByteArray} data
 */
export function processFileList(mimetype, data) {
    const decoder = new TextDecoder();
    const content = decoder.decode(data);

    const retval = {'action': null, 'files': []};
    switch (mimetype) {
    case Enums.DndTargetInfo.GNOME_CLIPBOARD:
        {
            const [action, ...clipboarFiles] = content.split('\n');
            retval.action = action;
            clipboarFiles.forEach(file => {
                const file2 = file.replace('\r', '').trim();
                if (file2 !== '')
                    retval.files.push(file2);
            });
        }
        break;
    case Enums.DndTargetInfo.DING_ICON_LIST:
    case Enums.DndTargetInfo.URI_LIST:
        {
            const uriFiles = content.split('\n');
            retval.action = 'copy';
            uriFiles.forEach(file => {
                const file2 = file.replace('\r', '').trim();
                if (file2 !== '')
                    retval.files.push(file2);
            });
        }
        break;
    case Enums.DndTargetInfo.GNOME_ICON_LIST:
        {
            const gnomeFiles = content.split('\n');
            retval.action = 'copy';
            gnomeFiles.forEach(file => {
                const file2 = file.split('\r')[0].trim();
                if (file2 !== '')
                    retval.files.push(file2);
            });
        }
        break;
    }
    return retval;
}

/**
 *
 * @param {Enum} target
 * @param {Array} fileList
 */
export function fillDragDataGet(target, fileList) {
    if (!fileList)
        return null;

    let uriList = '';

    switch (target) {
    case Enums.DndTargetInfo.GNOME_ICON_LIST:
        for (const fileItem of fileList) {
            uriList += fileItem.uri;
            const coordinates = fileItem.getCoordinates();
            if (coordinates !== null)
                uriList += `\r${coordinates[0]}:${coordinates[1]}:${coordinates[2] - coordinates[0] + 1}:${coordinates[3] - coordinates[1] + 1}`;

            uriList += '\r\n';
        }
        return uriList;
    case Enums.DndTargetInfo.DING_ICON_LIST:
    case Enums.DndTargetInfo.URI_LIST:
        uriList = fileList.map(f => f.uri).join('\r\n');
        uriList += '\r\n';
        return uriList;
    }
    return null;
}

/**
 *
 * @param {Dictionary} root0
 * @param {Array} root0.fileList
 * @param {Array} root0.specialFilesSelected
 */
export function loadDragData({fileList, specialFilesSelected}) {
    const textCoder = new TextEncoder();

    const uriList = fillDragDataGet(Enums.DndTargetInfo.DING_ICON_LIST, fileList);
    if (!uriList)
        return null;

    const encodedUriList = textCoder.encode(uriList);
    const dingContentProvider = Gdk.ContentProvider.new_for_bytes(Enums.DndTargetInfo.DING_ICON_LIST,
        encodedUriList);

    if (specialFilesSelected)
        return dingContentProvider;


    const gnomeUriList = fillDragDataGet(Enums.DndTargetInfo.GNOME_ICON_LIST, fileList);
    if (!gnomeUriList)
        return null;

    const gnomeContentProvider = Gdk.ContentProvider.new_for_bytes(Enums.DndTargetInfo.GNOME_ICON_LIST,
        textCoder.encode(gnomeUriList));

    const textUriListContentProvider = Gdk.ContentProvider.new_for_bytes(Enums.DndTargetInfo.URI_LIST,
        encodedUriList);

    return Gdk.ContentProvider.new_union([
        dingContentProvider,
        gnomeContentProvider,
        textUriListContentProvider,
    ]);
}

// manages the drop action over an icon (a folder, for example)
/**
 *
 * @param {FileItem} fileItem
 * @param {Gdk.Drop} drop
 */
export async function manageIconDrop(fileItem, drop) {
    let gdkDropAction = drop.get_actions();
    if (!Gdk.DragAction.is_unique(gdkDropAction)) {
        if (((gdkDropAction & Gdk.DragAction.COPY) !== 0) && ((gdkDropAction & Gdk.DragAction.MOVE) !== 0))
            gdkDropAction = Gdk.DragAction.ASK;
    }
    const gdkReturnAction = Gdk.DragAction.COPY;

    try {
        const [dropData, mimetype] = await drop.read_async_promise(Enums.MIME_TYPES, GLib.PRIORITY_DEFAULT, null);

        const data = await FileUtils.readAll(dropData);
        const textDecoder = new TextDecoder();
        const decodedData = textDecoder.decode(data);
        const fileList = [];
        switch (mimetype) {
        case Enums.DndTargetInfo.DING_ICON_LIST:
        case Enums.DndTargetInfo.URI_LIST:
            for (const item of decodedData.split('\n')) {
                if (item !== '')
                    fileList.push(item.replace('\r', ''));
            }
            break;
        case Enums.DndTargetInfo.GNOME_ICON_LIST:
            for (const item of decodedData.split('\n')) {
                const item2 = item.split('\r')[0];
                if (item2 !== '')
                    fileList.push(item2);
            }
            break;
        case Enums.DndTargetInfo.TEXT_PLAIN:
        case Enums.DndTargetInfo.TEXT_PLAIN_UTF8:
            break;
        default:
            console.log(`Unknown mime type for DnD: ${mimetype}`);
            break;
        }
        drop.finish(gdkReturnAction);
        return {
            'action': gdkDropAction,
            mimetype,
            'filelist': fileList,
            'data': decodedData,
        };
    } catch (e) {
        console.error(e);
        drop.finish(0);
    }
    return null;
}

/**
 *
 * @param {ByteArray} dropData
 * @param {Enum} acceptFormat
 */
export function makeFileListFromSelection(dropData, acceptFormat) {
    if (!dropData)
        return null;

    if (acceptFormat === Enums.DndTargetInfo.TEXT_PLAIN)
        return null;


    let fileList;

    if (acceptFormat === Enums.DndTargetInfo.GNOME_ICON_LIST) {
        fileList = GLib.Uri.list_extract_uris(dropData);
    } else if (acceptFormat === Enums.DndTargetInfo.DING_ICON_LIST) {
        fileList = dropData.get_files().map(f => f.get_uri());
    } else {
        fileList = dropData.split('\n').map(f => {
            if (GLib.Uri.peek_scheme(f))
                return f;
            else
                return GLib.filename_to_uri(f, null);
        });
    }

    // filename_to_uri can return null
    fileList = fileList.filter(f => {
        if (!f)
            return false;
        else
            return true;
    });

    if (fileList && fileList.length)
        return fileList;
    else
        return null;
}
