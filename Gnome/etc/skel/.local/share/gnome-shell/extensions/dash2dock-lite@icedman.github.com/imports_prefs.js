const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Adw = imports.gi.Adw;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain('dash2dock-lite');
const _ = Gettext.gettext;

function init() {
  ExtensionUtils.initTranslations();
  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path(`${Me.dir.get_path()}/ui/icons`);
}

function buildPrefsWidget() {
  let notebook = new Gtk.Notebook();
  notebook.add = ((p) => {
    notebook.append_page.bind(p, new Gtk.Label({ label: _('General') }));
  }).bind(notebook);
  notebook.set_search_enabled = () => {};

  let p = new Preferences();
  p.path = Me.dir.get_path();
  p.fillPreferencesWindow(notebook);

  return notebook;
}

function fillPreferencesWindow(window) {
  let p = new Preferences();
  p.path = Me.dir.get_path();
  p.fillPreferencesWindow(window);
}
