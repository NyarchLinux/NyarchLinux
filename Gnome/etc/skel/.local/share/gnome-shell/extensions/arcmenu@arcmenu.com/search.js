/*
 * Credits: This file leverages the work from GNOME Shell search.js file
 * (https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/search.js)
 */
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Highlighter} from 'resource:///org/gnome/shell/misc/util.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as RemoteSearch from 'resource:///org/gnome/shell/ui/remoteSearch.js';

import {ApplicationMenuItem, BaseMenuItem} from './menuWidgets.js';
import {ArcMenuManager} from './arcmenuManager.js';
import * as Constants from './constants.js';
import {RecentFilesManager} from './recentFilesManager.js';
import {OpenWindowSearchProvider} from './searchProviders/openWindows.js';
import {RecentFilesSearchProvider} from './searchProviders/recentFiles.js';
import {getOrientationProp} from './utils.js';

const SEARCH_PROVIDERS_SCHEMA = 'org.gnome.desktop.search-providers';
const FILE_PROVIDERS = ['org.gnome.Nautilus.desktop', 'arcmenu.recent-files', 'nemo.desktop'];

class ListSearchResult extends ApplicationMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(provider, metaInfo, resultsView) {
        const menuLayout = resultsView._menuLayout;
        metaInfo['provider-id'] = provider.id;

        super(menuLayout, null, Constants.DisplayType.LIST, metaInfo);

        this.searchType = this._menuLayout.search_display_type;
        this.metaInfo = metaInfo;
        this.provider = provider;
        this.resultsView = resultsView;
        this.layout = ArcMenuManager.settings.get_enum('menu-layout');

        if (FILE_PROVIDERS.includes(this.provider.id))
            this.folderPath = this.metaInfo['description'];

        const highlightSearchResultTerms = ArcMenuManager.settings.get_boolean('highlight-search-result-terms');
        if (highlightSearchResultTerms) {
            this.resultsView.connectObject('terms-changed', this._highlightTerms.bind(this), this);
            this._highlightTerms();
        }

        if (this.metaInfo['description'])
            this.description = this.metaInfo['description'].split('\n')[0];
    }

    _highlightTerms() {
        const showSearchResultDescriptions = ArcMenuManager.settings.get_boolean('show-search-result-details');
        if (this.descriptionLabel && showSearchResultDescriptions) {
            const descriptionMarkup = this.resultsView.highlightTerms(this.metaInfo['description'].split('\n')[0]);
            this.descriptionLabel.clutter_text.set_markup(descriptionMarkup);
        }
        const labelMarkup = this.resultsView.highlightTerms(this.label.text.split('\n')[0]);
        this.label.clutter_text.set_markup(labelMarkup);
    }
}

class AppSearchResult extends ApplicationMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(provider, metaInfo, resultsView) {
        const menuLayout = resultsView._menuLayout;
        const appSystem = Shell.AppSystem.get_default();
        const app = appSystem.lookup_app(metaInfo['id']) || appSystem.lookup_app(provider.id);
        const displayType = menuLayout.search_display_type;

        super(menuLayout, app, displayType, metaInfo);

        this.app = app;
        this.provider = provider;
        this.metaInfo = metaInfo;
        this.resultsView = resultsView;

        if (!this.app && this.metaInfo['description'])
            this.description = this.metaInfo['description'].split('\n')[0];

        const highlightSearchResultTerms = ArcMenuManager.settings.get_boolean('highlight-search-result-terms');
        if (highlightSearchResultTerms) {
            this.resultsView.connectObject('terms-changed', this._highlightTerms.bind(this), this);
            this._highlightTerms();
        }
    }

    _highlightTerms() {
        const showSearchResultDescriptions = ArcMenuManager.settings.get_boolean('show-search-result-details');
        if (this.descriptionLabel && showSearchResultDescriptions) {
            const descriptionMarkup = this.resultsView.highlightTerms(this.descriptionLabel.text.split('\n')[0]);
            this.descriptionLabel.clutter_text.set_markup(descriptionMarkup);
        }

        const labelMarkup = this.resultsView.highlightTerms(this.label.text.split('\n')[0]);
        this.label.clutter_text.set_markup(labelMarkup);
    }
}

