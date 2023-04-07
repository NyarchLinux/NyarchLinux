/* eslint-disable no-unused-vars */
/* eslint-disable jsdoc/require-jsdoc */
const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, Gio, GLib, Pango, Shell, St} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuLayouts = Me.imports.menulayouts;
const _ = Gettext.gettext;

function activateHibernateOrSleep(powerType) {
    const loginManager = imports.misc.loginManager.getLoginManager();
    let callName, activateCall;

    if (powerType === Constants.PowerType.HIBERNATE) {
        callName = 'CanHibernate';
        activateCall = 'Hibernate';
    } else if (powerType === Constants.PowerType.HYBRID_SLEEP) {
        callName = 'CanHybridSleep';
        activateCall = 'HybridSleep';
    }

    if (!loginManager._proxy) {
        Main.notifyError(`ArcMenu - ${activateCall} Error!`, `System unable to ${activateCall}.`);
        return;
    }

    canHibernateOrSleep(callName, result => {
        if (!result) {
            Main.notifyError(`ArcMenu - ${activateCall} Error!`, `System unable to ${activateCall}.`);
            return;
        }

        loginManager._proxy.call(activateCall,
            GLib.Variant.new('(b)', [true]),
            Gio.DBusCallFlags.NONE,
            -1, null, null);
    });
}

function canHibernateOrSleep(callName, asyncCallback) {
    const loginManager = imports.misc.loginManager.getLoginManager();

    if (!loginManager._proxy)
        asyncCallback(false);

    loginManager._proxy.call(callName, null, Gio.DBusCallFlags.NONE, -1, null, (proxy, asyncResult) => {
        let result, error;

        try {
            result = proxy.call_finish(asyncResult).deep_unpack();
        } catch (e) {
            error = e;
        }

        if (error)
            asyncCallback(false);
        else
            asyncCallback(result[0] === 'yes');
    });
}

function getMenuLayout(menuButton, layoutEnum, isStandaloneRunner) {
    if (layoutEnum === Constants.MenuLayout.GNOME_OVERVIEW)
        return null;

    for (const menuLayout in MenuLayouts) {
        const LayoutClass = MenuLayouts[menuLayout];
        if (LayoutClass.getMenuLayoutEnum() === layoutEnum) {
            const {Menu} = LayoutClass;
            return new Menu(menuButton, isStandaloneRunner);
        }
    }

    const {Menu} = MenuLayouts.arcmenu;
    return new Menu(menuButton, isStandaloneRunner);
}

var SettingsConnectionsHandler = class ArcMenuSettingsConnectionsHandler {
    constructor() {
        this._connections = new Map();
        this._eventPrefix = 'changed::';
    }

    connect(event, callback) {
        this._connections.set(Me.settings.connect(this._eventPrefix + event, callback), Me.settings);
    }

    connectMultipleEvents(events, callback) {
        for (const event of events)
            this._connections.set(Me.settings.connect(this._eventPrefix + event, callback), Me.settings);
    }

    destroy() {
        this._connections.forEach((object, id) => {
            object.disconnect(id);
            id = null;
        });

        this._connections = null;
    }
};

function convertToButton(item) {
    item.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
    item.remove_child(item._ornamentLabel);
    item.remove_child(item.label);
    item.set({
        x_expand: false,
        x_align: Clutter.ActorAlign.CENTER,
        y_expand: false,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'popup-menu-item arcmenu-button',
    });
}

function convertToGridLayout(item) {
    const menuLayout = item._menuLayout;
    const icon = item._iconBin;

    const iconSizeEnum = Me.settings.get_enum('menu-item-grid-icon-size');
    const defaultIconStyle = menuLayout.icon_grid_style;
    const gridIconStyle = getGridIconStyle(iconSizeEnum, defaultIconStyle);

    if (item._ornamentLabel)
        item.remove_child(item._ornamentLabel);

    item.set({
        vertical: true,
        name: gridIconStyle,
        tooltipLocation: Constants.TooltipLocation.BOTTOM_CENTERED,
    });

    icon?.set({
        y_align: Clutter.ActorAlign.CENTER,
        y_expand: true,
    });

    if (item._indicator) {
        item.remove_child(item._indicator);
        item.insert_child_at_index(item._indicator, 0);
        item._indicator.set({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            y_expand: false,
        });
    }

    if (!Me.settings.get_boolean('multi-lined-labels'))
        return;

    icon?.set({
        y_align: Clutter.ActorAlign.TOP,
        y_expand: false,
    });

    const clutterText = item.label.get_clutter_text();
    clutterText.set({
        line_wrap: true,
        line_wrap_mode: Pango.WrapMode.WORD_CHAR,
    });
}

