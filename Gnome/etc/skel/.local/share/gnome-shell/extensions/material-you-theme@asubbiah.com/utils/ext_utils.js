const { Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const EXTENSIONDIR = Me.dir.get_path();

function check_npm() {
    const file = Gio.File.new_for_path(EXTENSIONDIR + "/node_modules/sass/sass.js");
    return file.query_exists(null);
}