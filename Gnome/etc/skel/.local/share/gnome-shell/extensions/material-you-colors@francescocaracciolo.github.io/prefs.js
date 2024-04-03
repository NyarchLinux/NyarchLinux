// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as ext_utils from './utils/ext_utils.js';

// const npm_utils = Me.imports.npm_utils;

const PREFS_SCHEMA = "org.gnome.shell.extensions.material-you-colors";
const COLORS = {"#643f00": 0xffbc9769, "#005142": 0xffdafaef, "#722b65": 0xffdcabcc, "#00497e": 0xffd1e1f8, "#225104": 0xff7d916e, "#004397": 0xff4285f4, "#7c2c1b": 0xffb18c84, "#00504e": 0xff7ca7a5, "#403c8e": 0xffb7b4cf, "#3d4c00": 0xffb0b78e, "#64307c ": 0xff8e7596, "#005137 ": 0xff9bb8a8, "#4e4800": 0xfff0eab7};

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

    constructor(settings) {
        super({ title: "Color Profile" });

        this._actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group("color", this._actionGroup);

        this._settings = settings;
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
            const extensiondir =  GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/material-you-colors@francescocaracciolo.github.io';
            install_npm_deps(extensiondir);
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

    constructor(settings) {
        super({ title: "Enable Gnome Shell Theming" });

        this._settings = settings;

        this.connect("destroy", () => this._settings.run_dispose());

        this._addSassInstall("request-install", "Install Sass with npm", "Requires nodejs and npm to already be installed");
    }

    _addSassInstall(name, title, subtitle) {
        const row = new SassInstallRow(name, title, subtitle);
        this.add(row);
    }
}

class PywalInstallRow extends Adw.ActionRow {
    static {
        GObject.registerClass(this);
    }

    constructor(name, title, subtitle) {
        const button = new Gtk.Button({
            label: "Install",
            valign: Gtk.Align.CENTER,
        });

        button.connect('clicked', () => {
            install_pywal();
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

class PywalGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({ title: "Enable Pywal Theming" });

        this._settings = settings;

        this.connect("destroy", () => this._settings.run_dispose());
        if (!ext_utils.check_wal()) {
          this._addPywalInstall("request-install", "Install Pywal with pip", "Requires pip3 to already be installed");
        }
        this._addToggle("enable-pywal-theming", this._settings, "Enable Pywal Theming");
    }

    _addPywalInstall(name, title, subtitle) {
        const row = new PywalInstallRow(name, title, subtitle);
        this.add(row);
    }

    _addToggle(name, settings, title) {
        const row = new MiscToggleRow(name, settings, title);
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
class CommandEntry extends Adw.EntryRow {
   static {
        GObject.registerClass(this);
    }

    constructor(settings) {
          super({ title: "Command after theme change" });

          this._settings = settings;
          this.set_text(this._settings.get_string("extra-command"));
          this.set_show_apply_button(true);
          this.connect("destroy", () => this._settings.run_dispose());
          this.connect("apply", this._createChangeHandler(this._settings, this));
    }
    _createChangeHandler(settings, obj) {
        return function () {
            settings.set_string("extra-command", obj.get_text());
        }
    }
}
class MiscGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({ title: "Options" });
        this._actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group("misc", this._actionGroup);

        this._settings = settings;

        this.connect("destroy", () => this._settings.run_dispose());

        this._addToggle("show-notifications", this._settings, "Show Notifications");
        this._addSpinner("resize-width", this._settings, "Wallpaper Sampling Width",
                         "Width to resize sample to, higher values may cause slowdown", 8, 4096, 1);
        this._addSpinner("resize-height", this._settings, "Wallpaper Sampling Height",
                         "Height to resize sample to, higher values may cause slowdown", 8, 4096, 1);
        this._addToggle("arcmenu-theming", this._settings, "Also theme ArcMenu extension");
        const entry = new CommandEntry(this._settings);
        this.add(entry);
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
export default class MaterialYouPrefs extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata); 
    }

    fillPreferencesWindow(window) {
        const extensiondir =  GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/material-you-colors@francescocaracciolo.github.io';
        // Create a preferences page and group
        const page = new Adw.PreferencesPage();
        const settings = this.getSettings(PREFS_SCHEMA);
        if (!ext_utils.check_npm(extensiondir)) {
            const sass_group = new SassGroup(settings);
            page.add(sass_group);
        }
        const color_accent_group = new ColorAccentGroup(settings);
        page.add(color_accent_group);
        const color_scheme_group = new ColorSchemeGroup(settings);
        page.add(color_scheme_group);
        const misc_settings_group = new MiscGroup(settings);
        const pywal_group = new PywalGroup(settings);
        page.add(pywal_group);
        page.add(misc_settings_group);

        window.add(page);
    }
}

class ColorAccentGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({ title: "Force color scheme" });

        this._settings = settings;

        this.connect("destroy", () => this._settings.run_dispose());

        this._addToggle("enable-accent-colors", this._settings, "Force Accent Color");
        this._addAccentColorChooser();
    }

    _addAccentColorChooser() {
        // Create a row of buttons
        this.buttons = [];
        const row = new Adw.ExpanderRow();
        var colors = new Gtk.Box();
        colors.set_spacing(4);
        row.set_title("Accent Color");
        // Create a button for each color
        for (var color in COLORS) {
            // Create button
            var button = new Gtk.Button();
            button.set_css_classes([".circular"]);
            var csss = new Gtk.CssProvider();
            // Make it circular and right color 
            csss.load_from_data("button { background-color: "+color.toString(16)+"; border-radius: 999px;}", -1);
            if (this._settings.get_string("accent-color") == COLORS[color].toString(10)) {
                button.set_icon_name("object-select-symbolic");
            }
            button.get_style_context().add_provider(csss, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            button.connect("clicked", this._createClickHandler(color, button, colors, this._settings, this));
            colors.append(button);
            this.buttons.push(button);
        }
        row.add_row(colors);
        this.add(row);
    }

    _addToggle(name, settings, title) {
        const row = new MiscToggleRow(name, settings, title);
        this.add(row);
    }
    _createClickHandler(color, button, colors, settings, obj) {
        return function () {
            settings.set_string("accent-color", COLORS[color].toString(10));
            obj.buttons.forEach(function (object) {
                object.set_icon_name("");
            });
            button.set_icon_name("object-select-symbolic");

        }
    }
}

function install_npm_deps(extensiondir) {
    try {
        // The process starts running immediately after this function is called. Any
        // error thrown here will be a result of the process failing to start, not
        // the success or failure of the process itself.
        let proc = Gio.Subprocess.new(
            // The program and command options are passed as a list of arguments
            ['npm', 'install', '--prefix', extensiondir],
    
            // The flags control what I/O pipes are opened and how they are directed
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    
        // Once the process has started, you can end it with `force_exit()`
        // proc.force_exit();
    } catch (e) {
        logError(e);
    }
}

function install_pywal() {
    try {
        // The process starts running immediately after this function is called. Any
        // error thrown here will be a result of the process failing to start, not
        // the success or failure of the process itself.
        let proc = Gio.Subprocess.new(
            // The program and command options are passed as a list of arguments
            ['pip3', 'install', 'pywal'],  // NOTE: this may cause problems on some distributions

            // The flags control what I/O pipes are opened and how they are directed
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        // Once the process has started, you can end it with `force_exit()`
        // proc.force_exit();
    } catch (e) {
        logError(e);
    }
}
