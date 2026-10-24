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
  function setTab(tab) {
    state.tab = tab;
    document.body.dataset.duoTab = tab;
    $$('.duo-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#duoPostsPane').hidden = tab !== 'posts';
    $('#duoChatPane').hidden = tab !== 'chat';
    if (tab === 'posts') {
      $('#duoDetailPane').hidden = false;
      $('#duoThreadPane').hidden = true;
    } else {
      $('#duoDetailPane').hidden = true;
      $('#duoThreadPane').hidden = false;
    }
    applyLayout();
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
  };

  document.addEventListener('DOMContentLoaded', async () => {
    applyLayout();
    window.addEventListener('resize', applyLayout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', applyLayout);

    $('#duoTabPosts').addEventListener('click', () => setTab('posts'));
    $('#duoTabChat').addEventListener('click', () => setTab('chat'));

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
      loadPosts();
      loadConvs();
      setInterval(loadConvs, 20000); // 会话未读轮询
    }
  });
})();
