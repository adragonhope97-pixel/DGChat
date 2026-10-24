// DGChat 2.1 —— 通知中心 / 统一搜索 / 收藏夹 / 隐私设置 / 安全中心 / 话题 / 离线提示
// 依赖 app.js / discover.js 的全局环境（api、$、$$、me、toast、openModal 等），最后加载

ICONS.bell =
  '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
ICONS.search2 =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
ICONS.tag =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
ICONS.folder =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
ICONS.eyeOff =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
ICONS.download =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
ICONS.trashO =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
ICONS.esc =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

const NOTIF_TYPE_TEXT = {
  like: '赞了你的帖子',
  comment: '评论了你的帖子',
  follow: '关注了你',
  mention: '在评论中提到了你',
  dm: '给你发来了私信',
  system: '系统通知',
};

// ============ 通知铃铛（顶栏） ============

function renderNotifBell() {
  const area = $('#notifArea');
  if (!area) return;
  if (!me) {
    area.hidden = true;
    return;
  }
  area.hidden = false;
  area.innerHTML = `
    <button class="notif-bell" id="notifBell" title="通知">
      ${ICONS.bell}
      <span class="notif-dot" id="notifDot" hidden></span>
    </button>`;
  $('#notifBell').addEventListener('click', openNotifications);
  refreshNotifBadge();
}

async function refreshNotifBadge() {
  if (!me) return;
  try {
    const data = await api('/me/notifications?limit=1');
    const dot = $('#notifDot');
    if (dot) {
      dot.hidden = !data.unread;
      dot.textContent = data.unread > 99 ? '99+' : data.unread;
    }
  } catch {}
}

let notifLoaded = false;

async function openNotifications() {
  openModal('notifModal');
  const listEl = $('#notifList');
  listEl.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/me/notifications?limit=50');
    notifLoaded = true;
    $('#notifUnreadCount').textContent = data.unread ? `${data.unread} 条未读` : '全部已读';
    if (!data.items.length) {
      listEl.innerHTML = '<div class="comment-empty" style="padding:32px">还没有通知</div>';
      return;
    }
    listEl.innerHTML = data.items
      .map(
        (n) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-type="${n.type}"
           data-actor="${n.actor ? n.actor.id : ''}" data-post="${n.postId || ''}" data-comment="${n.commentId || ''}">
        ${avatarHtml(n.actor, false)}
        <div class="notif-body">
          <div class="notif-line">
            <b>${n.actor ? escapeHtml(n.actor.nickname) : '已注销用户'}</b>
            <span>${NOTIF_TYPE_TEXT[n.type] || '通知'}${n.postTitle ? `：${escapeHtml(n.postTitle)}` : ''}</span>
          </div>
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>
        <button class="notif-del" data-id="${n.id}" title="删除">${ICONS.trashO}</button>
      </div>`
      )
      .join('');
    listEl.querySelectorAll('.notif-item').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = Number(el.dataset.id);
        try { await api('/me/notifications/read', { method: 'POST', body: { ids: [id] } }); } catch {}
        closeModal('notifModal');
        const type = el.dataset.type;
        if (type === 'dm') {
          switchTab('messages');
        } else if (el.dataset.post) {
          switchTab('posts');
          openDetail(Number(el.dataset.post));
        } else if (el.dataset.actor) {
          openUserModal(Number(el.dataset.actor));
        }
      });
    });
    listEl.querySelectorAll('.notif-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api('/me/notifications/' + btn.dataset.id, { method: 'DELETE' });
          btn.closest('.notif-item').remove();
          refreshNotifBadge();
          toast('已删除该通知');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="comment-empty" style="padding:32px">${escapeHtml(err.message)}</div>`;
  }
}

