import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as PW from '../../prefsWidgets.js';
import * as SettingsUtils from '../SettingsUtils.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const SaveThemeDialog = GObject.registerClass(
class ArcMenuSaveThemeDialog extends PW.DialogWindow {
    _init(settings, parent, themeName) {
        super._init(_('Save Theme As...'), parent);
        this._settings = settings;
        this.themeName = themeName;
        this.search_enabled = false;
        this.set_default_size(550, 220);

        const themeNameEntry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            halign: Gtk.Align.FILL,
        });
        const themeNameRow = new Adw.ActionRow({
            title: _('Theme Name'),
            activatable_widget: themeNameEntry,
        });
        themeNameRow.add_suffix(themeNameEntry);
        this.pageGroup.add(themeNameRow);

        if (this.themeName)
            themeNameEntry.set_text(this.themeName);

        themeNameEntry.connect('changed', () => {
            if (themeNameEntry.get_text().length > 0)
                saveButton.set_sensitive(true);
            else
                saveButton.set_sensitive(false);
        });

        const saveButton = new Gtk.Button({
            label: _('Save Theme'),
            sensitive: false,
            halign: Gtk.Align.END,
            css_classes: ['suggested-action'],
        });
        saveButton.connect('clicked', () => {
            this.themeName = themeNameEntry.get_text();
            this.emit('response', Gtk.ResponseType.APPLY);
        });
        this.pageGroup.set_header_suffix(saveButton);
    }
});

