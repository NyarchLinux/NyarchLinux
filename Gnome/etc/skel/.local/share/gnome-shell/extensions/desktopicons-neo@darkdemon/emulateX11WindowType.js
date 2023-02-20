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

const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

class ManageWindow {
    /* This class is added to each managed window, and it's used to
       make it behave like an X11 Desktop window.

       Trusted windows will set in the title the characters @!, followed
       by the coordinates where to put the window separated by a colon, and
       ended in semicolon. After that, it can have one or more of these letters

       * B : put this window at the bottom of the screen
       * T : put this window at the top of the screen
       * D : show this window in all desktops
       * H : hide this window from window list

       Using the title is not a problem because this is only useful for windows
       without decorations.
    */

    constructor(window, wayland_client) {
        this._wayland_client = wayland_client;
        this._window = window;
        this._signalIDs = [];
        this._signalIDs.push(window.connect_after('raised', () => {
            if (this._keepAtBottom && !this._keepAtTop) {
                this._window.lower();
            }
        }));
        this._signalIDs.push(window.connect('position-changed', () => {
            if (this._fixed && (this._x !== null) && (this._y !== null)) {
                this._window.move_frame(false, this._x, this._y);
            }
        }));
        this._signalIDs.push(window.connect("notify::title", () => {
            this._parseTitle();
        }));
        this._parseTitle();
    }

    disconnect() {
        for(let signalID of this._signalIDs) {
            this._window.disconnect(signalID);
        }
        if (this._keepAtTop) {
            this._window.unmake_above();
        }
        this._window = null;
        this._wayland_client = null;
    }

    set_wayland_client(client) {
        this._wayland_client = client;
    }

    _parseTitle() {
        this._x = null;
        this._y = null;
        this._keepAtBottom = false;
        let keepAtTop = this._keepAtTop;
        this._keepAtTop = false;
        this._showInAllDesktops = false;
        this._hideFromWindowList = false;
        this._fixed = false;
        let title = this._window.get_title();
        if (title != null) {
            let pos = title.search("@!");
            if (pos != -1) {
                let pos2 = title.search(";", pos)
                let coords;
                if (pos2 != -1) {
                    coords = title.substring(pos+2, pos2).trim().split(",");
                } else {
                    coords = title.substring(pos+2).trim().split(",");
                }
                try {
                    this._x = parseInt(coords[0]);
                    this._y = parseInt(coords[1]);
                } catch(e) {
                    print(`Exception ${e.message}`);
                }
                try {
                    let extra_chars = title.substring(pos+2).trim().toUpperCase();
                    for (let char of extra_chars) {
                        switch (char) {
                        case 'B':
                            this._keepAtBottom = true;
                            this._keepAtTop = false;
                            break;
                        case 'T':
                            this._keepAtTop = true;
                            this._keepAtBottom = false;
                            break;
                        case 'D':
                            this._showInAllDesktops = true;
                            break;
                        case 'H':
                            this._hideFromWindowList = true;
                            break;
                        case 'F':
                            this._fixed = true;
                            break;
                        }
                    }
                } catch(e) {
                    print(`Exception ${e.message}`);
                }
            }
            if (this._wayland_client) {
                if (this._hideFromWindowList) {
                    this._wayland_client.hide_from_window_list(this._window);
                } else {
                    this._wayland_client.show_in_window_list(this._window);
                }
            }
            if (this._keepAtTop != keepAtTop) {
                if (this._keepAtTop) {
                    this._window.make_above();
                } else {
                    this._window.unmake_above();
                }
            }
            if (this._keepAtBottom) {
                this._window.lower();
            }
            if (this._fixed && (this._x !== null) && (this._y !== null)) {
                this._window.move_frame(false, this._x, this._y);
            }
        }
    }

    refreshState(checkWorkspace) {
        if (this._keepAtBottom) {
            this._window.lower();
        }
        if (checkWorkspace && this._showInAllDesktops) {
            let currentWorkspace = global.workspace_manager.get_active_workspace();
            if (!this._window.located_on_workspace(currentWorkspace)) {
                this._window.change_workspace(currentWorkspace);
            }
        }
    }

    get hideFromWindowList() {
        return this._hideFromWindowList;
    }

    get keepAtBottom() {
        return this._keepAtBottom;
    }
}

