const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// imports.gi
const Clutter                     = imports.gi.Clutter
const GLib                        = imports.gi.GLib
const { ShadowMode, WindowType }  = imports.gi.Meta
const { WindowClientType }        = imports.gi.Meta
const { Bin }                     = imports.gi.St
const { BindingFlags }            = imports.gi.GObject
const { ThemeContext }            = imports.gi.St

// local modules
const UI                          = Me.imports.utils.ui
const { _log }                    = Me.imports.utils.log
const { constants }               = Me.imports.utils.constants
const { ClipShadowEffect }        = Me.imports.effect.clip_shadow_effect
const types                       = Me.imports.utils.types
const { settings }                = Me.imports.utils.settings
const { RoundedCornersEffect }    = Me.imports.effect.rounded_corners_effect


// --------------------------------------------------------------- [end imports]

var RoundedCornersManager = class RoundedCornersManager {
  constructor () {
    this.enabled = true

    /** Rounded corners settings */
    this.global_rounded_corners = settings ().global_rounded_corner_settings
    this.custom_rounded_corners = settings ().custom_rounded_corner_settings
  }

  // ---------------------------------------------------------- [public methods]

  on_add_effect (actor) {
    _log ('opened: ' + actor?.meta_window.title + ': ' + actor)

    const win = actor.meta_window

    // If application failed check, then just return.
    if (!this._should_enable_effect (win)) {
      return
    }

    // Add rounded corners shader to window
    this._actor_to_rounded (actor)?.add_effect_with_name (
      constants.ROUNDED_CORNERS_EFFECT,
      new RoundedCornersEffect ()
    )

    // Turn off original shadow for ssd x11 window.
    // - For ssd client in X11, shadow is drew by window manager
    // - For csd client, shadow is drew by application itself, it has been cut
    //   out by rounded corners effect
    if (actor.shadow_mode !== undefined) {
      actor.shadow_mode = ShadowMode.FORCED_OFF
    }
    // So we have to create an shadow actor for rounded corners shadows
    const shadow = this._create_shadow (actor)
    // Bind properties between shadow and window
    const flag = BindingFlags.SYNC_CREATE
    for (const prop of [
      'pivot-point',
      'translation-x',
      'translation-y',
      'scale-x',
      'scale-y',
    ]) {
      actor.bind_property (prop, shadow, prop, flag)
    }
    // Store visible binding so that we can control the visible of shadow
    // in some time.
    const prop = 'visible'
    const visible_binding = actor.bind_property (prop, shadow, prop, flag)

    // Store shadow, app type, visible binding, so that we can query them later
    actor.__rwc_rounded_window_info = {
      shadow,
      visible_binding,
      unminimized_timeout_id: 0,
    }
  }

  on_remove_effect (actor) {
    // Remove rounded corners effect
    const name = constants.ROUNDED_CORNERS_EFFECT
    this._actor_to_rounded (actor)?.remove_effect_by_name (name)

    // Restore shadow for x11 windows
    if (actor.shadow_mode) {
      actor.shadow_mode = ShadowMode.AUTO
    }

    // Remove shadow actor
    const shadow = actor.__rwc_rounded_window_info?.shadow
    if (shadow) {
      global.window_group.remove_child (shadow)
      shadow.clear_effects ()
      shadow.destroy ()
    }

    // Remove all timeout handler
    const timeout_id = actor.__rwc_rounded_window_info?.unminimized_timeout_id
    if (timeout_id) GLib.source_remove (timeout_id)
    delete actor.__rwc_rounded_window_info
  }

  on_minimize (actor) {
    const info = actor.__rwc_rounded_window_info
    const binding = info?.visible_binding
    const shadow = info?.shadow
    if (shadow && binding) {
      binding.unbind ()
      shadow.visible = false
    }
  }

  on_unminimize (actor) {
    this._restore_shadow (actor)

    // Requeue layout after 300ms
    if (actor.first_child && actor.__rwc_rounded_window_info) {
      const info = actor.__rwc_rounded_window_info

      // Clear prev handler
      let id = info.unminimized_timeout_id
      if (id) GLib.source_remove (id)
      id = GLib.timeout_add (GLib.PRIORITY_DEFAULT, 300, () => {
        actor.first_child.queue_relayout ()
        return false
      })

      // update handler, it will be clear when window is closed
      info.unminimized_timeout_id = id
    }
  }

  on_switch_workspace (actor) {
    this._restore_shadow (actor)
  }

  on_restacked (actor) {
    // When windows restacked, change order of shadow actor too
    if (!actor.visible) {
      return
    }
    const shadow = actor.__rwc_rounded_window_info?.shadow
    if (shadow) {
      global.window_group.set_child_below_sibling (shadow, actor)
    }
  }

  on_size_changed (actor) {
    const win = actor.meta_window

    const window_info = actor.__rwc_rounded_window_info
    // Get rounded corners effect from window actor
    const effect = this._actor_to_rounded (actor)?.get_effect (
      constants.ROUNDED_CORNERS_EFFECT
    )
    if (!effect || !window_info) {
      return
    }

    // Skip rounded corners when window is fullscreen & maximize
    const cfg = this._get_rounded_corners_cfg (win)
    const should_rounded = UI.ShouldHasRoundedCorners (win, cfg)

    if (!should_rounded && effect.enabled) {
      _log ('Disable rounded corners effect for maximized window', win.title)
      effect.enabled = false
      this.on_focus_changed (actor)
      return
    }
    // Restore Rounded effect when un-maximized
    if (should_rounded && !effect.enabled) {
      _log ('Restore rounded effect for maximized window', win.title)
      effect.enabled = true
      this.on_focus_changed (actor)
    }

    // Cache the offset, so that we can calculate this value once
    const content_offset_of_win = UI.computeWindowContentsOffset (win)

    // When size changed. update uniforms for window
    effect.update_uniforms (
      UI.WindowScaleFactor (win),
      cfg,
      this._compute_bounds (actor, content_offset_of_win),
      {
        width: settings ().border_width,
        color: settings ().border_color,
      }
    )

    // Update BindConstraint for shadow
    const shadow = window_info.shadow
    const offsets = this._compute_shadow_actor_offset (
      actor,
      content_offset_of_win
    )
    const constraints = shadow.get_constraints ()
    constraints.forEach ((constraint, i) => {
      if (constraint instanceof Clutter.BindConstraint) {
        constraint.offset = offsets[i]
      }
    })
  }

  on_focus_changed (actor) {
    const win = actor.meta_window
    const shadow = actor.__rwc_rounded_window_info?.shadow
    if (!shadow) {
      return
    }

    const shadow_settings = win.appears_focused
      ? settings ().focused_shadow
      : settings ().unfocused_shadow

    const { border_radius, padding } = this._get_rounded_corners_cfg (win)

    this._update_shadow_actor_style (
      win,
      shadow,
      border_radius,
      shadow_settings,
      padding
    )
  }

  on_settings_changed (key) {
    switch (key) {
    case 'skip-libadwaita-app':
    case 'skip-libhandy-app':
    case 'black-list':
      this._update_all_window_effect_state ()
      break
    case 'focused-shadow':
    case 'unfocused-shadow':
      this._update_all_shadow_actor_style ()
      break
    case 'global-rounded-corner-settings':
    case 'custom-rounded-corner-settings':
    case 'border-color':
    case 'border-width':
    case 'tweak-kitty-terminal':
      this._update_all_rounded_corners_settings ()
      break
    default:
    }
  }

  // --------------------------------------------------------- [private methods]

  _restore_shadow (actor) {
    const info = actor.__rwc_rounded_window_info
    if (!info) {
      return
    }
    const prop = 'visible'
    const flag = BindingFlags.SYNC_CREATE
    info.visible_binding = actor.bind_property (prop, info.shadow, prop, flag)
  }

  /**
   * Check whether a window should be enable rounded corners effect
   * @param win Meta.Window to test
   */
  _should_enable_effect (win) {
    // DING (Desktop Icons NG) is a extensions that create a gtk
    // application to show desktop grid on background, we need to
    // skip it coercively.
    // https://extensions.gnome.org/extension/2087/desktop-icons-ng-ding/
    if (win.gtk_application_id === 'com.rastersoft.ding') {
      return false
    }

    // Skip applications in black list.
    const wm_class_instance = win.get_wm_class_instance ()
    if (wm_class_instance == null) {
      _log (`Warning: wm_class_instance of ${win}: ${win.title} is null`)
      return false
    }
    if (settings ().black_list.includes (wm_class_instance)) {
      return false
    }

    // Check type of window, only need to add rounded corners to normal
    // window and dialog.
    const normal_type = [
      WindowType.NORMAL,
      WindowType.DIALOG,
      WindowType.MODAL_DIALOG,
    ].includes (win.window_type)
    if (!normal_type) {
      return false
    }

    // Skip libhandy / libadwaita applications according the settings.
    const { AppType, getAppType } = UI
    const app_type = win.__app_type ?? getAppType (win)
    win.__app_type = app_type // cache result
    _log ('Check Type of window:' + `${win.title} => ${AppType[app_type]}`)

    if (settings ().skip_libadwaita_app && app_type === AppType.LibAdwaita) {
      return false
    }
    if (settings ().skip_libhandy_app && app_type === AppType.LibHandy) {
      return false
    }

    return true
  }

  /**
   * return Clutter.Actor that should be add rounded corners,
   * In Wayland, we will add rounded corners effect to WindowActor
   * In XOrg, we will add rounded corners effect to WindowActor.first_child
   */
  _actor_to_rounded (actor) {
    const type = actor.meta_window.get_client_type ()
    return type == WindowClientType.X11 ? actor.get_first_child () : actor
  }

  /**
   * Create Shadow for rounded corners window
   * @param actor -  window actor which has been setup rounded corners effect
   */
  _create_shadow (actor) {
    const shadow = new Bin ({
      name: 'Shadow Actor',
      child: new Bin ({
        x_expand: true,
        y_expand: true,
      }),
    })
    shadow.first_child.add_style_class_name ('shadow')

    this._update_shadow_actor_style (
      actor.meta_window,
      shadow,
      this.global_rounded_corners?.border_radius,
      actor.meta_window.appears_focused
        ? settings ().focused_shadow
        : settings ().unfocused_shadow
    )

    // We have to clip the shadow because of this issues:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4474
    shadow.add_effect_with_name (
      constants.CLIP_SHADOW_EFFECT,
      new ClipShadowEffect ()
    )

    // Insert shadow actor below window actor, now shadow actor
    // will show below window actor
    global.window_group.insert_child_below (shadow, actor)

    // Bind position and size between window and shadow
    for (let i = 0; i < 4; i++) {
      const constraint = new Clutter.BindConstraint ({
        source: actor,
        coordinate: i,
        offset: 0,
      })
      shadow.add_constraint (constraint)
    }

    // Return the shadow we create, it will be store into
    // this.rounded_windows
    return shadow
  }

  /** Compute outer bound of rounded corners for window actor */
  _compute_bounds (actor, [x, y, width, height]) {
    const bounds = {
      x1: x + 1,
      y1: y + 1,
      x2: x + actor.width + width,
      y2: y + actor.height + height,
    }

    // Kitty draw it's window decoration by itself, we need recompute the
    // outer bounds for kitty.
    if (settings ().tweak_kitty_terminal) {
      const type = WindowClientType.WAYLAND
      if (
        actor.meta_window.get_client_type () == type &&
        actor.meta_window.get_wm_class_instance () === 'kitty'
      ) {
        const scale = UI.WindowScaleFactor (actor.meta_window)
        bounds.x1 += 11 * scale /* shadow in left   of kitty */
        bounds.y1 += 35 * scale /* shadow in top    of kitty */
        bounds.x2 -= 11 * scale /* shadow in right  of kitty */
        bounds.y2 -= 11 * scale /* shadow in bottom of kitty */
      }
    }

    return bounds
  }

  _compute_shadow_actor_offset (
    actor,
    [offset_x, offset_y, offset_width, offset_height]
  ) {
    const win = actor.meta_window
    const shadow_padding = constants.SHADOW_PADDING * UI.WindowScaleFactor (win)

    // If remove UI.scaleFactor(), it should can be works if
    // experimental-features of mutter  'scale-monitor-framebuffer' enabled
    // (Fractional scaling in Wayland)
    // const shadow_padding = constants.SHADOW_PADDING * UI.scaleFactor ()
    return [
      offset_x - shadow_padding,
      offset_y - shadow_padding,
      2 * shadow_padding + offset_width,
      2 * shadow_padding + offset_height,
    ]
  }

  /** Update css style of shadow actor */
  _update_shadow_actor_style (
    win,
    actor,
    border_radius = this.global_rounded_corners?.border_radius,
    shadow = settings ().focused_shadow,
    padding = this.global_rounded_corners?.padding
  ) {
    if (!border_radius || !padding) {
      return
    }
    const { left, right, top, bottom } = padding

    // Increasing border_radius when smoothing is on
    if (this.global_rounded_corners !== null) {
      border_radius *= 1.0 + this.global_rounded_corners.smoothing
    }

    // Sadly, the scale of style of St.Widget may be different between scale
    // of window if there are two monitor with different scale factor.
    // - Scale of Style always as same as primary monitor
    // - Scale of window as same as the monitor window located.
    //
    // So, we have to adjustment this different

    const original_scale = ThemeContext.get_for_stage (global.stage).scale_factor
    const win_scale = UI.WindowScaleFactor (win)

    // Now scale factor for shadow actor should be correct.
    const scale_of_style = win_scale / original_scale

    // _log (JSON.stringify ({ original_scale, win_scale }))

    actor.style = `padding: ${constants.SHADOW_PADDING * scale_of_style}px
        /*background: yellow*/;`

    const child = actor.first_child

    if (
      win.maximized_horizontally ||
      win.maximized_vertically ||
      win.fullscreen
    ) {
      child.style = 'opacity: 0;'
    } else {
      child.style = `
        background: white;
        border-radius: ${border_radius * scale_of_style}px;
        ${types.box_shadow_css (shadow, scale_of_style)};
        margin: ${top * scale_of_style}px
                ${right * scale_of_style}px
                ${bottom * scale_of_style}px
                ${left * scale_of_style}px;`
    }

    child.queue_redraw ()
  }

  /** Traversal all windows, add or remove rounded corners for them */
  _update_all_window_effect_state () {
    global.get_window_actors ().forEach ((actor) => {
      const should_have_effect = this._should_enable_effect (actor.meta_window)
      const has_effect = UI.get_rounded_corners_effect (actor) != null

      if (should_have_effect && !has_effect) {
        this.on_add_effect (actor)
        this.on_size_changed (actor)
        return
      }

      if (!should_have_effect && has_effect) {
        this.on_remove_effect (actor)
        return
      }
    })
  }

  /** Update style for all shadow actors */
  _update_all_shadow_actor_style () {
    for (const actor of global.get_window_actors ()) {
      const info = actor.__rwc_rounded_window_info
      if (!info) {
        continue
      }
      const { shadow } = info
      const win = actor.meta_window
      const shadow_cfg = actor.meta_window.appears_focused
        ? settings ().focused_shadow
        : settings ().unfocused_shadow
      const { border_radius, padding } = this._get_rounded_corners_cfg (
        actor.meta_window
      )

      this._update_shadow_actor_style (
        win,
        shadow,
        border_radius,
        shadow_cfg,
        padding
      )
    }
  }

  _get_rounded_corners_cfg (win) {
    return UI.ChoiceRoundedCornersCfg (
      this.global_rounded_corners ?? settings ().global_rounded_corner_settings,
      this.custom_rounded_corners ?? settings ().custom_rounded_corner_settings,
      win
    )
  }

  /**
   * This method will be called when global rounded corners settings changed.
   */
  _update_all_rounded_corners_settings () {
    this.global_rounded_corners = settings ().global_rounded_corner_settings
    this.custom_rounded_corners = settings ().custom_rounded_corner_settings

    for (const actor of global.get_window_actors ()) {
      const info = actor.__rwc_rounded_window_info
      if (!info) {
        continue
      }
      this.on_size_changed (actor)
    }

    this._update_all_shadow_actor_style ()
  }
}
