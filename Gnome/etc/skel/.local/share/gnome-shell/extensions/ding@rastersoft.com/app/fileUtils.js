/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Marco Trevisan <marco.trevisan@canonical.com>
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
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const DEFAULT_ENUMERATE_BATCH_SIZE = 100;
const DEFAULT_QUERY_ATTRIBUTES = [
    Gio.FILE_ATTRIBUTE_STANDARD_NAME,
    Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
].join(',');

/**
 *
 * @param {string} dir
 * @param {Gio.Cancellable} cancellable
 * @param {int} priority
 * @param {string} queryAttributes
 */
export async function enumerateDir(dir, cancellable = null, priority = GLib.PRIORITY_DEFAULT,
    queryAttributes = DEFAULT_QUERY_ATTRIBUTES) {
    const childrenEnumerator = await dir.enumerate_children_async_promise(queryAttributes,
        Gio.FileQueryInfoFlags.NONE, priority, cancellable);

    try {
        const children = [];
        while (true) {
            // The enumerator doesn't support multiple async calls, nor
            // we can predict how many they will be, so using Promise.all
            // isn't an option here, thus we just need to await each batch
            // eslint-disable-next-line no-await-in-loop
            const batch = await childrenEnumerator.next_files_async_promise(
                DEFAULT_ENUMERATE_BATCH_SIZE, priority, cancellable);

            if (!batch.length)
                return children;


            children.push(...batch);
        }
    } finally {
        if (!childrenEnumerator.is_closed())
            await childrenEnumerator.close_async_promise(priority, null);
    }
}

/**
 *
 * @param {string} dir
 * @param {bool} deleteParent
 * @param {Gio.Cancellable} cancellable
 * @param {int} priority
 */
export async function recursivelyDeleteDir(dir, deleteParent, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    const children = await enumerateDir(dir, cancellable, priority);
    /* eslint-disable no-await-in-loop */
    for (const info of children)
        await deleteFile(dir.get_child(info.get_name()), info, cancellable, priority);


    if (deleteParent)
        await dir.delete_async_promise(priority, cancellable);
}

/**
 *
 * @param {string} file
 * @param {Gio.FileInfo} info
 * @param {Gio.Cancellable} cancellable
 * @param {int} priority
 */
export async function deleteFile(file, info = null, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    if (!info) {
        info = await file.query_info_async_promise(
            Gio.FILE_ATTRIBUTE_STANDARD_TYPE, Gio.FileQueryInfoFlags.NONE,
            priority, cancellable);
    }

    const type = info.get_file_type();
    if (type === Gio.FileType.REGULAR || type === Gio.FileType.SYMBOLIC_LINK) {
        await file.delete_async_promise(priority, cancellable);
    } else if (type === Gio.FileType.DIRECTORY) {
        await recursivelyDeleteDir(file, true, cancellable, priority);
    } else {
        throw new GLib.Error(Gio.IOErrorEnum,
            Gio.IOErrorEnum.NOT_SUPPORTED,
            `${file.get_path()} of type ${type} cannot be removed`);
    }
}

/**
 * Reads all possible data from the passed input stream
 *
 * @param {Gio.InputStream} stream The stream from where read data
 * @returns An Uint8Array with all the read data
 */
export async function readAll(stream) {
    const chunks = [];
    let totalLength = 0;
    try {
        while (true) {
            const readData = await new Promise((resolve, reject) => {
                stream.read_bytes_async(8192, GLib.PRIORITY_DEFAULT, null, (obj, result) => {
                    try {
                        resolve(obj.read_bytes_finish(result));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            if (readData.get_size() === 0)
                break;

            const data = readData.get_data();
            chunks.push(data);
            totalLength += data.length;
        }
    } finally {
        try {
            stream.close(null);
        } catch {
            // ignore close errors
        }
    }
    const returnData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        returnData.set(chunk, offset);
        offset += chunk.length;
    }
    return returnData;
}
