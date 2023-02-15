const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { PipelineFilter }           = imports.gi.Cogl
const { registerClass }            = imports.gi.GObject
const { GLSLEffect, SnippetHook }  = imports.gi.Shell

var LinearFilterEffect = registerClass (
  {},
  class extends GLSLEffect {
    vfunc_build_pipeline () {
      this.add_glsl_snippet (SnippetHook.FRAGMENT, '', '', false)
    }

    vfunc_paint_target (node, ctx) {
      this.get_pipeline ()?.set_layer_filters (
        0,
        PipelineFilter.LINEAR_MIPMAP_LINEAR,
        PipelineFilter.NEAREST
      )
      super.vfunc_paint_target (node, ctx)
    }
  }
)
