/* exported init, buildPrefsWidget */
const { Adw, Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk } = imports.gi;
const ByteArray = imports.byteArray;

imports.gi.versions.GnomeDesktop = '4.0';

let GnomeDesktop = null;
try {
    GnomeDesktop = imports.gi.GnomeDesktop;
} catch (e) {
    // not compatible with GTK4 yet
}

const ExtensionUtils = imports.misc.extensionUtils;

const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';

const MONITOR_WIDTH = 1920;
const PREVIEW_WIDTH = 400;

const PreviewGroup = GObject.registerClass(
class PreviewGroup extends Adw.PreferencesGroup {
    _init(settings) {
        super._init();

        this._settings = settings;
        this._settings.connect('changed', (s, key) => {
            if (key === this._logoKey ||
                key === 'logo-size')
                this._logo = null;
            this._preview.queue_draw();
        });

        this._styleManager = Adw.StyleManager.get_default();
        this._styleManager.connect('notify::dark', () => {
            this._background = null;
            this._logo = null;
            this._preview.queue_draw();
        });

        this._preview = new Gtk.DrawingArea({
            halign: Gtk.Align.CENTER,
            margin_bottom: 12,
            margin_top: 12,
            width_request: PREVIEW_WIDTH,
            height_request: PREVIEW_WIDTH * 9 / 16,
        });

        this._preview.set_draw_func(this._drawPreview.bind(this));
        const previewRow = new Adw.PreferencesRow({ activatable: false });
        previewRow.set_child(this._preview);
        this.add(previewRow);
    }

    _drawPreview(preview, cr, width, height) {
        if (!this._background)
            this._createBackgroundThumbnail(width, height);
        Gdk.cairo_set_source_pixbuf(cr, this._background, 0, 0);
        cr.paint();

        if (!this._logo)
            this._createLogoThumbnail(width);

        let [x, y] = this._getLogoPosition(width, height);
        Gdk.cairo_set_source_pixbuf(cr, this._logo, x, y);
        cr.paintWithAlpha(this._settings.get_uint('logo-opacity') / 255.0);
    }

    _getSlideShowSlide(file, width, height) {
        if (GnomeDesktop) {
            const slideShow = new GnomeDesktop.BGSlideShow({ file });
            slideShow.load();

            const [progress_, duration_, isFixed_, filename1, filename2_] =
                slideShow.get_current_slide(width, height);
            return Gio.File.new_for_commandline_arg(filename1);
        } else {
            const [, contents] = file.load_contents(null);
            const str = ByteArray.toString(contents);
            const [, filename1] = str.match(/<file>(.*)<\/file>/);
            return Gio.File.new_for_commandline_arg(filename1);
        }
    }

    _createBackgroundThumbnail(width, height) {
        let settings = new Gio.Settings({ schema_id: BACKGROUND_SCHEMA });
        const bgKey = this._styleManager.dark
            ? 'picture-uri-dark'
            : 'picture-uri';
        let uri = settings.get_default_value(bgKey).deep_unpack();
        let file = Gio.File.new_for_commandline_arg(uri);

        if (uri.endsWith('.xml'))
            file = this._getSlideShowSlide(file, width, height);
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(file.get_path());
        this._background = pixbuf.scale_simple(
            width, height, GdkPixbuf.InterpType.BILINEAR);
    }

    _createLogoThumbnail(width) {
        this._logoKey = this._styleManager.dark
            ? 'logo-file-dark'
            : 'logo-file';
        let filename = this._settings.get_string(this._logoKey);
        let file = Gio.File.new_for_commandline_arg(filename);
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(file.get_path());
        let size = this._settings.get_double('logo-size') / 100;
        let ratio = pixbuf.get_width() / pixbuf.get_height();
        this._logo = pixbuf.scale_simple(
            size * width,
            size * width / ratio,
            GdkPixbuf.InterpType.BILINEAR);
    }

    _getLogoPosition(width, height) {
        const previewScale = PREVIEW_WIDTH / MONITOR_WIDTH;
        const scaledBorder =
            previewScale * this._settings.get_uint('logo-border');
        let x, y;
        const position = this._settings.get_string('logo-position');
        if (position.endsWith('left'))
            x = scaledBorder;
        else if (position.endsWith('right'))
            x = (width - this._logo.get_width() - scaledBorder);
        else
            x = (width - this._logo.get_width()) / 2;

        if (position.startsWith('top'))
            y = scaledBorder;
        else if (position.startsWith('bottom'))
            y = height - this._logo.get_height() - scaledBorder;
        else
            y = (height - this._logo.get_height()) / 2;

        return [x, y];
    }
});

const LogoPosition = GObject.registerClass({
    Properties: {
        'name': GObject.ParamSpec.string(
            'name', 'name', 'name',
            GObject.ParamFlags.READWRITE,
            null),
        'value': GObject.ParamSpec.string(
            'value', 'value', 'value',
            GObject.ParamFlags.READWRITE,
            null),
    },
}, class LogoPosition extends GObject.Object {
    _init(name, value) {
        super._init({ name, value });
    }
});

