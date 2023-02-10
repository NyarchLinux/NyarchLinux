const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Atk, Clutter, Gio, GLib, GMenu, GObject, Gtk, Shell, St} = imports.gi;
const AccountsService = imports.gi.AccountsService;
const AppFavorites = imports.ui.appFavorites;
const { AppContextMenu } = Me.imports.appMenu;
const BoxPointer = imports.ui.boxpointer;
const Constants = Me.imports.constants;
const Dash = imports.ui.dash;
const DateMenu = imports.ui.dateMenu;
const DND = imports.ui.dnd;
const { ExtensionState } = ExtensionUtils;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const SystemActions = imports.misc.systemActions;
const Util = imports.misc.util;
const Utils =  Me.imports.utils;
const _ = Gettext.gettext;

const INDICATOR_ICON_SIZE = 18;
const USER_AVATAR_SIZE = 28;

function activatePowerOption(powerType, arcMenu){
    const systemActions = SystemActions.getDefault();
    arcMenu.itemActivated(BoxPointer.PopupAnimation.NONE);
    if(powerType === Constants.PowerType.POWER_OFF)
        systemActions.activatePowerOff();
    else if(powerType === Constants.PowerType.RESTART)
        systemActions.activateRestart();
    else if(powerType === Constants.PowerType.LOCK)
        systemActions.activateLockScreen();
    else if(powerType === Constants.PowerType.LOGOUT)
        systemActions.activateLogout();
    else if(powerType === Constants.PowerType.SUSPEND)
        systemActions.activateSuspend();
    else if(powerType === Constants.PowerType.SWITCH_USER)
        systemActions.activateSwitchUser()
    else if(powerType === Constants.PowerType.HYBRID_SLEEP)
        Utils.activateHybridSleep();
    else if(powerType === Constants.PowerType.HIBERNATE)
        Utils.activateHibernate();
}

