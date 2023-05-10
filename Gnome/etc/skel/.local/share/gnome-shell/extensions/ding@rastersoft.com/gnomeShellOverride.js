/* Gnome Shell Override
 *
 * Copyright (C) 2021 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
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
/* exported GnomeShellOverride */
'use strict';
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
var WorkspaceAnimation = null;
try {
    WorkspaceAnimation = imports.ui.workspaceAnimation;
} catch (err) {
    log('Workspace Animation does not exist');
}

var replaceData = {};

/*
     * This class overrides methods in the Gnome Shell. The new methods
     * need to be defined below the class as seperate functions.
     * The old methods that are overriden can be accesed by relpacedata.old_'name-of-replaced-method'
     * in the new functions
    */


var GnomeShellOverride = class {
    constructor() {
        this._isX11 = !Meta.is_wayland_compositor();
    }

    enable() {
        if (this._isX11) {  // ** X11 Methods only
            if (WorkspaceAnimation &&
                WorkspaceAnimation.WorkspaceGroup !== undefined) {
                this.replaceMethod(WorkspaceAnimation.WorkspaceGroup, '_shouldShowWindow', newShouldShowWindow);
            }
        } else {    // ** Wayland replace methods below this
            this.replaceMethod(Shell.Global, 'get_window_actors', newGetWindowActors);
        }
    }

    // restore external methods only if have been intercepted

    disable() {
        for (let value of Object.values(replaceData)) {
            if (value[0]) {
                value[1].prototype[value[2]] = value[0];
            }
        }
        replaceData = {};
    }

    /**
     * Replaces a method in a class with our own method, and stores the original
     * one in 'replaceData' using 'old_XXXX' (being XXXX the name of the original method),
     * or 'old_classId_XXXX' if 'classId' is defined. This is done this way for the
     * case that two methods with the same name must be replaced in two different
     * classes
     *
     * @param {class} className The class where to replace the method
     * @param {string} methodName The method to replace
     * @param {Function} functionToCall The function to call as the replaced method
     * @param {string} [classId] an extra ID to identify the stored method when two
     *                           methods with the same name are replaced in
     *                           two different classes
     */

    replaceMethod(className, methodName, functionToCall, classId) {
        if (classId) {
            replaceData[`old_${classId}_${methodName}`] = [className.prototype[methodName], className, methodName, classId];
        } else {
            replaceData[`old_${methodName}`] = [className.prototype[methodName], className, methodName];
        }
        className.prototype[methodName] = functionToCall;
    }
};


/**
 * New Functions used to replace the gnome shell functions are defined below.
 */

/**
 * Receives a list of metaWindow or metaWindowActor objects, and remove from it
 * our desktop window
 *
 * @param {GList} windowList A list of metaWindow or metaWindowActor objects
 * @returns {GList} The same list, but with the desktop window removed
 */

/**
 *
 * @param windowList
 */
function removeDesktopWindowFromList(windowList) {
    let returnVal = [];
    for (let element of windowList) {
        let window = element;
        if (window.get_meta_window) { // it is a MetaWindowActor
            window = window.get_meta_window();
        }
        if (!window.customJS_ding || !window.customJS_ding.hideFromWindowList) {
            returnVal.push(element);
        }
    }
    return returnVal;
}

/**
 * Method replacement for Shell.Global.get_window_actors
 * It removes the desktop window from the list of windows in the Activities mode
 */

/**
 *
 */
function newGetWindowActors() {
    /* eslint-disable no-invalid-this */
    let windowList = replaceData.old_get_window_actors[0].apply(this, []);
    return removeDesktopWindowFromList(windowList);
}

/**
 * Method replacement under X11 for should show window
 * It removes the desktop window from the window animation
 */

/**
 *
 * @param window
 */
function newShouldShowWindow(window) {
    if (window.get_window_type() === Meta.WindowType.DESKTOP) {
        return false;
    }
    /* eslint-disable no-invalid-this */
    return replaceData.old__shouldShowWindow[0].apply(this, [window]);
}
