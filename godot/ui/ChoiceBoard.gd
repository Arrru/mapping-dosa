## ChoiceBoard — Visual Novel choice board UI
## Usage:
##   var board := ChoiceBoard.new()
##   add_child(board)                            # _ready() builds node structure
##   board.setup(event.options, bg_tex, icon_tex)
##   board.choice_confirmed.connect(_on_board_confirmed)
class_name ChoiceBoard
extends Control

## Emitted when a choice is confirmed. Passes the full option dict so
## the caller can read next_scene, variable_set, etc.
signal choice_confirmed(option: Dictionary)

const _COLOR_NORMAL := Color(0.85, 0.85, 0.85)
const _COLOR_ACTIVE := Color(0.0,  1.0,  1.0)   # Cyan

var _bg:   NinePatchRect
var _vbox: VBoxContainer
var _icon_tex: Texture2D

func _ready() -> void:
	# Position: center-horizontal, slightly below vertical center
	set_anchor(SIDE_LEFT,   0.5)
	set_anchor(SIDE_RIGHT,  0.5)
	set_anchor(SIDE_TOP,    0.55)
	set_anchor(SIDE_BOTTOM, 0.55)
	set_offset(SIDE_LEFT,   -280.0)
	set_offset(SIDE_RIGHT,   280.0)
	set_offset(SIDE_TOP,    -160.0)
	set_offset(SIDE_BOTTOM,  160.0)

	_bg = NinePatchRect.new()
	_bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# NinePatch margins — adjust to match your background artwork
	_bg.patch_margin_left   = 32
	_bg.patch_margin_right  = 32
	_bg.patch_margin_top    = 32
	_bg.patch_margin_bottom = 32
	add_child(_bg)

	_vbox = VBoxContainer.new()
	_vbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	_vbox.add_theme_constant_override("separation", 16)
	_bg.add_child(_vbox)

## Call after add_child(). Populates the board with choices.
## bg_texture  : NinePatchRect background (nil → semi-transparent fallback)
## icon_texture: arrow/play icon shown left of focused choice (nil → no icon)
func setup(options: Array, bg_texture: Texture2D = null, icon_texture: Texture2D = null) -> void:
	_icon_tex = icon_texture

	if bg_texture:
		_bg.texture = bg_texture
	else:
		# Fallback: dark semi-transparent panel via a StyleBoxFlat on the bg node
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.05, 0.07, 0.12, 0.92)
		sb.corner_radius_top_left     = 8
		sb.corner_radius_top_right    = 8
		sb.corner_radius_bottom_left  = 8
		sb.corner_radius_bottom_right = 8
		_bg.add_theme_stylebox_override("panel", sb)

	for child in _vbox.get_children():
		child.queue_free()
	await get_tree().process_frame

	for i in options.size():
		_vbox.add_child(_build_item(i, options[i]))

	# Grab focus on first button so keyboard/pad works immediately
	var first_btn := _vbox.get_child(0).get_node_or_null("Btn") as Button
	if first_btn:
		first_btn.grab_focus()

# ── Item builder ──────────────────────────────────────────────────────────────

func _build_item(idx: int, option: Dictionary) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER

	# Select icon — visible only when hovered / focused
	var icon := TextureRect.new()
	icon.name = "Icon"
	icon.texture = _icon_tex
	icon.custom_minimum_size = Vector2(24, 24)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.visible = false
	row.add_child(icon)

	# Per-option image (optional)
	var img_path: String = option.get("image_path", "")
	if img_path != "" and ResourceLoader.exists(img_path):
		var opt_img := TextureRect.new()
		opt_img.texture = load(img_path)
		opt_img.custom_minimum_size = Vector2(64, 44)
		opt_img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		opt_img.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
		row.add_child(opt_img)

	# Choice button — flat (no background), themed text only
	var btn := Button.new()
	btn.name = "Btn"
	btn.text = option.get("text", "")
	btn.flat = true
	btn.focus_mode = Control.FOCUS_ALL
	btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn.alignment = HORIZONTAL_ALIGNMENT_CENTER
	btn.add_theme_font_size_override("font_size", 18)
	btn.add_theme_color_override("font_color", _COLOR_NORMAL)
	row.add_child(btn)

	# Track hover independently so focus_exited doesn't clear while still hovered
	var _hovered := false

	btn.mouse_entered.connect(func():
		_hovered = true
		_activate(btn, icon))
	btn.mouse_exited.connect(func():
		_hovered = false
		if not btn.has_focus():
			_deactivate(btn, icon))
	btn.focus_entered.connect(func():
		_activate(btn, icon))
	btn.focus_exited.connect(func():
		if not _hovered:
			_deactivate(btn, icon))
	btn.pressed.connect(func():
		_on_pressed(idx, option))

	return row

# ── State helpers ─────────────────────────────────────────────────────────────

func _activate(btn: Button, icon: TextureRect) -> void:
	btn.add_theme_color_override("font_color", _COLOR_ACTIVE)
	# Show icon only if a texture is actually assigned
	icon.visible = icon.texture != null

func _deactivate(btn: Button, icon: TextureRect) -> void:
	btn.add_theme_color_override("font_color", _COLOR_NORMAL)
	icon.visible = false

func _on_pressed(idx: int, option: Dictionary) -> void:
	print("[ChoiceBoard] 선택: [%d] %s → %s" % [
		idx,
		option.get("text", ""),
		option.get("next_scene", "")
	])
	choice_confirmed.emit(option)
	queue_free()
