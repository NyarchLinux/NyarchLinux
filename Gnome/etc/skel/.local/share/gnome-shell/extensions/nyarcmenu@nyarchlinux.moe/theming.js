/* exported getStylesheetFiles, createStylesheet, unloadStylesheet,
   deleteStylesheet, updateStylesheet */
const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Clutter, Gio, GLib, St} = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const { ExtensionState } = ExtensionUtils;
const Constants = Me.imports.constants;

Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');
Gio._promisify(Gio.File.prototype, 'create_async');
Gio._promisify(Gio.File.prototype, 'make_directory_async');
Gio._promisify(Gio.File.prototype, 'delete_async');
let themeContext = St.ThemeContext.get_for_stage(global.stage);


/**
 *  @returns The stylesheet file
 */
function getStylesheetFiles() {
    const directoryPath = GLib.build_filenamev([GLib.get_home_dir(), '.local/share/arcmenu']);
    const stylesheetPath = GLib.build_filenamev([directoryPath, 'stylesheet.css']);

    const directory = Gio.File.new_for_path(directoryPath);
    const stylesheet = Gio.File.new_for_path(stylesheetPath);

    return [directory, stylesheet];
}

/**
 * @param {Gio.Settings} settings ArcMenu Settings
 */
async function createStylesheet(settings) {
    try {
        const [directory, stylesheet] = getStylesheetFiles();

        if (!directory.query_exists(null))
            await directory.make_directory_async(0, null);
        if (!stylesheet.query_exists(null))
            await stylesheet.create_async(Gio.FileCreateFlags.NONE, 0, null);

        Me.customStylesheet = stylesheet;
        updateStylesheet(settings);
    } catch (e) {
        log(`ArcMenu - Error creating custom stylesheet: ${e}`);
    }
}

/**
 *  @description Unload the custom stylesheet from GNOME shell
 */
function unloadStylesheet() {
    if (!Me.customStylesheet)
        return;

    const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
    theme.unload_stylesheet(Me.customStylesheet);
}

/**
 *  @description Delete the custom stylesheet file
 */