var ArcMenuPopupBaseMenuItem = GObject.registerClass({
    Properties: {
        'active': GObject.ParamSpec.boolean('active', 'active', 'active',
                                            GObject.ParamFlags.READWRITE,
                                            false),
        'sensitive': GObject.ParamSpec.boolean('sensitive', 'sensitive', 'sensitive',
                                               GObject.ParamFlags.READWRITE,
                                               true),
    },
    Signals: {
        'activate': { param_types: [Clutter.Event.$gtype] },
    },

},   class ArcMenu_PopupBaseMenuItem extends St.BoxLayout{
    _init(menuLayout, params){
        params = imports.misc.params.parse(params, {
            reactive: true,
            activate: true,
            hover: true,
            style_class: null,
            can_focus: true,
        });
        super._init({
            style_class: 'popup-menu-item arcmenu-menu-item',
            reactive: params.reactive,
            track_hover: params.reactive,
            can_focus: params.can_focus,
            accessible_role: Atk.Role.MENU_ITEM
        });
        this.set_offscreen_redirect(Clutter.OffscreenRedirect.ON_IDLE);
        this.hasContextMenu = false;
        this._delegate = this;
        this._menuLayout = menuLayout;
        this._menuButton = menuLayout.menuButton;
        this.arcMenu = this._menuLayout.arcMenu;
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM;
        this.shouldShow = true;
        this._parent = null;
        this._active = false;
        this._activatable = params.reactive && params.activate;
        this._sensitive = true;

        this._ornamentLabel = new St.Label({ style_class: 'popup-menu-ornament' });
        this.add_child(this._ornamentLabel);

        this.x_align = Clutter.ActorAlign.FILL;
        this.x_expand = true;

        if (!this._activatable)
            this.add_style_class_name('popup-inactive-menu-item');

        if (params.style_class)
            this.add_style_class_name(params.style_class);

        if(params.hover)
            this.connect('notify::hover', this._onHover.bind(this));
        if (params.reactive && params.hover)
            this.bind_property('hover', this, 'active', GObject.BindingFlags.SYNC_CREATE);

        this.arcMenuOpenStateChangeID = this.arcMenu.connect('open-state-changed', (menu, open) =>{
            if(!open)
                this.cancelPopupTimeout();
        });

        let textureCache = St.TextureCache.get_default();
        let iconThemeChangedId = textureCache.connect('icon-theme-changed', this._updateIcon.bind(this));
        this.connect('destroy', () => {
            textureCache.disconnect(iconThemeChangedId);
            this._onDestroy();
        });
    }

    _updateIcon() {
        if(!this._iconBin || !this.createIcon)
            return;

        let icon = this.createIcon();
        if(icon)
            this._iconBin.set_child(icon);
    }

    get actor() {
        return this;
    }

    get active(){
        return this._active;
    }

    set active(active) {
        if(this.isDestroyed)
            return;

        //Prevent a mouse hover event from setting a new active menu item, until next mouse move event.
        if(this._menuLayout.blockActiveState){
            this.hover = false;
            return;
        }

        let activeChanged = active != this.active;
        if(activeChanged){
            this._active = active;
            if(active){
                const topSearchResult = this._menuLayout.searchResults?.getTopResult();
                if(topSearchResult){
                    topSearchResult.remove_style_pseudo_class('active');
                }
                if(this._menuLayout.activeMenuItem !== this)
                    this._menuLayout.activeMenuItem = this;

                this.add_style_class_name('selected');
                if(this.can_focus)
                    this.grab_key_focus();
            }
            else{
                this.remove_style_class_name('selected');
                if(!this.isActiveCategory)
                    this.remove_style_pseudo_class('active');
            }
            this.notify('active');
        }
    }

    setShouldShow(){
        //If a saved shortcut link is a desktop app, check if currently installed.
        //Do NOT display if application not found.
        if(this._command.endsWith(".desktop") && !Shell.AppSystem.get_default().lookup_app(this._command)){
            this.shouldShow = false;
        }
    }

    _onHover() {
        if(this.hover && (this.label || this.tooltipText)){
            let tooltipTitle = this.label || this.tooltipText;
            let description = this.description;
            if(this._app)
                description = this._app.get_description();
            this._menuButton.tooltip.showTooltip(this, this.tooltipLocation, tooltipTitle, description, this._displayType ? this._displayType : -1)
        }
        else if(!this.hover){
            this._menuButton.tooltip.hide();
        }
    }

    vfunc_motion_event(event){
        //Prevent a mouse hover event from setting a new active menu item, until next mouse move event.
        if(this._menuLayout.blockActiveState){
            this._menuLayout.blockActiveState = false;
            this.hover = true;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_button_press_event(){
        let event = Clutter.get_current_event();
        this.pressed = false;
        if(event.get_button() === 1){
            this._menuLayout.blockActivateEvent = false;
            this.pressed = true;
            this.add_style_pseudo_class('active');
            if(this.hasContextMenu)
                this.contextMenuTimeOut();
        }
        else if(event.get_button() === 3){
            this.pressed = true;
            this.add_style_pseudo_class('active');
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_button_release_event(){
        let event = Clutter.get_current_event();
        if(event.get_button() === 1 && !this._menuLayout.blockActivateEvent && this.pressed){
            this.pressed = false;
            this.active = false;
            this._menuLayout.mainBox.grab_key_focus();
            this.remove_style_pseudo_class('active');
            this.activate(event);

            return Clutter.EVENT_STOP;
        }
        if(event.get_button() === 3 && this.pressed){
            this.pressed = false;
            if(this.hasContextMenu)
                this.popupContextMenu();
            else{
                this.remove_style_pseudo_class('active');
            }
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_key_focus_in() {
        super.vfunc_key_focus_in();
        if(!this.hover)
            this._menuLayout._keyFocusIn(this);
        this.active = true;
    }

    vfunc_key_focus_out() {
        if(this.contextMenu && this.contextMenu.isOpen){
            return;
        }
        super.vfunc_key_focus_out();
        this.active = false;
    }

    activate(event) {
        this.emit('activate', event);
    }

    vfunc_key_press_event(keyEvent) {
        if (global.focus_manager.navigate_from_event(Clutter.get_current_event()))
            return Clutter.EVENT_STOP;

        if (!this._activatable)
            return super.vfunc_key_press_event(keyEvent);

        let state = keyEvent.modifier_state;

        // if user has a modifier down (except capslock and numlock)
        // then don't handle the key press here
        state &= ~Clutter.ModifierType.LOCK_MASK;
        state &= ~Clutter.ModifierType.MOD2_MASK;
        state &= Clutter.ModifierType.MODIFIER_MASK;

        if (state)
            return Clutter.EVENT_PROPAGATE;

        let symbol = keyEvent.keyval;
        if ( symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            this.active = false;
            this._menuLayout.mainBox.grab_key_focus();
            this.activate(Clutter.get_current_event());
            return Clutter.EVENT_STOP;
        }
        else if (symbol === Clutter.KEY_Menu && this.hasContextMenu){
            this.popupContextMenu();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_touch_event(event){
        if(event.type === Clutter.EventType.TOUCH_END && !this._menuLayout.blockActivateEvent && this.pressed){
            this.remove_style_pseudo_class('active');
            this.active = false;
            this._menuLayout.mainBox.grab_key_focus();
            this.activate(Clutter.get_current_event());
            this.pressed = false;
            return Clutter.EVENT_STOP;
        }
        else if(event.type === Clutter.EventType.TOUCH_BEGIN && !this._menuLayout.contextMenuManager.activeMenu){
            this.pressed = true;
            this._menuLayout.blockActivateEvent = false;
            if(this.hasContextMenu)
                this.contextMenuTimeOut();
            this.add_style_pseudo_class('active');
        }
        else if(event.type === Clutter.EventType.TOUCH_BEGIN && this._menuLayout.contextMenuManager.activeMenu){
            this.pressed = false;
            this._menuLayout.blockActivateEvent = false;
            this._menuLayout.contextMenuManager.activeMenu.toggle();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    contextMenuTimeOut(){
        this._popupTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
            this.pressed = false;
            this._popupTimeoutId = null;
            if(this.hasContextMenu && this._menuLayout.arcMenu.isOpen && !this._menuLayout.blockActivateEvent) {
                this.popupContextMenu();
                this._menuLayout.contextMenuManager.ignoreRelease();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    cancelPopupTimeout(){
        if(this._popupTimeoutId){
            GLib.source_remove(this._popupTimeoutId);
            this._popupTimeoutId = null;
        }
    }

    _onDestroy(){
        this.cancelPopupTimeout();
        this.isDestroyed = true;
        if(this.arcMenuOpenStateChangeID){
            this.arcMenu.disconnect(this.arcMenuOpenStateChangeID);
            this.arcMenuOpenStateChangeID = null;
        }
    }
});

var ArcMenuSeparator = GObject.registerClass(
class ArcMenu_Separator extends PopupMenu.PopupBaseMenuItem {
    _init(separatorLength, separatorAlignment, text) {
        super._init({
            style_class: 'popup-separator-menu-item',
            reactive: false,
            can_focus: false,
        });
        this._settings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
        this.remove_child(this._ornamentLabel);
        this.reactive = true;
        this.label = new St.Label({
            text: text || '',
            style: 'font-weight: bold'
        });
        this.add_child(this.label);
        this.label_actor = this.label;

        this.label.add_style_pseudo_class = () => { return false; };

        this.label.connect('notify::text',
                            this._syncLabelVisibility.bind(this));
        this._syncLabelVisibility();

        this._separator = new St.Widget({
            style_class: 'popup-separator-menu-item-separator separator-color-style',
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._separator);
        if(separatorAlignment === Constants.SeparatorAlignment.HORIZONTAL){
            this.style = "padding: 0px 5px; margin-left: 0px; margin-right: 0px;";
            if(separatorLength === Constants.SeparatorStyle.SHORT)
                this._separator.style = "margin: 0px 45px;";
            else if(separatorLength === Constants.SeparatorStyle.MEDIUM)
                this._separator.style = "margin: 0px 15px;";
            else if(separatorLength === Constants.SeparatorStyle.LONG){
                this._separator.style = "margin: 0px 5px;";
                this.style = "padding: 0px 5px; margin: 1px 0px;";
            }
            else if(separatorLength === Constants.SeparatorStyle.MAX)
                this._separator.style = "margin: 0px; padding: 0px;";
            else if(separatorLength === Constants.SeparatorStyle.HEADER_LABEL){
                this._separator.style = "margin: 0px 20px 0px 10px;";
                this.style = "padding: 5px 15px;"
            }
        }
        else if(separatorAlignment === Constants.SeparatorAlignment.VERTICAL){
            if(separatorLength === Constants.SeparatorStyle.ALWAYS_SHOW){
                this.style = "padding: 8px 4px; margin: 1px 0px;"
            }
            else{
                this._syncVisibility();
                this.vertSeparatorChangedID = this._settings.connect('changed::vert-separator', this._syncVisibility.bind(this));
                this.style = "padding: 0px 4px; margin: 6px 0px;"
            }

            this._separator.style = "margin: 0px; width: 1px; height: -1px;";
            this.remove_child(this.label);
            this.x_expand = this._separator.x_expand = true;
            this.x_align = this._separator.x_align = Clutter.ActorAlign.CENTER;
            this.y_expand = this._separator.y_expand = true;
            this.y_align = this._separator.y_align = Clutter.ActorAlign.FILL;
        }

        this.connect('destroy', () => {
            if(this.vertSeparatorChangedID){
                this._settings.disconnect(this.vertSeparatorChangedID);
                this.vertSeparatorChangedID = null;
            }
        });
    }

    _syncLabelVisibility() {
        this.label.visible = this.label.text != '';
    }

    _syncVisibility() {
        this._separator.visible = this._settings.get_boolean('vert-separator');
    }
});

var ActivitiesMenuItem = GObject.registerClass(class ArcMenu_ActivitiesMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._settings = this._menuLayout._settings;

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _("Activities Overview"),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.label);
    }

    createIcon(){
        const IconSizeEnum = this._settings.get_enum('quicklinks-item-icon-size');
        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = LayoutProps.DefaultQuickLinksIconSize;
        let iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

        return new St.Icon({
            icon_name: 'view-fullscreen-symbolic',
            style_class: 'popup-menu-icon',
            icon_size: iconSize
        });
    }

    activate(event) {
        this._menuLayout.arcMenu.toggle();
        Main.overview.show();
        super.activate(event);
    }
});

var Tooltip = GObject.registerClass(class ArcMenu_Tooltip extends St.BoxLayout {
    _init(menuButton) {
        super._init({
            vertical: true,
            style_class: 'dash-label arcmenu-tooltip arcmenu-custom-tooltip',
            opacity: 0
        });
        this._menuButton = menuButton;
        this._settings = this._menuButton._settings;

        this.titleLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.titleLabel);

        this.descriptionLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.descriptionLabel);

        global.stage.add_child(this);
        this.hide();

        this._useTooltips = !this._settings.get_boolean('disable-tooltips');
        this.toggleID = this._settings.connect('changed::disable-tooltips', this.disableTooltips.bind(this));
        this.connect('destroy', () => this._onDestroy());
    }

    showTooltip(sourceActor, location, titleLabel, description, displayType){
        if(!sourceActor)
            return;
        if(this.sourceActor === sourceActor){
            this._showTimeout(titleLabel, description, displayType);
            return;
        }
        this.sourceActor = sourceActor;
        this.titleLabel.style = null;
        this.location = location;
        this.descriptionLabel.hide();
        this.titleLabel.hide();

        this._showTimeout(titleLabel, description, displayType);
    }

    disableTooltips() {
        this._useTooltips = ! this._settings.get_boolean('disable-tooltips');
    }

    _setToolTipText(titleLabel, description, displayType){
        let isEllipsized, titleText;
        if(titleLabel instanceof St.Label){
            let lbl = titleLabel.clutter_text;
            lbl.get_allocation_box();
            isEllipsized = lbl.get_layout().is_ellipsized();
            titleText = titleLabel.text.replace(/\n/g, " ");
        }
        else{
            titleText = titleLabel;
        }

        this.titleLabel.text = '';
        this.descriptionLabel.text = '';

        if(displayType !== Constants.DisplayType.BUTTON){
            if(isEllipsized && description){
                this.titleLabel.text = titleText ? _(titleText) : '';
                this.descriptionLabel.text = description ? _(description) : '';
                this.titleLabel.style = 'font-weight: bold';
            }
            else if(isEllipsized && !description)
                this.titleLabel.text = titleText ? _(titleText) : '';
            else if(!isEllipsized && description)
                this.descriptionLabel.text = description ? _(description) : '';
        }
        else if(displayType === Constants.DisplayType.BUTTON){
            this.titleLabel.text = titleText ? _(titleText) : '';
        }

        return this.titleLabel.text || this.descriptionLabel.text ? true : false;
    }

    _showTimeout(titleLabel, description, displayType){
        if(this._useTooltips){
            let shouldShow = this._setToolTipText(titleLabel, description, displayType);

            if(!shouldShow)
                return;

            this._menuButton.tooltipShowingID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 750, () => {
                if(this.titleLabel.text)
                    this.titleLabel.show();
                if(this.descriptionLabel.text)
                    this.descriptionLabel.show();
                this._show();
                this._menuButton.tooltipShowing = true;
                this._menuButton.tooltipShowingID = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _show() {
        if(!this.sourceActor)
            return;
        if(this._useTooltips){
            this.opacity = 0;
            this.show();

            let [stageX, stageY] = this.sourceActor.get_transformed_position();

            let itemWidth  = this.sourceActor.allocation.x2 - this.sourceActor.allocation.x1;
            let itemHeight = this.sourceActor.allocation.y2 - this.sourceActor.allocation.y1;

            let labelWidth = this.get_width();
            let labelHeight = this.get_height();

            let x, y;
            let gap = 5;

            switch (this.location) {
                case Constants.TooltipLocation.BOTTOM_CENTERED:
                    y = stageY + itemHeight + gap;
                    x = stageX + Math.floor((itemWidth - labelWidth) / 2);
                    break;
                case Constants.TooltipLocation.TOP_CENTERED:
                    y = stageY - labelHeight - gap;
                    x = stageX + Math.floor((itemWidth - labelWidth) / 2);
                    break;
                case Constants.TooltipLocation.BOTTOM:
                default:
                    y = stageY + itemHeight + gap;
                    x = stageX + gap;
                    break;
            }

            // keep the label inside the screen
            let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
            if (x - monitor.x < gap)
                x += monitor.x - x + gap;
            else if (x + labelWidth > monitor.x + monitor.width - gap)
                x -= x + labelWidth - (monitor.x + monitor.width) + gap;
            else if (y - monitor.y < gap)
                y += monitor.y - y + gap;
            else if (y + labelHeight > monitor.y + monitor.height - gap)
                y -= y + labelHeight - (monitor.y + monitor.height) + gap;

            this.set_position(x, y);
            this.ease({
                opacity: 255,
                duration: Dash.DASH_ITEM_LABEL_SHOW_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    hide(instantHide) {
        if(this._useTooltips){
            if(this._menuButton.tooltipShowingID){
                GLib.source_remove(this._menuButton.tooltipShowingID);
                this._menuButton.tooltipShowingID = null;
            }
            this.sourceActor = null;
            this.ease({
                opacity: 0,
                duration: instantHide ? 0 : Dash.DASH_ITEM_LABEL_HIDE_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => super.hide()
            });
        }
    }

    _onDestroy() {
        if(this._menuButton.tooltipShowingID){
            GLib.source_remove(this._menuButton.tooltipShowingID);
            this._menuButton.tooltipShowingID = null;
        }
        if(this.toggleID){
            this._settings.disconnect(this.toggleID);
            this.toggleID = null;
        }
        if(this.hoverID){
            this.sourceActor.disconnect(this.hoverID);
            this.hoverID = null;
        }

        global.stage.remove_child(this);
    }
});

var ArcMenuButtonItem = GObject.registerClass(
    class ArcMenu_ButtonItem extends ArcMenuPopupBaseMenuItem {
    _init(menuLayout, tooltipText, iconName, gicon) {
        super._init(menuLayout);
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
        this.tooltipText = tooltipText;
        this.style_class = 'popup-menu-item arcmenu-button';
        this._settings = this._menuLayout._settings;
        this._menuLayout = menuLayout;
        this.remove_child(this._ornamentLabel);
        this.x_expand = false;
        this.x_align = Clutter.ActorAlign.CENTER;
        this.y_expand = false;
        this.y_align = Clutter.ActorAlign.CENTER;
        this.iconName = iconName;
        this.gicon = gicon;
        this.toggleMenuOnClick = true;
        this._displayType = Constants.DisplayType.BUTTON;

        if(this.iconName !== null){
            this._iconBin = new St.Bin();
            this.add_child(this._iconBin);

            this._updateIcon();
        }
    }

    createIcon(overrideIconSize){
        const IconSizeEnum = this._settings.get_enum('button-item-icon-size');
        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = LayoutProps.DefaultButtonsIconSize;
        let iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

        return new St.Icon({
            gicon: this.gicon ? this.gicon : Gio.icon_new_for_string(this.iconName),
            icon_size: overrideIconSize ? overrideIconSize : iconSize,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
    }

    setIconSize(size){
        if(!this._iconBin)
            return;
        this._iconBin.set_child(this.createIcon(size));
    }

    activate(event){
        if(this.toggleMenuOnClick)
            this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }
});

// Runner Layout Tweaks Button
var RunnerTweaksButton = GObject.registerClass(class ArcMenu_RunnerTweaksButton extends ArcMenuButtonItem {
    _init(menuLayout) {
        super._init(menuLayout, _("Configure Runner"), 'emblem-system-symbolic');
        this.style_class = 'button arcmenu-button';
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
    }

    set active(active) {
        if(this.isDestroyed)
            return;

        let activeChanged = active != this.active;
        if(activeChanged){
            this._active = active;
            this.notify('active');
        }
    }

    activate(event) {
        super.activate(event);
        this._settings.set_int('prefs-visible-page', Constants.PrefsVisiblePage.RUNNER_TWEAKS);
        ExtensionUtils.openPrefs();
    }
});

//'Insider' layout Pinned Apps hamburger button
var PinnedAppsButton = GObject.registerClass(class ArcMenu_PinnedAppsButton extends ArcMenuButtonItem {
    _init(menuLayout) {
        super._init(menuLayout, _("Pinned Apps"), 'open-menu-symbolic');
        this.toggleMenuOnClick = false;
    }
    activate(event) {
        super.activate(event);
        this._menuLayout.togglePinnedAppsMenu();
    }
});

//'Windows' layout extras hamburger button
var ExtrasButton = GObject.registerClass(class ArcMenu_ExtrasButton extends ArcMenuButtonItem {
    _init(menuLayout) {
        super._init(menuLayout, _("Extras"), 'open-menu-symbolic');
        this.toggleMenuOnClick = false;
    }
    activate(event) {
        super.activate(event);
        this._menuLayout.toggleExtrasMenu();
    }
});

var PowerOptionsBox = GObject.registerClass(class ArcMenu_PowerOptionsBox extends St.BoxLayout{
    _init(menuLayout, spacing, vertical = false){
        this._settings = menuLayout._settings;
        super._init({
            vertical,
            style: `spacing: ${spacing}px;`
        });

        let powerOptions = this._settings.get_value("power-options").deep_unpack();
        for(let i = 0; i < powerOptions.length; i++){
            let powerType = powerOptions[i][0];
            let shouldShow = powerOptions[i][1];
            if(shouldShow){
                let powerButton = new PowerButton(menuLayout, powerType);
                powerButton.style = "margin: 0px;";
                this.add_child(powerButton);
            }
        }
    }
});

//'Power Off / Log Out' button with popupmenu that shows lock, power off, restart, etc
var LeaveButton = GObject.registerClass(class ArcMenu_LeaveButton extends ArcMenuPopupBaseMenuItem {
    _init(menuLayout, showLabel) {
        super._init(menuLayout);
        this.toggleMenuOnClick = false;
        this._menuLayout = menuLayout;
        this.menuButton = menuLayout.menuButton;
        this._settings = menuLayout._settings;
        this.iconName = 'system-shutdown-symbolic';
        this.showLabel = showLabel;

        this._createLeaveMenu();

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        if(showLabel){
            this.label = new St.Label({
                text: _('Power Off / Log Out'),
                y_expand: false,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this.label);
        }
        else{
            this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
            this.style_class = 'popup-menu-item arcmenu-button';
            this.remove_child(this._ornamentLabel);
            this.x_expand = false;
            this.x_align = Clutter.ActorAlign.CENTER;
            this.y_expand = false;
            this.y_align = Clutter.ActorAlign.CENTER;
            this.toggleMenuOnClick = true;
            this._displayType = Constants.DisplayType.BUTTON;
            this.tooltipText = _('Power Off / Log Out');
        }
    }

    createIcon(overrideIconSize){
        const IconSizeEnum = this.showLabel ? this._settings.get_enum('quicklinks-item-icon-size') : this._settings.get_enum('button-item-icon-size');
        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = this.showLabel ? LayoutProps.DefaultQuickLinksIconSize : LayoutProps.DefaultButtonsIconSize;
        let iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

        return new St.Icon({
            gicon: Gio.icon_new_for_string(this.iconName),
            icon_size: overrideIconSize ? overrideIconSize : iconSize,
            x_expand: this.showLabel ? false : true,
            x_align: this.showLabel ? Clutter.ActorAlign.START : Clutter.ActorAlign.CENTER
        });
    }

    setIconSize(size){
        if(!this._iconBin)
            return;
        this._iconBin.set_child(this.createIcon(size));
    }

    _createLeaveMenu(){
        this.leaveMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.BOTTOM);
        this.leaveMenu.blockSourceEvents = true;
        this.leaveMenu.actor.add_style_class_name('popup-menu arcmenu-menu');
        let section = new PopupMenu.PopupMenuSection();
        this.leaveMenu.addMenuItem(section);

        let box = new St.BoxLayout({
            vertical: true,
        });
        box._delegate = box;

        section.actor.add_child(box);

        let sessionBox = new St.BoxLayout({
            vertical: true,
        });

        sessionBox.add_child(this._menuLayout.createLabelRow(_("Session")));
        let systemBox = new St.BoxLayout({
            vertical: true,
        });
        systemBox.add_child(this._menuLayout.createLabelRow(_("System")));

        box.add_child(sessionBox);
        box.add_child(systemBox);

        let hasSessionOption, hasSystemOption;
        let powerOptions = this._settings.get_value("power-options").deep_unpack();
        for(let i = 0; i < powerOptions.length; i++){
            let powerType = powerOptions[i][0];
            let shouldShow = powerOptions[i][1];
            if(shouldShow){
                let powerButton = new PowerMenuItem(this._menuLayout, powerType);
                if(powerType === Constants.PowerType.LOCK || powerType === Constants.PowerType.LOGOUT || powerType === Constants.PowerType.SWITCH_USER){
                    hasSessionOption = true;
                    sessionBox.add_child(powerButton);
                }
                else{
                    hasSystemOption = true;
                    systemBox.add_child(powerButton);
                }
            }
        }

        if(!hasSessionOption)
            sessionBox.hide();
        if(!hasSystemOption)
            systemBox.hide();

        this._menuLayout.subMenuManager.addMenu(this.leaveMenu);
        this.leaveMenu.actor.hide();
        Main.uiGroup.add_child(this.leaveMenu.actor);
        this.leaveMenu.connect('open-state-changed', (menu, open) => {
            if(open){
                this.add_style_pseudo_class('active');
                if(this.menuButton.tooltipShowingID){
                    GLib.source_remove(this.menuButton.tooltipShowingID);
                    this.menuButton.tooltipShowingID = null;
                    this.menuButton.tooltipShowing = false;
                }
                if(this.tooltip){
                    this.tooltip.hide();
                    this.menuButton.tooltipShowing = false;
                }
            }
            else{
                this.remove_style_pseudo_class('active');
                this.active = false;
                this.sync_hover();
                this.hovered = this.hover;
            }
        });
    }

    _onDestroy(){
        Main.uiGroup.remove_child(this.leaveMenu.actor);
        this.leaveMenu.destroy();
    }

    activate(event) {
        super.activate(event);
        this.leaveMenu.toggle();
    }
});

//'Unity' layout categories hamburger button
var CategoriesButton = GObject.registerClass(class ArcMenu_CategoriesButton extends ArcMenuButtonItem {
    _init(menuLayout) {
        super._init(menuLayout, _("Categories"), 'open-menu-symbolic');
        this.toggleMenuOnClick = false;
    }
    activate(event) {
        super.activate(event);
        this._menuLayout.toggleCategoriesMenu();
    }
});

var PowerButton = GObject.registerClass(class ArcMenu_PowerButton extends ArcMenuButtonItem {
    _init(menuLayout, powerType) {
        super._init(menuLayout, Constants.PowerOptions[powerType].NAME, Constants.PowerOptions[powerType].ICON);
        this.powerType = powerType;
    }
    activate(event) {
        activatePowerOption(this.powerType, this._menuLayout.arcMenu);
    }
});

var PowerMenuItem = GObject.registerClass(class ArcMenu_PowerMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, type) {
        super._init(menuLayout);
        this.powerType = type;
        this._menuLayout = menuLayout;
        this._layout = this._menuLayout.layout;
        this.remove_child(this._ornamentLabel);
        this._settings = this._menuLayout._settings;

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _(Constants.PowerOptions[this.powerType].NAME),
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.add_child(this.label);
    }

    createIcon(){
        const IconSizeEnum = this._settings.get_enum('quicklinks-item-icon-size');
        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = LayoutProps.DefaultQuickLinksIconSize;
        let iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

        return new St.Icon({
            gicon: Gio.icon_new_for_string(Constants.PowerOptions[this.powerType].ICON),
            style_class: 'popup-menu-icon',
            icon_size: iconSize,
        });
    }

    activate(){
        activatePowerOption(this.powerType, this._menuLayout.arcMenu);
    }
});

var PlasmaMenuItem = GObject.registerClass(class ArcMenu_PlasmaMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, title, iconPath) {
        super._init(menuLayout);
        this.remove_child(this._ornamentLabel);
        this._menuLayout = menuLayout;
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
        this._layout = this._menuLayout.layout;
        this._settings = this._menuLayout._settings;
        this.vertical = true;
        if(this._settings.get_enum('searchbar-default-top-location') === Constants.SearchbarLocation.TOP)
            this.name = "arcmenu-plasma-button-top";
        else
            this.name = "arcmenu-plasma-button-bottom";
        this.iconPath = iconPath;

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _(title),
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.label.x_align = this.label.y_align = Clutter.ActorAlign.CENTER;
        this.label.y_expand = true;

        this._iconBin.x_align = this._iconBin.y_align = Clutter.ActorAlign.CENTER;
        this._iconBin.y_expand = true;

        this.label.get_clutter_text().set_line_wrap(true);
        this.add_child(this.label);
    }

    createIcon(){
        return new St.Icon({
            gicon: Gio.icon_new_for_string(this.iconPath),
            icon_size: Constants.MEDIUM_ICON_SIZE
        });
    }

    _onHover(){
        if(this.hover){
            let description = null;
            this._menuButton.tooltip.showTooltip(this, this.tooltipLocation, this.label, description, Constants.DisplayType.LIST);
        }
        else{
            this._menuButton.tooltip.hide();
        }
        let shouldHover = this._settings.get_boolean('plasma-enable-hover');
        if(shouldHover && this.hover && !this.isActive){
            this.activate(Clutter.get_current_event());
        }
    }

    set active(active) {
        let activeChanged = active != this.active;
        if(activeChanged){
            this._active = active;
            if(active){
                this.add_style_class_name('selected');
                this._menuLayout.activeMenuItem = this;
                if(this.can_focus)
                    this.grab_key_focus();
            }
            else{
                this.remove_style_class_name('selected');
            }
            this.notify('active');
        }
    }

    setActive(active){
        if(active){
            this.isActive = true;
            this.set_style_pseudo_class("active-item");
        }
        else{
            this.isActive = false;
            this.set_style_pseudo_class(null);
        }
    }

    activate(event){
        this._menuLayout.searchBox.clearWithoutSearchChangeEvent();
        this._menuLayout.clearActiveItem();
        this.setActive(true);
        super.activate(event);
    }
});

var PlasmaCategoryHeader = GObject.registerClass(class ArcMenu_PlasmaCategoryHeader extends St.BoxLayout{
    _init(menuLayout) {
        super._init({
            style_class: "popup-menu-item",
            style: 'padding: 0px;',
            reactive: true,
            track_hover:true,
            can_focus: true,
            accessible_role: Atk.Role.MENU_ITEM
        });
        this._menuLayout = menuLayout;
        this._layout = this._menuLayout.layout;
        this._settings = this._menuLayout._settings;

        this.backButton = new ArcMenuPopupBaseMenuItem(this._menuLayout);
        this.backButton.x_expand = false;
        this.backButton.x_align = Clutter.ActorAlign.CENTER;
        this.label = new St.Label({
            text: _("Apps"),
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: bold'
        });

        this.backButton.add_child(this.label);

        this.add_child(this.backButton);
        this.backButton.connect("activate", () => this._menuLayout.displayCategories() );

        this.categoryLabel = new St.Label({
            text: '',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.add_child(this.categoryLabel);
    }

    setActiveCategory(categoryText){
        if(categoryText){
            this.categoryLabel.text = _(categoryText);
            this.categoryLabel.show();
        }
        else
            this.categoryLabel.hide();
    }
});

var NavigationButton = GObject.registerClass(class ArcMenu_NavigationButton extends ArcMenuButtonItem{
    _init(menuLayout, text, arrowSymbolic, activateAction, arrowSide) {
        super._init(menuLayout, null, arrowSymbolic);
        this.toggleMenuOnClick = false;
        this.activateAction = activateAction;
        this.style = 'min-height: 28px; padding: 0px 8px;';
        this._menuLayout = menuLayout;
        this._layout = this._menuLayout.layout;
        this._settings = this._menuLayout._settings;
        this.x_expand = true;
        this.x_align = Clutter.ActorAlign.END;
        this._label = new St.Label({
            text: _(text),
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_expand: false,
            y_align: Clutter.ActorAlign.CENTER
        });

        if(arrowSide === St.Side.LEFT)
            this.add_child(this._label);
        else
            this.insert_child_at_index(this._label, 0);
    }

    createIcon(){
        const IconSizeEnum = this._settings.get_enum('misc-item-icon-size');
        let iconSize = Utils.getIconSize(IconSizeEnum, Constants.EXTRA_SMALL_ICON_SIZE);

        return new St.Icon({
            gicon: this.gicon ? this.gicon : Gio.icon_new_for_string(this.iconName),
            icon_size: iconSize,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
    }

    activate(event){
        super.activate(event);
        this.activateAction();
    }
});

var GoNextButton = GObject.registerClass(class ArcMenu_GoNextButton extends NavigationButton{
    _init(menuLayout, title, activateAction) {
        super._init(menuLayout, _(title), 'go-next-symbolic', () => activateAction());
    }
});

var GoPreviousButton = GObject.registerClass(class ArcMenu_GoPreviousButton extends NavigationButton{
    _init(menuLayout, activateAction) {
        super._init(menuLayout, _("Back"), 'go-previous-symbolic', () => activateAction(), St.Side.LEFT);
    }
});

// Menu item to go back to category view
var BackMenuItem = GObject.registerClass(class ArcMenu_BackMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._layout = this._menuLayout.layout;
        this._settings = this._menuLayout._settings;

        this._iconBin = new St.Bin({
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
        });
        this.add_child(this._iconBin);

        this._updateIcon();

        let label = new St.Label({
            text: _("Back"),
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(label);
    }

    createIcon(){
        const IconSizeEnum = this._settings.get_enum('misc-item-icon-size');
        let iconSize = Utils.getIconSize(IconSizeEnum, Constants.MISC_ICON_SIZE);

        return new St.Icon({
            icon_name: 'go-previous-symbolic',
            icon_size: iconSize,
            style_class: 'popup-menu-icon',
        });
    }

    activate(event) {
        if(this._layout === Constants.MenuLayout.ARCMENU){
            //If the current page is inside a category and
            //previous page was the categories page,
            //go back to categories page
            if(this._menuLayout.previousCategoryType === Constants.CategoryType.CATEGORIES_LIST && (this._menuLayout.activeCategoryType <= 4 || this._menuLayout.activeCategoryType instanceof GMenu.TreeDirectory))
                this._menuLayout.displayCategories();
            else
                this._menuLayout.setDefaultMenuView();
        }
        else if(this._layout === Constants.MenuLayout.TOGNEE)
            this._menuLayout.setDefaultMenuView();
        super.activate(event);
    }
});

// Menu item to view all apps
var ViewAllPrograms = GObject.registerClass(class ArcMenu_ViewAllPrograms extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._settings = this._menuLayout._settings;

        let label = new St.Label({
            text: _("All Apps"),
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(label);

        this._iconBin = new St.Bin({
            x_expand: false,
            x_align: Clutter.ActorAlign.START,
        });
        this.add_child(this._iconBin);
        this._updateIcon();
    }

    createIcon(){
        const IconSizeEnum = this._settings.get_enum('misc-item-icon-size');
        let iconSize = Utils.getIconSize(IconSizeEnum, Constants.MISC_ICON_SIZE);

        return new St.Icon({
            icon_name: 'go-next-symbolic',
            icon_size: iconSize,
            x_align: Clutter.ActorAlign.START,
            style_class: 'popup-menu-icon',
        });
    }

    activate(event) {
        let defaultMenuView = this._settings.get_enum('default-menu-view');
        if(defaultMenuView === Constants.DefaultMenuView.PINNED_APPS || defaultMenuView === Constants.DefaultMenuView.FREQUENT_APPS)
            this._menuLayout.displayCategories();
        else
            this._menuLayout.displayAllApps();
        super.activate(event);
    }
});

var ShortcutMenuItem = GObject.registerClass(class ArcMenu_ShortcutMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, menuItemArray, displayType, isContainedInCategory) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        let [name, icon, command] = menuItemArray;
        this._settings = this._menuLayout._settings;
        this.layoutProps = this._menuLayout.layoutProperties;
        if(this._settings.get_enum('shortcut-icon-type') === Constants.CategoryIconType.FULL_COLOR)
            this.add_style_class_name('regular-icons');
        else
            this.add_style_class_name('symbolic-icons');
        this._command = command;
        this._displayType = displayType;
        this.isContainedInCategory = isContainedInCategory;
        this.iconName = icon;

        //Check for default commands--------
        if(this._command === Constants.ShortcutCommands.SOFTWARE){
            let softwareManager = Utils.findSoftwareManager();
            this._command = softwareManager ? softwareManager : 'ArcMenu_InvalidShortcut.desktop';
        }
        if(!this._app)
            this._app = Shell.AppSystem.get_default().lookup_app(this._command);

        if(this._app && icon === ''){
            let appIcon = this._app.create_icon_texture(Constants.MEDIUM_ICON_SIZE);
            if(appIcon instanceof St.Icon){
                this.iconName = appIcon.gicon.to_string();
            }
        }
        //-------------------------------------

        this.hasContextMenu = this._app ? true : false;

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _(name),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this.layout = this._settings.get_enum('menu-layout');
        if(this.layout === Constants.MenuLayout.PLASMA && this._settings.get_boolean('apps-show-extra-details') && this._app){
            let labelBox = new St.BoxLayout({
                vertical: true
            });
            let descriptionLabel = new St.Label({
                text: this._app.get_description(),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: "font-weight: lighter;"
            });
            labelBox.add_child(this.label);
            if(this._app.get_description())
                labelBox.add_child(descriptionLabel);
            this.add_child(labelBox);
        }
        else{
            this.add_child(this.label);
        }

        if(this._displayType === Constants.DisplayType.GRID)
            Utils.convertToGridLayout(this);
        else if(this._displayType === Constants.DisplayType.BUTTON){
            this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
            this.style_class = 'popup-menu-item arcmenu-button';
            this.remove_child(this._ornamentLabel);
            this.remove_child(this.label);
            this.x_expand = false;
            this.x_align = Clutter.ActorAlign.CENTER;
            this.y_expand = false;
            this.y_align = Clutter.ActorAlign.CENTER;
        }
        this.setShouldShow();
    }

    createIcon(){
        let iconSizeEnum;
        if(this.isContainedInCategory)
            iconSizeEnum = this._settings.get_enum('menu-item-icon-size');
        else
            iconSizeEnum = this._settings.get_enum('quicklinks-item-icon-size');
        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = this.isContainedInCategory ? LayoutProps.DefaultApplicationIconSize : LayoutProps.DefaultQuickLinksIconSize;
        let iconSize = Utils.getIconSize(iconSizeEnum, defaultIconSize);

        if(this._displayType === Constants.DisplayType.BUTTON){
            iconSizeEnum = this._settings.get_enum('button-item-icon-size');
            defaultIconSize = LayoutProps.DefaultButtonsIconSize;
            iconSize = Utils.getIconSize(iconSizeEnum, defaultIconSize);
        }
        else if(this._displayType === Constants.DisplayType.GRID){
            iconSizeEnum = this._settings.get_enum('menu-item-grid-icon-size');
            let defaultIconStyle = LayoutProps.DefaultIconGridStyle;
            iconSize = Utils.getGridIconSize(iconSizeEnum, defaultIconStyle);
        }

        return new St.Icon({
            icon_name: this.iconName,
            gicon: Gio.icon_new_for_string(this.iconName),
            style_class: this._displayType === Constants.DisplayType.LIST ? 'popup-menu-icon' : '',
            icon_size: iconSize
        });
    }

    popupContextMenu(){
        if(this._app && this.contextMenu == undefined){
            this.contextMenu = new AppContextMenu(this, this._menuLayout);
            if(this.layoutProps.ShortcutContextMenuLocation === Constants.ContextMenuLocation.BOTTOM_CENTERED)
                this.contextMenu.centerBoxPointerPosition();
            else if(this.layoutProps.ShortcutContextMenuLocation === Constants.ContextMenuLocation.RIGHT)
                this.contextMenu.rightBoxPointerPosition();

            if(this._app)
                this.contextMenu.setApp(this._app);
            else if(this.folderPath)
                this.contextMenu.setFolderPath(this.folderPath);
        }
        if(this.contextMenu !== undefined){
            if(this.tooltip !== undefined)
                this.tooltip.hide();
            this.contextMenu.open(BoxPointer.PopupAnimation.FULL);
        }
    }

    activate(event) {
        if(this._command === Constants.ShortcutCommands.LOG_OUT)
            activatePowerOption(Constants.PowerType.LOGOUT, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.LOCK)
            activatePowerOption(Constants.PowerType.LOCK, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.POWER_OFF)
            activatePowerOption(Constants.PowerType.POWER_OFF, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.RESTART)
            activatePowerOption(Constants.PowerType.RESTART, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.SUSPEND)
            activatePowerOption(Constants.PowerType.SUSPEND, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.HYBRID_SLEEP)
            activatePowerOption(Constants.PowerType.HYBRID_SLEEP, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.HIBERNATE)
            activatePowerOption(Constants.PowerType.HIBERNATE, this._menuLayout.arcMenu);
        else if(this._command === Constants.ShortcutCommands.SWITCH_USER)
            activatePowerOption(Constants.PowerType.SWITCH_USER, this._menuLayout.arcMenu);
        else{
            this._menuLayout.arcMenu.toggle();
            if(this._command === Constants.ShortcutCommands.OVERVIEW)
                Main.overview.show();
            else if(this._command === Constants.ShortcutCommands.RUN_COMMAND)
                Main.openRunDialog();
            else if(this._command === Constants.ShortcutCommands.SHOW_APPS)
                Main.overview._overview._controls._toggleAppsPage();
            else if(this._app)
                this._app.open_new_window(-1);
            else
                Util.spawnCommandLine(this._command);
        }
    }
});

// Menu item which displays the current user
var UserMenuItem = GObject.registerClass(class ArcMenu_UserMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, displayType) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._displayType = displayType;
        this._settings = this._menuLayout._settings;

        if(this._displayType === Constants.DisplayType.BUTTON){
            this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
            this.style_class = 'popup-menu-item arcmenu-button';
            const IconSizeEnum = this._settings.get_enum('button-item-icon-size');
            const LayoutProps = this._menuLayout.layoutProperties;
            let defaultIconSize = LayoutProps.DefaultButtonsIconSize;
            this.iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

            this.remove_child(this._ornamentLabel);
            this.x_expand = false;
            this.x_align = Clutter.ActorAlign.CENTER;
            this.y_expand = false;
            this.y_align = Clutter.ActorAlign.CENTER;
        }
        else{
            const IconSizeEnum = this._settings.get_enum('misc-item-icon-size');
            this.iconSize = Utils.getIconSize(IconSizeEnum, USER_AVATAR_SIZE);
        }

        this.userMenuIcon = new UserMenuIcon(menuLayout, this.iconSize, false);

        if(this._settings.get_enum('avatar-style') === Constants.AvatarStyle.ROUND)
            this.avatarStyle = 'arcmenu-avatar-round';
        else
            this.avatarStyle = 'arcmenu-avatar-square';

        if(this._displayType === Constants.DisplayType.BUTTON)
            this.userMenuIcon.set_style_class_name(this.avatarStyle + ' user-icon');
        this.add_child(this.userMenuIcon);
        this.label = this.userMenuIcon.label;
        if(this._displayType !== Constants.DisplayType.BUTTON)
            this.add_child(this.label);
    }

    activate(event) {
        Util.spawnCommandLine("gnome-control-center user-accounts");
        this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }
});

var UserMenuIcon = GObject.registerClass(class ArcMenu_UserMenuIcon extends St.Bin{
    _init(menuLayout, size, hasTooltip) {
        let avatarStyle;
        if(menuLayout._settings.get_enum('avatar-style') === Constants.AvatarStyle.ROUND)
            avatarStyle = 'arcmenu-avatar-round';
        else
            avatarStyle = 'arcmenu-avatar-square';

        super._init({
            style_class: avatarStyle + ' user-icon popup-menu-icon',
            track_hover: true,
            reactive: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: `width: ${this.iconSize}px; height: ${this.iconSize}px;`
        });

        this._menuButton = menuLayout.menuButton;
        this._menuLayout = menuLayout;
        this._settings = this._menuLayout._settings;
        this.iconSize = size;
        this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;

        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());

        this.label = new St.Label({
            text: GLib.get_real_name(),
            y_align: Clutter.ActorAlign.CENTER
        });

        this._userLoadedId = this._user.connect('notify::is-loaded', this._onUserChanged.bind(this));
        this._userChangedId = this._user.connect('changed', this._onUserChanged.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));
        if(hasTooltip)
            this.connect('notify::hover',this._onHover.bind(this));

        this._onUserChanged();
    }

    _onHover() {
        if(this.hover)
            this._menuButton.tooltip.showTooltip(this, this.tooltipLocation, GLib.get_real_name(), null, Constants.DisplayType.BUTTON);
        else
            this._menuButton.tooltip.hide();
    }

    _onUserChanged() {
        if (this._user.is_loaded) {
            this.label.set_text(this._user.get_real_name());
            if(this.tooltip)
                this.tooltip.titleLabel.text = this._user.get_real_name();

            let iconFile = this._user.get_icon_file();
            if (iconFile && !GLib.file_test(iconFile ,GLib.FileTest.EXISTS))
                iconFile = null;

            if (iconFile) {
                this.child = null;
                this.add_style_class_name('user-avatar');
                this.style = 'background-image: url("%s");'.format(iconFile) + "width: " + this.iconSize + "px; height: " + this.iconSize + "px;";
            }
            else {
                this.style = "width: " + this.iconSize + "px; height: " + this.iconSize + "px;";
                this.child = new St.Icon({
                    icon_name: 'avatar-default-symbolic',
                    icon_size: this.iconSize,
                    style: "padding: 5px; width: " + this.iconSize + "px; height: " + this.iconSize + "px;",
                });
            }
        }
    }

    _onDestroy() {
        if (this._userLoadedId) {
            this._user.disconnect(this._userLoadedId);
            this._userLoadedId = null;
        }
        if (this._userChangedId) {
            this._user.disconnect(this._userChangedId);
            this._userChangedId = null;
        }
    }
});

var PinnedAppsMenuItem = GObject.registerClass({
    Signals: { 'saveSettings': {} },
}, class ArcMenu_PinnedAppsMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, name, icon, command, displayType, isContainedInCategory) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._menuButton = menuLayout.menuButton;
        this._settings = this._menuLayout._settings;
        this._command = command;
        this._iconString = this._icon = icon;
        this._name = name;
        this._displayType = displayType;
        this._app = Shell.AppSystem.get_default().lookup_app(this._command);
        this.hasContextMenu = true;
        this.gridLocation = [-1, -1];
        this.isContainedInCategory = isContainedInCategory;

        if(this._iconString === "ArcMenu_ArcMenuIcon" || this._iconString === Me.path + '/media/icons/arcmenu-logo-symbolic.svg')
            this._iconString = Constants.ArcMenuLogoSymbolic;

        if(this._app && this._iconString === ''){
            let appIcon = this._app.create_icon_texture(Constants.MEDIUM_ICON_SIZE);
            if(appIcon instanceof St.Icon){
                this._iconString = appIcon.gicon ? appIcon.gicon.to_string() : appIcon.fallback_icon_name;
                if(!this._iconString)
                    this._iconString = "";
            }
        }

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: _(this._name),
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        if(this._displayType === Constants.DisplayType.LIST && this._settings.get_boolean('apps-show-extra-details') && this._app){
            let labelBox = new St.BoxLayout({
                vertical: true
            });
            let descriptionLabel = new St.Label({
                text: this._app.get_description(),
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: "font-weight: lighter;"
            });
            labelBox.add_child(this.label);
            if(this._app.get_description())
                labelBox.add_child(descriptionLabel);
            this.add_child(labelBox);
        }
        else{
            this.add_child(this.label);
        }

        this._draggable = DND.makeDraggable(this);
        this._draggable._animateDragEnd = (eventTime) => {
            this._draggable._animationInProgress = true;
            this._draggable._onAnimationComplete(this._draggable._dragActor, eventTime);
        };
        this.isDraggableApp = true;
        this._draggable.connect('drag-begin', this._onDragBegin.bind(this));
        this._draggable.connect('drag-end', this._onDragEnd.bind(this));

        if(this._displayType === Constants.DisplayType.GRID)
            Utils.convertToGridLayout(this);

        this.setShouldShow();
    }

    createIcon(){
        let iconSize;
        if(this._displayType === Constants.DisplayType.GRID){
            const IconSizeEnum = this._settings.get_enum('menu-item-grid-icon-size');
            const LayoutProps = this._menuLayout.layoutProperties;
            let defaultIconStyle = LayoutProps.DefaultIconGridStyle;
            iconSize = Utils.getGridIconSize(IconSizeEnum, defaultIconStyle);
        }
        else if(this._displayType === Constants.DisplayType.LIST){
            const IconSizeEnum = this._settings.get_enum('menu-item-icon-size');
            const LayoutProps = this._menuLayout.layoutProperties;
            let defaultIconSize = this.isContainedInCategory ? LayoutProps.DefaultApplicationIconSize : LayoutProps.DefaultPinnedIconSize;
            iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);
        }

        return new St.Icon({
            gicon: Gio.icon_new_for_string(this._iconString),
            icon_size: iconSize,
            style_class: this._displayType === Constants.DisplayType.GRID ? '' : 'popup-menu-icon',
        });
    }

    popupContextMenu(){
        if(this.contextMenu == undefined){
            this.contextMenu = new AppContextMenu(this, this._menuLayout);
            if(this._displayType === Constants.DisplayType.GRID)
                this.contextMenu.centerBoxPointerPosition();
            if(this._app)
                this.contextMenu.setApp(this._app);
            else
                this.contextMenu.addUnpinItem(this._command);
        }
        if(this.tooltip !== undefined)
            this.tooltip.hide();
        this.contextMenu.open(BoxPointer.PopupAnimation.FULL);
    }

   _onDragBegin() {
        this.isDragging = true;
        if(this._menuButton.tooltipShowingID){
            GLib.source_remove(this._menuButton.tooltipShowingID);
            this._menuButton.tooltipShowingID = null;
            this._menuButton.tooltipShowing = false;
        }
        if(this.tooltip){
            this.tooltip.hide();
            this._menuButton.tooltipShowing = false;
        }

        if(this.contextMenu && this.contextMenu.isOpen)
            this.contextMenu.toggle();

        this.cancelPopupTimeout();

        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this)
        };
        DND.addDragMonitor(this._dragMonitor);
        this._parentBox = this.get_parent();
        let p = this._parentBox.get_transformed_position();
        this.posX = p[0];
        this.posY = p[1];

        this.opacity = 55;
        this.get_allocation_box();
        this.rowHeight = this.height;
        this.rowWidth = this.width;
    }

    _onDragMotion(dragEvent) {
        let layoutManager = this._parentBox.layout_manager;
        if(layoutManager instanceof Clutter.GridLayout){
            this.xIndex = Math.floor((this._draggable._dragX - this.posX) / (this.rowWidth + layoutManager.column_spacing));
            this.yIndex = Math.floor((this._draggable._dragY - this.posY) / (this.rowHeight + layoutManager.row_spacing));

            if(this.xIndex === this.gridLocation[0] && this.yIndex === this.gridLocation[1]){
                return DND.DragMotionResult.CONTINUE;
            }
            else{
                this.gridLocation = [this.xIndex, this.yIndex];
            }

            this._parentBox.remove_child(this);
            let children = this._parentBox.get_children();
            let childrenCount = children.length;
            let columns = layoutManager.gridColumns;
            let rows = Math.floor(childrenCount / columns);
            if(this.yIndex >= rows)
                this.yIndex = rows;
            if(this.yIndex < 0)
                this.yIndex = 0;
            if(this.xIndex >= columns - 1)
                this.xIndex = columns - 1;
            if(this.xIndex < 0)
                this.xIndex = 0;

            if(((this.xIndex + 1) + (this.yIndex * columns)) > childrenCount)
                this.xIndex = Math.floor(childrenCount % columns);

            this._parentBox.remove_all_children();

            let x = 0, y = 0;
            for(let i = 0; i < children.length; i++){
                if(this.xIndex === x && this.yIndex === y)
                    [x, y] = this.gridLayoutIter(x, y, columns);
                layoutManager.attach(children[i], x, y, 1, 1);
                [x, y] = this.gridLayoutIter(x, y, columns);
            }
            layoutManager.attach(this, this.xIndex, this.yIndex, 1, 1);
        }
        return DND.DragMotionResult.CONTINUE;
    }

    _onDragEnd() {
        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }
        this.opacity = 255;
        let layoutManager = this._parentBox.layout_manager;
        if(layoutManager instanceof Clutter.GridLayout){
            let x = 0, y = 0;
            let columns = layoutManager.gridColumns;
            let orderedList = [];
            let children = this._parentBox.get_children();
            for(let i = 0; i < children.length; i++){
                orderedList.push(this._parentBox.layout_manager.get_child_at(x, y));
                [x, y] = this.gridLayoutIter(x, y, columns);
            }
            this._menuLayout.pinnedAppsArray = orderedList;
        }
        this.emit('saveSettings');
    }

    getDragActor() {
        let icon = new St.Icon({
            gicon: Gio.icon_new_for_string(this._iconString),
            style_class: 'popup-menu-icon',
            icon_size: this._iconBin.get_child().icon_size
        });
        return icon;
    }

    getDragActorSource() {
        return this;
    }

    gridLayoutIter(x, y, columns){
        x++;
        if(x === columns){
            y++;
            x = 0;
        }
        return [x, y];
    }

    activate(event) {
        if(this._app)
            this._app.open_new_window(-1);
        else if(this._command === Constants.ShortcutCommands.SHOW_APPS)
            Main.overview._overview._controls._toggleAppsPage();
        else
            Util.spawnCommandLine(this._command);

        this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }
});

var ApplicationMenuItem = GObject.registerClass(class ArcMenu_ApplicationMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, app, displayType, metaInfo, isContainedInCategory) {
        super._init(menuLayout);
        this._app = app;
        this._menuLayout = menuLayout;
        this.metaInfo = metaInfo;
        this._settings = this._menuLayout._settings;
        this.searchType = this._menuLayout.layoutProperties.SearchDisplayType;
        this._displayType = displayType;
        this.hasContextMenu = this._app ? true : false;
        this.isSearchResult = this.metaInfo ? true : false;
        this.isContainedInCategory = isContainedInCategory;

        if(this._app){
            let disableRecentAppsIndicator = this._settings.get_boolean("disable-recently-installed-apps")
            if(!disableRecentAppsIndicator){
                let recentApps = this._settings.get_strv('recently-installed-apps');
                this.isRecentlyInstalled = recentApps.some((appIter) => appIter === this._app.get_id());
            }
        }

        this._iconBin = new St.Bin({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._iconBin);

        this._updateIcon();

        this.label = new St.Label({
            text: this._app ? this._app.get_name() : this.metaInfo['name'],
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.description = this._app ? this._app.get_description() : this.metaInfo['description'];

        let searchResultsDescriptionsSetting = this._settings.get_boolean("show-search-result-details");
        let appsShowDescriptionsSetting = this._settings.get_boolean("apps-show-extra-details");
        this.searchResultsDescriptions = searchResultsDescriptionsSetting && this.isSearchResult;
        this.appsShowDescriptions = appsShowDescriptionsSetting && !this.isSearchResult;

        if(this.description && (this.searchResultsDescriptions || this.appsShowDescriptions) && this._displayType === Constants.DisplayType.LIST){
            let labelBox = new St.BoxLayout({
                vertical: true,
                x_expand: true,
                x_align: Clutter.ActorAlign.FILL,
            });
            let descriptionText = this.description.split('\n')[0];
            this.descriptionLabel = new St.Label({
                text: descriptionText,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: "font-weight: lighter;"
            });
            labelBox.add_child(this.label);
            labelBox.add_child(this.descriptionLabel);
            this.add_child(labelBox);
        }
        else{
            this.add_child(this.label);
        }

        this.label_actor = this.label;

        if(this.isRecentlyInstalled){
            this._indicator = new St.Label({
                text: _('New'),
                style_class: "arcmenu-text-indicator",
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER
            });
            this.add_child(this._indicator);
        }
        if(this._displayType === Constants.DisplayType.GRID)
            Utils.convertToGridLayout(this);

        this.hoverID = this.connect("notify::hover", () => this.removeIndicator());
        this.keyFocusInID = this.connect("key-focus-in", () => this.removeIndicator());
    }

    set folderPath(value){
        this.hasContextMenu = value;
        this._folderPath = value;
    }

    get folderPath(){
        return this._folderPath;
    }

    createIcon(){
        let iconSize;
        if(this._displayType === Constants.DisplayType.GRID){
            this._iconBin.x_align = Clutter.ActorAlign.CENTER;

            const IconSizeEnum = this._settings.get_enum('menu-item-grid-icon-size');
            const LayoutProps = this._menuLayout.layoutProperties;
            let defaultIconStyle = LayoutProps.DefaultIconGridStyle;
            iconSize = Utils.getGridIconSize(IconSizeEnum, defaultIconStyle);
        }
        else if(this._displayType === Constants.DisplayType.LIST){
            const IconSizeEnum = this._settings.get_enum('menu-item-icon-size');
            const LayoutProps = this._menuLayout.layoutProperties;
            let defaultIconSize = this.isContainedInCategory || this.isSearchResult ? LayoutProps.DefaultApplicationIconSize : LayoutProps.DefaultPinnedIconSize;
            iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);
        }
        let icon = this.metaInfo ? this.metaInfo['createIcon'](iconSize) : this._app.create_icon_texture(iconSize);
        if(icon){
            icon.style_class = this._displayType === Constants.DisplayType.GRID ? '' : 'popup-menu-icon'
            return icon;
        }
        else
            return false;
    }

    removeIndicator(){
        if(this.isRecentlyInstalled){
            this.isRecentlyInstalled = false;
            let recentApps = this._settings.get_strv('recently-installed-apps');
            let index = recentApps.indexOf(this._app.get_id());
            if(index > -1){
                recentApps.splice(index, 1);
            }
            this._settings.set_strv('recently-installed-apps', recentApps);

            this._indicator.hide();
            this._menuLayout.setNewAppIndicator();
        }
    }

    popupContextMenu(){
        this.removeIndicator();
        if(this.tooltip)
            this.tooltip.hide();

        if(!this._app && !this.folderPath)
            return;

        if(this.contextMenu === undefined){
            this.contextMenu = new AppContextMenu(this, this._menuLayout);
            if(this._app)
                this.contextMenu.setApp(this._app);
            else if(this.folderPath)
                this.contextMenu.setFolderPath(this.folderPath);
            if(this._displayType === Constants.DisplayType.GRID)
                this.contextMenu.centerBoxPointerPosition();
        }

        this.contextMenu.open(BoxPointer.PopupAnimation.FULL);
    }

    activateSearchResult(provider, metaInfo, terms, event){
        this._menuLayout.arcMenu.toggle();
        if(provider.activateResult){
            provider.activateResult(metaInfo.id, terms);
            if (metaInfo.clipboardText)
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, metaInfo.clipboardText);
        }
        else{
            if (metaInfo.id.endsWith('.desktop')) {
                let app = Shell.AppSystem.get_default().lookup_app(metaInfo.id);
                if (app.can_open_new_window())
                    app.open_new_window(-1);
                else
                    app.activate();
            }
            else{
                this._menuLayout.arcMenu.itemActivated(BoxPointer.PopupAnimation.NONE);
                let systemActions = SystemActions.getDefault();

                //SystemActions.activateAction('open-screenshot-ui') waits for 
                //Main.overview to be hidden before launching ScreenshotUI.
                //Avoid that by directly calling Screenshot.showScreenshotUI().
                if(metaInfo.id === 'open-screenshot-ui'){
                    imports.ui.screenshot.showScreenshotUI();
                    return;
                }

                systemActions.activateAction(metaInfo.id);
            }
        }
    }

    activate(event) {
        this.removeIndicator();

        if(this.metaInfo){
            this.activateSearchResult(this.provider, this.metaInfo, this.resultsView.terms, event);
            return Clutter.EVENT_STOP;
        }
        else
            this._app.open_new_window(-1);

        this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }

    _onDestroy(){
        if(this.hoverID){
            this.disconnect(this.hoverID);
            this.hoverID = null;
        }
        if(this.keyFocusInID){
            this.disconnect(this.keyFocusInID);
            this.keyFocusInID = null;
        }
    }
});

var CategoryMenuItem = GObject.registerClass(class ArcMenu_CategoryMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, category, displayType) {
        super._init(menuLayout);
        this.appList = [];
        this._menuLayout = menuLayout;
        this._settings = this._menuLayout._settings;
        this._layout = this._settings.get_enum('menu-layout');
        this._category = category;
        this._name = "";
        this._horizontalFlip = this._settings.get_boolean('enable-horizontal-flip');
        this._displayType = displayType;
        this.layoutProps = this._menuLayout.layoutProperties;

        if(this._settings.get_enum('category-icon-type') === Constants.CategoryIconType.FULL_COLOR)
            this.add_style_class_name('regular-icons');
        else
            this.add_style_class_name('symbolic-icons');

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this.label = new St.Label({
            text: this._name,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this.label);

        this._updateIcon();

        this._indicator = new St.Icon({
            icon_name: 'message-indicator-symbolic',
            style_class: 'arcmenu-indicator',
            icon_size: INDICATOR_ICON_SIZE,
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER
        });

        if(this.isRecentlyInstalled)
            this.setNewAppIndicator(true);

        if(this._displayType === Constants.DisplayType.BUTTON){
            this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
            this.style_class = 'popup-menu-item arcmenu-button';
            this.remove_child(this._ornamentLabel);
            this.x_expand = false;
            this.x_align = Clutter.ActorAlign.CENTER;
            this.y_expand = false;
            this.y_align = Clutter.ActorAlign.CENTER;
            this.remove_child(this.label);
        }

        this.label_actor = this.label;
        this.connect('motion-event', this._onMotionEvent.bind(this));
        this.connect('enter-event', this._onEnterEvent.bind(this));
        this.connect('leave-event', this._onLeaveEvent.bind(this));
    }

    createIcon(){
        let iconSize;
        if(this._displayType === Constants.DisplayType.BUTTON){
            const IconSizeEnum = this._settings.get_enum('button-item-icon-size');
            let defaultIconSize = this.layoutProps.DefaultButtonsIconSize;
            iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);
        }
        else{
            const IconSizeEnum = this._settings.get_enum('menu-item-category-icon-size');
            let defaultIconSize = this.layoutProps.DefaultCategoryIconSize;
            iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);

            if(iconSize === Constants.ICON_HIDDEN){
                this._iconBin.hide();
                this.style = "padding-top: 8px; padding-bottom: 8px;";
            }
        }

        let [name, gicon, fallbackIcon] = Utils.getCategoryDetails(this._category);
        this._name = _(name);
        this.label.text = _(name);

        let icon = new St.Icon({
            style_class: this._displayType === Constants.DisplayType.BUTTON ? '' : 'popup-menu-icon',
            icon_size: iconSize,
            gicon: gicon,
            fallback_gicon: fallbackIcon
        });
        return icon;
    }

    setNewAppIndicator(shouldShow){
        if(this._displayType === Constants.DisplayType.BUTTON)
            return;

        this.isRecentlyInstalled = shouldShow;
        if(shouldShow && !this.contains(this._indicator))
            this.add_child(this._indicator);
        else if(!shouldShow && this.contains(this._indicator))
            this.remove_child(this._indicator);
    }

    displayAppList(){
        this._menuLayout.searchBox?.clearWithoutSearchChangeEvent();
        this._menuLayout.activeCategory = this._name;
        Utils.activateCategory(this._category, this._menuLayout, this, null);
    }

    activate(event) {
        this.displayAppList();

        super.activate(event);
        if(this.layoutProps.SupportsCategoryOnHover)
            this._menuLayout.setActiveCategory(this);
    }

    _clearLeaveEventTimeout(){
        if(this._menuLayout.leaveEventTimeoutId){
            GLib.source_remove(this._menuLayout.leaveEventTimeoutId);
            this._menuLayout.leaveEventTimeoutId = null;
        }
    }

    _shouldActivateOnHover(){
        const activateOnHover = this._settings.get_boolean('activate-on-hover');
        const supportsActivateOnHover = this.layoutProps.SupportsCategoryOnHover;

        return activateOnHover && supportsActivateOnHover;
    }

    _onEnterEvent(actor, event) {
        if(!this._shouldActivateOnHover())
            return;

        this._clearLeaveEventTimeout();
    }

    _onLeaveEvent(actor, event) {
        if(!this._shouldActivateOnHover())
            return;

        if(!this._menuLayout.leaveEventTimeoutId){
            this._menuLayout.leaveEventTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                this._menuLayout.initialMotionEventItem = null;

                if(this._menuLayout.activeCategoryType === Constants.CategoryType.SEARCH_RESULTS)
                    this._menuLayout.activeCategoryType = -1;

                this._menuLayout.leaveEventTimeoutId = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _onMotionEvent(actor, event) {
        if(!this._shouldActivateOnHover())
            return;

        if(!this._menuLayout.initialMotionEventItem)
            this._menuLayout.initialMotionEventItem = this;

        const inActivationZone = this._inActivationZone(event.get_coords());
        if(inActivationZone){
            this.activate(Clutter.get_current_event());
            this._menuLayout.initialMotionEventItem = this;
            return;
        }
    }

    _inActivationZone([x, y]){
        //no need to activate the category if its already active
        if(this._menuLayout.activeCategoryType === this._category){
            this._menuLayout._oldX = x;
            this._menuLayout._oldY = y;
            return false;
        }

        if(!this._menuLayout.initialMotionEventItem)
            return false;

        let [posX, posY] = this._menuLayout.initialMotionEventItem.get_transformed_position();

        //the mouse is on the initialMotionEventItem
        const onInitialMotionEventItem = this._menuLayout.initialMotionEventItem === this;
        if (onInitialMotionEventItem){
            this._menuLayout._oldX = x;
            this._menuLayout._oldY = y;
            if(this._menuLayout.activeCategoryType !== Constants.CategoryType.SEARCH_RESULTS)
                return true;
        }

        let width = this._menuLayout.initialMotionEventItem.width;
        let height = this._menuLayout.initialMotionEventItem.height;

        let maxX = this._horizontalFlip ? posX : posX + width;
        let maxY = posY + height;

        let distance = Math.abs(maxX - this._menuLayout._oldX);
        let point1 = [this._menuLayout._oldX, this._menuLayout._oldY]
        let point2 = [maxX, posY - distance];
        let point3 = [maxX, maxY + distance];

        let area = Utils.areaOfTriangle(point1, point2, point3);
        let a1 = Utils.areaOfTriangle([x, y], point2, point3);
        let a2 = Utils.areaOfTriangle(point1, [x, y], point3);
        let a3 = Utils.areaOfTriangle(point1, point2, [x, y]);
        const outsideTriangle = area !== a1 + a2 + a3;

        return outsideTriangle;
    }

    _onDestroy(){
        this._clearLeaveEventTimeout();
        super._onDestroy();
    }
});