function getIconSize(iconSizeEnum, defaultIconSize) {
    switch (iconSizeEnum) {
    case Constants.IconSize.DEFAULT:
        return defaultIconSize;
    case Constants.IconSize.EXTRA_SMALL:
        return Constants.EXTRA_SMALL_ICON_SIZE;
    case Constants.IconSize.SMALL:
        return Constants.SMALL_ICON_SIZE;
    case Constants.IconSize.MEDIUM:
        return Constants.MEDIUM_ICON_SIZE;
    case Constants.IconSize.LARGE:
        return Constants.LARGE_ICON_SIZE;
    case Constants.IconSize.EXTRA_LARGE:
        return Constants.EXTRA_LARGE_ICON_SIZE;
    case Constants.IconSize.HIDDEN:
        return Constants.ICON_HIDDEN;
    default:
        return defaultIconSize;
    }
}

function getGridIconSize(iconSizeEnum, defaultIconStyle) {
    let iconSize;
    if (iconSizeEnum === Constants.GridIconSize.DEFAULT) {
        Constants.GridIconInfo.forEach(info => {
            if (info.NAME === defaultIconStyle) {
                iconSize = info.ICON_SIZE;
            }
        });
    } else {
        iconSize = Constants.GridIconInfo[iconSizeEnum - 1].ICON_SIZE;
    }

    return iconSize;
}

function getGridIconStyle(iconSizeEnum, defaultIconStyle) {
    switch (iconSizeEnum) {
    case Constants.GridIconSize.DEFAULT:
        return defaultIconStyle;
    case Constants.GridIconSize.SMALL:
        return 'SmallIconGrid';
    case Constants.GridIconSize.MEDIUM:
        return 'MediumIconGrid';
    case Constants.GridIconSize.LARGE:
        return 'LargeIconGrid';
    case Constants.GridIconSize.SMALL_RECT:
        return 'SmallRectIconGrid';
    case Constants.GridIconSize.MEDIUM_RECT:
        return 'MediumRectIconGrid';
    case Constants.GridIconSize.LARGE_RECT:
        return 'LargeRectIconGrid';
    default:
        return defaultIconStyle;
    }
}

function getCategoryDetails(currentCategory) {
    let name, gicon, fallbackIcon = null;

    for (const entry of Constants.Categories) {
        if (entry.CATEGORY === currentCategory) {
            name = entry.NAME;
            gicon = Gio.icon_new_for_string(entry.ICON);
            if (entry.PATH) {
                let iconString = entry.ICON + ".svg";
                fallbackIcon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/category_icons/' + iconString);
                return [name, fallbackIcon, fallbackIcon];
            } else { 
                return [name, gicon, fallbackIcon];
            }
            
        }
    }

    if(currentCategory === Constants.CategoryType.HOME_SCREEN){
        name = _("Home");
        //gicon = Gio.icon_new_for_string('computer-symbolic');
        let iconString = "computer-symbolic.svg";
        fallbackIcon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/category_icons/' + iconString);
        return [name, fallbackIcon, fallbackIcon];
    }
    else{
        name = currentCategory.get_name();

        if (!currentCategory.get_icon()) {
            gicon = null;
            fallbackIcon = Gio.icon_new_for_string(`${Me.path}/media/icons/menu_icons/category_icons/applications-other-symbolic.svg`);
            return [name, gicon, fallbackIcon];
        }

        gicon = currentCategory.get_icon();

        const iconString = `${currentCategory.get_icon().to_string()}-symbolic.svg`;
        fallbackIcon = Gio.icon_new_for_string(`${Me.path}/media/icons/menu_icons/category_icons/${iconString}`);

        fallbackIcon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/category_icons/' + iconString);
        // return [name, gicon, fallbackIcon]; 
        // Force use the icon in the sources
        return [name, fallbackIcon, fallbackIcon];
    }
}

function getPowerTypeFromShortcutCommand(command) {
    switch (command) {
    case Constants.ShortcutCommands.LOG_OUT:
        return Constants.PowerType.LOGOUT;
    case Constants.ShortcutCommands.LOCK:
        return Constants.PowerType.LOCK;
    case Constants.ShortcutCommands.POWER_OFF:
        return Constants.PowerType.POWER_OFF;
    case Constants.ShortcutCommands.RESTART:
        return Constants.PowerType.RESTART;
    case Constants.ShortcutCommands.SUSPEND:
        return Constants.PowerType.SUSPEND;
    case Constants.ShortcutCommands.HYBRID_SLEEP:
        return Constants.PowerType.HYBRID_SLEEP;
    case Constants.ShortcutCommands.HIBERNATE:
        return Constants.PowerType.HIBERNATE;
    case Constants.ShortcutCommands.SWITCH_USER:
        return Constants.PowerType.SWITCH_USER;
    default:
        return Constants.PowerType.POWER_OFF;
    }
}

