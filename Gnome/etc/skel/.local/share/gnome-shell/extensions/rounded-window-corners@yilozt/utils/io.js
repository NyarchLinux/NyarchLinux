const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gio        = imports.gi.Gio
const GLib       = imports.gi.GLib
const ByteArray  = imports.byteArray

// --------------------------------------------------------------- [end imports]

var load = (path) => {
  const [, buffer] = GLib.file_get_contents (path)
  const contents = ByteArray.toString (buffer)
  GLib.free (buffer)
  return contents
}

var path = (mod_url, relative_path) => {
  const parent = Gio.File.new_for_uri (mod_url).get_parent ()

  const mod_dir = parent?.get_path ()
  return Gio.File.new_for_path (`${mod_dir}/${relative_path}`).get_path ()
}

var loadFile = (mod_url, relative_path) =>
  load (path (mod_url, relative_path) ?? '')

var loadShader = (path) => {
  let [declarations, main] = load (path).split (/^.*?main\(\s?\)\s?/m)

  declarations = declarations.trim ()
  main = main.trim ().replace (/^[{}]/gm, '').trim ()
  return { declarations, code: main }
}
