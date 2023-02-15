const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { settings }       = Me.imports.utils.settings


// --------------------------------------------------------------- [end imports]

/**
 * Log message Only when debug_mode of settings () is enabled
 */
var _log = (...args) => {
  if (settings ().debug_mode) {
    log (`[RoundedCornersEffect] ${args}`)
  }
}

/** Always log error message  */
var _logError = (err) => {
  log (`[Rounded Corners Effect] Error occurs: ${err.message}`)
  logError (err)
}

/**
 * Get stack message when called this function, this method
 * will be used when monkey patch the code of gnome-shell to skip some
 * function invocations.
 */
var stackMsg = () => {
  try {
    throw Error ()
  } catch (e) {
    return e?.stack?.trim ()
  }
}
