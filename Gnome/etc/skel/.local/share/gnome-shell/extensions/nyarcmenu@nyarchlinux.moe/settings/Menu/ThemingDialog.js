const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const PW = Me.imports.prefsWidgets;
const { SettingsUtils } = Me.imports.settings;
const _ = Gettext.gettext;

var ManageThemesDialog = GObject.registerClass(
class ArcMenu_ManageThemesDialog extends PW.DialogWindow {
    _init(settings, parent) {
        super._init(_('Manage Themes'), parent);
        this._settings = settings;
        this.frameRows = [];

        let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
        for(let i = 0; i < menuThemes.length; i++) {
            let theme = menuThemes[i];
            let xpm = SettingsUtils.createXpmImage(theme[1], theme[2], theme[3], theme[8]);

            const row = new PW.DragRow({
                title: theme[0],
                xpm_pixbuf: GdkPixbuf.Pixbuf.new_from_xpm_data(xpm),
                icon_pixel_size: 42
            });
            this.pageGroup.add(row);
            
            row.theme = theme;
 
            row.connect("drag-drop-done", () => this.saveSettings() );

            const editEntryButton = new PW.EditEntriesBox({
                row: row,
                allow_modify: true,
                allow_delete: true
            });
            row.activatable_widget = editEntryButton;
            row.add_suffix(editEntryButton);

            editEntryButton.connect('modify', () => {
                let dialog = new SaveThemeDialog(this._settings, this, theme[0]);
                dialog.show();
                dialog.connect('response', (_w, response) => {
                    if(response === Gtk.ResponseType.APPLY) {
                        theme.splice(0, 1, dialog.themeName);
                        row.title = dialog.themeName;
                        row.theme = theme;
                        this.saveSettings();
                        dialog.destroy();
                    }
                });
            });

            editEntryButton.connect("row-changed", () => this.saveSettings() );
            editEntryButton.connect("row-deleted", () => {
                this.frameRows.splice(this.frameRows.indexOf(row), 1);
                this.saveSettings();
            });

            this.frameRows.push(row);
        }
    }

    saveSettings(){
        let array = [];

        this.frameRows.sort((a, b) => {
            return a.get_index() > b.get_index();
        });

        this.frameRows.forEach(child => {
            array.push(child.theme);
        });

        this._settings.set_value('menu-themes', new GLib.Variant('aas', array));
        this.emit('response', Gtk.ResponseType.APPLY);
    }
});

var SaveThemeDialog = GObject.registerClass(
class ArcMenu_SaveThemeDialog extends PW.DialogWindow {
    _init(settings, parent, themeName) {
        super._init(_('Save Theme As...'), parent);
        this._settings = settings;
        this.themeName = themeName;
        this.search_enabled = false;
        this.set_default_size(550, 220);

        let themeNameEntry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL
        });
        let themeNameRow = new Adw.ActionRow({
            title: _("Theme Name"),
            activatable_widget: themeNameEntry,
        });
        themeNameRow.add_suffix(themeNameEntry);
        this.pageGroup.add(themeNameRow);

        if(this.themeName)
            themeNameEntry.set_text(this.themeName);

        themeNameEntry.connect('changed', () => {
            if(themeNameEntry.get_text().length > 0)
                saveButton.set_sensitive(true);
            else
                saveButton.set_sensitive(false);
        });

        let saveButton = new Gtk.Button({
            label: _("Save Theme"),
            sensitive: false,
            halign: Gtk.Align.END,
            css_classes: ['suggested-action']
        });
        saveButton.connect('clicked', () => {
            this.themeName = themeNameEntry.get_text();
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        this.pageGroup.set_header_suffix(saveButton);
    }
});
        