const LogoGroup = GObject.registerClass(
class LogoGroup extends Adw.PreferencesGroup {
    _init(settings) {
        super._init({ title: 'Logo' });

        this._settings = settings;
        this._fileChooserKey = '';

        const filter = new Gtk.FileFilter();
        filter.add_pixbuf_formats();

        this._fileChooser = new Gtk.FileChooserNative({
            title: 'Select an Image',
            filter,
            modal: true,
        });
        this._fileChooser.connect('response',  (dlg, response) => {
            if (response !== Gtk.ResponseType.ACCEPT)
                return;
            this._settings.set_string(this._fileChooserKey,
                dlg.get_file().get_path());
        });

        this._filenameLabel = new Gtk.Label();
        this._filenameDarkLabel = new Gtk.Label();
        this._settings.connect('changed::logo-file',
            () => this._updateFilenameLabels());
        this._settings.connect('changed::logo-file-dark',
            () => this._updateFilenameLabels());
        this._updateFilenameLabels();

        const filenameRow = new Adw.ActionRow({
            title: 'Filename',
            activatable: true,
        });
        filenameRow.connect('activated', () => {
            this._fileChooserKey = 'logo-file';
            this._fileChooser.transient_for = this.get_root();
            this._fileChooser.show();
        });
        filenameRow.add_suffix(this._filenameLabel);
        this.add(filenameRow);

        const filenameDarkRow = new Adw.ActionRow({
            title: 'Filename (dark)',
            activatable: true,
        });
        filenameDarkRow.connect('activated', () => {
            this._fileChooserKey = 'logo-file-dark';
            this._fileChooser.transient_for = this.get_root();
            this._fileChooser.show();
        });
        filenameDarkRow.add_suffix(this._filenameDarkLabel);
        this.add(filenameDarkRow);

        const positionModel = new Gio.ListStore({ item_type: LogoPosition });
        positionModel.append(new LogoPosition('Center', 'center'));
        positionModel.append(new LogoPosition('Bottom left', 'bottom-left'));
        positionModel.append(new LogoPosition('Bottom center', 'bottom-center'));
        positionModel.append(new LogoPosition('Bottom right', 'bottom-right'));
        positionModel.append(new LogoPosition('Top left', 'top-left'));
        positionModel.append(new LogoPosition('Top center', 'top-center'));
        positionModel.append(new LogoPosition('Top right', 'top-right'));
        this._positionRow = new Adw.ComboRow({
            title: 'Position',
            model: positionModel,
            expression: new Gtk.PropertyExpression(LogoPosition, null, 'name'),
        });
        this.add(this._positionRow);

        this._positionRow.connect('notify::selected-item', () => {
            const { selectedItem } = this._positionRow;
            this._settings.set_string('logo-position', selectedItem.value);
        });
        this._settings.connect('changed::logo-position',
            () => this._updateSelectedPosition());
        this._updateSelectedPosition();

        this._addScaleRow('Size', 'logo-size', 0.25);
        this._addScaleRow('Border', 'logo-border', 1.0);
        this._addScaleRow('Opacity', 'logo-opacity', 1.0);
    }

    _addScaleRow(title, key, stepSize) {
        const adjustment = this._createAdjustment(key, stepSize);
        const activatableWidget = new Gtk.Scale({
            adjustment,
            draw_value: false,
            hexpand: true,
        });
        const row = new Adw.ActionRow({
            activatableWidget,
            title,
        });
        row.add_suffix(activatableWidget);
        this.add(row);
    }

    _updateSelectedPosition() {
        const position = this._settings.get_string('logo-position');
        const { model } = this._positionRow;
        for (let i = 0; i < model.get_n_items(); i++) {
            const item = model.get_item(i);
            if (item.value === position) {
                this._positionRow.set_selected(i);
                break;
            }
        }
    }

    _createAdjustment(key, step) {
        let schemaKey = this._settings.settings_schema.get_key(key);
        let [type, variant] = schemaKey.get_range().deep_unpack();
        if (type !== 'range')
            throw new Error('Invalid key type "%s" for adjustment'.format(type));
        let [lower, upper] = variant.deep_unpack();
        let adj = new Gtk.Adjustment({
            lower,
            upper,
            step_increment: step,
            page_increment: 10 * step,
        });
        this._settings.bind(key, adj, 'value', Gio.SettingsBindFlags.DEFAULT);
        return adj;
    }

    _updateFilenameLabels() {
        const filename = this._settings.get_string('logo-file');
        this._filenameLabel.label = GLib.basename(filename);

        const filenameDark = this._settings.get_string('logo-file-dark');
        this._filenameDarkLabel.label = GLib.basename(filenameDark);
    }

    on_destroy() {
        if (this._fileChooser)
            this._fileChooser.destroy();
        this._fileChooser = null;
    }
});

const OptionsGroup = GObject.registerClass(
class OptionsGroup extends Adw.PreferencesGroup {
    _init(settings) {
        super._init({ title: 'Options' });

        this._settings = settings;
        const alwaysShowSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        this._settings.bind('logo-always-visible',
            alwaysShowSwitch, 'active',
            Gio.SettingsBindFlags.DEFAULT);

        const row = new Adw.ActionRow({
            title: 'Show for all backgrounds',
            activatable_widget: alwaysShowSwitch,
        });
        row.add_suffix(alwaysShowSwitch);
        this.add(row);
    }
});

const BackgroundLogoPrefsWidget = GObject.registerClass(
class BackgroundLogoPrefsWidget extends Adw.PreferencesPage {
    _init() {
        super._init();

        const settings = ExtensionUtils.getSettings();

        this.add(new PreviewGroup(settings));
        this.add(new LogoGroup(settings));
        this.add(new OptionsGroup(settings));
    }
});

/** */
function init() {
}

/** */
function buildPrefsWidget() {
    return new BackgroundLogoPrefsWidget();
}
