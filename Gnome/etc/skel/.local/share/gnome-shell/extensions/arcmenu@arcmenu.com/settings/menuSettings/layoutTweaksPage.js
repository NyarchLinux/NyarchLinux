import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import {getMenuLayoutInfo} from '../settingsUtils.js';
import {ListPinnedPage} from './listPinnedPage.js';
import {ListOtherPage} from './listOtherPage.js';
import * as PW from '../../prefsWidgets.js';
import {SubPage} from './subPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const LayoutTweaksPage = GObject.registerClass(
class ArcMenuLayoutTweaksPage extends SubPage {
    _init(extension, settings, params) {
        super._init(extension, settings, params);

        this.restoreDefaultsButton.visible = false;
        const layoutId = this._settings.get_string('menu-layout');
        const layoutInfo = getMenuLayoutInfo(layoutId);
        this._createLayout(layoutInfo);
    }

    setActiveLayout(layoutId) {
        const layoutInfo = getMenuLayoutInfo(layoutId);
        this.title = _('%s Layout Tweaks').format(_(layoutInfo.name));

        for (const child of this.page.children)
            this.page.remove(child);

        this.page.children = [];
        this._createLayout(layoutInfo);
    }

    _createLayout(layoutInfo) {
        const layoutId = layoutInfo.id;

        // Convert hyphenated or lowercase to CamelCase for method name
        const methodId = layoutId.split('-')
            .map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
            .join('');

        const methodName = `_${methodId}Tweaks`;
        if (this[methodName])
            this[methodName]();
        else
            this._loadPlaceHolderTweaks();
    }

    _createExtraShortcutsRow(setting) {
        const extraShortcutsPage = new ListPinnedPage(this._extension, this._settings, {
            title: _('Extra Shortcuts'),
            setting_string: setting,
            list_type: Constants.MenuSettingsListType.EXTRA_SHORTCUTS,
        });
        const extraShortcutsRow = new PW.SettingRow({
            title: _('Extra Shortcuts'),
        });
        extraShortcutsRow.settingPage = extraShortcutsPage;

        extraShortcutsRow.connect('activated', () => {
            this.get_root().push_subpage(extraShortcutsPage);
            extraShortcutsPage.resetScrollAdjustment();
        });
        return extraShortcutsRow;
    }

