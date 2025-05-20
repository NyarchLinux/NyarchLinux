import {MenuLayout} from '../constants.js';
import {Layout as ArcMenuLayout} from './arcmenu.js';
import {Layout as AzLayout} from './az.js';
import {Layout as BriskLayout} from './brisk.js';
import {Layout as BudgieLayout} from './budgie.js';
import {Layout as ChromebookLayout} from './chromebook.js';
import {Layout as ElementaryLayout} from './elementary.js';
import {Layout as ElevenLayout} from './eleven.js';
import {Layout as EnterpriseLayout} from './enterprise.js';
import {Layout as GnomeMenuLayout} from './gnomemenu.js';
import {Layout as InsiderLayout} from './insider.js';
import {Layout as MintLayout} from './mint.js';
import {Layout as PlasmaLayout} from './plasma.js';
import {Layout as PopLayout} from './pop.js';
import {Layout as RavenLayout} from './raven.js';
import {Layout as RedmondLayout} from './redmond.js';
import {Layout as RunnerLayout} from './runner.js';
import {Layout as SleekLayout} from './sleek.js';
import {Layout as TogneeLayout} from './tognee.js';
import {Layout as UnityLayout} from './unity.js';
import {Layout as WhiskerLayout} from './whisker.js';
import {Layout as WindowsLayout} from './windows.js';

/**
 *
 * @param {PanelMenu.Button} menuButton
 * @param {MenuLayout} layoutEnum
 * @param {boolean} isStandaloneRunner
 */
export function createMenuLayout(menuButton, layoutEnum, isStandaloneRunner) {
    if (layoutEnum === MenuLayout.GNOME_OVERVIEW)
        return null;

    // Map each layout to its corresponding Layout class from static imports
    const layoutMap = {
        [MenuLayout.ARCMENU]: ArcMenuLayout,
        [MenuLayout.AZ]: AzLayout,
        [MenuLayout.BRISK]: BriskLayout,
        [MenuLayout.BUDGIE]: BudgieLayout,
        [MenuLayout.CHROMEBOOK]: ChromebookLayout,
        [MenuLayout.ELEMENTARY]: ElementaryLayout,
        [MenuLayout.ELEVEN]: ElevenLayout,
        [MenuLayout.ENTERPRISE]: EnterpriseLayout,
        [MenuLayout.GNOME_MENU]: GnomeMenuLayout,
        [MenuLayout.INSIDER]: InsiderLayout,
        [MenuLayout.MINT]: MintLayout,
        [MenuLayout.PLASMA]: PlasmaLayout,
        [MenuLayout.POP]: PopLayout,
        [MenuLayout.RAVEN]: RavenLayout,
        [MenuLayout.REDMOND]: RedmondLayout,
        [MenuLayout.RUNNER]: RunnerLayout,
        [MenuLayout.SLEEK]: SleekLayout,
        [MenuLayout.TOGNEE]: TogneeLayout,
        [MenuLayout.UNITY]: UnityLayout,
        [MenuLayout.WHISKER]: WhiskerLayout,
        [MenuLayout.WINDOWS]: WindowsLayout,
    };

    const LayoutClass = layoutMap[layoutEnum] || ArcMenuLayout; // Default to ArcMenu if layout isn't found

    try {
        return new LayoutClass(menuButton, isStandaloneRunner);
    } catch (e) {
        console.log(`ArcMenu error creating MenuLayout: ${e}`);
        return null;
    }
}
