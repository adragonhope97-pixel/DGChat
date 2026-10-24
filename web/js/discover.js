// DGChat 2.0 —— 发现与交友 / 隐私与安全 / 创作者与运营工具
// 依赖 app.js 的全局环境（api、$、$$、me、toast、openModal 等），需在其后加载

// 举报图标（挂在 app.js 的 ICONS 上）
ICONS.flag =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
ICONS.userPlus =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
ICONS.chart =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
ICONS.users =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
ICONS.ban =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>';
ICONS.lock =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
ICONS.memo =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
ICONS.shield =
  '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

const REPORT_REASONS = ['垃圾广告', '辱骂攻击', '色情低俗', '违法信息', '侵权抄袭', '其他问题'];
const STATUS_LABEL = { active: '正常', restricted: '已限制', banned: '已封禁' };

// ========== 发现页 ==========

let discTab = 'recommend';
let userSearchTimer = null;

function loadDiscover() {
  $$('#discoverSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.disc === discTab));
  const usersWrap = $('#discUsersWrap');
  const postList = $('#discPostList');
  if (discTab === 'recommend') {
    usersWrap.hidden = false;
    postList.hidden = true;
    if (me) loadDiscUsers();
    else renderDiscUsers([], '登录后查看推荐，或先逛逛「最新动态」');
  } else if (discTab === 'topics') {
    usersWrap.hidden = false;
    postList.hidden = true;
    if (window.loadTopicTrending) loadTopicTrending();
  } else {
    usersWrap.hidden = true;
    postList.hidden = false;
    loadDiscPosts();
  }
}

$$('#discoverSeg .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    discTab = btn.dataset.disc;
    loadDiscover();
  });
});

$('#userSearchInput').addEventListener('input', () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(loadDiscUsers, 300);
});
$('#interestFilterInput').addEventListener('input', () => {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(loadDiscUsers, 300);
});

async function loadDiscUsers() {
  const params = new URLSearchParams();
  const q = $('#userSearchInput').value.trim();
  const interest = $('#interestFilterInput').value.trim();
  if (q) params.set('q', q);
  if (interest) params.set('interest', interest);
  const list = $('#userList');
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/discover/users?' + params.toString());
    renderDiscUsers(data.users, '没有找到符合条件的同学');
  } catch (err) {
    list.innerHTML = '';
    $('#discEmpty').hidden = false;
    $('#discEmptySub').textContent = err.message;
  }
}

function renderDiscUsers(users, emptyText) {
  const list = $('#userList');
  $('#discEmpty').hidden = users.length > 0;
  $('#discEmptySub').textContent = emptyText || '这里空空的';
  list.innerHTML = users
    .map(
      (u) => `
    <liquid-glass class="user-card" data-uid="${u.id}" interactive>
      <div class="user-card-inner">
        ${avatarHtml(u, false)}
        <div class="user-card-body">
          <div class="user-card-top">
            <span class="user-card-name">${escapeHtml(u.nickname)}${u.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</span>
            ${u.isFollowing ? '<span class="state-tag followed-tag">已关注</span>' : ''}
          </div>
          <div class="user-card-sub">@${escapeHtml(u.username)} · ${u.followerCount} 粉丝 · ${u.postCount} 帖子</div>
          ${u.bio ? `<div class="user-card-bio">${escapeHtml(u.bio)}</div>` : ''}
          ${
            (u.interests || []).length
              ? `<div class="user-card-interests">${u.interests
                  .map(
                    (i) =>
                      `<span class="interest-chip ${(u.sharedInterests || []).includes(i) ? 'shared' : ''}">${escapeHtml(i)}</span>`
                  )
                  .join('')}</div>`
              : ''
          }
          ${u.reason ? `<div class="user-card-reason">${escapeHtml(u.reason)}</div>` : ''}
        </div>
        <button class="btn small ${u.isFollowing ? 'ghost' : 'primary'} follow-btn" data-uid="${u.id}" data-following="${u.isFollowing ? 1 : 0}">
          ${u.isFollowing ? '已关注' : '关注'}
        </button>
      </div>
    </liquid-glass>`
    )
    .join('');
  list.querySelectorAll('.user-card').forEach((el) => {
    el.addEventListener('click', () => openUserModal(Number(el.dataset.uid)));
  });
  list.querySelectorAll('.follow-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFollow(Number(btn.dataset.uid), btn);
    });
  });
}

