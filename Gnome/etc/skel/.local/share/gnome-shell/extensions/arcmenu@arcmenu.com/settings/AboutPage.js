import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const AboutPage = GObject.registerClass(
class ArcMenuAboutPage extends Adw.PreferencesPage {
    _init(settings, metadata, path) {
        super._init({
            title: _('About'),
            icon_name: 'help-about-symbolic',
            name: 'AboutPage',
        });

        const PROJECT_NAME = _('ArcMenu');
        const PROJECT_DESCRIPTION = _('Application Menu Extension for GNOME');
        const PROJECT_IMAGE = 'settings-arcmenu-logo';
        const SCHEMA_PATH = '/org/gnome/shell/extensions/arcmenu/';
        const VERSION = metadata['version-name'] ? metadata['version-name'] : metadata.version.toString();

        // Project Logo, title, description-------------------------------------
        const projectHeaderGroup = new Adw.PreferencesGroup();
        this.add(projectHeaderGroup);

        const projectHeaderBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: false,
            vexpand: false,
        });

        const projectImage = new Gtk.Image({
            margin_bottom: 5,
            icon_name: PROJECT_IMAGE,
            pixel_size: 100,
        });

        const projectTitleLabel = new Gtk.Label({
            label: _(PROJECT_NAME),
            css_classes: ['title-1'],
            vexpand: true,
            valign: Gtk.Align.FILL,
        });

        const projectDescriptionLabel = new Gtk.Label({
            label: PROJECT_DESCRIPTION,
            hexpand: false,
            vexpand: false,
        });
        projectHeaderBox.append(projectImage);
        projectHeaderBox.append(projectTitleLabel);
        projectHeaderBox.append(projectDescriptionLabel);
        projectHeaderGroup.add(projectHeaderBox);
        // -----------------------------------------------------------------------

        // Extension/OS Info------------------------------------------------
        const infoGroup = new Adw.PreferencesGroup();
        this.add(infoGroup);

        const projectVersionRow = new Adw.ActionRow({
            /* TRANSLATORS: 'PROJECT_NAME' Version*/
            title: _('%s Version').format(PROJECT_NAME),
        });
        projectVersionRow.add_suffix(new Gtk.Label({
            label: VERSION,
            css_classes: ['dim-label'],
        }));
        infoGroup.add(projectVersionRow);

        /* TRANSLATORS: 'PROJECT_NAME' - Release Notes*/
        const {subpage: whatsNewSubPage, page: whatsNewPage} = this._createSubPage(_('%s - Release Notes').format(PROJECT_NAME));
        this._whatsNewSubPage = whatsNewSubPage;
        const whatsNewRow = this._createSubPageRow(_("What's New"), whatsNewSubPage);
        infoGroup.add(whatsNewRow);

        const whatsNewGroup = new Adw.PreferencesGroup();
        whatsNewPage.add(whatsNewGroup);

        let releaseNotes = '';
        try {
            const fileContent = GLib.file_get_contents(`${path}/RELEASENOTES`)[1];
            const decoder = new TextDecoder('utf-8');
            releaseNotes = decoder.decode(fileContent);
        } catch (e) {
            releaseNotes = "Failed to load 'What's New' content.";
        }

        const releaseNotesLabel = new Gtk.Label({
            label: releaseNotes,
            use_markup: true,
            xalign: Gtk.Align.START,
            justify: Gtk.Justification.LEFT,
            margin_top: 14,
            margin_bottom: 14,
            margin_start: 14,
            margin_end: 14,
        });
        const releaseNotesBox = new Gtk.Box({
            css_classes: ['card'],
        });
        releaseNotesBox.append(releaseNotesLabel);
        whatsNewGroup.add(releaseNotesBox);

        const enableNotificationsGroup = new Adw.PreferencesGroup({
            vexpand: true,
            valign: Gtk.Align.END,
        });
        whatsNewGroup.add(enableNotificationsGroup);

        const enableNotificationsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: settings.get_boolean('update-notifier-enabled'),
        });
        enableNotificationsSwitch.connect('notify::active', widget => {
            settings.set_boolean('update-notifier-enabled', widget.get_active());
        });
        const enableNotificationsRow = new Adw.ActionRow({
            title: _('Message Tray Update Notification'),
            subtitle: _('Show a notification when %s receives an update.').format(_(PROJECT_NAME)),
            activatable_widget: enableNotificationsSwitch,
        });
        enableNotificationsRow.add_suffix(enableNotificationsSwitch);
        enableNotificationsGroup.add(enableNotificationsRow);

        if (metadata.commit) {
            const commitRow = new Adw.ActionRow({
                title: _('Git Commit'),
            });
            commitRow.add_suffix(new Gtk.Label({
                label: metadata.commit.toString(),
                css_classes: ['dim-label'],
            }));
            infoGroup.add(commitRow);
        }

        const gnomeVersionRow = new Adw.ActionRow({
            title: _('GNOME Version'),
        });
        gnomeVersionRow.add_suffix(new Gtk.Label({
            label: Config.PACKAGE_VERSION.toString(),
            css_classes: ['dim-label'],
        }));
        infoGroup.add(gnomeVersionRow);

        const osRow = new Adw.ActionRow({
            title: _('OS Name'),
        });

        const name = GLib.get_os_info('NAME');
        const prettyName = GLib.get_os_info('PRETTY_NAME');

        osRow.add_suffix(new Gtk.Label({
            label: prettyName ? prettyName : name,
            css_classes: ['dim-label'],
        }));
        infoGroup.add(osRow);

        const sessionTypeRow = new Adw.ActionRow({
            title: _('Windowing System'),
        });
        sessionTypeRow.add_suffix(new Gtk.Label({
            label: GLib.getenv('XDG_SESSION_TYPE') === 'wayland' ? 'Wayland' : 'X11',
            css_classes: ['dim-label'],
        }));
        infoGroup.add(sessionTypeRow);
        // -----------------------------------------------------------------------

        // Links -----------------------------------------------------------------
        /* TRANSLATORS: 'PROJECT_NAME' on GitLab*/
        const gitlabRow = this._createLinkRow(_('%s on GitLab').format(PROJECT_NAME), `${metadata.url}`);
        infoGroup.add(gitlabRow);

        const reportIssueRow = this._createLinkRow(_('Report an Issue'), `${metadata.url}/-/issues`);
        infoGroup.add(reportIssueRow);
        // -----------------------------------------------------------------------

        // Save/Load Settings----------------------------------------------------------
        const settingsGroup = new Adw.PreferencesGroup();
        this.add(settingsGroup);

        const settingsRow = new Adw.ActionRow({
            /* TRANSLATORS: 'PROJECT_NAME' Settings*/
            title: _('%s Settings').format(PROJECT_NAME),
        });
        const loadButton = new Gtk.Button({
            label: _('Load'),
            valign: Gtk.Align.CENTER,
        });
        loadButton.connect('clicked', () => {
            this._showFileChooser(
                _('Load Settings'),
                {action: Gtk.FileChooserAction.OPEN},
                '_Open',
                filename => {
                    if (filename && GLib.file_test(filename, GLib.FileTest.EXISTS)) {
                        const settingsFile = Gio.File.new_for_path(filename);
                        const [success_, pid_, stdin, stdout, stderr] =
                                   GLib.spawn_async_with_pipes(
                                       null,
                                       ['dconf', 'load', SCHEMA_PATH],
                                       null,
                                       GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                       null
                                   );

                        // TODO: Replace this with `GioUnix.OutputStream` later
                        const outputStream = new Gio.UnixOutputStream({fd: stdin, close_fd: true});
                        GLib.close(stdout);
                        GLib.close(stderr);
                        outputStream.splice(settingsFile.read(null),
                            Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET, null);
                    }
                }
            );
        });
        const saveButton = new Gtk.Button({
            label: _('Save'),
            valign: Gtk.Align.CENTER,
        });
        saveButton.connect('clicked', () => {
            this._showFileChooser(
                _('Save Settings'),
                {action: Gtk.FileChooserAction.SAVE},
                '_Save',
                filename => {
                    const file = Gio.file_new_for_path(filename);
                    const raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                    const out = Gio.BufferedOutputStream.new_sized(raw, 4096);

                    out.write_all(GLib.spawn_command_line_sync(`dconf dump ${SCHEMA_PATH}`)[1], null);
                    out.close(null);
                }
            );
        });
        settingsRow.add_suffix(saveButton);
        settingsRow.add_suffix(loadButton);
        settingsGroup.add(settingsRow);
        // -----------------------------------------------------------------------

        // Credits / Legal ----------------------------------------------------------------
        const miscGroup = new Adw.PreferencesGroup();
        this.add(miscGroup);

        const {subpage: creditsSubPage, page: creditsPage} = this._createSubPage(_('Credits'));
        const creditsRow = this._createSubPageRow(_('Credits'), creditsSubPage);
        miscGroup.add(creditsRow);

        const codeByGroup = new Adw.PreferencesGroup({
            title: _('Brought to you by'),
        });
        creditsPage.add(codeByGroup);
        const creditsRow1 = this._createLinkRow('Andrew Zaech (2019 - current)', 'https://gitlab.com/AndrewZaech', 'ArcMenu maintainer and developer');
        codeByGroup.add(creditsRow1);
        const creditsRow2 = this._createLinkRow('Andy C (2017 - 2020)', 'https://gitlab.com/LinxGem33', 'ArcMenu founder, maintainer, and digital art designer');
        codeByGroup.add(creditsRow2);
        const creditsRow3 = this._createLinkRow('Alexander Rüedlinger (2017)', 'https://github.com/lexruee', 'Developer');
        codeByGroup.add(creditsRow3);

        const historyGroup = new Adw.PreferencesGroup({
            title: _('History'),
        });
        creditsPage.add(historyGroup);

        const historyText = '<span size="small">ArcMenu was first released in 2017 by Andy C. The original ArcMenu project can be found <a href="https://gitlab.com/LinxGem33/Arc-Menu">here</a>.\n\n' +
                            'In 2017, ArcMenu <i>started</i> as a fork of the Zorin menu extension by <a href="https://zorin.com/os/Zorin">Zorin OS</a>. ' +
                            "As it's own separate project, ArcMenu rapidly began developing innovative features and quickly diverged " +
                            'away from Zorin menu thanks to the works of <a href="https://gitlab.com/LinxGem33">Andy C</a>, ' +
                            '<a href="https://gitlab.com/AndrewZaech">Andrew Zaech</a>, <a href="https://github.com/lexruee">Alexander Rüedlinger</a>, and other contributors. ' +
                            "ArcMenu has been rewritten from the ground up since it's inception and has it's own separate, original, and unique code base, unrelated to that of Zorin menu.</span>";

        const historyRow = new Adw.ActionRow({
            title: historyText,
            use_markup: true,
        });
        historyGroup.add(historyRow);

        const contributionsByGroup = new Adw.PreferencesGroup({
            title: _('Contributions by'),
        });
        creditsPage.add(contributionsByGroup);
        const contributorsRow =  this._createLinkRow(_('Contributors'), 'https://gitlab.com/arcmenu/ArcMenu#contributors');
        contributionsByGroup.add(contributorsRow);
        const translatorsRow =  this._createLinkRow(_('Translators'), 'https://gitlab.com/arcmenu/ArcMenu#translators');
        contributionsByGroup.add(translatorsRow);

        const artworkByGroup = new Adw.PreferencesGroup({
            title: _('Artwork by'),
        });
        creditsPage.add(artworkByGroup);
        const andycArtworkRow =  this._createLinkRow('Andy C', 'https://gitlab.com/LinxGem33', 'ArcMenu logo and other ArcMenu icon assets');
        artworkByGroup.add(andycArtworkRow);
        const azArtworkRow =  this._createLinkRow('Andrew Zaech', 'https://gitlab.com/AndrewZaech', 'Modification and creation of some ArcMenu icon assets');
        artworkByGroup.add(azArtworkRow);

        const {subpage: legalSubPage, page: legalPage} = this._createSubPage(_('Legal'));
        const legalRow = this._createSubPageRow(_('Legal'), legalSubPage);
        miscGroup.add(legalRow);

        const gnuSoftwareGroup = new Adw.PreferencesGroup();
        legalPage.add(gnuSoftwareGroup);

        const warrantyLabel = _('This program comes with absolutely no warranty.');
        /* TRANSLATORS: this is the program license url; the string contains the name of the license as link text.*/
        const urlLabel = _('See the <a href="%s">%s</a> for details.').format('https://gnu.org/licenses/old-licenses/gpl-2.0.html', _('GNU General Public License, version 2 or later'));

        const gnuSofwareLabel = new Gtk.Label({
            label: `${_(warrantyLabel)}\n${_(urlLabel)}`,
            use_markup: true,
            justify: Gtk.Justification.CENTER,
        });
        gnuSoftwareGroup.add(gnuSofwareLabel);
        // -----------------------------------------------------------------------
    }

    showWhatsNewPage() {
        this.get_root().push_subpage(this._whatsNewSubPage);
    }

    _createSubPage(title) {
        const subpage = new Adw.NavigationPage({
            title,
        });

        const headerBar = new Adw.HeaderBar();

        const sidebarToolBarView = new Adw.ToolbarView();

        sidebarToolBarView.add_top_bar(headerBar);
        subpage.set_child(sidebarToolBarView);
        const page = new Adw.PreferencesPage();
        sidebarToolBarView.set_content(page);

        return {subpage, page};
    }

    _createSubPageRow(title, subpage) {
        const subpageRow = new Adw.ActionRow({
            title: _(title),
            activatable: true,
        });

        subpageRow.connect('activated', () => {
            this.get_root().push_subpage(subpage);
        });

        const goNextImage = new Gtk.Image({
            gicon: Gio.icon_new_for_string('go-next-symbolic'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
        });

        subpageRow.add_suffix(goNextImage);
        return subpageRow;
    }

    _createLinkRow(title, uri, subtitle = null) {
        const image = new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
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

        return linkRow;
    }

    _showFileChooser(title, params, acceptBtn, acceptHandler) {
        const dialog = new Gtk.FileChooserDialog({
            title: _(title),
            transient_for: this.get_root(),
            modal: true,
            action: params.action,
        });
        dialog.add_button('_Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button(acceptBtn, Gtk.ResponseType.ACCEPT);

        dialog.connect('response', (self, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                try {
                    acceptHandler(dialog.get_file().get_path());
                } catch (e) {
                    console.log(`ArcMenu - Filechooser error: ${e}`);
                }
            }
            dialog.destroy();
        });

        dialog.show();
    }
});