var EmulateX11WindowType = class {
    /*
     This class makes all the heavy lifting for emulating WindowType.
     Just make one instance of it, call enable(), and whenever a window
     that you want to give "superpowers" is mapped, add it with the
     "addWindow" method. That's all.
     */
    constructor () {
        this._isX11 = !Meta.is_wayland_compositor();
        this._windowList = [];
        this._enableRefresh = true;
        this._wayland_client = null;
    }

    set_wayland_client(client) {
        this._wayland_client = client;
        for(let window of this._windowList) {
            if (window.customJS_desktopiconsneo) {
                window.customJS_desktopiconsneo.set_wayland_client(this._wayland_client);
            }
        }
    }

    enable() {
        if (this._isX11) {
            return;
        }
        replaceMethod(Shell.Global, 'get_window_actors', newGetWindowActors);
        this._idMap = global.window_manager.connect_after('map', (obj, windowActor) => {
            let window = windowActor.get_meta_window();
            if (this._wayland_client && this._wayland_client.query_window_belongs_to(window)) {
                this.addWindow(window);
            }
            this._refreshWindows(false);
        });
        this._idDestroy = global.window_manager.connect_after("destroy", (wm, windowActor) => {
            // if a window is closed, ensure that the desktop doesn't receive the focus
            let window = windowActor.get_meta_window();
            if (window && (window.get_window_type() >= Meta.WindowType.DROPDOWN_MENU)) {
                return;
            }
            this._refreshWindows(true);
        });
        /* Something odd happens with "stick" when using popup submenus, so
           this implements the same functionality
         */
        this._switchWorkspaceId = global.window_manager.connect('switch-workspace', () => {
            this._refreshWindows(true);
        });

        /* But in Overview mode it is paramount to not change the workspace to emulate
           "stick", or the windows will appear
         */
        this._showingId = Main.overview.connect('showing', () => {
            this._enableRefresh = false;
        });

		this._hidingId = Main.overview.connect('hiding', () => {
            this._enableRefresh = true;
            this._refreshWindows(true);
        });
    }

    disable() {
        if (this._isX11) {
            return;
        }
        if (this._activate_window_ID) {
            GLib.source_remove(this._activate_window_ID);
            this._activate_window_ID = null;
        }
        for(let window of this._windowList) {
            this._clearWindow(window);
        }
        this._windowList = [];

        // restore external methods only if have been intercepted
        if (replaceData.old_get_window_actors) {
            Shell.Global.prototype['get_window_actors'] = replaceData.old_get_window_actors;
        }
        replaceData = {};

        // disconnect signals
        if (this._idMap) {
            global.window_manager.disconnect(this._idMap);
            this._idMap = null;
        }
        if (this._idDestroy) {
            global.window_manager.disconnect(this._idDestroy);
            this._idDestroy = null;
        }
        if (this._switchWorkspaceId) {
            global.window_manager.disconnect(this._switchWorkspaceId);
            this._switchWorkspaceId = null;
        }
        if (this._showingId) {
            Main.overview.disconnect(this._showingId);
            this._showingId = null;
        }
        if (this._hidingId) {
            Main.overview.disconnect(this._hidingId);
            this._hidingId = null;
        }
    }

    addWindow(window) {
        if (this._isX11) {
            return;
        }
        if (window.get_meta_window) { // it is a MetaWindowActor
            window = window.get_meta_window();
        }
        window.customJS_desktopiconsneo = new ManageWindow(window, this._wayland_client);
        this._windowList.push(window);
        window.customJS_desktopiconsneo.unmanagedID = window.connect("unmanaged", (window) => {
            this._clearWindow(window);
            this._windowList = this._windowList.filter(item => item !== window);
        });
    }

    _clearWindow(window) {
        window.disconnect(window.customJS_desktopiconsneo.unmanagedID);
        window.customJS_desktopiconsneo.disconnect();
        window.customJS_desktopiconsneo = null;
    }

    _refreshWindows(checkWorkspace) {
        if (!this._activate_window_ID) {
            this._activate_window_ID = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (this._enableRefresh) {
                    for (let window of this._windowList) {
                        window.customJS_desktopiconsneo.refreshState(checkWorkspace);
                    }
                    if (checkWorkspace) {
                        // activate the top-most window
                        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, global.workspace_manager.get_active_workspace());
                        for (let window of windows) {
                            if ((!window.customJS_desktopiconsneo || !window.customJS_desktopiconsneo._keepAtBottom) && !window.minimized) {
                                Main.activateWindow(window);
                                break;
                            }
                        }
                    }
                }
                this._activate_window_ID = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }
}

/**
 * Functions used to remove a window from the window list
 */

let replaceData = {};

/**
 * Replaces a method in a class with our own method, and stores the original
 * one in 'replaceData' using 'old_XXXX' (being XXXX the name of the original method),
 * or 'old_classId_XXXX' if 'classId' is defined. This is done this way for the
 * case that two methods with the same name must be replaced in two different
 * classes
 *
 * @param {class} className The class where to replace the method
 * @param {string} methodName The method to replace
 * @param {function} functionToCall The function to call as the replaced method
 * @param {string} [classId] an extra ID to identify the stored method when two
 *                           methods with the same name are replaced in
 *                           two different classes
 */
function replaceMethod(className, methodName, functionToCall, classId) {
    if (classId) {
        replaceData['old_' + classId + '_' + methodName] = className.prototype[methodName];
    } else {
        replaceData['old_' + methodName] = className.prototype[methodName];
    }
    className.prototype[methodName] = functionToCall;
}

/**
 * Receives a list of metaWindow or metaWindowActor objects, and remove from it
 * our desktop window
 *
 * @param {GList} windowList A list of metaWindow or metaWindowActor objects
 * @returns {GList} The same list, but with the desktop window removed
 */
function removeDesktopWindowFromList(windowList) {

    let returnVal = [];
    for (let element of windowList) {
        let window = element;
        if (window.get_meta_window) { // it is a MetaWindowActor
            window = window.get_meta_window();
        }
        if (!window.customJS_desktopiconsneo || !window.customJS_desktopiconsneo.hideFromWindowList) {
            returnVal.push(element);
        }
    }
    return returnVal;
}

/**
 * Method replacement for Shell.Global.get_window_actors
 * It removes the desktop window from the list of windows in the Activities mode
 */
function newGetWindowActors() {
    let windowList = replaceData.old_get_window_actors.apply(this, []);
    return removeDesktopWindowFromList(windowList);
}