function getMenuButtonIcon(settings, path) {
    const iconType = settings.get_enum('menu-button-icon');

    if (iconType === Constants.MenuIconType.CUSTOM) {
        if (path && GLib.file_test(path, GLib.FileTest.IS_REGULAR))
            return path;
    } else if (iconType === Constants.MenuIconType.DISTRO_ICON) {
        const iconEnum = settings.get_int('distro-icon');
        const iconPath = Me.path + Constants.DistroIcons[iconEnum].PATH;
        if (GLib.file_test(iconPath, GLib.FileTest.IS_REGULAR))
            return iconPath;
    } else {
        const iconEnum = settings.get_int('arc-menu-icon');
        const iconPath = Me.path + Constants.MenuIcons[iconEnum].PATH;
        if (Constants.MenuIcons[iconEnum].PATH === 'view-app-grid-symbolic')
            return 'view-app-grid-symbolic';
        else if (GLib.file_test(iconPath, GLib.FileTest.IS_REGULAR))
            return iconPath;
    }

    log('ArcMenu Error - Failed to set menu button icon. Set to System Default.');
    return 'start-here-symbolic';
}

function findSoftwareManager() {
    const appSys = Shell.AppSystem.get_default();

    for (const softwareManagerID of Constants.SoftwareManagerIDs) {
        if (appSys.lookup_app(softwareManagerID))
            return softwareManagerID;
    }

    return 'ArcMenu_InvalidShortcut.desktop';
}

function areaOfTriangle(p1, p2, p3) {
    return Math.abs((p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2.0);
}

// modified from GNOME shell's ensureActorVisibleInScrollView()
function ensureActorVisibleInScrollView(actor, axis = Clutter.Orientation.VERTICAL) {
    let box = actor.get_allocation_box();
    let {y1} = box, {y2} = box;
    let {x1} = box, {x2} = box;

    let parent = actor.get_parent();
    while (!(parent instanceof St.ScrollView)) {
        if (!parent)
            return;

        box = parent.get_allocation_box();
        y1 += box.y1;
        y2 += box.y1;
        x1 += box.x1;
        x2 += box.x1;
        parent = parent.get_parent();
    }

    let adjustment, startPoint, endPoint;

    if (axis === Clutter.Orientation.VERTICAL) {
        adjustment = parent.vscroll.adjustment;
        startPoint = y1;
        endPoint = y2;
    } else {
        adjustment = parent.hscroll.adjustment;
        startPoint = x1;
        endPoint = x2;
    }

    let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

    let offset = 0;
    const fade = parent.get_effect('fade');
    if (fade)
        offset = axis === Clutter.Orientation.VERTICAL ? fade.fade_margins.top : fade.fade_margins.left;

    if (startPoint < value + offset)
        value = Math.max(0, startPoint - offset);
    else if (endPoint > value + pageSize - offset)
        value = Math.min(upper, endPoint + offset - pageSize);
    else
        return;

    adjustment.ease(value, {
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        duration: 100,
    });
}

// modified from GNOME shell to allow opening other extension setttings
function openPrefs(uuid) {
    try {
        const {extensionManager} = imports.ui.main;
        extensionManager.openExtensionPrefs(uuid, '', {});
    } catch (e) {
        if (e.name === 'ImportError')
            throw new Error('openPrefs() cannot be called from preferences');
        logError(e, 'Failed to open extension preferences');
    }
}

function getDashToPanelPosition(settings, index) {
    var positions = null;
    var side = 'NONE';

    try {
        positions = JSON.parse(settings.get_string('panel-positions'));
        side = positions[index];
    } catch (e) {
        log(`Error parsing Dash to Panel positions: ${e.message}`);
    }

    if (side === 'TOP')
        return St.Side.TOP;
    else if (side === 'RIGHT')
        return St.Side.RIGHT;
    else if (side === 'BOTTOM')
        return St.Side.BOTTOM;
    else if (side === 'LEFT')
        return St.Side.LEFT;
    else
        return St.Side.BOTTOM;
}
