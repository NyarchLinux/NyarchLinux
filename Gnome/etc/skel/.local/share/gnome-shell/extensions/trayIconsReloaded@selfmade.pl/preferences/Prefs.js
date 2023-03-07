const { GObject, Gtk, Gio, Gdk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const getSettings = ExtensionUtils.getSettings;
const Me = ExtensionUtils.getCurrentExtension();
const AppRow = Me.imports.preferences.AppRow.AppRow;
const AppChooser = Me.imports.preferences.AppChooser.AppChooser;
const Adw = imports.gi.Adw;

const schemaNames = [
	"tray-position",
	"position-weight",
	"tray-margin-left",
	"tray-margin-right",
	"icons-limit",
	"icon-size",
	"icon-margin-vertical",
	"icon-margin-horizontal",
	"icon-padding-vertical",
	"icon-padding-horizontal",
	"icon-saturation",
	"icon-contrast",
	"icon-brightness",
	"invoke-to-workspace",
	"wine-behavior",
];

const settingIds = schemaNames.map(function (name) {
	return name.replaceAll("-", "_");
});

var Prefs = GObject.registerClass(
	{
		GTypeName: "Prefs",
		Template: Me.dir.get_child("preferences/Prefs.xml").get_uri(),
		InternalChildren: ["headerBar", "appList", ...settingIds],
	},
	class Prefs extends Gtk.Box {
		_init(params = {}) {
			super._init(params);
			this._settings = getSettings();
			this._bindSettings(schemaNames);

			this.connect("realize", () => {
				const window = this.get_root();
				const windowHeaderBar = this._findWidgetByType(
					window.get_content(),
					Adw.HeaderBar
				);
				windowHeaderBar.set_title_widget(this._headerBar);
			});

			let provider = new Gtk.CssProvider();
			provider.load_from_file(
				Gio.File.new_for_uri(
					Me.dir.get_child("preferences/Prefs.css").get_uri()
				)
			);
			Gtk.StyleContext.add_provider_for_display(
				Gdk.Display.get_default(),
				provider,
				Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
			);

			this._changeId = this._settings.connect(
				"changed::applications",
				this._syncAppsRows.bind(this)
			);

			this._syncAppsRows();
		}

		showAppChooser() {
			const dialog = new AppChooser(this.get_root(), this._settings);
			dialog.show();
		}

		_syncAppsRows() {
			this._settings.block_signal_handler(this._changeId);

			const oldApps = [...this._appList].filter((row) => !!row.appId);
			const newApps = JSON.parse(
				this._settings.get_string("applications")
			).filter((app) => !!app);

			newApps.forEach((appInfo, index) => {
				if (!oldApps.some((row) => row.appId == appInfo.id)) {
					const appRow = new AppRow(appInfo, this._settings);
					this._appList.insert(appRow, index);

					if (this._notFirstSync) {
						appRow.toggleSettingsVisibility();
					}
				}
			});

			oldApps.forEach((row, index) => {
				if (!newApps.some((app) => row.appId == app.id)) {
					this._appList.remove(row);
				}
			});

			this._notFirstSync = true;

			this._settings.unblock_signal_handler(this._changeId);
		}

		_bindSettings(settings) {
			settings.forEach((name) => {
				let obj = eval("this._" + name.replaceAll("-", "_"));
				let valueType;

				switch (obj.css_name) {
					case "combobox":
						valueType = "active-id";
						break;
					case "switch":
						valueType = "active";
						break;
					default:
						valueType = "value";
				}

				this._settings.bind(
					name,
					obj,
					valueType,
					Gio.SettingsBindFlags.DEFAULT
				);
			});
		}

		// This traverses the widget tree below the given parent recursively and returns the
		// first widget of the given type.
		// @Schneegans
		_findWidgetByType(parent, type) {
			for (const child of [...parent]) {
				if (child instanceof type) return child;

				const match = this._findWidgetByType(child, type);
				if (match) return match;
			}

			return null;
		}
	}
);
