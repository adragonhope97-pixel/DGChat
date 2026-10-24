// 校园墙前端交互逻辑（纯原生 JS，无框架，方便后续学习与修改）

// 原生 App（Capacitor）里页面从本地打包文件加载，接口和图片需要绝对地址；
// 浏览器（网页版/PWA）里页面由服务器提供，用相对路径即可
const IS_NATIVE = !!window.Capacitor;
const BRAND = window.BRAND || { name: 'Campus Wall', nameZh: '校园墙', tagline: '', title: '校园墙', nativeServerHost: '' };
const SERVER_HOST = IS_NATIVE ? BRAND.nativeServerHost : '';
const API = SERVER_HOST + '/api';
// 把服务端返回的相对地址（如 /uploads/x.png）补全为可加载的地址
const absUrl = (u) => (u && u.startsWith('/') ? SERVER_HOST + u : u);

// 把品牌配置应用到页面（标题 / 顶栏 / 页脚）
function applyBrand() {
  document.title = BRAND.title;
  $('#brandName').textContent = BRAND.name;
  $('#brandSub').textContent = BRAND.nameZh;
  $('#footerBrand').textContent = [BRAND.name, BRAND.nameZh, BRAND.tagline].filter(Boolean).join(' · ');
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.content = BRAND.name;
}

// ---------- 全局状态 ----------
let token = localStorage.getItem('zdcw_token') || '';
let me = null;
let boards = [];
let currentBoard = 'all';
let currentSort = 'latest';
let currentQuery = '';
let searchTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// 极简线性图标（内联 SVG，随文字颜色变化）
const ICONS = {
  heart:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFill:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  bubble:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  edit:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  trash:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>',
  bookmark:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  bookmarkFill:
    '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
};

// ---------- 基础工具 ----------

async function api(path, options = {}) {
  const headers = {};
  const isForm = options.body instanceof FormData;
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || '请求失败，请稍后重试');
    err.status = res.status;
    throw err;
  }
  return data;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  if (d < 7) return d + ' 天前';
  const date = new Date(ts);
  const thisYear = new Date().getFullYear() === date.getFullYear();
  return date.getFullYear() === thisYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function avatarHtml(author, postAnonymous) {
  if (!author) return `<div class="avatar anon">匿</div>`;
  if (author.avatar) {
    return `<div class="avatar has-img"><img src="${escapeHtml(absUrl(author.avatar))}" alt="" loading="lazy" /></div>`;
  }
  const ch = escapeHtml(author.nickname.slice(0, 1).toUpperCase());
  return `<div class="avatar" style="background:${author.avatarColor}">${ch}</div>`;
}

function authorName(author, anonymous) {
  const name = author ? escapeHtml(author.nickname) : '匿名同学';
  const badge =
    author && author.role === 'admin'
      ? '<span class="admin-tag">管理员</span>'
      : '';
  return name + badge;
}

// ---------- 弹层通用 ----------

function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; }

$$('.modal-mask').forEach((mask) => {
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.hidden = true;
  });
});
$$('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// ---------- 登录状态 ----------

async function refreshMe() {
  if (!token) { me = null; renderUserArea(); return; }
  try {
    const data = await api('/me');
    me = data.user;
    if (!me) { token = ''; localStorage.removeItem('zdcw_token'); }
  } catch {
    me = null;
  }
  renderUserArea();
}

function renderUserArea() {
  if (window.renderNotifBell) renderNotifBell();
  const area = $('#userArea');
  if (me) {
    area.innerHTML = `
      <div class="user-chip" id="userChip">
        ${
          me.avatar
            ? `<div class="avatar" style="width:30px;height:30px"><img src="${escapeHtml(absUrl(me.avatar))}" alt="" /></div>`
            : `<div class="avatar" style="width:30px;height:30px;font-size:13px;background:${me.avatarColor}">${escapeHtml(me.nickname.slice(0, 1).toUpperCase())}</div>`
        }
        <span class="nickname">${escapeHtml(me.nickname)}</span>
        <div class="user-menu" id="userMenu" hidden>
          <div class="menu-profile">
            <div class="menu-nickname">${escapeHtml(me.nickname)}${me.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</div>
            <div class="menu-sub">@${escapeHtml(me.username)}${me.email ? ' · ' + escapeHtml(me.email) : ''}</div>
          </div>
          <button id="myPostsBtn">我的帖子</button>
          <button id="logoutBtn" class="danger">退出登录</button>
        </div>
      </div>`;
    $('#userChip').addEventListener('click', () => {
      $('#userMenu').hidden = !$('#userMenu').hidden;
    });
    $('#myPostsBtn').addEventListener('click', (e) => {
      e.stopPropagation(); // 防止冒泡到 userChip 的开关又把菜单弹开
      $('#userMenu').hidden = true;
      currentBoard = 'mine';
      renderBoardChips();
      loadPosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('#logoutBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await api('/auth/logout', { method: 'POST' }); } catch {}
      token = '';
      me = null;
      localStorage.removeItem('zdcw_token');
      if (currentBoard === 'mine') currentBoard = 'all';
      renderUserArea();
      renderBoardChips();
      loadPosts();
      toast('已退出登录');
    });
  } else {
    area.innerHTML = `<button class="login-btn" id="loginBtn">登录 / 注册</button>`;
    $('#loginBtn').addEventListener('click', openAuthModal);
  }
}

// ---------- 登录 / 注册弹窗 ----------

let authMode = 'login';

function openAuthModal() {
  authMode = 'login';
  $('#authError').hidden = true;
  $('#authForm').reset();
  setAuthMode('login');
  openModal('authModal');
}

function setAuthMode(mode) {
  authMode = mode;
  $('#authTitle').textContent = mode === 'login' ? '登录' : '注册新账号';
  $('#authSubmit').textContent = mode === 'login' ? '登 录' : '注 册';
  $('#nicknameField').hidden = mode === 'login';
  $('#emailField').hidden = mode === 'login';
  $('#authPassword').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.authTab === mode));
}

$$('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $('#authError').hidden = true;
    setAuthMode(tab.dataset.authTab);
  });
});

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = $('#authUsername').value.trim();
  const password = $('#authPassword').value;
  const nickname = $('#authNickname').value.trim();
  $('#authError').hidden = true;
  try {
    const path = authMode === 'login' ? '/auth/login' : '/auth/register';
    const body =
      authMode === 'login'
        ? { username, password }
        : { username, password, nickname, email: $('#authEmail').value.trim() };
    const data = await api(path, { method: 'POST', body });
    token = data.token;
    me = data.user;
    localStorage.setItem('zdcw_token', token);
    closeModal('authModal');
    renderUserArea();
    renderBoardChips(); // 登录后标签栏需重新渲染（出现“我的帖子”）
    loadPosts();
    updateUnreadBadge();
    toast(authMode === 'login' ? `欢迎回来，${data.user.nickname}！` : `注册成功，欢迎加入校园墙！`);
  } catch (err) {
    const el = $('#authError');
    el.textContent = err.message;
    el.hidden = false;
  }
});

// ---------- 版块 ----------

function renderBoardChips() {
  const wrap = $('#boardChips');
  const items = [{ id: 'all', name: '全部' }, ...boards];
  if (me) items.push({ id: 'mine', name: '我的帖子' });
  wrap.innerHTML = items
    .map(
      (b) =>
        `<button class="chip ${currentBoard === b.id ? 'active' : ''}" data-board="${b.id}">${b.name}</button>`
    )
    .join('');
  wrap.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      currentBoard = chip.dataset.board;
      renderBoardChips();
      loadPosts();
    });
  });
}

$$('.sort-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentSort = btn.dataset.sort;
    $$('.sort-btn').forEach((b) => b.classList.toggle('active', b === btn));
    loadPosts();
  });
});

