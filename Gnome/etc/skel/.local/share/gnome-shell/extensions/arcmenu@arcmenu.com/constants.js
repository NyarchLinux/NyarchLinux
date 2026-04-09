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
    {CATEGORY: CategoryType.FAVORITES, NAME: _('Favorites'), IMAGE: 'emote-love-symbolic'},
    {CATEGORY: CategoryType.FREQUENT_APPS, NAME: _('Frequent Apps'), IMAGE: 'user-bookmarks-symbolic'},
    {CATEGORY: CategoryType.ALL_PROGRAMS, NAME: _('All Apps'), IMAGE: 'view-app-grid-symbolic'},
    {CATEGORY: CategoryType.PINNED_APPS, NAME: _('Pinned Apps'), IMAGE: 'view-pin-symbolic'},
    {CATEGORY: CategoryType.RECENT_FILES, NAME: _('Recent Files'), IMAGE: 'document-open-recent-symbolic'},
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

export const CategoryIconType = {
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

export const IconSize = {
    DEFAULT: 0,
    EXTRA_SMALL: 1,
    SMALL: 2,
    MEDIUM: 3,
    LARGE: 4,
    EXTRA_LARGE: 5,
    HIDDEN: 6,
};

export const GridIconSize = {
    DEFAULT: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3,
    SMALL_RECT: 4,
    MEDIUM_RECT: 5,
    LARGE_RECT: 6,
    CUSTOM: 7,
    EXTRA_LARGE: 8,
};

export const GridIconInfo = [
    {ENUM: GridIconSize.SMALL, WIDTH: 80, HEIGHT: 80, ICON_SIZE: 36},
    {ENUM: GridIconSize.MEDIUM, WIDTH: 87, HEIGHT: 87, ICON_SIZE: 42},
    {ENUM: GridIconSize.LARGE, WIDTH: 95, HEIGHT: 95, ICON_SIZE: 52},
    {ENUM: GridIconSize.SMALL_RECT, WIDTH: 85, HEIGHT: 70, ICON_SIZE: 28},
    {ENUM: GridIconSize.MEDIUM_RECT, WIDTH: 92, HEIGHT: 78, ICON_SIZE: 34},
    {ENUM: GridIconSize.LARGE_RECT, WIDTH: 95, HEIGHT: 85, ICON_SIZE: 42},
    {ENUM: GridIconSize.EXTRA_LARGE, WIDTH: 148, HEIGHT: 148, ICON_SIZE: 68},
];

export const ICON_HIDDEN = 0;
export const EXTRA_SMALL_ICON_SIZE = 16;
export const SMALL_ICON_SIZE = 20;
export const MEDIUM_ICON_SIZE = 25;
export const LARGE_ICON_SIZE = 30;
export const EXTRA_LARGE_ICON_SIZE = 35;
export const MISC_ICON_SIZE = 24;

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
    {TYPE: PowerType.LOGOUT, IMAGE: 'system-log-out-symbolic', NAME: _('Log Out...')},
    {TYPE: PowerType.LOCK, IMAGE: 'changes-prevent-symbolic', NAME: _('Lock')},
    {TYPE: PowerType.RESTART, IMAGE: 'system-reboot-symbolic', NAME: _('Restart...')},
    {TYPE: PowerType.POWER_OFF, IMAGE: 'system-shutdown-symbolic', NAME: _('Power Off...')},
    {TYPE: PowerType.SUSPEND, IMAGE: 'media-playback-pause-symbolic', NAME: _('Suspend')},
    {TYPE: PowerType.HYBRID_SLEEP, IMAGE: 'weather-clear-night-symbolic', NAME: _('Hybrid Sleep')},
    {TYPE: PowerType.HIBERNATE, IMAGE: 'document-save-symbolic', NAME: _('Hibernate')},
    {TYPE: PowerType.SWITCH_USER, IMAGE: 'system-switch-user-symbolic', NAME: _('Switch User')},
];

