export class ArcMenuManager {
    constructor(extension) {
        if (ArcMenuManager._singleton)
            throw new Error('ArcMenu has been already initialized');
        ArcMenuManager._singleton = extension;
    }

    static getDefault() {
        return ArcMenuManager._singleton;
    }

    static get customStylesheet() {
        return ArcMenuManager.getDefault().customStylesheet;
    }

    static set customStylesheet(stylesheet) {
        ArcMenuManager.getDefault().customStylesheet = stylesheet;
    }

    static get extension() {
        return ArcMenuManager.getDefault();
    }

    static get settings() {
        return ArcMenuManager.getDefault().settings;
    }

    static get menuControllers() {
        return ArcMenuManager.getDefault().menuControllers;
    }

    destroy() {
        ArcMenuManager._singleton = null;
    }
}
