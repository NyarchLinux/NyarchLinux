const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const Gtk                 = imports.gi.Gtk
const { registerClass }   = imports.gi.GObject

// local modules
const { box_shadow_css }  = Me.imports.utils.types
const { settings }        = Me.imports.utils.settings
const { _ }               = Me.imports.utils.i18n

// ----------------------------------------------------------------- end imports

/**
 * Shadow edit window
 *
 * This widget used to edit shadow of windows which use rounded corners
 * effects.
 */
var EditShadowWindow = registerClass (
  {
    Template: `file://${Me.path}/preferences/widgets/edit-shadow-window.ui`,
    GTypeName: 'EditShadowWindow',
    InternalChildren: [
      'opacity_scale',
      'spread_radius_scale',
      'blur_offset_scale',
      'vertical_offset_scale',
      'horizontal_offset_scale',
      'unfocus_shadow_widget',
      'focus_shadow_widget',
      'focus_toggle_button',
      'unfocus_toggle_button',
    ],
  },
  class extends Gtk.Window {
    _init () {
      super._init ({
        title: _ ('Edit Shadow for Rounded Corners Windows'),
        modal: true,
      })

      this.unfocus_provider = new Gtk.CssProvider ()
      this.focus_provider = new Gtk.CssProvider ()
      this.focused_shadow = settings ().focused_shadow
      this.unfocused_shadow = settings ().unfocused_shadow

      // Init style of preview widgets
      this._unfocus_shadow_widget
        .get_style_context ()
        .add_provider (
          this.unfocus_provider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )
      this._focus_shadow_widget
        .get_style_context ()
        .add_provider (
          this.focus_provider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

      // Init value controls from settings
      this.update_widget ()
      this.update_style ()

      // Update values of controls when click toggle button
      this._focus_toggle_button.connect ('toggled', () => {
        this._unfocus_toggle_button.active = !this._focus_toggle_button.active
        this.update_widget ()
      })
      this._unfocus_toggle_button.connect ('toggled', () => {
        this._focus_toggle_button.active = !this._unfocus_toggle_button.active
        this.update_widget ()
      })
    }

    update_widget () {
      const shadow = this._focus_toggle_button.get_active ()
        ? this.focused_shadow
        : this.unfocused_shadow
      this._vertical_offset_scale.set_value (shadow.vertical_offset)
      this._horizontal_offset_scale.set_value (shadow.horizontal_offset)
      this._blur_offset_scale.set_value (shadow.blur_offset)
      this._spread_radius_scale.set_value (shadow.spread_radius)
      this._opacity_scale.set_value (shadow.opacity)
    }

    update_cfg () {
      const shadow = {
        vertical_offset: this._vertical_offset_scale.get_value (),
        horizontal_offset: this._horizontal_offset_scale.get_value (),
        blur_offset: this._blur_offset_scale.get_value (),
        spread_radius: this._spread_radius_scale.get_value (),
        opacity: this._opacity_scale.get_value (),
      }
      if (this._focus_toggle_button.get_active ()) {
        this.focused_shadow = shadow
      } else {
        this.unfocused_shadow = shadow
      }

      // Store into settings
      settings ().unfocused_shadow = this.unfocused_shadow
      settings ().focused_shadow = this.focused_shadow
    }

    update_style () {
      const gen_style = (normal, hover) => `label {
           background-color: white;
           transition: box-shadow 200ms;
           color: black;
           ${box_shadow_css (normal)};
         }
         label:hover {
           ${box_shadow_css (hover)};
         }`

      this.unfocus_provider.load_from_data (
        gen_style (this.unfocused_shadow, this.focused_shadow)
      )
      this.focus_provider.load_from_data (
        gen_style (this.focused_shadow, this.unfocused_shadow)
      )
    }

    // signal handles

    on_value_changed () {
      this.update_cfg ()
      this.update_style ()
    }
  }
)
