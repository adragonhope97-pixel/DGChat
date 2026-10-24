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
    // 弹窗遮罩关闭
    $$('.duo-mask').forEach((m) =>
      m.addEventListener('click', (e) => {
        if (e.target === m) m.hidden = true;
      })
    );
    refreshBadge();
    clearInterval(notifTimer);
    notifTimer = setInterval(refreshBadge, 30000);
  });

  // 暴露给 duo-app.js 使用
  window.DuoFeatures = { openFolderPicker, openTopic, submitComment, toast21 };
})();
