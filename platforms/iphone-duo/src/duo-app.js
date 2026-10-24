// DGChat iPhone Duo —— 应用编排：窗口状态驱动双栏 / 单栏切换
// 数据来自 DuoAPI（复用现有后端 REST），DOM 由 DuoPanes 组件构建。

(function () {
  const state = {
    mode: 'single', // 'single' | 'dual'
    tab: 'posts',
    threadMessages: [],
    threadReplyTo: null, // 'posts' | 'chat'
    posts: [],
    postDetail: null, // 当前选中的动态（含 comments）
    convs: [],
    threadPartner: null, // {id, nickname}
    me: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const TOOL_ICONS = {
    folders: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    privacy: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    security: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  };

  // ---------- 布局 ----------
  function applyLayout() {
    const vv = window.visualViewport;
    const env = {
      width: window.innerWidth,
      height: window.innerHeight,
      visualHeight: vv ? vv.height : window.innerHeight,
    };
    const r = window.DuoWindowState.resolveLayout(env, window.DUO_CONFIG);
    const prev = state.mode;
    state.mode = r.mode;
    document.body.dataset.duoMode = r.mode;
    document.body.dataset.duoKeyboard = r.keyboard ? '1' : '0';

    // 单栏时决定显示哪个面板：优先显示用户正在看的详情
    if (r.mode === 'single') {
      const vis = window.DuoWindowState.paneVisibility(prev, r.mode, !!currentSelection());
      document.body.dataset.duoPane = vis.showDetail ? 'detail' : 'list';
    } else {
      delete document.body.dataset.duoPane;
    }
    $('#duoStateLabel').textContent =
      (r.mode === 'dual' ? '展开 · 双栏' : '闭合 · 单栏') + (r.keyboard ? ' · 键盘' : '') +
      ` · ${window.innerWidth}×${window.innerHeight}`;
  }

  function currentSelection() {
    return state.tab === 'posts' ? state.postDetail : state.threadPartner;
  }

  // 切换标签页时清空另一模块的选择状态提示
  // 切换标签页：posts/chat 为双栏模块，discover/me 为全宽视图
  function setTab(tab) {
    state.tab = tab;
    $$('.duo-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    moveTabSlider(tab);
    const isDualModule = tab === 'posts' || tab === 'chat';
    $('#duoApp').style.display = isDualModule ? '' : 'none';
    $('#duoDiscoverView').hidden = tab !== 'discover';
    $('#duoMeView').hidden = tab !== 'me';
    $('#duoPostsPane').hidden = tab !== 'posts';
    if (tab === 'posts') {
      $('#duoDetailPane').hidden = false;
      $('#duoThreadPane').hidden = true;
    } else {
      $('#duoDetailPane').hidden = true;
      $('#duoThreadPane').hidden = false;
    }
    if (tab === 'discover') renderDiscover();
    if (tab === 'me') renderMe();
    applyLayout();
  }

  // 底栏胶囊滑块：跟随激活标签（含窗口尺寸变化重算）
  function moveTabSlider(tab) {
    const ind = $('#duoTabInd');
    const bar = $('#duoTabbar');
    const active = bar && bar.querySelector(`.duo-tab[data-tab="${tab}"]`);
    if (!ind || !bar || !active) return;
    const pr = bar.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    ind.style.left = Math.round(r.left - pr.left) + 'px';
    ind.style.width = Math.round(r.width) + 'px';
  }

  // ---------- 数据渲染 ----------
  async function loadPosts() {
    try {
      const data = await DuoAPI.posts('sort=latest');
      state.posts = data.posts;
      $('#duoPostList').innerHTML =
        data.posts.map(DuoPanes.postCard).join('') || '<div class="duo-empty">还没有动态</div>';
      $('#duoPostList').querySelectorAll('.duo-post-card').forEach((el) =>
        el.addEventListener('click', () => openPostDetail(Number(el.dataset.id)))
      );
    } catch (err) {
      $('#duoPostList').innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  async function openPostDetail(id) {
    try {
      const data = await DuoAPI.post(id);
      state.postDetail = data.post;
      state.postDetail.comments = data.comments;
      $('#duoDetailBody').innerHTML = DuoPanes.postDetail({ ...data.post, comments: data.comments });
      $('#duoDetailBody').dataset.pid = String(id);
      if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
      $('#duoLike').addEventListener('click', async () => {
        const r = await DuoAPI.like(id);
        $('#duoLike').textContent = `${r.likedByMe ? '♥' : '♡'} ${r.likeCount}`;
      });
      $('#duoFav').addEventListener('click', async () => {
        const r = await DuoAPI.favorite(id);
        $('#duoFav').textContent = `${r.favoritedByMe ? '★' : '☆'} ${r.favoriteCount}`;
      });
      const favFolderBtn = $('#duoFavFolder');
      if (favFolderBtn) favFolderBtn.addEventListener('click', () => window.DuoFeatures.openFolderPicker(id));
      const cmtSubmit = $('#duoCommentSubmit');
      if (cmtSubmit) cmtSubmit.addEventListener('click', () => window.DuoFeatures.submitComment(id));
      $('#duoDetailBody').querySelectorAll('.duo-topic-chip').forEach((chip) =>
        chip.addEventListener('click', () => window.DuoFeatures.openTopic(chip.dataset.topic))
      );
    } catch (err) {
      $('#duoDetailBody').innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  async function loadConvs() {
    try {
      const data = await DuoAPI.conversations();
      state.convs = data.conversations;
      const memo = state.me
        ? [
            {
              user: state.me,
              lastMessage: { content: '备忘录 · 只有自己能看到', createdAt: Date.now() },
              unread: 0,
            },
          ]
        : [];
      const all = memo.concat(data.conversations);
      $('#duoConvList').innerHTML =
        all.map(DuoPanes.convItem).join('') || '<div class="duo-empty">还没有会话</div>';
      $('#duoConvList').querySelectorAll('.duo-conv').forEach((el) =>
        el.addEventListener('click', () => openThread(Number(el.dataset.uid), el.querySelector('.duo-name').textContent))
      );
      const badge = $('#duoUnread');
      const unread = data.conversations.reduce((s, c) => s + (c.unread || 0), 0);
      badge.hidden = !unread;
      badge.textContent = unread;
    } catch (err) {
      $('#duoConvList').innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  async function openThread(uid, name) {
    try {
      const data = await DuoAPI.thread(uid);
      state.threadPartner = { id: uid, nickname: name };
      $('#duoThreadName').textContent = name;
      state.threadMessages = data.messages;
      $('#duoMsgList').innerHTML =
        data.messages.map((m) => DuoPanes.messageRow(m, Date.now())).join('') || '<div class="duo-empty">还没有消息</div>';
      $('#duoMsgList').querySelectorAll('.duo-msg-act').forEach((b) => {
        if (b.dataset.recall) {
          b.addEventListener('click', async () => {
            if (!confirm('撤回这条消息？')) return;
            try {
              await DuoAPI.call('/api/messages/' + b.dataset.recall + '/recall', { method: 'POST' });
              await openThread(uid, name);
            } catch (err) {
              alert(err.message);
            }
          });
        } else if (b.dataset.reply) {
          b.addEventListener('click', () => {
            const src = (state.threadMessages || []).find((m) => m.id === Number(b.dataset.reply));
            if (!src) return;
            state.threadReplyTo = { id: src.id, preview: (src.content || '').slice(0, 50) };
            $('#duoReplyBar').hidden = false;
            $('#duoReplyPreview').textContent = '引用对方：' + state.threadReplyTo.preview;
            $('#duoMsgInput').focus();
          });
        }
      });
      $('#duoMsgList').scrollTop = $('#duoMsgList').scrollHeight;
      if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
    } catch (err) {
      $('#duoMsgList').innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  async function sendMsg() {
    const input = $('#duoMsgInput');
    const content = input.value.trim();
    if (!content || !state.threadPartner) return;
    const clientId = Date.now() + '-' + Math.random().toString(36).slice(2, 8); // 幂等防重发
    try {
      await DuoAPI.call('/api/messages', {
        method: 'POST',
        body: { toUserId: state.threadPartner.id, content, clientId, replyTo: state.threadReplyTo ? state.threadReplyTo.id : undefined },
      });
      input.value = '';
      state.threadReplyTo = null;
      const bar = $('#duoReplyBar');
      if (bar) bar.hidden = true;
      await openThread(state.threadPartner.id, state.threadPartner.nickname);
    } catch (err) {
      alert((navigator.onLine === false ? '网络断开，消息已保留：' : '') + err.message);
    }
  }

  // ---------- 我的（个人主页） ----------
  async function renderMe() {
    const body = $('#duoMeBody');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      const [meData, stats] = await Promise.all([DuoAPI.me(), DuoAPI.call('/api/me/stats')]);
      state.me = meData.user;
      const mine = await DuoAPI.posts('mine=1&sort=latest');
      body.innerHTML = `
        <liquid-glass class="duo-item duo-me-card">
          <div class="duo-item-inner">
            ${DuoPanes.avatarHtml(state.me)}
            <div class="duo-item-body">
              <div class="duo-name">${DuoPanes.escapeHtml(state.me.nickname)}${state.me.role === 'admin' ? ' <span class="duo-admin-tag">管理员</span>' : ''}</div>
              <div class="duo-preview">@${DuoPanes.escapeHtml(state.me.username)}${state.me.email ? ' · ' + DuoPanes.escapeHtml(state.me.email) : ''}</div>
            </div>
          </div>
          <div class="duo-me-stats">
            <span><b>${stats.posts}</b>帖子</span><span><b>${stats.likesReceived}</b>获赞</span>
            <span><b>${stats.followers}</b>粉丝</span><span><b>${stats.following}</b>关注</span>
          </div>
        </liquid-glass>
        <div class="duo-tools">
          <button class="duo-tool" id="duoMeFolders">${TOOL_ICONS.folders}我的收藏</button>
          <button class="duo-tool" id="duoMePrivacy">${TOOL_ICONS.privacy}隐私与互动</button>
          <button class="duo-tool" id="duoMeSecurity">${TOOL_ICONS.security}账号安全</button>
          <button class="duo-tool" id="duoMeLogout">${TOOL_ICONS.logout}退出登录</button>
        </div>
        <div class="duo-pane-head" style="border:none;padding-left:2px">我的帖子（${mine.posts.length}）</div>
        ${mine.posts.map(DuoPanes.postCard).join('') || '<div class="duo-empty">还没有发过动态</div>'}`;
      body.querySelectorAll('.duo-post-card').forEach((el) =>
        el.addEventListener('click', () => {
          setTab('posts');
          openPostDetail(Number(el.dataset.id));
          if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
        })
      );
      $('#duoMeFolders').addEventListener('click', () => window.DuoFeatures.openFavManager());
      $('#duoMePrivacy').addEventListener('click', () => window.DuoFeatures.openPrivacy());
      $('#duoMeSecurity').addEventListener('click', () => window.DuoFeatures.openSecurity());
      $('#duoMeLogout').addEventListener('click', async () => {
        try { await DuoAPI.logout(); } catch {}
        DuoAPI.setToken('');
        location.reload();
      });
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  // ---------- 发现 ----------
  let discoverSeg = 'recommend';
  async function renderDiscover() {
    $$('#duoDiscoverSeg .duo-tab').forEach((b) => b.classList.toggle('active', b.dataset.disc === discoverSeg));
    const body = $('#duoDiscoverBody');
    body.innerHTML = '<div class="duo-empty">加载中…</div>';
    try {
      if (discoverSeg === 'recommend' || discoverSeg === 'topics') {
        if (discoverSeg === 'recommend') {
          const data = await DuoAPI.call('/api/discover/recommendations');
          body.innerHTML = data.users.length
            ? data.users
                .map(
                  (u) => `
              <liquid-glass class="duo-item duo-user" data-uid="${Number(u.id)}" interactive>
                <div class="duo-item-inner">
                  ${DuoPanes.avatarHtml(u)}
                  <div class="duo-item-body">
                    <div class="duo-item-top"><span class="duo-name">${DuoPanes.escapeHtml(u.nickname)}</span><span class="duo-time">${DuoPanes.escapeHtml(u.reason || '')}</span></div>
                    <div class="duo-preview">@${DuoPanes.escapeHtml(u.username)} · ${Number(u.followerCount)} 粉丝</div>
                  </div>
                  <button class="duo-btn small duo-follow" data-uid="${Number(u.id)}" data-following="0">关注</button>
                </div>
              </liquid-glass>`
                )
                .join('')
            : '<div class="duo-empty">暂无推荐，先去关注几位同学吧</div>'}
        else {
          const data = await DuoAPI.call('/api/topics?sort=hot');
          body.innerHTML = data.items.length
            ? data.items
                .map(
                  (t) => `
              <liquid-glass class="duo-item duo-topic-row" data-topic="${DuoPanes.escapeHtml(t.name)}" interactive>
                <div class="duo-item-inner">
                  <div class="duo-avatar" style="background:var(--duo-accent)">#</div>
                  <div class="duo-item-body">
                    <div class="duo-name">#${DuoPanes.escapeHtml(t.name)}</div>
                    <div class="duo-preview">${Number(t.posts)} 条动态 · ${Number(t.authors)} 位参与者</div>
                  </div>
                </div>
              </liquid-glass>`
                )
                .join('')
            : '<div class="duo-empty">还没有话题，发帖时用 #话题名# 创建</div>'}
      } else {
        const data = await DuoAPI.call('/api/discover/' + discoverSeg);
        body.innerHTML = data.posts.length
          ? data.posts.map(DuoPanes.postCard).join('')
          : '<div class="duo-empty">还没有动态</div>'}
      // 绑定
      body.querySelectorAll('.duo-user').forEach((el) =>
        el.addEventListener('click', () => window.DuoFeatures.openUser(Number(el.dataset.uid)))
      );
      body.querySelectorAll('.duo-follow').forEach((b) =>
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const r = await DuoAPI.call(`/api/users/${b.dataset.uid}/follow`, { method: 'POST' });
          b.textContent = r.pending ? '已申请' : '已关注';
          window.DuoFeatures.toast21(r.pending ? '已发送关注申请' : '已关注');
        })
      );
      body.querySelectorAll('.duo-topic-row').forEach((el) =>
        el.addEventListener('click', () => window.DuoFeatures.openTopic(el.dataset.topic))
      );
      if (window.bindTopicChips) window.bindTopicChips(body);
      body.querySelectorAll('.duo-post-card').forEach((el) =>
        el.addEventListener('click', () => {
          setTab('posts');
          openPostDetail(Number(el.dataset.id));
          if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
        })
      );
    } catch (err) {
      body.innerHTML = `<div class="duo-empty">${DuoPanes.escapeHtml(err.message)}</div>`;
    }
  }

  $$('#duoDiscoverSeg .duo-tab').forEach((b) =>
    b.addEventListener('click', () => {
      discoverSeg = b.dataset.disc;
      renderDiscover();
    })
  );

  // ---------- 登录 ----------
  async function ensureLogin() {
    if (!DuoAPI.hasToken()) {
      $('#duoLogin').hidden = false;
      $('#duoApp').hidden = true;
      return false;
    }
    try {
      const data = await DuoAPI.me();
      if (!data.user) throw new Error('会话失效');
      state.me = data.user;
      $('#duoLogin').hidden = true;
      $('#duoApp').hidden = false;
      return true;
    } catch {
      DuoAPI.setToken('');
      $('#duoLogin').hidden = false;
      $('#duoApp').hidden = true;
      return false;
    }
  }

  // ---------- 启动 ----------
  window.DuoApp = {
    reloadPosts: loadPosts,
    reloadDetail: (id) => openPostDetail(id),
    goPostsAndOpen: (id) => {
      setTab('posts');
      openPostDetail(id);
      if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
    },
    goChat: () => setTab('chat'),
    openThreadById: (uid, name) => {
      setTab('chat');
      openThread(uid, name);
      if (state.mode === 'single') document.body.dataset.duoPane = 'detail';
    },
  };

  document.addEventListener('DOMContentLoaded', async () => {
    applyLayout();
    window.addEventListener('resize', () => {
      applyLayout();
      moveTabSlider(state.tab);
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', applyLayout);

    $$('.duo-tab').forEach((b) => {
      if (b.dataset.tab) b.addEventListener('click', () => setTab(b.dataset.tab));
    });

    const loggedIn = await ensureLogin();
    if (!loggedIn) {
      $('#duoLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const data = await DuoAPI.login(
            $('#duoLoginUser').value.trim(),
            $('#duoLoginPass').value
          );
          DuoAPI.setToken(data.token);
          state.me = data.user;
          $('#duoLogin').hidden = true;
          $('#duoApp').hidden = false;
          boot();
        } catch (err) {
          $('#duoLoginError').textContent = err.message;
          $('#duoLoginError').hidden = false;
        }
      });
      return;
    }
    boot();

    function boot() {
      $('#duoLogout').addEventListener('click', async () => {
        try { await DuoAPI.logout(); } catch {}
        DuoAPI.setToken('');
        location.reload();
      });
      $('#duoSend').addEventListener('click', sendMsg);
    $('#duoReplyCancel').addEventListener('click', () => {
      state.threadReplyTo = null;
      $('#duoReplyBar').hidden = true;
    });
      $('#duoMsgInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMsg();
        }
      });
      setTab('posts');
      requestAnimationFrame(() => moveTabSlider('posts'));
      loadPosts();
      loadConvs();
      setInterval(loadConvs, 20000); // 会话未读轮询
    }
  });
})();
