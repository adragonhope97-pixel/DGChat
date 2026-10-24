// DGChat iPhone Duo —— API 薄接口层
// 通过清晰定义的 REST 接口复用现有 DGChat 后端（不复制后端代码）。
// 令牌独立存储（duo_token），与主站（zdcw_token）完全隔离。
(function () {
  const cfg = window.DUO_CONFIG || {};
  // 优先级：URL ?api= > 配置 > 同源
  const q = new URLSearchParams(location.search);
  window.DUO_API_BASE = (q.get('api') || cfg.API_BASE || '').replace(/\/$/, '');
  const TOKEN_KEY = (cfg.STORAGE_PREFIX || 'duo_') + 'token';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function call(path, options = {}) {
    const headers = {};
    const isForm = options.body instanceof FormData;
    if (!isForm) headers['Content-Type'] = 'application/json';
    const t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch(window.DUO_API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || '请求失败');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.DuoAPI = {
    call, // 通用调用（2.1 功能层使用）
    token,
    setToken,
    hasToken: () => !!token(),
    login: (username, password) => call('/api/auth/login', { method: 'POST', body: { username, password } }),
    logout: () => call('/api/auth/logout', { method: 'POST' }),
    me: () => call('/api/me'),
    posts: (q) => call('/api/posts' + (q ? '?' + q : '')),
    post: (id) => call('/api/posts/' + id),
    like: (id) => call(`/api/posts/${id}/like`, { method: 'POST' }),
    favorite: (id) => call(`/api/posts/${id}/favorite`, { method: 'POST' }),
    conversations: () => call('/api/conversations'),
    thread: (uid) => call('/api/conversations/' + uid),
    send: (toUserId, content, clientId) =>
      call('/api/messages', { method: 'POST', body: { toUserId, content, clientId } }),
    unread: () => call('/api/me/unread'),
    boards: () => call('/api/boards'),
  };
})();
