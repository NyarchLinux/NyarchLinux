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
import {Layout as TogneeLayout} from './tognee.js';
import {Layout as UnityLayout} from './unity.js';
import {Layout as WhiskerLayout} from './whisker.js';
import {Layout as WindowsLayout} from './windows.js';

/**
 *
 * @param {PanelMenu.Button} menuButton
 * @param {MenuLayout} layout
 * @param {boolean} isStandaloneRunner
 */
export function createMenuLayout(menuButton, layout, isStandaloneRunner) {
    if (layout === MenuLayout.GNOME_OVERVIEW)
        return null;

    let constructor;
    if (layout === MenuLayout.ARCMENU)
        constructor = ArcMenuLayout;
    else if (layout === MenuLayout.AZ)
        constructor = AzLayout;
    else if (layout === MenuLayout.BRISK)
        constructor = BriskLayout;
    else if (layout === MenuLayout.BUDGIE)
        constructor = BudgieLayout;
    else if (layout === MenuLayout.CHROMEBOOK)
        constructor = ChromebookLayout;
    else if (layout === MenuLayout.ELEMENTARY)
        constructor = ElementaryLayout;
    else if (layout === MenuLayout.ELEVEN)
        constructor = ElevenLayout;
    else if (layout === MenuLayout.ENTERPRISE)
        constructor = EnterpriseLayout;
    else if (layout === MenuLayout.GNOME_MENU)
        constructor = GnomeMenuLayout;
    else if (layout === MenuLayout.INSIDER)
        constructor = InsiderLayout;
    else if (layout === MenuLayout.MINT)
        constructor = MintLayout;
    else if (layout === MenuLayout.PLASMA)
        constructor = PlasmaLayout;
    else if (layout === MenuLayout.POP)
        constructor = PopLayout;
    else if (layout === MenuLayout.RAVEN)
        constructor = RavenLayout;
    else if (layout === MenuLayout.REDMOND)
        constructor = RedmondLayout;
    else if (layout === MenuLayout.RUNNER)
        constructor = RunnerLayout;
    else if (layout === MenuLayout.TOGNEE)
        constructor = TogneeLayout;
    else if (layout === MenuLayout.UNITY)
        constructor = UnityLayout;
    else if (layout === MenuLayout.WHISKER)
        constructor = WhiskerLayout;
    else if (layout === MenuLayout.WINDOWS)
        constructor = WindowsLayout;
    else
        constructor = ArcMenuLayout;

    return new constructor(menuButton, isStandaloneRunner);
}
