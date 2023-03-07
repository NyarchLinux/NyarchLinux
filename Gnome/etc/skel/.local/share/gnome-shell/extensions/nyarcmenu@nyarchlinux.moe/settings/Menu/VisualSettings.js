const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gdk, GLib, GObject, Gtk} = imports.gi;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const { SubPage } = Settings.Menu.SubPage;

var VisualSettingsPage = GObject.registerClass(
class ArcMenu_VisualSettingsPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        let menuSizeFrame = new Adw.PreferencesGroup({
            title: _("Menu Size")
        });
        this.add(menuSizeFrame);

        let heightSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 300, upper: 4320, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        heightSpinButton.set_value(this._settings.get_int('menu-height'));
        heightSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('menu-height', widget.get_value());
        });
        let heightRow = new Adw.ActionRow({
            title: _('Height'),
            activatable_widget: heightSpinButton
        });
        heightRow.add_suffix(heightSpinButton);
        menuSizeFrame.add(heightRow);

        let menuWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 175, upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
        });
        menuWidthSpinButton.set_value(this._settings.get_int('left-panel-width'));
        menuWidthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('left-panel-width', widget.get_value());
        });
        let menuWidthRow = new Adw.ActionRow({
            title: _('Left-Panel Width'),
            subtitle: _("Traditional Layouts"),
            activatable_widget: menuWidthSpinButton
        });
        menuWidthRow.add_suffix(menuWidthSpinButton);
        menuSizeFrame.add(menuWidthRow);

        let rightPanelWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 200,upper: 500, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            climb_rate: 25,
            valign: Gtk.Align.CENTER,
            digits: 0,
            numeric: true,
        });
        rightPanelWidthSpinButton.set_value(this._settings.get_int('right-panel-width'));
        rightPanelWidthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('right-panel-width', widget.get_value());
        });
        let rightPanelWidthRow = new Adw.ActionRow({
            title: _('Right-Panel Width'),
            subtitle: _("Traditional Layouts"),
            activatable_widget: rightPanelWidthSpinButton
        });
        rightPanelWidthRow.add_suffix(rightPanelWidthSpinButton);
        menuSizeFrame.add(rightPanelWidthRow);

        let widthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: -350, upper: 600, step_increment: 25, page_increment: 50, page_size: 0,
            }),
            valign: Gtk.Align.CENTER,
            climb_rate: 25,
            digits: 0,
            numeric: true,
        });
        widthSpinButton.set_value(this._settings.get_int('menu-width-adjustment'));
        widthSpinButton.connect('value-changed', (widget) => {
            this._settings.set_int('menu-width-adjustment', widget.get_value());
        });
        let widthRow = new Adw.ActionRow({
            title: _('Width Offset'),
            subtitle: _("Non-Traditional Layouts"),
            activatable_widget: widthSpinButton
        });
        widthRow.add_suffix(widthSpinButton);
        menuSizeFrame.add(widthRow);

        let generalSettingsFrame = new Adw.PreferencesGroup({
            title: _('Menu Location')
        });
        this.add(generalSettingsFrame);

        let menuLocations = new Gtk.StringList();
        menuLocations.append(_('Off'));
        menuLocations.append(_('Top Centered'));
        menuLocations.append(_('Bottom Centered'));
        let menuLocationRow = new Adw.ComboRow({
            title: _("Override Menu Location"),
            model: menuLocations,
            selected: this._settings.get_enum('force-menu-location')
        });
        menuLocationRow.connect("notify::selected", (widget) => {
            this._settings.set_enum('force-menu-location', widget.selected)
        });
        generalSettingsFrame.add(menuLocationRow);

        let [menuArrowRiseEnabled, menuArrowRiseValue] = this._settings.get_value('menu-arrow-rise').deep_unpack();

        let menuArrowRiseSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        menuArrowRiseSwitch.connect('notify::active', (widget) => {
            let [oldEnabled_, oldValue] = this._settings.get_value('menu-arrow-rise').deep_unpack();
            this._settings.set_value('menu-arrow-rise', new GLib.Variant('(bi)', [widget.get_active(), oldValue]));
            if(widget.get_active())
                menuArrowRiseSpinButton.set_sensitive(true);
            else
                menuArrowRiseSpinButton.set_sensitive(false);
        });
        let menuArrowRiseSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 25,
                step_increment: 1
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
            valign: Gtk.Align.CENTER,
            value: menuArrowRiseValue,
            sensitive: menuArrowRiseEnabled
        });
        menuArrowRiseSpinButton.connect('value-changed', (widget) => {
            let [oldEnabled, oldValue_] = this._settings.get_value('menu-arrow-rise').deep_unpack();
            this._settings.set_value('menu-arrow-rise', new GLib.Variant('(bi)', [oldEnabled, widget.get_value()]));
        });

        let menuArrowRiseRow = new Adw.ActionRow({
            title: _("Override Menu Rise"),
            subtitle: _("Menu Distance from Panel and Screen Edge"),
            activatable_widget: menuArrowRiseSwitch
        });
        menuArrowRiseRow.add_suffix(menuArrowRiseSwitch);
        menuArrowRiseRow.add_suffix(new Gtk.Separator({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10
        }));
        menuArrowRiseRow.add_suffix(menuArrowRiseSpinButton);
        menuArrowRiseSwitch.set_active(menuArrowRiseEnabled);
        generalSettingsFrame.add(menuArrowRiseRow);

        let iconsSizeFrame = new Adw.PreferencesGroup({
            title: _("Override Icon Sizes"),
            description: _("Override the icon size of various menu items")
        });
        this.add(iconsSizeFrame);

        let iconSizes = new Gtk.StringList();
        iconSizes.append(_('Off'));
        iconSizes.append(_('Small') + " - " + _('Square'));
        iconSizes.append(_('Medium') + " - " + _('Square'));
        iconSizes.append(_('Large') + " - " + _('Square'));
        iconSizes.append(_('Small') + " - " + _('Wide'));
        iconSizes.append(_('Medium') + " - " + _('Wide'));
        iconSizes.append(_('Large') + " - " + _('Wide'));
        let gridIconsSizeRow = new Adw.ComboRow({
            title: _('Grid Menu Items') + ' <i><span size="small">(' + _('Non-Traditional Layouts') + ')</span></i>',
            subtitle: _('Apps, Pinned Apps, Shortcuts, Grid Search Results'),
            model: iconSizes,
            selected: this._settings.get_enum('menu-item-grid-icon-size')
        });
        gridIconsSizeRow.use_markup = true;
        gridIconsSizeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum('menu-item-grid-icon-size', widget.selected);
        });
        iconsSizeFrame.add(gridIconsSizeRow);

        let menuItemIconSizeRow = this.createIconSizeRow({
            title: _('Applications'),
            subtitle: _('Apps, Pinned Apps, Items within Category, List Search Results'),
            setting: 'menu-item-icon-size'
        });
        iconsSizeFrame.add(menuItemIconSizeRow);

        let quickLinksIconSizeRow = this.createIconSizeRow({
            title: _('Shortcuts'),
            subtitle: _('Directory / Application / Other Shortcuts, Power Menu'),
            setting: 'quicklinks-item-icon-size'
        });
        iconsSizeFrame.add(quickLinksIconSizeRow);

        let menuCategoryIconSizeRow = this.createIconSizeRow({
            title: _('Application Categories'),
            setting: 'menu-item-category-icon-size'
        });
        iconsSizeFrame.add(menuCategoryIconSizeRow);

        let buttonIconSizeRow = this.createIconSizeRow({
            title: _('Button Widgets'),
            subtitle: _('Power Buttons, Unity Bottom Bar, Mint Side Bar, etc'),
            setting: 'button-item-icon-size'
        });
        iconsSizeFrame.add(buttonIconSizeRow);

        let miscIconSizeRow = this.createIconSizeRow({
            title: _('Miscellaneous'),
            subtitle: _('Avatar, Search, Navigation Icons'),
            setting: 'misc-item-icon-size'
        });
        iconsSizeFrame.add(miscIconSizeRow);

        this.restoreDefaults = () => {
            heightSpinButton.set_value(this._settings.get_default_value('menu-height').unpack());
            widthSpinButton.set_value(this._settings.get_default_value('menu-width-adjustment').unpack());
            menuWidthSpinButton.set_value(this._settings.get_default_value('left-panel-width').unpack());
            rightPanelWidthSpinButton.set_value(this._settings.get_default_value('right-panel-width').unpack());
            gridIconsSizeRow.selected = 0;
            menuItemIconSizeRow.selected = 0;
            menuCategoryIconSizeRow.selected = 0;
            buttonIconSizeRow.selected = 0;
            quickLinksIconSizeRow.selected = 0;
            miscIconSizeRow.selected = 0;
            menuLocationRow.selected = 0;
            let [_menuRiseEnabled, menuRiseDefault] = this._settings.get_default_value('menu-arrow-rise').deep_unpack();
            menuArrowRiseSpinButton.set_value(menuRiseDefault);
            menuArrowRiseSwitch.set_active(false);
        };
    }

    createIconSizeRow(rowDetails){
        let iconSizes = new Gtk.StringList();
        iconSizes.append(_('Off'));
        iconSizes.append(_('Extra Small'));
        iconSizes.append(_('Small'));
        iconSizes.append(_('Medium'));
        iconSizes.append(_('Large'));
        iconSizes.append(_('Extra Large'));

        if(rowDetails.setting === 'menu-item-category-icon-size')
            iconSizes.append(_('Hidden'));

        let iconsSizeRow = new Adw.ComboRow({
            title: _(rowDetails.title),
            subtitle: rowDetails.subtitle ? _(rowDetails.subtitle) : null,
            model: iconSizes,
            selected: this._settings.get_enum(rowDetails.setting)
        });
        iconsSizeRow.use_markup = true;
        iconsSizeRow.connect('notify::selected', (widget) => {
            this._settings.set_enum(rowDetails.setting, widget.selected);
        });
        return iconsSizeRow;
    }
});