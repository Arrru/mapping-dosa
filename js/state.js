window.AppState = (() => {
  const AUTOSAVE_KEY = 'vn_autosave';
  const AUTOSAVE_TIME_KEY = 'vn_autosave_time';
  const CONFIG_KEY = 'vn_config';
  const RECENT_ASSETS_KEY = 'vn_recent_assets';
  const MAX_HISTORY = 50;
  const MAX_RECENT = 10;

  const freshScene = () => ({
    id: Utils.generateId(),
    title: '새 장면',
    events: [],
    preview: {
      background: null,
      characters: { left: null, center: null, right: null },
      bgm: null,
    },
    // Free-form placement state — array of place items.
    // Each item: { item_id, asset_kind, asset_id, path, rawUrl, filename,
    //              rect:{x,y,w,h} (0~1 normalized), z, event_id }
    placedItems: [],
  });

  const state = {
    config: {
      sourceRepo: 'Arrru/dosa',
      targetRepo: 'Arrru/dosa',
      branch: 'main',
      githubToken: '',
    },
    assets: {
      backgrounds: [],
      characters: [],
      bgm: [],
      sfx: [],
      ui: [],
      all: [],
    },
    manifest: null,
    scene: freshScene(),
    ui: {
      activeAssetTab: 'backgrounds',
      selectedEventIndex: null,
      selectedPlacedId: null,
      selectedPlacedIds: [],
      recentAssets: [],
      isLoading: false,
      loadingMessage: '',
    },
    history: {
      past: [],
      future: [],
    },

    init() {
      this.loadConfig();
      const saved = this.loadAutosave();
      if (saved) {
        this.scene = saved;
      }
      try {
        const recent = localStorage.getItem(RECENT_ASSETS_KEY);
        if (recent) this.ui.recentAssets = JSON.parse(recent);
      } catch (_) {
        this.ui.recentAssets = [];
      }
    },

    saveToHistory() {
      this.history.past.push(Utils.deepClone(this.scene));
      if (this.history.past.length > MAX_HISTORY) {
        this.history.past.shift();
      }
      this.history.future = [];
    },

    undo() {
      if (!this.canUndo()) return;
      this.history.future.push(Utils.deepClone(this.scene));
      this.scene = this.history.past.pop();
    },

    redo() {
      if (!this.canRedo()) return;
      this.history.past.push(Utils.deepClone(this.scene));
      this.scene = this.history.future.pop();
    },

    addRecentAsset(asset) {
      this.ui.recentAssets = this.ui.recentAssets.filter(a => a.id !== asset.id);
      this.ui.recentAssets.unshift(asset);
      if (this.ui.recentAssets.length > MAX_RECENT) {
        this.ui.recentAssets = this.ui.recentAssets.slice(0, MAX_RECENT);
      }
      try {
        localStorage.setItem(RECENT_ASSETS_KEY, JSON.stringify(this.ui.recentAssets));
      } catch (_) {}
    },

    autosave() {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.scene));
        localStorage.setItem(AUTOSAVE_TIME_KEY, new Date().toISOString());
      } catch (_) {}
    },

    loadAutosave() {
      try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    },

    saveConfig(config) {
      Object.assign(this.config, config);
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
      } catch (_) {}
    },

    loadConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (raw) Object.assign(this.config, JSON.parse(raw));
      } catch (_) {}
    },

    newScene() {
      this.scene = freshScene();
      this.history.past = [];
      this.history.future = [];
    },

    canUndo() {
      return this.history.past.length > 0;
    },

    canRedo() {
      return this.history.future.length > 0;
    },
  };

  return state;
})();
