#!/usr/bin/env gjs

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

for(let arg of ARGV) {
    if (lastCommand == null) {
        switch(arg) {
        case '-E':
            // run it as a true desktop (transparent window and so on)
            asDesktop = true;
            break;
        case '-P':
        case '-D':
        case '-M':
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
    switch(lastCommand) {
    case '-P':
        codePath = arg;
        break;
    case '-D':
        let data = arg.split(":");
        desktops.push({x:parseInt(data[0]), y:parseInt(data[1]), width:parseInt(data[2]), height:parseInt(data[3]), zoom:parseFloat(data[4])});
        break;
    case '-M':
        primaryIndex = parseInt(arg);
        break;
    }
    lastCommand = null;
}

if (desktops.length == 0) {
    /* if no desktop list is provided, like when launching the program in stand-alone mode,
     * configure a 1280x720 desktop
     */
    desktops.push({x:0, y:0, width: 1280, height: 720, zoom: 1});
}

// this allows to import files from the current folder

imports.searchPath.unshift(codePath);

const Prefs = imports.preferences;
const Gettext = imports.gettext;

Gettext.bindtextdomain("desktopicons-neo", GLib.build_filenamev([codePath, "locale"]));

const DesktopManager = imports.desktopManager;

if (!errorFound) {
    Gtk.init(null);
    Prefs.init(codePath);
    var desktopManager = new DesktopManager.DesktopManager(desktops, codePath, asDesktop, primaryIndex);
    Gtk.main();
    // return value
    0;
} else {
    // return value
    1;
}
