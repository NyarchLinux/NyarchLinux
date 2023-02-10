// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

function init() {}

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const EXTENSIONDIR = Me.dir.get_path();
const ext_utils = Me.imports.utils.ext_utils;
// const npm_utils = Me.imports.npm_utils;

const PREFS_SCHEMA = "org.gnome.shell.extensions.material-you-theme";

// Todo: Add custom css
class ColorSchemeRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(name, style_subtitle) {
        const check = new Gtk.CheckButton({
            action_name: "color.scheme",
            action_target: new GLib.Variant("s", name),
        });

        super({
            title: name,
            subtitle: style_subtitle,
            activatable_widget: check,
        });
        this.add_prefix(check);
    }
}

class ColorSchemeGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({ title: "Color Profile" });

        this._actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group("color", this._actionGroup);

        this._settings = ExtensionUtils.getSettings(PREFS_SCHEMA);
        this._actionGroup.add_action(this._settings.create_action("scheme"));

        this.connect("destroy", () => this._settings.run_dispose());

        this._addTheme("Default", "Balanced Material You colors");
        this._addTheme("Vibrant", "Slightly varying colors most colorful");
        this._addTheme("Expressive", "Diverse colors that work well together");
        this._addTheme("Fruit Salad", "Main color that works well with a different color background");
        this._addTheme("Muted", "Calm, muted colors that are consistent");
    }

    _addTheme(name, style_subtitle) {
        const row = new ColorSchemeRow(name, style_subtitle);
        this.add(row);
    }
}

class SassInstallRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(name, title, subtitle) {
        const button = new Gtk.Button({
            label: "Install",
            valign: Gtk.Align.CENTER,
        });

        button.connect('clicked', () => {
            install_npm_deps();
            button.set_label("Installed");
            // npm_utils.install_npm_deps();
        });

        super({
            title: title,
            subtitle: subtitle,
            activatable_widget: button,
        });
        this.add_suffix(button);
    }
}

class SassGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({ title: "Enable Gnome Shell Theming" });

        this._settings = ExtensionUtils.getSettings(PREFS_SCHEMA);

        this.connect("destroy", () => this._settings.run_dispose());

        this._addSassInstall("request-install", "Install Sass with npm", "Requires nodejs and npm to already be installed");
    }

    _addSassInstall(name, title, subtitle) {
        const row = new SassInstallRow(name, title, subtitle);
        this.add(row);
    }
}

class MiscToggleRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(name, settings, title) {
        const widget = new Gtk.Switch({
            active: settings.get_boolean(name),
            valign: Gtk.Align.CENTER,
        });

        settings.bind(
            name,
            widget,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );

        super({
            title: title,
            activatable_widget: widget,
        });
        this.add_suffix(widget);
    }
}

class MiscSpinnerRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(name, settings, title, subtitle, min, max, inc) {
        const widget = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: inc,
            }),
            valign: Gtk.Align.CENTER,
        });

        settings.bind(
            name,
            widget,
            "value",
            Gio.SettingsBindFlags.DEFAULT
        );

        super({
            title: title,
            subtitle:  subtitle,
            activatable_widget: widget,
        });
        this.add_suffix(widget);
    }
}

class MiscGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({ title: "Options" });

        this._actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group("misc", this._actionGroup);

        this._settings = ExtensionUtils.getSettings(PREFS_SCHEMA);

        this.connect("destroy", () => this._settings.run_dispose());

        this._addToggle("show-notifications", this._settings, "Show Notifications");
        this._addSpinner("resize-width", this._settings, "Wallpaper Sampling Width",
                         "Width to resize sample to, higher values may cause slowdown", 8, 4096, 1);
        this._addSpinner("resize-height", this._settings, "Wallpaper Sampling Height",
                         "Height to resize sample to, higher values may cause slowdown", 8, 4096, 1);
    }

    _addToggle(name, settings, title) {
        const row = new MiscToggleRow(name, settings, title);
        this.add(row);
    }

    _addSpinner(name, settings, title, subtitle, min, max, inc) {
        const row = new MiscSpinnerRow(name, settings, title, subtitle, min, max, inc);
        this.add(row);
    }
}

function fillPreferencesWindow(window) {
    // Create a preferences page and group
    const page = new Adw.PreferencesPage();
    if (!ext_utils.check_npm()) {
        const sass_group = new SassGroup();
        page.add(sass_group);
    }
    const color_scheme_group = new ColorSchemeGroup();
    page.add(color_scheme_group);
    const misc_settings_group = new MiscGroup();
    page.add(misc_settings_group);

    window.add(page);
}

function install_npm_deps() {
    try {
        // The process starts running immediately after this function is called. Any
        // error thrown here will be a result of the process failing to start, not
        // the success or failure of the process itself.
        let proc = Gio.Subprocess.new(
            // The program and command options are passed as a list of arguments
            ['npm', 'install', '--prefix', EXTENSIONDIR],
    
            // The flags control what I/O pipes are opened and how they are directed
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    
        // Once the process has started, you can end it with `force_exit()`
        // proc.force_exit();
    } catch (e) {
        logError(e);
    }
}