$('#notifReadAll')?.addEventListener('click', async () => {
  try {
    await api('/me/notifications/read', { method: 'POST', body: { all: true } });
    toast('已全部标记为已读');
    openNotifications();
    refreshNotifBadge();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ============ 统一搜索中心 ============

let searchTab = 'posts';
let searchTimer21 = null;
const SEARCH_HISTORY_KEY = 'zdcw_search_history';

function searchHistoryKey() {
  return SEARCH_HISTORY_KEY + '_' + (me ? me.id : 'anon');
}

function getSearchHistory() {
  if (!me || (me.settings && me.settings.searchHistory === false)) return [];
  try {
    return JSON.parse(localStorage.getItem(searchHistoryKey()) || '[]');
  } catch {
    return [];
  }
}

function pushSearchHistory(q) {
  if (!q || !me || (me.settings && me.settings.searchHistory === false)) return;
  let h = getSearchHistory().filter((x) => x !== q);
  h.unshift(q);
  h = h.slice(0, 10);
  localStorage.setItem(searchHistoryKey(), JSON.stringify(h));
}

function clearSearchHistory() {
  localStorage.removeItem(searchHistoryKey());
}

function openSearchModal(prefill = '') {
  openModal('searchModal');
  $('#searchQuery').value = prefill;
  renderSearchHistory();
  if (prefill) doSearch();
}

function renderSearchHistory() {
  const wrap = $('#searchHistory');
  const h = getSearchHistory();
  if (!h.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  wrap.innerHTML = `
    <div class="search-history-head">
      <span>最近搜索</span>
      <button id="searchHistoryClear">清除</button>
    </div>
    <div class="search-history-chips">${h.map((x) => `<button class="chip" data-q="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('')}</div>`;
  wrap.querySelectorAll('[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#searchQuery').value = b.dataset.q;
      doSearch();
    })
  );
  $('#searchHistoryClear').addEventListener('click', () => {
    clearSearchHistory();
    renderSearchHistory();
  });
}

async function doSearch(page = 1) {
  const q = $('#searchQuery').value.trim();
  const type = searchTab;
  const body = $('#searchResults');
  $('#searchEmpty').hidden = true;
  if (page === 1) {
    body.innerHTML = '<div class="disc-loading">搜索中…</div>';
    if (q) pushSearchHistory(q);
  }
  const params = new URLSearchParams({ type, q, page: String(page), limit: '10' });
  if (type === 'posts') {
    params.set('time', $('#searchTime').value);
    params.set('sort', $('#searchSort').value);
    params.set('author', $('#searchAuthor').value.trim());
    if ($('#searchHasImage').checked) params.set('hasImage', '1');
  }
  try {
    const data = await api('/search?' + params.toString());
    renderSearchResults(data, q, page);
  } catch (err) {
    body.innerHTML = '';
    $('#searchEmpty').hidden = false;
    $('#searchEmptyText').textContent = err.message;
  }
}

function renderSearchResults(data, q, page) {
  const body = $('#searchResults');
  const items = data.items || [];
  if (!items.length && page === 1) {
    body.innerHTML = '';
    $('#searchEmpty').hidden = false;
    $('#searchEmptyText').textContent = q ? `没有与「${q}」相关的内容` : '输入关键词开始搜索';
    return;
  }
  let html = '';
  if (searchTab === 'posts') {
    html = items.map((p) => postCardHtml(p)).join('');
  } else if (searchTab === 'users') {
    html = items
      .map(
        (u) => `
      <liquid-glass class="user-card" data-uid="${u.id}" interactive>
        <div class="user-card-inner">
          ${avatarHtml(u, false)}
          <div class="user-card-body">
            <div class="user-card-name">${escapeHtml(u.nickname)}${u.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</div>
            <div class="user-card-sub">@${escapeHtml(u.username)} · ${u.followerCount} 粉丝</div>
            ${u.bio ? `<div class="user-card-bio">${escapeHtml(u.bio)}</div>` : ''}
          </div>
        </div>
      </liquid-glass>`
      )
      .join('');
  } else {
    html = items
      .map(
        (t) => `
      <liquid-glass class="user-card topic-card" data-topic="${escapeHtml(t.name)}" interactive>
        <div class="user-card-inner">
          <div class="avatar" style="background:var(--accent)">${ICONS.tag}</div>
          <div class="user-card-body">
            <div class="user-card-name">#${escapeHtml(t.name)}</div>
            <div class="user-card-sub">${t.posts} 条动态 · ${t.authors} 位参与者</div>
          </div>
        </div>
      </liquid-glass>`
      )
      .join('');
  }
  const more = items.length >= 10 ? `<button class="btn ghost wide" id="searchMore">加载更多（第 ${page + 1} 页）</button>` : '';
  body.innerHTML = (page === 1 ? '' : body.innerHTML.replace(/<button class="btn ghost wide" id="searchMore">[\s\S]*<\/button>/, '')) + html + more;
  // 绑定
  if (searchTab === 'posts') {
    bindPostCards(body);
  } else {
    body.querySelectorAll('.user-card[data-uid]').forEach((el) => el.addEventListener('click', () => openUserModal(Number(el.dataset.uid))));
  }
  body.querySelectorAll('.topic-card').forEach((el) => el.addEventListener('click', () => openTopicModal(el.dataset.topic)));
  $('#searchMore')?.addEventListener('click', () => doSearch(page + 1));
}

// 复用 renderPostCards 的绑定逻辑（帖子卡片在弹窗内）
function bindPostCards(container) {
  container.querySelectorAll('.post-card').forEach((card) => card.addEventListener('click', () => openDetail(Number(card.dataset.id))));
  container.querySelectorAll('.like-btn').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(Number(btn.dataset.id), btn); }));
  container.querySelectorAll('.fav-btn').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(Number(btn.dataset.id), btn); }));
  container.querySelectorAll('.act-edit').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(Number(btn.dataset.id)); }));
  container.querySelectorAll('.act-del').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); deletePost(Number(btn.dataset.id)); }));
  container.querySelectorAll('.topic-chip').forEach((chip) => chip.addEventListener('click', (e) => { e.stopPropagation(); openTopicModal(chip.dataset.topic); }));
}

