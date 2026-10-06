//////////////////////////////////////////////////////////////////////////////////////////
//             ,-.  ,--.  ,-.  ,  , ,---.  ,-.  ;-.     ,-. .  . ,-.  ,--.              //
//             |  \ |    (   ` | /    |   /   \ |  )   /    |  | |  ) |                 //
//             |  | |-    `-.  |<     |   |   | |-'    |    |  | |-<  |-                //
//             |  / |    .   ) | \    |   \   / |      \    |  | |  ) |                 //
//             `-'  `--'  `-'  '  `   '    `-'  '       `-' `--` `-'  `--'              //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import GdkPixbuf from 'gi://GdkPixbuf';
import Cogl from 'gi://Cogl';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as utils from './utils.js';

//////////////////////////////////////////////////////////////////////////////////////////
// This file contains two classes, the Skybox (which is an actor) and the SkyboxEffect, //
// which is applied to the Skybox actor.                                                //
//                                                                                      //
// SkyboxEffect loads a given texture and interprets it as a 360° panorama in           //
// equirectangular projection. It uses the current perspective of the stage to draw a   //
// perspectively correct portion of this panorama. It has an additional pitch and yaw   //
// parameter controlling the horizontal and vertical rotation of the camera.            //
//                                                                                      //
// Since GNOME 51, Shell.GLSLEffect has been removed from gnome-shell. On newer         //
// versions, we therefore use Clutter.ShaderEffect instead. Unlike Shell.GLSLEffect, it //
// only manages a single Cogl.Snippet automatically (returned by                        //
// vfunc_get_static_snippet()), so we let it handle the fragment shader (which is also  //
// required for its uniform bookkeeping to kick in) and add the vertex shader snippet   //
// to the pipeline ourselves.                                                           //
//////////////////////////////////////////////////////////////////////////////////////////

const _useShaderEffect = !Shell.GLSLEffect;

const _properties = {
  'yaw': GObject.ParamSpec.double('yaw', 'yaw', 'yaw', GObject.ParamFlags.READWRITE,
                                  -2 * Math.PI, 2 * Math.PI, 0),
  'pitch':
    GObject.ParamSpec.double('pitch', 'pitch', 'pitch', GObject.ParamFlags.READWRITE,
                             -0.5 * Math.PI, 0.5 * Math.PI, 0),
};

// In the vertex shader, we compute the view space position of the actor's corners.
const _vertexDeclarations = 'varying vec4 vsPos;';
const _vertexCode         = 'vsPos = cogl_modelview_matrix * cogl_position_in;';

const _fragmentDeclarations = `
  varying vec4      vsPos;
  uniform sampler2D uTexture;
  uniform float     uPitch;
  uniform float     uYaw;

  mat3 getPitch() {
    float s = sin(uPitch);
    float c = cos(uPitch);
    return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
  }

  mat3 getYaw() {
    float s = sin(uYaw);
    float c = cos(uYaw);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }
`;

// The fragment shader uses the interpolated viewspace position to compute a view ray.
// This ray is rotated according to the pitch and yaw values.
const _fragmentCode = `
  // Rotate the view ray.
  vec3 view = getYaw() * getPitch() * normalize(vsPos.xyz);

  // Compute equirectangular projection.
  const float pi = 3.14159265359;
  float x = 0.5 + 0.5 * atan(view.x, -view.z) / pi;
  float y = acos(view.y) / pi;

  cogl_color_out = texture2D(uTexture, vec2(x, y));
`;