    _createVertSeparatorRow() {
        const vertSeparatorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('vert-separator'),
        });
        vertSeparatorSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('vert-separator', widget.get_active());
        });
        const vertSeparatorRow = new Adw.ActionRow({
            title: _('Vertical Separator'),
            activatable_widget: vertSeparatorSwitch,
        });
        vertSeparatorRow.add_suffix(vertSeparatorSwitch);
        return vertSeparatorRow;
    }

    _createActivateOnHoverRow() {
        const hoverOptions = new Gtk.StringList();
        hoverOptions.append(_('Mouse Click'));
        hoverOptions.append(_('Mouse Hover'));

        const activateOnHoverRow = new Adw.ComboRow({
            title: _('Category Activation'),
            model: hoverOptions,
        });

        if (this._settings.get_boolean('activate-on-hover'))
            activateOnHoverRow.selected = 1;
        else
            activateOnHoverRow.selected = 0;

        activateOnHoverRow.connect('notify::selected', widget => {
            let activateOnHover;
            if (widget.selected === 0)
                activateOnHover = false;
            if (widget.selected === 1)
                activateOnHover = true;

            this._settings.set_boolean('activate-on-hover', activateOnHover);
        });
        return activateOnHoverRow;
    }

    _createAvatarShapeRow() {
        const avatarStyles = new Gtk.StringList();
        avatarStyles.append(_('Round'));
        avatarStyles.append(_('Square'));
        const avatarStyleRow = new Adw.ComboRow({
            title: _('Avatar Shape'),
            model: avatarStyles,
            selected: this._settings.get_enum('avatar-style'),
        });

        avatarStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('avatar-style', widget.selected);
        });
        return avatarStyleRow;
    }

    _createSearchBarLocationRow(bottomDefault) {
        const searchBarLocationSetting = bottomDefault ? 'searchbar-default-bottom-location'
            : 'searchbar-default-top-location';

        const searchbarLocations = new Gtk.StringList();
        searchbarLocations.append(_('Bottom'));
        searchbarLocations.append(_('Top'));

        const searchbarLocationRow = new Adw.ComboRow({
            title: _('Searchbar Location'),
            model: searchbarLocations,
            selected: this._settings.get_enum(searchBarLocationSetting),
        });

        searchbarLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum(searchBarLocationSetting, widget.selected);
        });

        return searchbarLocationRow;
    }

    _createFlipHorizontalRow() {
        const horizontalFlipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        horizontalFlipSwitch.set_active(this._settings.get_boolean('enable-horizontal-flip'));
        horizontalFlipSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('enable-horizontal-flip', widget.get_active());
        });
        const horizontalFlipRow = new Adw.ActionRow({
            title: _('Flip Layout Horizontally'),
            activatable_widget: horizontalFlipSwitch,
        });
        horizontalFlipRow.add_suffix(horizontalFlipSwitch);
        return horizontalFlipRow;
    }

    _createAvatarExpanderRow() {
        const expanderRow = new Adw.ExpanderRow({
            title: _('Show User Avatar'),
            show_enable_switch: true,
            expanded: this._settings.get_boolean('scrollbars-visible'),
        });
        this._settings.bind('show-user-avatar', expanderRow, 'enable_expansion', Gio.SettingsBindFlags.DEFAULT);

        const comboRow = this._createAvatarShapeRow();
        expanderRow.add_row(comboRow);
        return expanderRow;
    }

    _enterpriseTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _popTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        const populateComboRow = () => {
            const folderNamesList = new Gtk.StringList();

            const foldersData = this._settings.get_value('pop-folders-data').deep_unpack();
            const defaultViewName = this._settings.get_string('pop-default-view');
            let defaultViewIndex;
            let count = 0;
            for (const [key, value] of Object.entries(foldersData)) {
                if (key === defaultViewName)
                    defaultViewIndex = count;

                folderNamesList.append(value);
                count++;
            }
            defaultViewRow.model = folderNamesList;
            defaultViewRow.selected = defaultViewIndex;
        };

        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
        });

        populateComboRow();

        this._settings.connect('changed::pop-folders-data', () => populateComboRow());

        defaultViewRow.connect('notify::selected', widget => {
            const foldersData = this._settings.get_value('pop-folders-data').deep_unpack();
            const selectedId = Object.keys(foldersData).find(key => foldersData[key] === widget.selected_item.string);
            this._settings.set_string('pop-default-view', selectedId);
        });

        tweaksGroup.add(defaultViewRow);
        tweaksGroup.add(this._createSearchBarLocationRow());
    }

    _11Tweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        const showFrequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        showFrequentAppsSwitch.set_active(this._settings.get_boolean('eleven-show-frequent-apps'));
        showFrequentAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('eleven-show-frequent-apps', widget.get_active());
        });
        const showFrequentAppsRow = new Adw.ActionRow({
            title: _('Show Frequent Apps'),
            activatable_widget: showFrequentAppsSwitch,
        });
        showFrequentAppsRow.add_suffix(showFrequentAppsSwitch);
        tweaksGroup.add(showFrequentAppsRow);
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('eleven-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _azTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        tweaksGroup.add(this._createSearchBarLocationRow());
        const mergePanelsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        mergePanelsSwitch.set_active(this._settings.get_boolean('az-layout-merge-panels'));
        mergePanelsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('az-layout-merge-panels', widget.get_active());
        });
        const mergePanelsRow = new Adw.ActionRow({
            title: _('Merge Top and Bottom Panels'),
            activatable_widget: mergePanelsSwitch,
        });
        mergePanelsRow.add_suffix(mergePanelsSwitch);
        tweaksGroup.add(mergePanelsRow);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Pinned Apps'));
        defaulViews.append(_('Frequent Apps'));

        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-az'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-az', widget.selected);
            frequentAppsRow.visible = widget.selected === 1;
        });
        tweaksGroup.add(defaultViewRow);

        const frequentAppsSpinner = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 40,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
            value: this._settings.get_int('az-layout-max-frequent-apps'),
        });
        frequentAppsSpinner.connect('value-changed', widget => {
            this._settings.set_int('az-layout-max-frequent-apps', widget.get_value());
        });
        const frequentAppsRow = new Adw.ActionRow({
            title: _('Max Frequent Apps'),
            activatable_widget: frequentAppsSpinner,
            visible: this._settings.get_enum('default-menu-view-az') === 1,
        });
        frequentAppsRow.add_suffix(frequentAppsSpinner);
        tweaksGroup.add(frequentAppsRow);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('az-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _gnomeOverviewTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        const appsGridSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        appsGridSwitch.set_active(this._settings.get_boolean('gnome-dash-show-applications'));
        appsGridSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('gnome-dash-show-applications', widget.get_active());
        });
        const appsGridRow = new Adw.ActionRow({
            title: _('Show Apps Grid'),
            activatable_widget: appsGridSwitch,
        });
        appsGridRow.add_suffix(appsGridSwitch);
        tweaksGroup.add(appsGridRow);
        this.add(tweaksGroup);
    }

    _windowsTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createVertSeparatorRow());
        const frequentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        frequentAppsSwitch.set_active(this._settings.get_boolean('windows-show-frequent-apps'));
        frequentAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('windows-show-frequent-apps', widget.get_active());
        });
        const frequentAppsRow = new Adw.ActionRow({
            title: _('Show Frequent Apps'),
            activatable_widget: frequentAppsSwitch,
        });
        frequentAppsRow.add_suffix(frequentAppsSwitch);
        tweaksGroup.add(frequentAppsRow);

        const pinnedAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        pinnedAppsSwitch.set_active(this._settings.get_boolean('windows-show-pinned-apps'));
        pinnedAppsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('windows-show-pinned-apps', widget.get_active());
        });
        const pinnedAppsRow = new Adw.ActionRow({
            title: _('Show Pinned Apps'),
            activatable_widget: pinnedAppsSwitch,
        });
        pinnedAppsRow.add_suffix(pinnedAppsSwitch);
        tweaksGroup.add(pinnedAppsRow);

        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('windows-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _plasmaTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());

        const hoverSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        hoverSwitch.set_active(this._settings.get_boolean('plasma-enable-hover'));
        hoverSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('plasma-enable-hover', widget.get_active());
        });
        const hoverRow = new Adw.ActionRow({
            title: _('Activate on Hover'),
            activatable_widget: hoverSwitch,
        });
        hoverRow.add_suffix(hoverSwitch);
        tweaksGroup.add(hoverRow);

        this.add(tweaksGroup);
    }

    _briskTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('brisk-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _chromebookTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());
        this.add(tweaksGroup);
    }

    _elementaryTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createSearchBarLocationRow());
        this.add(tweaksGroup);
    }

    _budgieTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());

        const enableActivitiesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        enableActivitiesSwitch.set_active(this._settings.get_boolean('enable-activities-shortcut'));
        enableActivitiesSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('enable-activities-shortcut', widget.get_active());
        });
        const enableActivitiesRow = new Adw.ActionRow({
            title: _('Enable Activities Overview Shortcut'),
            activatable_widget: enableActivitiesSwitch,
        });
        enableActivitiesRow.add_suffix(enableActivitiesSwitch);
        tweaksGroup.add(enableActivitiesRow);

        this.add(tweaksGroup);
    }

    _runnerTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);
        const runnerPositions = new Gtk.StringList();
        runnerPositions.append(_('Top'));
        runnerPositions.append(_('Centered'));
        const runnerPositionRow = new Adw.ComboRow({
            title: _('Position'),
            model: runnerPositions,
            selected: this._settings.get_enum('runner-position'),
        });

        runnerPositionRow.connect('notify::selected', widget => {
            this._settings.set_enum('runner-position', widget.selected);
        });
        tweaksGroup.add(runnerPositionRow);

        const runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_('List'));
        runnerSearchStyles.append(_('Grid'));
        const runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('runner-search-display-style'),
        });

        runnerSearchStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('runner-search-display-style', widget.selected);
        });
        tweaksGroup.add(runnerSearchStyleRow);

        const searchbarLocations = new Gtk.StringList();
        searchbarLocations.append(_('Bottom'));
        searchbarLocations.append(_('Top'));

        const searchbarLocationRow = new Adw.ComboRow({
            title: _('Searchbar Location'),
            model: searchbarLocations,
            selected: this._settings.get_enum('runner-searchbar-location'),
        });

        searchbarLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum('runner-searchbar-location', widget.selected);
        });
        tweaksGroup.add(searchbarLocationRow);

        const sizeGroup = new Adw.PreferencesGroup();
        this.add(sizeGroup);

        const runnerWidthScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 5000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerWidthScale.set_value(this._settings.get_int('runner-menu-width'));
        runnerWidthScale.connect('value-changed', widget => {
            this._settings.set_int('runner-menu-width', widget.get_value());
        });
        const runnerWidthRow = new Adw.ActionRow({
            title: _('Width'),
            activatable_widget: runnerWidthScale,
        });
        runnerWidthRow.add_suffix(runnerWidthScale);
        sizeGroup.add(runnerWidthRow);

        const runnerHeightScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1000,
                step_increment: 15,
                page_increment: 15,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerHeightScale.set_value(this._settings.get_int('runner-menu-height'));
        runnerHeightScale.connect('value-changed', widget => {
            this._settings.set_int('runner-menu-height', widget.get_value());
        });
        const runnerHeightRow = new Adw.ActionRow({
            title: _('Height'),
            activatable_widget: runnerHeightScale,
        });
        runnerHeightRow.add_suffix(runnerHeightScale);
        sizeGroup.add(runnerHeightRow);

        const staticHeightSwitch = new PW.SwitchRow(this._settings, {
            setting_name: 'runner-menu-height-static',
            title: _('Static Height'),
        });
        sizeGroup.add(staticHeightSwitch);

        const runnerFontSizeScale = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 30,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        runnerFontSizeScale.set_value(this._settings.get_int('runner-font-size'));
        runnerFontSizeScale.connect('value-changed', widget => {
            this._settings.set_int('runner-font-size', widget.get_value());
        });
        const runnerFontSizeRow = new Adw.ActionRow({
            title: _('Font Size'),
            subtitle: _('%d Default Theme Value').format(0),
            activatable_widget: runnerFontSizeScale,
        });
        runnerFontSizeRow.add_suffix(runnerFontSizeScale);
        sizeGroup.add(runnerFontSizeRow);

        const miscGroup = new Adw.PreferencesGroup();
        this.add(miscGroup);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Default'));
        defaulViews.append(_('Pinned Apps'));
        defaulViews.append(_('Frequent Apps'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-runner'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-runner', widget.selected);
        });
        miscGroup.add(defaultViewRow);

        const showSettingsSwitch = new PW.SwitchRow(this._settings, {
            setting_name: 'runner-show-settings-button',
            title: _('Show Configure Runner Button'),
        });
        miscGroup.add(showSettingsSwitch);
    }

    _unityTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Home'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1,
        });
        defaultViewRow.connect('notify::selected', widget => {
            const enable = widget.selected === 0;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        tweaksGroup.add(defaultViewRow);

        const widgetGroup = this._createWidgetsRows('unity');
        this.add(widgetGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('unity-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _ravenTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Home'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_boolean('enable-unity-homescreen') ? 0 : 1,
        });
        defaultViewRow.connect('notify::selected', widget => {
            const enable = widget.selected === 0;
            this._settings.set_boolean('enable-unity-homescreen', enable);
        });
        tweaksGroup.add(defaultViewRow);

        const runnerSearchStyles = new Gtk.StringList();
        runnerSearchStyles.append(_('List'));
        runnerSearchStyles.append(_('Grid'));
        const runnerSearchStyleRow = new Adw.ComboRow({
            title: _('Search Results Display Style'),
            model: runnerSearchStyles,
            selected: this._settings.get_enum('raven-search-display-style'),
        });

        runnerSearchStyleRow.connect('notify::selected', widget => {
            this._settings.set_enum('raven-search-display-style', widget.selected);
        });
        tweaksGroup.add(runnerSearchStyleRow);

        const ravenPositions = new Gtk.StringList();
        ravenPositions.append(_('Left'));
        ravenPositions.append(_('Right'));
        const ravenPositionRow = new Adw.ComboRow({
            title: _('Position on Monitor'),
            model: ravenPositions,
            selected: this._settings.get_enum('raven-position'),
        });
        ravenPositionRow.connect('notify::selected', widget => {
            this._settings.set_enum('raven-position', widget.selected);
        });
        tweaksGroup.add(ravenPositionRow);
        tweaksGroup.add(this._createActivateOnHoverRow());
        const widgetGroup = this._createWidgetsRows('raven');
        this.add(widgetGroup);
    }

    _mintTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('mint-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _whiskerTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _sleekTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);

        tweaksGroup.add(this._createAvatarShapeRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        this.add(extraShortcutsGroup);

        const rightPanelWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 150, upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            valign: Gtk.Align.CENTER,
            digits: 0,
            numeric: true,
        });
        rightPanelWidthSpinButton.set_value(this._settings.get_int('sleek-layout-panel-width'));
        rightPanelWidthSpinButton.connect('value-changed', widget => {
            this._settings.set_int('sleek-layout-panel-width', widget.get_value());
        });
        const rightPanelWidthRow = new Adw.ActionRow({
            title: _('Extra Shortcuts Panel Width'),
            activatable_widget: rightPanelWidthSpinButton,
        });
        rightPanelWidthRow.add_suffix(rightPanelWidthSpinButton);
        extraShortcutsGroup.add(rightPanelWidthRow);

        const extraShortcutsRow = this._createExtraShortcutsRow('sleek-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
    }

    _redmondTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('All Programs'));
        defaulViews.append(_('Pinned Apps'));

        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-redmond'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-redmond', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        tweaksGroup.add(this._createAvatarExpanderRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());

        this.add(tweaksGroup);

        const placesGroup = new Adw.PreferencesGroup({
            title: _('Extra Shortcuts'),
        });
        this.add(placesGroup);

        const externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        const externalDeviceRow = new Adw.ActionRow({
            title: _('External Devices'),
            activatable_widget: externalDeviceButton,
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesGroup.add(externalDeviceRow);

        const bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        const bookmarksRow = new Adw.ActionRow({
            title: _('Bookmarks'),
            activatable_widget: bookmarksButton,
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesGroup.add(bookmarksRow);
    }

    _insiderTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createVertSeparatorRow());
        tweaksGroup.add(this._createAvatarExpanderRow());
        this.add(tweaksGroup);

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        const extraShortcutsRow = this._createExtraShortcutsRow('insider-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
        this.add(extraShortcutsGroup);
    }

    _gnomeMenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createSearchBarLocationRow());
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _loadPlaceHolderTweaks() {
        const placeHolderGroup = new Adw.PreferencesGroup();
        const placeHolderRow = new Adw.ActionRow({
            title: _('Nothing Yet!'),
        });
        placeHolderGroup.add(placeHolderRow);
        this.add(placeHolderGroup);
    }

    _togneeTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Categories List'));
        defaulViews.append(_('All Programs'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view-tognee'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            this._settings.set_enum('default-menu-view-tognee', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        const searchBarBottomDefault = true;
        tweaksGroup.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);
    }

    _arcmenuTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();

        const defaulViews = new Gtk.StringList();
        defaulViews.append(_('Pinned Apps'));
        defaulViews.append(_('Categories List'));
        defaulViews.append(_('Frequent Apps'));
        defaulViews.append(_('All Programs'));
        defaulViews.append(_('Pinned and Frequent Apps'));
        const defaultViewRow = new Adw.ComboRow({
            title: _('Default View'),
            model: defaulViews,
            selected: this._settings.get_enum('default-menu-view'),
        });
        defaultViewRow.connect('notify::selected', widget => {
            maxFrequentAppsRow.visible = widget.selected === 4 || widget.selected === 2;
            this._settings.set_enum('default-menu-view', widget.selected);
        });
        tweaksGroup.add(defaultViewRow);

        const maxFrequentAppsSpinButton = new Gtk.SpinButton({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 50,
                step_increment: 1,
                page_increment: 1,
                page_size: 0,
            }),
            digits: 0,
            valign: Gtk.Align.CENTER,
        });
        maxFrequentAppsSpinButton.set_value(this._settings.get_int('arcmenu-layout-max-frequent-apps'));
        maxFrequentAppsSpinButton.connect('value-changed', widget => {
            this._settings.set_int('arcmenu-layout-max-frequent-apps', widget.get_value());
        });
        const maxFrequentAppsRow = new Adw.ActionRow({
            title: _('Max Frequent Apps'),
            subtitle: _('0 = unlimited'),
            activatable_widget: maxFrequentAppsSpinButton,
        });
        maxFrequentAppsRow.add_suffix(maxFrequentAppsSpinButton);
        tweaksGroup.add(maxFrequentAppsRow);

        maxFrequentAppsRow.visible = defaultViewRow.selected === 4 || defaultViewRow.selected === 2;

        const allAppsButtonActionsList = new Gtk.StringList();
        allAppsButtonActionsList.append(_('Categories List'));
        allAppsButtonActionsList.append(_('All Programs'));

        const allAppsButtonActionRow = new Adw.ComboRow({
            title: _("'All Apps' Button Action"),
            model: allAppsButtonActionsList,
            selected: this._settings.get_enum('all-apps-button-action'),
        });
        allAppsButtonActionRow.connect('notify::selected', widget => {
            this._settings.set_enum('all-apps-button-action', widget.selected);
        });
        tweaksGroup.add(allAppsButtonActionRow);

        const searchBarBottomDefault = true;
        tweaksGroup.add(this._createAvatarExpanderRow());
        tweaksGroup.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());
        this.add(tweaksGroup);

        const placesGroup = new Adw.PreferencesGroup({
            title: _('Extra Shortcuts'),
        });

        const externalDeviceButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        externalDeviceButton.set_active(this._settings.get_boolean('show-external-devices'));
        externalDeviceButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-external-devices', widget.get_active());
        });
        const externalDeviceRow = new Adw.ActionRow({
            title: _('External Devices'),
            activatable_widget: externalDeviceButton,
        });
        externalDeviceRow.add_suffix(externalDeviceButton);
        placesGroup.add(externalDeviceRow);

        const bookmarksButton = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        bookmarksButton.set_active(this._settings.get_boolean('show-bookmarks'));
        bookmarksButton.connect('notify::active', widget => {
            this._settings.set_boolean('show-bookmarks', widget.get_active());
        });
        const bookmarksRow = new Adw.ActionRow({
            title: _('Bookmarks'),
            activatable_widget: bookmarksButton,
        });
        bookmarksRow.add_suffix(bookmarksButton);
        placesGroup.add(bookmarksRow);
        this.add(placesGroup);

        const extraCategoriesGroup = new Adw.PreferencesGroup({
            title: _('Category Quick Links'),
            description: _('Display a category on the default menu view. Category must be enabled in ArcMenu Settings -> Menu -> Extra Categories section.'),
        });
        const extraCategoriesLinksBox = new ListOtherPage(this._extension, this._settings, {
            preferences_page: false,
            list_type: Constants.MenuSettingsListType.QUICK_LINKS,
        });
        extraCategoriesGroup.add(extraCategoriesLinksBox);
        this.add(extraCategoriesGroup);

        const extraCategoriesLocationGroup = new Adw.PreferencesGroup();
        const locations = new Gtk.StringList();
        locations.append(_('Bottom'));
        locations.append(_('Top'));
        const extraCategoriesLocationRow = new Adw.ComboRow({
            title: _('Quick Links Location'),
            model: locations,
            selected: this._settings.get_enum('arcmenu-extra-categories-links-location'),
        });
        extraCategoriesLocationRow.connect('notify::selected', widget => {
            this._settings.set_enum('arcmenu-extra-categories-links-location', widget.selected);
        });
        extraCategoriesLocationGroup.add(extraCategoriesLocationRow);
        this.add(extraCategoriesLocationGroup);
    }

    _zestTweaks() {
        const tweaksGroup = new Adw.PreferencesGroup();
        this.add(tweaksGroup);
        const searchBarBottomDefault = true;
        tweaksGroup.add(this._createActivateOnHoverRow());
        tweaksGroup.add(this._createAvatarExpanderRow());
        tweaksGroup.add(this._createSearchBarLocationRow(searchBarBottomDefault));
        tweaksGroup.add(this._createFlipHorizontalRow());
        tweaksGroup.add(this._createVertSeparatorRow());

        const extraShortcutsGroup = new Adw.PreferencesGroup();
        this.add(extraShortcutsGroup);

        const rightPanelWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 150, upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            valign: Gtk.Align.CENTER,
            digits: 0,
            numeric: true,
        });
        rightPanelWidthSpinButton.set_value(this._settings.get_int('zest-layout-panel-width'));
        rightPanelWidthSpinButton.connect('value-changed', widget => {
            this._settings.set_int('zest-layout-panel-width', widget.get_value());
        });
        const rightPanelWidthRow = new Adw.ActionRow({
            title: _('Extra Shortcuts Panel Width'),
            activatable_widget: rightPanelWidthSpinButton,
        });
        rightPanelWidthRow.add_suffix(rightPanelWidthSpinButton);
        extraShortcutsGroup.add(rightPanelWidthRow);

        const extraShortcutsRow = this._createExtraShortcutsRow('zest-layout-extra-shortcuts');
        extraShortcutsGroup.add(extraShortcutsRow);
    }

    _createWidgetsRows(layoutId) {
        const weatherWidgetSetting = `enable-weather-widget-${layoutId}`;
        const clockWidgetSetting = `enable-clock-widget-${layoutId}`;

        const widgetGroup = new Adw.PreferencesGroup();

        const weatherWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        weatherWidgetSwitch.set_active(this._settings.get_boolean(weatherWidgetSetting));
        weatherWidgetSwitch.connect('notify::active', widget => {
            this._settings.set_boolean(weatherWidgetSetting, widget.get_active());
        });
        const weatherWidgetRow = new Adw.ActionRow({
            title: _('Enable Weather Widget'),
            activatable_widget: weatherWidgetSwitch,
        });
        weatherWidgetRow.add_suffix(weatherWidgetSwitch);
        widgetGroup.add(weatherWidgetRow);

        const clockWidgetSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        clockWidgetSwitch.set_active(this._settings.get_boolean(clockWidgetSetting));
        clockWidgetSwitch.connect('notify::active', widget => {
            this._settings.set_boolean(clockWidgetSetting, widget.get_active());
        });
        const clockWidgetRow = new Adw.ActionRow({
            title: _('Enable Clock Widget'),
            activatable_widget: clockWidgetSwitch,
        });
        clockWidgetRow.add_suffix(clockWidgetSwitch);
        widgetGroup.add(clockWidgetRow);

        return widgetGroup;
    }
});
