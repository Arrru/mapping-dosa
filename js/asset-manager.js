window.AssetManager = (() => {
  // Map singular type names to the plural keys used in AppState.assets
  const typeToKey = (type) => {
    const map = {
      background: 'backgrounds',
      character: 'characters',
      bgm: 'bgm',
      sfx: 'sfx',
      ui: 'ui',
      image: 'ui', // fallback image files grouped under ui
    };
    return map[type] || null;
  };

  const buildAsset = (repo, branch, path, type) => ({
    id: type + '_' + Utils.getFilename(path),
    filename: Utils.getFilename(path),
    path,
    repoPath: path,
    rawUrl: GitHubAPI.getRawUrl(repo, branch, path),
    resPath: Utils.formatPath(path),
    type,
  });

  const loadFromGitHub = async (repo, branch = 'main') => {
    const tree = await GitHubAPI.fetchAssetTree(repo, branch);

    // Reset asset buckets
    AppState.assets.backgrounds = [];
    AppState.assets.characters = [];
    AppState.assets.bgm = [];
    AppState.assets.sfx = [];
    AppState.assets.ui = [];
    AppState.assets.all = [];

    for (const { path } of tree) {
      const type = Utils.classifyAsset(path);
      const asset = buildAsset(repo, branch, path, type);
      const key = typeToKey(type);
      if (key && AppState.assets[key]) {
        AppState.assets[key].push(asset);
      }
      AppState.assets.all.push(asset);
    }

    return generateManifest();
  };

  const generateManifest = () => {
    const pick = (asset) => ({
      id: asset.id,
      filename: asset.filename,
      path: asset.path,
      resPath: asset.resPath,
      rawUrl: asset.rawUrl,
    });

    const manifest = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      source_repo: AppState.config.sourceRepo,
      assets: {
        backgrounds: AppState.assets.backgrounds.map(pick),
        characters: AppState.assets.characters.map(pick),
        bgm: AppState.assets.bgm.map(pick),
        sfx: AppState.assets.sfx.map(pick),
        ui: AppState.assets.ui.map(pick),
      },
    };

    AppState.manifest = manifest;
    return manifest;
  };

  const getAssetById = (id) => {
    return AppState.assets.all.find(a => a.id === id) || null;
  };

  const getAssetsByType = (type) => {
    const key = typeToKey(type);
    if (!key) return [];
    return AppState.assets[key] || [];
  };

  const getCharacterExpressions = (characterId) => {
    const matches = AppState.assets.characters.filter(
      a => a.filename.startsWith(characterId)
    );
    if (matches.length === 0) return ['normal'];
    // Strip the character id prefix (and optional separator) to get expression name
    return matches.map(a => {
      const raw = a.filename.slice(characterId.length);
      // Remove a leading underscore or hyphen separator if present
      return raw.replace(/^[-_]/, '') || 'normal';
    });
  };

  return { loadFromGitHub, generateManifest, getAssetById, getAssetsByType, getCharacterExpressions };
})();
