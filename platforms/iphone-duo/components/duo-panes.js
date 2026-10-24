// DGChat iPhone Duo —— 双栏面板组件
// 独立实现（渲染模式参考了 web/js/app.js 的写法，但结构、类名与逻辑为本目录专有）。
// 只做 DOM 构建，不做网络请求（由 src/duo-app.js 编排）。

(function () {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function timeAgo(ts) {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    const h = Math.floor(min / 60);
    if (h < 24) return h + ' 小时前';
    const d = Math.floor(h / 24);
    if (d < 7) return d + ' 天前';
    const date = new Date(ts);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  // 原生 App 里相对路径（/uploads/...）会指向 capacitor://localhost —— 必须补全服务器地址
  const absUrl = (u) => (u && u.startsWith('/') ? (window.DUO_API_BASE || '') + u : u);

  function avatarHtml(author) {
    if (!author) return '<div class="duo-avatar anon">匿</div>';
    if (author.avatar) {
      return `<div class="duo-avatar"><img src="${escapeHtml(absUrl(author.avatar))}" alt="" /></div>`;
    }
    return `<div class="duo-avatar" style="background:${escapeHtml(author.avatarColor || '#4f8ef7')}">${escapeHtml((author.nickname || '?').slice(0, 1).toUpperCase())}</div>`;
  }

  window.DuoPanes = {
    escapeHtml,
    timeAgo,
    avatarHtml,

    // 动态卡片（列表项；mine=1 时显示板块标签与编辑/删除）
    postCard(p, mine) {
      const acts =
        p.canDelete
          ? `<span class="duo-card-acts">
               ${p.canEdit ? `<button class="duo-card-btn" data-act="edit" data-id="${Number(p.id)}" title="编辑">✎</button>` : ''}
               <button class="duo-card-btn" data-act="del" data-id="${Number(p.id)}" title="${p.isMine ? '删除' : '管理员删除'}">🗑</button>
             </span>`
          : '';
      return `
        <liquid-glass class="duo-item duo-post-card" data-id="${Number(p.id)}" interactive>
          <div class="duo-item-inner">
            ${avatarHtml(p.author)}
            <div class="duo-item-body">
              <div class="duo-item-top">
                <span class="duo-name">${p.author ? escapeHtml(p.author.nickname) : '匿名同学'}${p.isMine ? '<span class="duo-admin-tag">我</span>' : ''}</span>
                <span class="duo-time">${timeAgo(p.createdAt)}</span>
              </div>
              ${(p.topics || []).length ? `<div class="duo-topics">${p.topics.map((t) => `<button class="duo-topic-chip" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>` : ''}
              <div class="duo-title">${escapeHtml(p.title)}</div>
              <div class="duo-foot"><span class="duo-board-tag">${escapeHtml(p.boardName)}</span>${p.visibility === 'private' ? '<span class="duo-board-tag">仅自己</span>' : ''}${p.status === 'draft' ? '<span class="duo-board-tag">草稿</span>' : ''}${ICONS_FOOT(p.likeCount, p.commentCount, p.favoriteCount)}</div>
            </div>
            ${acts}
          </div>
        </liquid-glass>`;
    },

    // 动态详情（右栏）
    postDetail(p) {
      return `
        <div class="duo-detail-head">
          <span class="duo-board-tag">${escapeHtml(p.boardName)}</span>
          ${(p.topics || []).map((t) => `<button class="duo-topic-chip" data-topic="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}
        </div>
        <h2 class="duo-detail-title">${escapeHtml(p.title)}</h2>
        <div class="duo-detail-author">
          ${avatarHtml(p.author)}
          <div>
            <div class="duo-name">${p.author ? escapeHtml(p.author.nickname) : '匿名同学'}</div>
            <div class="duo-time">${timeAgo(p.createdAt)} · ${Number(p.views) || 0} 次浏览</div>
          </div>
        </div>
        <div class="duo-detail-content">${escapeHtml(p.content)}</div>
        <div class="duo-detail-actions">
          <button class="duo-btn" id="duoLike" data-id="${Number(p.id)}">${p.likedByMe ? '♥' : '♡'} ${Number(p.likeCount)}</button>
          <button class="duo-btn" id="duoFav" data-id="${Number(p.id)}">${p.favoritedByMe ? '★' : '☆'} ${Number(p.favoriteCount)}</button>
          ${window.DuoAPI && DuoAPI.hasToken() ? `<button class="duo-btn" id="duoFavFolder">收藏夹</button>` : ''}
          ${window.DuoAPI && DuoAPI.hasToken() && !p.isMine ? `<button class="duo-btn" id="duoHidePost">隐藏</button>` : ''}
        </div>
        <div class="duo-comments-title">评论（${Number(p.commentCount)}）</div>
        <div class="duo-comment-list">
          ${(p.comments || [])
            .map(
              (c) => `
            <div class="duo-comment">
              ${avatarHtml(c.author)}
              <div class="duo-comment-body">
                <div class="duo-item-top"><span class="duo-name">${c.author ? escapeHtml(c.author.nickname) : '匿名同学'}</span></div>
                <div class="duo-comment-content">${escapeHtml(c.content)}</div>
              </div>
            </div>`
            )
            .join('') || '<div class="duo-empty">还没有评论</div>'}
        </div>
        <div class="duo-comment-input">
          <textarea id="duoCommentInput" rows="2" maxlength="2000" placeholder="友善评论…"></textarea>
          <div class="duo-comment-acts">
            <label class="duo-check"><input type="checkbox" id="duoCommentAnon" />匿名</label>
            <button class="duo-btn" id="duoCommentSubmit">发送</button>
          </div>
        </div>`;
    },

    // 会话列表项（聊天左栏）
    convItem(c) {
      return `
        <liquid-glass class="duo-item duo-conv" data-uid="${Number(c.user.id)}" interactive>
          <div class="duo-item-inner">
            ${avatarHtml(c.user)}
            <div class="duo-item-body">
              <div class="duo-item-top">
                <span class="duo-name">${escapeHtml(c.user.nickname)}</span>
                <span class="duo-time">${timeAgo(c.lastMessage.createdAt)}</span>
              </div>
              <div class="duo-preview">${escapeHtml(c.lastMessage.content)}</div>
            </div>
            ${c.unread ? `<span class="duo-badge">${Number(c.unread)}</span>` : ''}
          </div>
        </liquid-glass>`;
    },

    // 消息气泡（聊天右栏）
    messageRow(m) {
      const recalled = m.recalled || m.content === null;
      const canRecall = m.fromMe && !recalled && Date.now() - m.createdAt < 5 * 60e3;
      const quote = m.replyTo ? `<div class="duo-msg-quote">引用 ${m.replyTo.fromMe ? '自己' : '对方'}：${escapeHtml(m.replyTo.preview)}</div>` : '';
      return `
        <div class="duo-msg ${m.fromMe ? 'mine' : 'theirs'}" data-id="${Number(m.id)}">
          ${quote}
          <div class="duo-msg-bubble ${recalled ? 'recalled' : ''}">${recalled ? '<i>消息已撤回</i>' : escapeHtml(m.content)}</div>
          <div class="duo-time">${timeAgo(m.createdAt)}${canRecall ? ` <button class="duo-msg-act" data-recall="${Number(m.id)}">撤回</button>` : ''}${!recalled && !m.fromMe ? ` <button class="duo-msg-act" data-reply="${Number(m.id)}">引用</button>` : ''}</div>
        </div>`;
    },
  };

  function ICONS_FOOT(likes, comments, favorites) {
    return `<span>♥ ${Number(likes)}</span><span>💬 ${Number(comments)}</span><span>☆ ${Number(favorites || 0)}</span>`;
  }
})();
