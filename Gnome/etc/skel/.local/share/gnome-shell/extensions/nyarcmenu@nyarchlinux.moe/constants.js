/* eslint-disable no-unused-vars */

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var DASH_TO_PANEL_UUID = 'dash-to-panel@jderose9.github.com';
var BLUR_MY_SHELL_UUID = 'blur-my-shell@aunetx';
var MATERIAL_YOU_UUID = 'material-you-theme@asubbiah.com';
var AZTASKBAR_UUID = 'aztaskbar@aztaskbar.gitlab.com';

var SearchbarLocation = {
    BOTTOM: 0,
    TOP: 1,
};

var MenuItemLocation = {
    BOTTOM: 0,
    TOP: 1,
};

var DisplayType = {
    LIST: 0,
    GRID: 1,
    BUTTON: 2,
};

var AvatarStyle = {
    ROUND: 0,
    SQUARE: 1,
};

var CategoryType = {
    FAVORITES: 0,
    FREQUENT_APPS: 1,
    ALL_PROGRAMS: 2,
    PINNED_APPS: 3,
    RECENT_FILES: 4,
    HOME_SCREEN: 5,
    SEARCH_RESULTS: 6,
    CATEGORIES_LIST: 7,
};

var DefaultMenuView = {
    PINNED_APPS: 0,
    CATEGORIES_LIST: 1,
    FREQUENT_APPS: 2,
    ALL_PROGRAMS: 3,
};

var SettingsPage = {
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
};

var DefaultMenuViewTognee = {
    CATEGORIES_LIST: 0,
    ALL_PROGRAMS: 1,
};

var DefaultMenuViewRedmond = {
    ALL_PROGRAMS: 0,
    PINNED_APPS: 1,
};

var SoftwareManagerIDs = ['org.manjaro.pamac.manager.desktop', 'pamac-manager.desktop',
    'io.elementary.appcenter.desktop', 'snap-store_ubuntu-software.desktop', 'snap-store_snap-store.desktop',
    'org.gnome.Software.desktop'];

var Categories = [
    {CATEGORY: CategoryType.FAVORITES, NAME: _('Favorites'), ICON: 'emblem-favorite-symbolic'},
    {CATEGORY: CategoryType.FREQUENT_APPS, NAME: _('Frequent Apps'), ICON: 'user-bookmarks-symbolic'},
    {CATEGORY: CategoryType.ALL_PROGRAMS, NAME: _('All Apps'), ICON: 'view-app-grid-symbolic'},
    {CATEGORY: CategoryType.PINNED_APPS, NAME: _('Pinned Apps'), ICON: 'view-pin-symbolic'},
    {CATEGORY: CategoryType.RECENT_FILES, NAME: _('Recent Files'), ICON: 'document-open-recent-symbolic'},
];

var TooltipLocation = {
    TOP_CENTERED: 0,
    BOTTOM_CENTERED: 1,
    BOTTOM: 2,
};

var ContextMenuLocation = {
    DEFAULT: 0,
    BOTTOM_CENTERED: 1,
    RIGHT: 2,
};

var SeparatorAlignment = {
    VERTICAL: 0,
    HORIZONTAL: 1,
};

var SeparatorStyle = {
    SHORT: 0,
    MEDIUM: 1,
    LONG: 2,
    MAX: 3,
    HEADER_LABEL: 4,
    NORMAL: 5,
};

var CaretPosition = {
    END: -1,
    START: 0,
    MIDDLE: 2,
};

var CategoryIconType = {
    FULL_COLOR: 0,
    SYMBOLIC: 1,
};

var ForcedMenuLocation = {
    OFF: 0,
    TOP_CENTERED: 1,
    BOTTOM_CENTERED: 2,
};

var IconSize = {
    DEFAULT: 0,
    EXTRA_SMALL: 1,
    SMALL: 2,
    MEDIUM: 3,
    LARGE: 4,
    EXTRA_LARGE: 5,
    HIDDEN: 6,
};

var GridIconSize = {
    DEFAULT: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3,
    SMALL_RECT: 4,
    MEDIUM_RECT: 5,
    LARGE_RECT: 6,
};

