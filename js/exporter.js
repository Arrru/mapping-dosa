window.Exporter = (() => {
  const triggerDownload = (content, filename, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSceneJSON = () => {
    const scene = AppState.scene;
    const warnings = [];

    for (const evt of scene.events) {
      if (evt.asset_id == null && ['background', 'bgm_play', 'sfx_play', 'character_show', 'expression_change'].includes(evt.type)) {
        warnings.push(`이벤트 ${evt.id} (${evt.type})에 asset_id가 없습니다.`);
      }
    }
    if (warnings.length > 0) {
      console.warn('[Exporter] scene.json 경고:\n' + warnings.join('\n'));
    }

    const output = {
      scene_id: scene.id,
      title: scene.title,
      version: '1.0',
      created_at: new Date().toISOString(),
      events: scene.events,
    };
    return JSON.stringify(output, null, 2);
  };

  const downloadSceneJSON = () => {
    const json = exportSceneJSON();
    triggerDownload(json, `${AppState.scene.id}.json`);
  };

  const downloadManifestJSON = () => {
    const json = JSON.stringify(AppState.manifest, null, 2);
    triggerDownload(json, 'asset_manifest.json');
  };

  const pushToGitHub = async () => {
    const token = AppState.config.githubToken;
    if (!token) throw new Error('GitHub 토큰이 필요합니다');

    const sceneJson = exportSceneJSON();
    const manifestJson = JSON.stringify(AppState.manifest, null, 2);
    const repo = AppState.config.targetRepo;
    const sceneId = AppState.scene.id;
    const now = new Date().toISOString().slice(0, 10);

    const files = [
      {
        path: `project/scenes/novel/${sceneId}.json`,
        content: sceneJson,
        message: `scene: update ${sceneId} (${now})`,
      },
      {
        path: 'asset_manifest.json',
        content: manifestJson,
        message: `manifest: update asset manifest (${now})`,
      },
    ];

    try {
      const results = await GitHubAPI.pushMultipleFiles(token, repo, files, AppState.config.branch);
      const url = `https://github.com/${repo}/blob/${AppState.config.branch}/project/scenes/novel/${sceneId}.json`;
      if (window.App && App.showToast) {
        App.showToast(`GitHub에 저장되었습니다. ${url}`, 'success');
      }
      await _triggerDosaBuild(token);
      return { success: true, urls: results.map(r => r.url) };
    } catch (err) {
      if (window.App && App.showToast) {
        App.showToast(`GitHub 푸시 실패: ${err.message}`, 'error');
      }
      return { success: false, urls: [] };
    }
  };

  const exportAndPush = async () => {
    if (window.App && App.showLoading) App.showLoading('저장 중...');
    try {
      exportSceneJSON();
      if (window.App && App.showLoading) App.showLoading('푸시 중...');
      const result = await pushToGitHub();
      if (window.App && App.showLoading) App.showLoading('완료!');
      setTimeout(() => { if (window.App && App.hideLoading) App.hideLoading(); }, 800);
      return result;
    } catch (err) {
      if (window.App && App.hideLoading) App.hideLoading();
      if (window.App && App.showToast) App.showToast(`오류: ${err.message}`, 'error');
      return { success: false, urls: [] };
    }
  };

  const _triggerDosaBuild = async (token) => {
    try {
      const res = await fetch('https://api.github.com/repos/Arrru/dosa/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: 'scenes-updated' }),
      });
      if (res.status === 204) {
        if (window.App && App.showToast) App.showToast('dosa 빌드가 자동으로 시작되었습니다.', 'success');
      } else {
        console.warn('[Exporter] dosa 빌드 트리거 실패:', res.status);
      }
    } catch (err) {
      console.warn('[Exporter] dosa 빌드 트리거 오류:', err.message);
    }
  };

  const validateScene = () => {
    const scene = AppState.scene;
    const warnings = [];
    if (!scene.title || scene.title.trim() === '') {
      warnings.push('장면 제목이 없습니다.');
    }
    if (!scene.events || scene.events.length === 0) {
      warnings.push('이벤트가 하나도 없습니다.');
    }
    return { valid: warnings.length === 0, warnings };
  };

  const importSceneJSON = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.scene_id || !Array.isArray(parsed.events)) {
        return { success: false, error: '유효하지 않은 scene.json 형식입니다 (scene_id 또는 events 누락).' };
      }
      AppState.saveToHistory();
      AppState.scene = {
        id: parsed.scene_id,
        title: parsed.title || '가져온 장면',
        events: parsed.events,
        preview: AppState.scene.preview || { background: null, characters: { left: null, center: null, right: null }, bgm: null },
      };
      if (window.EventBus) EventBus.emit('scene:loaded', AppState.scene);
      return { success: true };
    } catch (err) {
      return { success: false, error: `JSON 파싱 오류: ${err.message}` };
    }
  };

  return {
    exportSceneJSON,
    downloadSceneJSON,
    downloadManifestJSON,
    pushToGitHub,
    exportAndPush,
    validateScene,
    importSceneJSON,
  };
})();
