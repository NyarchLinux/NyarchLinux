const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const Meta                 = imports.gi.Meta
const { Settings }         = imports.gi.Gio

// gnome modules
const { openPrefs }        = imports.misc.extensionUtils
const { PACKAGE_VERSION }  = imports.misc.config

// local modules
const { load }             = Me.imports.utils.io
const { _log, _logError }  = Me.imports.utils.log
const { constants }        = Me.imports.utils.constants
const { _ }                = Me.imports.utils.i18n

// types


// --------------------------------------------------------------- [end imports]

var computeWindowContentsOffset = (meta_window) => {
  const bufferRect = meta_window.get_buffer_rect ()
  const frameRect = meta_window.get_frame_rect ()
  return [
    frameRect.x - bufferRect.x,
    frameRect.y - bufferRect.y,
    frameRect.width - bufferRect.width,
    frameRect.height - bufferRect.height,
  ]
}

var AppType
;(function (AppType) {
  AppType[(AppType['LibHandy'] = 0)] = 'LibHandy'
  AppType[(AppType['LibAdwaita'] = 1)] = 'LibAdwaita'
  AppType[(AppType['Other'] = 2)] = 'Other'
}) (AppType || (AppType = {}))

/**
 * Query application type for a Meta.Window, used to skip add rounded
 * corners effect to some window.
 * @returns Application Type: LibHandy | LibAdwaita | Other
 */
var getAppType = (meta_window) => {
  try {
    // May cause Permission error
    const contents = load (`/proc/${meta_window.get_pid ()}/maps`)
    if (contents.match (/libhandy-1.so/)) {
      return AppType.LibHandy
    } else if (contents.match (/libadwaita-1.so/)) {
      return AppType.LibAdwaita
    } else {
      return AppType.Other
    }
  } catch (e) {
    _logError (e)
    return AppType.Other
  }
}

/**
 * Get scale factor of a Meta.window, if win is undefined, return
 * scale factor of current monitor
 */
var WindowScaleFactor = (win) => {
  const features = Settings.new ('org.gnome.mutter').get_strv (
    'experimental-features'
  )

  // When enable fractional scale in Wayland, return 1
  if (
    Meta.is_wayland_compositor () &&
    features.includes ('scale-monitor-framebuffer')
  ) {
    return 1
  }

  const monitor_index = win
    ? win.get_monitor ()
    : global.display.get_current_monitor ()
  return global.display.get_monitor_scale (monitor_index)
}

/**
 * Add Item into background menu, now we can open preferences page by right
 * click in background
 * @param menu - BackgroundMenu to add
 */
var AddBackgroundMenuItem = (menu) => {
  for (const item of menu._getMenuItems ()) {
    if (item.label?.text === _ (constants.ITEM_LABEL ())) {
      return
    }
  }

  menu.addAction (_ (constants.ITEM_LABEL ()), () => {
    try {
      openPrefs ()
    } catch (err) {
      openPrefs ()
    }
  })
}

/** Find all Background menu, then add extra item to it */
var SetupBackgroundMenu = () => {
  for (const _bg of global.window_group.first_child.get_children ()) {
    const menu = _bg._backgroundMenu
    AddBackgroundMenuItem (menu)
  }
}

var RestoreBackgroundMenu = () => {
  const remove_menu_item = (menu) => {
    const items = menu._getMenuItems ()

    for (const i of items) {
      if (i?.label?.text === _ (constants.ITEM_LABEL ())) {
        i.destroy ()
        break
      }
    }
  }

  for (const _bg of global.window_group.first_child.get_children ()) {
    const menu = _bg._backgroundMenu
    remove_menu_item (menu)
    _log ('Added Item of ' + menu + 'Removed')
  }
}

/** Choice Rounded Corners Settings for window  */
var ChoiceRoundedCornersCfg = (global_cfg, custom_cfg_list, win) => {
  const k = win.get_wm_class_instance ()
  if (k == null || !custom_cfg_list[k] || !custom_cfg_list[k].enabled) {
    return global_cfg
  }

  const custom_cfg = custom_cfg_list[k]
  // Need to skip border radius item from custom settings
  custom_cfg.border_radius = global_cfg.border_radius
  return custom_cfg
}

/**
 * Decide whether windows should have rounded corners when it has been
 * maximized & fullscreen according to RoundedCornersCfg
 */
function ShouldHasRoundedCorners (win, cfg) {
  let should_has_rounded_corners = false

  const maximized = win.maximized_horizontally || win.maximized_vertically
  const fullscreen = win.fullscreen

  should_has_rounded_corners =
    (!maximized && !fullscreen) ||
    (maximized && cfg.keep_rounded_corners.maximized) ||
    (fullscreen && cfg.keep_rounded_corners.fullscreen)

  return should_has_rounded_corners
}

/**
 * @returns Current version of gnome shell
 */
function shell_version () {
  return Number.parseFloat (PACKAGE_VERSION)
}

/**
 * Get Rounded corners effect from a window actor
 */
function get_rounded_corners_effect (actor) {
  const win = actor.meta_window
  const name = constants.ROUNDED_CORNERS_EFFECT
  return win.get_client_type () === Meta.WindowClientType.X11
    ? actor.first_child.get_effect (name)
    : actor.get_effect (name)
}