class SearchResultsBase extends St.BoxLayout {
    static [GObject.signals] = {
        'terms-changed': {},
        'no-results': {},
    };

    static {
        GObject.registerClass(this);
    }

    constructor(provider, resultsView) {
        super({...getOrientationProp(true)});
        this.provider = provider;
        this.resultsView = resultsView;
        this._menuLayout = resultsView._menuLayout;
        this._terms = [];

        this._resultDisplayBin = new St.Bin({
            x_expand: true,
            y_expand: true,
        });

        this.add_child(this._resultDisplayBin);

        this._resultDisplays = {};
        this._clipboard = St.Clipboard.get_default();

        this._cancellable = new Gio.Cancellable();
        this.connect('destroy', () => this._onDestroy());
    }

    _onDestroy() {
        this._cancellable.cancel();
        this._cancellable = null;

        for (const resultId in this._resultDisplays) {
            if (Object.hasOwn(this._resultDisplays, resultId)) {
                this._resultDisplays[resultId].destroy();
                delete this._resultDisplays[resultId];
            }
        }
        this._resultDisplays = null;

        this._terms = [];
        this._menuLayout = null;
    }

    _createResultDisplay(_meta) {
    }

    clear() {
        this._cancellable.cancel();
        for (const resultId in this._resultDisplays) {
            if (Object.hasOwn(this._resultDisplays, resultId)) {
                this._resultDisplays[resultId].destroy();
                delete this._resultDisplays[resultId];
            }
        }
        this._resultDisplays = {};
        this._clearResultDisplay();
        this.hide();
    }

    _setMoreCount(_count) {
    }

    async _ensureResultActors(results) {
        const metasNeeded = results.filter(
            resultId => this._resultDisplays[resultId] === undefined
        );

        if (metasNeeded.length === 0)
            return;

        this._cancellable.cancel();
        this._cancellable.reset();

        const metas = await this.provider.getResultMetas(metasNeeded, this._cancellable);

        if (this._cancellable.is_cancelled()) {
            if (metas.length > 0)
                throw new Error(`Search provider ${this.provider.id} returned results after the request was canceled`);
        }

        if (metas.length !== metasNeeded.length)
            throw new Error(`Wrong number of result metas returned by search provider ${this.provider.id}: expected ${metasNeeded.length} but got ${metas.length}`);


        if (metas.some(meta => !meta.name || !meta.id))
            throw new Error(`Invalid result meta returned from search provider ${this.provider.id}`);

        metasNeeded.forEach((resultId, i) => {
            const meta = metas[i];
            const display = this._createResultDisplay(meta);
            this._resultDisplays[resultId] = display;
        });
    }

    async updateSearch(providerResults, terms, callback) {
        this._terms = terms;
        if (providerResults.length === 0) {
            this._clearResultDisplay();
            this.hide();
            callback();
        } else {
            const maxResults = this._getMaxDisplayedResults();
            const results = maxResults > -1
                ? this.provider.filterResults(providerResults, maxResults)
                : providerResults;

            const moreCount = Math.max(providerResults.length - results.length, 0);

            try {
                await this._ensureResultActors(results);

                // To avoid CSS transitions causing flickering when
                // the first search result stays the same, we hide the
                // content while filling in the results.
                this.hide();
                this._clearResultDisplay();
                results.forEach(
                    resultId => this._addItem(this._resultDisplays[resultId]));
                this._setMoreCount(this.provider.canLaunchSearch ? moreCount : 0);
                this.show();
                callback();
            } catch (e) {
                this._clearResultDisplay();
                callback();
            }
        }
    }
}

class ListSearchResults extends SearchResultsBase {
    static {
        GObject.registerClass(this);
    }

