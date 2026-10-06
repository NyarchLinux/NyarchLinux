import {domain} from 'gettext';
const {gettext: _} = domain('arcmenu');

export const DASH_TO_PANEL_UUID = 'dash-to-panel@jderose9.github.com';
export const AZTASKBAR_UUID = 'aztaskbar@aztaskbar.gitlab.com';
export const RESOURCE_PATH = 'resource:///org/gnome/shell/extensions/arcmenu/icons/scalable';

export const ClutterAction = {
    CLICK: 0,
    PAN: 1,
};

export const SearchbarLocation = {
    BOTTOM: 0,
    TOP: 1,
};

export const MenuItemLocation = {
    BOTTOM: 0,
    TOP: 1,
};

export const DisplayType = {
    LIST: 0,
    GRID: 1,
    BUTTON: 2,
};

export const AvatarStyle = {
    ROUND: 0,
    SQUARE: 1,
};

export const CategoryType = {
    FAVORITES: 0,
    FREQUENT_APPS: 1,
    ALL_PROGRAMS: 2,
    PINNED_APPS: 3,
    RECENT_FILES: 4,
    HOME_SCREEN: 5,
    SEARCH_RESULTS: 6,
    CATEGORIES_LIST: 7,
};

export const DefaultMenuView = {
    PINNED_APPS: 0,
    CATEGORIES_LIST: 1,
    FREQUENT_APPS: 2,
    ALL_PROGRAMS: 3,
    PINNED_AND_FREQUENT_APPS: 4,
};

export const SettingsPage = {
    MAIN: 0,
    MENU_LAYOUT: 1,
    BUTTON_APPEARANCE: 2,
    LAYOUT_TWEAKS: 3,
    ABOUT: 4,
    CUSTOMIZE_MENU: 5,
    RUNNER_TWEAKS: 6,
    GENERAL: 7,
    MENU_THEME: 8,
    DIRECTORY_SHORTCUTS: 9,
    APPLICATION_SHORTCUTS: 10,
    SEARCH_OPTIONS: 11,
    POWER_OPTIONS: 12,
    EXTRA_CATEGORIES: 13,
    PINNED_APPS: 14,
    DONATE: 15,
    WHATS_NEW: 16,
};

export const AllAppsButtonAction = {
    CATEGORIES_LIST: 0,
    ALL_PROGRAMS: 1,
};

export const SoftwareManagerIDs = ['org.manjaro.pamac.manager.desktop', 'pamac-manager.desktop',
    'io.elementary.appcenter.desktop', 'snap-store_ubuntu-software.desktop', 'snap-store_snap-store.desktop',
    'org.gnome.Software.desktop', 'tr.org.pardus.software.desktop'];

export const Categories = [
    {id: CategoryType.FAVORITES, name: _('Favorites'), icon: 'emote-love-symbolic'},
    {id: CategoryType.FREQUENT_APPS, name: _('Frequent Apps'), icon: 'user-bookmarks-symbolic'},
    {id: CategoryType.ALL_PROGRAMS, name: _('All Apps'), icon: 'view-app-grid-symbolic'},
    {id: CategoryType.PINNED_APPS, name: _('Pinned Apps'), icon: 'view-pin-symbolic'},
    {id: CategoryType.RECENT_FILES, name: _('Recent Files'), icon: 'document-open-recent-symbolic'},
];

export const TooltipLocation = {
    TOP_CENTERED: 0,
    BOTTOM_CENTERED: 1,
    BOTTOM: 2,
};

export const ContextMenuLocation = {
    DEFAULT: 0,
    BOTTOM_CENTERED: 1,
    RIGHT: 2,
};

export const SeparatorAlignment = {
    VERTICAL: 0,
    HORIZONTAL: 1,
};

export const SeparatorStyle = {
    SHORT: 0,
    MEDIUM: 1,
    LONG: 2,
    MAX: 3,
    HEADER_LABEL: 4,
    NORMAL: 5,
    EMPTY: 6,
};

export const CaretPosition = {
    END: -1,
    START: 0,
    MIDDLE: 2,
};

export const IconStyle = {
    FULL_COLOR: 0,
    SYMBOLIC: 1,
};

