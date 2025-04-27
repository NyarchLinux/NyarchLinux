import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {SearchController} from 'resource:///org/gnome/shell/ui/searchController.js';

/**
 * Override SearchController addProvider() and removeProvider() methods to emit signals
 * when called. Allows ArcMenu to use custom search providers from extensions that use these methods.
 */

export class SearchProviderEmitter extends EventEmitter {
    constructor() {
        super();

        this._injectionManager = new InjectionManager();

        this._injectionManager.overrideMethod(SearchController.prototype, 'addProvider', originalMethod => {
            const searchProviderEmitter = this;
            return function (provider) {
                /* eslint-disable-next-line no-invalid-this */
                originalMethod.call(this, provider);
                searchProviderEmitter.emit('search-provider-added', provider);
            };
        });

        this._injectionManager.overrideMethod(SearchController.prototype, 'removeProvider', originalMethod => {
            const searchProviderEmitter = this;
            return function (provider) {
                /* eslint-disable-next-line no-invalid-this */
                originalMethod.call(this, provider);
                searchProviderEmitter.emit('search-provider-removed', provider);
            };
        });
    }

    destroy() {
        this._injectionManager.restoreMethod(SearchController.prototype, 'addProvider');
        this._injectionManager.restoreMethod(SearchController.prototype, 'removeProvider');
        this._injectionManager = null;
    }
}