$$('.search-tab').forEach((b) =>
  b.addEventListener('click', () => {
    searchTab = b.dataset.stab;
    $$('.search-tab').forEach((x) => x.classList.toggle('active', x === b));
    $('#searchPostsFilters').hidden = searchTab !== 'posts';
    doSearch();
  })
);
$('#searchGo').addEventListener('click', () => doSearch());
$('#searchQuery').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doSearch();
  }
});
$('#searchQuery').addEventListener('input', () => {
  clearTimeout(searchTimer21);
  searchTimer21 = setTimeout(() => doSearch(), 400);
});

// ============ 话题 ============

async function loadTopicTrending() {
  const list = $('#userList');
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  $('#discEmpty').hidden = true;
  try {
    const data = await api('/topics?sort=hot');
    if (!data.items.length) {
      list.innerHTML = '';
      $('#discEmpty').hidden = false;
      $('#discEmptySub').textContent = '还没有话题，发帖时用 #话题名# 即可创建';
      return;
    }
    list.innerHTML = data.items
      .map(
        (t) => `
      <liquid-glass class="user-card topic-card" data-topic="${escapeHtml(t.name)}" interactive>
        <div class="user-card-inner">
          <div class="avatar" style="background:var(--accent)">${ICONS.tag}</div>
          <div class="user-card-body">
            <div class="user-card-name">#${escapeHtml(t.name)}</div>
            <div class="user-card-sub">${t.posts} 条动态 · ${t.authors} 位参与者 · 近 7 天</div>
          </div>
        </div>
      </liquid-glass>`
      )
      .join('');
    list.querySelectorAll('.topic-card').forEach((el) => el.addEventListener('click', () => openTopicModal(el.dataset.topic)));
  } catch (err) {
    list.innerHTML = '';
    $('#discEmpty').hidden = false;
    $('#discEmptySub').textContent = err.message;
  }
}

