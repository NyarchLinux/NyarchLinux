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
import {Layout as ZestLayout} from './zest.js';

/**
 *
 * @param {PanelMenu.Button} menuButton
 * @param {string} layoutId
 * @param {boolean} isStandaloneRunner
 */
export function createMenuLayout(menuButton, layoutId, isStandaloneRunner) {
    if (layoutId === 'gnome-overview')
        return null;

    // Map each layout to its corresponding Layout class from static imports
    const layoutClassMap = new Map([
        ['arcmenu', ArcMenuLayout],
        ['az', AzLayout],
        ['brisk', BriskLayout],
        ['budgie', BudgieLayout],
        ['chromebook', ChromebookLayout],
        ['elementary', ElementaryLayout],
        ['11', ElevenLayout],
        ['enterprise', EnterpriseLayout],
        ['gnome-menu', GnomeMenuLayout],
        ['insider', InsiderLayout],
        ['mint', MintLayout],
        ['plasma', PlasmaLayout],
        ['pop', PopLayout],
        ['raven', RavenLayout],
        ['redmond', RedmondLayout],
        ['runner', RunnerLayout],
        ['sleek', SleekLayout],
        ['tognee', TogneeLayout],
        ['unity', UnityLayout],
        ['whisker', WhiskerLayout],
        ['windows', WindowsLayout],
        ['zest', ZestLayout],
    ]);

    // Default to ArcMenu if layout isn't found
    const LayoutClass = layoutClassMap.get(layoutId) || ArcMenuLayout;

    try {
        return new LayoutClass(menuButton, isStandaloneRunner);
    } catch (e) {
        console.log(`ArcMenu error creating MenuLayout: ${e}`);
        return null;
    }
}
