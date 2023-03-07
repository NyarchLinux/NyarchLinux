const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const GLib             = imports.gi.GLib

// gnome modules
const { getSettings }  = imports.misc.extensionUtils


// --------------------------------------------------------------- [end imports]

/** This object use to store key of settings and its type string */
const type_of_keys = {}

/**
 * Simple wrapper of Gio.Settings, we will use this class to store and
 * load settings for this gnome-shell extensions.
 */
class Settings {
  constructor () {
    /** GSettings, which used to store and load settings */
    this.g_settings = getSettings (
      'org.gnome.shell.extensions.rounded-window-corners'
    )
    // Define getter and setter for properties in class for keys in
    // schemas
    this.g_settings.list_keys ().forEach ((key) => {
      // Cache type string of keys first
      const default_val = this.g_settings.get_default_value (key)
      if (default_val == null) {
        log ('Err: Key of Settings undefined: ' + key)
        return
      }
      type_of_keys[key] = default_val.get_type_string ()

      // Define getter and setter for keys
      Object.defineProperty (this, key.replace (/-/g, '_'), {
        get: () => this.g_settings.get_value (key).recursiveUnpack (),
        set: (val) => {
          const variant =
            type_of_keys[key] == 'a{sv}'
              ? this._pack_val (val)
              : new GLib.Variant (type_of_keys[key], val)
          this.g_settings.set_value (key, variant)
        },
      })
    })

    /** Port rounded corners settings to new version  */
    this._fix ()
  }

  /**
   * Just a simple wrapper to this.settings.bind(), use SchemasKeys
   * to help us check source_prop
   */
  bind (source_prop, target, target_prop, flags) {
    this.g_settings.bind (source_prop, target, target_prop, flags)
  }

  // ------------------------------------------------------- [private methods]

  /**
   * this method is used to pack javascript values into GLib.Variant when type
   * of key is `a{sv}`
   *
   * @param val Javascript object to convert
   * @returns A GLib.Variant with type `a{sv}`
   */
  _pack_val (val) {
    if (val instanceof Object) {
      const packed = {}
      Object.keys (val).forEach ((k) => {
        packed[k] = this._pack_val (val[k])
      })
      return new GLib.Variant ('a{sv}', packed)
    }

    // Important: Just handler float number and unsigned int number.
    // need to add handler to signed int number if we need store signed int
    // value into GSettings in GLib.Variant

    if (typeof val == 'number') {
      if (Math.abs (val - Math.floor (val)) < 10e-20) {
        return GLib.Variant.new_uint32 (val)
      } else {
        return GLib.Variant.new_double (val)
      }
    }

    if (typeof val == 'boolean') {
      return GLib.Variant.new_boolean (val)
    }

    if (typeof val == 'string') {
      return GLib.Variant.new_string (val)
    }

    if (val instanceof Array) {
      return new GLib.Variant (
        'av',
        val.map ((i) => this._pack_val (i))
      )
    }

    throw Error ('Unknown val to packed' + val)
  }

  /**  Fix RoundedCornersCfg when this type has been updated */
  _fix_rounded_corners_cfg (default_val, val) {
    // Added missing props
    Object.keys (default_val).forEach ((k) => {
      if (val[k] === undefined) {
        val[k] = default_val[k]
      }
    })

    // keep_rounded_corners has been update to object type in v5
    if (typeof val['keep_rounded_corners'] === 'boolean') {
      const keep_rounded_corners = {
        ...default_val['keep_rounded_corners'],
        maximized: val['keep_rounded_corners'],
      }
      val['keep_rounded_corners'] = keep_rounded_corners
    }
  }

  /** Port Settings to newer version in here when changed 'a{sv}' types */
  _fix () {
    const VERSION = 5
    if (this.settings_version == VERSION) {
      return
    }
    this.settings_version = VERSION

    const key = 'global-rounded-corner-settings'
    const default_val = this.g_settings
      .get_default_value (key)
      ?.recursiveUnpack ()

    // Fix global-rounded-corners-settings
    const global_cfg = this.global_rounded_corner_settings
    this._fix_rounded_corners_cfg (default_val, global_cfg)
    this.global_rounded_corner_settings = global_cfg

    // Fix custom-rounded-corner-settings
    const custom_cfg = this.custom_rounded_corner_settings
    Object.keys (custom_cfg).forEach ((k) => {
      this._fix_rounded_corners_cfg (default_val, custom_cfg[k])
    })
    this.custom_rounded_corner_settings = custom_cfg

    log (`[RoundedWindowCorners] Update Settings to v${VERSION}`)
  }
}

/** A singleton instance of Settings */
let _settings = null

/** Access _settings by this method */
var settings = () => {
  if (_settings != null) {
    return _settings
  }
  _settings = new Settings ()
  return _settings
}