export const MenuLocation = {
    OFF: 0,
    TOP_CENTERED: 1,
    TOP_LEFT: 2,
    TOP_RIGHT: 3,
    BOTTOM_CENTERED: 4,
    BOTTOM_LEFT: 5,
    BOTTOM_RIGHT: 6,
    LEFT_CENTERED: 7,
    RIGHT_CENTERED: 8,
    MONITOR_CENTERED: 9,
};

export const IconSizes = {
    DEFAULT: -1,
    HIDDEN: 0,
    SMALL: 16,
    MEDIUM: 24,
    LARGE: 32,
    XL: 48,
};

export const GridIconSizes = {
    DEFAULT:     {width: -1, height: -1, size: -1},
    SMALL:       {width: 80, height: 80, size: 32},
    MEDIUM:      {width: 90, height: 90, size: 48},
    LARGE:       {width: 100, height: 100, size: 48},
    XL:          {width: 145, height: 145, size: 64},
    SMALL_RECT:  {width: 85, height: 70, size: 32},
    MEDIUM_RECT: {width: 97, height: 80, size: 32},
    LARGE_RECT:  {width: 109, height: 90, size: 48},
};

export const SUPER_L = 'Super_L';
export const SUPER_R = 'Super_R';
export const SUPER = 'Super';

export const SECTIONS = [
    'devices',
    'network',
    'bookmarks',
];

export const Direction = {
    GO_NEXT: 0,
    GO_PREVIOUS: 1,
};

export const MenuPosition = {
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2,
};

export const RavenPosition = {
    LEFT: 0,
    RIGHT: 1,
};

export const DiaglogType = {
    DEFAULT: 0,
    OTHER: 1,
    APPLICATIONS: 2,
    DIRECTORIES: 3,
};

export const MenuSettingsListType = {
    PINNED_APPS: 0,
    APPLICATIONS: 1,
    DIRECTORIES: 2,
    EXTRA_SHORTCUTS: 3,
    POWER_OPTIONS: 4,
    EXTRA_CATEGORIES: 5,
    QUICK_LINKS: 6,
    CONTEXT_MENU: 7,
    FOLDER_PINNED_APPS: 8,
};

export const MenuButtonAppearance = {
    ICON: 0,
    TEXT: 1,
    ICON_TEXT: 2,
    TEXT_ICON: 3,
    NONE: 4,
};

export const MenuButtonClickAction = {
    ARCMENU: 0,
    CONTEXT_MENU: 1,
    NONE: 2,
};

export const PowerType = {
    LOGOUT: 0,
    LOCK: 1,
    RESTART: 2,
    POWER_OFF: 3,
    SUSPEND: 4,
    HYBRID_SLEEP: 5,
    HIBERNATE: 6,
    SWITCH_USER: 7,
};

export const PowerDisplayStyle = {
    DEFAULT: 0,
    IN_LINE: 1,
    MENU: 2,
};

export const PowerOptions = [
    {id: PowerType.LOGOUT, icon: 'system-log-out-symbolic', name: _('Log Out...')},
    {id: PowerType.LOCK, icon: 'changes-prevent-symbolic', name: _('Lock')},
    {id: PowerType.RESTART, icon: 'system-reboot-symbolic', name: _('Restart...')},
    {id: PowerType.POWER_OFF, icon: 'system-shutdown-symbolic', name: _('Power Off...')},
    {id: PowerType.SUSPEND, icon: 'media-playback-pause-symbolic', name: _('Suspend')},
    {id: PowerType.HYBRID_SLEEP, icon: 'weather-clear-night-symbolic', name: _('Hybrid Sleep')},
    {id: PowerType.HIBERNATE, icon: 'document-save-symbolic', name: _('Hibernate')},
    {id: PowerType.SWITCH_USER, icon: 'system-switch-user-symbolic', name: _('Switch User')},
];

export const LayoutCategoriesInfo = [
    {id: 'traditional', name: _('Traditional'), icon: 'menustyle-traditional-symbolic'},
    {id: 'modern', name: _('Modern'), icon: 'menustyle-modern-symbolic'},
    {id: 'touch', name: _('Touch'), icon: 'menustyle-touch-symbolic'},
    {id: 'launcher', name: _('Launcher'), icon: 'menustyle-launcher-symbolic'},
    {id: 'alternative', name: _('Alternative'), icon: 'menustyle-alternative-symbolic'},
];