    constructor(provider, resultsView) {
        super(provider, resultsView);
        this._menuLayout = resultsView._menuLayout;
        this.searchType = this._menuLayout.search_display_type;

        this.layout = ArcMenuManager.settings.get_enum('menu-layout');

        const spacing = this._menuLayout.search_results_spacing;

        this._container = new St.BoxLayout({
            ...getOrientationProp(true),
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: true,
            style: `margin-top: ${Math.max(spacing, 8)}px; spacing: ${Math.max(spacing, 2)}px;`,
        });

        this.providerInfo = new ArcSearchProviderInfo(provider, this._menuLayout);
        this.providerInfo.connect('activate', () => {
            if (provider.canLaunchSearch) {
                provider.launchSearch(this._terms);
                this._menuLayout.arcMenu.toggle();
            }
        });
        this._container.add_child(this.providerInfo);

        this._content = new St.BoxLayout({
            ...getOrientationProp(true),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            style: `spacing: ${spacing}px;`,
        });

        this._container.add_child(this._content);
        this._resultDisplayBin.set_child(this._container);
    }

    _setMoreCount(count) {
        this.providerInfo.setMoreCount(count);
    }

    _getMaxDisplayedResults() {
        return ArcMenuManager.settings.get_int('max-search-results');
    }

    _clearResultDisplay() {
        this._content.remove_all_children();
    }

    _createResultDisplay(meta) {
        return new ListSearchResult(this.provider, meta, this.resultsView);
    }

    _addItem(display) {
        if (display.get_parent())
            display.get_parent().remove_child(display);
        this._content.add_child(display);
    }

    getFirstResult() {
        if (this._content.get_n_children() > 0)
            return this._content.get_child_at_index(0)._delegate;
        else
            return null;
    }
}

class AppSearchResults extends SearchResultsBase {
    static {
        GObject.registerClass(this);
    }

    constructor(provider, resultsView) {
        super(provider, resultsView);
        this._parentContainer = resultsView;
        this._menuLayout = resultsView._menuLayout;
        this.searchType = this._menuLayout.search_display_type;

        this.layout = ArcMenuManager.settings.get_enum('menu-layout');

        this.itemCount = 0;
        this.gridTop = -1;
        this.gridLeft = 0;

        this.rtl = this._menuLayout.get_text_direction() === Clutter.TextDirection.RTL;

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.searchType === Constants.DisplayType.GRID ? this._menuLayout.column_spacing : this._menuLayout.search_results_spacing,
            row_spacing: this.searchType === Constants.DisplayType.GRID ? this._menuLayout.row_spacing : this._menuLayout.search_results_spacing,
        });
        this._grid = new St.Widget({
            x_expand: true,
            x_align: this.searchType === Constants.DisplayType.LIST ? Clutter.ActorAlign.FILL
                : Clutter.ActorAlign.CENTER,
            layout_manager: layout,
        });
        layout.hookup_style(this._grid);

        if (this.searchType === Constants.DisplayType.GRID) {
            const spacing = this._menuLayout.column_spacing;

            this._grid.style = `spacing: ${spacing}px;`;
            this._resultDisplayBin.x_align = Clutter.ActorAlign.CENTER;
        }

        this._resultDisplayBin.set_child(this._grid);
    }

    _getMaxDisplayedResults() {
        let maxDisplayedResults;
        if (this.searchType === Constants.DisplayType.GRID) {
            const iconWidth = this._menuLayout.getIconWidthFromSetting();
            maxDisplayedResults = this._menuLayout.getBestFitColumnsForGrid(iconWidth, this._grid);
        } else {
            maxDisplayedResults = ArcMenuManager.settings.get_int('max-search-results');
        }
        return maxDisplayedResults;
    }

    _clearResultDisplay() {
        this.itemCount = 0;
        this.gridTop = -1;
        this.gridLeft = 0;
        this._grid.remove_all_children();
    }

    _createResultDisplay(meta) {
        return new AppSearchResult(this.provider, meta, this.resultsView);
    }

    _addItem(display) {
        let colums;
        if (this.searchType === Constants.DisplayType.LIST) {
            colums = 1;
        } else {
            const iconWidth = this._menuLayout.getIconWidthFromSetting();
            colums = this._menuLayout.getBestFitColumnsForGrid(iconWidth, this._grid);
        }

        if (!this.rtl && (this.itemCount % colums === 0)) {
            this.gridTop++;
            this.gridLeft = 0;
        } else if (this.rtl && (this.gridLeft === 0)) {
            this.gridTop++;
            this.gridLeft = colums;
        }
        this._grid.layout_manager.attach(display, this.gridLeft, this.gridTop, 1, 1);

        if (!this.rtl)
            this.gridLeft++;
        else if (this.rtl)
            this.gridLeft--;
        this.itemCount++;
    }

    getFirstResult() {
        if (this._grid.get_n_children() > 0)
            return this._grid.get_child_at_index(0)._delegate;
        else
            return null;
    }
}

