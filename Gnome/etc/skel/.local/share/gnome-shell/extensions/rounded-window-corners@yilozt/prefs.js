const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gtk                          = imports.gi.Gtk
const Gdk                          = imports.gi.Gdk
const { getCurrentExtension }      = imports.misc.extensionUtils

const { pages }                    = Me.imports.preferences.index
const { init_translations_prefs }  = Me.imports.utils.i18n



function load_css () {
  const display = Gdk.Display.get_default ()
  if (display) {
    const css = new Gtk.CssProvider ()
    const path = `${getCurrentExtension ().path}/stylesheet-prefs.css`
    css.load_from_path (path)
    Gtk.StyleContext.add_provider_for_display (display, css, 0)
  }
}

function init () {
  init_translations_prefs ()
}

// Load preferences Pages for Gnome 40 / Gnome 41
function buildPrefsWidget () {
  const scrolled_win = new Gtk.ScrolledWindow ()
  const stack = new Gtk.Stack ({ css_classes: ['page'] })
  const switcher = new Gtk.StackSwitcher ({ stack })

  scrolled_win.set_child (stack)

  // Add StackSwitcher into HeaderBar
  scrolled_win.connect ('realize', () => {
    const win = scrolled_win.root
    win.width_request = 550
    const title_bar = win.get_titlebar ()
    title_bar?.set_title_widget (switcher)
  })

  // Load pages
  for (const page of pages ()) {
    stack.add_titled (page.widget, page.title, page.title)
  }

  // Load css
  load_css ()

  return scrolled_win
}

// Load ui for Gnome 42+
function fillPreferencesWindow (win) {
  const Adw = imports.gi.Adw

  for (const page of pages ()) {
    const pref_page = new Adw.PreferencesPage ({
      title: page.title,
      icon_name: page.icon_name,
    })
    const group = new Adw.PreferencesGroup ()
    pref_page.add (group)
    group.add (page.widget)
    win.add (pref_page)
  }

  load_css ()
}