async function openTopicModal(name) {
  openModal('topicModal');
  $('#topicModalName').textContent = '#' + name;
  const body = $('#topicPosts');
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/topics/' + encodeURIComponent(name) + '/posts?limit=20');
    if (!data.items.length) {
      body.innerHTML = '<div class="comment-empty" style="padding:32px">该话题下还没有可看的动态</div>';
      return;
    }
    body.innerHTML = data.items.map(postCardHtml).join('');
    bindPostCards(body);
  } catch (err) {
    body.innerHTML = `<div class="comment-empty" style="padding:32px">${escapeHtml(err.message)}</div>`;
  }
}

// ============ 收藏夹管理 ============

let favFolderPage = { folderId: 0, page: 1 };

async function openFavManager() {
  openModal('favManagerModal');
  await renderFavFolders();
  await renderFavPosts(0, 1);
}

async function renderFavFolders() {
  const data = await api('/me/folders');
  $('#favFolders').innerHTML = data.folders
    .map(
      (f) => `
    <button class="chip ${favFolderPage.folderId === f.id ? 'active' : ''}" data-fid="${f.id}">
      ${escapeHtml(f.name)}（${f.count}）
      ${f.id !== 0 ? `<span class="folder-acts"><i class="folder-ren" data-fid="${f.id}" title="重命名">✎</i><i class="folder-del" data-fid="${f.id}" title="删除">×"</i></span>` : ''}
    </button>`
    )
    .join('') + `<button class="chip" id="favFolderAdd">＋ 新建</button>`;
  $('#favFolders').querySelectorAll('[data-fid]').forEach((b) => {
    if (b.classList.contains('chip')) {
      b.addEventListener('click', (e) => {
        if (e.target.closest('.folder-acts')) return;
        favFolderPage = { folderId: Number(b.dataset.fid), page: 1 };
        renderFavFolders();
        renderFavPosts(favFolderPage.folderId, 1);
      });
    }
  });
  $('#favFolders').querySelectorAll('.folder-ren').forEach((i) =>
    i.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fid = Number(i.dataset.fid);
      const name = prompt('新的收藏夹名称');
      if (!name) return;
      try {
        await api('/me/folders/' + fid, { method: 'PUT', body: { name } });
        toast('已重命名');
        renderFavFolders();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
  $('#favFolders').querySelectorAll('.folder-del').forEach((i) =>
    i.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fid = Number(i.dataset.fid);
      if (!confirm('删除该收藏夹？其中内容会移入默认收藏夹')) return;
      try {
        await api('/me/folders/' + fid, { method: 'DELETE' });
        if (favFolderPage.folderId === fid) favFolderPage.folderId = 0;
        toast('已删除');
        renderFavFolders();
        renderFavPosts(favFolderPage.folderId, 1);
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
  $('#favFolderAdd').addEventListener('click', async () => {
    const name = prompt('新收藏夹名称');
    if (!name) return;
    try {
      await api('/me/folders', { method: 'POST', body: { name } });
      toast('已创建');
      renderFavFolders();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function renderFavPosts(folderId, page) {
  const body = $('#favPosts');
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/me/favorites?folderId=' + folderId + '&page=' + page + '&limit=10');
    if (!data.posts.length) {
      body.innerHTML = '<div class="comment-empty" style="padding:28px">这个收藏夹还是空的</div>';
      $('#favMore').hidden = true;
      return;
    }
    body.innerHTML = data.posts.map((p) => postCardHtml(p) + '').join('');
    // 追加取消收藏按钮
    body.querySelectorAll('.post-card').forEach((card) => {
      const id = Number(card.dataset.id);
      const del = document.createElement('button');
      del.className = 'btn small danger-ghost';
      del.textContent = '取消收藏';
      del.style.margin = '8px 15px 15px';
      del.addEventListener('click', async () => {
        if (!confirm('取消收藏这条动态？')) return;
        try {
          await api(`/posts/${id}/favorite`, { method: 'DELETE' });
          toast('已取消收藏');
          renderFavPosts(folderId, page);
          renderMeProfile();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      card.appendChild(del);
    });
    bindPostCards(body);
    $('#favMore').hidden = data.posts.length < 10;
    $('#favMore').onclick = () => renderFavPosts(folderId, page + 1);
  } catch (err) {
    body.innerHTML = `<div class="comment-empty">${escapeHtml(err.message)}</div>`;
  }
}

// 收藏到指定文件夹（详情页用）
async function openFolderPicker(postId) {
  try {
    const folders = (await api('/me/folders')).folders;
    const cur = folders.length ? null : null;
    $('#folderPickerList').innerHTML = folders
      .map(
        (f) => `
      <button class="btn ghost wide fp-item" data-fid="${f.id}">${escapeHtml(f.name)}</button>`
      )
      .join('');
    $('#folderPickerList').querySelectorAll('.fp-item').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api(`/posts/${postId}/favorite`, { method: 'POST', body: { folderId: Number(b.dataset.fid) } });
          closeModal('folderPickerModal');
          toast('已收藏到该文件夹');
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
    openModal('folderPickerModal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ============ 隐私与互动设置 ============

async function openPrivacyModal() {
  try {
    const data = await api('/me');
    const st = data.user.settings || {};
    $('#privacyPrivate').checked = !!st.privateAccount;
    $('#privacyDm').value = st.dmPolicy || 'everyone';
    $('#privacyComment').value = st.commentPolicy || 'everyone';
    $('#privacySearchHistory').checked = st.searchHistory !== false;
    openModal('privacyModal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#privacySave').addEventListener('click', async () => {
  try {
    await api('/me/settings', {
      method: 'PUT',
      body: {
        privateAccount: $('#privacyPrivate').checked,
        dmPolicy: $('#privacyDm').value,
        commentPolicy: $('#privacyComment').value,
        searchHistoryEnabled: $('#privacySearchHistory').checked,
      },
    });
    me.settings = {
      ...(me.settings || {}),
      privateAccount: $('#privacyPrivate').checked,
      dmPolicy: $('#privacyDm').value,
      commentPolicy: $('#privacyComment').value,
      searchHistory: $('#privacySearchHistory').checked,
    };
    closeModal('privacyModal');
    toast('隐私设置已保存');
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ============ 账号安全中心 ============

async function openSecurityModal() {
  openModal('securityModal');
  const body = $('#securityBody');
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/me/sessions');
    body.innerHTML = `
      <div class="creator-section-title">登录会话（${data.sessions.length}）</div>
      ${data.sessions
        .map(
          (s) => `
        <div class="admin-user-row">
          <div class="user-card-body">
            <div class="user-card-name">${escapeHtml(s.ua)}${s.current ? '<span class="state-tag followed-tag">当前设备</span>' : ''}</div>
            <div class="user-card-sub">${new Date(s.createdAt).toLocaleString('zh-CN')} · 会话 ID ${s.id}</div>
          </div>
          ${s.current ? '' : `<button class="btn small danger-ghost sess-kill" data-id="${s.id}">退出</button>`}
        </div>`
        )
        .join('')}
      <button class="btn ghost wide" id="logoutOthers" style="margin-top:10px">退出其他所有设备</button>
      <div class="creator-section-title">数据与账号</div>
      <div class="me-tools">
        <button class="me-tool-btn" id="secPwdBtn">${ICONS.esc} 修改密码</button>
        <button class="me-tool-btn" id="secExportBtn">${ICONS.download} 导出我的数据</button>
        <button class="me-tool-btn admin" id="secDeleteBtn">${ICONS.trashO} 注销账号</button>
      </div>
      <p class="field-hint">导出内容：个人资料、我的动态与草稿、评论、收藏、关注列表（不含密码与私信内容）。账号注销会删除全部动态、评论与私信，且不可恢复。</p>`;
    body.querySelectorAll('.sess-kill').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api('/me/sessions/' + b.dataset.id, { method: 'DELETE' });
          toast('该设备已退出登录');
          openSecurityModal();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
    $('#logoutOthers').addEventListener('click', async () => {
      if (!confirm('确定退出其他所有设备？')) return;
      try {
        const r = await api('/me/sessions/logout-others', { method: 'POST' });
        toast(`已退出其他 ${r.revoked} 台设备`);
        openSecurityModal();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    $('#secPwdBtn').addEventListener('click', () => {
      closeModal('securityModal');
      $('#pwdForm').reset();
      $('#pwdError').hidden = true;
      openModal('pwdModal');
    });
    $('#secExportBtn').addEventListener('click', async () => {
      try {
        const blob = await fetch(API + '/me/export', { headers: { Authorization: 'Bearer ' + token } }).then((r) => {
          if (!r.ok) throw new Error('导出失败');
          return r.blob();
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dgchat-export-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        toast('数据已导出');
      } catch (err) {
        toast(err.message || '导出失败', 'error');
      }
    });
    $('#secDeleteBtn').addEventListener('click', () => {
      const name = prompt('此操作不可恢复！输入你的用户名（' + me.username + '）以确认：');
      if (name !== me.username) return toast('用户名不匹配，已取消', 'error');
      const pwd = prompt('再输入登录密码以最终确认：');
      if (pwd === null) return;
      if (!confirm('最后一次确认：删除账号将清除全部动态、评论、私信，且无法恢复。继续？')) return;
      api('/me/delete', { method: 'POST', body: { password: pwd, confirm: 'DELETE' } })
        .then(async () => {
          toast('账号已注销');
          token = '';
          me = null;
          localStorage.removeItem('zdcw_token');
          location.reload();
        })
        .catch((err) => toast(err.message, 'error'));
    });
  } catch (err) {
    body.innerHTML = `<div class="comment-empty">${escapeHtml(err.message)}</div>`;
  }
}

// ============ 「我的」页新入口（2.1 组） ============

const _bindMeExtras = window.bindMeExtras;
window.bindMeExtras = function () {
  _bindMeExtras();
  const card = $('#meExtrasCard');
  if (!card || $('#meExtrasRow2')) return;
  const row2 = document.createElement('div');
  row2.className = 'me-tools';
  row2.id = 'meExtrasRow2';
  row2.style.marginTop = '8px';
  row2.innerHTML = `
    <button class="me-tool-btn" id="meFavMgrBtn">${ICONS.folder} 我的收藏</button>
    <button class="me-tool-btn" id="mePrivacyBtn">${ICONS.eyeOff} 隐私与互动</button>
    <button class="me-tool-btn" id="meSecurityBtn">${ICONS.esc} 账号安全</button>
    <button class="me-tool-btn" id="meNotifBtn">${ICONS.bell} 通知中心</button>`;
  card.appendChild(row2);
  $('#meFavMgrBtn').addEventListener('click', openFavManager);
  $('#mePrivacyBtn').addEventListener('click', openPrivacyModal);
  $('#meSecurityBtn').addEventListener('click', openSecurityModal);
  $('#meNotifBtn').addEventListener('click', openNotifications);
};

// ============ 离线提示（网络状态） ============

(() => {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.hidden = true;
  banner.textContent = '网络已断开 —— 编辑内容会自动保存在本地，联网后可重试';
  document.body.appendChild(banner);
  const update = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online', () => {
    update();
    if (me) toast('网络已恢复', '');
  });
  window.addEventListener('offline', update);
  update();
})();

// 通知未读轮询（30 秒，与私信未读共用节奏）
setInterval(refreshNotifBadge, 30000);

// 启动兜底：若 refreshMe 早于本文件加载完成，补渲染一次铃铛
if (me) renderNotifBell();
