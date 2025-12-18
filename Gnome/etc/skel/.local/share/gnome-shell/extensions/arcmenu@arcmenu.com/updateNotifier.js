import Gio from 'gi://Gio';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {SettingsPage} from './constants.js';

const PROJECT_NAME = 'ArcMenu';
const PROJECT_ICON = '/icons/hicolor/16x16/actions/settings-arcmenu-logo.svg';

const [ShellVersion] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));

/**
 * A MessageTray notification that notifies users that the extension has been updated.
 *
 * Shows users what's new and displays donation options on major releases.
 * Will not show if user is installing the extension for the first time.
 * Can be disabled with setting 'update-notifier-enabled'.
 *
 * @param {*} extension
 */
export class UpdateNotification {
    constructor(extension) {
        const {metadata} = extension;
        this._extension = extension;
        this._settings = extension.settings;

        this._version = metadata.version ?? 0;
        this._versionName = metadata['version-name'] ?? this._version.toString();
        this._iconPath = `${extension.path}/${PROJECT_ICON}`;

        this._maybeShowNotification();
    }

    destroy() {
        this._settings = null;
        this._extension = null;
        this._version = null;
        this._versionName = null;
        this._iconPath = null;
    }

    _isMinorRelease() {
        const versionParts = this._versionName.split('.').map(s => Number(s));
        const minor = versionParts[1] ?? 0;
        return minor > 0;
    }

    _maybeShowNotification() {
        const lastShownVersion = this._settings.get_int('update-notifier-project-version');
        const isNewVersion = lastShownVersion < this._version;

        if (!isNewVersion)
            return;

        this._settings.set_int('update-notifier-project-version', this._version);

        const showNotification = this._settings.get_boolean('update-notifier-enabled') && lastShownVersion > 0;
        if (showNotification)
            this._showNotification();
    }

    _showNotification() {
        const isMinorRelease = this._isMinorRelease();

        /* TRANSLATORS: This will display as "ProjectName v21 Released!" as an example.*/
        const title = _('%s v%s Released!').format(PROJECT_NAME, this._versionName);
        let body;
        if (isMinorRelease)
            body = _("Check out what's new.");
        else
            body = _('Thank you for using %s! If you enjoy it and would like to help support its continued development, please consider making a donation.').format(PROJECT_NAME);

        const gicon = Gio.icon_new_for_string(this._iconPath);

        const source = this._getSource(PROJECT_NAME, 'application-x-addon-symbolic');
        Main.messageTray.add(source);

        const notification = this._getNotification(source, title, body, gicon);
        notification.urgency = MessageTray.Urgency.CRITICAL;

        if (!isMinorRelease) {
            notification.resident = true;
            notification.addAction(_('Donate'), () => this._openSettingsPage(SettingsPage.DONATE));
        }

        notification.addAction(_("What's new?"), () => this._openSettingsPage(SettingsPage.WHATS_NEW));
        notification.addAction(_('Dismiss'), () => notification.destroy());

        if (ShellVersion >= 46)
            source.addNotification(notification);
        else
            source.showNotification(notification);
    }

    _getSource(title, iconName) {
        if (ShellVersion >= 46)
            return new MessageTray.Source({title, iconName});
        else
            return new MessageTray.Source(title, iconName);
    }

    _getNotification(source, title, body, gicon) {
        if (ShellVersion >= 46)
            return new MessageTray.Notification({source, title, body, gicon});
        else
            return new MessageTray.Notification(source, title, body, {gicon});
    }

    _openSettingsPage(page) {
        this._settings.set_int('prefs-visible-page', page);
        this._extension.openPreferences();
    }
}
