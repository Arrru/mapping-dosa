extends Node

signal scene_completed(scene_id: String)
signal choice_made(option_text: String, next_scene: String)

@onready var background: TextureRect = get_node_or_null("Background")
@onready var char_left: TextureRect = get_node_or_null("Characters/CharLeft")
@onready var char_center: TextureRect = get_node_or_null("Characters/CharCenter")
@onready var char_right: TextureRect = get_node_or_null("Characters/CharRight")
@onready var dialogue_box = get_node_or_null("DialogueBox")
@onready var speaker_label: Label = get_node_or_null("DialogueBox/SpeakerLabel")
@onready var dialogue_text: RichTextLabel = get_node_or_null("DialogueBox/DialogueText")
@onready var choice_container: VBoxContainer = get_node_or_null("ChoiceContainer")
@onready var audio_bgm: AudioStreamPlayer = get_node_or_null("AudioBGM")
@onready var audio_sfx: AudioStreamPlayer = get_node_or_null("AudioSFX")

var _events: Array = []
var _index: int = 0
var _scene_id: String = ""
var _waiting_for_input: bool = false
var _waiting_for_choice: bool = false
var _typewriter_active: bool = false


func load_scene(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("NovelPlayer: cannot open %s" % path)
		return
	var text := file.get_as_text()
	file.close()

	var parsed := JSON.parse_string(text)
	if parsed == null or not parsed is Dictionary:
		push_error("NovelPlayer: invalid JSON in %s" % path)
		return

	_scene_id = parsed.get("scene_id", "")
	_events = parsed.get("events", [])
	_index = 0


func start() -> void:
	_index = 0
	_waiting_for_input = false
	_waiting_for_choice = false
	if _events.is_empty():
		scene_completed.emit(_scene_id)
		return
	_process_current()


func advance() -> void:
	if _waiting_for_choice:
		return
	if _typewriter_active:
		# Skip typewriter — show full text immediately
		_typewriter_active = false
		return
	if not _waiting_for_input:
		return
	_waiting_for_input = false
	_index += 1
	_process_current()


func _process_current() -> void:
	if _index >= _events.size():
		scene_completed.emit(_scene_id)
		return

	var event: Dictionary = _events[_index]
	process_event(event)


func process_event(event: Dictionary) -> void:
	match event.get("type", ""):
		"background":
			handle_background(event)
			_index += 1
			_process_current()
		"bgm_play":
			handle_bgm_play(event)
			_index += 1
			_process_current()
		"bgm_stop":
			handle_bgm_stop(event)
			_index += 1
			_process_current()
		"sfx_play":
			handle_sfx_play(event)
			_index += 1
			_process_current()
		"character_show":
			handle_character_show(event)
			_index += 1
			_process_current()
		"character_hide":
			handle_character_hide(event)
			_index += 1
			_process_current()
		"expression_change":
			handle_expression_change(event)
			_index += 1
			_process_current()
		"dialogue":
			handle_dialogue(event)
			# Waits for advance() — do not auto-advance
		"choice":
			handle_choice(event)
			# Waits for on_choice_selected() — do not auto-advance
		_:
			push_warning("NovelPlayer: unknown event type '%s'" % event.get("type", ""))
			_index += 1
			_process_current()


func handle_background(event: Dictionary) -> void:
	if background == null:
		return
	var tex := _load_texture(event.get("path", ""))
	if tex:
		background.texture = tex


func handle_bgm_play(event: Dictionary) -> void:
	if audio_bgm == null:
		return
	var stream := _load_audio(event.get("path", ""))
	if stream == null:
		return
	audio_bgm.stream = stream
	if stream is AudioStreamMP3 or stream is AudioStreamOggVorbis:
		stream.loop = event.get("loop", false)
	audio_bgm.play()


func handle_bgm_stop(_event: Dictionary) -> void:
	if audio_bgm:
		audio_bgm.stop()


func handle_sfx_play(event: Dictionary) -> void:
	if audio_sfx == null:
		return
	var stream := _load_audio(event.get("path", ""))
	if stream:
		audio_sfx.stream = stream
		audio_sfx.play()


func handle_character_show(event: Dictionary) -> void:
	var node := _get_char_node(event.get("position", "center"))
	if node == null:
		return
	var tex := _load_texture(event.get("path", ""))
	if tex:
		node.texture = tex
	node.modulate.a = 0.0
	node.show()
	var tween := create_tween()
	tween.tween_property(node, "modulate:a", 1.0, 0.3)


func handle_character_hide(event: Dictionary) -> void:
	# Find by character_id across all positions
	var char_id: String = event.get("character_id", "")
	for node in [char_left, char_center, char_right]:
		if node == null or not node.visible:
			continue
		var tween := create_tween()
		tween.tween_property(node, "modulate:a", 0.0, 0.3)
		tween.tween_callback(node.hide)


func handle_expression_change(event: Dictionary) -> void:
	# Determine which node holds this character by checking visible nodes
	# Falls back to changing all visible character nodes if ambiguous
	var char_id: String = event.get("character_id", "")
	var tex := _load_texture(event.get("path", ""))
	if tex == null:
		return
	for node in [char_left, char_center, char_right]:
		if node != null and node.visible:
			node.texture = tex
			break


func handle_dialogue(event: Dictionary) -> void:
	if dialogue_box:
		dialogue_box.show()
	if speaker_label:
		speaker_label.text = event.get("speaker", "")
	if dialogue_text:
		_waiting_for_input = true
		_typewriter_active = true
		typewriter_effect(dialogue_text, event.get("text", ""))


func handle_choice(event: Dictionary) -> void:
	if dialogue_box:
		dialogue_box.show()
	if dialogue_text:
		dialogue_text.text = event.get("prompt", "")
	if speaker_label:
		speaker_label.text = ""

	if choice_container == null:
		return

	# Clear previous buttons
	for child in choice_container.get_children():
		child.queue_free()

	choice_container.show()
	_waiting_for_choice = true

	var options: Array = event.get("options", [])
	for option in options:
		var btn := Button.new()
		btn.text = option.get("text", "")
		btn.pressed.connect(func(): on_choice_selected(option))
		choice_container.add_child(btn)


func on_choice_selected(option: Dictionary) -> void:
	_waiting_for_choice = false
	if choice_container:
		choice_container.hide()
		for child in choice_container.get_children():
			child.queue_free()

	var next: String = option.get("next_scene", "")
	var var_set = option.get("variable_set", null)

	choice_made.emit(option.get("text", ""), next)

	if var_set != null and Engine.has_singleton("GameState"):
		var gs = Engine.get_singleton("GameState")
		if gs.has_method("set_variable"):
			gs.set_variable(var_set.get("key", ""), var_set.get("value", null))

	if next != "":
		if Engine.has_singleton("SceneRouter"):
			var router = Engine.get_singleton("SceneRouter")
			if router.has_method("go_to_scene"):
				router.go_to_scene(next)
				return
		# Fallback: emit completed and let the parent handle navigation
		scene_completed.emit(_scene_id)
	else:
		_index += 1
		_process_current()


func typewriter_effect(label: RichTextLabel, text: String) -> void:
	label.text = ""
	label.visible_characters = 0
	label.bbcode_enabled = false
	label.text = text

	var length := text.length()
	var i := 0
	while i <= length:
		if not _typewriter_active:
			# Skip was requested — show all at once
			label.visible_characters = -1
			_typewriter_active = false
			_waiting_for_input = true
			return
		label.visible_characters = i
		i += 1
		await get_tree().create_timer(0.03).timeout

	_typewriter_active = false
	_waiting_for_input = true


func _get_char_node(position: String) -> TextureRect:
	match position:
		"left":   return char_left
		"right":  return char_right
		_:        return char_center


func _load_texture(path: String) -> Texture2D:
	if path == "":
		return null
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	push_warning("NovelPlayer: texture not found: %s" % path)
	return null


func _load_audio(path: String) -> AudioStream:
	if path == "":
		return null
	if ResourceLoader.exists(path):
		return load(path) as AudioStream
	push_warning("NovelPlayer: audio not found: %s" % path)
	return null


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_select"):
		advance()