export const ManageThemesDialog = GObject.registerClass(
class ArcMenuManageThemesDialog extends PW.DialogWindow {
    _init(settings, parent) {
        super._init(_('Manage Themes'), parent);
        this._settings = settings;
        this.frameRows = [];

        // Save/Load Settings----------------------------------------------------------
        const saveLoadGroup = new Adw.PreferencesGroup();
        const saveLoadRow = new Adw.ActionRow({
            title: _('Menu Themes'),
        });
        const loadButton = new Gtk.Button({
            label: _('Load'),
            valign: Gtk.Align.CENTER,
        });
        loadButton.connect('clicked', () => {
            this._showFileChooser(
                `${_('Load')} ${_('Menu Themes')}`,
                {action: Gtk.FileChooserAction.OPEN},
                '_Open',
                filename => {
                    if (filename && GLib.file_test(filename, GLib.FileTest.EXISTS)) {
                        const settingsFile = Gio.File.new_for_path(filename);
                        const [ok_, bytes] = settingsFile.load_contents(null);

                        const themesJSON = JSON.parse(new TextDecoder().decode(bytes));

                        const importedMenuThemes = [];

                        for (const theme of themesJSON) {
                            const menuTheme = [];
                            menuTheme.push(theme['Name']);
                            menuTheme.push(theme['Menu_Background_Color']);
                            menuTheme.push(theme['Menu_Foreground_Color']);
                            menuTheme.push(theme['Menu_Border_Color']);
                            menuTheme.push(theme['Menu_Border_Width']);
                            menuTheme.push(theme['Menu_Border_Radius']);
                            menuTheme.push(theme['Menu_Font_Size']);
                            menuTheme.push(theme['Menu_Separator_Color']);
                            menuTheme.push(theme['Item_Hover_Background_Color']);
                            menuTheme.push(theme['Item_Hover_Foreground_Color']);
                            menuTheme.push(theme['Item_Active_Background_Color']);
                            menuTheme.push(theme['Item_Active_Foreground_Color']);
                            importedMenuThemes.push(menuTheme);
                        }

                        const dialog = new SaveLoadThemesPage(this._settings, this,
                            importedMenuThemes, SaveLoadType.LOAD);
                        this.push_subpage(dialog);
                        dialog.connect('response', (_w, response) => {
                            let menuThemes = this._settings.get_value('menu-themes').deep_unpack();
                            const selectedThemesArray = dialog.selecetedThemesArray;
                            menuThemes = menuThemes.concat(selectedThemesArray);
                            this.pop_subpage();

                            if (response === Gtk.ResponseType.ACCEPT) {
                                this._settings.set_value('menu-themes', new GLib.Variant('aas', menuThemes));
                                this.frameRows.forEach(child => {
                                    this.pageGroup.remove(child);
                                });
                                this.frameRows = [];
                                this.populateFrameRows();
                                this.emit('response', Gtk.ResponseType.APPLY);
                            }
                        });
                    }
                }
            );
        });
        const saveButton = new Gtk.Button({
            label: _('Save'),
            valign: Gtk.Align.CENTER,
        });
        saveButton.connect('clicked', () => {
            const menuThemes = this._settings.get_value('menu-themes').deep_unpack();
            const dialog = new SaveLoadThemesPage(this._settings, this, menuThemes, SaveLoadType.SAVE);
            this.push_subpage(dialog);
            dialog.connect('response', (_w, response) => {
                const selectedThemesArray = dialog.selecetedThemesArray;
                this.pop_subpage();

                if (response === Gtk.ResponseType.ACCEPT) {
                    this._showFileChooser(
                        `${_('Save')} ${_('Menu Themes')}`,
                        {action: Gtk.FileChooserAction.SAVE},
                        '_Save',

                        filename => {
                            const file = Gio.file_new_for_path(filename);
                            const raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                            const out = Gio.BufferedOutputStream.new_sized(raw, 4096);

                            const json = this.getMenuThemesJSON(selectedThemesArray);

                            out.write_all(json, null);
                            out.close(null);
                        }
                    );
                }
            });
        });
        saveLoadRow.add_suffix(saveButton);
        saveLoadRow.add_suffix(loadButton);
        saveLoadGroup.add(saveLoadRow);
        this.page.remove(this.pageGroup);
        this.page.add(saveLoadGroup);
        this.page.add(this.pageGroup);

        this.populateFrameRows();
    }

    getMenuThemesJSON(menuThemes) {
        /* Order of elements in a theme:
        [Theme Name, menuBGColor, menuFGColor, menuBorderColor, menuBorderWidth, menuBorderRadius,
          menuFontSize, menuSeparatorColor, itemHoverBGColor, itemHoverFGColor, itemActiveBGColor, itemActiveFGColor]*/

        const menuThemeDict = [];
        for (let i = 0; i < menuThemes.length; i++) {
            menuThemeDict.push({
                'Name': menuThemes[i][0],
                'Menu_Background_Color': menuThemes[i][1],
                'Menu_Foreground_Color': menuThemes[i][2],
                'Menu_Border_Color': menuThemes[i][3],
                'Menu_Border_Width': menuThemes[i][4],
                'Menu_Border_Radius': menuThemes[i][5],
                'Menu_Font_Size': menuThemes[i][6],
                'Menu_Separator_Color': menuThemes[i][7],
                'Item_Hover_Background_Color': menuThemes[i][8],
                'Item_Hover_Foreground_Color': menuThemes[i][9],
                'Item_Active_Background_Color': menuThemes[i][10],
                'Item_Active_Foreground_Color': menuThemes[i][11],
            });
        }

        return JSON.stringify(menuThemeDict, null, 2);
    }

    populateFrameRows() {
        const menuThemes = this._settings.get_value('menu-themes').deep_unpack();
        for (let i = 0; i < menuThemes.length; i++) {
            const theme = menuThemes[i];
            const pixbuf = SettingsUtils.createThemePreviewPixbuf(theme[1], theme[2], theme[3], theme[8]);

            const row = new PW.DragRow({
                title: theme[0],
                pixbuf,
                icon_pixel_size: 42,
            });
            this.pageGroup.add(row);

            row.theme = theme;

            row.connect('drag-drop-done', () => this.saveSettings());

            const editEntryButton = new PW.EditEntriesBox({
                row,
                allow_modify: true,
                allow_remove: true,
            });
            row.activatable_widget = editEntryButton;
            row.add_suffix(editEntryButton);

            editEntryButton.connect('modify-button-clicked', () => {
                const dialog = new SaveThemeDialog(this._settings, this, theme[0]);
                dialog.show();
                dialog.connect('response', (_w, response) => {
                    if (response === Gtk.ResponseType.APPLY) {
                        theme.splice(0, 1, dialog.themeName);
                        row.title = dialog.themeName;
                        row.theme = theme;
                        this.saveSettings();
                        dialog.destroy();
                    }
                });
            });

            editEntryButton.connect('entry-modified', (_self, startIndex, newIndex) => {
                const splicedItem = this.frameRows.splice(startIndex, 1)[0];

                if (newIndex >= 0)
                    this.frameRows.splice(newIndex, 0, splicedItem);

                this.saveSettings();
            });

            this.frameRows.push(row);
        }
    }

    saveSettings() {
        const array = [];

        this.frameRows.sort((a, b) => {
            return a.get_index() - b.get_index();
        });

        this.frameRows.forEach(child => {
            array.push(child.theme);
        });

        this._settings.set_value('menu-themes', new GLib.Variant('aas', array));
        this.emit('response', Gtk.ResponseType.APPLY);
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

const SaveLoadType = {
    SAVE: 0,
    LOAD: 1,
};

var SaveLoadThemesPage = GObject.registerClass({
    Properties: {
        'selected-themes': GObject.ParamSpec.int(
            'selected-themes', 'selected-themes', 'selected-themes',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 0),
    },
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
}, class ArcMenuSaveLoadThemesPage extends Adw.NavigationPage {
    _init(settings, parent, themesArray, saveLoadType) {
        super._init();

        this._parent = parent;
        this._settings = settings;
        this._saveLoadType = saveLoadType;
        this._themesArray = themesArray;
        this.selecetedThemesArray = [];

        this.headerBar = new Adw.HeaderBar();

        const sidebarToolBarView = new Adw.ToolbarView();
        this.set_child(sidebarToolBarView);
        sidebarToolBarView.add_top_bar(this.headerBar);

        this.page = new Adw.PreferencesPage();
        sidebarToolBarView.set_content(this.page);

        if (this._saveLoadType === SaveLoadType.SAVE)
            this.title = _('Save Themes');
        else if (this._saveLoadType === SaveLoadType.LOAD)
            this.title = _('Load Themes');

        this.pageGroup = new Adw.PreferencesGroup();
        this.page.add(this.pageGroup);

        this._loadThemeRows();

        const actionButton = new Gtk.Button({
            label: `${_(this.title)} (${this.selected_themes})`,
            valign: Gtk.Align.CENTER,
            sensitive: false,
            css_classes: ['suggested-action'],
        });
        actionButton.connect('clicked', () => this.emit('response', Gtk.ResponseType.ACCEPT));

        this.pageGroup.set_header_suffix(actionButton);

        this.connect('notify::selected-themes', () => {
            actionButton.sensitive = this.selected_themes > 0;
            actionButton.label = `${_(this.title)} (${this.selected_themes})`;
        });
    }

    _loadThemeRows() {
        for (let i = 0; i < this._themesArray.length; i++) {
            const theme = this._themesArray[i];
            const pixbuf = SettingsUtils.createThemePreviewPixbuf(theme[1], theme[2], theme[3], theme[8]);
            const row = new Adw.ActionRow({
                title: theme[0],
            });

            const icon = new Gtk.Image({
                pixel_size: 42,
            });
            icon.set_from_pixbuf(pixbuf);
            row.add_prefix(icon);

            this.addButtonAction(row, theme);
            this.pageGroup.add(row);
        }
    }

    addButtonAction(row, theme) {
        let match = false;
        const checkButton = new Gtk.Button({
            icon_name: match ? 'list-remove-symbolic' : 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
        });
        checkButton.connect('clicked', () => {
            if (!match) {
                this.currentToast?.dismiss();

                this.currentToast = new Adw.Toast({
                    title: _('%s has been selected').format(row.title),
                    timeout: 2,
                });
                this.currentToast.connect('dismissed', () => (this.currentToast = null));

                this._parent.add_toast(this.currentToast);
                this.selected_themes++;
                this.selecetedThemesArray.push(theme);
            } else {
                this.currentToast?.dismiss();

                this.currentToast = new Adw.Toast({
                    title: _('%s has been unselected').format(row.title),
                    timeout: 2,
                });
                this.currentToast.connect('dismissed', () => (this.currentToast = null));
                this.selected_themes--;
                this._parent.add_toast(this.currentToast);
                const index = this.selecetedThemesArray.indexOf(theme);
                this.selecetedThemesArray.splice(index, 1);
            }

            match = !match;
            checkButton.icon_name = match ? 'list-remove-symbolic' : 'list-add-symbolic';
        });
        row.add_suffix(checkButton);
        row.activatable_widget = checkButton;
    }
});