async function loadDiscPosts() {
  const list = $('#discPostList');
  $('#discEmpty').hidden = true;
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const data = await api('/discover/' + (discTab === 'hot' ? 'hot' : 'latest'));
    renderPostCards(list, data.posts, $('#discEmpty'));
    if (!data.posts.length) $('#discEmptySub').textContent = '还没有动态，去帖子页发第一帖吧';
  } catch (err) {
    list.innerHTML = '';
    $('#discEmpty').hidden = false;
    $('#discEmptySub').textContent = err.message;
  }
}

// 关注 / 取关（任何有关注按钮的地方通用）
async function toggleFollow(uid, btn) {
  if (!me) return openAuthModal();
  const following = btn.dataset.following === '1';
  try {
    const data = await api(`/users/${uid}/follow`, { method: following ? 'DELETE' : 'POST' });
    btn.dataset.following = data.following ? '1' : '0';
    btn.textContent = data.following ? '已关注' : '关注';
    btn.classList.toggle('ghost', data.following);
    btn.classList.toggle('primary', !data.following);
    toast(data.following ? '已关注' : '已取消关注');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========== 用户资料弹窗 ==========

async function openUserModal(uid) {
  try {
    const data = await api('/users/' + uid);
    const u = data.user;
    const box = $('#userBox');
    box.innerHTML = `
      <div class="modal-head">
        <h2>个人资料</h2>
        <button class="close-btn" data-close="userModal">✕</button>
      </div>
      <div class="user-profile">
        <div class="user-profile-top">
          ${avatarHtml(u, false)}
          <div>
            <div class="user-card-name">${escapeHtml(u.nickname)}${u.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</div>
            <div class="user-card-sub">@${escapeHtml(u.username)}</div>
          </div>
        </div>
        ${u.bio ? `<div class="user-card-bio">${escapeHtml(u.bio)}</div>` : ''}
        ${
          (u.interests || []).length
            ? `<div class="user-card-interests">${u.interests.map((i) => `<span class="interest-chip">${escapeHtml(i)}</span>`).join('')}</div>`
            : '<div class="field-hint">TA 还没有填写兴趣标签</div>'
        }
        <div class="me-stats">
          <div class="me-stat"><b>${u.postCount}</b><span>帖子</span></div>
          <div class="me-stat"><b>${u.followerCount}</b><span>粉丝</span></div>
          <div class="me-stat"><b>${u.followingCount}</b><span>关注</span></div>
        </div>
        ${
          u.isMe
            ? '<div class="field-hint" style="text-align:center">这是你自己</div>'
            : `<div class="modal-actions wrap">
                 <button class="btn ${u.isFollowing ? 'ghost' : 'primary'}" id="upFollowBtn" data-uid="${u.id}" data-following="${u.isFollowing ? 1 : 0}">${u.isFollowing ? '取消关注' : '关 注'}</button>
                 <button class="btn ghost" id="upDmBtn" data-uid="${u.id}" data-name="${escapeHtml(u.nickname)}">私 信</button>
                 <button class="btn ghost" id="upReportBtn" data-uid="${u.id}">举 报</button>
                 <button class="btn danger-ghost" id="upBlockBtn" data-uid="${u.id}" data-blocked="${u.isFollowing === null ? 0 : 0}">屏蔽</button>
               </div>`
        }
      </div>`;
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('userModal'));
    if (!u.isMe) {
      box.querySelector('#upFollowBtn').addEventListener('click', (e) => toggleFollow(u.id, e.currentTarget));
      box.querySelector('#upDmBtn').addEventListener('click', () => {
        closeModal('userModal');
        openDmModal(u.id, u.nickname);
      });
      box.querySelector('#upReportBtn').addEventListener('click', () => {
        closeModal('userModal');
        openReportModal('user', u.id, u.nickname);
      });
      // 查询当前屏蔽状态后渲染屏蔽按钮文案
      api('/me/blocked')
        .then((r) => {
          const blocked = r.users.some((x) => x.id === u.id);
          const b = box.querySelector('#upBlockBtn');
          if (b) {
            b.textContent = blocked ? '取消屏蔽' : '屏 蔽';
            b.dataset.blocked = blocked ? '1' : '0';
            b.addEventListener('click', async () => {
              try {
                await api(`/users/${u.id}/block`, { method: blocked ? 'DELETE' : 'POST' });
                toast(blocked ? '已取消屏蔽' : '已屏蔽该用户');
                closeModal('userModal');
              } catch (err) {
                toast(err.message, 'error');
              }
            });
          }
        })
        .catch(() => {});
    }
    openModal('userModal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========== 举报 ==========

function openReportModal(targetType, targetId, name = '') {
  if (!me) return openAuthModal();
  $('#reportTargetType').value = targetType;
  $('#reportTargetId').value = targetId;
  $('#reportTargetName').textContent =
    '举报对象：' + (targetType === 'post' ? `帖子「${name}」` : targetType === 'comment' ? `评论「${name.slice(0, 20)}…」` : `用户「${name}」`);
  $('#reportDetail').value = '';
  $('#reportError').hidden = true;
  $('#reportReasons').innerHTML = REPORT_REASONS.map(
    (r, i) => `
    <label class="reason-item">
      <input type="radio" name="reportReason" value="${r}" ${i === 0 ? 'checked' : ''} />
      <span>${r}</span>
    </label>`
  ).join('');
  openModal('reportModal');
}

$('#reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const reason = ($('input[name="reportReason"]:checked') || {}).value;
  try {
    await api('/reports', {
      method: 'POST',
      body: {
        targetType: $('#reportTargetType').value,
        targetId: Number($('#reportTargetId').value),
        reason,
        detail: $('#reportDetail').value.trim(),
      },
    });
    closeModal('reportModal');
    toast('举报已提交，感谢你的反馈');
  } catch (err) {
    const el = $('#reportError');
    el.textContent = err.message;
    el.hidden = false;
  }
});

// 评论举报（详情页评论列表上的按钮由 app.js 渲染时调用）
window.bindCommentReports = (box) => {
  box.querySelectorAll('.comment-report').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.comment');
      const content = item ? item.querySelector('.comment-content') : null;
      openReportModal('comment', Number(btn.dataset.id), content ? content.textContent : '');
    });
  });
};

