const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const GObject              = imports.gi.GObject
const Gtk                  = imports.gi.Gtk

// local Modules
const { show_err_msg }     = Me.imports.utils.prefs
const { connections }      = Me.imports.utils.connections
const { constants }        = Me.imports.utils.constants
const { on_picked, pick }  = Me.imports.dbus.client
const { _ }                = Me.imports.utils.i18n

// types


// ----------------------------------------------------------------- end imports

var AppRow = GObject.registerClass (
  {
    Template: `file://${Me.path}/preferences/widgets/app-row.ui`,
    GTypeName: 'AppRow',
    InternalChildren: [
      'wm_class_instance_entry',
      'remove_button',
      'change_title_btn',
      'pick_window_btn',
      'title',
      'description',
      'expand_img',
      'revealer',
      'expanded_list_box',
    ],
  },
  class extends Gtk.ListBoxRow {
    _init (cb) {
      super._init ()
      this.cb = cb

      const c = connections.get ()
      c.connect (this._remove_button, 'clicked', (btn) => {
        if (this._revealer.reveal_child) {
          this.disconnect_signals ()
        }
        connections.get ().disconnect_all (btn)
        connections.get ().disconnect_all (this)
        cb && cb.on_delete && cb.on_delete (this, this._title.label)
      })

      c.connect (this._expand_img, 'clicked', () => this.on_expanded_changed ())
    }

    set title (t) {
      this._title.label = t
      this._title.visible = this._title.label != ''
      this._description.visible = this._description.label != ''
    }
    get title () {
      return this._title.label
    }
    set description (d) {
      this._description.label = d
      this._title.visible = this._title.label != ''
      this._description.visible = this._description.label != ''
    }

    on_expanded_changed () {
      this._revealer.reveal_child = !this._revealer.reveal_child
      if (this._revealer.reveal_child) {
        this._expand_img.add_css_class ('rotated')
        this._wm_class_instance_entry.text = this._title.label
        this.connect_signals ()
        this.cb && this.cb.on_open && this.cb.on_open (this)
      } else {
        this._expand_img.remove_css_class ('rotated')
        this.change_title ()
        this.disconnect_signals ()
        this.cb && this.cb.on_close && this.cb.on_close ()
      }
    }

    add_row (child) {
      this._expanded_list_box.append (child)
    }

    connect_signals () {
      const c = connections.get ()
      c.connect (this._change_title_btn, 'clicked', () => {
        this.change_title ()
      })
      c.connect (this._pick_window_btn, 'clicked', () => {
        on_picked ((wm_instance_class) => {
          const title = _ ('Can\'t pick a window window from this position')
          if (wm_instance_class == 'window-not-found') {
            show_err_msg (title)
            return
          }
          this._wm_class_instance_entry.text = wm_instance_class
        })
        pick ()
      })
    }

    disconnect_signals () {
      this.bind_property_handler?.unbind ()
      connections.get ().disconnect_all (this._change_title_btn)
      connections.get ().disconnect_all (this._pick_window_btn)
    }

    change_title () {
      if (
        !this.cb ||
        !this.cb.on_title_changed ||
        this._title.label == this._wm_class_instance_entry.text ||
        this._wm_class_instance_entry.text == ''
      ) {
        return
      }

      if (
        this.cb.on_title_changed (
          this._title.label, // old title
          this._wm_class_instance_entry.text // new title
        )
      ) {
        this.title = this._wm_class_instance_entry.text
        this.description = ''
      } else {
        if (this.title == '') {
          this.description = constants.TIPS_EMPTY ()
        }
      }
    }
  }
)
