/* exported AboutPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gdk, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const PAYPAL_LINK = `https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=53CWA7NR743WC&item_name=Support+${Me.metadata.name}&source=url`;
const PROJECT_DESCRIPTION = _('Application Menu Extension for GNOME');
const PROJECT_IMAGE = 'settings-arcmenu-logo';
const SCHEMA_PATH = '/org/gnome/shell/extensions/arcmenu/';

var AboutPage = GObject.registerClass(
class ArcMenuAboutPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('About'),
            icon_name: 'help-about-symbolic',
            name: 'AboutPage',
        });
        this._settings = settings;

        // Project Logo, title, description-------------------------------------
        const projectHeaderGroup = new Adw.PreferencesGroup();
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
            label: _('ArcMenu'),
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

        this.add(projectHeaderGroup);
        // -----------------------------------------------------------------------

        // Extension/OS Info and Links Group------------------------------------------------
        const infoGroup = new Adw.PreferencesGroup();

        const projectVersionRow = new Adw.ActionRow({
            title: _('ArcMenu Version'),
        });
        projectVersionRow.add_suffix(new Gtk.Label({
            label: Me.metadata.version.toString(),
            css_classes: ['dim-label'],
        }));
        infoGroup.add(projectVersionRow);

        if (Me.metadata.commit) {
            const commitRow = new Adw.ActionRow({
                title: _('Git Commit'),
            });
            commitRow.add_suffix(new Gtk.Label({
                label: Me.metadata.commit.toString(),
                css_classes: ['dim-label'],
            }));
            infoGroup.add(commitRow);
        }

        const gnomeVersionRow = new Adw.ActionRow({
            title: _('GNOME Version'),
        });
        gnomeVersionRow.add_suffix(new Gtk.Label({
            label: imports.misc.config.PACKAGE_VERSION.toString(),
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

        const gitlabRow = this._createLinkRow(_('ArcMenu GitLab'), Me.metadata.url);
        infoGroup.add(gitlabRow);

        const donateRow = this._createLinkRow(_('Donate via PayPal'), PAYPAL_LINK);
        infoGroup.add(donateRow);

        this.add(infoGroup);
        // -----------------------------------------------------------------------

        // Save/Load Settings----------------------------------------------------------
        const settingsGroup = new Adw.PreferencesGroup();
        const settingsRow = new Adw.ActionRow({
            title: _('ArcMenu Settings'),
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
                        let [success_, pid_, stdin, stdout, stderr] =
                            GLib.spawn_async_with_pipes(
                                null,
                                ['dconf', 'load', SCHEMA_PATH],
                                null,
                                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                null
                            );

                        stdin = new Gio.UnixOutputStream({fd: stdin, close_fd: true});
                        GLib.close(stdout);
                        GLib.close(stderr);

                        stdin.splice(settingsFile.read(null),
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
        this.add(settingsGroup);
        // -----------------------------------------------------------------------

        // Credits----------------------------------------------------------------
        const creditsGroup = new Adw.PreferencesGroup({
            title: _('Credits'),
        });
        this.add(creditsGroup);

        const creditsRow = new Adw.PreferencesRow({
            activatable: false,
            selectable: false,
        });
        creditsGroup.add(creditsRow);

        const creditsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        creditsRow.set_child(creditsBox);

        const creditsCarousel = new Adw.Carousel({
            hexpand: true,
            halign: Gtk.Align.FILL,
            margin_top: 5,
            margin_bottom: 5,
        });
        const creditsCarouselDots = new Adw.CarouselIndicatorDots({
            carousel: creditsCarousel,
        });
        creditsCarousel.append(new Gtk.Label({
            label: Constants.DEVELOPERS,
            use_markup: true,
            vexpand: true,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL,
            justify: Gtk.Justification.CENTER,
        }));
        creditsCarousel.append(new Gtk.Label({
            label: Constants.CONTRIBUTORS,
            use_markup: true,
            vexpand: true,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL,
            justify: Gtk.Justification.CENTER,
        }));
        creditsCarousel.append(new Gtk.Label({
            label: Constants.ARTWORK,
            use_markup: true,
            vexpand: true,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL,
            justify: Gtk.Justification.CENTER,
        }));
        creditsBox.append(creditsCarousel);
        creditsBox.append(creditsCarouselDots);
        // -----------------------------------------------------------------------

        const gnuSoftwareGroup = new Adw.PreferencesGroup();
        const gnuSofwareLabel = new Gtk.Label({
            label: _(Constants.GNU_SOFTWARE),
            use_markup: true,
            justify: Gtk.Justification.CENTER,
        });
        const gnuSofwareLabelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.END,
            vexpand: true,
        });
        gnuSofwareLabelBox.append(gnuSofwareLabel);
        gnuSoftwareGroup.add(gnuSofwareLabelBox);
        this.add(gnuSoftwareGroup);
    }

    _createLinkRow(title, uri) {
        const image = new Gtk.Image({
            icon_name: 'adw-external-link-symbolic',
            valign: Gtk.Align.CENTER,
        });
        const linkRow = new Adw.ActionRow({
            title: _(title),
            activatable: true,
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
                    log(`ArcMenu - Filechooser error: ${e}`);
                }
            }
            dialog.destroy();
        });

        dialog.show();
    }
});
