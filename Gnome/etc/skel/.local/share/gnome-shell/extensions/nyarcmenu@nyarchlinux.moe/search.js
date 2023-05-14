/* exported SearchResults */
/*
 * Credits: This file leverages the work from GNOME Shell search.js file
 * (https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/search.js)
 */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Clutter, Gio, GLib, GObject, Shell, St} = imports.gi;
const AppDisplay = imports.ui.appDisplay;
const appSys = Shell.AppSystem.get_default();
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const {Highlighter} = imports.misc.util;
const MW = Me.imports.menuWidgets;
const {RecentFilesManager} = Me.imports.recentFilesManager;
const RemoteSearch = imports.ui.remoteSearch;
const _ = Gettext.gettext;

const {OpenWindowSearchProvider} = Me.imports.searchProviders.openWindows;
const {RecentFilesSearchProvider} = Me.imports.searchProviders.recentFiles;

const SEARCH_PROVIDERS_SCHEMA = 'org.gnome.desktop.search-providers';
const FILE_PROVIDERS = ['org.gnome.Nautilus.desktop', 'arcmenu.recent-files', 'nemo.desktop'];

var ListSearchResult = GObject.registerClass(
class ArcMenuListSearchResult extends MW.ApplicationMenuItem {
    _init(provider, metaInfo, resultsView) {
        const menuLayout = resultsView._menuLayout;
        const app = appSys.lookup_app(metaInfo['id']);
        metaInfo['provider-id'] = provider.id;

        super._init(menuLayout, app, Constants.DisplayType.LIST, metaInfo);

        this.app = app;
        this.searchType = this._menuLayout.search_display_type;
        this.metaInfo = metaInfo;
        this.provider = provider;
        this.resultsView = resultsView;
        this.layout = Me.settings.get_enum('menu-layout');

        if (FILE_PROVIDERS.includes(this.provider.id))
            this.folderPath = this.metaInfo['description'];

        const highlightSearchResultTerms = Me.settings.get_boolean('highlight-search-result-terms');
        if (highlightSearchResultTerms) {
            this.resultsView.connectObject('terms-changed', this._highlightTerms.bind(this), this);
            this._highlightTerms();
        }

        if (!this.app && this.metaInfo['description'])
            this.description = this.metaInfo['description'].split('\n')[0];
    }

    _highlightTerms() {
        const showSearchResultDescriptions = Me.settings.get_boolean('show-search-result-details');
        if (this.descriptionLabel && showSearchResultDescriptions) {
            const descriptionMarkup = this.resultsView.highlightTerms(this.metaInfo['description'].split('\n')[0]);
            this.descriptionLabel.clutter_text.set_markup(descriptionMarkup);
        }
        const labelMarkup = this.resultsView.highlightTerms(this.label.text.split('\n')[0]);
        this.label.clutter_text.set_markup(labelMarkup);
    }
});

var AppSearchResult = GObject.registerClass(
class ArcMenuAppSearchResult extends MW.ApplicationMenuItem {
    _init(provider, metaInfo, resultsView) {
        const menuLayout = resultsView._menuLayout;
        const app = appSys.lookup_app(metaInfo['id']) || appSys.lookup_app(provider.id);
        const displayType = menuLayout.search_display_type;
        super._init(menuLayout, app, displayType, metaInfo);
        this.app = app;
        this.provider = provider;
        this.metaInfo = metaInfo;
        this.resultsView = resultsView;

        if (!this.app && this.metaInfo['description'])
            this.description = this.metaInfo['description'].split('\n')[0];

        const highlightSearchResultTerms = Me.settings.get_boolean('highlight-search-result-terms');
        if (highlightSearchResultTerms) {
            this.resultsView.connectObject('terms-changed', this._highlightTerms.bind(this), this);
            this._highlightTerms();
        }
    }

    _highlightTerms() {
        const showSearchResultDescriptions = Me.settings.get_boolean('show-search-result-details');
        if (this.descriptionLabel && showSearchResultDescriptions) {
            const descriptionMarkup = this.resultsView.highlightTerms(this.descriptionLabel.text.split('\n')[0]);
            this.descriptionLabel.clutter_text.set_markup(descriptionMarkup);
        }

        const labelMarkup = this.resultsView.highlightTerms(this.label.text.split('\n')[0]);
        this.label.clutter_text.set_markup(labelMarkup);
    }
});

