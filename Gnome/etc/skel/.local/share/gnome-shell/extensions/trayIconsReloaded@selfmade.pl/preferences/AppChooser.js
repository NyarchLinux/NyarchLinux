const { GObject, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

var AppChooser = GObject.registerClass(
	class AppChooser extends Gtk.AppChooserDialog {
		_init(parent, settings) {
			super._init({
				transient_for: parent,
				modal: true,
			});
			this._settings = settings;
			this._widget = this.get_widget();
			this._widget.set({
				show_all: true,
				show_other: true,
			});
			this._widget.connect(
				"application-selected",
				this._updateSensitivity.bind(this)
			);

			this.connect("response", this._onResponse.bind(this));
			this._updateSensitivity();
		}

		_updateSensitivity() {
			const apps = JSON.parse(this._settings.get_string("applications"));
			const appInfo = this._widget.get_app_info();

			this.set_response_sensitive(
				Gtk.ResponseType.OK,
				appInfo && !apps.some((app) => app.id.startsWith(appInfo.get_id()))
			);
		}

		_onResponse(dlg, id) {
			const appInfo =
				id === Gtk.ResponseType.OK ? this._widget.get_app_info() : null;

			if (appInfo) {
				let apps = JSON.parse(this._settings.get_string("applications"));
				apps = [
					...apps,
					{
						id: appInfo.get_id(),
					},
				];

				this._settings.set_string("applications", JSON.stringify(apps));
			}

			this.destroy();
		}
	}
);
