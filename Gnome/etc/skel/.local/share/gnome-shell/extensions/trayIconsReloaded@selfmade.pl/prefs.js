const Me = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Me.imports.preferences.Prefs.Prefs;

function buildPrefsWidget() {
	return new Prefs();
}

function init() {}
