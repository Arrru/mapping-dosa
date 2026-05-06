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
    place:             { label: '자유 배치',   icon: '🧩',  color: '#9f7aea' },
  };

  let charOptionsPopup = null;
  let _clipboard = null;

  function init() {
    const container = document.getElementById('preview-container');
    const charsArea = document.getElementById('preview-characters');

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      handleDrop(e);
    });

    charsArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    charsArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleDrop(e);
    });

    ['left', 'center', 'right'].forEach((pos) => {
      const slot = document.getElementById(`char-${pos}`);
      if (slot) {
        slot.addEventListener('click', () => showCharacterOptions(pos));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { deselectPlaced(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selId = AppState.ui.selectedPlacedId;
        if (selId) {
          const src = AppState.scene.events.find(ev => ev.type === 'place' && ev.item_id === selId);
          if (src) { _clipboard = { ...src, rect: { ...src.rect } }; e.preventDefault(); }
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (_clipboard) {
          e.preventDefault();
          const newItemId = 'pi_' + Utils.generateId();
          const newEvent = {
            ..._clipboard,
            id: Utils.generateId(),
            item_id: newItemId,
            locked: false,
            rect: {
              x: Math.min(0.9, _clipboard.rect.x + 0.02),
              y: Math.min(0.9, _clipboard.rect.y + 0.02),
              w: _clipboard.rect.w,
              h: _clipboard.rect.h,
            },
          };
          AppState.saveToHistory();
          AppState.scene.events.push(newEvent);
          AppState.autosave();
          selectPlacedItem(newItemId);
          EventBus.emit('timeline:updated');
          EventBus.emit('preview:updated');
        }
      }
    });

    container.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.placed-item')) {
        deselectPlaced();
      }
    });

    EventBus.on('preview:updated', () => render());
    EventBus.on('timeline:updated', () => render());

    render();
  }

  function render() {
    renderBackground();
    renderCharacters();
    renderPlacedItems();
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

  function renderPlacedItems() {
    const layer = document.getElementById('preview-placed-items');
    if (!layer) return;
    layer.innerHTML = '';

    const placeEvents = AppState.scene.events.filter(e => e.type === 'place');
    const selectedId = AppState.ui.selectedPlacedId;
    const multiIds = AppState.ui.selectedPlacedIds || [];

    placeEvents.forEach((event) => {
      const itemId = event.item_id;
      const rect = event.rect || { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

      const div = document.createElement('div');
      const isPrimary = selectedId === itemId;
      const isMulti = !isPrimary && multiIds.includes(itemId);
      const isLocked = !!event.locked;
      div.className = 'placed-item'
        + (isPrimary ? ' placed-item--selected' : '')
        + (isMulti   ? ' placed-item--multi-selected' : '')
        + (isLocked  ? ' placed-item--locked' : '');
      div.dataset.itemId = itemId;
      div.style.left   = (rect.x * 100) + '%';
      div.style.top    = (rect.y * 100) + '%';
      div.style.width  = (rect.w * 100) + '%';
      div.style.height = (rect.h * 100) + '%';
      div.style.zIndex = event.z != null ? event.z : 20;

      if (event.rawUrl) {
        const img = document.createElement('img');
        img.src = event.rawUrl;
        img.alt = event.asset_id || itemId;
        img.draggable = false;
        img.ondragstart = () => false;
        div.appendChild(img);
      }

      if (selectedId === itemId && !isLocked) {
        ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
          const handle = document.createElement('div');
          handle.className = `resize-handle resize-handle--${dir}`;
          handle.dataset.dir = dir;
          handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResize(e, event, dir);
          });
          div.appendChild(handle);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'placed-item__delete';
        delBtn.textContent = '×';
        delBtn.title = '삭제';
        delBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removePlaceEvent(itemId);
        });
        div.appendChild(delBtn);
      }

      div.addEventListener('mousedown', (e) => {
        if (event.locked) return;
        if (e.target.classList.contains('resize-handle') || e.target.classList.contains('placed-item__delete')) return;
        e.stopPropagation();
        const isMultiKey = e.ctrlKey || e.metaKey;
        const currentMultiIds = AppState.ui.selectedPlacedIds || [];
        const alreadyMultiSelected = currentMultiIds.length > 1 && currentMultiIds.includes(itemId);
        if (isMultiKey) {
          selectPlacedItem(itemId, true);
        } else if (alreadyMultiSelected) {
          AppState.ui.selectedPlacedId = itemId;
          renderPlacedItems();
          startDrag(e, event);
        } else {
          selectPlacedItem(itemId, false);
          startDrag(e, event);
        }
      });

      layer.appendChild(div);
    });
  }

  function renderDialogue() {
    const dialogueBox = document.getElementById('preview-dialogue-box');
    const speakerEl = document.getElementById('preview-speaker-name');
    const textEl = document.getElementById('preview-dialogue-text');
    const choicesEl = document.getElementById('preview-choices');
    const container = document.getElementById('preview-container');

    container.querySelectorAll('.preview-speech-bubble').forEach(el => el.remove());

    const events = AppState.scene.events;
    let lastRelevant = null;

    const selIdx = AppState.ui.selectedEventIndex;
    if (selIdx !== null && selIdx >= 0 && selIdx < events.length) {
      const sel = events[selIdx];
      if (sel.type === 'dialogue' || sel.type === 'choice') {
        lastRelevant = sel;
      }
    }

    if (!lastRelevant) {
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === 'dialogue' || events[i].type === 'choice') {
          lastRelevant = events[i];
          break;
        }
      }
    }

    choicesEl.innerHTML = '';
    if (!lastRelevant) {
      dialogueBox.style.display = 'none';
      return;
    }

    if (lastRelevant.type === 'dialogue') {
      const style = lastRelevant.display_style || 'normal';
      if (style === 'bubble_left' || style === 'bubble_right') {
        dialogueBox.style.display = 'none';
        const bubble = document.createElement('div');
        bubble.className = `preview-speech-bubble preview-speech-bubble--${style === 'bubble_left' ? 'left' : 'right'}`;
        if (lastRelevant.speaker) {
          const sp = document.createElement('div');
          sp.className = 'bubble-speaker';
          sp.textContent = lastRelevant.speaker;
          bubble.appendChild(sp);
        }
        const tx = document.createElement('div');
        tx.className = 'bubble-text';
        tx.innerHTML = (lastRelevant.text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\r\n|\r|\n/g, '<br>');
        bubble.appendChild(tx);
        container.appendChild(bubble);
        return;
      }
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

  function centerRect(cx, cy, w, h) {
    return {
      x: Math.max(0, Math.min(1 - w, cx - w / 2)),
      y: Math.max(0, Math.min(1 - h, cy - h / 2)),
      w,
      h,
    };
  }

  function handleDrop(e) {
    let asset;
    try {
      asset = JSON.parse(e.dataTransfer.getData('asset'));
    } catch (_) {
      return;
    }
    if (!asset) return;

    const container = document.getElementById('preview-container');
    const cr = container.getBoundingClientRect();
    const cx = (e.clientX - cr.left) / cr.width;
    const cy = (e.clientY - cr.top) / cr.height;

    if (asset.type === 'background') {
      const hasBg = AppState.scene.preview.background != null;
      if (!hasBg) {
        applyBackground(asset);
      }
      addPlaceEvent(asset, hasBg
        ? centerRect(cx, cy, 0.4, 0.4)
        : { x: 0, y: 0, w: 1, h: 1 }, 0);
    } else if (asset.type === 'character') {
      addPlaceEvent(asset, centerRect(cx, cy, 0.25, 0.7), 10);
    } else if (asset.type === 'ui' || asset.type === 'image') {
      addPlaceEvent(asset, centerRect(cx, cy, 0.2, 0.2), 20);
    } else if (asset.type === 'bgm' || asset.type === 'sfx') {
      AppState.saveToHistory();
      AppState.scene.events.push({
        id: Utils.generateId(),
        type: asset.type === 'bgm' ? 'bgm_play' : 'sfx_play',
        asset_id: asset.id,
        path: asset.resPath || '',
        loop: asset.type === 'bgm',
      });
      AppState.autosave();
      EventBus.emit('timeline:updated');
    }
  }

  function addPlaceEvent(asset, rect, z) {
    AppState.saveToHistory();
    const itemId = 'pi_' + Utils.generateId();
    const event = {
      id: Utils.generateId(),
      type: 'place',
      item_id: itemId,
      asset_kind: asset.type || 'image',
      asset_id: asset.id || null,
      path: asset.resPath || '',
      rawUrl: asset.rawUrl || '',
      filename: asset.filename || Utils.getFilename(asset.resPath || asset.rawUrl || ''),
      rect: {
        x: Math.max(0, Math.min(0.98, rect.x)),
        y: Math.max(0, Math.min(0.98, rect.y)),
        w: Math.max(0.02, Math.min(1 - rect.x, rect.w)),
        h: Math.max(0.02, Math.min(1 - rect.y, rect.h)),
      },
      z: z != null ? z : 20,
    };
    AppState.scene.events.push(event);
    AppState.autosave();
    selectPlacedItem(itemId);
    EventBus.emit('timeline:updated');
    EventBus.emit('preview:updated');
  }

  function removePlaceEvent(itemId) {
    const idx = AppState.scene.events.findIndex(e => e.type === 'place' && e.item_id === itemId);
    if (idx === -1) return;
    AppState.saveToHistory();
    AppState.scene.events.splice(idx, 1);
    if (AppState.ui.selectedPlacedId === itemId) {
      AppState.ui.selectedPlacedId = null;
    }
    AppState.ui.selectedPlacedIds = (AppState.ui.selectedPlacedIds || []).filter(id => id !== itemId);
    AppState.autosave();
    EventBus.emit('timeline:updated');
    EventBus.emit('preview:updated');
  }

  function selectPlacedItem(itemId, isMulti) {
    if (isMulti) {
      const ids = AppState.ui.selectedPlacedIds || [];
      const idx = ids.indexOf(itemId);
      if (idx === -1) {
        AppState.ui.selectedPlacedIds = [...ids, itemId];
      } else {
        AppState.ui.selectedPlacedIds = ids.filter(id => id !== itemId);
      }
    } else {
      AppState.ui.selectedPlacedIds = [itemId];
    }
    AppState.ui.selectedPlacedId = itemId;
    AppState.ui.selectedEventIndex = null;
    renderPlacedItems();
  }

  function deselectPlaced() {
    if (AppState.ui.selectedPlacedId == null && (AppState.ui.selectedPlacedIds || []).length === 0) return;
    AppState.ui.selectedPlacedId = null;
    AppState.ui.selectedPlacedIds = [];
    renderPlacedItems();
  }

  function _getContainerRect() {
    return document.getElementById('preview-container').getBoundingClientRect();
  }

  function startDrag(e, event) {
    const cr = _getContainerRect();
    const startX = e.clientX;
    const startY = e.clientY;

    const multiIds = AppState.ui.selectedPlacedIds || [];
    const allIds = multiIds.length > 1 ? multiIds : [event.item_id];
    const draggedEvents = AppState.scene.events.filter(ev =>
      ev.type === 'place' && allIds.includes(ev.item_id) && !ev.locked
    );
    const origRects = draggedEvents.map(ev => ({ ...ev.rect }));
    let saved = false;

    function onMove(ev) {
      if (!saved) { AppState.saveToHistory(); saved = true; }
      const dx = (ev.clientX - startX) / cr.width;
      const dy = (ev.clientY - startY) / cr.height;
      draggedEvents.forEach((evt, i) => {
        evt.rect.x = Math.max(0, Math.min(1 - evt.rect.w, origRects[i].x + dx));
        evt.rect.y = Math.max(0, Math.min(1 - evt.rect.h, origRects[i].y + dy));
      });
      renderPlacedItems();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      AppState.autosave();
      EventBus.emit('timeline:updated');
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startResize(e, event, dir) {
    const cr = _getContainerRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origRect = { ...event.rect };
    let saved = false;

    function onMove(ev) {
      if (!saved) {
        AppState.saveToHistory();
        saved = true;
      }
      const dx = (ev.clientX - startX) / cr.width;
      const dy = (ev.clientY - startY) / cr.height;

      let { x, y, w, h } = origRect;

      if (dir.includes('e')) { w = Math.max(0.02, w + dx); }
      if (dir.includes('w')) { const nw = Math.max(0.02, w - dx); x = x + w - nw; w = nw; }
      if (dir.includes('s')) { h = Math.max(0.02, h + dy); }
      if (dir.includes('n')) { const nh = Math.max(0.02, h - dy); y = y + h - nh; h = nh; }

      x = Math.max(0, Math.min(0.98, x));
      y = Math.max(0, Math.min(0.98, y));
      w = Math.max(0.02, Math.min(1 - x, w));
      h = Math.max(0.02, Math.min(1 - y, h));

      event.rect.x = x;
      event.rect.y = y;
      event.rect.w = w;
      event.rect.h = h;

      renderPlacedItems();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      AppState.autosave();
      EventBus.emit('timeline:updated');
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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

  return { init, render, renderBackground, renderCharacters, renderPlacedItems, renderDialogue, handleDrop, applyBackground, applyCharacter, showCharacterOptions, addPlaceEvent, selectPlacedItem, deselectPlaced };
})();