// ---------- 帖子列表 ----------

async function loadPosts() {
  const params = new URLSearchParams();
  if (currentBoard === 'mine') {
    params.set('mine', '1');
  } else if (currentBoard !== 'all') {
    params.set('board', currentBoard);
  }
  if (currentQuery) params.set('q', currentQuery);
  params.set('sort', currentSort);
  $('#postList').innerHTML = Array(3)
    .fill(
      '<div class="sk-card"><div class="sk-row"><div class="sk sk-avatar"></div><div class="sk sk-line" style="width:32%"></div></div><div class="sk sk-line" style="width:70%"></div><div class="sk sk-line" style="width:92%"></div></div>'
    )
    .join('');
  try {
    const data = await api('/posts?' + params.toString());
    renderPosts(data.posts);
  } catch (err) {
    if (err.status === 401) {
      // 登录态失效（如数据被重置），回退到全部
      token = '';
      me = null;
      localStorage.removeItem('zdcw_token');
      currentBoard = 'all';
      renderUserArea();
      renderBoardChips();
      toast('登录已失效，请重新登录', 'error');
      return loadPosts();
    }
    toast(err.message, 'error');
  }
}

// 渲染一组帖子卡片到指定容器（帖子页 / 我的页共用），并绑定交互
function renderPostCards(listEl, posts, emptyEl) {
  listEl.innerHTML = posts.map(postCardHtml).join('');
  if (emptyEl) emptyEl.hidden = posts.length > 0;

  listEl.querySelectorAll('.post-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(Number(card.dataset.id)));
  });
  listEl.querySelectorAll('.like-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLike(Number(btn.dataset.id), btn);
    });
  });
  listEl.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(Number(btn.dataset.id), btn);
    });
  });
  listEl.querySelectorAll('.act-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(Number(btn.dataset.id));
    });
  });
  listEl.querySelectorAll('.act-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePost(Number(btn.dataset.id));
    });
  });
  listEl.querySelectorAll('.act-hide-post').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api(`/posts/${btn.dataset.id}/hide-personal`, { method: 'POST' });
        toast('已隐藏这条动态');
        btn.closest('.post-card').remove();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
  if (window.bindTopicChips) window.bindTopicChips(listEl);
}

function renderPosts(posts) {
  renderPostCards($('#postList'), posts, $('#emptyState'));
}

// ---------- 收藏 ----------

