// Copyright 2014 Red Hat, Inc
// SPDX-FileCopyrightText: 2014 Red Hat, Inc.
//
// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

const IconContainer = GObject.registerClass(
class IconContainer extends Clutter.Actor {
    vfunc_allocate(box) {
        this.set_allocation(box);

        const [availWidth, availHeight] = box.get_size();
        for (const child of this)
            child.allocate_available_size(0, 0, availWidth, availHeight);
    }
});

const BackgroundLogoLayout = GObject.registerClass(
class BackgroundLogoLayout extends Clutter.LayoutManager {
    #logo;
    #settings;
    #monitorIndex;

    constructor(logo, settings, monitorIndex) {
        super();
        this.#logo = logo;
        this.#settings = settings;
        this.#monitorIndex = monitorIndex;

        this.#settings.connectObject(
            'changed::logo-position', () => this.layout_changed(),
            'changed::logo-border', () => this.layout_changed(),
            'changed::logo-size', () =>  this.layout_changed(),
            this);
    }

    vfunc_get_preferred_width(container) {
        const [width] = this.#getLogoSize();
        const scale = this.#getActorScale(container);
        return [scale * width, scale * width];
    }

    vfunc_get_preferred_height(container) {
        const [, height] = this.#getLogoSize();
        const scale = this.#getActorScale(container);
        return [scale * height, scale * height];
    }

    vfunc_allocate(container, box) {
        const [availWidth, availHeight] = box.get_size();
        const scale = this.#getActorScale(container);

        const [logoWidth, logoHeight] =
            this.#getLogoSize().map(size => size * scale);

        const childBox = new Clutter.ActorBox();
        childBox.set_size(logoWidth, logoHeight);

        const border = this.#settings.get_uint('logo-border') * scale;
        const [xAlign, yAlign] = this.#getLogoAlign();
        let x, y;

        switch (xAlign) {
        case Clutter.ActorAlign.START:
            x = border;
            break;
        case Clutter.ActorAlign.CENTER:
            x = Math.floor((availWidth - logoWidth) / 2);
            break;
        case Clutter.ActorAlign.END:
            x = availWidth - border - logoWidth;
            break;
        }

        switch (yAlign) {
        case Clutter.ActorAlign.START:
            y = border;
            break;
        case Clutter.ActorAlign.CENTER:
            y = Math.floor((availHeight - logoHeight) / 2);
            break;
        case Clutter.ActorAlign.END:
            y = availHeight - border - logoHeight;
            break;
        }

        childBox.set_origin(x, y);
        this.#logo.allocate(childBox);
    }

    getMonitorRelativeWidth(size) {
        return this.#monitor.width * size / 100;
    }

    get #monitor() {
        return Main.layoutManager.monitors[this.#monitorIndex];
    }

    #getActorScale(actor) {
        if (!actor.has_allocation())
            return 1;

        return actor.allocation.get_width() / this.#monitor.width;
    }

    #getLogoSize() {
        const [, , natWidth, natHeight] = this.#logo.get_preferred_size();
        if (natWidth === 0 || natHeight === 0)
            return [0, 0];

        const size = this.#settings.get_double('logo-size');

        const width = this.getMonitorRelativeWidth(size);
        const height = natHeight * width / natWidth;
        return [width, height];
    }

    #getLogoAlign() {
        const rtl = this.#logo.text_direction === Clutter.TextDirection.RTL;

        function effectiveAlign(align) {
            if (align === Clutter.ActorAlign.START)
                return rtl ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;
            if (align === Clutter.ActorAlign.END)
                return rtl ? Clutter.ActorAlign.START : Clutter.ActorAlign.END;
            return align;
        }

        let xAlign, yAlign;
        const position = this.#settings.get_string('logo-position');
        if (position.endsWith('left'))
            xAlign = effectiveAlign(Clutter.ActorAlign.START);
        else if (position.endsWith('right'))
            xAlign = effectiveAlign(Clutter.ActorAlign.END);
        else
            xAlign = Clutter.ActorAlign.CENTER;

        if (position.startsWith('top'))
            yAlign = Clutter.ActorAlign.START;
        else if (position.startsWith('bottom'))
            yAlign = Clutter.ActorAlign.END;
        else
            yAlign = Clutter.ActorAlign.CENTER;

        return [xAlign, yAlign];
    }
});