// ========== 兴趣标签 ==========

function openInterestsModal() {
  renderTagEditor(me.interests || []);
  openModal('interestsModal');
}

function renderTagEditor(tags) {
  $('#tagEditor').innerHTML = tags.length
    ? tags
        .map(
          (t, i) => `
      <span class="interest-chip editable">${escapeHtml(t)}
        <button type="button" class="tag-del" data-i="${i}" title="移除">×</button>
      </span>`
        )
        .join('')
    : '<span class="field-hint">还没有添加，先加一个吧</span>';
  $$('#tagEditor .tag-del').forEach((b) =>
    b.addEventListener('click', () => {
      tags.splice(Number(b.dataset.i), 1);
      renderTagEditor(tags);
    })
  );
}

(() => {
  const tags = [];
  $('#tagAddBtn').addEventListener('click', () => {
    const v = $('#tagInput').value.trim();
    if (!v) return;
    if (v.length > 12) return toast('单个标签最多 12 个字', 'error');
    if (tags.length >= 8) return toast('最多 8 个兴趣标签', 'error');
    if (tags.includes(v)) return toast('已添加过这个标签', 'error');
    tags.push(v);
    $('#tagInput').value = '';
    renderTagEditor(tags);
  });
  $('#tagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#tagAddBtn').click();
    }
  });
  $('#tagSaveBtn').addEventListener('click', async () => {
    try {
      const data = await api('/me/profile', { method: 'PUT', body: { interests: tags } });
      me = { ...me, interests: data.user.interests };
      closeModal('interestsModal');
      toast('兴趣标签已保存');
      renderMeProfile();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
})();

// ========== 关注 / 粉丝 / 屏蔽 列表 ==========

async function openRelations(kind) {
  const titles = { following: '我的关注', followers: '我的粉丝', blocked: '屏蔽列表' };
  $('#relationsTitle').textContent = titles[kind];
  $('#relationsList').innerHTML = '<div class="disc-loading">加载中…</div>';
  $('#relationsEmpty').hidden = true;
  openModal('relationsModal');
  try {
    const data = await api(kind === 'blocked' ? '/me/blocked' : '/me/' + kind);
    const list = $('#relationsList');
    $('#relationsEmpty').hidden = data.users.length > 0;
    list.innerHTML = data.users
      .map(
        (u) => `
      <liquid-glass class="user-card" data-uid="${u.id}" interactive>
        <div class="user-card-inner">
          ${avatarHtml(u, false)}
          <div class="user-card-body">
            <div class="user-card-name">${escapeHtml(u.nickname)}</div>
            <div class="user-card-sub">@${escapeHtml(u.username)} · ${u.followerCount ?? 0} 粉丝</div>
          </div>
          ${
            kind === 'blocked'
              ? `<button class="btn small ghost unblock-btn" data-uid="${u.id}">取消屏蔽</button>`
              : kind === 'following'
                ? `<button class="btn small ghost" data-uid="${u.id}" data-act="unfollow">取关</button>`
                : `<button class="btn small ${u.isFollowing ? 'ghost' : 'primary'} follow-btn" data-uid="${u.id}" data-following="${u.isFollowing ? 1 : 0}">${u.isFollowing ? '已关注' : '回关'}</button>`
          }
        </div>
      </liquid-glass>`
      )
      .join('');
    list.querySelectorAll('.user-card').forEach((el) => {
      el.addEventListener('click', () => openUserModal(Number(el.dataset.uid)));
    });
    list.querySelectorAll('.follow-btn').forEach((btn) =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFollow(Number(btn.dataset.uid), btn);
        renderMeProfile();
      })
    );
    list.querySelectorAll('[data-act="unfollow"]').forEach((btn) =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api(`/users/${btn.dataset.uid}/follow`, { method: 'DELETE' });
          toast('已取消关注');
          openRelations('following');
          renderMeProfile();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
    list.querySelectorAll('.unblock-btn').forEach((btn) =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await api(`/users/${btn.dataset.uid}/block`, { method: 'DELETE' });
          toast('已取消屏蔽');
          openRelations('blocked');
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
  } catch (err) {
    $('#relationsList').innerHTML = '';
    $('#relationsEmpty').hidden = false;
  }
}

// ========== 创作者中心 ==========

async function openCreatorModal() {
  const box = $('#creatorBox');
  box.innerHTML = '<div class="disc-loading" style="padding:28px">加载中…</div>';
  openModal('creatorModal');
  try {
    const data = await api('/me/creator');
    const maxTrend = Math.max(1, ...data.trend.map((t) => Math.max(t.views, t.likes, t.comments)));
    box.innerHTML = `
      <div class="modal-head">
        <h2>创作者中心</h2>
        <button class="close-btn" data-close="creatorModal">✕</button>
      </div>
      <div class="me-stats">
        <div class="me-stat"><b>${data.totals.views}</b><span>浏览量</span></div>
        <div class="me-stat"><b>${data.totals.likes}</b><span>获赞</span></div>
        <div class="me-stat"><b>${data.totals.comments}</b><span>评论</span></div>
      </div>
      <p class="field-hint">口径：浏览量 = 非作者打开详情页次数（累计）；获赞 / 评论为当前累计值；趋势为近 7 天每天新增</p>
      <div class="trend-chart">
        ${data.trend
          .map(
            (t) => `
          <div class="trend-col" title="${t.date}：浏览 ${t.views} · 新增赞 ${t.likes} · 评论 ${t.comments}">
            <div class="trend-bars">
              <div class="trend-bar tb-view" style="height:${Math.round((t.views / maxTrend) * 100)}%"></div>
              <div class="trend-bar tb-like" style="height:${Math.round((t.likes / maxTrend) * 100)}%"></div>
              <div class="trend-bar tb-cmt" style="height:${Math.round((t.comments / maxTrend) * 100)}%"></div>
            </div>
            <span class="trend-date">${Number(t.date.slice(8))}日</span>
          </div>`
          )
          .join('')}
      </div>
      <div class="trend-legend">
        <span><i class="tb-view"></i>浏览</span><span><i class="tb-like"></i>点赞</span><span><i class="tb-cmt"></i>评论</span>
      </div>
      ${
        data.drafts.length
          ? `<div class="creator-section-title">草稿箱（${data.drafts.length}）</div>
             ${data.drafts
               .map(
                 (d) => `
               <div class="creator-item draft">
                 <div class="creator-item-main">
                   <span class="state-tag draft-tag">草稿</span>
                   <span class="creator-item-title">${escapeHtml(d.title)}</span>
                   <span class="creator-item-sub">${escapeHtml(d.boardName)} · ${timeAgo(d.createdAt)}</span>
                 </div>
                 <div class="creator-item-acts">
                   <button class="btn small primary draft-publish-btn" data-id="${d.id}">发 布</button>
                   <button class="btn small ghost draft-edit-btn" data-id="${d.id}">继续编辑</button>
                   <button class="btn small danger-ghost draft-del-btn" data-id="${d.id}">删除</button>
                 </div>
               </div>`
               )
               .join('')}`
          : ''
      }
      <div class="creator-section-title">已发布（${data.posts.length}）</div>
      ${
        data.posts.length
          ? data.posts
              .map(
                (p) => `
            <div class="creator-item">
              <div class="creator-item-main">
                <span class="creator-item-title">${escapeHtml(p.title)}</span>
                <span class="creator-item-sub">${escapeHtml(p.boardName)} · ${timeAgo(p.createdAt)}${p.visibility === 'private' ? ' · 仅自己可见' : ''}${p.hidden ? ' · 已被管理员隐藏' : ''}</span>
              </div>
              <div class="creator-item-stats">
                <span>${ICONS.chart}${p.views}</span><span>${ICONS.heartFill}${p.likes}</span><span>${ICONS.bubble}${p.comments}</span><span>${ICONS.bookmarkFill}${p.favorites}</span>
              </div>
              <div class="creator-item-acts">
                <button class="btn small ghost creator-edit-btn" data-id="${p.id}">编辑</button>
                <button class="btn small danger-ghost creator-del-btn" data-id="${p.id}">删除</button>
              </div>
            </div>`
              )
              .join('')
          : '<div class="comment-empty">还没有发布过帖子</div>'
      }`;
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('creatorModal'));
    box.querySelectorAll('.draft-edit-btn').forEach((b) =>
      b.addEventListener('click', () => {
        closeModal('creatorModal');
        openEditModal(Number(b.dataset.id));
      })
    );
    box.querySelectorAll('.creator-edit-btn').forEach((b) =>
      b.addEventListener('click', () => {
        closeModal('creatorModal');
        openEditModal(Number(b.dataset.id));
      })
    );
    box.querySelectorAll('.draft-publish-btn').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          const fd = new FormData();
          fd.append('publish', 'true');
          fd.append('title', 'temp'); // 后端要求标题非空；先取原帖内容再提交
          const cur = await api(`/posts/${b.dataset.id}`);
          fd.set('title', cur.post.title);
          fd.set('content', cur.post.content);
          fd.set('existingImages', JSON.stringify(cur.post.images || []));
          await api(`/posts/${b.dataset.id}`, { method: 'PUT', body: fd });
          toast('草稿已发布');
          openCreatorModal();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
    box.querySelectorAll('.draft-del-btn, .creator-del-btn').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这条帖子吗？')) return;
        try {
          await api(`/posts/${b.dataset.id}`, { method: 'DELETE' });
          toast('已删除');
          openCreatorModal();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
  } catch (err) {
    box.innerHTML = `<div class="comment-empty" style="padding:28px">${escapeHtml(err.message)}</div>`;
  }
}

// 草稿保存按钮：把当前表单以草稿形式提交
(() => {
  const btn = $('#saveDraftBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!$('#postTitle').value.trim()) return toast('草稿至少需要标题', 'error');
    newPostDraftMode = true;
    $('#newPostForm').requestSubmit();
  });
})();

