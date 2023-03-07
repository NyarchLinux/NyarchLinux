const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const GObject                 = imports.gi.GObject
const Gdk                     = imports.gi.Gdk
const Gio                     = imports.gi.Gio

// local modules
const { settings }            = Me.imports.utils.settings
const { connections }         = Me.imports.utils.connections
const { list_children }       = Me.imports.utils.prefs
const { _log }                = Me.imports.utils.log
const { RoundedCornersItem }  = Me.imports.preferences.widgets.rounded_corners_item
const { EditShadowWindow }    = Me.imports.preferences.widgets.edit_shadow_window
const { ResetDialog }         = Me.imports.preferences.widgets.reset_dialog

// types
const Gtk                     = imports.gi.Gtk


// --------------------------------------------------------------- [end imports]

var General = GObject.registerClass (
  {
    Template: `file://${Me.path}/preferences/pages/general.ui`,
    GTypeName: 'RoundedWindowCornersPrefsGeneral',

    // Widgets export from template ui
    InternalChildren: [
      'global_settings_preferences_group',
      'enable_log_switch',
      'skip_libadwaita_app_switch',
      'skip_libhandy_app_switch',
      'tweak_kitty_switch',
      'preferences_entry_switch',
      'border_width_ajustment',
      'border_color_button',
      'edit_shadow_row',
      'applications_group',
      'reset_preferences_btn',
    ],
  },
  class extends Gtk.Box {
    _init () {
      super._init ()

      this.config_items = new RoundedCornersItem ()

      this.build_ui ()

      connections
        .get ()
        .connect (settings ().g_settings, 'changed', (settings, key) =>
          this._on_settings_changed (key)
        )

      settings ().bind (
        'debug-mode',
        this._enable_log_switch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
      )
      settings ().bind (
        'tweak-kitty-terminal',
        this._tweak_kitty_switch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
      )
      settings ().bind (
        'enable-preferences-entry',
        this._preferences_entry_switch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
      )
      settings ().bind (
        'skip-libadwaita-app',
        this._skip_libadwaita_app_switch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
      )
      settings ().bind (
        'skip-libhandy-app',
        this._skip_libhandy_app_switch,
        'active',
        Gio.SettingsBindFlags.DEFAULT
      )
      settings ().bind (
        'border-width',
        this._border_width_ajustment,
        'value',
        Gio.SettingsBindFlags.DEFAULT
      )

      const color = settings ().border_color
      this._border_color_button.rgba = new Gdk.RGBA ({
        red: color[0],
        green: color[1],
        blue: color[2],
        alpha: color[3],
      })

      const c = connections.get ()
      c.connect (this._border_color_button, 'color-set', (source) => {
        const color = source.get_rgba ()
        settings ().border_color = [
          color.red,
          color.green,
          color.blue,
          color.alpha,
        ]
      })

      // Handler active event for BoxList
      c.connect (
        this._global_settings_preferences_group,
        'row-activated',
        (box, row) => {
          if (row == this.config_items._paddings_row) {
            this.config_items.update_revealer ()
          }
        }
      )

      c.connect (this._applications_group, 'row-activated', (box, row) => {
        if (row === this._edit_shadow_row) {
          this._show_edit_shadow_window_cb ()
        }
      })

      c.connect (this._reset_preferences_btn, 'clicked', () => {
        new ResetDialog ().show ()
      })
    }

    vfunc_root () {
      super.vfunc_root ()
      const win = this.root

      // Disconnect all signal when close prefs
      win.connect ('close-request', () => {
        _log ('Disconnect Signals')
        connections.get ().disconnect_all ()
        connections.del ()
      })
    }

    build_ui () {
      list_children (this.config_items).forEach ((i) => {
        this.config_items.remove (i)
        this._global_settings_preferences_group.append (i)
      })
      // Bind Variants
      this.config_items.cfg = settings ().global_rounded_corner_settings
      this.config_items.watch ((cfg) => {
        settings ().global_rounded_corner_settings = cfg
      })
    }

    // ---------------------------------------------------- [signal handler]

    /** Called when click 'Window Shadow' action row */
    _show_edit_shadow_window_cb () {
      const root = this.root
      const win = new EditShadowWindow ()
      win.application = root.application
      win.present ()
      root.hide ()
      win.connect ('close-request', () => {
        root.show ()
        win.destroy ()
      })
    }

    /** Update UI when settings changed  */
    _on_settings_changed (key) {
      switch (key) {
      case 'border-color':
        {
          const color = settings ().border_color
          this._border_color_button.rgba = new Gdk.RGBA ({
            red: color[0],
            green: color[1],
            blue: color[2],
            alpha: color[3],
          })
        }
        break
      case 'border-width':
        this._border_width_ajustment.value = settings ().border_width
        break
      case 'global-rounded-corner-settings':
        this.config_items.cfg = settings ().global_rounded_corner_settings
        break
      default:
      }
    }
  }
)
