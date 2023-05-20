/*
    This file is part of Arch Linux Updates Indicator

    Arch Linux Updates Indicator is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Arch Linux Updates Indicator is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Arch Linux Updates Indicator.  If not, see <http://www.gnu.org/licenses/>.

    Copyright 2016-2022 Raphaël Rochet
*/

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain('arch-update');
const _ = Gettext.gettext;

let settings;

function init() {
	settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.arch-update');
	ExtensionUtils.initTranslations("arch-update");
}

function fillPreferencesWindow(window) {
	// Prepare labels and controls
	let buildable = new Gtk.Builder();
	buildable.add_from_file( Me.dir.get_path() + '/prefs.xml' );

	// Fill in about page from metadata
	buildable.get_object('about_logo').set_from_file( Me.dir.get_child('icons').get_path() + "/arch-updates-logo.svg" );
	buildable.get_object('about_name').set_text(Me.metadata.name.toString());
	buildable.get_object('about_version').set_text(Me.metadata.version.toString());
	buildable.get_object('about_description').set_text(Me.metadata.description.toString());
	buildable.get_object('about_url').set_markup("<a href=\"" + Me.metadata.url.toString() + "\">" + Me.metadata.url.toString() + "</a>");

	// Bind fields to settings
	settings.bind('boot-wait' , buildable.get_object('field_wait') , 'value' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('check-interval' , buildable.get_object('field_interval') , 'value' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('always-visible' , buildable.get_object('field_visible') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('use-buildin-icons' , buildable.get_object('field_buildinicons') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('show-count' , buildable.get_object('field_count') , 'active', Gio.SettingsBindFlags.DEFAULT);
	settings.bind('notify' , buildable.get_object('field_notify') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('howmuch', buildable.get_object('field_howmuch'), 'active', Gio.SettingsBindFlags.DEFAULT);
	settings.bind('transient', buildable.get_object('field_transient'), 'active', Gio.SettingsBindFlags.DEFAULT);
	settings.bind('strip-versions' , buildable.get_object('field_stripversions') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('strip-versions-in-notification' , buildable.get_object('field_stripversionsnotifications') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('check-cmd' , buildable.get_object('field_checkcmd') , 'text' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('disable-parsing', buildable.get_object('field_disableparsing'), 'active', Gio.SettingsBindFlags.DEFAULT);
	settings.bind('update-cmd' , buildable.get_object('field_updatecmd') , 'text' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('pacman-dir' , buildable.get_object('field_pacmandir') , 'text' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('auto-expand-list', buildable.get_object('field_autoexpandlist'), 'value', Gio.SettingsBindFlags.DEFAULT);
	settings.bind('package-manager' , buildable.get_object('field_packagemanager') , 'text' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('enable-positioning' , buildable.get_object('field_enablepositioning') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('enable-positioning' , buildable.get_object('box_position') , 'sensitive' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('position' , buildable.get_object('field_position') , 'active' , Gio.SettingsBindFlags.DEFAULT);
	settings.bind('position-number' , buildable.get_object('field_positionnumber') , 'value' , Gio.SettingsBindFlags.DEFAULT);

	// Pref window layout
	window.search_enabled = true;
	window.add( buildable.get_object('page_basic') );
	window.add( buildable.get_object('page_advanced') );
	window.add( buildable.get_object('page_about') );
}
