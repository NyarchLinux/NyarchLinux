import {MenuLayout} from '../constants.js';

/**
 *
 * @param {PanelMenu.Button} menuButton
 * @param {MenuLayout} layoutEnum
 * @param {boolean} isStandaloneRunner
 */
export async function createMenuLayout(menuButton, layoutEnum, isStandaloneRunner) {
    if (layoutEnum === MenuLayout.GNOME_OVERVIEW)
        return null;

    // Map each layout to its corresponding file path
    const layoutMap = {
        [MenuLayout.ARCMENU]: './arcmenu.js',
        [MenuLayout.AZ]: './az.js',
        [MenuLayout.BRISK]: './brisk.js',
        [MenuLayout.BUDGIE]: './budgie.js',
        [MenuLayout.CHROMEBOOK]: './chromebook.js',
        [MenuLayout.ELEMENTARY]: './elementary.js',
        [MenuLayout.ELEVEN]: './eleven.js',
        [MenuLayout.ENTERPRISE]: './enterprise.js',
        [MenuLayout.GNOME_MENU]: './gnomemenu.js',
        [MenuLayout.INSIDER]: './insider.js',
        [MenuLayout.MINT]: './mint.js',
        [MenuLayout.PLASMA]: './plasma.js',
        [MenuLayout.POP]: './pop.js',
        [MenuLayout.RAVEN]: './raven.js',
        [MenuLayout.REDMOND]: './redmond.js',
        [MenuLayout.RUNNER]: './runner.js',
        [MenuLayout.SLEEK]: './sleek.js',
        [MenuLayout.TOGNEE]: './tognee.js',
        [MenuLayout.UNITY]: './unity.js',
        [MenuLayout.WHISKER]: './whisker.js',
        [MenuLayout.WINDOWS]: './windows.js',
    };

    const modulePath = layoutMap[layoutEnum] || './arcmenu.js'; // Default to ArcMenu if layout isn't found

    // Dynamically import the required layout
    try {
        const {Layout} = await import(modulePath);
        return new Layout(menuButton, isStandaloneRunner);
    } catch (e) {
        return null;
    }
}
