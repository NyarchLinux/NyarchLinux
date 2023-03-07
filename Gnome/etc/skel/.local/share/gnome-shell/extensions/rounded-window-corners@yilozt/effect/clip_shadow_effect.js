const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const GObject                      = imports.gi.GObject
const { SnippetHook, GLSLEffect }  = imports.gi.Shell

// local modules
const { loadShader }               = Me.imports.utils.io

// types


// ------------------------------------------------------------------- [imports]

const { declarations, code } = loadShader (
  `${Me.path}/effect/shader/clip_shadow.frag`
)

var ClipShadowEffect = GObject.registerClass (
  {},
  class extends GLSLEffect {
    vfunc_build_pipeline () {
      const hook = SnippetHook.FRAGMENT
      this.add_glsl_snippet (hook, declarations, code, false)
    }

    vfunc_paint_target (node, ctx) {
      // Reset to default blend string.
      this.get_pipeline ()?.set_blend (
        'RGBA = ADD(SRC_COLOR, DST_COLOR*(1-SRC_COLOR[A]))'
      )
      super.vfunc_paint_target (node, ctx)
    }
  }
)
