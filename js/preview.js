window.PreviewPanel = (() => {
  const EVENT_CONFIGS = {
    background:        { label: '배경 설정',   icon: '🖼',  color: '#4a90d9' },
    bgm_play:          { label: 'BGM 재생',    icon: '🎵',  color: '#7b68ee' },
    bgm_stop:          { label: 'BGM 정지',    icon: '⏹',  color: '#718096' },
    sfx_play:          { label: '효과음',      icon: '🔊',  color: '#48bb78' },
    character_show:    { label: '캐릭터 등장', icon: '👤',  color: '#ed8936' },
    character_hide:    { label: '캐릭터 퇴장', icon: '🚶',  color: '#a0aec0' },
    expression_change: { label: '표정 변경',   icon: '😊',  color: '#f6ad55' },
    dialogue:          { label: '대사',        icon: '💬',  color: '#38b2ac' },
    choice:            { label: '선택지',      icon: '🔀',  color: '#fc8181' },
  };

  let charOptionsPopup = null;

  function init() {
    const container = document.getElementById('preview-container');
    const charsArea = document.getElementById('preview-characters');

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const bg = document.getElementById('preview-background');
      const bgRect = bg.getBoundingClientRect();
      // Drop on background area (below characters, or empty zone)
      const charsRect = charsArea.getBoundingClientRect();
      if (e.clientY < charsRect.top || e.clientY > charsRect.bottom) {
        handleDrop(e, 'background');
      } else {
        handleDrop(e, 'character');
      }
    });

    charsArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    charsArea.addEventListener('drop', (e) => {
      e.preventDefault();
      handleDrop(e, 'character');
    });

    ['left', 'center', 'right'].forEach((pos) => {
      const slot = document.getElementById(`char-${pos}`);
      if (slot) {
        slot.addEventListener('click', () => showCharacterOptions(pos));
      }
    });

    EventBus.on('preview:updated', () => render());
    EventBus.on('timeline:updated', () => render());

    render();
  }

  function render() {
    renderBackground();
    renderCharacters();
    renderDialogue();
  }

  function renderBackground() {
    const bg = document.getElementById('preview-background');
    const asset = AppState.scene.preview.background;
    if (asset && asset.rawUrl) {
      bg.style.backgroundImage = `url('${asset.rawUrl}')`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.removeAttribute('data-empty');
      bg.textContent = '';
    } else {
      bg.style.backgroundImage = '';
      bg.setAttribute('data-empty', '');
      bg.textContent = '배경 이미지를 드래그하세요';
    }
  }

  function renderCharacters() {
    ['left', 'center', 'right'].forEach((pos) => {
      const slot = document.getElementById(`char-${pos}`);
      if (!slot) return;
      slot.innerHTML = '';
      const char = AppState.scene.preview.characters[pos];
      if (char && char.rawUrl) {
        const img = document.createElement('img');
        img.src = char.rawUrl;
        img.alt = char.name || char.character_id || pos;
        img.dataset.characterId = char.character_id || char.id || '';
        img.title = char.name || char.character_id || pos;
        img.style.maxHeight = '100%';
        img.style.maxWidth = '100%';
        img.style.objectFit = 'contain';
        slot.appendChild(img);
        slot.removeAttribute('data-empty');
      } else {
        slot.setAttribute('data-empty', '');
        const placeholder = document.createElement('span');
        placeholder.className = 'char-slot-placeholder';
        placeholder.textContent = pos === 'left' ? '좌' : pos === 'center' ? '중' : '우';
        slot.appendChild(placeholder);
      }
    });
  }

  function renderDialogue() {
    const dialogueBox = document.getElementById('preview-dialogue-box');
    const speakerEl = document.getElementById('preview-speaker-name');
    const textEl = document.getElementById('preview-dialogue-text');
    const choicesEl = document.getElementById('preview-choices');

    const events = AppState.scene.events;
    let lastRelevant = null;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'dialogue' || events[i].type === 'choice') {
        lastRelevant = events[i];
        break;
      }
    }

    choicesEl.innerHTML = '';
    if (!lastRelevant) {
      dialogueBox.style.display = 'none';
      return;
    }

    dialogueBox.style.display = '';

    if (lastRelevant.type === 'dialogue') {
      choicesEl.style.display = 'none';
      textEl.style.display = '';
      speakerEl.textContent = lastRelevant.speaker || '';
      textEl.textContent = lastRelevant.text || '';
    } else if (lastRelevant.type === 'choice') {
      textEl.style.display = 'none';
      speakerEl.textContent = lastRelevant.prompt || '';
      choicesEl.style.display = '';
      const options = lastRelevant.options || [];
      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = opt.text || '(빈 선택지)';
        choicesEl.appendChild(btn);
      });
    }
  }

  function handleDrop(e, targetArea) {
    let asset;
    try {
      asset = JSON.parse(e.dataTransfer.getData('asset'));
    } catch (_) {
      return;
    }
    if (!asset) return;

    if (targetArea === 'background' && asset.type === 'background') {
      applyBackground(asset);
      EventBus.emit('preview:updated');
      EventBus.emit('timeline:updated');
    } else if (targetArea === 'character') {
      const charsArea = document.getElementById('preview-characters');
      const rect = charsArea.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const third = rect.width / 3;
      const position = relX < third ? 'left' : relX < third * 2 ? 'center' : 'right';
      applyCharacter(asset, position);
      EventBus.emit('preview:updated');
      EventBus.emit('timeline:updated');
    }
  }

  function applyBackground(asset) {
    AppState.saveToHistory();
    AppState.scene.preview.background = asset;

    const existing = AppState.scene.events.findIndex((ev) => ev.type === 'background');
    const event = {
      id: Utils.generateId(),
      type: 'background',
      asset_id: asset.id || null,
      path: asset.resPath || '',
    };
    if (existing !== -1) {
      AppState.scene.events[existing] = { ...AppState.scene.events[existing], ...event };
    } else {
      AppState.scene.events.push(event);
    }
    AppState.autosave();
  }

  function applyCharacter(asset, position) {
    AppState.saveToHistory();
    AppState.scene.preview.characters[position] = {
      ...asset,
      position,
      expression: 'normal',
    };
    AppState.scene.events.push({
      id: Utils.generateId(),
      type: 'character_show',
      character_id: asset.id || asset.character_id || null,
      position,
      expression: 'normal',
      path: asset.resPath || '',
    });
    AppState.autosave();
  }

  function showCharacterOptions(position) {
    // Remove any existing popup
    if (charOptionsPopup) {
      charOptionsPopup.remove();
      charOptionsPopup = null;
    }

    const slot = document.getElementById(`char-${position}`);
    const char = AppState.scene.preview.characters[position];

    const popup = document.createElement('div');
    popup.className = 'char-options-popup';
    popup.style.cssText = 'position:absolute;z-index:1000;background:#2d3748;border:1px solid #4a5568;border-radius:6px;padding:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:160px;';

    const slotRect = slot.getBoundingClientRect();
    popup.style.left = slotRect.left + 'px';
    popup.style.top = (slotRect.bottom + 4) + 'px';

    // Position change section
    const posLabel = document.createElement('div');
    posLabel.style.cssText = 'font-size:11px;color:#a0aec0;margin-bottom:4px;';
    posLabel.textContent = '위치 변경';
    popup.appendChild(posLabel);

    const posRow = document.createElement('div');
    posRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';
    ['left', 'center', 'right'].forEach((pos) => {
      const btn = document.createElement('button');
      btn.textContent = pos === 'left' ? '좌' : pos === 'center' ? '중' : '우';
      btn.style.cssText = `flex:1;padding:4px;border:1px solid ${pos === position ? '#4a90d9' : '#4a5568'};background:${pos === position ? '#4a90d9' : 'transparent'};color:#fff;border-radius:4px;cursor:pointer;font-size:12px;`;
      btn.addEventListener('click', () => {
        if (pos !== position && char) {
          moveCharacterPosition(position, pos);
        }
        popup.remove();
        charOptionsPopup = null;
      });
      posRow.appendChild(btn);
    });
    popup.appendChild(posRow);

    // Expression change if character has expressions
    if (char) {
      const charData = AppState.assets.characters.find(
        (c) => c.id === (char.character_id || char.id)
      );
      const expressions = charData && charData.expressions ? Object.keys(charData.expressions) : [];
      if (expressions.length > 0) {
        const exprLabel = document.createElement('div');
        exprLabel.style.cssText = 'font-size:11px;color:#a0aec0;margin-bottom:4px;';
        exprLabel.textContent = '표정 변경';
        popup.appendChild(exprLabel);

        const select = document.createElement('select');
        select.style.cssText = 'width:100%;padding:4px;background:#1a202c;color:#fff;border:1px solid #4a5568;border-radius:4px;margin-bottom:8px;font-size:12px;';
        expressions.forEach((expr) => {
          const opt = document.createElement('option');
          opt.value = expr;
          opt.textContent = expr;
          if (expr === char.expression) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => {
          changeExpression(position, select.value, charData);
        });
        popup.appendChild(select);
      }
    }

    // Hide character button
    if (char) {
      const hideBtn = document.createElement('button');
      hideBtn.textContent = '캐릭터 퇴장';
      hideBtn.style.cssText = 'width:100%;padding:6px;background:#e53e3e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
      hideBtn.addEventListener('click', () => {
        hideCharacter(position);
        popup.remove();
        charOptionsPopup = null;
      });
      popup.appendChild(hideBtn);
    }

    document.body.appendChild(popup);
    charOptionsPopup = popup;

    const dismiss = (ev) => {
      if (!popup.contains(ev.target) && ev.target !== slot) {
        popup.remove();
        charOptionsPopup = null;
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  function moveCharacterPosition(fromPos, toPos) {
    AppState.saveToHistory();
    const char = AppState.scene.preview.characters[fromPos];
    AppState.scene.preview.characters[toPos] = { ...char, position: toPos };
    AppState.scene.preview.characters[fromPos] = null;
    AppState.scene.events.push({
      id: Utils.generateId(),
      type: 'character_show',
      character_id: char.character_id || char.id || null,
      position: toPos,
      expression: char.expression || 'normal',
      path: char.resPath || '',
    });
    AppState.autosave();
    render();
    EventBus.emit('preview:updated');
    EventBus.emit('timeline:updated');
  }

  function changeExpression(position, expression, charData) {
    AppState.saveToHistory();
    const char = AppState.scene.preview.characters[position];
    if (!char) return;
    // Update rawUrl if charData has expressions map
    if (charData && charData.expressions && charData.expressions[expression]) {
      char.rawUrl = charData.expressions[expression].rawUrl || char.rawUrl;
      char.resPath = charData.expressions[expression].resPath || char.resPath;
    }
    char.expression = expression;
    AppState.scene.events.push({
      id: Utils.generateId(),
      type: 'expression_change',
      character_id: char.character_id || char.id || null,
      expression,
      path: char.resPath || '',
    });
    AppState.autosave();
    render();
    EventBus.emit('preview:updated');
    EventBus.emit('timeline:updated');
  }

  function hideCharacter(position) {
    AppState.saveToHistory();
    const char = AppState.scene.preview.characters[position];
    if (!char) return;
    AppState.scene.events.push({
      id: Utils.generateId(),
      type: 'character_hide',
      character_id: char.character_id || char.id || null,
    });
    AppState.scene.preview.characters[position] = null;
    AppState.autosave();
    render();
    EventBus.emit('preview:updated');
    EventBus.emit('timeline:updated');
  }

  return { init, render, renderBackground, renderCharacters, renderDialogue, handleDrop, applyBackground, applyCharacter, showCharacterOptions };
})();
