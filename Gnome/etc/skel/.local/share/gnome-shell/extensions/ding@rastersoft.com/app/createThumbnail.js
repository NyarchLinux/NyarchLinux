#!/usr/bin/gjs

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
import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';
import Gio from 'gi://Gio';

/**
 *
 */
export function CreateThumbnail() {
    const thumbnailFactoryNormal = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.NORMAL);
    const thumbnailFactoryLarge = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);

    const file = Gio.File.new_for_path(ARGV[0]);
    if (!file.query_exists(null))
        return 1;


    const fileUri = file.get_uri();
    const fileInfo = file.query_info('standard::content-type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
    const modifiedTime = fileInfo.get_attribute_uint64('time::modified');

    // check if the thumbnail has been already created in the meantime by another program
    const thumbnailLarge = thumbnailFactoryLarge.lookup(fileUri, modifiedTime);
    if (thumbnailLarge !== null)
        return 3;

    const thumbnailNormal = thumbnailFactoryNormal.lookup(fileUri, modifiedTime);
    if (thumbnailNormal !== null)
        return 3;

    if (thumbnailFactoryNormal.has_valid_failed_thumbnail(fileUri, modifiedTime))
        return 4;


    // now, generate the file
    const thumbnailPixbuf = thumbnailFactoryLarge.generate_thumbnail(fileUri, fileInfo.get_content_type(), null);
    if (thumbnailPixbuf === null) {
        thumbnailFactoryLarge.create_failed_thumbnail(fileUri, modifiedTime, null);
        return 2;
    } else {
        thumbnailFactoryLarge.save_thumbnail(thumbnailPixbuf, fileUri, modifiedTime, null);
        return 0;
    }
}

CreateThumbnail();
