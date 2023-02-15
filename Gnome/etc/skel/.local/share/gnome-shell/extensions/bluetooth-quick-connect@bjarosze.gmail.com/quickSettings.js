// Copyright 2010-2022 GNOME Shell contributors
// Copyright 2022 Simon McVittie
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Adapted from gnome-shell js/ui/status/bluetooth.js

/* exported BluetoothToggleMenu */


const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const PopupMenu = imports.ui.popupMenu;

const {GObject} = imports.gi;
const {QuickMenuToggle} = imports.ui.quickSettings;

var BluetoothToggleMenu = GObject.registerClass(
class BluetoothToggleMenu extends QuickMenuToggle {
    _init(originalBluetoothToggle) {
        super._init({label: originalBluetoothToggle.label});

        this._original = originalBluetoothToggle;
        this._client = this._original._client;

        this._original.bind_property('visible', this, 'visible',
            GObject.BindingFlags.SYNC_CREATE);
        this._original.bind_property('checked', this, 'checked',
            GObject.BindingFlags.SYNC_CREATE);
        this._original.bind_property('icon-name', this, 'icon-name',
            GObject.BindingFlags.SYNC_CREATE);

        this.connect('clicked', () => this._client.toggleActive());

        this.menu.setHeader('bluetooth-active-symbolic', originalBluetoothToggle.label);

        this.itemsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this.itemsSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_("Bluetooth Settings"), 'gnome-bluetooth-panel.desktop');
    }
});

