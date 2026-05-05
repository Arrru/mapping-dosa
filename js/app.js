window.EventBus = (() => {
  const handlers = {};

  const on = (event, fn) => {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(fn);
  };

  const off = (event, fn) => {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter(h => h !== fn);
  };

  const emit = (event, data) => {
    if (!handlers[event]) return;
    for (const fn of handlers[event]) {
      try { fn(data); } catch (err) { console.error(`[EventBus] ${event} handler error:`, err); }
    }
  };

  return { handlers, on, off, emit };
})();

window.AssetPanelUI = (() => {
  const TABS = ['backgrounds', 'characters', 'bgm', 'sfx', 'ui', 'recent'];

  const isAudio = (asset) => Utils.isSoundFile(asset.filename + '.mp3') || ['bgm', 'sfx'].includes(asset.type);

  const createAudioCard = (asset) => {
    const card = document.createElement('div');
    card.className = 'asset-card asset-card--audio';
    card.draggable = true;
    card.dataset.assetId = asset.id;

    const icon = document.createElement('div');
    icon.className = 'asset-card__audio-icon';
    icon.textContent = '♪';

    const label = document.createElement('div');
    label.className = 'asset-card__label';
    label.textContent = asset.filename;
    label.title = asset.filename;

    const playBtn = document.createElement('button');
    playBtn.className = 'asset-card__play-btn';
    playBtn.textContent = '▶';
    playBtn.title = '미리듣기';

    let audio = null;
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (audio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        playBtn.textContent = '▶';
        return;
      }
      audio = new Audio(asset.rawUrl);
      audio.play();
      playBtn.textContent = '■';
      audio.onended = () => { playBtn.textContent = '▶'; };
    });

    card.appendChild(icon);
    card.appendChild(label);
    card.appendChild(playBtn);
    return card;
  };

  const createImageCard = (asset) => {
    const card = document.createElement('div');
    card.className = 'asset-card asset-card--image';
    card.draggable = true;
    card.dataset.assetId = asset.id;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = asset.rawUrl;
    img.alt = asset.filename;
    img.className = 'asset-card__thumb';

    const label = document.createElement('div');
    label.className = 'asset-card__label';
    label.textContent = asset.filename;
    label.title = asset.filename;

    // Enlarged tooltip on hover
    let tooltip = null;
    card.addEventListener('mouseenter', () => {
      tooltip = document.createElement('div');
      tooltip.className = 'asset-card__tooltip';
      const bigImg = document.createElement('img');
      bigImg.src = asset.rawUrl;
      tooltip.appendChild(bigImg);
      document.body.appendChild(tooltip);
      const rect = card.getBoundingClientRect();
      tooltip.style.left = `${rect.right + 8}px`;
      tooltip.style.top = `${rect.top}px`;
    });
    card.addEventListener('mouseleave', () => {
      if (tooltip) { tooltip.remove(); tooltip = null; }
    });

    card.appendChild(img);
    card.appendChild(label);
    return card;
  };

  const attachCardListeners = (card, asset) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('asset', JSON.stringify(asset));
      e.dataTransfer.effectAllowed = 'copy';
    });

    card.addEventListener('click', () => {
      AppState.addRecentAsset(asset);
      document.querySelectorAll('.asset-card--selected').forEach(el => el.classList.remove('asset-card--selected'));
      card.classList.add('asset-card--selected');
    });
  };

  const RECLASSIFY_LS_KEY = 'vn_reclassifications';

  let _moveTab = 'image'; // 'image' | 'sound'

  const applyReclassification = (asset, newType) => {
    ['ui', 'backgrounds', 'characters', 'bgm', 'sfx'].forEach(key => {
      const arr = AppState.assets[key];
      if (!arr) return;
      const idx = arr.indexOf(asset);
      if (idx !== -1) arr.splice(idx, 1);
    });
    asset.type = newType === 'ui' ? 'image' : newType;
    asset.id = asset.type + '_' + asset.filename;
    if (newType === 'character') AppState.assets.characters.push(asset);
    else if (newType === 'background') AppState.assets.backgrounds.push(asset);
    else if (newType === 'bgm') AppState.assets.bgm.push(asset);
    else if (newType === 'sfx') AppState.assets.sfx.push(asset);
    else AppState.assets.ui.push(asset);
  };

  const applyStoredReclassifications = () => {
    let stored;
    try { stored = JSON.parse(localStorage.getItem(RECLASSIFY_LS_KEY) || '{}'); } catch (_) { stored = {}; }
    for (const [path, newType] of Object.entries(stored)) {
      const asset = AppState.assets.all.find(a => a.path === path);
      if (asset && asset.type !== newType) applyReclassification(asset, newType);
    }
  };

  const reclassifyAsset = (asset, newType) => {
    let stored;
    try { stored = JSON.parse(localStorage.getItem(RECLASSIFY_LS_KEY) || '{}'); } catch (_) { stored = {}; }
    if (newType === 'ui') {
      delete stored[asset.path];
    } else {
      stored[asset.path] = newType;
    }
    localStorage.setItem(RECLASSIFY_LS_KEY, JSON.stringify(stored));
    applyReclassification(asset, newType);
    const labels = { character: '캐릭터', background: '배경', ui: 'UI', bgm: 'BGM', sfx: 'SFX' };
    if (window.App) App.showToast(`${asset.filename} → ${labels[newType] || newType} 탭으로 이동했습니다.`, 'success');
    render();
  };

  const renderTab = (type) => {
    const container = document.querySelector('#asset-grid');
    if (!container) return;
    container.innerHTML = '';

    if (type === 'reclassify') {
      container.style.cssText = 'overflow-y:auto;display:flex;flex-direction:column;gap:0;padding:0;';

      // Top-level tabs: 이미지 | 사운드
      const tabBar = document.createElement('div');
      tabBar.style.cssText = 'display:flex;gap:2px;padding:4px 4px 0;flex-shrink:0;';
      const makeTopTab = (label, key) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        const active = _moveTab === key;
        btn.style.cssText = `flex:1;padding:5px 0;font-size:11px;font-weight:600;border:none;border-radius:4px 4px 0 0;cursor:pointer;background:${active ? '#2d3748' : 'transparent'};color:${active ? '#e2e8f0' : '#718096'};border-bottom:2px solid ${active ? '#4a90d9' : 'transparent'};`;
        btn.addEventListener('click', () => { _moveTab = key; renderTab('reclassify'); });
        return btn;
      };
      tabBar.appendChild(makeTopTab('이미지', 'image'));
      tabBar.appendChild(makeTopTab('사운드', 'sound'));
      container.appendChild(tabBar);

      const body = document.createElement('div');
      body.style.cssText = 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding:4px;';

      if (_moveTab === 'image') {
        const allImages = [
          ...AppState.assets.backgrounds,
          ...AppState.assets.characters,
          ...AppState.assets.ui.filter(a => Utils.isImageFile(a.path)),
        ];
        if (allImages.length === 0) {
          body.innerHTML = '<div class="asset-list__empty">이미지 에셋이 없습니다.</div>';
          container.appendChild(body);
          return;
        }
        const typeLabels = { character: '캐릭터', background: '배경', image: 'UI', ui: 'UI' };
        const typeColors = { character: '#ed8936', background: '#4a90d9', ui: '#718096', image: '#718096' };
        for (const asset of allImages) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:4px;background:#1a202c;';
          const img = document.createElement('img');
          img.src = asset.rawUrl;
          img.loading = 'lazy';
          img.style.cssText = 'width:38px;height:38px;object-fit:cover;border-radius:3px;flex-shrink:0;background:#2d3748;';
          const info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;';
          const nameEl = document.createElement('div');
          nameEl.textContent = asset.filename;
          nameEl.style.cssText = 'font-size:11px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          const typeEl = document.createElement('div');
          typeEl.textContent = typeLabels[asset.type] || asset.type;
          typeEl.style.cssText = `font-size:10px;color:${typeColors[asset.type] || '#718096'};margin-top:2px;`;
          info.appendChild(nameEl);
          info.appendChild(typeEl);
          const btnGroup = document.createElement('div');
          btnGroup.style.cssText = 'display:flex;gap:3px;flex-shrink:0;';
          const isUi = asset.type === 'image' || asset.type === 'ui';
          const makeBtn = (label, color, targetType) => {
            const active = targetType === 'ui' ? isUi : asset.type === targetType;
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `padding:3px 6px;background:${active ? color : 'transparent'};color:${active ? '#fff' : '#a0aec0'};border:1px solid ${active ? color : '#4a5568'};border-radius:3px;cursor:pointer;font-size:10px;`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); reclassifyAsset(asset, targetType); });
            return btn;
          };
          btnGroup.appendChild(makeBtn('캐릭터', '#ed8936', 'character'));
          btnGroup.appendChild(makeBtn('배경', '#4a90d9', 'background'));
          btnGroup.appendChild(makeBtn('UI', '#718096', 'ui'));
          row.appendChild(img);
          row.appendChild(info);
          row.appendChild(btnGroup);
          body.appendChild(row);
        }
      } else {
        const allSounds = [...AppState.assets.bgm, ...AppState.assets.sfx];
        if (allSounds.length === 0) {
          body.innerHTML = '<div class="asset-list__empty">사운드 에셋이 없습니다.</div>';
          container.appendChild(body);
          return;
        }
        for (const asset of allSounds) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:4px;background:#1a202c;';
          const icon = document.createElement('div');
          icon.textContent = '♪';
          icon.style.cssText = 'width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:3px;background:#2d3748;color:#7b68ee;font-size:16px;flex-shrink:0;';
          const info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;';
          const nameEl = document.createElement('div');
          nameEl.textContent = asset.filename;
          nameEl.style.cssText = 'font-size:11px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          const typeEl = document.createElement('div');
          typeEl.textContent = asset.type === 'bgm' ? 'BGM' : 'SFX';
          typeEl.style.cssText = `font-size:10px;color:${asset.type === 'bgm' ? '#7b68ee' : '#48bb78'};margin-top:2px;`;
          info.appendChild(nameEl);
          info.appendChild(typeEl);
          const btnGroup = document.createElement('div');
          btnGroup.style.cssText = 'display:flex;gap:3px;flex-shrink:0;';
          const makeSndBtn = (label, color, targetType) => {
            const active = asset.type === targetType;
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `padding:3px 8px;background:${active ? color : 'transparent'};color:${active ? '#fff' : '#a0aec0'};border:1px solid ${active ? color : '#4a5568'};border-radius:3px;cursor:pointer;font-size:10px;`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); reclassifyAsset(asset, targetType); });
            return btn;
          };
          btnGroup.appendChild(makeSndBtn('BGM', '#7b68ee', 'bgm'));
          btnGroup.appendChild(makeSndBtn('SFX', '#48bb78', 'sfx'));
          row.appendChild(icon);
          row.appendChild(info);
          row.appendChild(btnGroup);
          body.appendChild(row);
        }
      }
      container.appendChild(body);
      return;
    }

    const assets = type === 'recent'
      ? AppState.ui.recentAssets
      : AppState.assets[type] || [];

    if (assets.length === 0) {
      container.innerHTML = '<div class="asset-list__empty">에셋이 없습니다.</div>';
      return;
    }

    for (const asset of assets) {
      const card = (asset.type === 'bgm' || asset.type === 'sfx' || Utils.isSoundFile(asset.path))
        ? createAudioCard(asset)
        : createImageCard(asset);
      attachCardListeners(card, asset);
      container.appendChild(card);
    }
  };

  const render = () => {
    // Wire tab buttons
    for (const tab of TABS) {
      const btn = document.querySelector(`#tab-${tab}`);
      if (!btn) continue;
      btn.classList.toggle('tab-btn--active', AppState.ui.activeAssetTab === tab);
      btn.setAttribute('aria-selected', AppState.ui.activeAssetTab === tab ? 'true' : 'false');
      btn.onclick = () => {
        AppState.ui.activeAssetTab = tab;
        render();
      };
    }
    renderTab(AppState.ui.activeAssetTab);
  };

  return { render, renderTab, applyStoredReclassifications };
})();

