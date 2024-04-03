import Gio from 'gi://Gio';


export function check_npm(extensiondir) {
    const file = Gio.File.new_for_path(extensiondir + "/node_modules/sass/sass.js");
    return file.query_exists(null);
}

export function check_wal() {
  try {
    const process = Gio.Subprocess.new(
      ["wal", "-v"],
      Gio.SubprocessFlags.NONE
    );
    process.wait(null);
    return process.get_successful();
  } catch (e) {
    log(e);
    return false;
  }
}
