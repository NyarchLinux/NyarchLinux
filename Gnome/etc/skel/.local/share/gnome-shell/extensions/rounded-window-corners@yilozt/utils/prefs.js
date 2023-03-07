const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { DBus, DBusCallFlags }  = imports.gi.Gio
const { Variant }              = imports.gi.GLib

var list_children = (widget) => {
  const children = []
  for (
    let child = widget.get_first_child ();
    child != null;
    child = child.get_next_sibling ()
  ) {
    children.push (child)
  }
  return children
}

var show_err_msg = (info) => {
  // Show error message with notifications
  // by call DBus method of org.freedesktop.Notifications
  //
  // Ref: https://gjs.guide/guides/gio/dbus.html#direct-calls

  DBus.session.call (
    'org.freedesktop.Notifications',
    '/org/freedesktop/Notifications',
    'org.freedesktop.Notifications',
    'Notify',
    new Variant ('(susssasa{sv}i)', [
      '',
      0,
      '',
      'Rounded Window Corners',
      info,
      [],
      {},
      3000,
    ]),
    null,
    DBusCallFlags.NONE,
    -1,
    null,
    null
  )
}