var SearchResultsBase = GObject.registerClass({
    Signals: {
        'terms-changed': {},
        'no-results': {},
    },
}, class ArcMenuSearchResultsBase extends St.BoxLayout {
    _init(provider, resultsView) {
        super._init({
            vertical: true,
        });
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
        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        this._terms = [];
    }

    _createResultDisplay(_meta) {
    }

    clear() {
        this._cancellable.cancel();
        for (const resultId in this._resultDisplays)
            this._resultDisplays[resultId].destroy();
        this._resultDisplays = {};
        this._clearResultDisplay();
        this.hide();
    }

    _setMoreCount(_count) {
    }

    _ensureResultActors(results, callback) {
        const metasNeeded = results.filter(
            resultId => this._resultDisplays[resultId] === undefined
        );

        if (metasNeeded.length === 0) {
            callback(true);
        } else {
            this._cancellable.cancel();
            this._cancellable.reset();

            this.provider.getResultMetas(metasNeeded, metas => {
                if (this._cancellable.is_cancelled()) {
                    if (metas.length > 0)
                        log(`Search provider ${this.provider.id} returned results after the request was canceled`);
                    callback(false);
                    return;
                }
                if (metas.length !== metasNeeded.length) {
                    log(`Wrong number of result metas returned by search provider ${this.provider.id
                    }: expected ${metasNeeded.length} but got ${metas.length}`);
                    callback(false);
                    return;
                }
                if (metas.some(meta => !meta.name || !meta.id)) {
                    log(`Invalid result meta returned from search provider ${this.provider.id}`);
                    callback(false);
                    return;
                }

                metasNeeded.forEach((resultId, i) => {
                    const meta = metas[i];
                    const display = this._createResultDisplay(meta);
                    this._resultDisplays[resultId] = display;
                });
                callback(true);
            }, this._cancellable);
        }
    }

    updateSearch(providerResults, terms, callback) {
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

            this._ensureResultActors(results, successful => {
                if (!successful) {
                    this._clearResultDisplay();
                    callback();
                    return;
                }

                // To avoid CSS transitions causing flickering when
                // the first search result stays the same, we hide the
                // content while filling in the results.
                this.hide();
                this._clearResultDisplay();
                results.forEach(resultId => {
                    this._addItem(this._resultDisplays[resultId]);
                });

                this._setMoreCount(this.provider.canLaunchSearch ? moreCount : 0);
                this.show();
                callback();
            });
        }
    }
});

var ListSearchResults = GObject.registerClass(
class ArcMenuListSearchResults extends SearchResultsBase {
    _init(provider, resultsView) {
        super._init(provider, resultsView);
        this._menuLayout = resultsView._menuLayout;
        this.searchType = this._menuLayout.search_display_type;
        this.layout = Me.settings.get_enum('menu-layout');

        this._container = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_expand: true,
            style: 'margin-top: 8px;',
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
            vertical: true,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });

        this._container.add_child(this._content);
        this._resultDisplayBin.set_child(this._container);
    }

    _setMoreCount(count) {
        this.providerInfo.setMoreCount(count);
    }

    _getMaxDisplayedResults() {
        return Me.settings.get_int('max-search-results');
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
});

