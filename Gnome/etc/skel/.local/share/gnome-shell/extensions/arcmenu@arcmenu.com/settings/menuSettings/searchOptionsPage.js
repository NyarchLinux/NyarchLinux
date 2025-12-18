import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {SubPage} from './subPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const SearchOptionsPage = GObject.registerClass(
class ArcMenuSearchOptionsPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        const searchOptionsFrame = new Adw.PreferencesGroup({
            title: _('Search Options'),
        });

        const hideSearchSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('search-hidden'),
        });
        hideSearchSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('search-hidden', widget.get_active());
        });
        const hideSearchRow = new Adw.ActionRow({
            title: _('Hide Search Bar'),
            subtitle: _('The search bar hides when empty and appears when typing.'),
            activatable_widget: hideSearchSwitch,
        });
        hideSearchRow.add_suffix(hideSearchSwitch);
        searchOptionsFrame.add(hideSearchRow);

        const searchDescriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('show-search-result-details'),
        });
        searchDescriptionsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('show-search-result-details', widget.get_active());
        });
        const searchDescriptionsRow = new Adw.ActionRow({
            title: _('Show Search Result Descriptions'),
            activatable_widget: searchDescriptionsSwitch,
        });
        searchDescriptionsRow.add_suffix(searchDescriptionsSwitch);
        searchOptionsFrame.add(searchDescriptionsRow);

        const highlightSearchResultSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('highlight-search-result-terms'),
        });
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
        maxSearchResultsScale.set_value(this._settings.get_int('max-search-results'));
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

        const searchProvidersFrame = new Adw.PreferencesGroup({
            title: _('Extra Search Providers'),
        });

        const openWindowsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('search-provider-open-windows'),
        });
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
            active: this._settings.get_boolean('search-provider-recent-files'),
        });
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

        this.restoreDefaults = () => {
            const searchResultsDetails = this._settings.get_default_value('show-search-result-details').unpack();
            const openWindowsSearchProvider = this._settings.get_default_value('search-provider-open-windows').unpack();
            const recentFilesSearchProvider = this._settings.get_default_value('search-provider-recent-files').unpack();
            const highlightSearchResultTerms = this._settings.get_default_value('highlight-search-result-terms').unpack();
            const maxSearchResults = this._settings.get_default_value('max-search-results').unpack();
            const [searchBorderEnabled_, defaultSearchBorderValue] = this._settings.get_default_value('search-entry-border-radius').deep_unpack();
            const searchHidden = this._settings.get_default_value('search-hidden').unpack();

            openWindowsSwitch.set_active(openWindowsSearchProvider);
            recentFilesSwitch.set_active(recentFilesSearchProvider);
            highlightSearchResultSwitch.set_active(highlightSearchResultTerms);
            maxSearchResultsScale.set_value(maxSearchResults);
            searchBorderSpinButton.set_value(defaultSearchBorderValue);
            searchBorderSwitch.set_active(true);
            searchDescriptionsSwitch.set_active(searchResultsDetails);
            hideSearchSwitch.set_active(searchHidden);
        };
    }
});
