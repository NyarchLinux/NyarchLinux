const { GObject, Shell } = imports.gi;
const { getCurrentExtension, getSettings } = imports.misc.extensionUtils;
const System = imports.system;
const Main = imports.ui.main;
const TrayIndicator = getCurrentExtension().imports.TrayIndicator;

var TrayIconsClass = GObject.registerClass(
class TrayIconsClass extends GObject.Object { 
	_init(settings) {
		this.tray       = new Shell.TrayManager();
		this.indicators = new TrayIndicator.TrayIndicator(settings);

		this.tray.connect('tray-icon-added', this._onIconAdded.bind(this));
		this.tray.connect('tray-icon-removed', this._onIconRemoved.bind(this));

		this.tray.manage_screen(Main.panel);
	}

	_onIconAdded(trayManager, icon)		 {		this.indicators.addIcon(icon); 		}
	_onIconRemoved(trayManager, icon)	 {		this.indicators.removeIcon(icon);	}

	_destroy() {
		this.tray = null;

		this.indicators.destroy();
		System.gc();
	}
});

class Extension {
	_setIconSize() {
		const margin = { vertical: this._settings.get_int('icon-margin-vertical'), horizontal: this._settings.get_int('icon-margin-horizontal') }
		const padding = { vertical: this._settings.get_int('icon-padding-vertical'), horizontal: this._settings.get_int('icon-padding-horizontal') }
		this.TrayIcons.indicators.setSize(this._settings.get_int('icon-size'), margin, padding);
	}

	_setTrayMargin() {
		this.TrayIcons.indicators.set_style('margin-left: ' + this._settings.get_int('tray-margin-left') + 'px; margin-right: ' + this._settings.get_int('tray-margin-right') + 'px');
	}

	_setTrayArea() {
		Main.panel.statusArea['TrayIconsReloaded'] = null;
		Main.panel.addToStatusArea('TrayIconsReloaded', this.TrayIcons.indicators, this._settings.get_int('position-weight'), this._settings.get_string('tray-position'));
	}

	_setIconsLimit() {
		this.TrayIcons.indicators.checkOverflow();
	}

	_setIconEffect() {
		this.TrayIcons.indicators.setEffect(this._settings.get_int('icon-contrast'), this._settings.get_int('icon-saturation'), this._settings.get_int('icon-brightness'));
	}

	_onChange() {
		this._settings.connect('changed::tray-position', this._setTrayArea.bind(this));
		this._settings.connect('changed::position-weight', this._setTrayArea.bind(this));
		this._settings.connect('changed::tray-margin-left', this._setTrayMargin.bind(this));
		this._settings.connect('changed::tray-margin-right', this._setTrayMargin.bind(this));
		this._settings.connect('changed::icon-size', this._setIconSize.bind(this));
		this._settings.connect('changed::icon-margin-horizontal', this._setIconSize.bind(this));
		this._settings.connect('changed::icon-margin-vertical', this._setIconSize.bind(this));
		this._settings.connect('changed::icon-padding-vertical', this._setIconSize.bind(this));
		this._settings.connect('changed::icon-padding-horizontal', this._setIconSize.bind(this));
		this._settings.connect('changed::icons-limit',  this._setIconsLimit.bind(this));
		this._settings.connect('changed::icon-saturation', this._setIconEffect.bind(this));
		this._settings.connect('changed::icon-contrast', this._setIconEffect.bind(this));
		this._settings.connect('changed::icon-brightness', this._setIconEffect.bind(this));
	}

	enable() {
		this._settings = getSettings();
		this.TrayIcons = new TrayIconsClass(this._settings);
		this._setTrayMargin();
		this._setIconSize();
		this._onChange();

		if (Main.layoutManager._startingUp) {
			this._startupComplete = Main.layoutManager.connect('startup-complete', () => {
				this._setTrayArea();
				Main.layoutManager.disconnect(this._startupComplete);
			});
		} else {
			this._setTrayArea();
		}
	}

	disable() {
		this.TrayIcons._destroy();
		this._settings.run_dispose();
		this._settings = null;
	}
}

function init() {
	return new Extension();
}