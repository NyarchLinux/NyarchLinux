#!/usr/bin/gjs

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

const GnomeDesktop = imports.gi.GnomeDesktop;
const Gio = imports.gi.Gio;

let thumbnailFactory = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);

let file = Gio.File.new_for_path(ARGV[0]);
let fileUri = file.get_uri();

let fileInfo = file.query_info('standard::content-type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
let modifiedTime = fileInfo.get_attribute_uint64('time::modified');
let thumbnailPixbuf = thumbnailFactory.generate_thumbnail(fileUri, fileInfo.get_content_type());
if (thumbnailPixbuf == null)
    thumbnailFactory.create_failed_thumbnail(fileUri, modifiedTime);
else
    thumbnailFactory.save_thumbnail(thumbnailPixbuf, fileUri, modifiedTime);