export class SearchResults extends St.BoxLayout {
    static [GObject.signals] = {
        'terms-changed': {},
        'have-results': {},
        'no-results': {},
    };

    static {
        GObject.registerClass(this);
    }

    constructor(menuLayout) {
        super({
            ...getOrientationProp(true),
            y_expand: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        this._menuLayout = menuLayout;

        const {searchProviderDisplayId} = menuLayout.menuButton;
        this._displayId = `display_${searchProviderDisplayId}`;

        this.searchType = this._menuLayout.search_display_type;
        this.layout = ArcMenuManager.settings.get_enum('menu-layout');

        this._content = new St.BoxLayout({
            ...getOrientationProp(true),
            x_align: Clutter.ActorAlign.FILL,
        });

        this.add_child(this._content);

        this._statusText = new St.Label();
        this._statusBin = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this.add_child(this._statusBin);
        this._statusBin.set_child(this._statusText);

        this._highlightDefault = true;
        this._defaultResult = null;
        this._startingSearch = false;

        this._terms = [];
        this._results = {};

        this._providers = [];

        this._highlighter = new Highlighter();

        this.recentFilesManager = new RecentFilesManager();

        this._searchSettings = new Gio.Settings({schema_id: SEARCH_PROVIDERS_SCHEMA});
        this._searchSettings.connectObject('changed::disabled', this._reloadRemoteProviders.bind(this), this);
        this._searchSettings.connectObject('changed::enabled', this._reloadRemoteProviders.bind(this), this);
        this._searchSettings.connectObject('changed::disable-external', this._reloadRemoteProviders.bind(this), this);
        this._searchSettings.connectObject('changed::sort-order', this._reloadRemoteProviders.bind(this), this);

        ArcMenuManager.extension.searchProviderEmitter.connectObject('search-provider-added',
            (_s, provider) => this._registerProvider(provider), this);
        ArcMenuManager.extension.searchProviderEmitter.connectObject('search-provider-removed',
            (_s, provider) => this._unregisterProvider(provider), this);

        this._searchTimeoutId = null;
        this._cancellable = new Gio.Cancellable();

        const appSystem = Shell.AppSystem.get_default();
        appSystem.connectObject('installed-changed', this._reloadRemoteProviders.bind(this), this);

        this._registerGnomeShellProviders();
        this._reloadRemoteProviders();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    get terms() {
        return this._terms;
    }

    setStyle(style) {
        if (this._statusText)
            this._statusText.style_class = style;
    }

    _onDestroy() {
        this._cancellable.cancel();
        this._cancellable = null;

        ArcMenuManager.extension.searchProviderEmitter.disconnectObject(this);
        this._searchSettings.disconnectObject(this);
        Shell.AppSystem.get_default().disconnectObject(this);

        this._clearSearchTimeout();

        this._terms = [];
        this._results = {};
        this._clearDisplay();
        this._defaultResult = null;
        this._startingSearch = false;

        this._providers.forEach(provider => {
            if (provider[this._displayId]) {
                provider[this._displayId].destroy();
                delete provider[this._displayId];
            }
        });
        this._providers = null;

        this.recentFilesManager.destroy();
        this.recentFilesManager = null;

        this._highlighter = null;
        this._searchSettings = null;
        this._menuLayout = null;
    }

    _registerGnomeShellProviders() {
        const searchResults = Main.overview.searchController._searchResults;
        const providers = searchResults._providers.filter(p => !p.isRemoteProvider);
        providers.forEach(this._registerProvider.bind(this));

        if (ArcMenuManager.settings.get_boolean('search-provider-open-windows'))
            this._registerProvider(new OpenWindowSearchProvider());
        if (ArcMenuManager.settings.get_boolean('search-provider-recent-files'))
            this._registerProvider(new RecentFilesSearchProvider(this.recentFilesManager));
    }

    _reloadRemoteProviders() {
        const currentTerms = this._terms;
        // cancel any active search
        if (this._terms.length !== 0)
            this._reset();

        const remoteProviders = this._providers.filter(p => p.isRemoteProvider);
        remoteProviders.forEach(provider => {
            this._unregisterProvider(provider);
        });

        const providers = RemoteSearch.loadRemoteSearchProviders(this._searchSettings);
        providers.forEach(this._registerProvider.bind(this));

        // restart any active search
        if (currentTerms.length > 0)
            this.setTerms(currentTerms);
    }

    _registerProvider(provider) {
        provider.searchInProgress = false;
        this._providers.push(provider);
        this._ensureProviderDisplay(provider);
    }

    _unregisterProvider(provider) {
        const index = this._providers.indexOf(provider);
        this._providers.splice(index, 1);

        if (provider[this._displayId]) {
            provider[this._displayId].destroy();
            delete provider[this._displayId];
        }
    }

    _clearSearchTimeout() {
        if (this._searchTimeoutId) {
            GLib.source_remove(this._searchTimeoutId);
            this._searchTimeoutId = null;
        }
    }

    async _doProviderSearch(provider, previousResults) {
        provider.searchInProgress = true;

        let results;
        if (this._isSubSearch && previousResults) {
            results = await provider.getSubsearchResultSet(
                previousResults,
                this._terms,
                this._cancellable);
        } else {
            results = await provider.getInitialResultSet(
                this._terms,
                this._cancellable);
        }

        this._results[provider.id] = results;
        this._updateResults(provider, results);
    }

    _reset() {
        this._terms = [];
        this._results = {};
        this._clearDisplay();
        this._clearSearchTimeout();
        this._defaultResult = null;
        this._startingSearch = false;

        this._updateSearchProgress();
    }

    _doSearch() {
        this._startingSearch = false;

        const previousResults = this._results;
        this._results = {};

        this._providers.forEach(provider => {
            const previousProviderResults = previousResults[provider.id];
            this._doProviderSearch(provider, previousProviderResults);
        });

        this._updateSearchProgress();

        this._clearSearchTimeout();
    }

    _onSearchTimeout() {
        this._searchTimeoutId = null;
        this._doSearch();
        return GLib.SOURCE_REMOVE;
    }

    setTerms(terms) {
        // Check for the case of making a duplicate previous search before
        // setting state of the current search or cancelling the search.
        // This will prevent incorrect state being as a result of a duplicate
        // search while the previous search is still active.
        const searchString = terms.join(' ');
        const previousSearchString = this._terms.join(' ');
        if (searchString === previousSearchString)
            return;

        this._startingSearch = true;

        this.recentFilesManager.cancelCurrentQueries();

        this._cancellable.cancel();
        this._cancellable.reset();

        if (terms.length === 0) {
            this._reset();
            return;
        }

        let isSubSearch = false;
        if (this._terms.length > 0)
            isSubSearch = searchString.indexOf(previousSearchString) === 0;

        this._terms = terms;
        this._isSubSearch = isSubSearch;
        this._updateSearchProgress();

        if (this._searchTimeoutId === null)
            this._searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, this._onSearchTimeout.bind(this));

        this._highlighter = new Highlighter(this._terms);

        this.emit('terms-changed');
    }

    _ensureProviderDisplay(provider) {
        if (provider[this._displayId])
            return;

        let providerDisplay;
        if (provider.appInfo)
            providerDisplay = new ListSearchResults(provider, this);
        else
            providerDisplay = new AppSearchResults(provider, this);
        providerDisplay.hide();
        this._content.add_child(providerDisplay);
        provider[this._displayId] = providerDisplay;
    }

    _clearDisplay() {
        this._providers.forEach(provider => {
            provider[this._displayId]?.clear();
        });
    }

    _maybeSetInitialSelection() {
        let newDefaultResult = null;

        const providers = this._providers;
        for (let i = 0; i < providers.length; i++) {
            const provider = providers[i];
            const display = provider[this._displayId];

            if (!display.visible)
                continue;

            const firstResult = display.getFirstResult();
            if (firstResult) {
                newDefaultResult = firstResult;
                break; // select this one!
            }
        }

        if (newDefaultResult !== this._defaultResult) {
            this._setSelected(this._defaultResult, false);
            this._setSelected(newDefaultResult, this._highlightDefault);

            this._defaultResult = newDefaultResult;
        }
    }

    get searchInProgress() {
        if (this._startingSearch)
            return true;

        return this._providers.some(p => p.searchInProgress);
    }

    _updateSearchProgress() {
        const haveResults = this._providers.some(provider => {
            const display = provider[this._displayId];
            return display.getFirstResult() !== null;
        });

        this._statusBin.visible = !haveResults;
        if (haveResults) {
            this.emit('have-results');
        } else if (!haveResults) {
            if (this.searchInProgress)
                this._statusText.set_text(_('Searching...'));
            else
                this._statusText.set_text(_('No results.'));

            this.emit('no-results');
        }
    }

    _updateResults(provider, results) {
        const terms = this._terms;
        const display = provider[this._displayId];
        display.updateSearch(results, terms, () => {
            provider.searchInProgress = false;

            this._maybeSetInitialSelection();
            this._updateSearchProgress();
        });
    }

    highlightDefault(highlight) {
        this._highlightDefault = highlight;
        this._setSelected(this._defaultResult, highlight);
    }

    getTopResult() {
        return this._defaultResult;
    }

    _setSelected(result, selected) {
        if (!result)
            return;

        if (selected && !result.has_style_pseudo_class('active'))
            result.add_style_pseudo_class('active');
        else if (!selected)
            result.remove_style_pseudo_class('active');
    }

    hasActiveResult() {
        return !!this._defaultResult && this._highlightDefault;
    }

    highlightTerms(description) {
        if (!description)
            return '';

        return this._highlighter.highlight(description);
    }
}

export class ArcSearchProviderInfo extends BaseMenuItem {
    static {
        GObject.registerClass(this);
    }

    constructor(provider, menuLayout) {
        super(menuLayout);
        this.provider = provider;
        this._menuLayout = menuLayout;
        this._appInfo = provider.appInfo;
        this.style = 'padding-top: 6px; padding-bottom: 6px;';
        this.x_expand = false;
        this.x_align = Clutter.ActorAlign.START;

        this.description = this._appInfo.get_description ? this._appInfo.get_description() : null;
        if (this.description)
            this.description = this.description.split('\n')[0];

        this.label = new St.Label({
            text: this._appInfo.get_name(),
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold;',
        });

        this._moreLabel = new St.Label({
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this.label);
        this.add_child(this._moreLabel);
    }

    setMoreCount(count) {
        this._moreLabel.text = _('+ %d more', '+ %d more', count).format(count);
        this._moreLabel.visible = count > 0;
    }
}
