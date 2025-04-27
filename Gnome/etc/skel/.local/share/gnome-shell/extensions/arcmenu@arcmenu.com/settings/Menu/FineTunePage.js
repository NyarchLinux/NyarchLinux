import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {SubPage} from './SubPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const FineTunePage = GObject.registerClass(
class ArcMenuFineTunePage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.disableFadeEffect = this._settings.get_boolean('disable-scrollview-fade-effect');
        this.alphabeticalGroupingList = this._settings.get_boolean('group-apps-alphabetically-list-layouts');
        this.alphabeticalGroupingGrid = this._settings.get_boolean('group-apps-alphabetically-grid-layouts');
        this.multiLinedLabels = this._settings.get_boolean('multi-lined-labels');
        this.disableTooltips = this._settings.get_boolean('disable-tooltips');
        this.disableRecentApps = this._settings.get_boolean('disable-recently-installed-apps');
        this.showHiddenRecentFiles = this._settings.get_boolean('show-hidden-recent-files');

        const miscGroup = new Adw.PreferencesGroup();
        this.add(miscGroup);

        const subMenusSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        subMenusSwitch.set_active(this._settings.get_boolean('show-category-sub-menus'));
        subMenusSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('show-category-sub-menus', widget.get_active());
        });
        const subMenusRow = new Adw.ActionRow({
            title: _('Show Category Sub Menus'),
            activatable_widget: subMenusSwitch,
        });
        subMenusRow.add_suffix(subMenusSwitch);
        miscGroup.add(subMenusRow);

        const appDescriptionsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        appDescriptionsSwitch.set_active(this._settings.get_boolean('apps-show-extra-details'));
        appDescriptionsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('apps-show-extra-details', widget.get_active());
        });
        const appDescriptionsRow = new Adw.ActionRow({
            title: _('Show Application Descriptions'),
            activatable_widget: appDescriptionsSwitch,
        });
        appDescriptionsRow.add_suffix(appDescriptionsSwitch);
        miscGroup.add(appDescriptionsRow);

        const fadeEffectSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        fadeEffectSwitch.set_active(this._settings.get_boolean('disable-scrollview-fade-effect'));
        fadeEffectSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('disable-scrollview-fade-effect', widget.get_active());
        });
        const fadeEffectRow = new Adw.ActionRow({
            title: _('Disable ScrollView Fade Effects'),
            activatable_widget: fadeEffectSwitch,
        });
        fadeEffectRow.add_suffix(fadeEffectSwitch);
        miscGroup.add(fadeEffectRow);

        const tooltipSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        tooltipSwitch.set_active(this.disableTooltips);
        tooltipSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('disable-tooltips', widget.get_active());
        });
        const tooltipRow = new Adw.ActionRow({
            title: _('Disable Tooltips'),
            activatable_widget: tooltipSwitch,
        });
        tooltipRow.add_suffix(tooltipSwitch);
        miscGroup.add(tooltipRow);

        const alphabeticalGroupingListSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this.alphabeticalGroupingList,
        });
        alphabeticalGroupingListSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('group-apps-alphabetically-list-layouts', widget.get_active());
        });
        const alphabeticalGroupingListRow = new Adw.ActionRow({
            title: _('Group Apps Alphabetically on List Views'),
            subtitle: _('For All Apps sections'),
            activatable_widget: alphabeticalGroupingListSwitch,
        });
        alphabeticalGroupingListRow.add_suffix(alphabeticalGroupingListSwitch);
        miscGroup.add(alphabeticalGroupingListRow);

        const alphabeticalGroupingGridSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this.alphabeticalGroupingGrid,
        });
        alphabeticalGroupingGridSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('group-apps-alphabetically-grid-layouts', widget.get_active());
        });
        const alphabeticalGroupingGridRow = new Adw.ActionRow({
            title: _('Group Apps Alphabetically on Grid Views'),
            subtitle: _('For All Apps sections'),
            activatable_widget: alphabeticalGroupingGridSwitch,
        });
        alphabeticalGroupingGridRow.add_suffix(alphabeticalGroupingGridSwitch);
        miscGroup.add(alphabeticalGroupingGridRow);

        const hiddenFilesSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        hiddenFilesSwitch.set_active(this._settings.get_boolean('show-hidden-recent-files'));
        hiddenFilesSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('show-hidden-recent-files', widget.get_active());
        });
        const hiddenFilesRow = new Adw.ActionRow({
            title: _('Show Hidden Recent Files'),
            activatable_widget: hiddenFilesSwitch,
        });
        hiddenFilesRow.add_suffix(hiddenFilesSwitch);
        miscGroup.add(hiddenFilesRow);

        const multiLinedLabelSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        multiLinedLabelSwitch.set_active(this._settings.get_boolean('multi-lined-labels'));
        multiLinedLabelSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('multi-lined-labels', widget.get_active());
        });
        const multiLinedLabelRow = new Adw.ActionRow({
            title: _('Multi-Lined Labels'),
            subtitle: _('Allow application labels to span multiple lines on grid style layouts'),
            activatable_widget: multiLinedLabelSwitch,
        });
        multiLinedLabelRow.add_suffix(multiLinedLabelSwitch);
        miscGroup.add(multiLinedLabelRow);

        const iconStyleGroup = new Adw.PreferencesGroup();
        this.add(iconStyleGroup);

        const iconTypes = new Gtk.StringList();
        iconTypes.append(_('Full Color'));
        iconTypes.append(_('Symbolic'));
        const categoryIconTypeRow = new Adw.ComboRow({
            title: _('Category Icon Type'),
            subtitle: _('Some icon themes may not include selected icon type'),
            model: iconTypes,
            selected: this._settings.get_enum('category-icon-type'),
        });
        categoryIconTypeRow.connect('notify::selected', widget => {
            this._settings.set_enum('category-icon-type', widget.selected);
        });
        iconStyleGroup.add(categoryIconTypeRow);

        const shortcutsIconTypeRow = new Adw.ComboRow({
            title: _('Shortcuts Icon Type'),
            subtitle: _('Some icon themes may not include selected icon type'),
            model: iconTypes,
            selected: this._settings.get_enum('shortcut-icon-type'),
        });
        shortcutsIconTypeRow.connect('notify::selected', widget => {
            this._settings.set_enum('shortcut-icon-type', widget.selected);
        });
        iconStyleGroup.add(shortcutsIconTypeRow);

        const recentAppsGroup = new Adw.PreferencesGroup();
        this.add(recentAppsGroup);

        const recentAppsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        recentAppsSwitch.connect('notify::active', widget => {
            if (widget.get_active())
                clearRecentAppsRow.hide();
            else
                clearRecentAppsRow.show();
            this._settings.set_boolean('disable-recently-installed-apps', widget.get_active());
        });
        const recentAppsRow = new Adw.ActionRow({
            title: _('Disable New Apps Tracker'),
            activatable_widget: recentAppsSwitch,
        });
        recentAppsRow.add_suffix(recentAppsSwitch);
        recentAppsGroup.add(recentAppsRow);

        const clearRecentAppsButton = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            label: _('Clear All'),
        });
        const sensitive = this._settings.get_strv('recently-installed-apps').length > 0;
        clearRecentAppsButton.set_sensitive(sensitive);
        clearRecentAppsButton.connect('clicked', () => {
            clearRecentAppsButton.set_sensitive(false);
            this._settings.reset('recently-installed-apps');
        });
        const clearRecentAppsRow = new Adw.ActionRow({
            title: _("Clear Apps Marked 'New'"),
            activatable_widget: clearRecentAppsButton,
        });
        clearRecentAppsRow.add_suffix(clearRecentAppsButton);
        recentAppsGroup.add(clearRecentAppsRow);

        recentAppsSwitch.set_active(this._settings.get_boolean('disable-recently-installed-apps'));

        this.restoreDefaults = () => {
            this.alphabeticalGroupingList = this._settings.get_default_value('group-apps-alphabetically-list-layouts').unpack();
            this.alphabeticalGroupingGrid = this._settings.get_default_value('group-apps-alphabetically-grid-layouts').unpack();
            this.multiLinedLabels = this._settings.get_default_value('multi-lined-labels').unpack();
            this.disableTooltips = this._settings.get_default_value('disable-tooltips').unpack();
            this.disableFadeEffect = this._settings.get_default_value('disable-scrollview-fade-effect').unpack();
            this.disableRecentApps = this._settings.get_default_value('disable-recently-installed-apps').unpack();
            this.showHiddenRecentFiles = this._settings.get_default_value('show-hidden-recent-files').unpack();
            alphabeticalGroupingListSwitch.set_active(this.alphabeticalGroupingList);
            alphabeticalGroupingGridSwitch.set_active(this.alphabeticalGroupingGrid);
            multiLinedLabelSwitch.set_active(this.multiLinedLabels);
            tooltipSwitch.set_active(this.disableTooltips);
            fadeEffectSwitch.set_active(this.disableFadeEffect);
            recentAppsSwitch.set_active(this.disableRecentApps);
            hiddenFilesSwitch.set_active(this.showHiddenRecentFiles);
            categoryIconTypeRow.selected = 0;
            shortcutsIconTypeRow.selected = 1;
            appDescriptionsSwitch.set_active(this._settings.get_default_value('apps-show-extra-details').unpack());
            subMenusSwitch.set_active(this._settings.get_default_value('show-category-sub-menus').unpack());
        };
    }
});