// ========== 管理后台 ==========

let adminSeg = 'reports';

async function openAdminModal() {
  openModal('adminModal');
  renderAdminShell();
  await loadAdminSeg();
}

function renderAdminShell() {
  const box = $('#adminBox');
  box.innerHTML = `
    <div class="modal-head">
      <h2>管理后台</h2>
      <button class="close-btn" data-close="adminModal">✕</button>
    </div>
    <div class="seg" id="adminSeg">
      ${[
        ['reports', '举报处理'],
        ['users', '用户管理'],
        ['stats', '运营数据'],
        ['logs', '操作日志'],
      ]
        .map(([k, n]) => `<button class="seg-btn ${adminSeg === k ? 'active' : ''}" data-aseg="${k}">${n}</button>`)
        .join('')}
    </div>
    <div id="adminBody"><div class="disc-loading">加载中…</div></div>`;
  box.querySelector('[data-close]').addEventListener('click', () => closeModal('adminModal'));
  $$('#adminSeg .seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      adminSeg = b.dataset.aseg;
      $$('#adminSeg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
      loadAdminSeg();
    })
  );
}

async function loadAdminSeg() {
  const body = $('#adminBody');
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    if (adminSeg === 'reports') return renderAdminReports(body);
    if (adminSeg === 'users') return renderAdminUsers(body);
    if (adminSeg === 'stats') return renderAdminStats(body);
    if (adminSeg === 'logs') return renderAdminLogs(body);
  } catch (err) {
    body.innerHTML = `<div class="comment-empty">${escapeHtml(err.message)}</div>`;
  }
}