// The methods shared by both backends. They are added to the prototype of the class
// below before it is registered with GObject.
const _methods = {
  // Load a texture asynchronously.
  async _loadTexture(file) {
    return new Promise((resolve, reject) => {
      const stream = Gio.File.new_for_path(file).read(null);
      GdkPixbuf.Pixbuf.new_from_stream_async(stream, null, (obj, result) => {
        const FORMATS = [
          Cogl.PixelFormat.G_8,
          Cogl.PixelFormat.RG_88,
          Cogl.PixelFormat.RGB_888,
          Cogl.PixelFormat.RGBA_8888,
        ];

        try {
          const pixbuf = GdkPixbuf.Pixbuf.new_from_stream_finish(result);
          const texture =
            St.ImageContent.new_with_preferred_size(pixbuf.width, pixbuf.height);

          // https://gitlab.gnome.org/GNOME/gnome-shell/-/commit/44b84e458a22046fedb85701ea25ad08ecc0d43f
          if (utils.shellVersionIsAtLeast(48, 'beta')) {
            texture.set_data(global.stage.context.get_backend().get_cogl_context(),
                             pixbuf.get_pixels(), FORMATS[pixbuf.get_n_channels() - 1],
                             pixbuf.width, pixbuf.height, pixbuf.rowstride);
          } else {
            texture.set_data(pixbuf.get_pixels(), FORMATS[pixbuf.get_n_channels() - 1],
                             pixbuf.width, pixbuf.height, pixbuf.rowstride);
          }

          resolve(texture);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
};

let SkyboxEffect;

if (_useShaderEffect) {
  class SkyboxEffectImpl extends Clutter.ShaderEffect {
    _init(file) {
      super._init();

      this._texture          = null;
      this._preparedPipeline = null;

      this._loadTexture(file)
        .then(texture => {
          this._texture = texture;
          this.queue_repaint();
        })
        .catch(error => {
          utils.debug(error);
        });

      this.connect('notify::yaw', () => {this.queue_repaint()});
      this.connect('notify::pitch', () => {this.queue_repaint()});
    }

    // This is called once per class to create the fragment shader snippet which is
    // then shared by all instances of this class. Clutter.ShaderEffect only wires up
    // its automatic uniform handling for this static snippet, so the vertex snippet
    // is added manually in vfunc_paint_target() below.
    vfunc_get_static_snippet() {
      return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, _fragmentDeclarations,
                              _fragmentCode);
    }

    // For each draw call, we have to set some uniform values.
    vfunc_paint_target(node, paintContext) {
      if (this._texture) {
        const pipeline = this.get_pipeline();

        // The vertex snippet is not managed automatically, so add it once per
        // pipeline (a new one may be created e.g. when the actor is resized).
        if (this._preparedPipeline !== pipeline) {
          pipeline.add_snippet(
            Cogl.Snippet.new(Cogl.SnippetHook.VERTEX, _vertexDeclarations, _vertexCode));
          this._preparedPipeline = pipeline;
        }

        pipeline.set_layer_texture(0, this._texture.get_texture());
        pipeline.set_uniform_1i(pipeline.get_uniform_location('uTexture'), 0);
        this.set_uniform_float('uPitch', 1, [this.pitch]);
        this.set_uniform_float('uYaw', 1, [this.yaw]);

        super.vfunc_paint_target(node, paintContext);
      }
    }
  }

  Object.assign(SkyboxEffectImpl.prototype, _methods);
  SkyboxEffect = GObject.registerClass({Properties: _properties}, SkyboxEffectImpl);
} else {
  class SkyboxEffectImpl extends Shell.GLSLEffect {
    _init(file) {
      super._init();

      this._texture = null;

      this._loadTexture(file)
        .then(texture => {
          this._texture = texture;
          this.queue_repaint();
        })
        .catch(error => {
          utils.debug(error);
        });

      this.connect('notify::yaw', () => {this.queue_repaint()});
      this.connect('notify::pitch', () => {this.queue_repaint()});
    }

    // This is called once to setup the Cogl.Pipeline.
    vfunc_build_pipeline() {
      this.add_glsl_snippet(
        Cogl.SnippetHook ? Cogl.SnippetHook.VERTEX : Shell.SnippetHook.VERTEX,
        _vertexDeclarations, _vertexCode, false);

      this.add_glsl_snippet(
        Cogl.SnippetHook ? Cogl.SnippetHook.FRAGMENT : Shell.SnippetHook.FRAGMENT,
        _fragmentDeclarations, _fragmentCode, false);
    }

    // For each draw call, we have to set some uniform values.
    vfunc_paint_target(node, paintContext) {
      if (this._texture) {
        this.get_pipeline().set_layer_texture(0, this._texture.get_texture());
        this.set_uniform_float(this.get_uniform_location('uTexture'), 1, [0]);
        this.set_uniform_float(this.get_uniform_location('uPitch'), 1, [this.pitch]);
        this.set_uniform_float(this.get_uniform_location('uYaw'), 1, [this.yaw]);

        super.vfunc_paint_target(node, paintContext);
      }
    }
  }

  Object.assign(SkyboxEffectImpl.prototype, _methods);
  SkyboxEffect = GObject.registerClass({Properties: _properties}, SkyboxEffectImpl);
}

//////////////////////////////////////////////////////////////////////////////////////////
// The Skybox is a simple actor which applies the above effect to itself. It also has   //
// the pitch and yaw properties - these are directly forwarded to the effect.           //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
export var Skybox = GObject.registerClass({
    Properties: {
      'yaw':   GObject.ParamSpec.double('yaw', 'yaw', 'yaw', GObject.ParamFlags.READWRITE,
                                        -2 * Math.PI, 2 * Math.PI, 0),
      'pitch': GObject.ParamSpec.double('pitch', 'pitch', 'pitch', GObject.ParamFlags.READWRITE,
                                        -0.5 * Math.PI, 0.5 * Math.PI, 0),
    }
  }, class Skybox extends Clutter.Actor {
  // clang-format on
  _init(file) {
    super._init();

    // Apply the effect.
    this._effect = new SkyboxEffect(file);
    this.add_effect(this._effect);

    // Make sure that the overview background is transparent.
    Main.uiGroup.add_style_class_name('desktop-cube-panorama-enabled');

    // Forward the yaw and pitch values.
    this.bind_property('yaw', this._effect, 'yaw', GObject.BindingFlags.NONE);
    this.bind_property('pitch', this._effect, 'pitch', GObject.BindingFlags.NONE);

    // Revert to the original overview background appearance.
    this.connect('destroy', () => {
      Main.uiGroup.remove_style_class_name('desktop-cube-panorama-enabled');
    });
  }
});