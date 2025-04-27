import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const DonatePage = GObject.registerClass(
class ArcMenuDonatePage extends Adw.PreferencesPage {
    _init(metadata) {
        super._init({
            title: _('Donate'),
            icon_name: 'emote-love-symbolic',
            name: 'DonatePage',
        });

        const PROJECT_NAME = _('ArcMenu');
        const PAYPAL_LINK = `https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=53CWA7NR743WC&item_name=Support+${metadata.name}&source=url`;
        const BUYMEACOFFEE_LINK = 'https://buymeacoffee.com/azaech';

        const donateGroup = new Adw.PreferencesGroup({
            title: _('Help Support %s').format(_(PROJECT_NAME)),
            description: _('Thank you for using %s! If you enjoy it and would like to help support its continued development, please consider making a donation.').format(_(PROJECT_NAME)),
        });
        this.add(donateGroup);

        const paypalRow = this._createLinkRow(_('Donate via PayPal'), 'settings-paypal-logo', PAYPAL_LINK);
        donateGroup.add(paypalRow);

        const buyMeACoffeeRow = this._createLinkRow(_('Donate via Buy Me a Coffee'), 'settings-bmc-logo', BUYMEACOFFEE_LINK);
        donateGroup.add(buyMeACoffeeRow);

        const thankYouGroup = new Adw.PreferencesGroup();
        this.add(thankYouGroup);
        const thankYouBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            vexpand: true,
            valign: Gtk.Align.END,
        });
        thankYouGroup.add(thankYouBox);
        const thankYouLabel = new Gtk.Label({
            label: _('A huge thank you to everyone who has supported %s! Your support helps keep %s going. It is truly appreciated!').format(_(PROJECT_NAME), _(PROJECT_NAME)),
            css_classes: ['title-5'],
            hexpand: true,
            wrap: true,
            justify: Gtk.Justification.CENTER,
            halign: Gtk.Align.CENTER,
        });
        thankYouBox.append(thankYouLabel);
    }

    _createLinkRow(title, iconName, uri, subtitle = null) {
        const image = new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
        });
        const prefixImage = new Gtk.Image({
            icon_name: iconName,
            valign: Gtk.Align.CENTER,
        });
        const linkRow = new Adw.ActionRow({
            title: _(title),
            activatable: true,
            tooltip_text: uri,
            subtitle: subtitle ? _(subtitle) : null,
        });
        linkRow.connect('activated', () => {
            Gtk.show_uri(this.get_root(), uri, Gdk.CURRENT_TIME);
        });
        linkRow.add_suffix(image);
        linkRow.add_prefix(prefixImage);

        return linkRow;
    }
});
