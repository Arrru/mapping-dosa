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
  const TABS = ['backgrounds', 'characters', 'bgm', 'sfx', 'reclassify', 'ui', 'recent'];

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

  const reclassifyAsset = (asset, newType) => {
    const uiIdx = AppState.assets.ui.indexOf(asset);
    if (uiIdx !== -1) AppState.assets.ui.splice(uiIdx, 1);

    const oldId = asset.id;
    asset.type = newType;
    asset.id = newType + '_' + asset.filename;

    const allIdx = AppState.assets.all.findIndex(a => a.id === oldId);
    if (allIdx !== -1) AppState.assets.all[allIdx] = asset;

    if (newType === 'character') {
      AppState.assets.characters.push(asset);
    } else {
      AppState.assets.backgrounds.push(asset);
    }

    const labelKo = newType === 'character' ? '캐릭터' : '배경';
    if (window.App) App.showToast(`${asset.filename} → ${labelKo} 탭으로 이동했습니다.`, 'success');
    render();
  };

  const renderTab = (type) => {
    const container = document.querySelector('#asset-grid');
    if (!container) return;
    container.innerHTML = '';

    if (type === 'reclassify') {
      const imageAssets = AppState.assets.ui.filter(a => Utils.isImageFile(a.path));
      if (imageAssets.length === 0) {
        container.innerHTML = '<div class="asset-list__empty">UI 카테고리에 이동 가능한 이미지가 없습니다.</div>';
        return;
      }
      for (const asset of imageAssets) {
        const card = createImageCard(asset);
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:4px;padding:4px 6px 6px;';
        const charBtn = document.createElement('button');
        charBtn.textContent = '캐릭터로';
        charBtn.style.cssText = 'flex:1;padding:3px 4px;background:#ed8936;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;';
        charBtn.addEventListener('click', (e) => { e.stopPropagation(); reclassifyAsset(asset, 'character'); });
        const bgBtn = document.createElement('button');
        bgBtn.textContent = '배경으로';
        bgBtn.style.cssText = 'flex:1;padding:3px 4px;background:#4a90d9;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;';
        bgBtn.addEventListener('click', (e) => { e.stopPropagation(); reclassifyAsset(asset, 'background'); });
        btnRow.appendChild(charBtn);
        btnRow.appendChild(bgBtn);
        card.appendChild(btnRow);
        attachCardListeners(card, asset);
        container.appendChild(card);
      }
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

  return { render, renderTab };
})();

window.App = (() => {
  const fullRerender = () => {
    if (window.PreviewPanel) PreviewPanel.render();
    if (window.TimelinePanel) TimelinePanel.render();
    AssetPanelUI.render();
    updateUndoRedoButtons();
    const t = document.querySelector('#scene-title-input'); if (t) t.value = AppState.scene.title;
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