export const MenuLayoutsInfo = [
    {id: 'arcmenu', name: _('ArcMenu'), category: 'traditional'},
    {id: 'brisk', name: _('Brisk'), category: 'traditional'},
    {id: 'budgie', name: _('Budgie'), category: 'traditional'},
    {id: 'gnome-menu', name: _('GNOME Menu'), category: 'traditional'},
    {id: 'mint', name: _('Mint'), category: 'traditional'},
    {id: 'whisker', name: _('Whisker'), category: 'traditional'},
    {id: '11', name: _('11'), category: 'modern'},
    {id: 'az', name: _('a.z.'), category: 'modern'},
    {id: 'enterprise', name: _('Enterprise'), category: 'modern'},
    {id: 'insider', name: _('Insider'), category: 'modern'},
    {id: 'plasma', name: _('Plasma'), category: 'modern'},
    {id: 'pop', name: _('Pop'), category: 'modern'},
    {id: 'redmond', name: _('Redmond'), category: 'modern'},
    {id: 'sleek', name: _('Sleek'), category: 'modern'},
    {id: 'tognee', name: _('tognee'), category: 'modern'},
    {id: 'unity', name: _('Unity'), category: 'modern'},
    {id: 'windows', name: _('Windows'), category: 'modern'},
    {id: 'zest', name: _('Zest'), category: 'modern'},
    {id: 'chromebook', name: _('Chromebook'), category: 'touch'},
    {id: 'elementary', name: _('Elementary'), category: 'touch'},
    {id: 'gnome-overview', name: _('GNOME Overview'), category: 'launcher'},
    {id: 'runner', name: _('Runner'), category: 'launcher'},
    {id: 'raven', name: _('Raven'), category: 'alternative'},
];

export const ArcMenuLogoSymbolic = 'arcmenu-logo-symbolic';

export const TranslatableSettingsStrings = [_('Software'), _('Settings'), _('Tweaks'), _('Terminal'),
    _('Activities Overview'), _('ArcMenu Settings'), _('Files')];

export const ShortcutCommands = {
    SUSPEND: 'ArcMenu_Suspend',
    LOG_OUT: 'ArcMenu_LogOut',
    POWER_OFF: 'ArcMenu_PowerOff',
    LOCK: 'ArcMenu_Lock',
    RESTART: 'ArcMenu_Restart',
    HYBRID_SLEEP: 'ArcMenu_HybridSleep',
    HIBERNATE: 'ArcMenu_Hibernate',
    SWITCH_USER: 'ArcMenu_SwitchUser',
    COMPUTER: 'ArcMenu_Computer',
    NETWORK: 'ArcMenu_Network',
    RECENT: 'ArcMenu_Recent',
    SOFTWARE: 'ArcMenu_Software',
    HOME: 'ArcMenu_Home',
    DOCUMENTS: 'ArcMenu_Documents',
    DOWNLOADS: 'ArcMenu_Downloads',
    MUSIC: 'ArcMenu_Music',
    PICTURES: 'ArcMenu_Pictures',
    VIDEOS: 'ArcMenu_Videos',
    ARCMENU_SETTINGS: 'gnome-extensions prefs arcmenu@arcmenu.com',
    FOLDER: 'ArcMenu_Folder',
    OVERVIEW: 'ArcMenu_ActivitiesOverview',
    SHOW_APPS: 'ArcMenu_ShowAllApplications',
    RUN_COMMAND: 'ArcMenu_RunCommand',
    SEPARATOR: 'ArcMenu_Separator',
    SPACER: 'ArcMenu_Spacer',
    SETTINGS: 'ArcMenu_Settings',
    SHOW_DESKTOP: 'ArcMenu_ShowDesktop',
    POWER_OPTIONS: 'ArcMenu_PowerOptions',
    SETTINGS_MENU: 'ArcMenu_SettingsMenu',
    SETTINGS_LAYOUT: 'ArcMenu_SettingsLayout',
    SETTINGS_BUTTON: 'ArcMenu_SettingsButton',
    SETTINGS_ABOUT: 'ArcMenu_SettingsAbout',
    SETTINGS_THEME: 'ArcMenu_SettingsTheme',
    PANEL_EXTENSION_SETTINGS: 'ArcMenu_PanelExtensionSettings',
    ARCMENU_ICON: 'ArcMenu_ArcMenuIcon',
};