window.App = (() => {
  const fullRerender = () => {
    if (window.PreviewPanel) PreviewPanel.render();
    if (window.TimelinePanel) TimelinePanel.render();
    AssetPanelUI.render();
    updateUndoRedoButtons();
    const t = document.querySelector('#scene-title-input'); if (t) t.value = AppState.scene.title;
    const sid = document.querySelector('#scene-id-input'); if (sid) sid.value = AppState.scene.id;
  };

  const showToast = (message, type = 'success', duration = 3000) => {
    const container = document.querySelector('#toast-container') || document.body;
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  const showLoading = (msg = '') => {
    const overlay = document.querySelector('#loading-overlay');
    if (!overlay) return;
    const msgEl = overlay.querySelector('#loading-message') || overlay;
    msgEl.textContent = msg;
    overlay.hidden = false;
    overlay.style.display = '';
  };

  const hideLoading = () => {
    const overlay = document.querySelector('#loading-overlay');
    if (overlay) { overlay.hidden = true; overlay.style.display = 'none'; }
  };

  const updateUndoRedoButtons = () => {
    const undo = document.querySelector('#btn-undo');
    const redo = document.querySelector('#btn-redo');
    if (undo) undo.disabled = !AppState.canUndo();
    if (redo) redo.disabled = !AppState.canRedo();
  };

  const newScene = () => {
    if (!confirm('현재 장면을 초기화하시겠습니까? 저장되지 않은 내용은 사라집니다.')) return;
    AppState.newScene();
    fullRerender();
  };

  const saveToLocal = () => {
    Exporter.downloadSceneJSON();
    showToast('저장됨', 'success', 2000);
  };

  const loadFromFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = Exporter.importSceneJSON(e.target.result);
      if (result.success) {
        fullRerender();
        showToast('장면을 불러왔습니다.', 'success');
      } else {
        showToast(result.error || '불러오기 실패', 'error');
      }
    };
    reader.readAsText(file);
  };

  const pushToGitHub = async () => {
    if (!AppState.config.githubToken) {
      showToast('GitHub 토큰을 먼저 설정하세요.', 'error');
      return;
    }
    if (!confirm('GitHub에 씬을 푸시하시겠습니까?')) return;
    showLoading('GitHub에 푸시 중...');
    const result = await Exporter.pushToGitHub();
    hideLoading();
    if (result.success) {
      showToast('GitHub에 저장되었습니다.', 'success');
    } else {
      showToast('푸시에 실패했습니다.', 'error');
    }
  };

  const updateSceneIdDatalist = () => {
    const datalist = document.getElementById('scene-id-datalist');
    if (!datalist) return;
    datalist.innerHTML = (AppState.knownSceneIds || []).map(id => `<option value="${id}">`).join('');
  };

  const openSceneList = async () => {
    const modal = document.getElementById('scene-list-modal');
    const content = document.getElementById('scene-list-content');
    if (!modal || !content) return;
    modal.hidden = false;
    content.innerHTML = '<div style="color:#a0aec0;text-align:center;padding:20px;">불러오는 중...</div>';
    try {
      const files = await GitHubAPI.listScenes(AppState.config.githubToken, AppState.config.targetRepo);
      if (files.length === 0) {
        content.innerHTML = '<div style="color:#a0aec0;text-align:center;padding:20px;">저장된 씬이 없습니다.</div>';
        return;
      }
      content.innerHTML = '';
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:4px;';
      files.forEach(file => {
        const sceneId = file.name.replace('.json', '');
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:#1a202c;border-radius:4px;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

        const idEl = document.createElement('div');
        idEl.style.cssText = 'flex:1;font-size:13px;color:#e2e8f0;font-family:monospace;';
        idEl.textContent = sceneId;

        const renameBtn = document.createElement('button');
        renameBtn.textContent = '이름변경';
        renameBtn.style.cssText = 'padding:4px 8px;background:transparent;color:#a0aec0;border:1px solid #4a5568;border-radius:4px;cursor:pointer;font-size:11px;';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = '불러오기';
        loadBtn.style.cssText = 'padding:4px 12px;background:#4a90d9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';

        // Rename inline area (hidden by default)
        const renameRow = document.createElement('div');
        renameRow.style.cssText = 'display:none;gap:6px;align-items:center;';
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = sceneId;
        renameInput.style.cssText = 'flex:1;padding:4px 7px;background:#161923;color:#e2e8f0;border:1px solid #4a5568;border-radius:4px;font-size:12px;font-family:monospace;';
        const confirmRenameBtn = document.createElement('button');
        confirmRenameBtn.textContent = '확인';
        confirmRenameBtn.style.cssText = 'padding:4px 10px;background:#48bb78;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;';
        const cancelRenameBtn = document.createElement('button');
        cancelRenameBtn.textContent = '취소';
        cancelRenameBtn.style.cssText = 'padding:4px 8px;background:transparent;color:#a0aec0;border:1px solid #4a5568;border-radius:4px;cursor:pointer;font-size:11px;';
        renameRow.appendChild(renameInput);
        renameRow.appendChild(confirmRenameBtn);
        renameRow.appendChild(cancelRenameBtn);

        renameBtn.addEventListener('click', () => {
          renameRow.style.display = 'flex';
          renameBtn.style.display = 'none';
          renameInput.focus();
          renameInput.select();
        });
        cancelRenameBtn.addEventListener('click', () => {
          renameRow.style.display = 'none';
          renameBtn.style.display = '';
          renameInput.value = sceneId;
        });
        confirmRenameBtn.addEventListener('click', async () => {
          const newId = renameInput.value.trim().replace(/\s+/g, '_');
          if (!newId || newId === sceneId) {
            renameRow.style.display = 'none';
            renameBtn.style.display = '';
            return;
          }
          if (!AppState.config.githubToken) { showToast('GitHub 토큰이 필요합니다.', 'error'); return; }
          confirmRenameBtn.textContent = '...';
          confirmRenameBtn.disabled = true;
          try {
            await GitHubAPI.renameScene(AppState.config.githubToken, AppState.config.targetRepo, sceneId, newId, AppState.config.branch);
            showToast(`씬 "${sceneId}" → "${newId}" 변경 완료`, 'success');
            idEl.textContent = newId;
            renameRow.style.display = 'none';
            renameBtn.style.display = '';
            // Update scene id in current session if it matches
            if (AppState.scene.id === sceneId) {
              AppState.scene.id = newId;
              AppState.autosave();
              const sid = document.querySelector('#scene-id-input');
              if (sid) sid.value = newId;
            }
            // Refresh known ids
            AppState.knownSceneIds = (AppState.knownSceneIds || []).map(id => id === sceneId ? newId : id);
            updateSceneIdDatalist();
          } catch (err) {
            showToast(`이름 변경 실패: ${err.message}`, 'error');
          } finally {
            confirmRenameBtn.textContent = '확인';
            confirmRenameBtn.disabled = false;
          }
        });

        loadBtn.addEventListener('click', async () => {
          loadBtn.textContent = '...';
          loadBtn.disabled = true;
          try {
            const json = await GitHubAPI.fetchFileContent(
              AppState.config.githubToken,
              AppState.config.targetRepo,
              `project/scenes/novel/${file.name}`
            );
            const result = Exporter.importSceneJSON(json);
            if (result.success) {
              modal.hidden = true;
              fullRerender();
              showToast(`씬 "${sceneId}"을 불러왔습니다.`, 'success');
            } else {
              showToast(result.error || '불러오기 실패', 'error');
            }
          } catch (err) {
            showToast(`불러오기 실패: ${err.message}`, 'error');
          } finally {
            loadBtn.textContent = '불러오기';
            loadBtn.disabled = false;
          }
        });

        topRow.appendChild(idEl);
        topRow.appendChild(renameBtn);
        topRow.appendChild(loadBtn);
        row.appendChild(topRow);
        row.appendChild(renameRow);
        list.appendChild(row);
      });
      content.appendChild(list);
      AppState.knownSceneIds = files.map(f => f.name.replace('.json', ''));
      updateSceneIdDatalist();
    } catch (err) {
      content.innerHTML = `<div style="color:#fc8181;text-align:center;padding:20px;">오류: ${err.message}</div>`;
    }
  };

  const setupSettingsModal = () => {
    const modal = document.querySelector('#settings-modal');
    const tokenInput = document.querySelector('#settings-github-token');
    const sourceRepoInput = document.querySelector('#settings-source-repo');
    const targetRepoInput = document.querySelector('#settings-target-repo');
    const saveBtn = document.querySelector('#btn-settings-save');
    const closeBtn = document.querySelector('#btn-settings-close');

    const openModal = () => {
      if (!modal) return;
      if (tokenInput) tokenInput.value = AppState.config.githubToken || '';
      if (sourceRepoInput) sourceRepoInput.value = AppState.config.sourceRepo || '';
      if (targetRepoInput) targetRepoInput.value = AppState.config.targetRepo || '';
      modal.hidden = false;
      modal.style.display = '';
    };

    const closeModal = () => {
      if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    };

    const btnSettings = document.querySelector('#btn-settings');
    if (btnSettings) btnSettings.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const testBtn = document.querySelector('#btn-test-token');
    const testResult = document.querySelector('#token-test-result');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const token = tokenInput ? tokenInput.value.trim() : '';
        if (!token) { if (testResult) testResult.textContent = '토큰을 입력하세요.'; return; }
        if (testResult) testResult.textContent = '확인 중...';
        try {
          const result = await GitHubAPI.testToken(token, AppState.config.targetRepo);
          if (testResult) testResult.textContent = result.valid ? (result.canWrite ? '✓ 유효 (쓰기 권한 있음)' : '✓ 유효 (읽기 전용)') : '✗ 유효하지 않은 토큰';
        } catch(e) {
          if (testResult) testResult.textContent = '✗ 오류: ' + e.message;
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        AppState.saveConfig({
          githubToken: tokenInput ? tokenInput.value.trim() : AppState.config.githubToken,
          sourceRepo: sourceRepoInput ? sourceRepoInput.value.trim() : AppState.config.sourceRepo,
          targetRepo: targetRepoInput ? targetRepoInput.value.trim() : AppState.config.targetRepo,
        });
        closeModal();
        showToast('설정이 저장되었습니다.', 'success');
      });
    }

    // Close on backdrop click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  };

  const setupEventBusListeners = () => {
    EventBus.on('timeline:updated', () => {
      if (window.PreviewPanel) PreviewPanel.render();
      updateUndoRedoButtons();
    });
    EventBus.on('preview:updated', () => {
      if (window.PreviewPanel) PreviewPanel.render();
    });
    EventBus.on('scene:loaded', () => {
      fullRerender();
    });
    EventBus.on('assets:loaded', () => {
      AssetPanelUI.render();
    });
  };

  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        AppState.undo();
        fullRerender();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        AppState.redo();
        fullRerender();
      } else if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        saveToLocal();
      } else if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        Exporter.downloadSceneJSON();
      } else if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(m => {
          m.hidden = true;
          m.style.display = 'none';
        });
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(m => {
          m.hidden = true;
          m.style.display = 'none';
        });
      }
    });
  };

  const refreshAssets = () => {
    const btn = document.querySelector('#btn-refresh-assets');
    const grid = document.querySelector('#asset-grid');

    if (btn) btn.classList.add('btn-refresh-assets--spinning');
    if (grid) grid.innerHTML = '<div class="asset-list__empty">불러오는 중...</div>';

    AssetManager.loadFromGitHub(AppState.config.sourceRepo)
      .then(() => {
        AssetPanelUI.applyStoredReclassifications();
        GitHubAPI.listScenes(AppState.config.githubToken, AppState.config.targetRepo)
          .then(files => {
            AppState.knownSceneIds = files.map(f => f.name.replace('.json', ''));
            updateSceneIdDatalist();
          }).catch(() => {});
        if (btn) btn.classList.remove('btn-refresh-assets--spinning');
        const total = AppState.assets.all.length;
        AssetPanelUI.render();
        EventBus.emit('assets:loaded', AppState.assets);
        showToast(`에셋 ${total}개 로드 완료`, 'success');
      })
      .catch((err) => {
        if (btn) btn.classList.remove('btn-refresh-assets--spinning');
        if (grid) grid.innerHTML = `<div class="asset-list__empty asset-list__error">로드 실패: ${err.message}</div>`;
        showToast(`에셋 로드 실패: ${err.message}`, 'error', 8000);
        console.error('[refreshAssets]', err);
      });
  };

  const setupButtons = () => {
    const on = (sel, event, fn) => {
      const el = document.querySelector(sel);
      if (el) el.addEventListener(event, fn);
    };

    on('#btn-refresh-assets', 'click', () => refreshAssets());
    on('#btn-scene-list', 'click', () => openSceneList());
    on('#btn-scene-list-close', 'click', () => {
      const modal = document.getElementById('scene-list-modal');
      if (modal) modal.hidden = true;
    });
    on('#btn-reclassify', 'click', () => {
      AppState.ui.activeAssetTab = 'reclassify';
      AssetPanelUI.render();
    });
    on('#btn-new', 'click', () => newScene());
    on('#btn-save', 'click', () => saveToLocal());
    on('#btn-export-json', 'click', () => Exporter.downloadSceneJSON());
    on('#btn-push-github', 'click', () => pushToGitHub());
    on('#btn-export-manifest', 'click', () => Exporter.downloadManifestJSON());

    on('#btn-load', 'click', () => {
      const fileInput = document.querySelector('#file-input');
      if (fileInput) fileInput.click();
    });

    const fileInput = document.querySelector('#file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) { loadFromFile(file); fileInput.value = ''; }
      });
    }

    on('#btn-undo', 'click', () => { AppState.undo(); fullRerender(); });
    on('#btn-redo', 'click', () => { AppState.redo(); fullRerender(); });
  };

  const checkAutosave = () => {
    const AUTOSAVE_TIME_KEY = 'vn_autosave_time';
    const savedTime = localStorage.getItem(AUTOSAVE_TIME_KEY);
    if (!savedTime) return;
    const saved = AppState.loadAutosave();
    if (!saved || !saved.events || saved.events.length === 0) return;
    const formattedTime = Utils.formatDate(savedTime);
    if (confirm(`자동저장된 장면이 있습니다 (${formattedTime}). 복원하시겠습니까?`)) {
      AppState.scene = saved;
      fullRerender();
    }
  };

  const init = () => {
    // Unregister any service workers (e.g. from Godot dosa export) that intercept
    // cross-origin fetches and return "Content unavailable. Resource was not cached"
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length > 0) {
          Promise.all(regs.map(r => r.unregister())).then(() => {
            console.log(`[SW] Unregistered ${regs.length} service worker(s). Reloading…`);
            location.reload();
          });
        }
      });
    }

    AppState.init();

    // 패널 초기 렌더 (에셋 없는 상태)
    AssetPanelUI.render();

    // 5-6. Panel init
    if (window.PreviewPanel) PreviewPanel.init();
    if (window.TimelinePanel) TimelinePanel.init();

    // Alignment panel
    if (window.AlignmentPanel) AlignmentPanel.init();

    // 7-11. Setup
    setupEventBusListeners();
    setupKeyboardShortcuts();
    setupButtons();

    const titleInput = document.querySelector('#scene-title-input');
    if (titleInput) {
      titleInput.value = AppState.scene.title;
      titleInput.addEventListener('input', Utils.debounce((e) => {
        AppState.scene.title = e.target.value || '새 장면';
        AppState.autosave();
      }, 300));
    }

    const sceneIdInput = document.querySelector('#scene-id-input');
    if (sceneIdInput) {
      sceneIdInput.value = AppState.scene.id;
      sceneIdInput.addEventListener('input', Utils.debounce((e) => {
        const val = e.target.value.trim().replace(/\s+/g, '_');
        if (val) AppState.scene.id = val;
        AppState.autosave();
      }, 300));
    }

    setupSettingsModal();

    // Autosave interval
    setInterval(() => AppState.autosave(), 30000);

    // 12. Check for autosave
    checkAutosave();

    updateUndoRedoButtons();

    // Auto-load assets on startup
    refreshAssets();
  };

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    newScene,
    saveToLocal,
    loadFromFile,
    pushToGitHub,
    setupSettingsModal,
    showToast,
    showLoading,
    hideLoading,
    updateUndoRedoButtons,
    fullRerender,
  };
})();