//Directory shorctuts. Home, Documents, Downloads, etc
var PlaceMenuItem = GObject.registerClass(class ArcMenu_PlaceMenuItem extends ArcMenuPopupBaseMenuItem{
    _init(menuLayout, info, displayType, isContainedInCategory) {
        super._init(menuLayout);
        this._menuLayout = menuLayout;
        this._displayType = displayType;
        this._info = info;
        this._settings = menuLayout._settings;
        this.isContainedInCategory = isContainedInCategory;
        this.hasContextMenu = false;

        this.label = new St.Label({
            text: _(info.name),
            x_expand: true,
            y_expand: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._iconBin = new St.Bin();
        this.add_child(this._iconBin);

        this._updateIcon();

        if(this._displayType === Constants.DisplayType.BUTTON){
            this.tooltipLocation = Constants.TooltipLocation.BOTTOM_CENTERED;
            this.style_class = 'popup-menu-item arcmenu-button';
            this.remove_child(this._ornamentLabel);
            this.x_expand = this.y_expand = false;
            this.x_align = this.y_align = Clutter.ActorAlign.CENTER;
        }
        else{
            this.add_child(this.label);
        }

        if (info.isRemovable()) {
            this.style = "padding-right: 15px;";
            this._ejectButton = new ArcMenuButtonItem(this._menuLayout, null, 'media-eject-symbolic');
            this._ejectButton.add_style_class_name("arcmenu-small-button")
            this._ejectButton.setIconSize(14);
            this._ejectButton.x_align = Clutter.ActorAlign.END;
            this._ejectButton.x_expand = true;
            this._ejectButton.connect('activate', info.eject.bind(info));
            this.add_child(this._ejectButton);
        }

        this._changedId = this._info.connect('changed', this._propertiesChanged.bind(this));
    }

    set folderPath(value){
        this.hasContextMenu = value;
        this._folderPath = value;
    }

    get folderPath(){
        return this._folderPath;
    }

    setAsRecentFile(recentFile, removeRecentFile){
        const homeRegExp = new RegExp('^(' + GLib.get_home_dir() + ')');
        let file = Gio.File.new_for_uri(recentFile.get_uri());

        this.folderPath = file.get_parent()?.get_path() // can be null
        this.style = "padding-right: 15px;";
        this.description = recentFile.get_uri_display().replace(homeRegExp, '~');
        this.fileUri = recentFile.get_uri();

        this._deleteButton = new ArcMenuButtonItem(this._menuLayout, null, 'edit-delete-symbolic');
        this._deleteButton.toggleMenuOnClick = false;
        this._deleteButton.x_align = Clutter.ActorAlign.END;
        this._deleteButton.x_expand = true;
        this._deleteButton.add_style_class_name("arcmenu-small-button");
        this._deleteButton.setIconSize(14);
        this._deleteButton.connect('activate', () => {
            this.cancelPopupTimeout();
            this.contextMenu?.close();

            removeRecentFile();

            this.destroy();
        });

        this.add_child(this._deleteButton);
    }

    _onDestroy() {
        if (this._changedId) {
            this._info.disconnect(this._changedId);
            this._changedId = null;
        }
        if(this._info)
            this._info.destroy();
        super._onDestroy();
    }

    popupContextMenu(){
        if(this.tooltip)
            this.tooltip.hide();

        if(this.contextMenu === undefined){
            this.contextMenu = new AppContextMenu(this, this._menuLayout);
            this.contextMenu.setFolderPath(this.folderPath);
            if(this._displayType === Constants.DisplayType.GRID)
                this.contextMenu.centerBoxPointerPosition();
        }
        this.contextMenu.toggle();
    }

    createIcon(){
        let iconSizeEnum;
        if(this.isContainedInCategory)
            iconSizeEnum = this._settings.get_enum('menu-item-icon-size');
        else
            iconSizeEnum = this._settings.get_enum('quicklinks-item-icon-size');

        const LayoutProps = this._menuLayout.layoutProperties;
        let defaultIconSize = this.isContainedInCategory ? LayoutProps.DefaultApplicationIconSize : LayoutProps.DefaultQuickLinksIconSize;
        let iconSize = Utils.getIconSize(iconSizeEnum, defaultIconSize);

        if(this._displayType === Constants.DisplayType.BUTTON){
            let defaultIconSize = LayoutProps.DefaultButtonsIconSize;
            const IconSizeEnum = this._settings.get_enum('button-item-icon-size');
            iconSize = Utils.getIconSize(IconSizeEnum, defaultIconSize);
        }

        return new St.Icon({
            gicon: this._info.icon,
            icon_size: iconSize,
            style_class: this._displayType === Constants.DisplayType.BUTTON ? '' : 'popup-menu-icon',
        });
    }

    activate(event) {
        this._info.launch(event.get_time());
        this._menuLayout.arcMenu.toggle();
        super.activate(event);
    }

    _propertiesChanged(info) {
        this._info = info;
        this._iconBin.set_child(this.createIcon());
        if(this.label)
            this.label.text = _(info.name);
    }
});

var SearchBox = GObject.registerClass({
Signals: {
    'search-changed': { param_types: [GObject.TYPE_STRING] },
    'entry-key-focus-in': { },
    'entry-key-press': { param_types: [Clutter.Event.$gtype] },
},},
class ArcMenu_SearchBox extends St.Entry {
    _init(menuLayout) {
        super._init({
            hint_text: _("Search…"),
            track_hover: true,
            can_focus: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.START,
            name: "ArcMenuSearchEntry",
            style_class: 'arcmenu-search-entry'
        });
        this.searchResults = menuLayout.searchResults;
        this._settings = menuLayout._settings;
        this.triggerSearchChangeEvent = true;
        this._iconClickedId = 0;
        const IconSizeEnum = this._settings.get_enum('misc-item-icon-size');
        let iconSize = Utils.getIconSize(IconSizeEnum, Constants.EXTRA_SMALL_ICON_SIZE);

        this._findIcon = new St.Icon({
            style_class: 'search-entry-icon',
            icon_name: 'edit-find-symbolic',
            icon_size: iconSize
        });

        this._clearIcon = new St.Icon({
            style_class: 'search-entry-icon',
            icon_name: 'edit-clear-symbolic',
            icon_size: iconSize
        });

        this.set_primary_icon(this._findIcon);

        this._text = this.get_clutter_text();
        this._textChangedId = this._text.connect('text-changed', this._onTextChanged.bind(this));
        this._keyPressId = this._text.connect('key-press-event', this._onKeyPress.bind(this));
        this._keyFocusInId = this._text.connect('key-focus-in', this._onKeyFocusIn.bind(this));
        this._keyFocusInId = this._text.connect('key-focus-out', this._onKeyFocusOut.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));
    }

    get entryBox(){
        return this;
    }

    get actor(){
        return this;
    }

    getText() {
        return this.get_text();
    }

    setText(text) {
        this.set_text(text);
    }

    clearWithoutSearchChangeEvent(){
        this.triggerSearchChangeEvent = false;
        this.set_text('');
        this.triggerSearchChangeEvent = true;
    }

    hasKeyFocus() {
        return this.contains(global.stage.get_key_focus());
    }

    clear() {
        this.set_text('');
    }

    isEmpty() {
        return this.get_text().length === 0;
    }

    _onKeyFocusOut(){
        if(!this.isEmpty()){
            this.add_style_pseudo_class('focus');
            return Clutter.EVENT_STOP;
        }
    }

    _onTextChanged() {
        if(!this.isEmpty()){
            this.set_secondary_icon(this._clearIcon);
            if(this._iconClickedId === 0)
                this._iconClickedId = this.connect('secondary-icon-clicked', () => this.clear());
            if(!this.hasKeyFocus())
                this.grab_key_focus();
            if (!this.searchResults.getTopResult()?.has_style_pseudo_class('active'))
                this.searchResults.getTopResult()?.add_style_pseudo_class('active')
            this.add_style_pseudo_class('focus');
        }
        else{
            if(this._iconClickedId > 0){
                this.disconnect(this._iconClickedId);
                this._iconClickedId = 0;
            }
            if(!this.hasKeyFocus())
                this.remove_style_pseudo_class('focus');
            this.set_secondary_icon(null);
        }

        if(this.triggerSearchChangeEvent)
            this.emit('search-changed', this.get_text());
    }

    _onKeyPress(actor, event) {
        const symbol = event.get_key_symbol();
        const searchResult = this.searchResults.getTopResult();

        if (!this.isEmpty() && searchResult){
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                searchResult.activate(event);
                return Clutter.EVENT_STOP;
            }
            else if (symbol === Clutter.KEY_Menu && searchResult.hasContextMenu){
                searchResult.popupContextMenu();
                return Clutter.EVENT_STOP;
            }
        }
        this.emit('entry-key-press', event);
        return Clutter.EVENT_PROPAGATE;
    }

    _onKeyFocusIn() {
        this.add_style_pseudo_class('focus');
        this.emit('entry-key-focus-in');
        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        if (this._textChangedId) {
            this._text.disconnect(this._textChangedId);
            this._textChangedId = null;
        }
        if (this._keyPressId) {
            this._text.disconnect(this._keyPressId);
            this._keyPressId = null;
        }
        if (this._keyFocusInId) {
            this._text.disconnect(this._keyFocusInId);
            this._keyFocusInId = null;
        }
        if(this._iconClickedId){
            this.disconnect(this._iconClickedId);
            this._iconClickedId = null;
        }
    }
});

