const Me = imports.misc.extensionUtils.getCurrentExtension();

const {Clutter, Gio, GLib, Pango, Shell, St} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const MenuLayouts = Me.imports.menulayouts;
const _ = Gettext.gettext;

const PowerManagerInterface = `<node>
  <interface name="org.freedesktop.login1.Manager">
    <method name="HybridSleep">
      <arg type="b" direction="in"/>
    </method>
    <method name="CanHybridSleep">
      <arg type="s" direction="out"/>
    </method>
    <method name="Hibernate">
      <arg type="b" direction="in"/>
    </method>
    <method name="CanHibernate">
      <arg type="s" direction="out"/>
    </method>
  </interface>
</node>`;
const PowerManager = Gio.DBusProxy.makeProxyWrapper(PowerManagerInterface);

function activateHibernate(){
    let proxy = new PowerManager(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1');
    proxy.CanHibernateRemote((result, error) => {
        if(error || result[0] !== 'yes')
            Main.notifyError(_("ArcMenu - Hibernate Error!"), _("System unable to hibernate."));
        else
            proxy.HibernateRemote(true);
    });
}

function activateHybridSleep(){
    let proxy = new PowerManager(Gio.DBus.system, 'org.freedesktop.login1', '/org/freedesktop/login1');
    proxy.CanHybridSleepRemote((result, error) => {
        if(error || result[0] !== 'yes')
            Main.notifyError(_("ArcMenu - Hybrid Sleep Error!"), _("System unable to hybrid sleep."));
        else
            proxy.HybridSleepRemote(true);
    });
}

function getMenuLayout(menuButton, layoutEnum, isStandaloneRunner){
    if(layoutEnum === Constants.MenuLayout.GNOME_OVERVIEW)
        return null;

    for(let menuLayout in MenuLayouts){
        const LayoutClass = MenuLayouts[menuLayout];
        if(LayoutClass.getMenuLayoutEnum() === layoutEnum){
            const { Menu } = LayoutClass;
            return new Menu(menuButton, isStandaloneRunner);
        }
    }

    const { Menu } = MenuLayouts.arcmenu;
    return new Menu(menuButton, isStandaloneRunner);
}

var SettingsConnectionsHandler = class ArcMenu_SettingsConnectionsHandler {
    constructor(settings){
        this._settings = settings;
        this._connections = new Map();
        this._eventPrefix = 'changed::';
    }

    connect(event, callback){
        this._connections.set(this._settings.connect(this._eventPrefix + event, callback), this._settings);
    }

    connectMultipleEvents(events, callback){
        for(let event of events)
            this._connections.set(this._settings.connect(this._eventPrefix + event, callback), this._settings);
    }

    destroy(){
        this._connections.forEach((object, id) => {
            object.disconnect(id);
            id = null;
        });

        this._connections = null;
    }
}

function convertToGridLayout(item){
    const settings = item._settings;
    const layoutProperties = item._menuLayout.layoutProperties;

    let icon = item._icon ? item._icon : item._iconBin;

    item.vertical = true;
    if(item._ornamentLabel)
        item.remove_child(item._ornamentLabel);

    item.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;

    icon.y_align = Clutter.ActorAlign.CENTER;
    icon.y_expand = true;
    if(settings.get_boolean('multi-lined-labels')){
        icon.y_align = Clutter.ActorAlign.TOP;
        icon.y_expand = false;

        let clutterText = item.label.get_clutter_text();
        clutterText.set({
            line_wrap: true,
            line_wrap_mode: Pango.WrapMode.WORD_CHAR,
        });
    }

    if(item._indicator){
        item.remove_child(item._indicator);
        item.insert_child_at_index(item._indicator, 0);
        item._indicator.x_align = Clutter.ActorAlign.CENTER;
        item._indicator.y_align = Clutter.ActorAlign.START;
        item._indicator.y_expand = false;
    }

    const iconSizeEnum = settings.get_enum('menu-item-grid-icon-size');
    let defaultIconStyle = layoutProperties.DefaultIconGridStyle;

    iconSize = getGridIconStyle(iconSizeEnum, defaultIconStyle);
    item.name = iconSize;
}

function getIconSize(iconSizeEnum, defaultIconSize){
    const IconSizeEnum = iconSizeEnum;
    let iconSize = defaultIconSize;

    if(IconSizeEnum === Constants.IconSize.DEFAULT)
        iconSize = defaultIconSize;
    else if(IconSizeEnum === Constants.IconSize.EXTRA_SMALL)
        iconSize = Constants.EXTRA_SMALL_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.SMALL)
        iconSize = Constants.SMALL_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.MEDIUM)
        iconSize = Constants.MEDIUM_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.LARGE)
        iconSize = Constants.LARGE_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.EXTRA_LARGE)
        iconSize = Constants.EXTRA_LARGE_ICON_SIZE;
    else if(IconSizeEnum === Constants.IconSize.HIDDEN)
        iconSize = Constants.ICON_HIDDEN;

    return iconSize;
}

function getGridIconSize(iconSizeEnum, defaultIconStyle){
    let iconSize;
    if(iconSizeEnum === Constants.GridIconSize.DEFAULT){
        Constants.GridIconInfo.forEach((info) => {
            if(info.NAME === defaultIconStyle){
                iconSize = info.ICON_SIZE;
            }
        });
    }
    else
        iconSize = Constants.GridIconInfo[iconSizeEnum - 1].ICON_SIZE;

    return iconSize;
}

