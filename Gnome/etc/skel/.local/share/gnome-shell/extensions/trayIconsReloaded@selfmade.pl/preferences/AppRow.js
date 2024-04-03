import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const AppRow = GObject.registerClass(
	{
		GTypeName: "AppRow",
		Template: GLib.uri_resolve_relative(import.meta.url, "./AppRow.xml", GLib.UriFlags.NONE),
		InternalChildren: ["icon", "label", "revealButton", "revealer", "hidden"],
	},
	class AppRow extends Gtk.ListBoxRow {
		_init(app, settings) {
			super._init();
			this._settings = settings;
			this.appId = app.id;

			this._appInfo = Gio.DesktopAppInfo.new(app.id);
			if (this._appInfo) {
				this._icon.gicon = this._appInfo.get_icon();
				this._label.label = this._appInfo.get_display_name();
			} else {
				this._label.label = app.id;
			}

			this._hidden.set_active(app.hidden);
			this._hidden.connect("state-set", () => {
				this._updateApp();
			});
		}

		toggleSettingsVisibility() {
			this._revealer.reveal_child = !this._revealer.reveal_child;

			if (this._revealer.reveal_child) {
				this._revealButton.get_style_context().add_class("expanded");
			} else {
				this._revealButton.get_style_context().remove_class("expanded");
			}
		}

		removeRow() {
			const current = JSON.parse(this._settings.get_string("applications"));
			const updated = current.filter((app) => app.id !== this.appId);

			this._settings.set_string("applications", JSON.stringify(updated));
		}

		_updateApp() {
			let apps = JSON.parse(this._settings.get_string("applications"));
			const index = apps.findIndex((app) => app.id == this.appId);
			apps[index] = {
				id: this.appId,
				hidden: this._hidden.get_active(),
			};

			this._settings.set_string("applications", JSON.stringify(apps));
		}
	}
);