var MenuButtonWidget = GObject.registerClass(class ArcMenu_MenuButtonWidget extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'panel-status-menu-box',
            pack_start: false
        });

        this._icon = new St.Icon({
            style_class: 'arcmenu-menu-button',
            track_hover: true,
            reactive: true,
        });
        this._label = new St.Label({
            text: _("Apps"),
            y_expand: true,
            style_class: 'arcmenu-menu-button',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._icon);
        this.add_child(this._label);
    }

    setActiveStylePseudoClass(enable){
        if(enable){
            this._icon.add_style_pseudo_class('active');
            this._label.add_style_pseudo_class('active');
        }
        else{
            this._icon.remove_style_pseudo_class('active');
            this._label.remove_style_pseudo_class('active');
        }
    }

    getPanelLabel() {
        return this._label;
    }

    getPanelIcon() {
        return this._icon;
    }

    showPanelIcon() {
        if (!this.contains(this._icon)) {
            this.add_child(this._icon);
        }
    }

    hidePanelIcon() {
        if (this.contains(this._icon)) {
            this.remove_child(this._icon);
        }
    }

    showPanelText() {
        if (!this.contains(this._label)) {
            this.add_child(this._label);
        }
    }

    hidePanelText() {
        this._label.style = null;
        if (this.contains(this._label)) {
            this.remove_child(this._label);
        }
    }

    setPanelTextStyle(style){
        this._label.style = style;
    }
});