const BackgroundLogo = GObject.registerClass(
class BackgroundLogo extends St.Widget {
    constructor(backgroundActor, settings, cache) {
        super({
            x_expand: true,
            y_expand: true,
            opacity: 0,
        });

        this._backgroundActor = backgroundActor;
        this._monitorIndex = this._backgroundActor.monitor;

        this._logoCache = cache;
        this._logoFile = null;

        this._bin = new IconContainer();
        this.add_child(this._bin);
        this._bin.connect('resource-scale-changed',
            this._updateLogoTexture.bind(this));

        this.layout_manager =
            new BackgroundLogoLayout(this._bin, settings, this._monitorIndex);

        this._settings = settings;
        this._ifaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });

        this._settings.connectObject(
            'changed::logo-file', () => this._updateLogo(),
            'changed::logo-file-dark', () => this._updateLogo(),
            'changed::logo-opacity', () => this._updateOpacity(),
            'changed::logo-always-visible', () => this._updateVisibility(),
            this);

        this._logoCache.connectObject('texture-file-changed', (c, file) => {
            if (this._logoFile?.equal(file))
                this._updateLogoTexture();
        }, this);

        this._backgroundActor.layout_manager = new Clutter.BinLayout();
        this._backgroundActor.add_child(this);

        this.connect('destroy', this._onDestroy.bind(this));

        this._backgroundActor.content.connectObject(
            'notify::brightness', () => this._updateOpacity(),
            this);

        this._updateLogo();
        this._updateOpacity();
        this._updateVisibility();
    }

    _updateLogo() {
        const colorScheme = this._ifaceSettings.get_string('color-scheme');
        const fileKey = colorScheme === 'prefer-dark'
            ? 'logo-file-dark'
            : 'logo-file';
        const filename = this._settings.get_string(fileKey);
        let file = Gio.File.new_for_commandline_arg(filename);
        if (this._logoFile && this._logoFile.equal(file))
            return;

        this._logoFile = file;

        this._updateLogoTexture();
    }

    _updateOpacity() {
        const brightness = this._backgroundActor.content.vignette
            ? this._backgroundActor.content.brightness : 1.0;
        this._bin.opacity =
            this._settings.get_uint('logo-opacity') * brightness;
    }

    _updateLogoTexture() {
        if (this._icon)
            this._icon.destroy();
        this._icon = null;

        let key = this._settings.settings_schema.get_key('logo-size');
        let [, range] = key.get_range().deep_unpack();
        let [, max] = range.deep_unpack();
        let width = this.layout_manager.getMonitorRelativeWidth(max);

        const resourceScale = this._bin.get_resource_scale();
        this._icon = this._logoCache.loadFile(this._logoFile, width, resourceScale);
        this._bin.add_child(this._icon);
    }

    _updateVisibility() {
        const {background} = this._backgroundActor.content;
        const colorScheme = this._ifaceSettings.get_string('color-scheme');
        const uriKey = colorScheme === 'prefer-dark'
            ? 'picture-uri-dark'
            : 'picture-uri';
        const defaultUri = background._settings.get_default_value(uriKey);
        let file = Gio.File.new_for_commandline_arg(defaultUri.deep_unpack());

        let visible;
        if (this._settings.get_boolean('logo-always-visible'))
            visible = true;
        else if (background._file)
            visible = background._file.equal(file);
        else // background == NONE
            visible = false;

        this.ease({
            opacity: visible ? 255 : 0,
            duration: Background.FADE_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _onDestroy() {
        this._backgroundActor.layout_manager = null;
        this._settings = null;

        this._logoFile = null;
    }
});

class LogoTextureCache extends EventEmitter {
    #textures = new Map();
    #textureCache;

    loadFile(file, width, resourceScale) {
        const themeContext = St.ThemeContext.get_for_stage(global.stage);
        const paintScale = themeContext.scale_factor;
        const scale = Math.ceil(paintScale * resourceScale);
        const key = `file:${file.hash()}:${scale}:${width}`;

        let content = this.#textures.get(key);
        if (content) {
            return new Clutter.Actor({
                request_mode: Clutter.RequestMode.CONTENT_SIZE,
                content,
            });
        }

        this.#ensureCache();

        const actor = this.#textureCache.load_file_async(file,
            width, -1,
            paintScale, resourceScale);

        actor.connectObject('notify::content', () => {
            actor.disconnectObject(this);
            this.#textures.set(key, actor.content);
        }, this);

        return actor;
    }

    clear() {
        this.#textureCache.disconnectObject(this);
        this.#textureCache = null;

        this.#textures.clear();
    }

    #ensureCache() {
        if (this.#textureCache)
            return;

        this.#textureCache = St.TextureCache.get_default();
        this.#textureCache.connectObject('texture-file-changed',
            (cache, file) => {
                const prefix = `file:${file.hash()}`;
                if (this.#removeTextures(prefix))
                    this.emit('texture-file-changed', file);
            }, this);
    }

    #removeTextures(prefix) {
        let deleted = false;

        for (const [key] of this.#textures) {
            if (key.startsWith(prefix))
                deleted = this.#textures.delete(key);
        }

        return deleted;
    }
}

export default class BackgroundLogoExtension extends Extension {
    _reloadBackgrounds() {
        Main.layoutManager._updateBackgrounds();
    }

    enable() {
        const bgMgrProto = Background.BackgroundManager.prototype;

        const cache = new LogoTextureCache();
        this._logoCache = cache;

        this._injectionManager = new InjectionManager();
        this._injectionManager.overrideMethod(bgMgrProto, '_createBackgroundActor', originalMethod => {
            const settings = this.getSettings();
            /* eslint-disable no-invalid-this */
            return function () {
                const backgroundActor = originalMethod.call(this);
                const logo_ = new BackgroundLogo(backgroundActor, settings, cache);

                return backgroundActor;
            };
            /* eslint-enable */
        });
        this._reloadBackgrounds();
    }

    disable() {
        this._injectionManager.clear();
        this._injectionManager = null;

        this._logoCache.clear();
        this._logoCache = null;

        this._reloadBackgrounds();
    }
}
