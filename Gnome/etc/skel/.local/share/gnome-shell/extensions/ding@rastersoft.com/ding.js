#!/usr/bin/env gjs

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
imports.gi.versions.Gtk = '3.0';
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let desktops = [];
let lastCommand = null;
let codePath = '.';
let errorFound = false;
let asDesktop = false;
let primaryIndex = 0;

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
 * @param argv
 */
function parseCommandLine(argv) {
    desktops = [];
    let data;
    for (let arg of argv) {
        if (lastCommand == null) {
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
        if (errorFound) {
            break;
        }
        switch (lastCommand) {
        case '-P':
            codePath = arg;
            break;
        case '-D':
            data = arg.split(':');
            if (data.length != 10) {
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
            });
            break;
        case '-M':
            primaryIndex = parseInt(arg);
            break;
        }
        lastCommand = null;
    }
    if ((desktops.length == 0) && !asDesktop) {
        /* if no desktop list is provided, like when launching the program in stand-alone mode,
         * configure a 1280x720 desktop
         */
        desktops.push({x: 0, y: 0, width: 1280, height: 720, zoom: 1, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, monitorIndex: 0});
    }
    for (let desktop of desktops) {
        desktop.primaryMonitor = primaryIndex;
    }
}

parseCommandLine(ARGV);

// this allows to import files from the current folder

imports.searchPath.unshift(codePath);

const DBusUtils = imports.dbusUtils;
const Prefs = imports.preferences;
const Gettext = imports.gettext;
const PromiseUtils = imports.promiseUtils;

PromiseUtils._promisify({keepOriginal: true}, Gio.FileEnumerator.prototype, 'close_async');
PromiseUtils._promisify({keepOriginal: true}, Gio.FileEnumerator.prototype, 'next_files_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'delete_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'enumerate_children_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'make_directory_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'query_info_async');
PromiseUtils._promisify({keepOriginal: true}, Gio._LocalFilePrototype, 'set_attributes_async');

let localePath = GLib.build_filenamev([codePath, 'locale']);
if (Gio.File.new_for_path(localePath).query_exists(null)) {
    Gettext.bindtextdomain('ding', localePath);
}

const DesktopManager = imports.desktopManager;

var desktopManager = null;
var dbusManager = null;

// Use different AppIDs to allow to test it from a command line while the main desktop is also running from the extension
const dingApp = new Gtk.Application({
    application_id: asDesktop ? 'com.rastersoft.ding' : 'com.rastersoft.dingtest',
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE | Gio.ApplicationFlags.REPLACE,
});

dingApp.connect('startup', () => {
    Prefs.init(codePath);
    dbusManager = DBusUtils.init();
});

dingApp.connect('activate', () => {
    if (!desktopManager) {
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
        if (commandLine.get_is_remote()) {
            desktopManager.updateGridWindows(desktops);
        } else {
            dingApp.activate();
        }
        commandLine.set_exit_status(0);
    } else {
        commandLine.set_exit_status(1);
    }
});

if (!errorFound) {
    dingApp.run(ARGV);
}

if (!errorFound) {
    0;
} else {
    1;
}
