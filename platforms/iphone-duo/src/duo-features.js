// DGChat iPhone Duo —— 功能补全（2.x 功能对齐：发帖/评论/收藏夹/通知/搜索/话题/消息操作）
// 参考了主站 web/js/app.js、feat21.js 的交互模式，代码为本目录独立实现。
// 依赖：DuoAPI（src/api.js）、DuoPanes（components/duo-panes.js）、window.DuoApp（src/duo-app.js 暴露）

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function openModal(id) {
    $('#' + id).hidden = false;
  }
  function closeModal(id) {
    $('#' + id).hidden = true;
  }
  window.DuoClose = closeModal;
  window.DuoOpen = openModal;

  const userPlus = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
  const users = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const folder = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  const privacy = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const security = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
  const chart = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
  const bell = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  const shield = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const heart = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  const ban = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
  const lock = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
  // ================= 通知中心 =================
  let notifTimer = null;

  async function refreshBadge() {
    if (!DuoAPI.hasToken()) return;
    try {
      const data = await DuoAPI.call('/api/me/notifications?limit=1');
      const dot = $('#duoNotifBadge');
      if (dot) {
        dot.hidden = !data.unread;
        dot.textContent = data.unread > 99 ? '99+' : data.unread;
      }
    } catch {}
  }

  const NOTIF_TEXT = {
    like: '赞了你的帖子', comment: '评论了你的帖子', follow: '关注了你',
    mention: '提到了你', dm: '给你发来了私信', system: '系统通知',
  };

  async function openNotifs() {
    openModal('duoNotifModal');
    const list = $('#duoNotifList');
    list.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/me/notifications?limit=50');
      if (!data.items.length) {
        list.innerHTML = '<div class="duo-empty">还没有通知</div>';
        return;
      }
      list.innerHTML = data.items
        .map(
          (n) => `
        <div class="duo-notif ${n.read ? '' : 'unread'}" data-id="${Number(n.id)}">
          <div class="duo-notif-body">
            <b>${n.actor ? esc(n.actor.nickname) : '已注销用户'}</b>
            <span>${NOTIF_TEXT[n.type] || '通知'}${n.postTitle ? '：' + esc(n.postTitle) : ''}</span>
            <small>${DuoPanes.timeAgo(n.createdAt)}</small>
          </div>
        </div>`
        )
        .join('');
      list.querySelectorAll('.duo-notif').forEach((el) =>
        el.addEventListener('click', async () => {
          const id = Number(el.dataset.id);
          try { await DuoAPI.call('/api/me/notifications/read', { method: 'POST', body: { ids: [id] } }); } catch {}
          closeModal('duoNotifModal');
          refreshBadge();
          const item = data.items.find((x) => x.id === id);
          if (item && item.type === 'dm') window.DuoApp.goChat();
          else if (item && item.postId) window.DuoApp.goPostsAndOpen(item.postId);
          else if (item && item.actor) window.DuoApp.openProfile?.(item.actor.id);
        })
      );
      // 全部已读
      $('#duoNotifReadAll').onclick = async () => {
        await DuoAPI.call('/api/me/notifications/read', { method: 'POST', body: { all: true } });
        openNotifs();
        refreshBadge();
      };
    } catch (err) {
      list.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 发帖（含图片、可见性、匿名、话题自动提取） =================
  const pickedFiles = [];

  async function openCompose() {
    const boards = (await DuoAPI.boards()).boards;
    $('#duoComposeBoard').innerHTML = boards.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
    restoreDraft();
    pickedFiles.length = 0;
    renderPicked();
    openModal('duoComposeModal');
  }

  function renderPicked() {
    $('#duoComposeThumbs').innerHTML = pickedFiles
      .map((f, i) => `<span class="duo-thumb"><img src="${f.url}" /><button data-i="${i}" class="duo-thumb-del">×</button></span>`)
      .join('');
    $('#duoComposeThumbs').querySelectorAll('.duo-thumb-del').forEach((b) =>
      b.addEventListener('click', () => {
        pickedFiles.splice(Number(b.dataset.i), 1);
        renderPicked();
      })
    );
  }

  function scheduleComposeDraftSave() {
    const key = 'duo_draft_' + (DuoAPI.hasToken() ? 'me' : 'anon');
    clearTimeout(window.__duoDraftTimer);
    $('#duoComposeState').textContent = '保存中…';
    window.__duoDraftTimer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({
          title: $('#duoComposeTitle').value,
          content: $('#duoComposeContent').value,
          updatedAt: Date.now(),
        }));
        $('#duoComposeState').textContent = '已保存（本地）';
      } catch {
        $('#duoComposeState').textContent = '保存失败';
      }
    }, 1500);
  }

  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem('duo_draft_me') || 'null');
      if (d) {
        $('#duoComposeTitle').value = d.title || '';
        $('#duoComposeContent').value = d.content || '';
        $('#duoComposeState').textContent = '已恢复本地草稿';
      } else {
        $('#duoComposeTitle').value = '';
        $('#duoComposeContent').value = '';
        $('#duoComposeState').textContent = '';
      }
    } catch {}
  }

  async function submitCompose(asDraft) {
    const fd = new FormData();
    fd.append('board', $('#duoComposeBoard').value);
    fd.append('title', $('#duoComposeTitle').value.trim());
    fd.append('content', $('#duoComposeContent').value.trim());
    fd.append('anonymous', $('#duoComposeAnon').checked);
    fd.append('visibility', $('#duoComposeVis').value);
    if (asDraft) fd.append('draft', 'true');
    pickedFiles.forEach((f) => fd.append('images', f.file));
    if (!$('#duoComposeTitle').value.trim()) return setComposeError('请填写标题');
    $('#duoComposeSubmit').disabled = true;
    try {
      await DuoAPI.call('/api/posts', { method: 'POST', body: fd });
      localStorage.removeItem('duo_draft_me');
      closeModal('duoComposeModal');
      toast21(asDraft ? '草稿已保存（服务器）' : '发布成功');
      window.DuoApp.reloadPosts();
    } catch (err) {
      setComposeError(err.message);
    } finally {
      $('#duoComposeSubmit').disabled = false;
    }
  }

  function setComposeError(msg) {
    const el = $('#duoComposeError');
    el.textContent = msg;
    el.hidden = false;
  }

  function toast21(msg) {
    const t = document.createElement('div');
    t.className = 'duo-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ================= 收藏到文件夹 =================
  async function openFolderPicker(postId) {
    try {
      const folders = (await DuoAPI.call('/api/me/folders')).folders;
      $('#duoFolderList').innerHTML = folders
        .map((f) => `<button class="duo-btn wide" data-fid="${Number(f.id)}">${esc(f.name)}（${Number(f.count)}）</button>`)
        .join('');
      $('#duoFolderList').querySelectorAll('[data-fid]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            await DuoAPI.call(`/api/posts/${postId}/favorite`, { method: 'POST', body: { folderId: Number(b.dataset.fid) } });
            closeModal('duoFolderModal');
            toast21('已收藏');
          } catch (err) {
            toast21(err.message);
          }
        })
      );
      openModal('duoFolderModal');
    } catch (err) {
      toast21(err.message);
    }
  }

  // ================= 话题详情 =================
  async function openTopic(name) {
    openModal('duoTopicModal');
    $('#duoTopicName').textContent = '#' + name;
    const body = $('#duoTopicPosts');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/topics/' + encodeURIComponent(name) + '/posts?limit=20');
      body.innerHTML = data.items.map(DuoPanes.postCard).join('') || '<div class="duo-empty">该话题下还没有可看的动态</div>';
      body.querySelectorAll('.duo-post-card').forEach((el) =>
        el.addEventListener('click', () => {
          closeModal('duoTopicModal');
          window.DuoApp.goPostsAndOpen(Number(el.dataset.id));
        })
      );
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 统一搜索 =================
  let searchTab = 'posts';
  async function openSearch() {
    openModal('duoSearchModal');
    doSearch();
  }
  async function doSearch(page = 1) {
    const q = $('#duoSearchQuery').value.trim();
    const body = $('#duoSearchResults');
    if (page === 1) body.innerHTML = '<div class="duo-empty">搜索中…</div>';
    const params = new URLSearchParams({ type: searchTab, q, page: String(page) });
    if (searchTab === 'posts') params.set('sort', $('#duoSearchSort').value);
    try {
      const data = await DuoAPI.call('/api/search?' + params.toString());
      const items = data.items || [];
      if (!items.length && page === 1) {
        body.innerHTML = '<div class="duo-empty">没有结果</div>';
        return;
      }
      let html = '';
      if (searchTab === 'posts') html = items.map(DuoPanes.postCard).join('');
      else if (searchTab === 'users')
        html = items
          .map(
            (u) => `
          <liquid-glass class="duo-item" interactive><div class="duo-item-inner">
            ${DuoPanes.avatarHtml(u)}
            <div class="duo-item-body"><div class="duo-name">${esc(u.nickname)}</div><div class="duo-preview">@${esc(u.username)}</div></div>
          </div></liquid-glass>`
          )
          .join('');
      else
        html = items
          .map(
            (t) => `
          <liquid-glass class="duo-item" data-topic="${esc(t.name)}" interactive><div class="duo-item-inner">
            <div class="duo-avatar" style="background:var(--duo-accent)">#</div>
            <div class="duo-item-body"><div class="duo-name">#${esc(t.name)}</div><div class="duo-preview">${Number(t.posts)} 条 · ${Number(t.authors)} 人</div></div>
          </div></liquid-glass>`
          )
          .join('');
      const more = items.length >= 10 ? `<button class="duo-btn" id="duoSearchMore">加载更多</button>` : '';
      body.innerHTML = (page > 1 ? body.innerHTML.replace(/<button class="duo-btn" id="duoSearchMore">[\s\S]*?<\/button>/, '') : '') + html + more;
      if (searchTab === 'posts')
        body.querySelectorAll('.duo-post-card').forEach((el) =>
          el.addEventListener('click', () => {
            closeModal('duoSearchModal');
            window.DuoApp.goPostsAndOpen(Number(el.dataset.id));
          })
        );
      body.querySelectorAll('[data-topic]').forEach((el) => el.addEventListener('click', () => openTopic(el.dataset.topic)));
      $('#duoSearchMore')?.addEventListener('click', () => doSearch(page + 1));
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 评论（详情页输入框） =================
  async function submitComment(postId) {
    const input = $('#duoCommentInput');
    const content = input.value.trim();
    if (!content) return toast21('评论不能为空');
    try {
      await DuoAPI.call(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: { content, anonymous: $('#duoCommentAnon').checked },
      });
      input.value = '';
      toast21('评论成功');
      window.DuoApp.reloadDetail(postId);
    } catch (err) {
      toast21(err.message);
    }
  }

  // ================= 绑定入口 =================
  document.addEventListener('DOMContentLoaded', () => {
    $('#duoBtnSearch').addEventListener('click', openSearch);
    $('#duoBtnNotif').addEventListener('click', openNotifs);
    $('#duoBtnCompose').addEventListener('click', openCompose);
    $('#duoSearchGo').addEventListener('click', () => doSearch());
    $('#duoSearchQuery').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());
    $$('.duo-search-tab').forEach((b) =>
      b.addEventListener('click', () => {
        searchTab = b.dataset.stab;
        $$('.duo-search-tab').forEach((x) => x.classList.toggle('active', x === b));
        doSearch();
      })
    );
    $('#duoComposeImg').addEventListener('change', (e) => {
      for (const f of [...e.target.files]) {
        if (pickedFiles.length >= 9) return toast21('最多 9 张图片');
        pickedFiles.push({ file: f, url: URL.createObjectURL(f) });
      }
      e.target.value = '';
      renderPicked();
    });
    $('#duoComposeSubmit').addEventListener('click', () => submitCompose(false));
    $('#duoComposeDraft').addEventListener('click', () => submitCompose(true));
    ['input', 'change'].forEach((evt) => $('#duoComposeForm').addEventListener(evt, scheduleComposeDraftSave));
    // 弹窗关闭键（全局绑定，修复关闭键无响应）+ 遮罩点击关闭
    $$('[data-close]').forEach((btn) =>
      btn.addEventListener('click', () => closeModal(btn.dataset.close))
    );
    $$('.duo-mask').forEach((m) =>
      m.addEventListener('click', (e) => {
        if (e.target === m) m.hidden = true;
      })
    );
    refreshBadge();
    clearInterval(notifTimer);
    notifTimer = setInterval(refreshBadge, 30000);
  });


  // ================= 隐私与互动设置 =================
  async function openPrivacy() {
    try {
      const data = await DuoAPI.me();
      const st = (data.user.settings || {});
      $('#duoPrivacyPrivate').checked = !!st.privateAccount;
      $('#duoPrivacyDm').value = st.dmPolicy || 'everyone';
      $('#duoPrivacyComment').value = st.commentPolicy || 'everyone';
      $('#duoPrivacySearch').checked = st.searchHistory !== false;
      openModal('duoPrivacyModal');
    } catch (err) {
      toast21(err.message);
    }
  }
  $('#duoPrivacySave').addEventListener('click', async () => {
    try {
      await DuoAPI.call('/api/me/settings', {
        method: 'PUT',
        body: {
          privateAccount: $('#duoPrivacyPrivate').checked,
          dmPolicy: $('#duoPrivacyDm').value,
          commentPolicy: $('#duoPrivacyComment').value,
          searchHistoryEnabled: $('#duoPrivacySearch').checked,
        },
      });
      closeModal('duoPrivacyModal');
      toast21('隐私设置已保存');
    } catch (err) {
      toast21(err.message);
    }
  });

  // ================= 收藏夹管理（创建/删除/浏览/取消收藏） =================
  let favMgr = { folderId: 0, page: 1 };
  async function openFavManager() {
    openModal('duoFavMgrModal');
    await renderFavMgrFolders();
    await renderFavMgrPosts(0, 1);
  }
  async function renderFavMgrFolders() {
    const data = await DuoAPI.call('/api/me/folders');
    $('#duoFavMgrFolders').innerHTML =
      data.folders
        .map(
          (f) => `
        <button class="duo-btn small ${favMgr.folderId === f.id ? 'primary' : ''}" data-fid="${Number(f.id)}">
          ${esc(f.name)}（${Number(f.count)}）${f.id !== 0 ? '<span class="duo-folder-del" data-del="' + Number(f.id) + '" title="删除"> ×</span>' : ''}
        </button>`
        )
        .join('') + '<button class="duo-btn small" id="duoFavMgrAdd">＋ 新建</button>';
    $('#duoFavMgrFolders').querySelectorAll('[data-fid]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        if (e.target.dataset.del) {
          if (!confirm('删除该收藏夹？内容会移入默认收藏夹')) return;
          await DuoAPI.call('/api/me/folders/' + e.target.dataset.del, { method: 'DELETE' });
          favMgr.folderId = 0;
          openFavManager();
          return;
        }
        favMgr = { folderId: Number(b.dataset.fid), page: 1 };
        renderFavMgrFolders();
        renderFavMgrPosts(favMgr.folderId, 1);
      })
    );
    $('#duoFavMgrAdd').addEventListener('click', async () => {
      const name = prompt('新收藏夹名称');
      if (!name) return;
      try {
        await DuoAPI.call('/api/me/folders', { method: 'POST', body: { name } });
        renderFavMgrFolders();
      } catch (err) {
        toast21(err.message);
      }
    });
  }
  async function renderFavMgrPosts(folderId, page) {
    const body = $('#duoFavMgrPosts');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/me/favorites?folderId=' + folderId + '&page=' + page + '&limit=10');
      if (!data.posts.length) {
        body.innerHTML = '<div class="duo-empty">这个收藏夹还是空的</div>';
        $('#duoFavMgrMore').hidden = true;
        return;
      }
      body.innerHTML = data.posts.map(DuoPanes.postCard).join('');
      body.querySelectorAll('.duo-post-card').forEach((card) => {
        const id = Number(card.dataset.id);
        const rm = document.createElement('button');
        rm.className = 'duo-btn small';
        rm.textContent = '取消收藏';
        rm.style.margin = '0 12px 12px';
        rm.addEventListener('click', async () => {
          await DuoAPI.call(`/api/posts/${id}/favorite`, { method: 'DELETE' });
          toast21('已取消收藏');
          renderFavMgrPosts(folderId, page);
        });
        card.appendChild(rm);
      });
      body.querySelectorAll('.duo-post-card').forEach((card) =>
        card.addEventListener('click', (e) => {
          if (e.target.closest('.duo-btn')) return;
          closeModal('duoFavMgrModal');
          window.DuoApp.goPostsAndOpen(Number(card.dataset.id));
        })
      );
      $('#duoFavMgrMore').hidden = data.posts.length < 10;
      $('#duoFavMgrMore').onclick = () => renderFavMgrPosts(folderId, page + 1);
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 账号安全（会话列表 / 退出其他设备 / 修改密码） =================
  async function openSecurity() {
    openModal('duoSecurityModal');
    const body = $('#duoSecurityBody');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/me/sessions');
      body.innerHTML = `
        <div class="duo-folder-list">
          ${data.sessions
            .map(
              (x) => `
            <div class="duo-notif">
              <div class="duo-notif-body">
                <b>${esc(x.ua)}</b>${x.current ? ' <span class="duo-tag-current">当前设备</span>' : ''}
                <small>${new Date(x.createdAt).toLocaleString('zh-CN')} · ID ${esc(x.id)}</small>
              </div>
              ${x.current ? '' : `<button class="duo-btn small" data-kill="${esc(x.id)}">退出</button>`}
            </div>`
            )
            .join('')}
        </div>
        <button class="duo-btn wide" id="duoLogoutOthers">退出其他所有设备</button>
        <p class="duo-hint" style="margin-top:10px">修改密码请使用「我的 → 修改密码」</p>`;
      body.querySelectorAll('[data-kill]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            await DuoAPI.call('/api/me/sessions/' + b.dataset.kill, { method: 'DELETE' });
            toast21('该设备已退出');
            openSecurity();
          } catch (err) {
            toast21(err.message);
          }
        })
      );
      $('#duoLogoutOthers').addEventListener('click', async () => {
        if (!confirm('确定退出其他所有设备？')) return;
        const r = await DuoAPI.call('/api/me/sessions/logout-others', { method: 'POST' });
        toast21(`已退出其他 ${r.revoked} 台设备`);
        openSecurity();
      });
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 用户资料（关注/取关/私信） =================
  async function openUser(uid) {
    try {
      const data = await DuoAPI.call('/api/users/' + uid);
      const u = data.user;
      const box = $('#duoUserBox');
      box.innerHTML = `
        <div class="duo-sheet-head"><b>个人资料</b><button class="duo-close" data-close="duoUserModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
        <div class="duo-item-inner">
          ${DuoPanes.avatarHtml(u)}
          <div class="duo-item-body">
            <div class="duo-name">${esc(u.nickname)}</div>
            <div class="duo-preview">@${esc(u.username)} · ${Number(u.followerCount)} 粉丝 · ${Number(u.postCount)} 帖子</div>
            ${u.bio ? `<div class="duo-preview">${esc(u.bio)}</div>` : ''}
            ${(u.interests || []).length ? `<div class="duo-preview">${u.interests.map(esc).join(' · ')}</div>` : ''}
          </div>
        </div>
        <div class="duo-row">
          ${u.isMe ? '<span class="duo-hint">这是你自己</span>' : `
            <button class="duo-btn" id="duoUFollow" data-following="${u.isFollowing ? 1 : 0}">${u.isFollowing ? '取消关注' : '关 注'}</button>
            <button class="duo-btn" id="duoUDm">私 信</button>
            <button class="duo-btn" id="duoUMute">${(u.isFollowing === undefined ? 0 : 0) ? '' : '静 音'}</button>`}
        </div>`;
      box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoUserModal'));
      if (!u.isMe) {
        $('#duoUFollow').addEventListener('click', async (e) => {
          const following = e.currentTarget.dataset.following === '1';
          const r = await DuoAPI.call(`/api/users/${uid}/follow`, { method: following ? 'DELETE' : 'POST' });
          e.currentTarget.dataset.following = r.following ? '1' : '0';
          e.currentTarget.textContent = r.pending ? '已申请' : r.following ? '取消关注' : '关 注';
          toast21(r.pending ? '已发送关注申请' : r.following ? '已关注' : '已取消关注');
        });
        $('#duoUDm').addEventListener('click', () => {
          closeModal('duoUserModal');
          window.DuoApp.goChat();
          window.DuoApp.openThreadById?.(uid, u.nickname);
        });
        $('#duoUMute').addEventListener('click', async () => {
          try {
            const muted = (await DuoAPI.call('/api/me/muted')).users.some((x) => x.id === uid);
            await DuoAPI.call(`/api/users/${uid}/mute`, { method: muted ? 'DELETE' : 'POST' });
            toast21(muted ? '已取消静音' : '已静音');
            closeModal('duoUserModal');
          } catch (err) {
            toast21(err.message);
          }
        });
      }
      openModal('duoUserModal');
    } catch (err) {
      toast21(err.message);
    }
  }



  // ================= 我的粉丝 =================
  async function openFollowers() {
    openModal('duoUserModal');
    const box = $('#duoUserBox');
    box.innerHTML = '<div class="duo-sheet-head"><b>我的粉丝</b><button class="duo-close" data-close="duoUserModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="duo-empty">加载中…</div>';
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoUserModal'));
    try {
      const data = await DuoAPI.call('/api/me/followers');
      box.innerHTML += data.users.length
        ? data.users.map((u) => `
          <div class="duo-notif">
            ${DuoPanes.avatarHtml(u)}
            <div class="duo-notif-body"><b>${esc(u.nickname)}</b><small>@${esc(u.username)}</small></div>
            <button class="duo-btn small ${u.isFollowing ? '' : 'primary'}" data-fb="${Number(u.id)}">${u.isFollowing ? '已关注' : '回关'}</button>
          </div>`).join('')
        : '<div class="duo-empty">还没有粉丝</div>';
      box.querySelectorAll('[data-fb]').forEach((b) =>
        b.addEventListener('click', async () => {
          const r = await DuoAPI.call(`/api/users/${b.dataset.fb}/follow`, { method: 'POST' });
          b.textContent = r.following ? '已关注' : '已申请';
          toast21(r.following ? '已回关' : '已发送关注申请');
        })
      );
    } catch (err) {
      box.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 屏蔽管理 =================
  async function openBlocked() {
    openModal('duoUserModal');
    const box = $('#duoUserBox');
    box.innerHTML = '<div class="duo-sheet-head"><b>屏蔽管理</b><button class="duo-close" data-close="duoUserModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="duo-empty">加载中…</div>';
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoUserModal'));
    try {
      const data = await DuoAPI.call('/api/me/blocked');
      box.innerHTML += data.users.length
        ? data.users.map((u) => `
          <div class="duo-notif">
            ${DuoPanes.avatarHtml(u)}
            <div class="duo-notif-body"><b>${esc(u.nickname)}</b><small>@${esc(u.username)} · 屏蔽中：互相不可见、不能私信</small></div>
            <button class="duo-btn small" data-ub="${Number(u.id)}">取消屏蔽</button>
          </div>`).join('')
        : '<div class="duo-empty">没有屏蔽任何人</div>';
      box.querySelectorAll('[data-ub]').forEach((b) =>
        b.addEventListener('click', async () => {
          await DuoAPI.call(`/api/users/${b.dataset.ub}/block`, { method: 'DELETE' });
          toast21('已取消屏蔽');
          openBlocked();
        })
      );
    } catch (err) {
      box.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 修改密码（独立弹窗） =================
  function openChangePwd() {
    ['duoPwdCur', 'duoPwdNew', 'duoPwdNew2'].forEach((id) => (document.getElementById(id).value = ''));
    $('#duoPwdError').hidden = true;
    openModal('duoPwdModal');
  }
  $('#duoPwdSave').addEventListener('click', async () => {
    const err = $('#duoPwdError');
    err.hidden = true;
    if ($('#duoPwdNew').value !== $('#duoPwdNew2').value) {
      err.textContent = '两次输入的新密码不一致';
      err.hidden = false;
      return;
    }
    try {
      await DuoAPI.call('/api/me/password', {
        method: 'PUT',
        body: { currentPassword: $('#duoPwdCur').value, newPassword: $('#duoPwdNew').value },
      });
      closeModal('duoPwdModal');
      toast21('密码已修改，其他设备已退出登录');
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    }
  });

  // ================= 管理后台（紧凑版：数据 / 举报 / 用户） =================
  let adminSeg = 'stats';
  async function openAdmin() {
    openModal('duoAdminModal');
    renderAdminShell();
    loadAdminSeg();
  }
  function renderAdminShell() {
    const box = $('#duoAdminBox');
    box.innerHTML = `
      <div class="duo-sheet-head"><b>管理后台</b><button class="duo-close" data-close="duoAdminModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
      <div class="duo-seg">
        <button class="duo-tab ${adminSeg === 'stats' ? 'active' : ''}" data-aseg="stats">运营数据</button>
        <button class="duo-tab ${adminSeg === 'reports' ? 'active' : ''}" data-aseg="reports">举报处理</button>
        <button class="duo-tab ${adminSeg === 'users' ? 'active' : ''}" data-aseg="users">用户管理</button>
      </div>
      <div id="duoAdminBody" style="max-height:55vh;overflow-y:auto"></div>`;
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoAdminModal'));
    box.querySelectorAll('[data-aseg]').forEach((b) =>
      b.addEventListener('click', () => {
        adminSeg = b.dataset.aseg;
        renderAdminShell();
        loadAdminSeg();
      })
    );
  }
  async function loadAdminSeg() {
    const body = $('#duoAdminBody');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      if (adminSeg === 'stats') return renderAdminStats(body);
      if (adminSeg === 'reports') return renderAdminReports(body);
      return renderAdminUsers(body);
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }
  async function renderAdminStats(body) {
    const d = await DuoAPI.call('/api/admin/stats?days=7');
    body.innerHTML = `
      <div class="duo-me-stats">
        <span><b>${Number(d.users.total)}</b>用户(${Number(d.users.new)}新增)</span>
        <span><b>${Number(d.posts.total)}</b>动态(${Number(d.posts.new)}新增)</span>
        <span><b>${Number(d.interactions.likes)}</b>点赞</span>
      </div>
      <div class="duo-me-stats">
        <span><b>${Number(d.interactions.comments)}</b>评论</span>
        <span><b>${Number(d.interactions.messages)}</b>私信</span>
        <span><b>${Number(d.pendingReports)}</b>待处理举报</span>
      </div>
      <p class="duo-hint">近 7 天口径：新增=期间创建；点赞/评论/私信为累计 · ${new Date(Number(d.generatedAt)).toLocaleString('zh-CN')}</p>`;
  }
  const ADMIN_ACTIONS = [
    ['dismiss', '忽略'], ['hide_post', '隐藏动态'], ['delete_post', '删除动态'],
    ['delete_comment', '删除评论'], ['restrict_user', '限制账号'], ['ban_user', '封禁账号'],
  ];
  const ADMIN_DANGEROUS = ['delete_post', 'delete_comment', 'restrict_user', 'ban_user'];
  async function renderAdminReports(body) {
    const d = await DuoAPI.call('/api/admin/reports?status=pending');
    if (!d.reports.length) {
      body.innerHTML = '<div class="duo-empty">没有待处理的举报 🎉</div>';
      return;
    }
    body.innerHTML = d.reports.map((r) => `
      <div class="duo-notif" style="flex-direction:column;align-items:stretch">
        <div><b>${esc(r.reason)}</b> · ${r.targetType === 'post' ? '帖子' : r.targetType === 'comment' ? '评论' : '用户'} · 举报人 ${esc(r.reporter ? r.reporter.nickname : '已注销')}</div>
        <small>${esc(r.targetPreview)}${r.detail ? ' · ' + esc(r.detail) : ''}</small>
        <div class="duo-row" style="margin:6px 0 0">
          ${ADMIN_ACTIONS.filter(([a]) => {
            if (r.targetType === 'post') return a !== 'delete_comment';
            if (r.targetType === 'comment') return ['dismiss','delete_comment','restrict_user','ban_user'].includes(a);
            return ['dismiss','restrict_user','ban_user'].includes(a);
          }).map(([a, n]) => `<button class="duo-btn small ${ADMIN_DANGEROUS.includes(a) ? 'duo-danger' : ''}" data-rid="${Number(r.id)}" data-act="${a}">${n}</button>`).join('')}
        </div>
      </div>`).join('');
    body.querySelectorAll('[data-rid]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.act;
        if (ADMIN_DANGEROUS.includes(act) && !confirm('确认执行「' + b.textContent + '」？会记录管理日志')) return;
        try {
          const res = await DuoAPI.call(`/api/admin/reports/${b.dataset.rid}/handle`, { method: 'POST', body: { action: act, note: 'Duo 管理后台' } });
          toast21(res.applied || '已处理');
          loadAdminSeg();
        } catch (e) {
          toast21(e.message);
        }
      })
    );
  }
  const ADMIN_STATUS = { active: '正常', restricted: '限制', banned: '封禁' };
  async function renderAdminUsers(body) {
    body.innerHTML = '<input id="duoAdminUserSearch" class="duo-field" type="search" placeholder="搜索用户名 / 昵称 / 邮箱" /><div id="duoAdminUserList"></div>';
    const load = async () => {
      const q = $('#duoAdminUserSearch').value.trim();
      const d = await DuoAPI.call('/api/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''));
      $('#duoAdminUserList').innerHTML = d.users.map((u) => `
        <div class="duo-notif">
          ${DuoPanes.avatarHtml(u)}
          <div class="duo-notif-body"><b>${esc(u.nickname)}</b><small>@${esc(u.username)} · ${Number(u.postCount)} 帖 · ${ADMIN_STATUS[u.status] || '正常'}</small></div>
          ${u.role === 'admin' ? '<span class="duo-hint">管理员</span>' : `
          <select class="duo-field" style="width:auto;margin:0;padding:6px 8px" data-us="${Number(u.id)}">
            <option value="active" ${u.status === 'active' ? 'selected' : ''}>正常</option>
            <option value="restricted" ${u.status === 'restricted' ? 'selected' : ''}>限制</option>
            <option value="banned" ${u.status === 'banned' ? 'selected' : ''}>封禁</option>
          </select>`}
        </div>`).join('');
      $('#duoAdminUserList').querySelectorAll('[data-us]').forEach((sel) =>
        sel.addEventListener('change', async () => {
          if (sel.value !== 'active' && !confirm('改为「' + ADMIN_STATUS[sel.value] + '」？会吊销其全部登录会话')) {
            return loadAdminSeg();
          }
          try {
            await DuoAPI.call(`/api/admin/users/${sel.dataset.us}/status`, { method: 'POST', body: { status: sel.value, reason: 'Duo 管理后台' } });
            toast21('已更新');
            loadAdminSeg();
          } catch (e) {
            toast21(e.message);
            loadAdminSeg();
          }
        })
      );
    };
    $('#duoAdminUserSearch').addEventListener('input', () => {
      clearTimeout(window.__duoAdminSearch);
      window.__duoAdminSearch = setTimeout(load, 300);
    });
    await load();
  }

  // ================= 兴趣标签编辑 =================
  let interestTags = [];
  async function openInterests() {
    try {
      const data = await DuoAPI.me();
      interestTags = [...(data.user.interests || [])];
      renderTags();
      openModal('duoInterestsModal');
    } catch (err) {
      toast21(err.message);
    }
  }
  function renderTags() {
    $('#duoTagEditor').innerHTML = interestTags.length
      ? interestTags.map((t, i) => `<span class="duo-topic-chip static">${esc(t)}<button class="duo-tag-del" data-i="${i}">×</button></span>`).join('')
      : '<span class="duo-hint">还没有添加</span>';
    $('#duoTagEditor').querySelectorAll('.duo-tag-del').forEach((b) =>
      b.addEventListener('click', () => {
        interestTags.splice(Number(b.dataset.i), 1);
        renderTags();
      })
    );
  }
  $('#duoTagAdd').addEventListener('click', () => {
    const v = $('#duoTagInput').value.trim();
    if (!v) return;
    if (v.length > 12) return toast21('单个标签最多 12 字');
    if (interestTags.length >= 8) return toast21('最多 8 个');
    if (interestTags.includes(v)) return toast21('已添加过');
    interestTags.push(v);
    $('#duoTagInput').value = '';
    renderTags();
  });
  $('#duoTagSave').addEventListener('click', async () => {
    try {
      await DuoAPI.call('/api/me/profile', { method: 'PUT', body: { interests: interestTags } });
      closeModal('duoInterestsModal');
      toast21('兴趣标签已保存');
      window.DuoApp.renderMe && window.DuoApp.renderMe();
    } catch (err) {
      toast21(err.message);
    }
  });

  // ================= 创作者中心（真实统计 + 草稿） =================
  async function openCreator() {
    openModal('duoCreatorModal');
    const box = $('#duoCreatorBox');
    box.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/me/creator');
      box.innerHTML = `
        <div class="duo-sheet-head"><b>创作者中心</b><button class="duo-close" data-close="duoCreatorModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
        <div class="duo-me-stats">
          <span><b>${Number(data.totals.views)}</b>浏览</span>
          <span><b>${Number(data.totals.likes)}</b>获赞</span>
          <span><b>${Number(data.totals.comments)}</b>评论</span>
        </div>
        <p class="duo-hint">口径：浏览量=非作者打开详情页次数；获赞/评论为累计值</p>
        ${data.drafts.length ? '<div class="duo-name" style="margin:8px 0">草稿（' + data.drafts.length + '）</div>' + data.drafts.map((d) => `
          <div class="duo-notif">
            <div class="duo-notif-body"><b>${esc(d.title)}</b><small>${esc(d.boardName)} · 草稿</small></div>
            <button class="duo-btn small" data-pub="${Number(d.id)}">发布</button>
            <button class="duo-btn small" data-edit="${Number(d.id)}">编辑</button>
          </div>`).join('') : ''}
        <div class="duo-name" style="margin:8px 0">已发布（${data.posts.length}）</div>
        ${data.posts.length ? data.posts.map((x) => `
          <div class="duo-notif">
            <div class="duo-notif-body"><b>${esc(x.title)}</b><small>${esc(x.boardName)} · 浏览 ${Number(x.views)} · 赞 ${Number(x.likes)} · 评论 ${Number(x.comments)}${x.visibility === 'private' ? ' · 仅自己' : ''}</small></div>
          </div>`).join('') : '<div class="duo-empty">还没有发布过动态</div>'}`;
      box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoCreatorModal'));
      box.querySelectorAll('[data-pub]').forEach((b) =>
        b.addEventListener('click', async () => {
          try {
            const cur = await DuoAPI.post(Number(b.dataset.pub));
            const fd = new FormData();
            fd.append('title', cur.post.title);
            fd.append('content', cur.post.content);
            fd.append('existingImages', JSON.stringify(cur.post.images || []));
            fd.append('publish', 'true');
            await DuoAPI.call(`/api/posts/${b.dataset.pub}`, { method: 'PUT', body: fd });
            toast21('草稿已发布');
            openCreator();
          } catch (err) {
            toast21(err.message);
          }
        })
      );
      box.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => {
          closeModal('duoCreatorModal');
          window.DuoApp.openEdit(Number(b.dataset.edit));
        })
      );
    } catch (err) {
      box.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 关注列表 =================
  async function openFollowing() {
    openModal('duoUserModal');
    const box = $('#duoUserBox');
    box.innerHTML = '<div class="duo-sheet-head"><b>关注列表</b><button class="duo-close" data-close="duoUserModal"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="duo-empty">加载中…</div>';
    try {
      const data = await DuoAPI.call('/api/me/following');
      box.innerHTML += data.users.length
        ? data.users.map((u) => `
          <div class="duo-notif">
            ${DuoPanes.avatarHtml(u)}
            <div class="duo-notif-body"><b>${esc(u.nickname)}</b><small>@${esc(u.username)} · ${Number(u.followerCount)} 粉丝</small></div>
            <button class="duo-btn small" data-unfollow="${Number(u.id)}">取关</button>
          </div>`).join('')
        : '<div class="duo-empty">还没有关注任何人</div>';
      box.querySelector('[data-close]').addEventListener('click', () => closeModal('duoUserModal'));
      box.querySelectorAll('[data-unfollow]').forEach((b) =>
        b.addEventListener('click', async () => {
          await DuoAPI.call(`/api/users/${b.dataset.unfollow}/follow`, { method: 'DELETE' });
          toast21('已取消关注');
          openFollowing();
        })
      );
    } catch (err) {
      box.innerHTML = `<div class="duo-empty">${esc(err.message)}</div>`;
    }
  }

  // ================= 自定义背景上传（压缩后本地存储） =================
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
  async function useImageAsBackground(file) {
    try {
      const dataUrl = await compressImage(file);
      localStorage.setItem('duo_bg', JSON.stringify({ id: 'custom', url: dataUrl }));
      window.DuoApp.applyBg && window.DuoApp.applyBg();
      window.DuoApp.renderBgPicker && window.DuoApp.renderBgPicker();
      toast21('自定义背景已应用');
    } catch (err) {
      toast21(err.message || '图片处理失败');
    }
  }

  // 暴露补充

  // 暴露给 duo-app.js 使用
  window.DuoFeatures = { openFolderPicker, openTopic, submitComment, toast21, openPrivacy, openFavManager, openSecurity, openUser, openInterests, openCreator, openFollowing, openFollowers, openBlocked, openChangePwd, openAdmin, useImageAsBackground, ICONS: { userPlus, users, folder, privacy, security, chart, bell, shield, heart, ban, lock }, };
})();