function getGridIconStyle(iconSizeEnum, defaultIconStyle){
    const IconSizeEnum = iconSizeEnum;
    let iconStyle = defaultIconStyle;
    if(IconSizeEnum === Constants.GridIconSize.DEFAULT)
        iconStyle = defaultIconStyle;
    else if(IconSizeEnum === Constants.GridIconSize.SMALL)
        iconStyle = 'SmallIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.MEDIUM)
        iconStyle = 'MediumIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.LARGE)
        iconStyle = 'LargeIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.SMALL_RECT)
        iconStyle = 'SmallRectIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.MEDIUM_RECT)
        iconStyle = 'MediumRectIconGrid';
    else if(IconSizeEnum === Constants.GridIconSize.LARGE_RECT)
        iconStyle = 'LargeRectIconGrid';

    return iconStyle;
}

function getCategoryDetails(currentCategory){
    let name, gicon, fallbackIcon = null;

    for(let entry of Constants.Categories){
        if(entry.CATEGORY === currentCategory){
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

        if(!currentCategory.get_icon()){
            gicon = null;
            fallbackIcon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/category_icons/applications-other-symbolic.svg');
            return [name, gicon, fallbackIcon];
        }

        gicon = currentCategory.get_icon();

        let iconString = currentCategory.get_icon().to_string() + '-symbolic.svg';

        fallbackIcon = Gio.icon_new_for_string(Me.path + '/media/icons/menu_icons/category_icons/' + iconString);
        // return [name, gicon, fallbackIcon]; 
        // Force use the icon in the sources
        return [name, fallbackIcon, fallbackIcon];
    }
}

function activateCategory(currentCategory, menuLayout, menuItem, extraParams = false){
    if(currentCategory === Constants.CategoryType.HOME_SCREEN){
        menuLayout.activeCategory = _("Pinned");
        menuLayout.displayPinnedApps();
    }
    else if(currentCategory === Constants.CategoryType.PINNED_APPS)
        menuLayout.displayPinnedApps();
    else if(currentCategory === Constants.CategoryType.FREQUENT_APPS){
        menuLayout.setFrequentAppsList(menuItem);
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);
    }
    else if(currentCategory === Constants.CategoryType.ALL_PROGRAMS)
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);
    else if(currentCategory === Constants.CategoryType.RECENT_FILES)
        menuLayout.displayRecentFiles();
    else
        menuLayout.displayCategoryAppList(menuItem.appList, currentCategory, extraParams ? menuItem : null);

    menuLayout.activeCategoryType = currentCategory;
}

function getMenuButtonIcon(settings, path){
    const iconType = settings.get_enum('menu-button-icon');

    if(iconType === Constants.MenuIconType.CUSTOM){
        if(path && GLib.file_test(path, GLib.FileTest.IS_REGULAR))
            return path;
    }
    else if(iconType === Constants.MenuIconType.DISTRO_ICON){
        const iconEnum = settings.get_int('distro-icon');
        const iconPath = Me.path + Constants.DistroIcons[iconEnum].PATH;
        if(GLib.file_test(iconPath, GLib.FileTest.IS_REGULAR))
            return iconPath;
    }
    else{
        const iconEnum = settings.get_int('arc-menu-icon');
        const iconPath = Me.path + Constants.MenuIcons[iconEnum].PATH;
        if(Constants.MenuIcons[iconEnum].PATH === 'view-app-grid-symbolic')
            return 'view-app-grid-symbolic';
        else if(GLib.file_test(iconPath, GLib.FileTest.IS_REGULAR))
            return iconPath;
    }

    log("ArcMenu Error - Failed to set menu button icon. Set to System Default.");
    return 'start-here-symbolic';
}

function findSoftwareManager(){
    let softwareManager = 'ArcMenu_InvalidShortcut.desktop';
    let appSys = Shell.AppSystem.get_default();

    for(let softwareManagerID of Constants.SoftwareManagerIDs){
        if(appSys.lookup_app(softwareManagerID)){
            softwareManager = softwareManagerID;
            break;
        }
    }

    return softwareManager;
}

function areaOfTriangle(p1, p2, p3){
    return Math.abs((p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2.0);
}

//modified from GNOME shell's ensureActorVisibleInScrollView()
function ensureActorVisibleInScrollView(actor) {
    let box = actor.get_allocation_box();
    let y1 = box.y1, y2 = box.y2;

    let parent = actor.get_parent();
    while (!(parent instanceof St.ScrollView)) {
        if (!parent)
            return;

        box = parent.get_allocation_box();
        y1 += box.y1;
        y2 += box.y1;
        parent = parent.get_parent();
    }

    let adjustment = parent.vscroll.adjustment;
    let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

    let offset = 0;
    let vfade = parent.get_effect("fade");
    if (vfade)
        offset = vfade.fade_margins.top;

    if (y1 < value + offset)
        value = Math.max(0, y1 - offset);
    else if (y2 > value + pageSize - offset)
        value = Math.min(upper, y2 + offset - pageSize);
    else
        return;
    adjustment.set_value(value);
}

//modified from GNOME shell to allow opening other extension setttings
function openPrefs(uuid) {
    try {
        const extensionManager = imports.ui.main.extensionManager;
        extensionManager.openExtensionPrefs(uuid, '', {});
    } catch (e) {
        if (e.name === 'ImportError')
            throw new Error('openPrefs() cannot be called from preferences');
        logError(e, 'Failed to open extension preferences');
    }
}

function getDashToPanelPosition(settings, index){
    var positions = null;
    var side = 'NONE';

    try{
        positions = JSON.parse(settings.get_string('panel-positions'));
        side = positions[index];
    } catch(e){
        log('Error parsing Dash to Panel positions: ' + e.message);
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