var GridIconInfo = [
    {NAME: 'SmallIconGrid', SIZE: 90, ICON_SIZE: 36, ENUM: GridIconSize.SMALL},
    {NAME: 'MediumIconGrid', SIZE: 97, ICON_SIZE: 42, ENUM: GridIconSize.MEDIUM},
    {NAME: 'LargeIconGrid', SIZE: 105, ICON_SIZE: 52, ENUM: GridIconSize.LARGE},
    {NAME: 'SmallRectIconGrid', SIZE: 95, ICON_SIZE: 28, ENUM: GridIconSize.SMALL_RECT},
    {NAME: 'MediumRectIconGrid', SIZE: 102, ICON_SIZE: 34, ENUM: GridIconSize.MEDIUM_RECT},
    {NAME: 'LargeRectIconGrid', SIZE: 105, ICON_SIZE: 42, ENUM: GridIconSize.LARGE_RECT},
];

var ICON_HIDDEN = 0;
var EXTRA_SMALL_ICON_SIZE = 16;
var SMALL_ICON_SIZE = 20;
var MEDIUM_ICON_SIZE = 25;
var LARGE_ICON_SIZE = 30;
var EXTRA_LARGE_ICON_SIZE = 35;
var MISC_ICON_SIZE = 24;

var SUPER_L = 'Super_L';

var HotkeyType = {
    SUPER_L: 0,
    CUSTOM: 1,
};

var SECTIONS = [
    'devices',
    'network',
    'bookmarks',
];

var Direction = {
    GO_NEXT: 0,
    GO_PREVIOUS: 1,
};

var MenuPosition = {
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2,
};

var RavenPosition = {
    LEFT: 0,
    RIGHT: 1,
};

var DiaglogType = {
    DEFAULT: 0,
    OTHER: 1,
    APPLICATIONS: 2,
    DIRECTORIES: 3,
};

var MenuSettingsListType = {
    PINNED_APPS: 0,
    APPLICATIONS: 1,
    DIRECTORIES: 2,
    EXTRA_SHORTCUTS: 3,
    POWER_OPTIONS: 4,
    EXTRA_CATEGORIES: 5,
    QUICK_LINKS: 6,
    CONTEXT_MENU: 7,
};

var MenuButtonAppearance = {
    ICON: 0,
    TEXT: 1,
    ICON_TEXT: 2,
    TEXT_ICON: 3,
    NONE: 4,
};

var PowerType = {
    LOGOUT: 0,
    LOCK: 1,
    RESTART: 2,
    POWER_OFF: 3,
    SUSPEND: 4,
    HYBRID_SLEEP: 5,
    HIBERNATE: 6,
    SWITCH_USER: 7,
};

var PowerDisplayStyle = {
    DEFAULT: 0,
    IN_LINE: 1,
    MENU: 2,
};

var PowerOptions = [
    {TYPE: PowerType.LOGOUT, ICON: 'system-log-out-symbolic', NAME: _('Log Out...')},
    {TYPE: PowerType.LOCK, ICON: 'changes-prevent-symbolic', NAME: _('Lock')},
    {TYPE: PowerType.RESTART, ICON: 'system-reboot-symbolic', NAME: _('Restart...')},
    {TYPE: PowerType.POWER_OFF, ICON: 'system-shutdown-symbolic', NAME: _('Power Off...')},
    {TYPE: PowerType.SUSPEND, ICON: 'media-playback-pause-symbolic', NAME: _('Suspend')},
    {TYPE: PowerType.HYBRID_SLEEP, ICON: 'weather-clear-night-symbolic', NAME: _('Hybrid Sleep')},
    {TYPE: PowerType.HIBERNATE, ICON: 'document-save-symbolic', NAME: _('Hibernate')},
    {TYPE: PowerType.SWITCH_USER, ICON: 'system-switch-user-symbolic', NAME: _('Switch User')},
];

// Icon type for the menu button
// set 'menu-button-icon' enum setting to value of desired icon type.
var MenuIconType = {
    MENU_ICON: 0,
    DISTRO_ICON: 1,
    CUSTOM: 2,
};

