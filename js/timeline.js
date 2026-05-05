window.TimelinePanel = (() => {
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

  let dragIndex = null;
  let addMenuEl = null;
  let saveDebounced = null;

  function init() {
    document.getElementById('btn-timeline-add').addEventListener('click', (e) => {
      e.stopPropagation();
      showAddEventMenu();
    });

    const list = document.getElementById('timeline-list');
    list.addEventListener('click', (e) => {
      // ── 그룹 헤더 영역 ──────────────────────────────
      const groupToggleBtn = e.target.closest('.tl-group-toggle');
      if (groupToggleBtn) {
        e.stopPropagation();
        if (window.TimelineGroups) TimelineGroups.toggle_group_collapsed(groupToggleBtn.dataset.groupId);
        return;
      }
      const ungroupBtn = e.target.closest('.tl-group-ungroup');
      if (ungroupBtn) {
        e.stopPropagation();
        if (window.TimelineGroups) TimelineGroups.ungroup_item(ungroupBtn.dataset.groupId);
        return;
      }
      // 그룹명 input 클릭은 전파 차단만
      if (e.target.classList.contains('tl-group-name')) return;
      // 그룹 헤더 본체 클릭 → 접기/펼치기
      const groupLi = e.target.closest('li[data-group-id]');
      if (groupLi) {
        if (window.TimelineGroups) TimelineGroups.toggle_group_collapsed(groupLi.dataset.groupId);
        return;
      }

      // ── 일반 이벤트 항목 ────────────────────────────
      const li = e.target.closest('li[data-index]');
      if (!li) return;
      const delBtn = e.target.closest('.timeline-delete-btn');
      if (delBtn) {
        deleteEvent(parseInt(li.dataset.index, 10));
        return;
      }
      const idx = parseInt(li.dataset.index, 10);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+클릭: 멀티셀렉트 토글
        const sel = AppState.ui.selectedEventIndices || [];
        const pos = sel.indexOf(idx);
        AppState.ui.selectedEventIndices = pos === -1 ? sel.concat(idx) : sel.filter(function(i){ return i !== idx; });
        render();
      } else {
        AppState.ui.selectedEventIndices = [];
        selectEvent(idx);
      }
    });

    // 그룹화 버튼
    const groupBtn = document.getElementById('btn-group-selected');
    if (groupBtn) {
      groupBtn.addEventListener('click', () => {
        const sel = AppState.ui.selectedEventIndices || [];
        if (sel.length < 2) { alert('2개 이상의 이벤트를 Ctrl+클릭으로 선택하세요.'); return; }
        const name = prompt('그룹 이름', '새 그룹');
        if (name === null) return;
        if (window.TimelineGroups) TimelineGroups.group_selected_items(name || '새 그룹');
      });
    }

    setupDragReorder();

    EventBus.on('timeline:updated', () => render());

    render();
  }

  function render() {
    const list = document.getElementById('timeline-list');
    list.innerHTML = '';

    const events = AppState.scene.events;

    // 이벤트 수 표시 갱신
    const countEl = document.getElementById('timeline-event-count');
    if (countEl) countEl.textContent = events.length + ' 이벤트';

    // 그룹화 버튼 활성 상태 갱신
    const groupBtn = document.getElementById('btn-group-selected');
    if (groupBtn) {
      const selCount = (AppState.ui.selectedEventIndices || []).length;
      groupBtn.disabled = selCount < 2;
    }

    if (events.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'timeline-empty';
      empty.style.cssText = 'color:#718096;font-size:13px;padding:20px 12px;text-align:center;list-style:none;';
      empty.textContent = '+ 이벤트를 추가하거나 에셋을 드래그하세요';
      list.appendChild(empty);
      return;
    }

    const items = window.TimelineGroups
      ? TimelineGroups.get_visible_timeline_items()
      : events.map((ev, i) => ({ kind: 'event', eventIndex: i, event: ev, groupId: null, indented: false }));

    items.forEach((item) => {
      if (item.kind === 'group_header') {
        list.appendChild(renderGroupHeader(item));
      } else {
        list.appendChild(renderEventItem(item));
      }
    });
  }

  /** 이벤트 <li> 항목 생성 */
  function renderEventItem({ eventIndex, event, indented }) {
    const cfg = EVENT_CONFIGS[event.type] || { label: event.type, icon: '?', color: '#718096' };
    const isSelected   = AppState.ui.selectedEventIndex === eventIndex;
    const isMultiSel   = (AppState.ui.selectedEventIndices || []).includes(eventIndex);

    const li = document.createElement('li');
    li.dataset.index = eventIndex;
    li.draggable = true;

    let cls = 'timeline-event';
    if (isSelected)  cls += ' selected';
    if (isMultiSel)  cls += ' tl-multi-selected';
    if (indented)    cls += ' tl-event-indented';
    li.className = cls;

    const paddingLeft = indented ? '28px' : '10px';
    let bg = 'transparent';
    if (isSelected)      bg = '#2d3748';
    else if (isMultiSel) bg = '#1e2a3a';

    li.style.cssText = `display:flex;align-items:center;gap:8px;padding:8px 10px 8px ${paddingLeft};margin-bottom:2px;border-radius:4px;cursor:pointer;border-left:3px solid ${cfg.color};background:${bg};list-style:none;user-select:none;`;

    const icon = document.createElement('span');
    icon.style.cssText = 'font-size:14px;flex-shrink:0;';
    icon.textContent = cfg.icon;

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:11px;color:#a0aec0;';
    labelEl.textContent = cfg.label;

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:13px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    summary.textContent = getEventSummary(event);

    info.appendChild(labelEl);
    info.appendChild(summary);

    const delBtn = document.createElement('button');
    delBtn.className = 'timeline-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = '삭제';
    delBtn.style.cssText = 'background:none;border:none;color:#718096;font-size:16px;cursor:pointer;padding:0 2px;flex-shrink:0;line-height:1;';
    delBtn.addEventListener('mouseenter', () => { delBtn.style.color = '#fc8181'; });
    delBtn.addEventListener('mouseleave', () => { delBtn.style.color = '#718096'; });

    li.appendChild(icon);
    li.appendChild(info);
    li.appendChild(delBtn);
    return li;
  }

  /** 그룹 헤더 <li> 생성 */
  function renderGroupHeader({ group, eventCount }) {
    const summary = window.TimelineGroups ? TimelineGroups.get_group_summary(group) : '';

    const li = document.createElement('li');
    li.dataset.groupId = group.id;
    li.className = 'tl-group-header' + (group.collapsed ? ' tl-group-collapsed' : '');

    // ▸/▾ 접기 버튼
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tl-group-toggle';
    toggleBtn.dataset.groupId = group.id;
    toggleBtn.title = group.collapsed ? '펼치기' : '접기';
    toggleBtn.textContent = group.collapsed ? '▸' : '▾';

    // 그룹명 인라인 편집
    const nameInput = document.createElement('input');
    nameInput.className = 'tl-group-name';
    nameInput.type = 'text';
    nameInput.value = group.name;
    nameInput.addEventListener('blur', () => {
      group.name = nameInput.value.trim() || '새 그룹';
      AppState.autosave();
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });

    // 요약 배지
    const badge = document.createElement('span');
    badge.className = 'tl-group-badge';
    badge.textContent = group.collapsed ? summary : eventCount + '개';

    // 그룹 해제 버튼
    const ungroupBtn = document.createElement('button');
    ungroupBtn.className = 'tl-group-ungroup';
    ungroupBtn.dataset.groupId = group.id;
    ungroupBtn.title = '그룹 해제';
    ungroupBtn.textContent = '해제';

    li.appendChild(toggleBtn);
    li.appendChild(nameInput);
    li.appendChild(badge);
    li.appendChild(ungroupBtn);
    return li;
  }

  function getEventSummary(event) {
    switch (event.type) {
      case 'background':
        return event.path ? Utils.getFilename(event.path) : '(미설정)';
      case 'bgm_play':
        return (event.path ? Utils.getFilename(event.path) : '(미설정)') + (event.loop ? ' 🔁' : '');
      case 'bgm_stop':
        return 'BGM 종료';
      case 'sfx_play':
        return event.path ? Utils.getFilename(event.path) : '(미설정)';
      case 'character_show':
        return (event.character_id || '(미설정)') + ' @ ' + (event.position || 'center');
      case 'character_hide':
        return event.character_id || '(미설정)';
      case 'expression_change':
        return (event.character_id || '(미설정)') + ' → ' + (event.expression || 'normal');
      case 'dialogue': {
        const text = event.text || '';
        return text.length > 30 ? text.slice(0, 30) + '...' : text || '(빈 대사)';
      }
      case 'choice':
        return ((event.options || []).length) + '개 선택지';
      case 'place':
        return (event.asset_kind || 'image') + ' · ' + (event.path ? Utils.getFilename(event.path) : '(미설정)');
      default:
        return '';
    }
  }

  function selectEvent(index) {
    AppState.ui.selectedEventIndex = index;
    render();
    showEventEditor(index);
    EventBus.emit('preview:updated');
  }

  function deleteEvent(index) {
    AppState.saveToHistory();
    const evtToDelete = AppState.scene.events[index];
    if (evtToDelete && evtToDelete.type === 'character_show') {
      const pos = evtToDelete.position || 'center';
      AppState.scene.preview.characters[pos] = null;
    }
    if (evtToDelete && evtToDelete.type === 'place' && AppState.ui.selectedPlacedId === evtToDelete.item_id) {
      AppState.ui.selectedPlacedId = null;
    }
    AppState.scene.events.splice(index, 1);
    if (AppState.ui.selectedEventIndex === index) {
      AppState.ui.selectedEventIndex = null;
      const editorContent = document.getElementById('event-editor-content');
      if (editorContent) editorContent.innerHTML = '<div class="event-editor-placeholder"><p>타임라인에서 이벤트를<br/>선택하면 여기서 편집할 수 있습니다</p></div>';
    } else if (AppState.ui.selectedEventIndex > index) {
      AppState.ui.selectedEventIndex -= 1;
    }
    // 멀티셀렉트 인덱스 보정
    AppState.ui.selectedEventIndices = (AppState.ui.selectedEventIndices || [])
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));
    // 빈 그룹 정리
    if (AppState.scene.groups && AppState.scene.groups.length > 0) {
      const usedIds = new Set(AppState.scene.events.filter((e) => e.groupId).map((e) => e.groupId));
      AppState.scene.groups = AppState.scene.groups.filter((g) => usedIds.has(g.id));
    }
    AppState.autosave();
    render();
    EventBus.emit('timeline:updated');
    EventBus.emit('preview:updated');
  }

  function moveEvent(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    AppState.saveToHistory();
    const events = AppState.scene.events;
    const [moved] = events.splice(fromIndex, 1);
    events.splice(toIndex, 0, moved);

    // Keep selection tracking correct
    const sel = AppState.ui.selectedEventIndex;
    if (sel !== null) {
      if (sel === fromIndex) {
        AppState.ui.selectedEventIndex = toIndex;
      } else if (fromIndex < toIndex && sel > fromIndex && sel <= toIndex) {
        AppState.ui.selectedEventIndex = sel - 1;
      } else if (fromIndex > toIndex && sel >= toIndex && sel < fromIndex) {
        AppState.ui.selectedEventIndex = sel + 1;
      }
    }
    // 멀티셀렉트 인덱스 보정
    AppState.ui.selectedEventIndices = (AppState.ui.selectedEventIndices || []).map((i) => {
      if (i === fromIndex) return toIndex;
      if (fromIndex < toIndex && i > fromIndex && i <= toIndex) return i - 1;
      if (fromIndex > toIndex && i >= toIndex && i < fromIndex) return i + 1;
      return i;
    });

    AppState.autosave();
    render();
    EventBus.emit('timeline:updated');
  }

  function showAddEventMenu() {
    if (addMenuEl) {
      addMenuEl.remove();
      addMenuEl = null;
      return;
    }

    const btn = document.getElementById('btn-timeline-add');
    const rect = btn.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;z-index:2000;background:#2d3748;border:1px solid #4a5568;border-radius:6px;padding:4px;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:160px;';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';

    Object.entries(EVENT_CONFIGS).forEach(([type, cfg]) => {
      const item = document.createElement('button');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;background:none;border:none;color:#e2e8f0;cursor:pointer;border-radius:4px;font-size:13px;text-align:left;';
      item.innerHTML = `<span style="font-size:14px">${cfg.icon}</span><span>${cfg.label}</span>`;
      item.addEventListener('mouseenter', () => { item.style.background = '#4a5568'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
      item.addEventListener('click', () => {
        addEvent(type);
        menu.remove();
        addMenuEl = null;
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    addMenuEl = menu;

    const dismiss = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        addMenuEl = null;
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  function addEvent(type) {
    AppState.saveToHistory();
    const id = Utils.generateId();
    const defaults = {
      background:        { type, asset_id: null, path: '' },
      bgm_play:          { type, asset_id: null, path: '', loop: true },
      bgm_stop:          { type },
      sfx_play:          { type, asset_id: null, path: '' },
      character_show:    { type, character_id: null, position: 'center', expression: 'normal', path: '' },
      character_hide:    { type, character_id: null },
      expression_change: { type, character_id: null, expression: 'normal', path: '' },
      dialogue:          { type, speaker: '', text: '', display_style: 'normal' },
      choice:            { type, prompt: '', options: [{ text: '', next_scene: '' }] },
      place:             { type, item_id: 'pi_' + id, asset_kind: 'image', asset_id: null, path: '', rawUrl: '', rect: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, z: 20 },
    };
    const event = { id, ...(defaults[type] || { type }) };
    AppState.scene.events.push(event);
    AppState.autosave();
    selectEvent(AppState.scene.events.length - 1);
    EventBus.emit('timeline:updated');
  }

  // --- Event Editor ---

  function showEventEditor(index) {
    const event = AppState.scene.events[index];
    if (!event) return;

    const content = document.getElementById('event-editor-content');
    if (!content) return;
    const cfg = EVENT_CONFIGS[event.type] || { label: event.type, icon: '?', color: '#718096' };

    const debouncedSave = Utils.debounce(() => saveEventFromEditor(index), 300);

    let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #4a5568;">
      <span style="font-size:18px">${cfg.icon}</span>
      <span style="font-size:14px;font-weight:600;color:#e2e8f0;">${cfg.label}</span>
    </div>`;

    if (event.type === 'background') {
      html += buildAssetSelector('asset_id', '배경 이미지', AppState.assets.backgrounds, event.asset_id);
    } else if (event.type === 'bgm_play') {
      html += buildAssetSelector('asset_id', 'BGM 파일', AppState.assets.bgm, event.asset_id);
      html += buildCheckbox('loop', '반복 재생', event.loop !== false);
    } else if (event.type === 'bgm_stop') {
      html += `<p style="color:#a0aec0;font-size:13px;">BGM을 정지합니다.</p>`;
    } else if (event.type === 'sfx_play') {
      html += buildAssetSelector('asset_id', '효과음 파일', AppState.assets.sfx, event.asset_id);
    } else if (event.type === 'character_show') {
      html += buildCharacterSelector('character_id', '캐릭터', event.character_id);
      html += buildPositionRadio('position', '위치', event.position || 'center');
      html += buildTextInput('expression', '표정', event.expression || 'normal');
    } else if (event.type === 'character_hide') {
      html += buildCharacterSelector('character_id', '캐릭터', event.character_id);
    } else if (event.type === 'expression_change') {
      html += buildCharacterSelector('character_id', '캐릭터', event.character_id);
      html += buildTextInput('expression', '표정', event.expression || 'normal');
    } else if (event.type === 'dialogue') {
      html += buildStyleRadio('display_style', '표시 방식', event.display_style || 'normal');
      html += buildTextInput('speaker', '화자', event.speaker || '');
      html += buildTextarea('text', '대사', event.text || '');
    } else if (event.type === 'choice') {
      html += buildTextInput('prompt', '선택지 프롬프트', event.prompt || '');
      html += buildChoiceOptions(event.options || []);
    } else if (event.type === 'place') {
      html += buildPlaceKindSelector('asset_kind', event.asset_kind || 'image');
      html += buildPlaceAssetSelector('asset_id', event.asset_kind || 'image', event.asset_id);
      const r = event.rect || { x: 0.3, y: 0.3, w: 0.2, h: 0.2 };
      html += buildNumberInput('rect_x', 'X (0~1)', r.x, 0.01);
      html += buildNumberInput('rect_y', 'Y (0~1)', r.y, 0.01);
      html += buildNumberInput('rect_w', 'W (0~1)', r.w, 0.01);
      html += buildNumberInput('rect_h', 'H (0~1)', r.h, 0.01);
      html += buildNumberInput('z', 'Z (레이어)', event.z != null ? event.z : 20, 1);
      html += buildBatchSizeSection(r);
    }

    content.innerHTML = html;

    // Wire up auto-save
    content.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', debouncedSave);
      el.addEventListener('change', debouncedSave);
    });

    // Place-specific: batch size apply
    if (event.type === 'place') {
      const batchBtn = content.querySelector('#btn-batch-apply-size');
      if (batchBtn) {
        batchBtn.addEventListener('click', () => {
          const wInput = content.querySelector('#batch-size-w');
          const hInput = content.querySelector('#batch-size-h');
          const newW = Math.max(0.02, Math.min(1, parseFloat(wInput.value) || 0.2));
          const newH = Math.max(0.02, Math.min(1, parseFloat(hInput.value) || 0.2));
          const ids = AppState.ui.selectedPlacedIds || [];
          const targets = ids.length > 0
            ? AppState.scene.events.filter(e => e.type === 'place' && ids.includes(e.item_id))
            : AppState.scene.events.filter(e => e.type === 'place' && e.item_id === AppState.ui.selectedPlacedId);
          if (targets.length === 0) return;
          AppState.saveToHistory();
          targets.forEach(e => { e.rect.w = newW; e.rect.h = newH; });
          AppState.autosave();
          EventBus.emit('preview:updated');
          EventBus.emit('timeline:updated');
        });
      }
    }

    // Choice-specific dynamic buttons
    if (event.type === 'choice') {
      setupChoiceOptionButtons(content, index, debouncedSave);
    }
  }

  function buildAssetSelector(name, label, assets, selectedId) {
    const opts = assets.map((a) => {
      const filename = Utils.getFilename(a.resPath || a.rawUrl || a.id || '');
      const sel = a.id === selectedId ? ' selected' : '';
      return `<option value="${escHtml(a.id)}"${sel}>${escHtml(filename)}</option>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${escHtml(label)}</label>
      <select name="${name}" style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;">
        <option value="">-- 선택 --</option>
        ${opts}
      </select>
    </div>`;
  }

  function buildCharacterSelector(name, label, selectedId) {
    const chars = AppState.assets.characters;
    const opts = chars.map((c) => {
      const sel = c.id === selectedId ? ' selected' : '';
      return `<option value="${escHtml(c.id)}"${sel}>${escHtml(c.name || c.id)}</option>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${escHtml(label)}</label>
      <select name="${name}" style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;">
        <option value="">-- 선택 --</option>
        ${opts}
      </select>
    </div>`;
  }

  function buildPositionRadio(name, label, selected) {
    const positions = [['left', '좌'], ['center', '중'], ['right', '우']];
    const radios = positions.map(([val, lbl]) => {
      const chk = selected === val ? ' checked' : '';
      return `<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:12px;font-size:13px;color:#e2e8f0;">
        <input type="radio" name="${escHtml(name)}" value="${val}"${chk} style="accent-color:#4a90d9;">
        ${lbl}
      </label>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:6px;">${escHtml(label)}</label>
      <div>${radios}</div>
    </div>`;
  }

  function buildTextInput(name, label, value) {
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${escHtml(label)}</label>
      <input type="text" name="${escHtml(name)}" value="${escHtml(value)}"
        style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;box-sizing:border-box;">
    </div>`;
  }

  function buildTextarea(name, label, value) {
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${escHtml(label)}</label>
      <textarea name="${escHtml(name)}" rows="4"
        style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;">${escHtml(value)}</textarea>
    </div>`;
  }

  function buildStyleRadio(name, label, selected) {
    const styles = [
      ['normal', '일반 대사창'],
      ['bubble_left', '말풍선 좌'],
      ['bubble_right', '말풍선 우'],
    ];
    const radios = styles.map(([val, lbl]) => {
      const chk = selected === val ? ' checked' : '';
      return `<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:10px;font-size:12px;color:#e2e8f0;">
        <input type="radio" name="${escHtml(name)}" value="${val}"${chk} style="accent-color:#4a90d9;">
        ${lbl}
      </label>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:6px;">${escHtml(label)}</label>
      <div style="display:flex;flex-wrap:wrap;gap:2px;">${radios}</div>
    </div>`;
  }

  function buildCheckbox(name, label, checked) {
    return `<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">
      <input type="checkbox" name="${escHtml(name)}" id="cb_${escHtml(name)}"${checked ? ' checked' : ''} style="accent-color:#4a90d9;width:14px;height:14px;">
      <label for="cb_${escHtml(name)}" style="font-size:13px;color:#e2e8f0;cursor:pointer;">${escHtml(label)}</label>
    </div>`;
  }

  function buildNumberInput(name, label, value, step) {
    const displayVal = (typeof value === 'number' && step < 1) ? value.toFixed(4) : String(value);
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${escHtml(label)}</label>
      <input type="number" name="${escHtml(name)}" value="${escHtml(displayVal)}" step="${step}" min="0" max="1"
        style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;box-sizing:border-box;">
    </div>`;
  }

  function buildBatchSizeSection(currentRect) {
    const selCount = (AppState.ui.selectedPlacedIds || []).length;
    const count = Math.max(selCount, 1);
    return `<div id="place-batch-size" style="margin-top:16px;padding-top:12px;border-top:1px solid #2d3748;">
      <label style="display:block;font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">크기 일괄 변경</label>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <div style="flex:1;">
          <label style="display:block;font-size:11px;color:#a0aec0;margin-bottom:3px;">W (0~1)</label>
          <input type="number" id="batch-size-w" step="0.001" min="0.02" max="1" value="${currentRect.w.toFixed(4)}"
            style="width:100%;padding:5px 7px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:12px;box-sizing:border-box;">
        </div>
        <div style="flex:1;">
          <label style="display:block;font-size:11px;color:#a0aec0;margin-bottom:3px;">H (0~1)</label>
          <input type="number" id="batch-size-h" step="0.001" min="0.02" max="1" value="${currentRect.h.toFixed(4)}"
            style="width:100%;padding:5px 7px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:12px;box-sizing:border-box;">
        </div>
      </div>
      <button id="btn-batch-apply-size"
        style="width:100%;padding:7px 10px;background:#2d3748;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;cursor:pointer;font-size:12px;transition:background .15s;">
        선택된 <span id="batch-size-count">${count}</span>개 항목에 크기 적용
      </button>
    </div>`;
  }

  function buildPlaceKindSelector(name, selected) {
    const kinds = ['background', 'character', 'ui', 'image'];
    const opts = kinds.map(k => `<option value="${k}"${k === selected ? ' selected' : ''}>${escHtml(k)}</option>`).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">에셋 종류</label>
      <select name="${escHtml(name)}" style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;">
        ${opts}
      </select>
    </div>`;
  }

  function buildPlaceAssetSelector(name, kind, selectedId) {
    const assetMap = {
      background: AppState.assets.backgrounds,
      character: AppState.assets.characters,
      ui: AppState.assets.ui || [],
      image: (AppState.assets.ui || []).concat(AppState.assets.backgrounds || []),
    };
    const assets = assetMap[kind] || [];
    const opts = assets.map(a => {
      const lbl = Utils.getFilename(a.resPath || a.rawUrl || a.id || '');
      return `<option value="${escHtml(a.id)}"${a.id === selectedId ? ' selected' : ''}>${escHtml(lbl)}</option>`;
    }).join('');
    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">에셋</label>
      <select name="${escHtml(name)}" style="width:100%;padding:6px 8px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:13px;">
        <option value="">-- 선택 --</option>
        ${opts}
      </select>
    </div>`;
  }

  function buildChoiceOptions(options) {
    const rows = options.map((opt, i) => `
      <div class="choice-option-row" data-option-index="${i}" style="display:flex;gap:6px;margin-bottom:8px;align-items:flex-start;">
        <div style="flex:1;">
          <input type="text" name="choice_text_${i}" value="${escHtml(opt.text || '')}" placeholder="선택지 텍스트"
            style="width:100%;padding:5px 7px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:12px;box-sizing:border-box;margin-bottom:4px;">
          <input type="text" name="choice_next_${i}" value="${escHtml(opt.next_scene || '')}" placeholder="다음 장면 ID"
            list="scene-id-datalist"
            style="width:100%;padding:5px 7px;background:#1a202c;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:12px;box-sizing:border-box;">
        </div>
        <button class="remove-option-btn" data-index="${i}" style="padding:4px 8px;background:#e53e3e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;flex-shrink:0;margin-top:2px;">×</button>
      </div>`).join('');

    return `<div style="margin-bottom:12px;">
      <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:6px;">선택지 항목</label>
      <div id="choice-options-container">${rows}</div>
      <button id="add-option-btn" style="padding:6px 12px;background:#2d3748;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;cursor:pointer;font-size:12px;margin-top:4px;">+ 선택지 추가</button>
    </div>`;
  }

  function setupChoiceOptionButtons(content, index, debouncedSave) {
    const addBtn = content.querySelector('#add-option-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        AppState.saveToHistory();
        const event = AppState.scene.events[index];
        event.options = event.options || [];
        event.options.push({ text: '', next_scene: '' });
        AppState.autosave();
        showEventEditor(index);
        EventBus.emit('timeline:updated');
      });
    }

    content.querySelectorAll('.remove-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const optIdx = parseInt(btn.dataset.index, 10);
        AppState.saveToHistory();
        const event = AppState.scene.events[index];
        event.options.splice(optIdx, 1);
        AppState.autosave();
        showEventEditor(index);
        EventBus.emit('timeline:updated');
      });
    });
  }

  function saveEventFromEditor(index) {
    const event = AppState.scene.events[index];
    if (!event) return;
    const content = document.getElementById('event-editor-content');
    if (!content) return;

    const get = (name) => {
      const el = content.querySelector(`[name="${name}"]`);
      if (!el) return undefined;
      if (el.type === 'checkbox') return el.checked;
      return el.value;
    };

    const getRadio = (name) => {
      const el = content.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : undefined;
    };

    switch (event.type) {
      case 'background': {
        const assetId = get('asset_id');
        event.asset_id = assetId || null;
        const asset = AppState.assets.backgrounds.find((a) => a.id === assetId);
        if (asset) {
          event.path = asset.resPath || '';
          AppState.scene.preview.background = asset;
        }
        break;
      }
      case 'bgm_play': {
        const assetId = get('asset_id');
        event.asset_id = assetId || null;
        event.loop = get('loop') !== undefined ? get('loop') : true;
        const asset = AppState.assets.bgm.find((a) => a.id === assetId);
        if (asset) event.path = asset.resPath || '';
        break;
      }
      case 'bgm_stop':
        break;
      case 'sfx_play': {
        const assetId = get('asset_id');
        event.asset_id = assetId || null;
        const asset = AppState.assets.sfx.find((a) => a.id === assetId);
        if (asset) event.path = asset.resPath || '';
        break;
      }
      case 'character_show': {
        const charId = get('character_id');
        event.character_id = charId || null;
        event.position = getRadio('position') || event.position || 'center';
        event.expression = get('expression') || 'normal';
        const asset = AppState.assets.characters.find((c) => c.id === charId);
        if (asset) {
          event.path = asset.resPath || '';
          AppState.scene.preview.characters[event.position] = {
            ...asset,
            character_id: charId,
            position: event.position,
            expression: event.expression,
          };
        }
        break;
      }
      case 'character_hide': {
        const charId = get('character_id');
        event.character_id = charId || null;
        // Remove from preview
        Object.keys(AppState.scene.preview.characters).forEach((pos) => {
          const c = AppState.scene.preview.characters[pos];
          if (c && (c.character_id === charId || c.id === charId)) {
            AppState.scene.preview.characters[pos] = null;
          }
        });
        break;
      }
      case 'expression_change': {
        const charId = get('character_id');
        event.character_id = charId || null;
        event.expression = get('expression') || 'normal';
        const asset = AppState.assets.characters.find((c) => c.id === charId);
        if (asset) event.path = asset.resPath || '';
        break;
      }
      case 'dialogue':
        event.display_style = getRadio('display_style') || 'normal';
        event.speaker = get('speaker') || '';
        event.text = get('text') || '';
        break;
      case 'choice': {
        event.prompt = get('prompt') || '';
        const options = [];
        let i = 0;
        while (content.querySelector(`[name="choice_text_${i}"]`)) {
          options.push({
            text: get(`choice_text_${i}`) || '',
            next_scene: get(`choice_next_${i}`) || '',
          });
          i++;
        }
        event.options = options;
        break;
      }
      case 'place': {
        const kind = get('asset_kind') || 'image';
        event.asset_kind = kind;
        const assetId = get('asset_id') || null;
        event.asset_id = assetId;
        const assetMap = {
          background: AppState.assets.backgrounds,
          character: AppState.assets.characters,
          ui: AppState.assets.ui || [],
          image: (AppState.assets.ui || []).concat(AppState.assets.backgrounds || []),
        };
        const asset = (assetMap[kind] || []).find(a => a.id === assetId);
        if (asset) {
          event.path = asset.resPath || '';
          event.rawUrl = asset.rawUrl || '';
          event.filename = Utils.getFilename(asset.resPath || asset.rawUrl || '');
        }
        const rx = parseFloat(get('rect_x'));
        const ry = parseFloat(get('rect_y'));
        const rw = parseFloat(get('rect_w'));
        const rh = parseFloat(get('rect_h'));
        if (!isNaN(rx)) event.rect.x = Math.max(0, Math.min(0.98, rx));
        if (!isNaN(ry)) event.rect.y = Math.max(0, Math.min(0.98, ry));
        if (!isNaN(rw)) event.rect.w = Math.max(0.02, Math.min(1, rw));
        if (!isNaN(rh)) event.rect.h = Math.max(0.02, Math.min(1, rh));
        const zv = parseFloat(get('z'));
        if (!isNaN(zv)) event.z = zv;
        break;
      }
    }

    AppState.autosave();
    render();
    EventBus.emit('timeline:updated');
    EventBus.emit('preview:updated');
  }

  function setupDragReorder() {
    const list = document.getElementById('timeline-list');

    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li[data-index]');
      if (!li) return;
      // 그룹 헤더 행은 드래그 불가 (그룹 헤더는 data-group-id만 가짐)
      if (li.dataset.groupId) { e.preventDefault(); return; }
      dragIndex = parseInt(li.dataset.index, 10);
      li.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      // Use a plain text payload so it doesn't conflict with asset drops
      e.dataTransfer.setData('text/plain', String(dragIndex));
    });

    list.addEventListener('dragend', (e) => {
      const li = e.target.closest('li[data-index]');
      if (li) li.style.opacity = '';
      list.querySelectorAll('li[data-index]').forEach((el) => {
        el.style.borderTop = '';
        el.style.borderBottom = '';
      });
      dragIndex = null;
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const li = e.target.closest('li[data-index]');
      if (!li) return;
      list.querySelectorAll('li[data-index]').forEach((el) => {
        el.style.borderTop = '';
        el.style.borderBottom = '';
      });
      const rect = li.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        li.style.borderTop = '2px solid #4a90d9';
      } else {
        li.style.borderBottom = '2px solid #4a90d9';
      }
    });

    list.addEventListener('dragleave', (e) => {
      const li = e.target.closest('li[data-index]');
      if (li) {
        li.style.borderTop = '';
        li.style.borderBottom = '';
      }
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIndex === null) return;
      const li = e.target.closest('li[data-index]');
      if (!li) return;
      const dropTarget = parseInt(li.dataset.index, 10);
      const rect = li.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertAfter = e.clientY >= midY;
      let toIndex = insertAfter ? dropTarget + 1 : dropTarget;
      if (toIndex > dragIndex) toIndex -= 1;
      moveEvent(dragIndex, toIndex);
    });
  }

  // Minimal HTML escape to prevent XSS in dynamic content
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    init,
    render,
    getEventSummary,
    selectEvent,
    deleteEvent,
    moveEvent,
    showAddEventMenu,
    addEvent,
    showEventEditor,
    saveEventFromEditor,
    setupDragReorder,
  };
})();
