const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const PW = Me.imports.prefsWidgets;
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const { SubPage } = Settings.Menu.SubPage;

var ListOtherPage = GObject.registerClass(
class ArcMenu_ListOtherPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.frameRows = [];

        if(this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS)
            this.settingString = 'power-options';
        else if(this.list_type === Constants.MenuSettingsListType.EXTRA_CATEGORIES)
            this.settingString = 'extra-categories';
        else if(this.list_type === Constants.MenuSettingsListType.QUICK_LINKS)
            this.settingString = 'arcmenu-extra-categories-links';

        this.categoriesFrame = new Adw.PreferencesGroup();

        this._addRowsToFrame(this._settings.get_value(this.settingString).deep_unpack());

        this.add(this.categoriesFrame);

        if(this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS){
            let powerDisplayStyleGroup = new Adw.PreferencesGroup({
                title: _("Power Off / Log Out Buttons")
            });
            let powerDisplayStyles = new Gtk.StringList();
            powerDisplayStyles.append(_('Off'));
            powerDisplayStyles.append(_('Power Buttons'));
            powerDisplayStyles.append(_('Power Menu'));
            this.powerDisplayStyleRow = new Adw.ComboRow({
                title: _("Override Display Style"),
                model: powerDisplayStyles,
                selected: this._settings.get_enum('power-display-style')
            });
            this.powerDisplayStyleRow.connect("notify::selected", (widget) => {
                this._settings.set_enum('power-display-style', widget.selected)
            });
            powerDisplayStyleGroup.add(this.powerDisplayStyleRow);

            this.add(powerDisplayStyleGroup);
        }

        this.restoreDefaults = () => {
            this.frameRows.forEach(child => {
                this.categoriesFrame.remove(child);
            });
            this.frameRows = [];

            if(this.powerDisplayStyleRow)
                this.powerDisplayStyleRow.selected = 0;

            this._addRowsToFrame(this._settings.get_default_value(this.settingString).deep_unpack());
            this.saveSettings();
        };
    }

    saveSettings(){
        let array = [];
        this.frameRows.sort((a, b) => {
            return a.get_index() > b.get_index();
        })
        this.frameRows.forEach(child => {
            array.push([child.setting_type, child.switch_active]);
        });

        this._settings.set_value(this.settingString, new GLib.Variant('a(ib)', array));
    }

    _addRowsToFrame(extraCategories){
        for(let i = 0; i < extraCategories.length; i++){
            const categoryEnum = extraCategories[i][0];
            const isActive = extraCategories[i][1];
            
            let name, iconString;
            if(this.list_type === Constants.MenuSettingsListType.POWER_OPTIONS){
                name = Constants.PowerOptions[categoryEnum].NAME;
                iconString = Constants.PowerOptions[categoryEnum].ICON;
            }
            else {
                name = Constants.Categories[categoryEnum].NAME;
                iconString = Constants.Categories[categoryEnum].ICON
            }

            const row = new PW.DragRow({
                gicon: Gio.icon_new_for_string(iconString),
                switch_enabled: true,
                switch_active: isActive,
            });
            row.activatable_widget = row.switch;
            row.setting_type = categoryEnum;
            row.title = _(name);

            row.connect("drag-drop-done", () => this.saveSettings() );
            row.connect('switch-toggled', () => this.saveSettings() );

            const editEntryButton = new PW.EditEntriesBox({ row: row });
            editEntryButton.connect("row-changed", () => this.saveSettings() );

            row.add_suffix(editEntryButton);
            this.frameRows.push(row);
            this.categoriesFrame.add(row);
        }
    }
});