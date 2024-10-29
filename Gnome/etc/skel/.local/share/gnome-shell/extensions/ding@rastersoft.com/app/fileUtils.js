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
'use strict';
const {GLib, Gio} = imports.gi;

const DEFAULT_ENUMERATE_BATCH_SIZE = 100;
const DEFAULT_QUERY_ATTRIBUTES = [
    Gio.FILE_ATTRIBUTE_STANDARD_NAME,
    Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
].join(',');

/**
 *
 * @param dir
 * @param cancellable
 * @param priority
 * @param queryAttributes
 */
async function enumerateDir(dir, cancellable = null, priority = GLib.PRIORITY_DEFAULT,
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

            if (!batch.length) {
                return children;
            }

            children.push(...batch);
        }
    } finally {
        if (!childrenEnumerator.is_closed()) {
            await childrenEnumerator.close_async_promise(priority, null);
        }
    }
}

/**
 *
 * @param dir
 * @param deleteParent
 * @param cancellable
 * @param priority
 */
async function recursivelyDeleteDir(dir, deleteParent, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    const children = await enumerateDir(dir, cancellable, priority);
    /* eslint-disable no-await-in-loop */
    for (let info of children) {
        await deleteFile(dir.get_child(info.get_name()), info, cancellable, priority);
    }

    if (deleteParent) {
        await dir.delete_async_promise(priority, cancellable);
    }
}

/**
 *
 * @param file
 * @param info
 * @param cancellable
 * @param priority
 */
async function deleteFile(file, info = null, cancellable = null,
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