var WorldClocksSection = GObject.registerClass(class ArcMenu_WorldClocksSection extends DateMenu.WorldClocksSection {
    _init(menuLayout) {
        super._init();
        this._menuLayout = menuLayout;
        this.connect('destroy', () => this._onDestroy());

        this._syncID = GObject.signal_handler_find(this._appSystem, { signalId: 'installed-changed' });
        this._clockChangedID = GObject.signal_handler_find(this._settings, { signalId: 'changed' });
    }

    _onDestroy(){
        if(this._syncID){
            this._appSystem.disconnect(this._syncID);
            this._syncID = null;
        }
        if(this._clockChangedID){
            this._settings.disconnect(this._clockChangedID);
            this._clockChangedID = null;
        }
        if(this._clocksProxyID){
            this._clocksProxy.disconnect(this._clocksProxyID);
            this._clocksProxyID = null;
        }
        if(this._clockNotifyId){
            this._clock.disconnect(this._clockNotifyId);
            this._clockNotifyId = null;
        }
        if(this._tzNotifyId){
            this._clock.disconnect(this._tzNotifyId);
            this._tzNotifyId = null;
        }
    }

    vfunc_clicked() {
        this._menuLayout.arcMenu.toggle();
        if (this._clocksApp){
            this._clocksApp.activate();
        }
    }

    _onProxyReady(proxy, error) {
        if (error) {
            log(`Failed to create GNOME Clocks proxy: ${error}`);
            return;
        }

        this._clocksProxyID = this._clocksProxy.connect('g-properties-changed',
            this._onClocksPropertiesChanged.bind(this));
        this._onClocksPropertiesChanged();
    }
});

var WeatherSection = GObject.registerClass(class ArcMenu_WeatherSection extends DateMenu.WeatherSection {
    _init(menuLayout) {
        super._init();
        this._menuLayout = menuLayout;

        this.connect('destroy', () => this._onDestroy());
    }

    _onDestroy(){
        this._weatherClient.disconnectAll();
        this._weatherClient = null;
        delete this._weatherClient;
    }

    vfunc_clicked() {
        this._menuLayout.arcMenu.toggle();
        this._weatherClient.activateApp();
    }
});