const REPORT_ACTIONS = [
  ['dismiss', '忽略'],
  ['hide_post', '隐藏动态'],
  ['delete_post', '删除动态'],
  ['delete_comment', '删除评论'],
  ['restrict_user', '限制账号'],
  ['ban_user', '封禁账号'],
];
const DANGEROUS_ACTIONS = ['delete_post', 'delete_comment', 'restrict_user', 'ban_user'];

async function renderAdminReports(body) {
  const data = await api('/admin/reports?status=pending');
  if (!data.reports.length) {
    body.innerHTML = '<div class="comment-empty" style="padding:32px">没有待处理的举报 🎉</div>';
    return;
  }
  body.innerHTML = data.reports
    .map(
      (r) => `
    <div class="admin-report" data-id="${r.id}">
      <div class="admin-report-head">
        <span class="report-type-tag">${r.targetType === 'post' ? '帖子' : r.targetType === 'comment' ? '评论' : '用户'}</span>
        <b>${escapeHtml(r.reason)}</b>
        <span class="creator-item-sub">${timeAgo(r.createdAt)}</span>
      </div>
      ${r.detail ? `<div class="admin-report-detail">说明：${escapeHtml(r.detail)}</div>` : ''}
      <div class="admin-report-target">对象：<span class="creator-item-title">${escapeHtml(r.targetPreview)}</span>${
        r.targetAuthor ? `（作者：${escapeHtml(r.targetAuthor.nickname)}）` : ''
      }　举报人：${r.reporter ? escapeHtml(r.reporter.nickname) : '已注销'}</div>
      <div class="admin-report-note"><input type="text" class="handle-note" placeholder="处理备注（记录在日志里）" /></div>
      <div class="admin-report-acts">
        ${REPORT_ACTIONS.filter(([a]) => {
          if (r.targetType === 'post') return a !== 'delete_comment';
          if (r.targetType === 'comment') return ['dismiss', 'delete_comment', 'restrict_user', 'ban_user'].includes(a);
          return ['dismiss', 'restrict_user', 'ban_user'].includes(a);
        })
          .map(
            ([a, n]) =>
              `<button class="btn small ${DANGEROUS_ACTIONS.includes(a) ? 'danger-ghost' : 'ghost'} handle-btn" data-action="${a}">${n}</button>`
          )
          .join('')}
      </div>
    </div>`
    )
    .join('');
  body.querySelectorAll('.admin-report').forEach((el) => {
    const id = Number(el.dataset.id);
    el.querySelectorAll('.handle-btn').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (DANGEROUS_ACTIONS.includes(action) && !confirm('确认执行「' + action + '」？该操作会记录到管理日志。')) return;
        try {
          const res = await api(`/admin/reports/${id}/handle`, {
            method: 'POST',
            body: { action, note: el.querySelector('.handle-note').value.trim() },
          });
          toast(res.applied || '已处理');
          loadAdminSeg();
        } catch (err) {
          toast(err.message, 'error');
        }
      })
    );
  });
}