async function toggleFav(postId, btn) {
  if (!me) return openAuthModal();
  try {
    const adding = !btn.classList.contains('fav');
    const data = await api(`/posts/${postId}/favorite`, { method: adding ? 'POST' : 'DELETE' });
    btn.classList.toggle('fav', data.favoritedByMe);
    btn.innerHTML = `${data.favoritedByMe ? ICONS.bookmarkFill : ICONS.bookmark} <span class="fav-count">${data.favoriteCount}</span>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

function postCardHtml(p) {
  return `
    <liquid-glass class="post-card" data-id="${p.id}" interactive>
      <div class="post-head">
        ${avatarHtml(p.author, p.anonymous)}
        <div class="post-meta">
          <div class="author-name">
            ${authorName(p.author, p.anonymous)}
            ${p.anonymous ? '<span class="board-tag" style="color:#8b968f;background:#eef1ef">匿名</span>' : ''}
            ${p.isMine ? '<span class="mine-tag">我</span>' : ''}
            ${p.status === 'draft' ? '<span class="state-tag draft-tag">草稿</span>' : ''}
            ${p.visibility === 'private' ? '<span class="state-tag private-tag">仅自己</span>' : ''}
            ${p.hidden ? '<span class="state-tag hidden-tag">已隐藏</span>' : ''}
          </div>
          <div class="post-time">${timeAgo(p.createdAt)}</div>
        </div>
        <span class="board-tag">${escapeHtml(p.boardName)}</span>
      </div>
      ${(p.topics || []).length ? `<div class="post-topics">${p.topics.map((t) => `<button class="topic-chip" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      ${postImagesHtml(p)}
      <div class="post-foot">
        <button class="foot-btn like-btn ${p.likedByMe ? 'liked' : ''}" data-id="${p.id}">
          ${p.likedByMe ? ICONS.heartFill : ICONS.heart} <span class="like-count">${p.likeCount}</span>
        </button>
        <span class="foot-stat">${ICONS.bubble} ${p.commentCount}</span>
        <button class="foot-btn fav-btn ${p.favoritedByMe ? 'fav' : ''}" data-id="${p.id}">
          ${p.favoritedByMe ? ICONS.bookmarkFill : ICONS.bookmark} <span class="fav-count">${p.favoriteCount}</span>
        </button>
        ${
          p.canDelete
            ? `<span class="post-actions">
                 ${p.isMine ? `<button class="foot-btn act-edit" data-id="${p.id}" title="编辑">${ICONS.edit}</button>` : ''}
                 <button class="foot-btn act-del" data-id="${p.id}" title="${p.isMine ? '删除' : '管理员删除'}">${ICONS.trash}</button>
               </span>`
            : me && !p.anonymous
              ? `<span class="post-actions"><button class="foot-btn act-hide-post" data-id="${p.id}" title="隐藏这条动态">${ICONS.eyeOff}</button></span>`
              : ''
        }
      </div>
    </liquid-glass>`;
}

// ---------- 点赞 ----------

async function toggleLike(postId, btn) {
  if (!me) return openAuthModal();
  try {
    const data = await api(`/posts/${postId}/like`, { method: 'POST' });
    btn.classList.toggle('liked', data.likedByMe);
    btn.innerHTML = `${data.likedByMe ? ICONS.heartFill : ICONS.heart} <span class="like-count">${data.likeCount}</span>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- 编辑 / 删除自己的帖子 ----------

async function openEditModal(postId) {
  try {
    const data = await api(`/posts/${postId}`);
    const p = data.post;
    if (!p.isMine) return toast('只能编辑自己的帖子', 'error');
    $('#editPostId').value = p.id;
    $('#editBoardTag').textContent = p.boardName;
    $('#editTitle').value = p.title;
    $('#editContent').value = p.content;
    editPicker.clear();
    editPicker.addUrls(p.images || []);
    openModal('editPostModal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#editPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#editPostId').value;
  const fd = new FormData();
  fd.append('title', $('#editTitle').value.trim());
  fd.append('content', $('#editContent').value.trim());
  fd.append('existingImages', JSON.stringify(editPicker.urls()));
  editPicker.files().forEach((f) => fd.append('images', f));
  try {
    await api(`/posts/${id}`, { method: 'PUT', body: fd });
    closeModal('editPostModal');
    toast('修改已保存');
    loadPosts();
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function deletePost(postId, fromDetail = false) {
  if (!confirm('确定删除这条帖子吗？评论也会一并删除。')) return;
  try {
    await api(`/posts/${postId}`, { method: 'DELETE' });
    if (fromDetail) closeModal('detailModal');
    toast('帖子已删除');
    loadPosts();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Esc 关闭最上层的弹窗
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const id of ['securityModal', 'privacyModal', 'topicModal', 'folderPickerModal', 'favManagerModal', 'searchModal', 'notifModal', 'adminModal', 'creatorModal', 'relationsModal', 'interestsModal', 'userModal', 'reportModal', 'detailModal', 'editPostModal', 'newPostModal', 'authModal', 'dmModal']) {
    const mask = $('#' + id);
    if (mask && !mask.hidden) {
      mask.hidden = true;
      return;
    }
  }
});

// ---------- 发帖 ----------

let newPostDraftMode = false;

async function openNewPostModal() {
  if (!me) {
    toast('发帖前请先登录', 'error');
    return openAuthModal();
  }
  newPostDraftMode = false;
  $('#postVisibility').value = 'public';
  // 恢复本地自动保存的草稿
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (saved && (saved.title || saved.content)) {
      $('#postTitle').value = saved.title || '';
      $('#postContent').value = saved.content || '';
      $('#postVisibility').value = saved.visibility || 'public';
      $('#postAnonymous').checked = !!saved.anonymous;
      const el = $('#draftSaveState');
      if (el) el.textContent = '已恢复 ' + new Date(saved.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) + ' 的本地草稿';
    }
  } catch {}
  const sel = $('#postBoard');
  sel.innerHTML = boards.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  if (boards.some((b) => b.id === currentBoard)) sel.value = currentBoard;
  $('#newPostForm').reset();
  newPicker.clear();
  if (boards.some((b) => b.id === currentBoard)) sel.value = currentBoard; // reset 后重新赋值
  openModal('newPostModal');
}

$('#fabNew').addEventListener('click', openNewPostModal);

// ---------- 2.1 发帖草稿自动保存（本地暂存，与服务器草稿区分） ----------
const draftKey = () => 'zdcw_draft_new_' + (me ? me.id : 'anon');
let draftSaveTimer = null;
let draftSaveState = 'idle';

function scheduleDraftSave() {
  if (!me) return;
  clearTimeout(draftSaveTimer);
  const el = $('#draftSaveState');
  if (el) el.textContent = '保存中…';
  draftSaveState = 'saving';
  draftSaveTimer = setTimeout(() => {
    try {
      const snap = {
        board: $('#postBoard').value,
        title: $('#postTitle').value,
        content: $('#postContent').value,
        visibility: $('#postVisibility').value,
        anonymous: $('#postAnonymous').checked,
        updatedAt: Date.now(),
      };
      const prev = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      if (prev && prev.updatedAt > snap.updatedAt) return; // 其他标签页更新过，保留较新版本
      localStorage.setItem(draftKey(), JSON.stringify(snap));
      draftSaveState = 'saved';
      if (el) el.textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
    } catch {
      draftSaveState = 'failed';
      if (el) el.textContent = '保存失败（本地存储不可用）';
    }
  }, 1500);
}

['input', 'change'].forEach((evt) => {
  $('#newPostForm').addEventListener(evt, scheduleDraftSave);
});
window.addEventListener('storage', (e) => {
  if (e.key === draftKey() && draftSaveState !== 'saving') {
    const el = $('#draftSaveState');
    if (el && !$('#newPostModal').hidden) el.textContent = '已在其他标签页更新';
  }
});
window.addEventListener('offline', () => {
  const el = $('#draftSaveState');
  if (el && !$('#newPostModal').hidden) el.textContent = '离线中，内容已暂存本地';
});

$('#newPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('board', $('#postBoard').value);
  fd.append('title', $('#postTitle').value.trim());
  fd.append('content', $('#postContent').value.trim());
  fd.append('anonymous', $('#postAnonymous').checked);
  fd.append('visibility', $('#postVisibility').value);
  fd.append('draft', newPostDraftMode ? 'true' : 'false');
  newPicker.files().forEach((f) => fd.append('images', f));
  try {
    await api('/posts', { method: 'POST', body: fd });
    newPostDraftMode = false;
    localStorage.removeItem(draftKey());
    const dss = $('#draftSaveState');
    if (dss) dss.textContent = '';
    closeModal('newPostModal');
    toast('发布成功！');
    currentBoard = fd.get('board');
    currentSort = 'latest';
    $$('.sort-btn').forEach((b) => b.classList.toggle('active', b.dataset.sort === 'latest'));
    renderBoardChips();
    loadPosts();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- 帖子详情 ----------

async function openDetail(postId) {
  try {
    const data = await api(`/posts/${postId}`);
    renderDetail(data.post, data.comments);
    openModal('detailModal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderDetail(p, comments) {
  const box = $('#detailBox');
  box.innerHTML = `
    <div class="modal-head">
      <h2>帖子详情</h2>
      <button class="close-btn" data-close="detailModal">✕</button>
    </div>
    <span class="detail-board-tag">${escapeHtml(p.boardName)}</span>
    ${(p.topics || []).length ? `<div class="post-topics">${p.topics.map((t) => `<button class="topic-chip" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>` : ''}
    <h1 class="detail-title">${escapeHtml(p.title)}</h1>
    <div class="detail-author${p.author && !p.isMine ? ' author-link' : ''}" ${p.author && !p.isMine ? `data-uid="${p.author.id}"` : ''}>
      ${avatarHtml(p.author, p.anonymous)}
      <div>
        <div class="author-name">${authorName(p.author, p.anonymous)} ${p.isMine ? '<span class="mine-tag">我</span>' : ''}</div>
        <div class="post-time">${timeAgo(p.createdAt)}</div>
      </div>
    </div>
    <div class="detail-content">${escapeHtml(p.content)}</div>
    ${detailImagesHtml(p)}
    <div class="detail-actions">
      <button class="foot-btn like-btn ${p.likedByMe ? 'liked' : ''}" data-id="${p.id}">
        ${p.likedByMe ? ICONS.heartFill : ICONS.heart} <span class="like-count">${p.likeCount}</span>&nbsp;点赞
      </button>
      <button class="foot-btn fav-btn ${p.favoritedByMe ? 'fav' : ''}" data-id="${p.id}">
        ${p.favoritedByMe ? ICONS.bookmarkFill : ICONS.bookmark} <span class="fav-count">${p.favoriteCount}</span>&nbsp;收藏
      </button>
      ${p.author && !p.isMine ? `<button class="foot-btn dm-open-btn" data-uid="${p.author.id}" data-name="${escapeHtml(p.author.nickname)}">${ICONS.bubble}&nbsp;私信</button>` : ''}
      ${me && !p.isMine ? `<button class="foot-btn act-hide-post-detail" title="隐藏这条动态">${ICONS.eyeOff}&nbsp;隐藏</button>` : ''}
      ${me ? `<button class="foot-btn fav-folder-btn" title="收藏到文件夹">${ICONS.folder}&nbsp;收藏夹</button>` : ''}
      ${p.isMine ? `<button class="foot-btn act-edit-detail" title="编辑">${ICONS.edit}&nbsp;编辑此帖</button>` : ''}
      ${p.canDelete ? `<button class="foot-btn act-del-detail" title="${p.isMine ? '删除' : '管理员删除'}">${ICONS.trash}&nbsp;${p.isMine ? '删除此帖' : '管理员删除'}</button>` : ''}
    </div>
    <div class="comments-title">评论（${comments.length}）</div>
    <div class="comment-list">
      ${
        comments.length
          ? comments.map(commentHtml).join('')
          : '<div class="comment-empty">还没有评论，来抢沙发～</div>'
      }
    </div>
    ${
      me
        ? `<div class="comment-input-bar">
             <textarea id="commentInput" rows="2" maxlength="2000" placeholder="友善评论，温暖校园…"></textarea>
             <div>
               <button class="btn primary small" id="commentSubmit">发送</button>
               <label class="comment-anon-check"><input type="checkbox" id="commentAnon" />匿名</label>
             </div>
           </div>`
        : `<div class="comment-empty"><a href="#" id="loginToComment" style="color:var(--primary)">登录后</a>才能评论</div>`
    }
  `;
  box.querySelector('[data-close]').addEventListener('click', () => closeModal('detailModal'));
  box.querySelector('.like-btn').addEventListener('click', async () => {
    if (!me) return openAuthModal();
    try {
      const data = await api(`/posts/${p.id}/like`, { method: 'POST' });
      const btn = box.querySelector('.like-btn');
      btn.classList.toggle('liked', data.likedByMe);
      btn.innerHTML = `${data.likedByMe ? ICONS.heartFill : ICONS.heart} <span class="like-count">${data.likeCount}</span>&nbsp;点赞`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  const favBtn = box.querySelector('.fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', () => toggleFav(p.id, favBtn));
  }
  const favFolderBtn = box.querySelector('.fav-folder-btn');
  if (favFolderBtn) favFolderBtn.addEventListener('click', () => openFolderPicker(p.id));
  const hideBtn = box.querySelector('.act-hide-post-detail');
  if (hideBtn) {
    hideBtn.addEventListener('click', async () => {
      try {
        await api(`/posts/${p.id}/hide-personal`, { method: 'POST' });
        toast('已隐藏这条动态');
        closeModal('detailModal');
        loadPosts();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
  if (window.bindTopicChips) window.bindTopicChips(box);
  const dmBtn = box.querySelector('.dm-open-btn');
  if (dmBtn) {
    dmBtn.addEventListener('click', () => openDmModal(Number(dmBtn.dataset.uid), dmBtn.dataset.name));
  }
  const authorLink = box.querySelector('.detail-author.author-link');
  if (authorLink) {
    authorLink.addEventListener('click', () => openUserModal(Number(authorLink.dataset.uid)));
  }
  box.querySelectorAll('.act-report').forEach((btn) => {
    btn.addEventListener('click', () => openReportModal(btn.dataset.type, Number(btn.dataset.id)));
  });
  const editBtn = box.querySelector('.act-edit-detail');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      closeModal('detailModal');
      openEditModal(p.id);
    });
  }
  const delBtn = box.querySelector('.act-del-detail');
  if (delBtn) {
    delBtn.addEventListener('click', () => deletePost(p.id, true));
  }
  box.querySelectorAll('.comment-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定删除这条评论吗？')) return;
      try {
        await api(`/comments/${btn.dataset.id}`, { method: 'DELETE' });
        openDetail(p.id); // 重新加载详情
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });
  if (window.bindCommentReports) window.bindCommentReports(box);
  const commentSubmit = box.querySelector('#commentSubmit');
  if (commentSubmit) {
    commentSubmit.addEventListener('click', async () => {
      const content = box.querySelector('#commentInput').value.trim();
      if (!content) return toast('评论内容不能为空', 'error');
      try {
        await api(`/posts/${p.id}/comments`, {
          method: 'POST',
          body: { content, anonymous: box.querySelector('#commentAnon').checked },
        });
        toast('评论成功');
        openDetail(p.id);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }
  const loginLink = box.querySelector('#loginToComment');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  }
}

function commentHtml(c) {
  return `
    <div class="comment">
      ${avatarHtml(c.author, c.anonymous)}
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-author">${authorName(c.author, c.anonymous)}</span>
          ${c.canDelete ? `<button class="comment-del" data-id="${c.id}">删除</button>` : ''}
          ${c.canReport && !c.hidden ? `<button class="comment-report" data-id="${c.id}">举报</button>` : ''}
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
      </div>
    </div>`;
}

// ---------- 搜索 ----------

$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentQuery = e.target.value.trim();
    loadPosts();
  }, 300);
});

// ---------- 图片选择器（发帖 / 编辑共用） ----------

const IMAGE_ACCEPT = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function makeImagePicker({ thumbs, addBtn, input, max = 9 }) {
  let items = [];
  function render() {
    thumbs.innerHTML = items
      .map(
        (it, i) => `
      <div class="img-thumb">
        <img src="${it.kind === 'url' ? it.url : it.preview}" alt="" />
        <button type="button" class="img-thumb-del" data-i="${i}">×</button>
      </div>`
      )
      .join('');
    thumbs.querySelectorAll('.img-thumb-del').forEach((b) =>
      b.addEventListener('click', () => {
        items.splice(Number(b.dataset.i), 1);
        render();
      })
    );
    addBtn.hidden = items.length >= max;
  }
  function addFiles(files) {
    for (const f of files) {
      if (items.length >= max) {
        toast(`最多 ${max} 张图片`, 'error');
        break;
      }
      if (!IMAGE_ACCEPT.includes(f.type)) {
        toast('仅支持 JPG / PNG / GIF / WebP 图片', 'error');
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast('单张图片最大 5MB', 'error');
        continue;
      }
      items.push({ kind: 'file', file: f, preview: URL.createObjectURL(f) });
    }
    render();
  }
  addBtn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  return {
    addUrls(urls) {
      items.push(...urls.map((u) => ({ kind: 'url', url: u })));
      render();
    },
    clear() {
      items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
      items = [];
      render();
    },
    urls() {
      return items.filter((it) => it.kind === 'url').map((it) => it.url);
    },
    files() {
      return items.filter((it) => it.kind === 'file').map((it) => it.file);
    },
  };
}

const newPicker = makeImagePicker({
  thumbs: $('#newImgThumbs'), addBtn: $('#newImgAdd'), input: $('#newImgInput'),
});
const editPicker = makeImagePicker({
  thumbs: $('#editImgThumbs'), addBtn: $('#editImgAdd'), input: $('#editImgInput'),
});

// 帖子图片墙（卡片小图）
function postImagesHtml(p) {
  const imgs = (p.images || []).slice(0, 9);
  if (!imgs.length) return '';
  if (imgs.length === 1) {
    return `<div class="post-images single"><img src="${escapeHtml(absUrl(imgs[0]))}" loading="lazy" alt="" /></div>`;
  }
  return `<div class="post-images grid">${imgs.map((u) => `<img src="${escapeHtml(absUrl(u))}" loading="lazy" alt="" />`).join('')}</div>`;
}

// 帖子图片墙（详情大图，点击新标签页查看原图）
function detailImagesHtml(p) {
  const imgs = (p.images || []).slice(0, 9);
  if (!imgs.length) return '';
  return `<div class="detail-images ${imgs.length === 1 ? 'single' : 'grid'}">${imgs
    .map((u) => `<a href="${escapeHtml(absUrl(u))}" target="_blank" rel="noopener"><img src="${escapeHtml(absUrl(u))}" loading="lazy" alt="" /></a>`)
    .join('')}</div>`;
}

// ---------- 底部标签导航 ----------

let activeTab = 'posts';

function switchTab(tab) {
  if ((tab === 'messages' || tab === 'me') && !me) {
    toast('请先登录', 'error');
    return openAuthModal();
  }
  activeTab = tab;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === tab + 'View'));
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#boardBar').hidden = tab !== 'posts';
  $('#fabNew').hidden = tab !== 'posts';
  window.scrollTo({ top: 0 });
  moveTabInd(true); // 胶囊拉伸-收缩变形
  placeFloating();
  if (tab === 'messages') loadConversations();
  if (tab === 'discover') loadDiscover();
  if (tab === 'me') {
    renderMeProfile();
    renderBgPicker();
    setMeSection(meSection);
  }
}

$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ---------- 我的（个人主页） ----------

let meSection = 'mine';

async function renderMeProfile() {
  let stats = { posts: 0, likesReceived: 0, favorites: 0 };
  try {
    stats = await api('/me/stats');
  } catch {}
  $('#meProfile').innerHTML = `
    <liquid-glass class="me-card">
      <div class="me-top">
        <div class="me-avatar-wrap" id="meAvatarWrap" title="更换头像">
          ${
            me.avatar
              ? `<div class="avatar me-avatar"><img src="${escapeHtml(absUrl(me.avatar))}" alt="" /></div>`
              : `<div class="avatar me-avatar" style="background:${me.avatarColor}">${escapeHtml(me.nickname.slice(0, 1).toUpperCase())}</div>`
          }
          <div class="me-avatar-edit">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
        </div>
        <input type="file" id="meAvatarInput" accept="image/jpeg,image/png,image/webp" hidden />
        <div class="me-info">
          <div class="me-name">${escapeHtml(me.nickname)}${me.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</div>
          <div class="me-sub">@${escapeHtml(me.username)}${me.email ? ' · ' + escapeHtml(me.email) : ''}</div>
        </div>
      </div>
      <div class="me-stats">
        <div class="me-stat"><b>${stats.posts}</b><span>帖子</span></div>
        <div class="me-stat"><b>${stats.likesReceived}</b><span>获赞</span></div>
        <div class="me-stat"><b>${stats.favorites}</b><span>收藏</span></div>
        <div class="me-stat"><b id="meFollowerCount">${stats.followers ?? 0}</b><span>粉丝</span></div>
        <div class="me-stat"><b id="meFollowingCount">${stats.following ?? 0}</b><span>关注</span></div>
      </div>
      <div class="me-interests" id="meInterests"></div>
    </liquid-glass>`;
  bindAvatarSettings();
  if (window.bindMeExtras) window.bindMeExtras();
}

function setMeSection(section) {
  meSection = section;
  $$('#meSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.me === section));
  loadMeList();
}

async function loadMeList() {
  const key = meSection === 'mine' ? 'mine' : meSection === 'liked' ? 'liked' : 'fav';
  try {
    const data = await api(`/posts?${key}=1&sort=latest`);
    renderPostCards($('#mePostList'), data.posts, $('#meEmpty'));
  } catch (err) {
    toast(err.message, 'error');
  }
}

$$('#meSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => setMeSection(btn.dataset.me));
});

$('#meLogout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  token = '';
  me = null;
  localStorage.removeItem('zdcw_token');
  currentBoard = 'all';
  renderUserArea();
  renderBoardChips();
  updateUnreadBadge();
  switchTab('posts');
  loadPosts();
  toast('已退出登录');
});

// ---------- 私信 ----------

let threadPartnerId = null;
let threadTimer = null;

async function loadConversations() {
  closeThread(false);
  try {
    const data = await api('/conversations');
    const list = $('#convList');
    // 备忘录：与自己的会话固定置顶，名字显示自己的昵称
    const memoMsgs = (await api('/conversations/' + me.id)).messages;
    const memoLast = memoMsgs[memoMsgs.length - 1];
    const memoHtml = `
      <liquid-glass class="conv-item memo-item" data-uid="${me.id}" interactive>
        <div class="conv-inner">
          ${
            me.avatar
              ? `<div class="avatar"><img src="${escapeHtml(absUrl(me.avatar))}" alt="" /></div>`
              : `<div class="avatar" style="background:${me.avatarColor}">${escapeHtml(me.nickname.slice(0, 1).toUpperCase())}</div>`
          }
          <div class="conv-body">
            <div class="conv-top">
              <span class="conv-name">${escapeHtml(me.nickname)}${me.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</span>
              <span class="conv-time">${memoLast ? timeAgo(memoLast.createdAt) : ''}</span>
            </div>
            <div class="conv-preview">${memoLast ? escapeHtml(memoLast.content) : '备忘录 · 记给自己的话，只有自己能看到'}</div>
          </div>
          <span class="memo-tag">备忘录</span>
        </div>
      </liquid-glass>`;
    $('#msgEmpty').hidden = true;
    list.innerHTML = memoHtml + data.conversations
      .map(
        (c) => `
      <liquid-glass class="conv-item" data-uid="${c.user.id}" interactive>
        <div class="conv-inner">
          ${
            c.user.avatar
              ? `<div class="avatar"><img src="${escapeHtml(absUrl(c.user.avatar))}" alt="" /></div>`
              : `<div class="avatar" style="background:${c.user.avatarColor}">${escapeHtml(c.user.nickname.slice(0, 1).toUpperCase())}</div>`
          }
          <div class="conv-body">
            <div class="conv-top">
              <span class="conv-name">${escapeHtml(c.user.nickname)}${c.user.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</span>
              <span class="conv-time">${timeAgo(c.lastMessage.createdAt)}</span>
            </div>
            <div class="conv-preview">${c.lastMessage.fromMe ? '我：' : ''}${escapeHtml(c.lastMessage.content)}</div>
          </div>
          ${c.unread ? `<span class="conv-badge">${c.unread}</span>` : ''}
        </div>
      </liquid-glass>`
      )
      .join('');
    list.querySelectorAll('.conv-item').forEach((el) => {
      el.addEventListener('click', () => openThread(Number(el.dataset.uid)));
    });
    if (data.conversations.length === 0) $('#msgEmpty').hidden = false; // 无会话时保留空态
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openThread(uid) {
  threadPartnerId = uid;
  try {
    const data = await api('/conversations/' + uid);
    $('#convList').hidden = true;
    $('#msgEmpty').hidden = true;
    const tv = $('#threadView');
    tv.hidden = false;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tv.classList.remove('th-out');
      tv.classList.add('th-in');
      tv.addEventListener('animationend', () => tv.classList.remove('th-in'), { once: true });
    }
    $('#threadName').textContent = data.user.nickname;
    renderThread(data.messages);
    updateUnreadBadge();
    clearInterval(threadTimer);
    threadTimer = setInterval(async () => {
      if (activeTab !== 'messages' || threadPartnerId !== uid) return clearInterval(threadTimer);
      try {
        const fresh = await api('/conversations/' + uid);
        renderThread(fresh.messages);
      } catch {}
    }, 5000);
  } catch (err) {
    toast(err.message, 'error');
  }
}

let threadReplyTo = null;
let threadMessages = [];

function renderThread(messages) {
  threadMessages = messages;
  $('#msgList').innerHTML = messages.length
    ? messages
        .map((m) => {
          const canRecall = m.fromMe && !m.recalled && Date.now() - m.createdAt < 5 * 60e3;
          const quote = m.replyTo ? `<div class="msg-quote">引用 ${m.replyTo.fromMe ? '自己' : '对方'}：${escapeHtml(m.replyTo.preview)}</div>` : '';
          return `
      <div class="msg-row ${m.fromMe ? 'mine' : 'theirs'}" data-id="${m.id}">
        ${quote}
        <div class="msg-bubble ${m.recalled ? 'recalled' : ''}">${m.recalled ? '<i>消息已撤回</i>' : escapeHtml(m.content)}</div>
        <div class="msg-time">${timeAgo(m.createdAt)}
          ${canRecall ? `<button class="msg-act" data-id="${m.id}">撤回</button>` : ''}
          ${!m.recalled && !m.fromMe ? `<button class="msg-act" data-reply="${m.id}">引用</button>` : ''}
        </div>
      </div>`;
        })
        .join('')
    : '<div class="comment-empty">还没有消息，打个招呼吧～</div>';
  $('#msgList').querySelectorAll('.msg-act').forEach((b) => {
    if (b.dataset.id) {
      b.addEventListener('click', async () => {
        if (!confirm('撤回这条消息？')) return;
        try {
          await api(`/messages/${b.dataset.id}/recall`, { method: 'POST' });
          const fresh = await api('/conversations/' + threadPartnerId);
          renderThread(fresh.messages);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    } else if (b.dataset.reply) {
      b.addEventListener('click', () => {
        const src = (threadMessages || []).find((m) => m.id === Number(b.dataset.reply));
        if (!src) return;
        threadReplyTo = { id: src.id, preview: (src.content || '').slice(0, 50), fromMe: src.fromMe };
        $('#replyBar').hidden = false;
        $('#replyPreview').textContent = '引用 ' + (threadReplyTo.fromMe ? '自己' : '对方') + '：' + threadReplyTo.preview;
        $('#msgInput').focus();
      });
    }
  });
  $('#msgList').scrollTop = $('#msgList').scrollHeight;
}

function closeThread(showList = true) {
  clearInterval(threadTimer);
  threadPartnerId = null;
  threadReplyTo = null;
  if ($('#replyBar')) $('#replyBar').hidden = true;
  $('#threadView').hidden = true;
  if (showList) $('#convList').hidden = false;
}

$('#threadSearch')?.addEventListener('click', async () => {
  const q = prompt('在会话中搜索消息：');
  if (!q) return;
  try {
    const data = await api('/messages/search?q=' + encodeURIComponent(q));
    if (!data.results.length) return toast('没有找到相关消息');
    const hit = data.results.find((r) => r.partner && r.partner.id === threadPartnerId) || data.results[0];
    toast(`找到 ${hit.hits.length} 条相关消息`);
    if (hit.partner.id !== threadPartnerId) {
      await openThread(hit.partner.id);
    }
    setTimeout(() => {
      const el = $('#msgList').querySelector(`.msg-row[data-id="${hit.hits[0].id}"]`);
      if (el) el.scrollIntoView({ block: 'center' });
    }, 600);
  } catch (err) {
    toast(err.message, 'error');
  }
});
$('#replyCancel')?.addEventListener('click', () => {
  threadReplyTo = null;
  $('#replyBar').hidden = true;
});

$('#threadBack').addEventListener('click', () => {
  const tv = $('#threadView');
  if (!tv.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches && !tv.classList.contains('th-out')) {
    $('#convList').hidden = false; // 列表先垫底，线程向左滑出
    tv.classList.add('th-out');
    tv.addEventListener('animationend', () => {
      tv.classList.remove('th-out');
      closeThread();
      loadConversations();
    }, { once: true });
    return;
  }
  closeThread();
  loadConversations();
});

async function sendMsg(retryPayload) {
  const input = $('#msgInput');
  const payload = retryPayload || {
    toUserId: threadPartnerId,
    content: input.value.trim(),
    clientId: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    replyTo: threadReplyTo ? threadReplyTo.id : undefined,
  };
  if (!retryPayload && (!payload.content || !threadPartnerId)) return;
  const btn = $('#msgSend');
  btn.disabled = true;
  try {
    await api('/messages', { method: 'POST', body: payload });
    if (!retryPayload) input.value = '';
    threadReplyTo = null;
    $('#replyBar').hidden = true;
    const data = await api('/conversations/' + (payload.toUserId || threadPartnerId));
    renderThread(data.messages);
  } catch (err) {
    window.__pendingMsg = payload; // 保留待重发（幂等 clientId 防重复）
    toast((navigator.onLine === false ? '网络已断开，消息已保留：' : '') + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

$('#msgSend').addEventListener('click', sendMsg);
$('#msgInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
});

// 发私信弹窗（帖子详情进入）
function openDmModal(uid, name) {
  $('#dmToId').value = uid;
  $('#dmToName').textContent = name;
  $('#dmContent').value = '';
  openModal('dmModal');
}

$('#dmForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/messages', {
      method: 'POST',
      body: { toUserId: Number($('#dmToId').value), content: $('#dmContent').value.trim() },
    });
    closeModal('dmModal');
    toast('私信已发送');
    updateUnreadBadge();
    if (activeTab === 'messages' && threadPartnerId === Number($('#dmToId').value)) {
      const data = await api('/conversations/' + threadPartnerId);
      renderThread(data.messages);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- 未读红点 ----------

async function updateUnreadBadge() {
  const badge = $('#unreadBadge');
  if (!me) {
    badge.hidden = true;
    return;
  }
  try {
    const { unread } = await api('/me/unread');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : unread;
  } catch {
    badge.hidden = true;
  }
}

setInterval(updateUnreadBadge, 20000);

// ---------- PWA ----------
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ---------- PWA ----------
// 原生壳不需要 Service Worker（缓存会让更新失效），顺手清掉历史遗留的注册
if (IS_NATIVE) {
  // 原生壳：顶部布局走固定状态栏占位（不依赖系统安全区数值，各机型表现一致）
  // iOS（灵动岛）与安卓的状态栏高度不同，分别标注
  const platform = window.Capacitor.getPlatform();
  document.documentElement.classList.add('native', 'native-' + platform);
  navigator.serviceWorker?.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister()));
} else if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  // 新版本 SW 接管页面时自动刷新一次（sessionStorage 防循环），用户永远看到最新样式
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('swReloaded')) return;
    sessionStorage.setItem('swReloaded', '1');
    location.reload();
  });
}

// ---------- 液态玻璃动态效果 ----------
// 光斑：画在玻璃元素自身背景层（覆盖全部边缘），指针移动时跟随；
// 透过半透明玻璃被 backdrop 模糊折射，形成真实光源感。
// 弹性拖拽：标签栏 / 发帖按钮可抓住拖动，阻尼位移 + 松手回弹（拖得动但拖不走）。
function attachGlow(el) {
  if (el.dataset.glowAttached) return;
  el.dataset.glowAttached = '1';
  let raf = 0;
  el.addEventListener(
    'pointermove',
    (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.setProperty('--gx', x.toFixed(1) + 'px');
          el.style.setProperty('--gy', y.toFixed(1) + 'px');
        });
      }
      el.classList.add('glow-on');
    },
    { passive: true }
  );
  el.addEventListener('pointerleave', () => el.classList.remove('glow-on'));
}

// 弹性拖拽：位移带阻尼封顶（约 12px），松手用弹簧曲线回弹；
// 拖动距离超过死区则吞掉本次点击，轻点不受影响
function makeElastic(el) {
  let startX = 0, startY = 0, dragging = false, moved = false;
  el.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    moved = false;
    el.style.transition = 'none';
  });
  el.addEventListener(
    'pointermove',
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 7) return; // 点击死区
      moved = true;
      el.classList.add('dragging');
      const cap = (v) => v * 0.09 * (200 / (200 + Math.abs(v))); // 阻尼封顶 ~12px
      el.style.transform = `translate(${cap(dx).toFixed(1)}px, ${cap(dy).toFixed(1)}px) rotate(${(cap(dx) * 0.02).toFixed(2)}deg)`;
    },
    { passive: true }
  );
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    el.style.transition = 'transform 0.65s var(--ease-ios)';
    el.style.transform = '';
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      const kill = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener('click', kill, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', kill, { capture: true }), 120);
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}

// 底栏胶囊滑块：抓住拖动，范围锁在底栏内（两端 8px 弹性），松手吸附最近标签
const tabDrag = { on: false, moved: false, startX: 0, startL: 0, pid: 0 };
function initTabDrag() {
  const bar = document.querySelector('.tabbar');
  if (!bar || bar.dataset.dragAttached) return;
  bar.dataset.dragAttached = '1';

  bar.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    tabDrag.on = true;
    tabDrag.moved = false;
    tabDrag.startX = e.clientX;
    tabDrag.startL = parseFloat(tabInd.style.left) || 0;
    tabDrag.pid = e.pointerId;
    bar.style.transition = 'none';
    tabInd.style.transition = 'none';
  });

  bar.addEventListener(
    'pointermove',
    (e) => {
      if (!tabDrag.on || e.pointerId !== tabDrag.pid) return;
      const dx = e.clientX - tabDrag.startX;
      if (!tabDrag.moved && Math.abs(dx) < 7) return; // 点击死区
      tabDrag.moved = true;
      bar.classList.add('dragging');
      const pr = bar.getBoundingClientRect();
      const min = 6;
      const max = pr.width - tabInd.offsetWidth - 6;
      let left = tabDrag.startL + dx;
      if (left < min) left = min - Math.min(8, (min - left) * 0.3); // 边缘弹性
      if (left > max) left = max + Math.min(8, (left - max) * 0.3);
      tabInd.style.left = left + 'px';
    },
    { passive: true }
  );

  const settle = (e) => {
    if (!tabDrag.on || e.pointerId !== tabDrag.pid) return;
    tabDrag.on = false;
    bar.classList.remove('dragging');
    bar.style.transition = '';
    tabInd.style.transition = 'left 0.35s var(--ease-ios)';
    if (!tabDrag.moved) return; // 轻点：交给按钮自己的 click
    e.stopPropagation();
    e.preventDefault();
    const kill = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    bar.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => bar.removeEventListener('click', kill, { capture: true }), 120);
    // 吸附到胶囊中心最近的标签
    const r = tabInd.getBoundingClientRect();
    const target = nearestTab(r.left + r.width / 2);
    if (target && !target.classList.contains('active')) switchTab(target.dataset.tab);
    else moveTabInd(true);
  };
  bar.addEventListener('pointerup', settle);
  bar.addEventListener('pointercancel', settle);
}

function initGlassLife() {
  document.querySelectorAll('liquid-glass, .lg-surface').forEach((el) => {
    attachGlow(el);
    if (el.matches('.fab')) makeElastic(el);
  });
}
const glassObserver = new MutationObserver(() => initGlassLife());
glassObserver.observe(document.body, { childList: true, subtree: true });

// ---------- 网页动感：背景视差 / 标签栏滑动药丸 / 滚动进场 ----------
// 背景随指针反向轻移，制造玻璃悬浮在景深之上的感觉
let bgRaf = 0;
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.addEventListener(
  'pointermove',
  (e) => {
    if (bgRaf || REDUCED_MOTION) return;
    bgRaf = requestAnimationFrame(() => {
      bgRaf = 0;
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      document.body.style.setProperty('--bgx', (nx * -18).toFixed(1) + 'px');
      document.body.style.setProperty('--bgy', (ny * -14).toFixed(1) + 'px');
    });
  },
  { passive: true }
);

// 标签栏激活胶囊：点按标签平滑滑过去；也可直接抓住胶囊拖动（范围不超底栏）
const tabInd = document.createElement('div');
tabInd.className = 'tab-ind';
function setTabInd(left, width, duration) {
  tabInd.style.transition = duration ? `left ${duration}s var(--ease-ios), width ${duration}s var(--ease-ios)` : 'none';
  tabInd.style.left = left + 'px';
  tabInd.style.width = width + 'px';
}
function moveTabInd(animate = true) {
  const active = document.querySelector('.tab-btn.active');
  if (!active) return;
  const pr = tabInd.parentElement.getBoundingClientRect();
  const r = active.getBoundingClientRect();
  setTabInd(r.left - pr.left, r.width, animate ? 0.35 : 0);
}
function nearestTab(centerX) {
  let best = null, bestDist = Infinity;
  $$('.tab-btn').forEach((b) => {
    const r = b.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - centerX);
    if (d < bestDist) { bestDist = d; best = b; }
  });
  return best;
}
function initTabInd() {
  const bar = document.querySelector('.tabbar');
  if (!bar.contains(tabInd)) bar.prepend(tabInd);
  moveTabInd(false);
}
window.addEventListener('resize', () => {
  initTabInd();
  placeFloating();
});
window.addEventListener('load', () => {
  initTabInd();
  placeFloating();
});

// ---------- 可视视口（VP）----------
// 键盘弹出 / 浏览器工具栏收起 / 旋转屏幕时，visualViewport 的高度才是真正可见区域
const VP = { w: window.innerWidth, h: window.innerHeight };
function readViewport() {
  VP.w = window.innerWidth;
  VP.h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
}
readViewport();
if (window.visualViewport) window.visualViewport.addEventListener('resize', readViewport);

// ---------- 浮动元素锚定可视区域 ----------
// 实时读取当前窗口高度（分辨率变化 / 软键盘弹出 / 旋转屏幕都会触发 resize）
// 来放置底栏和加号按钮，保证任何标签页、任何设备下位置一致。
function placeFloating() {
  const bar = document.querySelector('.tabbar');
  const fab = document.querySelector('.fab');
  if (!bar) return;
  // 以可视视口高度（VP.h，键盘弹出/工具栏收起时自动变化）为基准放置
  const top = Math.max(8, VP.h - 14 - bar.offsetHeight);
  bar.style.top = Math.round(top) + 'px';
  bar.style.bottom = 'auto';
  if (fab && !fab.hidden) {
    fab.style.top = Math.round(Math.max(8, top - fab.offsetHeight - 14)) + 'px';
    fab.style.bottom = 'auto';
  }
}
window.addEventListener('resize', placeFloating);

// 滚动进场：给列表项加淡入上浮（进入视口才播放，带阶梯延迟）
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealObs.unobserve(en.target);
      }
    });
  },
  { threshold: 0.06 }
);
function revealCards(container) {
  container.querySelectorAll('.post-card, .conv-item').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = Math.min(i * 45, 320) + 'ms';
    el.addEventListener(
      'transitionend',
      () => {
        el.style.transitionDelay = '';
      },
      { once: true }
    );
    revealObs.observe(el);
  });
}

// ---------- 背景设置（我的页） ----------
// 每种背景配套一组 UI 主题色（强调色 / 玻璃色调），换背景时全站风格跟随
// 主题色由各背景图的实际色相计算得出
const BG_THEMES = {
  default:  { a1: 'hsl(222, 85%, 62%)', a2: 'hsl(222, 85%, 44%)', rgb: '76, 76, 240',    tint: '166, 166, 232', top: '48%' },
  aurora:   { a1: 'hsl(222, 71%, 62%)', a2: 'hsl(222, 71%, 44%)', rgb: '89, 89, 227',    tint: '171, 171, 227', top: '30%' },
  sunset:   { a1: 'hsl(167, 85%, 62%)', a2: 'hsl(167, 85%, 44%)', rgb: '76, 111, 205',   tint: '166, 178, 220', top: '30%' },
  forest:   { a1: 'hsl(16, 85%, 62%)',  a2: 'hsl(16, 85%, 44%)',  rgb: '197, 120, 76',  tint: '214, 183, 166', top: '30%' },
  obsidian: { a1: 'hsl(266, 85%, 62%)', a2: 'hsl(266, 85%, 44%)', rgb: '147, 76, 169',  tint: '194, 166, 203' },
};
const BG_PRESETS = [
  { id: 'default', name: '波纹', url: 'assets/bg.jpg', theme: BG_THEMES.default },
  { id: 'aurora', name: '极光', url: 'assets/bg-aurora.jpg', theme: BG_THEMES.aurora },
  { id: 'sunset', name: '翡翠', url: 'assets/bg-sunset.jpg', theme: BG_THEMES.sunset },
  { id: 'forest', name: '暮色', url: 'assets/bg-forest.jpg', theme: BG_THEMES.forest },
  { id: 'obsidian', name: '曜石', url: 'assets/bg-obsidian.jpg', theme: BG_THEMES.obsidian },
];
const BG_KEY = 'zdcw-bg';

function getBgPref() {
  try {
    return JSON.parse(localStorage.getItem(BG_KEY));
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  const r = document.documentElement.style;
  r.setProperty('--theme-a1', theme.a1);
  r.setProperty('--theme-a2', theme.a2);
  r.setProperty('--theme-rgb', theme.rgb);
  r.setProperty('--theme-tint', theme.tint);
  r.setProperty('--topbar-mix', theme.top || '30%');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme.a2;
}

function applyBackground() {
  const pref = getBgPref();
  let css = 'url("assets/bg.jpg")';
  let theme = BG_THEMES.blue;
  if (pref?.type === 'preset') {
    const p = BG_PRESETS.find((x) => x.id === pref.id);
    if (p) {
      css = `url("${p.url}")`;
      theme = p.theme;
    }
  } else if (pref?.type === 'custom') {
    css = `url("${pref.dataUrl}")`;
    theme = pref.theme || BG_THEMES.blue;
  }
  document.body.style.setProperty('--bg-image', css);
  applyTheme(theme);
}

function renderBgPicker() {
  const pref = getBgPref();
  const isActive = (type, id) =>
    (pref?.type === type && (type === 'custom' || pref.id === id)) ? 'active' : '';
  let html = BG_PRESETS.map(
    (p) => `
    <button type="button" class="bg-tile ${isActive('preset', p.id)}" data-bg-preset="${p.id}" title="${p.name}">
      <img src="${p.url}" alt="${p.name}" />
    </button>`
  ).join('');
  if (pref?.type === 'custom') {
    html += `
    <button type="button" class="bg-tile active" title="自定义背景">
      <img src="${pref.dataUrl}" alt="自定义" />
    </button>`;
  }
  html += `
    <button type="button" class="bg-tile bg-add" id="bgAddBtn" title="上传自定义背景">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>`;
  $('#bgPicker').innerHTML = html;

  $$('#bgPicker [data-bg-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = BG_PRESETS.find((p) => p.id === btn.dataset.bgPreset);
      localStorage.setItem(BG_KEY, JSON.stringify({ type: 'preset', id: preset.id, url: preset.url }));
      applyBackground();
      renderBgPicker();
      toast(`背景已切换：${preset.name}`);
    });
  });
  $('#bgAddBtn').addEventListener('click', () => $('#bgUpload').click());
}

function compressImage(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = URL.createObjectURL(file);
  });
}

// 从自定义背景图提取主色调，生成配套主题（低饱和图回退中性银）
function extractTheme(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 24;
      c.height = 24;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 24, 24);
      const d = ctx.getImageData(0, 0, 24, 24).data;
      // 只统计亮部彩色像素：暗部大片会把平均色拖偏（深色壁纸的教训）
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const rr = d[i], gg = d[i + 1], bb = d[i + 2];
        if (Math.max(rr, gg, bb) - Math.min(rr, gg, bb) > 30 && Math.max(rr, gg, bb) > 60) {
          r += rr; g += gg; b += bb; n++;
        }
      }
      if (n === 0) n = 1;
      r /= n; g /= n; b /= n;
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
      const l = (mx + mn) / 2;
      let h = 0, s = 0;
      if (mx !== mn) {
        const df = mx - mn;
        s = l > 0.5 ? df / (2 - mx - mn) : df / (mx + mn);
        if (mx === r / 255) h = ((g - b) / 255 / df) % 6;
        else if (mx === g / 255) h = (b - r) / 255 / df + 2;
        else h = (r - g) / 255 / df + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
      }
      if (s < 0.12) {
        resolve({ a1: '#9aa8c4', a2: '#5b6b8c', rgb: '154, 168, 196', tint: '200, 210, 230' });
        return;
      }
      const hsl = (hh, ss, ll) => {
        const f = (nn) => {
          const k = (nn + hh / 30) % 12;
          const a = ss * Math.min(ll, 1 - ll);
          return Math.round(255 * (ll - a * Math.max(-1, Math.min(k - 1, 9 - k, 1))));
        };
        return `${f(0)}, ${f(8)}, ${f(4)}`;
      };
      resolve({
        a1: `hsl(${h}, 78%, 62%)`,
        a2: `hsl(${(h + 25) % 360}, 72%, 44%)`,
        rgb: hsl(h, 0.78, 0.62),
        tint: hsl(h, 0.6, 0.78),
      });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

$('#bgUpload').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!IMAGE_ACCEPT.includes(file.type)) return toast('仅支持 JPG / PNG / WebP 图片', 'error');
  try {
    const dataUrl = await compressImage(file);
    const theme = (await extractTheme(dataUrl)) || BG_THEMES.blue;
    try {
      localStorage.setItem(BG_KEY, JSON.stringify({ type: 'custom', dataUrl, theme }));
    } catch {
      return toast('图片过大，存储失败，请换一张较小的图片', 'error');
    }
    applyBackground();
    renderBgPicker();
    toast('自定义背景已应用');
  } catch (err) {
    toast(err.message || '图片处理失败', 'error');
  }
});

// ---------- 头像设置（我的页） ----------
function compressAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = URL.createObjectURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function bindAvatarSettings() {
  const wrap = $('#meAvatarWrap');
  const input = $('#meAvatarInput');
  if (!wrap || !input || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE_ACCEPT.includes(file.type)) return toast('仅支持 JPG / PNG / WebP 图片', 'error');
    try {
      const dataUrl = await compressAvatar(file);
      const fd = new FormData();
      fd.append('avatar', dataUrlToBlob(dataUrl), 'avatar.jpg');
      await api('/me/avatar', { method: 'POST', body: fd });
      await refreshMe();
      renderMeProfile();
      loadPosts();
      updateUnreadBadge();
      toast('头像已更新');
    } catch (err) {
      toast(err.message || '头像上传失败', 'error');
    }
  });
}

// ---------- 全局错误可见化（真机调试） ----------
// 安卓 WebView 里的报错没有控制台可看，出现时以顶部调试条呈现；
// 点击任意处收起。该机制对网页端同样生效。
window.addEventListener('error', (e) => {
  showDebugBar('JS 错误: ' + e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  showDebugBar('未处理的 Promise 错误: ' + (e.reason?.message || e.reason));
});
function showDebugBar(msg) {
  let bar = document.getElementById('debugBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'debugBar';
    bar.innerHTML = '<b id="debugMsg"></b><small style="opacity:.7">（点击收起）</small>';
    bar.style.cssText =
      'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:8px;right:8px;z-index:9999;' +
      'background:#5b1a1a;color:#ffd7d7;font-size:12px;padding:8px 12px;border-radius:10px;' +
      'cursor:pointer;word-break:break-all;box-shadow:0 4px 16px rgba(0,0,0,.5)';
    bar.addEventListener('click', () => bar.remove());
    document.body.appendChild(bar);
  }
  bar.querySelector('#debugMsg').textContent = msg;
  bar.style.display = 'block';
  clearTimeout(showDebugBar._t);
  showDebugBar._t = setTimeout(() => { if (bar.isConnected) bar.style.display = 'none'; }, 8000);
}

// ---------- 启动 ----------

async function init() {
  try {
    applyBrand();
    const data = await api('/boards');
    boards = data.boards;
  } catch (err) {
    showOffline(err.message);
    return;
  }
  try {
  await refreshMe();   // 先确定登录态
  renderBoardChips();  // 再渲染标签栏（登录用户会看到“我的帖子”）
  loadPosts();
  updateUnreadBadge();
    initTabInd();
    initTabDrag();
    placeFloating();
    applyBackground();
    renderBgPicker();
  } catch (err) {
    console.error('init 失败:', err);
    toast('页面初始化出错：' + err.message, 'error');
  }
}

// 连不上服务器时的全屏提示（首次安装授权局域网权限后点重试即可）
function showOffline(msg) {
  const mask = $('#offlineMask');
  $('#offlineMsg').textContent = msg;
  mask.hidden = false;
}

$('#offlineRetry').addEventListener('click', async () => {
  $('#offlineMask').hidden = true;
  try {
    const data = await api('/boards');
    boards = data.boards;
  } catch (err) {
    showOffline(err.message);
    return;
  }
  renderBoardChips();
  await refreshMe();
  loadPosts();
  updateUnreadBadge();
  toast('已连接服务器');
});

init();
