/* exported SearchOptionsPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, GLib, GObject, Gtk} = imports.gi;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const {SubPage} = Settings.Menu.SubPage;

var SearchOptionsPage = GObject.registerClass(
class ArcMenuSearchOptionsPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.searchResultsDetails = this._settings.get_boolean('show-search-result-details');
        this.openWindowsSearchProvider = this._settings.get_boolean('search-provider-open-windows');
        this.recentFilesSearchProvider = this._settings.get_boolean('search-provider-recent-files');
        this.highlightSearchResultTerms = this._settings.get_boolean('highlight-search-result-terms');
        this.maxSearchResults = this._settings.get_int('max-search-results');

        const searchProvidersFrame = new Adw.PreferencesGroup({
            title: _('Extra Search Providers'),
        });

        const openWindowsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        openWindowsSwitch.set_active(this.openWindowsSearchProvider);
        openWindowsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('search-provider-open-windows', widget.get_active());
        });
        const openWindowsRow = new Adw.ActionRow({
            title: _('Search for open windows across all workspaces'),
            activatable_widget: openWindowsSwitch,
        });
        openWindowsRow.add_suffix(openWindowsSwitch);
        searchProvidersFrame.add(openWindowsRow);

        const recentFilesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        recentFilesSwitch.set_active(this.recentFilesSearchProvider);
        recentFilesSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('search-provider-recent-files', widget.get_active());
        });
        const recentFilesRow = new Adw.ActionRow({
            title: _('Search for recent files'),
            activatable_widget: recentFilesSwitch,
        });
        recentFilesRow.add_suffix(recentFilesSwitch);
        searchProvidersFrame.add(recentFilesRow);
        this.add(searchProvidersFrame);

        const searchOptionsFrame = new Adw.PreferencesGroup({
            title: _('Search Options'),
        });

        const highlightSearchResultSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        highlightSearchResultSwitch.set_active(this.highlightSearchResultTerms);
        highlightSearchResultSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('highlight-search-result-terms', widget.get_active());
        });

        const highlightSearchResultRow = new Adw.ActionRow({
            title: _('Highlight search result terms'),
            activatable_widget: highlightSearchResultSwitch,
        });
        highlightSearchResultRow.add_suffix(highlightSearchResultSwitch);
        searchOptionsFrame.add(highlightSearchResultRow);

        const maxSearchResultsScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 2,
                upper: 10,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        const maxSearchResultsRow = new Adw.ActionRow({
            title: _('Max Search Results'),
            activatable_widget: maxSearchResultsScale,
        });
        maxSearchResultsScale.set_value(this.maxSearchResults);
        maxSearchResultsScale.connect('value-changed', widget => {
            this._settings.set_int('max-search-results', widget.get_value());
        });
        maxSearchResultsRow.add_suffix(maxSearchResultsScale);
        searchOptionsFrame.add(maxSearchResultsRow);
        this.add(searchOptionsFrame);

        const [searchBorderEnabled, searchBorderValue] =
            this._settings.get_value('search-entry-border-radius').deep_unpack();

        const searchBorderSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        searchBorderSwitch.connect('notify::active', widget => {
            const [oldEnabled_, oldValue] = this._settings.get_value('search-entry-border-radius').deep_unpack();
            this._settings.set_value('search-entry-border-radius',
                new GLib.Variant('(bi)', [widget.get_active(), oldValue]));

            searchBorderSpinButton.set_sensitive(widget.get_active());
        });
        const searchBorderSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 25,
                step_increment: 1,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
            value: searchBorderValue,
            sensitive: searchBorderEnabled,
        });
        searchBorderSpinButton.connect('value-changed', widget => {
            const [oldEnabled, oldValue_] = this._settings.get_value('search-entry-border-radius').deep_unpack();
            this._settings.set_value('search-entry-border-radius',
                new GLib.Variant('(bi)', [oldEnabled, widget.get_value()]));
        });

        const searchBorderRow = new Adw.ActionRow({
            title: _('Search Box Border Radius'),
            activatable_widget: searchBorderSwitch,
        });
        searchBorderRow.add_suffix(searchBorderSwitch);
        searchBorderRow.add_suffix(new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10,
        }));
        searchBorderRow.add_suffix(searchBorderSpinButton);
        searchBorderSwitch.set_active(searchBorderEnabled);
        searchOptionsFrame.add(searchBorderRow);

        this.restoreDefaults = () => {
            this.searchResultsDetails = this._settings.get_default_value('show-search-result-details').unpack();
            this.openWindowsSearchProvider = this._settings.get_default_value('search-provider-open-windows').unpack();
            this.recentFilesSearchProvider = this._settings.get_default_value('search-provider-recent-files').unpack();
            this.highlightSearchResultTerms =
                this._settings.get_default_value('highlight-search-result-terms').unpack();
            this.maxSearchResults = this._settings.get_default_value('max-search-results').unpack();
            openWindowsSwitch.set_active(this.openWindowsSearchProvider);
            recentFilesSwitch.set_active(this.recentFilesSearchProvider);
            highlightSearchResultSwitch.set_active(this.highlightSearchResultTerms);
            maxSearchResultsScale.set_value(this.maxSearchResults);
            const [searchBorderEnabled_, defaultSearchBorderValue] =
                this._settings.get_default_value('search-entry-border-radius').deep_unpack();
            searchBorderSpinButton.set_value(defaultSearchBorderValue);
            searchBorderSwitch.set_active(true);
        };
    }
});
