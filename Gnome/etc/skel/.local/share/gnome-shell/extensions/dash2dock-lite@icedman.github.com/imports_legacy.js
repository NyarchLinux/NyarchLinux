const Main = imports.ui.main;
const BoxPointer = imports.ui.boxpointer;
const PopupMenu = imports.ui.popupMenu;
const Fav = imports.ui.appFavorites;
const IconGrid = imports.ui.iconGrid;
const Layout = imports.ui.layout;
const BaseIcon = IconGrid.BaseIcon;

const ExtensionUtils = imports.misc.extensionUtils;
// const Utils = imports.shell.util;
// const trySpawnCommandLine = Utils.trySpawnCommandLine;

const Dash = imports.ui.dash.Dash;
const ShowAppsIcon = imports.ui.dash.ShowAppsIcon;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Graphene = imports.gi.Graphene;
const St = imports.gi.St;
const PangoCairo = imports.gi.PangoCairo;
const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Cairo = imports.cairo;

const Point = Graphene.Point;

class Extension {}

function init() {
  return new Dash2DockLiteExt();
}