var MenuIconsPath = '/media/icons/menu_button_icons/icons/';
// Object order in MenuIcons array corresponds to the integer value of 'arc-menu-icon' setting
// i.e 'arc-menu-icon' value of 0 is arcmenu-logo-symbolic.
var MenuIcons = [
    {PATH: `${MenuIconsPath}icon-arcmenu-logo-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-arcmenu-logo-alt-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-arcmenu-old-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-arcmenu-old-alt-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-arcmenu-oldest-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-curved-a-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-focus-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-triple-dash-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-whirl-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-whirl-circle-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-sums-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-arrow-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-lins-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-diamond-square-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-octo-maze-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-search-glass-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-transform-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-toxic2-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-alien-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-cloud-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dragon-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-fly-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-pacman-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-peaks-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-pie-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-pointer-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-toxic-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-tree-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-zegon-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-apps-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-bug-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-cita-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dragonheart-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-eclipse-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-football-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-heddy-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-helmet-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-paint-palette-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-peeks-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-record-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-saucer-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-step-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-vancer-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-vibe-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-start-box-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dimond-win-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dolphin-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dota-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-football2-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-loveheart-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-pyrimid-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-rewind-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-snap-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-time-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-3d-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-a-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-app-launcher-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-bat-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-dra-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-equal-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-gnacs-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-groove-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-kaaet-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-launcher-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-pac-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-robots-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-sheild-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-somnia-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-utool-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-swirl-symbolic.svg`},
    {PATH: `${MenuIconsPath}icon-round-symbolic.svg`},
    {PATH: 'view-app-grid-symbolic'},
];

var DistroIconsPath = '/media/icons/menu_button_icons/distro_icons/';
// Object order in DistroIcons array corresponds to the integer value of 'distro-icon' setting
// i.e 'distro-icon' value of 3 is manjaro-logo.
var DistroIcons = [
    {PATH: `${DistroIconsPath}distro-gnome-symbolic.svg`, NAME: 'GNOME'},
    {PATH: `${DistroIconsPath}distro-debian-symbolic.svg`, NAME: 'Debian'},
    {PATH: `${DistroIconsPath}distro-fedora-symbolic.svg`, NAME: 'Fedora'},
    {PATH: `${DistroIconsPath}distro-manjaro-symbolic.svg`, NAME: 'Manjaro'},
    {PATH: `${DistroIconsPath}distro-pop-os-symbolic.svg`, NAME: 'Pop!_OS'},
    {PATH: `${DistroIconsPath}distro-ubuntu-symbolic.svg`, NAME: 'Ubuntu'},
    {PATH: `${DistroIconsPath}distro-arch-symbolic.svg`, NAME: 'Arch'},
    {PATH: `${DistroIconsPath}distro-opensuse-symbolic.svg`, NAME: 'OpenSUSE'},
    {PATH: `${DistroIconsPath}distro-raspbian-symbolic.svg`, NAME: 'Raspbian'},
    {PATH: `${DistroIconsPath}distro-kali-linux-symbolic.svg`, NAME: 'Kali Linux'},
    {PATH: `${DistroIconsPath}distro-pureos-symbolic.svg`, NAME: 'PureOS'},
    {PATH: `${DistroIconsPath}distro-solus-symbolic.svg`, NAME: 'Solus'},
    {PATH: `${DistroIconsPath}distro-budgie-symbolic.svg`, NAME: 'Budgie'},
    {PATH: `${DistroIconsPath}distro-gentoo-symbolic.svg`, NAME: 'Gentoo'},
    {PATH: `${DistroIconsPath}distro-mx-symbolic.svg`, NAME: 'MX Linux'},
    {PATH: `${DistroIconsPath}distro-redhat-symbolic.svg`, NAME: 'Redhat'},
    {PATH: `${DistroIconsPath}distro-voyager-symbolic.svg`, NAME: 'Voyager'},
    {PATH: `${DistroIconsPath}distro-zorin-symbolic.svg`, NAME: 'Zorin OS'},
    {PATH: `${DistroIconsPath}distro-endeavour-symbolic.svg`, NAME: 'Endeavour'},
    {PATH: `${DistroIconsPath}distro-nobara-symbolic.svg`, NAME: 'Nobara'},
];

var MenuLayout = {
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
};

