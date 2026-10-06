#!/usr/bin/env -S gjs -m

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
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw?version=1';

let desktops = [];
let lastCommand = null;
let codePath = '.';
let errorFound = false;
let asDesktop = false;
let primaryIndex = 0;

const fileProto = imports.system.version >= 17200
    ? Gio.File.prototype : Gio._LocalFilePrototype;
Gio._promisify(fileProto, 'load_bytes_async');

/**
 *
 */
function printUsage() {
    print('Desktop Icons NG');
    print('Usage:');
    print('  -h                      : show this help');
    print('  -E                      : run as desktop (with transparent window, reading data from the extension...)');
    print('  -P code path            : set the path where the code is stored');
    print('  -M index                : index of the primary monitor');
    print('  -D x:y:w:h:z:t:b:l:r:i  : monitor data');
    print('      x: X coordinate');
    print('      y: Y coordinate');
    print('      w: width in pixels');
    print('      h: height in pixels');
    print('      z: zoom value (must be greater than or equal to one)');
    print('      t: top margin in pixels');
    print('      b: bottom margin in pixels');
    print('      l: left margin in pixels');
    print('      r: right margin in pixels');
    print('      i: monitor index (0, 1...)');
}

/**
 *
 * @param {Array} argv
 */
function parseCommandLine(argv) {
    desktops = [];
    let data;
    for (const arg of argv) {
        if (lastCommand === null) {
            switch (arg) {
            case '-h':
            case '-H':
                printUsage();
                errorFound = true;
                break;
            case '-E':
                // run it as a true desktop (transparent window and so on)
                asDesktop = true;
                break;
            case '-P': // Code path
            case '-D': // Desktop definition: X:Y:WIDTH:HEIGHT:ZOOM:MARGINTOP:MARGINBOTTOM:MARGINLEFT:MARGINRIGHT:MONITORINDEX
            case '-M': // Primary monitor
                lastCommand = arg;
                break;
            default:
                print(`Parameter ${arg} not recognized. Aborting.`);
                errorFound = true;
                break;
            }
            continue;
        }
        if (errorFound)
            break;

        switch (lastCommand) {
        case '-P':
            codePath = arg;
            break;
        case '-D':
            data = arg.split(':');
            if (data.length !== 10) {
                print('Incorrect number of parameters for -D\n');
                printUsage();
                errorFound = true;
                break;
            }
            if (parseFloat(data[4]) < 1.0) {
                print("Error: ZOOM value can't be less than one\n");
                printUsage();
                errorFound = true;
                break;
            }
            desktops.push({
                x: parseInt(data[0]),
                y: parseInt(data[1]),
                width: parseInt(data[2]),
                height: parseInt(data[3]),
                zoom: parseFloat(data[4]),
                marginTop: parseInt(data[5]),
                marginBottom: parseInt(data[6]),
                marginLeft: parseInt(data[7]),
                marginRight: parseInt(data[8]),
                monitorIndex: parseInt(data[9]),
                windowMarginTop: 0,
                windowMarginBottom: 0,
                windowMarginLeft: 0,
                windowMarginRight: 0,
            });
            break;
        case '-M':
            primaryIndex = parseInt(arg);
            break;
        }
        lastCommand = null;
    }
    if ((desktops.length === 0) && !asDesktop) {
        /* if no desktop list is provided, like when launching the program in stand-alone mode,
         * configure a 1280x720 desktop
         */
        desktops.push({
            x: 0,
            y: 0,
            width: 1900,
            height: 1000,
            zoom: 1,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            monitorIndex: 0,
            windowMarginTop: 0,
            windowMarginBottom: 0,
            windowMarginLeft: 0,
            windowMarginRight: 0,
        });
        desktops.push({
            x: 0,
            y: 0,
            width: 1800,
            height: 1000,
            zoom: 1,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            monitorIndex: 1,
            windowMarginTop: 0,
            windowMarginBottom: 0,
            windowMarginLeft: 0,
            windowMarginRight: 0,
        });
    }
    for (const desktop of desktops)
        desktop.primaryMonitor = primaryIndex;
}

parseCommandLine(ARGV);

// this allows to import files from the current folder

imports.searchPath.unshift(codePath);

import * as DBusUtils from './dbusUtils.js';
import * as Prefs from './preferences.js';
const Gettext = imports.gettext;
import * as PromiseUtils from './promiseUtils.js';

PromiseUtils._promisify({keepOriginal: true}, Gio.FileEnumerator.prototype, 'close_async');
PromiseUtils._promisify({keepOriginal: true}, Gio.FileEnumerator.prototype, 'next_files_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'delete_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'enumerate_children_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'make_directory_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'query_info_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'set_attributes_async');
PromiseUtils._promisify({keepOriginal: true}, Gdk.Drop.prototype, 'read_async');
PromiseUtils._promisify({keepOriginal: true}, Gdk.Drop.prototype, 'read_value_async');
PromiseUtils._promisify({keepOriginal: true}, Gdk.Clipboard.prototype, 'read_async');

const localePath = GLib.build_filenamev([codePath, '..', 'locale']);
if (Gio.File.new_for_path(localePath).query_exists(null))
    Gettext.bindtextdomain('ding', localePath);


import * as DesktopManager from './desktopManager.js';

var desktopManager = null;
var dbusManager = null;

// Use different AppIDs to allow to test it from a command line while the main desktop is also running from the extension
const dingApp = new Adw.Application({
    application_id: asDesktop ? 'com.rastersoft.ding' : 'com.rastersoft.dingtest',
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE | Gio.ApplicationFlags.REPLACE,
});

dingApp.connect('startup', () => {
    Prefs.init(codePath);
    dbusManager = DBusUtils.init(dingApp);
});

dingApp.connect('activate', () => {
    if (!desktopManager) {
        const iconsPath = GLib.build_filenamev([codePath, 'icons']);
        const display = Gdk.Display.get_default();
        const iconsTheme = Gtk.IconTheme.get_for_display(display);
        iconsTheme.add_search_path(iconsPath);
        desktopManager = new DesktopManager.DesktopManager(dingApp,
            dbusManager,
            desktops,
            codePath,
            asDesktop,
            primaryIndex);
    }
});

dingApp.connect('command-line', (app, commandLine) => {
    let argv = [];
    argv = commandLine.get_arguments();
    parseCommandLine(argv);
    if (!errorFound) {
        if (commandLine.get_is_remote())
            desktopManager.updateGridWindows(desktops);
        else
            dingApp.activate();

        commandLine.set_exit_status(0);
    } else {
        commandLine.set_exit_status(1);
    }
});

if (!errorFound)
    dingApp.run(ARGV);


if (!errorFound)
    // eslint-disable-next-line
    0;
else
    // eslint-disable-next-line
    1;

