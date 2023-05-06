const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, GObject, Gtk} = imports.gi;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const PW = Me.imports.prefsWidgets;
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const { SubPage } = Settings.Menu.SubPage;

var FineTunePage = GObject.registerClass(
class ArcMenu_FineTunePage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.disableFadeEffect = this._settings.get_boolean('disable-scrollview-fade-effect');
        this.alphabetizeAllPrograms = this._settings.get_boolean('alphabetize-all-programs')
        this.multiLinedLabels = this._settings.get_boolean('multi-lined-labels');
        this.disableTooltips = this._settings.get_boolean('disable-tooltips');
        this.disableRecentApps = this._settings.get_boolean('disable-recently-installed-apps');
        this.showHiddenRecentFiles = this._settings.get_boolean('show-hidden-recent-files');

        let miscGroup = new Adw.PreferencesGroup();

        let descriptionsGroup = new Adw.PreferencesGroup();
        this.add(descriptionsGroup);

        let searchDescriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        searchDescriptionsSwitch.set_active(this.searchResultsDetails);
        searchDescriptionsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-search-result-details', widget.get_active());
        });
        let searchDescriptionsRow = new Adw.ActionRow({
            title: _("Show Search Result Descriptions"),
            activatable_widget: searchDescriptionsSwitch
        });
        searchDescriptionsRow.add_suffix(searchDescriptionsSwitch);
        descriptionsGroup.add(searchDescriptionsRow);

        let appDescriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        appDescriptionsSwitch.set_active(this._settings.get_boolean('apps-show-extra-details'));
        appDescriptionsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('apps-show-extra-details', widget.get_active())
        });
        let appDescriptionsRow = new Adw.ActionRow({
            title: _("Show Application Descriptions"),
            activatable_widget: appDescriptionsSwitch
        });
        appDescriptionsRow.add_suffix(appDescriptionsSwitch);
        descriptionsGroup.add(appDescriptionsRow);

        let iconStyleGroup = new Adw.PreferencesGroup();
        this.add(iconStyleGroup);

        let iconTypes = new Gtk.StringList();
        iconTypes.append(_('Full Color'));
        iconTypes.append(_('Symbolic'));
        let categoryIconTypeRow = new Adw.ComboRow({
            title: _('Category Icon Type'),
            subtitle: _("Some icon themes may not include selected icon type"),
            model: iconTypes,
            selected: this._settings.get_enum('category-icon-type')
        });
        categoryIconTypeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('category-icon-type', widget.selected);
        });
        iconStyleGroup.add(categoryIconTypeRow);

        let shortcutsIconTypeRow = new Adw.ComboRow({
            title: _('Shortcuts Icon Type'),
            subtitle: _("Some icon themes may not include selected icon type"),
            model: iconTypes,
            selected: this._settings.get_enum('shortcut-icon-type')
        });
        shortcutsIconTypeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('shortcut-icon-type', widget.selected);
        });
        iconStyleGroup.add(shortcutsIconTypeRow);
    
        let fadeEffectSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        fadeEffectSwitch.set_active(this._settings.get_boolean('disable-scrollview-fade-effect'));
        fadeEffectSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('disable-scrollview-fade-effect', widget.get_active());
        });
        let fadeEffectRow = new Adw.ActionRow({
            title: _("Disable ScrollView Fade Effects"),
            activatable_widget: fadeEffectSwitch
        });
        fadeEffectRow.add_suffix(fadeEffectSwitch);
        miscGroup.add(fadeEffectRow);

        let tooltipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        tooltipSwitch.set_active(this.disableTooltips);
        tooltipSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('disable-tooltips', widget.get_active());
        });
        let tooltipRow = new Adw.ActionRow({
            title: _("Disable Tooltips"),
            activatable_widget: tooltipSwitch
        });
        tooltipRow.add_suffix(tooltipSwitch);
        miscGroup.add(tooltipRow);

        let alphabetizeAllProgramsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        alphabetizeAllProgramsSwitch.set_active(this._settings.get_boolean('alphabetize-all-programs'));
        alphabetizeAllProgramsSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('alphabetize-all-programs', widget.get_active());
        });
        let alphabetizeAllProgramsRow = new Adw.ActionRow({
            title: _("Alphabetize 'All Programs' Category"),
            activatable_widget: alphabetizeAllProgramsSwitch
        });
        alphabetizeAllProgramsRow.add_suffix(alphabetizeAllProgramsSwitch);
        miscGroup.add(alphabetizeAllProgramsRow);

        let hiddenFilesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        hiddenFilesSwitch.set_active(this._settings.get_boolean('show-hidden-recent-files'));
        hiddenFilesSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('show-hidden-recent-files', widget.get_active());
        });
        let hiddenFilesRow = new Adw.ActionRow({
            title: _("Show Hidden Recent Files"),
            activatable_widget: hiddenFilesSwitch
        });
        hiddenFilesRow.add_suffix(hiddenFilesSwitch);
        miscGroup.add(hiddenFilesRow);

        let multiLinedLabelSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        multiLinedLabelSwitch.set_active(this._settings.get_boolean('multi-lined-labels'));
        multiLinedLabelSwitch.connect('notify::active', (widget) => {
            this._settings.set_boolean('multi-lined-labels', widget.get_active());
        });
        let multiLinedLabelInfoButton = new Gtk.Button({
            icon_name: 'help-about-symbolic',
            valign: Gtk.Align.CENTER
        });
        multiLinedLabelInfoButton.connect('clicked', () => {
            let dialog = new Gtk.MessageDialog({
                text: "<b>" + _("Multi-Lined Labels") + '</b>\n' + _('Enable/Disable multi-lined labels on large application icon layouts.'),
                use_markup: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true
            });
            dialog.connect('response', (widget, response) => {
                dialog.destroy();
            });
            dialog.show();
        });
        let multiLinedLabelRow = new Adw.ActionRow({
            title: _("Multi-Lined Labels"),
            activatable_widget: multiLinedLabelSwitch
        });
        multiLinedLabelRow.add_suffix(multiLinedLabelSwitch);
        multiLinedLabelRow.add_suffix(multiLinedLabelInfoButton);
        miscGroup.add(multiLinedLabelRow);

        let recentAppsGroup = new Adw.PreferencesGroup();
        this.add(recentAppsGroup);

        let recentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        recentAppsSwitch.connect('notify::active', (widget) => {
            if(widget.get_active())
                clearRecentAppsRow.hide();
            else
                clearRecentAppsRow.show();
            this._settings.set_boolean('disable-recently-installed-apps', widget.get_active());
        });
        let recentAppsRow = new Adw.ActionRow({
            title: _("Disable New Apps Tracker"),
            activatable_widget: recentAppsSwitch
        });
        recentAppsRow.add_suffix(recentAppsSwitch);
        recentAppsGroup.add(recentAppsRow);

        let clearRecentAppsButton = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            label: _("Clear All"),
        });
        let sensitive = this._settings.get_strv('recently-installed-apps').length > 0;
        clearRecentAppsButton.set_sensitive(sensitive);
        clearRecentAppsButton.connect('clicked', (widget) => {
            clearRecentAppsButton.set_sensitive(false);
            this._settings.reset('recently-installed-apps');
        });
        let clearRecentAppsRow = new Adw.ActionRow({
            title: _("Clear Apps Marked 'New'"),
            activatable_widget: clearRecentAppsButton
        });
        clearRecentAppsRow.add_suffix(clearRecentAppsButton);
        recentAppsGroup.add(clearRecentAppsRow);

        recentAppsSwitch.set_active(this._settings.get_boolean('disable-recently-installed-apps'));

        this.add(miscGroup);

        this.restoreDefaults = () => {
            this.alphabetizeAllPrograms = this._settings.get_default_value('alphabetize-all-programs').unpack();
            this.multiLinedLabels = this._settings.get_default_value('multi-lined-labels').unpack();
            this.disableTooltips = this._settings.get_default_value('disable-tooltips').unpack();
            this.disableFadeEffect = this._settings.get_default_value('disable-scrollview-fade-effect').unpack();
            this.disableRecentApps = this._settings.get_default_value('disable-recently-installed-apps').unpack();
            this.showHiddenRecentFiles = this._settings.get_default_value('show-hidden-recent-files').unpack();
            alphabetizeAllProgramsSwitch.set_active(this.alphabetizeAllPrograms);
            multiLinedLabelSwitch.set_active(this.multiLinedLabels);
            tooltipSwitch.set_active(this.disableTooltips);
            fadeEffectSwitch.set_active(this.disableFadeEffect);
            recentAppsSwitch.set_active(this.disableRecentApps);
            hiddenFilesSwitch.set_active(this.showHiddenRecentFiles);
            categoryIconTypeRow.selected = 0;
            shortcutsIconTypeRow.selected = 1;
            appDescriptionsSwitch.set_active(this._settings.get_default_value('apps-show-extra-details').unpack());
            searchDescriptionsSwitch.set_active(this._settings.get_default_value('show-search-result-details').unpack());
        };
    }
});