var TraditionalMenus = [
    {IMAGE: 'menu-arcmenu-symbolic', TITLE: _('ArcMenu'), LAYOUT: MenuLayout.ARCMENU},
    {IMAGE: 'menu-brisk-symbolic', TITLE: _('Brisk'), LAYOUT: MenuLayout.BRISK},
    {IMAGE: 'menu-whisker-symbolic', TITLE: _('Whisker'), LAYOUT: MenuLayout.WHISKER},
    {IMAGE: 'menu-gnomemenu-symbolic', TITLE: _('GNOME Menu'), LAYOUT: MenuLayout.GNOME_MENU},
    {IMAGE: 'menu-mint-symbolic', TITLE: _('Mint'), LAYOUT: MenuLayout.MINT},
    {IMAGE: 'menu-budgie-symbolic', TITLE: _('Budgie'), LAYOUT: MenuLayout.BUDGIE},
];

var ModernMenus = [
    {IMAGE: 'menu-unity-symbolic', TITLE: _('Unity'), LAYOUT: MenuLayout.UNITY},
    {IMAGE: 'menu-plasma-symbolic', TITLE: _('Plasma'), LAYOUT: MenuLayout.PLASMA},
    {IMAGE: 'menu-tognee-symbolic', TITLE: _('tognee'), LAYOUT: MenuLayout.TOGNEE},
    {IMAGE: 'menu-insider-symbolic', TITLE: _('Insider'), LAYOUT: MenuLayout.INSIDER},
    {IMAGE: 'menu-redmond-symbolic', TITLE: _('Redmond'), LAYOUT: MenuLayout.REDMOND},
    {IMAGE: 'menu-windows-symbolic', TITLE: _('Windows'), LAYOUT: MenuLayout.WINDOWS},
    {IMAGE: 'menu-eleven-symbolic', TITLE: _('11'), LAYOUT: MenuLayout.ELEVEN},
    {IMAGE: 'menu-az-symbolic', TITLE: _('a.z.'), LAYOUT: MenuLayout.AZ},
    {IMAGE: 'menu-enterprise-symbolic', TITLE: _('Enterprise'), LAYOUT: MenuLayout.ENTERPRISE},
];

var TouchMenus = [
    {IMAGE: 'menu-elementary-symbolic', TITLE: _('Elementary'), LAYOUT: MenuLayout.ELEMENTARY},
    {IMAGE: 'menu-chromebook-symbolic', TITLE: _('Chromebook'), LAYOUT: MenuLayout.CHROMEBOOK},
];

var LauncherMenus = [
    {IMAGE: 'menu-runner-symbolic', TITLE: _('Runner'), LAYOUT: MenuLayout.RUNNER},
    {IMAGE: 'menu-gnomeoverview-symbolic', TITLE: _('GNOME Overview'), LAYOUT: MenuLayout.GNOME_OVERVIEW},
];

var AlternativeMenus = [
    {IMAGE: 'menu-raven-symbolic', TITLE: _('Raven'), LAYOUT: MenuLayout.RAVEN},
];

var MenuStyles = {
    STYLES: [
        {IMAGE: 'menustyle-traditional-symbolic', TITLE: _('Traditional'), MENU_TYPE: TraditionalMenus},
        {IMAGE: 'menustyle-modern-symbolic', TITLE: _('Modern'), MENU_TYPE: ModernMenus},
        {IMAGE: 'menustyle-touch-symbolic', TITLE: _('Touch'), MENU_TYPE: TouchMenus},
        {IMAGE: 'menustyle-launcher-symbolic', TITLE: _('Launcher'), MENU_TYPE: LauncherMenus},
        {IMAGE: 'menustyle-alternative-symbolic', TITLE: _('Alternative'), MENU_TYPE: AlternativeMenus},
    ],
};

var ArcMenuLogoSymbolic = `${Me.path}/media/icons/menu_icons/arcmenu-logo-symbolic.svg`;

var TranslatableSettingsStrings = [_('Software'), _('Settings'), _('Tweaks'), _('Terminal'),
    _('Activities Overview'), _('ArcMenu Settings'), _('Files')];

