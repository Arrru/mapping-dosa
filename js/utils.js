window.Utils = (() => {
  const generateId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = 'evt_';
    for (let i = 0; i < 9; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  };

  const formatPath = (repoPath) => {
    const cleaned = repoPath.startsWith('/') ? repoPath.slice(1) : repoPath;
    return 'res://' + cleaned;
  };

  const getFilename = (path) => {
    const base = path.split('/').pop();
    const dot = base.lastIndexOf('.');
    return dot !== -1 ? base.slice(0, dot) : base;
  };

  const getExtension = (path) => {
    const base = path.split('/').pop();
    const dot = base.lastIndexOf('.');
    return dot !== -1 ? base.slice(dot + 1).toLowerCase() : '';
  };

  const isImageFile = (path) => {
    return ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(getExtension(path));
  };

  const isSoundFile = (path) => {
    return ['mp3', 'ogg', 'wav'].includes(getExtension(path));
  };

  const debounce = (fn, delay) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  const classifyAsset = (path) => {
    if (path.includes('backgrounds')) return 'background';
    if (path.includes('portraits') || path.includes('characters')) return 'character';
    if (path.includes('/ui/')) return 'ui';
    if (path.includes('sounds')) {
      if (path.includes('bgm') || path.includes('music')) return 'bgm';
      if (path.includes('sfx') || path.includes('se/') || path.includes('effect')) return 'sfx';
      // generic sound file defaults to bgm
      return 'bgm';
    }
    if (isSoundFile(path)) return 'bgm';
    if (isImageFile(path)) return 'image';
    return 'image';
  };

  return {
    generateId,
    formatPath,
    getFilename,
    getExtension,
    isImageFile,
    isSoundFile,
    debounce,
    formatDate,
    deepClone,
    classifyAsset,
  };
})();