// Deprecated - icons are now packaged in GResource.
export const MenuIcons = [
    {IMAGE: 'icon-arcmenu-logo-symbolic'},
    {IMAGE: 'icon-arcmenu-logo-alt-symbolic'},
    {IMAGE: 'icon-arcmenu-old-symbolic'},
    {IMAGE: 'icon-arcmenu-old-alt-symbolic'},
    {IMAGE: 'icon-arcmenu-oldest-symbolic'},
    {IMAGE: 'icon-curved-a-symbolic'},
    {IMAGE: 'icon-focus-symbolic'},
    {IMAGE: 'icon-triple-dash-symbolic'},
    {IMAGE: 'icon-whirl-symbolic'},
    {IMAGE: 'icon-whirl-circle-symbolic'},
    {IMAGE: 'icon-sums-symbolic'},
    {IMAGE: 'icon-arrow-symbolic'},
    {IMAGE: 'icon-lins-symbolic'},
    {IMAGE: 'icon-diamond-square-symbolic'},
    {IMAGE: 'icon-octo-maze-symbolic'},
    {IMAGE: 'icon-search-glass-symbolic'},
    {IMAGE: 'icon-transform-symbolic'},
    {IMAGE: 'icon-toxic2-symbolic'},
    {IMAGE: 'icon-alien-symbolic'},
    {IMAGE: 'icon-cloud-symbolic'},
    {IMAGE: 'icon-dragon-symbolic'},
    {IMAGE: 'icon-fly-symbolic'},
    {IMAGE: 'icon-pacman-symbolic'},
    {IMAGE: 'icon-peaks-symbolic'},
    {IMAGE: 'icon-pie-symbolic'},
    {IMAGE: 'icon-pointer-symbolic'},
    {IMAGE: 'icon-toxic-symbolic'},
    {IMAGE: 'icon-tree-symbolic'},
    {IMAGE: 'icon-zegon-symbolic'},
    {IMAGE: 'icon-apps-symbolic'},
    {IMAGE: 'icon-bug-symbolic'},
    {IMAGE: 'icon-cita-symbolic'},
    {IMAGE: 'icon-dragonheart-symbolic'},
    {IMAGE: 'icon-eclipse-symbolic'},
    {IMAGE: 'icon-football-symbolic'},
    {IMAGE: 'icon-heddy-symbolic'},
    {IMAGE: 'icon-helmet-symbolic'},
    {IMAGE: 'icon-paint-palette-symbolic'},
    {IMAGE: 'icon-peeks-symbolic'},
    {IMAGE: 'icon-record-symbolic'},
    {IMAGE: 'icon-saucer-symbolic'},
    {IMAGE: 'icon-step-symbolic'},
    {IMAGE: 'icon-vancer-symbolic'},
    {IMAGE: 'icon-vibe-symbolic'},
    {IMAGE: 'icon-start-box-symbolic'},
    {IMAGE: 'icon-dimond-win-symbolic'},
    {IMAGE: 'icon-dolphin-symbolic'},
    {IMAGE: 'icon-dota-symbolic'},
    {IMAGE: 'icon-football2-symbolic'},
    {IMAGE: 'icon-loveheart-symbolic'},
    {IMAGE: 'icon-pyrimid-symbolic'},
    {IMAGE: 'icon-rewind-symbolic'},
    {IMAGE: 'icon-snap-symbolic'},
    {IMAGE: 'icon-time-symbolic'},
    {IMAGE: 'icon-3d-symbolic'},
    {IMAGE: 'icon-a-symbolic'},
    {IMAGE: 'icon-app-launcher-symbolic'},
    {IMAGE: 'icon-bat-symbolic'},
    {IMAGE: 'icon-dra-symbolic'},
    {IMAGE: 'icon-equal-symbolic'},
    {IMAGE: 'icon-gnacs-symbolic'},
    {IMAGE: 'icon-groove-symbolic'},
    {IMAGE: 'icon-kaaet-symbolic'},
    {IMAGE: 'icon-launcher-symbolic'},
    {IMAGE: 'icon-pac-symbolic'},
    {IMAGE: 'icon-robots-symbolic'},
    {IMAGE: 'icon-sheild-symbolic'},
    {IMAGE: 'icon-somnia-symbolic'},
    {IMAGE: 'icon-utool-symbolic'},
    {IMAGE: 'icon-swirl-symbolic'},
    {IMAGE: 'icon-round-symbolic'},
    {IMAGE: 'view-app-grid-symbolic'},
];
// Deprecated - icons are now packaged in GResource.
export const DistroIcons = [
    {IMAGE: 'distro-gnome-symbolic'},
    {IMAGE: 'distro-debian-symbolic'},
    {IMAGE: 'distro-fedora-symbolic'},
    {IMAGE: 'distro-manjaro-symbolic'},
    {IMAGE: 'distro-pop-os-symbolic'},
    {IMAGE: 'distro-ubuntu-symbolic'},
    {IMAGE: 'distro-arch-symbolic'},
    {IMAGE: 'distro-opensuse-symbolic'},
    {IMAGE: 'distro-raspbian-symbolic'},
    {IMAGE: 'distro-kali-linux-symbolic'},
    {IMAGE: 'distro-pureos-symbolic'},
    {IMAGE: 'distro-solus-symbolic'},
    {IMAGE: 'distro-budgie-symbolic'},
    {IMAGE: 'distro-gentoo-symbolic'},
    {IMAGE: 'distro-mx-symbolic'},
    {IMAGE: 'distro-redhat-symbolic'},
    {IMAGE: 'distro-voyager-symbolic'},
    {IMAGE: 'distro-zorin-symbolic'},
    {IMAGE: 'distro-endeavour-symbolic'},
    {IMAGE: 'distro-nobara-symbolic'},
    {IMAGE: 'distro-pardus-symbolic'},
    {IMAGE: 'distro-cachyos-symbolic'},
    {IMAGE: 'distro-nixos-symbolic'},
    {IMAGE: 'distro-oreon-symbolic'},
];