var ShortcutCommands = {
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
    ARCMENU_SETTINGS: 'gnome-extensions prefs nyarcmenu@nyarchlinux.moe',
    FOLDER: 'ArcMenu_Folder',
    OVERVIEW: 'ArcMenu_ActivitiesOverview',
    SHOW_APPS: 'ArcMenu_ShowAllApplications',
    RUN_COMMAND: 'ArcMenu_RunCommand',
    SEPARATOR: 'ArcMenu_Separator',
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

var DistroIconsDisclaimer = '<i>All brand icons are trademarks of their respective owners.' +
            ' The use of these trademarks does not indicate endorsement of the trademark holder ' +
            'by ArcMenu project, nor vice versa.' +
            ' Please do not use brand logos for any purpose except to represent the company, ' +
            'product, or service to which they refer.</i>' +
    '\n\n•   <b>GNOME®</b> - The GNOME name and logo are trademarks of the GNOME Foundation.' +
    '\n\n•   <b>Ubuntu®</b> - Ubuntu name and Ubuntu logo are trademarks of Canonical© Ltd.' +
    '\n\n•   <b>Fedora®</b> - Fedora and the Infinity design logo are trademarks of Red Hat, Inc.' +
    '\n\n•   <b>Debian®</b> - is a registered trademark owned by Software in the Public Interest.' +
    '\n\n•   <b>Manjaro®</b> - logo and name are trademarks of Manjaro GmbH &amp; Co. KG' +
    '\n\n•   <b>Pop_OS!®</b> - logo and name are trademarks of system 76© Inc.' +
    '\n\n•   <b>Arch Linux™</b> - The stylized Arch Linux logo is a recognized trademark of Arch Linux, ' +
                'copyright 2002–2017 Judd Vinet and Aaron Griffin.' +
    '\n\n•   <b>openSUSE®</b> - logo and name 2001–2020 SUSE LLC, © 2005–2020 openSUSE Contributors &amp; others.' +
    '\n\n•   <b>Raspberry Pi®</b> - logo and name are part of Raspberry Pi Foundation UK Registered Charity 1129409' +
    '\n\n•   <b>Kali Linux™</b> - logo and name are part of © OffSec Services Limited 2020' +
    '\n\n•   <b>PureOS</b> - logo and name are developed by members of the Purism community' +
    '\n\n•   <b>Solus</b> - logo and name are copyright © 2014–2018 by Solus Project' +
    '\n\n•   <b>Gentoo Authors©</b> - 2001–2020 Gentoo is a trademark of the Gentoo Foundation, Inc.' +
    '\n\n•   <b>Voyager© Linux</b> - name and logo' +
    '\n\n•   <b>MX Linux©</b> - 2020 - Linux - is the registered trademark of Linus Torvalds ' +
                'in the U.S. and other countries.' +
    '\n\n•   <b>Red Hat, Inc.©</b> - Copyright 2020 name and logo' +
    '\n\n•   <b>ZORIN OS</b> - The "Z" logomark is a registered trademark of Zorin Technology Group Ltd. ' +
                'Copyright © 2019 - 2021 Zorin Technology Group Ltd';

var DEVELOPERS = '<b><a href="https://gitlab.com/AndrewZaech">AndrewZaech</a></b> - Current ArcMenu Maintainer and Developer' +
                '\n\n<b><a href="https://gitlab.com/LinxGem33">AndyC</a></b> - ArcMenu Founder, Former Maintainer, Digital Art Designer';
var CONTRIBUTORS = '<b>Thank you to all contributors and translators</b>\n\n' +
                    '<b><a href="https://gitlab.com/arcmenu/ArcMenu#contributors">Contributors</a></b> - ' +
                    '<b><a href="https://gitlab.com/arcmenu/ArcMenu#translators">Translators</a></b>';
var ARTWORK = '<b>Digital Artwork</b>\n\n' +
                '<b><a href="https://gitlab.com/LinxGem33">AndyC</a></b> - Custom icons and other ArcMenu Assets' +
                '\n\n<b><a href="https://gitlab.com/AndrewZaech">AndrewZaech</a></b> - Modification of some custom icons';

var GNU_SOFTWARE = '<span size="small">' +
    'This program comes with absolutely no warranty.\n' +
    'See the <a href="https://gnu.org/licenses/old-licenses/gpl-2.0.html">' +
    'GNU General Public License, version 2 or later</a> for details.' +
    '</span>';
