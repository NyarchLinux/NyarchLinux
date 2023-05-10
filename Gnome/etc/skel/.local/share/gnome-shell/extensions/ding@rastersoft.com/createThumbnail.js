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
'use strict';
imports.gi.versions.GnomeDesktop = '3.0';
const GnomeDesktop = imports.gi.GnomeDesktop;
const Gio = imports.gi.Gio;

/**
 *
 */
function CreateThumbnail() {
    let thumbnailFactoryNormal = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.NORMAL);
    let thumbnailFactoryLarge = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);

    let file = Gio.File.new_for_path(ARGV[0]);
    if (!file.query_exists(null)) {
        return 1;
    }

    let fileUri = file.get_uri();
    let fileInfo = file.query_info('standard::content-type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
    let modifiedTime = fileInfo.get_attribute_uint64('time::modified');

    // check if the thumbnail has been already created in the meantime by another program
    let thumbnailLarge = thumbnailFactoryLarge.lookup(fileUri, modifiedTime);
    if (thumbnailLarge != null) {
        return 3;
    }
    let thumbnailNormal = thumbnailFactoryNormal.lookup(fileUri, modifiedTime);
    if (thumbnailNormal != null) {
        return 3;
    }
    if (thumbnailFactoryNormal.has_valid_failed_thumbnail(fileUri, modifiedTime)) {
        return 4;
    }

    // now, generate the file
    let thumbnailPixbuf = thumbnailFactoryLarge.generate_thumbnail(fileUri, fileInfo.get_content_type());
    if (thumbnailPixbuf == null) {
        thumbnailFactoryLarge.create_failed_thumbnail(fileUri, modifiedTime);
        return 2;
    } else {
        thumbnailFactoryLarge.save_thumbnail(thumbnailPixbuf, fileUri, modifiedTime);
        return 0;
    }
}

CreateThumbnail();