export const MenuLayout = {
    ARCMENU: 0,
    BRISK: 1,
    WHISKER: 2,
    GNOME_MENU: 3,
    MINT: 4,
    ELEMENTARY: 5,
    GNOME_OVERVIEW: 6,
    REDMOND: 7,
    UNITY: 8,
    BUDGIE: 9,
    INSIDER: 10,
    RUNNER: 11,
    CHROMEBOOK: 12,
    RAVEN: 13,
    TOGNEE: 14,
    PLASMA: 15,
    WINDOWS: 16,
    ELEVEN: 17,
    AZ: 18,
    ENTERPRISE: 19,
    POP: 20,
    SLEEK: 21,
    ZEST: 22,
};

export const TraditionalMenus = [
    {
        LAYOUT: MenuLayout.ARCMENU,
        TITLE: _('ArcMenu'),
        IMAGE: 'menu-arcmenu-symbolic',
    },
    {
        LAYOUT: MenuLayout.BRISK,
        TITLE: _('Brisk'),
        IMAGE: 'menu-brisk-symbolic',
    },
    {
        LAYOUT: MenuLayout.WHISKER,
        TITLE: _('Whisker'),
        IMAGE: 'menu-whisker-symbolic',
    },
    {
        LAYOUT: MenuLayout.GNOME_MENU,
        TITLE: _('GNOME Menu'),
        IMAGE: 'menu-gnomemenu-symbolic',
    },
    {
        LAYOUT: MenuLayout.MINT,
        TITLE: _('Mint'),
        IMAGE: 'menu-mint-symbolic',
    },
    {
        LAYOUT: MenuLayout.BUDGIE,
        TITLE: _('Budgie'),
        IMAGE: 'menu-budgie-symbolic',
    },
];