var AppSearchResults = GObject.registerClass(
class ArcMenuAppSearchResults extends SearchResultsBase {
    _init(provider, resultsView) {
        super._init(provider, resultsView);
        this._parentContainer = resultsView;
        this._menuLayout = resultsView._menuLayout;
        this.searchType = this._menuLayout.search_display_type;
        this.layout = Me.settings.get_enum('menu-layout');

        this.itemCount = 0;
        this.gridTop = -1;
        this.gridLeft = 0;

        this.rtl = this._menuLayout.get_text_direction() === Clutter.TextDirection.RTL;

        const layout = new Clutter.GridLayout({
            orientation: Clutter.Orientation.VERTICAL,
            column_spacing: this.searchType === Constants.DisplayType.GRID ? this._menuLayout.column_spacing : 0,
            row_spacing: this.searchType === Constants.DisplayType.GRID ? this._menuLayout.row_spacing : 0,
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
            maxDisplayedResults = Me.settings.get_int('max-search-results');
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

        const GridColumns = colums;
        if (!this.rtl && (this.itemCount % GridColumns === 0)) {
            this.gridTop++;
            this.gridLeft = 0;
        } else if (this.rtl && (this.gridLeft === 0)) {
            this.gridTop++;
            this.gridLeft = GridColumns;
        }
        this._grid.layout_manager.attach(display, this.gridLeft, this.gridTop, 1, 1);
        display.gridLocation = [this.gridLeft, this.gridTop];

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
});

var SearchResults = GObject.registerClass({
    Signals: {
        'terms-changed': {},
        'have-results': {},
        'no-results': {},
    },
}, class ArcMenuSearchResults extends St.BoxLayout {
    _init(menuLayout) {
        super._init({
            vertical: true,
            y_expand: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });
        this._menuLayout = menuLayout;
        this.searchType = this._menuLayout.search_display_type;
        this.layout = Me.settings.get_enum('menu-layout');

        this._content = new St.BoxLayout({
            vertical: true,
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

        this._searchTimeoutId = null;
        this._cancellable = new Gio.Cancellable();

        this._registerProvider(new AppDisplay.AppSearchProvider());

        appSys.connectObject('installed-changed', this._reloadRemoteProviders.bind(this), this);

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
        this._clearSearchTimeout();

        this._terms = [];
        this._results = {};
        this._clearDisplay();
        this._defaultResult = null;
        this._startingSearch = false;

        this._providers.forEach(provider => {
            this._unregisterProvider(provider);
        });

        this.recentFilesManager.destroy();
        this.recentFilesManager = null;
    }

    _reloadRemoteProviders() {
        const currentTerms = this._terms;
        // cancel any active search
        if (this._terms.length !== 0)
            this._reset();

        this._oldProviders = null;
        const remoteProviders = this._providers.filter(p => p.isRemoteProvider);

        remoteProviders.forEach(provider => {
            this._unregisterProvider(provider);
        });

        if (Me.settings.get_boolean('search-provider-open-windows'))
            this._registerProvider(new OpenWindowSearchProvider());
        if (Me.settings.get_boolean('search-provider-recent-files'))
            this._registerProvider(new RecentFilesSearchProvider(this.recentFilesManager));

        RemoteSearch.loadRemoteSearchProviders(this._searchSettings, providers => {
            providers.forEach(this._registerProvider.bind(this));
        });

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

        if (provider.display)
            provider.display.destroy();
    }

    _gotResults(results, provider) {
        this._results[provider.id] = results;
        this._updateResults(provider, results);
    }

    _clearSearchTimeout() {
        if (this._searchTimeoutId) {
            GLib.source_remove(this._searchTimeoutId);
            this._searchTimeoutId = null;
        }
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
            provider.searchInProgress = true;

            const previousProviderResults = previousResults[provider.id];
            if (this._isSubSearch && previousProviderResults) {
                provider.getSubsearchResultSet(previousProviderResults,
                    this._terms,
                    results => {
                        this._gotResults(results, provider);
                    },
                    this._cancellable);
            } else {
                provider.getInitialResultSet(this._terms,
                    results => {
                        this._gotResults(results, provider);
                    },
                    this._cancellable);
            }
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
        if (provider.display)
            return;

        let providerDisplay;
        if (provider.appInfo)
            providerDisplay = new ListSearchResults(provider, this);
        else
            providerDisplay = new AppSearchResults(provider, this);
        providerDisplay.hide();
        this._content.add_child(providerDisplay);
        provider.display = providerDisplay;
    }

    _clearDisplay() {
        this._providers.forEach(provider => {
            provider.display.clear();
        });
    }

    _maybeSetInitialSelection() {
        let newDefaultResult = null;

        const providers = this._providers;
        for (let i = 0; i < providers.length; i++) {
            const provider = providers[i];
            const {display} = provider;

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
            const {display} = provider;
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
        const {display} = provider;
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
});

var ArcSearchProviderInfo = GObject.registerClass(
class ArcMenuArcSearchProviderInfo extends MW.ArcMenuPopupBaseMenuItem {
    _init(provider, menuLayout) {
        super._init(menuLayout);
        this.provider = provider;
        this._menuLayout = menuLayout;
        this.style = 'padding-top: 6px; padding-bottom: 6px; margin-bottom: 2px;';
        this.x_expand = false;
        this.x_align = Clutter.ActorAlign.START;

        this.description = this.provider.appInfo.get_description();
        if (this.description)
            this.description = this.description.split('\n')[0];

        this.label = new St.Label({
            text: provider.appInfo.get_name(),
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
});
