window.GitHubAPI = (() => {
  const BASE = 'https://api.github.com';

  const throwIfError = async (res, context) => {
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body.message ? `: ${body.message}` : '';
      } catch (_) {}
      throw new Error(`${context} failed (${res.status})${detail}`);
    }
  };

  const authHeaders = (token) => {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;
    return headers;
  };

  // Encode a UTF-8 string to base64, safe for Unicode characters
  const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));

  const fetchAssetTree = async (repo, branch = 'main') => {
    const url = `${BASE}/repos/${repo}/git/trees/${branch}?recursive=1`;
    const res = await fetch(url, { headers: authHeaders(''), cache: 'no-store' });
    await throwIfError(res, `fetchAssetTree(${repo}@${branch})`);
    const data = await res.json();
    return (data.tree || []).filter(
      item => item.type === 'blob' && (Utils.isImageFile(item.path) || Utils.isSoundFile(item.path))
    ).map(({ path, type, sha }) => ({ path, type, sha }));
  };

  const getRawUrl = (repo, branch, path) =>
    `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;

  const pushFile = async (token, repo, path, content, commitMessage, branch = 'main') => {
    const headers = {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    };

    // Fetch existing SHA if the file already exists
    let sha;
    const getRes = await fetch(`${BASE}/repos/${repo}/contents/${path}`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    } else if (getRes.status !== 404) {
      await throwIfError(getRes, `pushFile get SHA (${path})`);
    }

    const body = {
      message: commitMessage,
      content: toBase64(content),
      branch,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    await throwIfError(putRes, `pushFile(${path})`);
    const result = await putRes.json();
    return { success: true, url: result.content?.html_url || '' };
  };

  const pushMultipleFiles = async (token, repo, files, branch = 'main') => {
    const results = [];
    for (const file of files) {
      const result = await pushFile(token, repo, file.path, file.content, file.message, branch);
      results.push(result);
    }
    return results;
  };

  const testToken = async (token, repo) => {
    const out = { valid: false, canWrite: false, repoExists: false };
    try {
      const res = await fetch(`${BASE}/repos/${repo}`, { headers: authHeaders(token) });
      if (res.status === 404) return out;
      if (!res.ok) return out;
      out.repoExists = true;
      const data = await res.json();
      out.valid = true;
      out.canWrite = !!(data.permissions && data.permissions.push);
    } catch (_) {}
    return out;
  };

  const listScenes = async (token, repo) => {
    const res = await fetch(`${BASE}/repos/${repo}/contents/project/scenes/novel`, {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter(f => f.name.endsWith('.json')) : [];
  };

  const fetchFileContent = async (token, repo, path) => {
    const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
      headers: authHeaders(token),
      cache: 'no-store',
    });
    await throwIfError(res, `fetchFileContent(${path})`);
    const data = await res.json();
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  };

  return { fetchAssetTree, getRawUrl, pushFile, pushMultipleFiles, testToken, listScenes, fetchFileContent };
})();