export const ModernMenus = [
    {
        LAYOUT: MenuLayout.UNITY,
        TITLE: _('Unity'),
        IMAGE: 'menu-unity-symbolic',
    },
    {
        LAYOUT: MenuLayout.PLASMA,
        TITLE: _('Plasma'),
        IMAGE: 'menu-plasma-symbolic',
    },
    {
        LAYOUT: MenuLayout.TOGNEE,
        TITLE: _('tognee'),
        IMAGE: 'menu-tognee-symbolic',
    },
    {
        LAYOUT: MenuLayout.INSIDER,
        TITLE: _('Insider'),
        IMAGE: 'menu-insider-symbolic',
    },
    {
        LAYOUT: MenuLayout.REDMOND,
        TITLE: _('Redmond'),
        IMAGE: 'menu-redmond-symbolic',
    },
    {
        LAYOUT: MenuLayout.WINDOWS,
        TITLE: _('Windows'),
        IMAGE: 'menu-windows-symbolic',
    },
    {
        LAYOUT: MenuLayout.ELEVEN,
        TITLE: _('11'),
        IMAGE: 'menu-eleven-symbolic',
    },
    {
        LAYOUT: MenuLayout.AZ,
        TITLE: _('a.z.'),
        IMAGE: 'menu-az-symbolic',
    },
    {
        LAYOUT: MenuLayout.ENTERPRISE,
        TITLE: _('Enterprise'),
        IMAGE: 'menu-enterprise-symbolic',
    },
    {
        LAYOUT: MenuLayout.POP,
        TITLE: _('Pop'),
        IMAGE: 'menu-pop-symbolic',
    },
    {
        LAYOUT: MenuLayout.SLEEK,
        TITLE: _('Sleek'),
        IMAGE: 'menu-sleek-symbolic',
    },
    {
        LAYOUT: MenuLayout.ZEST,
        TITLE: _('Zest'),
        IMAGE: 'menu-zest-symbolic',
    },
];

export const TouchMenus = [
    {
        LAYOUT: MenuLayout.ELEMENTARY,
        TITLE: _('Elementary'),
        IMAGE: 'menu-elementary-symbolic',
    },
    {
        LAYOUT: MenuLayout.CHROMEBOOK,
        TITLE: _('Chromebook'),
        IMAGE: 'menu-chromebook-symbolic',
    },
];

export const LauncherMenus = [
    {
        LAYOUT: MenuLayout.RUNNER,
        TITLE: _('Runner'),
        IMAGE: 'menu-runner-symbolic',
    },
    {
        LAYOUT: MenuLayout.GNOME_OVERVIEW,
        TITLE: _('GNOME Overview'),
        IMAGE: 'menu-gnomeoverview-symbolic',
    },
];

export const AlternativeMenus = [
    {
        LAYOUT: MenuLayout.RAVEN,
        TITLE: _('Raven'),
        IMAGE: 'menu-raven-symbolic',
    },
];

export const MenuStyles = [
    {
        MENU_TYPE: TraditionalMenus,
        TITLE: _('Traditional'),
        IMAGE: 'menustyle-traditional-symbolic',
    },
    {
        MENU_TYPE: ModernMenus,
        TITLE: _('Modern'),
        IMAGE: 'menustyle-modern-symbolic',
    },
    {
        MENU_TYPE: TouchMenus,
        TITLE: _('Touch'),
        IMAGE: 'menustyle-touch-symbolic',
    },
    {
        MENU_TYPE: LauncherMenus,
        TITLE: _('Launcher'),
        IMAGE: 'menustyle-launcher-symbolic',
    },
    {
        MENU_TYPE: AlternativeMenus,
        TITLE: _('Alternative'),
        IMAGE: 'menustyle-alternative-symbolic',
    },
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
