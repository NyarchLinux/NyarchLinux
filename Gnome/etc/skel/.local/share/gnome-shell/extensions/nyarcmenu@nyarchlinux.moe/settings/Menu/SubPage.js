/* exported SubPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, GLib, GObject, Gtk} = imports.gi;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var SubPage = GObject.registerClass({
    Properties: {
        'setting-string': GObject.ParamSpec.string(
            'setting-string', 'setting-string', 'setting-string',
            GObject.ParamFlags.READWRITE,
            ''),
        'title': GObject.ParamSpec.string(
            'title', 'title', 'title',
            GObject.ParamFlags.READWRITE,
            ''),
        'list-type': GObject.ParamSpec.int(
            'list-type', 'list-type', 'list-type',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 1),
        'preferences-page': GObject.ParamSpec.boolean(
            'preferences-page', 'preferences-page', 'preferences-page',
            GObject.ParamFlags.READWRITE,
            true),
    },
},
class ArcMenuSubPage extends Gtk.Box {
    _init(settings, params) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            ...params,
        });
        this._settings = settings;

        this.headerLabel = new Adw.WindowTitle({
            title: _(this.title),
        });

        this.headerBar = new Adw.HeaderBar({
            title_widget: this.headerLabel,
            decoration_layout: '',
        });

        if (this.preferences_page) {
            this.append(this.headerBar);
            this.page = new PrefsPage();
            this.append(this.page);
        }

        this.restoreDefaultsButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            tooltip_text: _('Reset settings'),
            css_classes: ['flat'],
        });
        this.restoreDefaultsButton.connect('clicked', () => {
            const dialog = new Gtk.MessageDialog({
                text: `<b>${_('Reset all %s settings?').format(this.title)}</b>`,
                secondary_text: _('All %s settings will be reset to the default value.').format(this.title),
                use_markup: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true,
            });
            dialog.connect('response', (widget, response) => {
                if (response === Gtk.ResponseType.YES)
                    this.restoreDefaults();
                dialog.destroy();
            });
            dialog.show();
        });

        const backButton = new Gtk.Button({
            icon_name: 'go-previous-symbolic',
            tooltip_text: _('Back'),
            css_classes: ['flat'],
        });

        backButton.connect('clicked', () => {
            const window = this.get_root();
            window.close_subpage();
        });

        this.headerBar.pack_start(backButton);
        if (this.preferences_page)
            this.headerBar.pack_end(this.restoreDefaultsButton);
    }

    add(widget) {
        if (this.preferences_page)
            this.page.add(widget);
        else
            this.append(widget);
    }

    resetScrollAdjustment() {
        if (!this.preferences_page)
            return;

        const maybeScrolledWindowChild = [...this.page][0];

        if (maybeScrolledWindowChild instanceof Gtk.ScrolledWindow)
            maybeScrolledWindowChild.vadjustment.value = 0;
    }
});

var PrefsPage = GObject.registerClass(
class ArcMenuPrefsPage extends Adw.PreferencesPage {
    _init(params) {
        super._init(params);
        this.children = [];
    }

    add(page) {
        this.children.push(page);
        super.add(page);
    }
});