async function deleteStylesheet() {
    unloadStylesheet();

    try {
        const [directory, stylesheet] = getStylesheetFiles();

        if (stylesheet.query_exists(null))
            await stylesheet.delete_async(0, null);
        if (directory.query_exists(null))
            await directory.delete_async(0, null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            log(`ArcMenu - Error deleting custom stylesheet: ${e}`);
    }
}
function read_file(path) {
    const file = Gio.File.new_for_path(path);
    const [, contents, etag] = file.load_contents(null);
    const decoder = new TextDecoder('utf-8');
    const contentsString = decoder.decode(contents);

    return contentsString;
}
function get_gtk4_theme() {
    let config_path = GLib.get_home_dir() + "/.config";
    let gtk4path = config_path + "/gtk-4.0/gtk.css";
    try {
        color_string = read_file(gtk4path);
        log("BUEBIUEB");
    } catch(e) {
        log(e);
        return null;
    }
    lines = color_string.split("\n");
    const colors = {};
    for (const string of lines) {
        try{
            let spl = string.split(' ');
            if (spl.length < 3) {
                continue;
            }
            key = spl[1];
            value = spl[2];
            colors[key] = value.replace(';', ''); //TODO fix if color is not hex
        } catch (e) {
            log(e);
        }
    }
    return colors;
}

async function updateStylesheet(settings){
    const stylesheet = Me.customStylesheet;

    if (!stylesheet) {
        log('ArcMenu - Warning: Custom stylesheet not found! Unable to set contents of custom stylesheet.');
        return;
    }
    blurMyShell = Main.extensionManager.lookup(Constants.BLUR_MY_SHELL_UUID);
    //const ctx = St.ThemeContext.get_for_stage(global.stage);
    unloadStylesheet();
    
    let customMenuThemeCSS = ``;
    let extraStylingCSS = ``;
    let colors = get_gtk4_theme();

    let menuBorderColor = settings.get_string('menu-border-color');
    let menuBorderWidth = settings.get_int('menu-border-width');
    let menuBorderRadius = settings.get_int('menu-border-radius');
    let menuFontSize = settings.get_int('menu-font-size');
    let menuSeparatorColor = settings.get_string('menu-separator-color');
    let menuBGColor;
    let menuFGColor;
    let itemHoverBGColor;
    let itemHoverFGColor;
    let itemActiveBGColor;
    let itemActiveFGColor;
    let ravenMenu;
    let menubgtrasparency = 1;
    if (blurMyShell.state === ExtensionState.ENABLED) {
        menubgtrasparency = 0.8;
    }
    if (colors == null) {
        menuBGColor = settings.get_string('menu-background-color');
        menuFGColor = settings.get_string('menu-foreground-color');
        itemHoverBGColor = settings.get_string('menu-item-hover-bg-color');
        itemHoverFGColor = settings.get_string('menu-item-hover-fg-color');
        itemActiveBGColor = settings.get_string('menu-item-active-bg-color');
        itemActiveFGColor = settings.get_string('menu-item-active-fg-color');
        ravenMenu = "#262830";
    } else {
        menuBGColor = colors['window_bg_color'];
        menuFGColor = colors['view_fg_color']; // Alternative headerbar_fg_color
        itemHoverBGColor = colors['accent_bg_color']; // popover_bg_color
        itemHoverFGColor = colors['headerbar_fg_color'];
        itemActiveBGColor = colors['window_bg_color'];
        itemActiveFGColor = colors['accent_fg_color'];
        ravenMenu = colors['headerbar_bg_color'];
        log(ravenMenu);
    }
    let [menuRise, menuRiseValue] = settings.get_value('menu-arrow-rise').deep_unpack();

    let [buttonFG, buttonFGColor] = settings.get_value('menu-button-fg-color').deep_unpack();
    let [buttonHoverBG, buttonHoverBGColor] = settings.get_value('menu-button-hover-bg-color').deep_unpack();
    let [buttonHoverFG, buttonHoverFGColor] = settings.get_value('menu-button-hover-fg-color').deep_unpack();
    let [buttonActiveBG, buttonActiveBGColor] = settings.get_value('menu-button-active-bg-color').deep_unpack();
    let [buttonActiveFG, buttonActiveFGColor] = settings.get_value('menu-button-active-fg-color').deep_unpack();
    let [buttonRadius, buttonRadiusValue] = settings.get_value('menu-button-border-radius').deep_unpack();
    let [buttonWidth, buttonWidthValue] = settings.get_value('menu-button-border-width').deep_unpack();
    let [buttonBorder, buttonBorderColor] = settings.get_value('menu-button-border-color').deep_unpack();
    let [searchBorder, searchBorderValue] = settings.get_value('search-entry-border-radius').deep_unpack();

    if(buttonFG){
        extraStylingCSS += `.arcmenu-menu-button{
                                color: ${buttonFGColor};
                            }`;
    }
    if(buttonHoverBG){
        extraStylingCSS += `.arcmenu-panel-menu:hover{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonHoverBGColor};
                            }`;
    }
    if(buttonHoverFG){
        extraStylingCSS += `.arcmenu-panel-menu:hover .arcmenu-menu-button{
                                color: ${buttonHoverFGColor};
                            }`
    }
    if(buttonActiveFG){
        extraStylingCSS += `.arcmenu-menu-button:active{
                                color: ${buttonActiveFGColor};
                            }`;
    }
    if(buttonActiveBG){
        extraStylingCSS += `.arcmenu-panel-menu:active{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonActiveBGColor};
                            }`;
    }
    if(buttonRadius){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-radius: ${buttonRadiusValue}px;
                            }`;
    }
    if(buttonWidth){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-width: ${buttonWidthValue}px;
                            }`;
    }
    if(buttonBorder){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-color: ${buttonBorderColor};
                            }`;
    }
    if(menuRise){
        extraStylingCSS += `.arcmenu-menu{
                                -arrow-rise: ${menuRiseValue}px;
                            }`;
    }
    if(searchBorder){
        extraStylingCSS += `#ArcMenuSearchEntry{
                                border-radius: ${searchBorderValue}px;
                            }`;
    }
    extraStylingCSS += `.actionsBox{
        background-color: ${ravenMenu};
    }`;
    if(settings.get_boolean('override-menu-theme')){
        customMenuThemeCSS = `
        .arcmenu-menu{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
        }
       .arcmenu-menu .popup-menu-content {
            background-color: ${modifyColorLuminance(menuBGColor, 0, menubgtrasparency)};
            border-color: ${menuBorderColor};
            border-width: ${menuBorderWidth}px;
            border-radius: ${menuBorderRadius}px;
        }
        .arcmenu-menu StButton {
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0, .1)};
            border-width: 0px;
            box-shadow: none;
            border-radius: 8px;
        }
        .arcmenu-menu .popup-menu-item:focus, .arcmenu-menu .popup-menu-item:hover,
        .arcmenu-menu .popup-menu-item:checked, .arcmenu-menu .popup-menu-item.selected,
        .arcmenu-menu StButton:focus, .arcmenu-menu StButton:hover, .arcmenu-menu StButton:checked {
            color: ${itemHoverFGColor};
            background-color: ${itemHoverBGColor};
        }
        .arcmenu-menu .popup-menu-item:active, .arcmenu-menu StButton:active {
            color: ${itemActiveFGColor};
            background-color: ${itemActiveBGColor};
        }
        .arcmenu-menu .popup-menu-item:insensitive{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
            font-size: ${menuFontSize - 2}pt;
        }
        .arcmenu-menu .world-clocks-header, .arcmenu-menu .world-clocks-timezone,
        .arcmenu-menu .weather-header{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-menu .world-clocks-time, .arcmenu-menu .world-clocks-city{
            color: ${menuFGColor};
        }
        .arcmenu-menu .weather-forecast-time{
            color: ${modifyColorLuminance(menuFGColor, -0.1)};
        }
        .arcmenu-menu .popup-separator-menu-item .popup-separator-menu-item-separator{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu .popup-separator-menu-item StLabel{
            color: ${menuFGColor};
        }
        .separator-color-style{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu StEntry{
            font-size: ${menuFontSize}pt;
            border-color: ${modifyColorLuminance(menuSeparatorColor, 0, .1)};
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, -0.1, .4)};
        }
        .arcmenu-menu StEntry:hover{
            border-color: ${itemHoverBGColor};
            background-color: ${modifyColorLuminance(menuBGColor, -0.15, .4)};
        }
        .arcmenu-menu StEntry:focus{
            border-color: ${itemActiveBGColor};
            background-color: ${modifyColorLuminance(menuBGColor, -0.2, .4)};
        }
        .arcmenu-menu StLabel.hint-text{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-custom-tooltip{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.05, 1)};
        }
        .arcmenu-small-button:hover{
            box-shadow: inset 0 0 0 100px ${modifyColorLuminance(itemHoverBGColor, -0.1)};
        }
        .arcmenu-menu .user-icon{
            border-color: ${modifyColorLuminance(menuFGColor, 0, .7)};
        }
        `;
    }

    const customStylesheetCSS = customMenuThemeCSS + extraStylingCSS;

    if(customStylesheetCSS.length === 0)
        return;

    try{
        let bytes = new GLib.Bytes(customStylesheetCSS);

        const [success, _etag] = await stylesheet.replace_contents_bytes_async(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        if(!success){
            log("ArcMenu - Failed to replace contents of custom stylesheet.");
            return;
        }

        Me.customStylesheet = stylesheet;
        let theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.load_stylesheet(Me.customStylesheet);
    }
    catch(e){
        log(`ArcMenu - Error replacing contents of custom stylesheet: ${e}`);
    }
}
/*
async function updateStylesheet(settings){
    let stylesheet = Me.customStylesheet;

    if(!stylesheet){
        log("ArcMenu - Warning: Custom stylesheet not found! Unable to set contents of custom stylesheet.");
        return;
    }

    unloadStylesheet();

    let customMenuThemeCSS = '';
    let extraStylingCSS = '';

    let menuBGColor = settings.get_string('menu-background-color');
    let menuFGColor = settings.get_string('menu-foreground-color');
    let menuBorderColor = settings.get_string('menu-border-color');
    let menuBorderWidth = settings.get_int('menu-border-width');
    let menuBorderRadius = settings.get_int('menu-border-radius');
    let menuFontSize = settings.get_int('menu-font-size');
    let menuSeparatorColor = settings.get_string('menu-separator-color');
    let itemHoverBGColor = settings.get_string('menu-item-hover-bg-color');
    let itemHoverFGColor = settings.get_string('menu-item-hover-fg-color');
    let itemActiveBGColor = settings.get_string('menu-item-active-bg-color');
    let itemActiveFGColor = settings.get_string('menu-item-active-fg-color');

    let [menuRise, menuRiseValue] = settings.get_value('menu-arrow-rise').deep_unpack();

    let [buttonFG, buttonFGColor] = settings.get_value('menu-button-fg-color').deep_unpack();
    let [buttonHoverBG, buttonHoverBGColor] = settings.get_value('menu-button-hover-bg-color').deep_unpack();
    let [buttonHoverFG, buttonHoverFGColor] = settings.get_value('menu-button-hover-fg-color').deep_unpack();
    let [buttonActiveBG, buttonActiveBGColor] = settings.get_value('menu-button-active-bg-color').deep_unpack();
    let [buttonActiveFG, buttonActiveFGColor] = settings.get_value('menu-button-active-fg-color').deep_unpack();
    let [buttonRadius, buttonRadiusValue] = settings.get_value('menu-button-border-radius').deep_unpack();
    let [buttonWidth, buttonWidthValue] = settings.get_value('menu-button-border-width').deep_unpack();
    let [buttonBorder, buttonBorderColor] = settings.get_value('menu-button-border-color').deep_unpack();
    let [searchBorder, searchBorderValue] = settings.get_value('search-entry-border-radius').deep_unpack();

    if(buttonFG){
        extraStylingCSS += `.arcmenu-menu-button{
                                color: ${buttonFGColor};
                            }`;
    }
    if(buttonHoverBG){
        extraStylingCSS += `.arcmenu-panel-menu:hover{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonHoverBGColor};
                            }`;
    }
    if(buttonHoverFG){
        extraStylingCSS += `.arcmenu-panel-menu:hover .arcmenu-menu-button{
                                color: ${buttonHoverFGColor};
                            }`
    }
    if(buttonActiveFG){
        extraStylingCSS += `.arcmenu-menu-button:active{
                                color: ${buttonActiveFGColor};
                            }`;
    }
    if(buttonActiveBG){
        extraStylingCSS += `.arcmenu-panel-menu:active{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonActiveBGColor};
                            }`;
    }
    if(buttonRadius){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-radius: ${buttonRadiusValue}px;
                            }`;
    }
    if(buttonWidth){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-width: ${buttonWidthValue}px;
                            }`;
    }
    if(buttonBorder){
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-color: ${buttonBorderColor};
                            }`;
    }
    if(menuRise){
        extraStylingCSS += `.arcmenu-menu{
                                -arrow-rise: ${menuRiseValue}px;
                            }`;
    }
    if(searchBorder){
        extraStylingCSS += `#ArcMenuSearchEntry{
                                border-radius: ${searchBorderValue}px;
                            }`;
    }

    if(settings.get_boolean('override-menu-theme')){
        customMenuThemeCSS = `
        .arcmenu-menu{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
        }
       .arcmenu-menu .popup-menu-content {
            background-color: ${menuBGColor};
            border-color: ${menuBorderColor};
            border-width: ${menuBorderWidth}px;
            border-radius: ${menuBorderRadius}px;
        }
        .arcmenu-menu StButton {
            color: ${menuFGColor};
            background-color: ${menuBGColor};
            border-width: 0px;
            box-shadow: none;
            border-radius: 8px;
        }
        .arcmenu-menu StScrollBar StButton#vhandle, .arcmenu-menu StScrollBar StButton#hhandle {
            background-color: ${modifyColorLuminance(menuBGColor, 0.15)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:hover, .arcmenu-menu StScrollBar StButton#hhandle:hover {
            background-color: ${modifyColorLuminance(menuBGColor, 0.20)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:active, .arcmenu-menu StScrollBar StButton#hhandle:active {
            background-color: ${modifyColorLuminance(menuBGColor, 0.25)};
        }
        .arcmenu-menu .popup-menu-item:focus, .arcmenu-menu .popup-menu-item:hover,
        .arcmenu-menu .popup-menu-item:checked, .arcmenu-menu .popup-menu-item.selected,
        .arcmenu-menu StButton:focus, .arcmenu-menu StButton:hover, .arcmenu-menu StButton:checked {
            color: ${itemHoverFGColor};
            background-color: ${itemHoverBGColor};
        }
        .arcmenu-menu .popup-menu-item:active, .arcmenu-menu StButton:active {
            color: ${itemActiveFGColor};
            background-color: ${itemActiveBGColor};
        }
        .arcmenu-menu .popup-menu-item:insensitive{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
            font-size: ${menuFontSize - 2}pt;
        }
        .arcmenu-menu .world-clocks-header, .arcmenu-menu .world-clocks-timezone,
        .arcmenu-menu .weather-header{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-menu .world-clocks-time, .arcmenu-menu .world-clocks-city{
            color: ${menuFGColor};
        }
        .arcmenu-menu .weather-forecast-time{
            color: ${modifyColorLuminance(menuFGColor, 0.1)};
        }
        .arcmenu-menu .popup-separator-menu-item .popup-separator-menu-item-separator{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu .popup-separator-menu-item StLabel{
            color: ${menuFGColor};
        }
        .separator-color-style{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu StEntry{
            font-size: ${menuFontSize}pt;
            border-color: ${modifyColorLuminance(menuSeparatorColor, 0, .1)};
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.1, .4)};
        }
        .arcmenu-menu StEntry:hover{
            border-color: ${itemHoverBGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.15, .4)};
        }
        .arcmenu-menu StEntry:focus{
            border-color: ${itemActiveBGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.2, .4)};
        }
        .arcmenu-menu StLabel.hint-text{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-custom-tooltip{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.05, 1)};
        }
        .arcmenu-menu .user-icon{
            border-color: ${modifyColorLuminance(menuFGColor, 0, .7)};
        }
        `;
    }

    const customStylesheetCSS = customMenuThemeCSS + extraStylingCSS;

    if (customStylesheetCSS.length === 0)
        return;

    try {
        const bytes = new GLib.Bytes(customStylesheetCSS);

        const [success, etag_] = await stylesheet.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        if (!success) {
            log('ArcMenu - Failed to replace contents of custom stylesheet.');
            return;
        }

        Me.customStylesheet = stylesheet;
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.load_stylesheet(Me.customStylesheet);
    } catch (e) {
        log(`ArcMenu - Error replacing contents of custom stylesheet: ${e}`);
    }
}

/**
 *
 * @param {string} colorString the color to modify
 * @param {number} luminanceAdjustment luminance adjustment
 * @param {number} overrideAlpha change the color alpha to this value
 * @returns a string in rbga() format representing the new modified color
 */
function modifyColorLuminance(colorString, luminanceAdjustment, overrideAlpha) {
    const color = Clutter.color_from_string(colorString)[1];
    const [hue, luminance, saturation] = color.to_hls();
    let modifiedLuminance;

    if ((luminance >= .85 && luminanceAdjustment > 0) || (luminance <= .15 && luminanceAdjustment < 0))
        modifiedLuminance = Math.max(Math.min(luminance - luminanceAdjustment, 1), 0);
    else
        modifiedLuminance = Math.max(Math.min(luminance + luminanceAdjustment, 1), 0);

    let alpha = (color.alpha / 255).toPrecision(3);
    if (overrideAlpha)
        alpha = overrideAlpha;

    const modifiedColor = Clutter.color_from_hls(hue, modifiedLuminance, saturation);

    return `rgba(${modifiedColor.red}, ${modifiedColor.green}, ${modifiedColor.blue}, ${alpha})`;
}