async function renderAdminUsers(body) {
  body.innerHTML = `
    <input id="adminUserSearch" type="search" placeholder="搜索用户名 / 昵称 / 邮箱" style="width:100%;margin-bottom:12px" />
    <div id="adminUserList"><div class="disc-loading">加载中…</div></div>`;
  const load = async () => {
    const q = $('#adminUserSearch').value.trim();
    const data = await api('/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''));
    const list = $('#adminUserList');
    list.innerHTML = data.users
      .map(
        (u) => `
      <div class="admin-user-row">
        ${avatarHtml(u, false)}
        <div class="user-card-body">
          <div class="user-card-name">${escapeHtml(u.nickname)}${u.role === 'admin' ? '<span class="admin-tag">管理员</span>' : ''}</div>
          <div class="user-card-sub">@${escapeHtml(u.username)} · ${u.postCount} 帖子 · ${STATUS_LABEL[u.status] || '正常'}</div>
        </div>
        ${
          u.role === 'admin'
            ? '<span class="field-hint">管理员</span>'
            : `<select class="status-select" data-uid="${u.id}">
                 <option value="active" ${u.status === 'active' ? 'selected' : ''}>正常</option>
                 <option value="restricted" ${u.status === 'restricted' ? 'selected' : ''}>限制</option>
                 <option value="banned" ${u.status === 'banned' ? 'selected' : ''}>封禁</option>
               </select>`
        }
      </div>`
      )
      .join('');
    list.querySelectorAll('.status-select').forEach((sel) =>
      sel.addEventListener('change', async () => {
        const status = sel.value;
        if (status !== 'active' && !confirm('确认将用户状态改为「' + STATUS_LABEL[status] + '」？会同时吊销其登录会话。')) {
          return load();
        }
        try {
          await api(`/admin/users/${sel.dataset.uid}/status`, { method: 'POST', body: { status, reason: '管理后台操作' } });
          toast('已更新用户状态');
          load();
        } catch (err) {
          toast(err.message, 'error');
          load();
        }
      })
    );
  };
  $('#adminUserSearch').addEventListener('input', () => {
    clearTimeout(window.__adminSearchTimer);
    window.__adminSearchTimer = setTimeout(load, 300);
  });
  await load();
}

async function renderAdminStats(body) {
  const days = Number(window.__adminStatsDays || 7);
  const data = await api('/admin/stats?days=' + days);
  body.innerHTML = `
    <div class="stats-range">
      ${[
        [1, '今天'],
        [7, '近 7 天'],
        [30, '近 30 天'],
        [0, '全部'],
      ]
        .map(([v, n]) => `<button class="chip ${days === v ? 'active' : ''}" data-days="${v}">${n}</button>`)
        .join('')}
      ${data.pendingReports ? `<span class="state-tag hidden-tag">待处理举报 ${data.pendingReports}</span>` : '<span class="field-hint">待处理举报 0</span>'}
    </div>
    <div class="admin-stats-grid">
      <div class="stat-box"><b>${data.users.total}</b><span>用户总数${data.days ? `（新增 ${data.users.new}）` : ''}</span></div>
      <div class="stat-box"><b>${data.posts.total}</b><span>动态总数${data.days ? `（新增 ${data.posts.new}）` : ''}</span></div>
      <div class="stat-box"><b>${data.interactions.likes}</b><span>点赞（累计）</span></div>
      <div class="stat-box"><b>${data.interactions.comments}</b><span>评论（累计）</span></div>
      <div class="stat-box"><b>${data.interactions.views}</b><span>浏览量（累计）</span></div>
      <div class="stat-box"><b>${data.posts.drafts}</b><span>草稿数</span></div>
      <div class="stat-box"><b>${data.posts.hidden}</b><span>已隐藏动态</span></div>
    </div>
    <p class="field-hint">口径：总数为当前存量；「新增」为所选时间范围内创建；点赞/评论/浏览为全期累计值</p>`;
  body.querySelectorAll('.stats-range .chip').forEach((c) =>
    c.addEventListener('click', () => {
      window.__adminStatsDays = Number(c.dataset.days);
      renderAdminStats(body);
    })
  );
}

async function renderAdminLogs(body) {
  const data = await api('/admin/logs');
  body.innerHTML = data.logs.length
    ? data.logs
        .map(
          (l) => `
      <div class="admin-log-row">
        <span class="creator-item-sub">${new Date(l.at).toLocaleString('zh-CN')}</span>
        <b>${escapeHtml(l.admin ? l.admin.nickname : '已注销')}</b>
        <span>${escapeHtml(l.action)}</span>
        <span class="creator-item-sub">${l.targetType}#${l.targetId}${l.note ? ' · ' + escapeHtml(l.note) : ''}</span>
      </div>`
        )
        .join('')
    : '<div class="comment-empty" style="padding:32px">还没有管理操作记录</div>';
}

// ========== 「我的」页新入口 ==========

window.bindMeExtras = function () {
  const wrap = $('#meInterests');
  if (wrap) {
    const interests = me.interests || [];
    wrap.innerHTML =
      interests.length
        ? `<div class="user-card-interests">${interests.map((i) => `<span class="interest-chip">${escapeHtml(i)}</span>`).join('')}</div>`
        : '<div class="field-hint">还没有兴趣标签，添加后可以匹配志同道合的同学</div>';
  }
  // 工具入口卡片（去重插入）
  if ($('#meExtrasCard')) return;
  const card = document.createElement('liquid-glass');
  card.className = 'me-card';
  card.id = 'meExtrasCard';
  card.innerHTML = `
    <div class="me-tools">
      <button class="me-tool-btn" id="meInterestsBtn">${ICONS.userPlus} 兴趣标签</button>
      <button class="me-tool-btn" id="meFollowingBtn">${ICONS.users} 关注列表</button>
      <button class="me-tool-btn" id="meFollowersBtn">${ICONS.heart} 我的粉丝</button>
      <button class="me-tool-btn" id="meBlockedBtn">${ICONS.ban} 屏蔽管理</button>
      <button class="me-tool-btn" id="mePwdBtn">${ICONS.lock} 修改密码</button>
      <button class="me-tool-btn" id="meCreatorBtn">${ICONS.chart} 创作者中心</button>
      ${me.role === 'admin' ? `<button class="me-tool-btn admin" id="meAdminBtn">${ICONS.shield} 管理后台</button>` : ''}
    </div>`;
  const bgCard = document.querySelector('.bg-card');
  if (bgCard) bgCard.parentElement.insertBefore(card, bgCard);
  else $('#meProfile').after(card);
  $('#meInterestsBtn').addEventListener('click', () => openInterestsModal());
  $('#meFollowingBtn').addEventListener('click', () => openRelations('following'));
  $('#meFollowersBtn').addEventListener('click', () => openRelations('followers'));
  $('#meBlockedBtn').addEventListener('click', () => openRelations('blocked'));
  $('#meCreatorBtn').addEventListener('click', openCreatorModal);
  const adminBtn = $('#meAdminBtn');
  if (adminBtn) adminBtn.addEventListener('click', openAdminModal);
  $('#mePwdBtn').addEventListener('click', () => {
    $('#pwdForm').reset();
    $('#pwdError').hidden = true;
    openModal('pwdModal');
  });
};

// 修改密码提交
$('#pwdForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cur = $('#pwdCurrent').value;
  const n1 = $('#pwdNew').value, n2 = $('#pwdNew2').value;
  if (n1 !== n2) {
    const el = $('#pwdError');
    el.textContent = '两次输入的新密码不一致';
    el.hidden = false;
    return;
  }
  try {
    await api('/me/password', { method: 'PUT', body: { currentPassword: cur, newPassword: n1 } });
    closeModal('pwdModal');
    toast('密码已修改，其他设备已退出登录');
  } catch (err) {
    const el = $('#pwdError');
    el.textContent = err.message;
    el.hidden = false;
  }
});

// 刷新 me 的兴趣字段（登录后 /me 返回值包含 interests）
(async () => {
  if (me && !me.interests) {
    try {
      const data = await api('/me');
      if (data.user) me = data.user;
    } catch {}
  }
})();

// /api/me 返回需要包含 interests / bio / status（后端已加）；这里兜底缺省
if (me && !me.interests) me.interests = [];
