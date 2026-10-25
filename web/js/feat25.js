// DGChat 2.5 —— 校园平台前端：市场 / 活动 / 投票 / 互助 / 群聊 / 通知偏好 / 认证 / 管理扩展
// 依赖 app.js / feat21.js 的全局环境（api、$、$$、me、toast、openModal 等），最后加载

ICONS.shop = '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
ICONS.cal = '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
ICONS.check = '<svg class="ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

const MARKET_STATUS = { onsale: '在售', reserved: '已预订', sold: '已售出', off: '已下架' };
const MARKET_STATUS_CLS = { onsale: 'followed-tag', reserved: 'private-tag', sold: 'draft-tag', off: 'hidden-tag' };
const ACT_STATUS = { upcoming: '报名中', ongoing: '进行中', ended: '已结束', cancelled: '已取消' };
const HELP_STATUS = { open: '求助中', doing: '处理中', solved: '已解决' };
const MONEY = (n) => '¥' + Number(n).toFixed(Number(n) % 1 ? 2 : 0);

// ================= 广场（独立底栏标签：市场/活动/热榜） =================
let plazaTab = 'market';
function switchPlaza(tab) {
  plazaTab = tab;
  $$('#plazaBar .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.plaza === tab));
  // 双 rAF：等激活类样式与 flex 布局稳定后再定位滑块
  requestAnimationFrame(() => requestAnimationFrame(movePlazaInd));
  renderPlaza();
}
async function renderPlaza() {
  const body = $('#plazaBody');
  if (!body) return;
  requestAnimationFrame(() => movePlazaInd()); // 视图切入后校准滑块
  if (plazaTab === 'market') return renderMarketPage(body);
  if (plazaTab === 'activities') return renderActivitiesPage(body);
  if (plazaTab === 'campus') return renderCampusPage(body);
  return renderHotPage(body);
}
$$('#plazaBar .tab-btn').forEach((b) => b.addEventListener('click', () => switchPlaza(b.dataset.plaza)));
initPlazaDrag();
// 顶栏滑块：与底栏同款胶囊，跟随激活项
// ---------- 顶栏滑块拖拽（同步底栏行为：范围锁定 + 两端弹性 + 松手吸附最近子页 + 拖动吞点击） ----------
const plazaDrag = { on: false, moved: false, startX: 0, startL: 0, pid: 0 };
function initPlazaDrag() {
  const bar = document.getElementById('plazaBar');
  const ind = document.getElementById('plazaInd');
  if (!bar || !ind || bar.dataset.dragAttached) return;
  bar.dataset.dragAttached = '1';

  bar.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    plazaDrag.on = true;
    plazaDrag.moved = false;
    plazaDrag.startX = e.clientX;
    plazaDrag.startL = parseFloat(ind.style.left) || 0;
    plazaDrag.pid = e.pointerId;
    bar.style.transition = 'none';
    ind.style.transition = 'none';
  });

  bar.addEventListener('pointermove', (e) => {
    if (!plazaDrag.on || e.pointerId !== plazaDrag.pid) return;
    const dx = e.clientX - plazaDrag.startX;
    if (!plazaDrag.moved && Math.abs(dx) < 7) return; // 点击死区
    plazaDrag.moved = true;
    bar.classList.add('dragging');
    const pr = bar.getBoundingClientRect();
    const min = 6;
    const max = pr.width - ind.offsetWidth - 6;
    let left = plazaDrag.startL + dx;
    if (left < min) left = min - Math.min(8, (min - left) * 0.3); // 边缘弹性
    if (left > max) left = max + Math.min(8, (left - max) * 0.3);
    ind.style.left = left + 'px';
  }, { passive: true });

  const settle = (e) => {
    if (!plazaDrag.on || e.pointerId !== plazaDrag.pid) return;
    plazaDrag.on = false;
    bar.classList.remove('dragging');
    bar.style.transition = '';
    ind.style.transition = 'left 0.35s var(--ease-ios), width 0.35s var(--ease-ios)';
    if (!plazaDrag.moved) return; // 轻点交给按钮自身 click
    e.stopPropagation();
    e.preventDefault();
    const kill = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    bar.addEventListener('click', kill, { capture: true, once: true });
    setTimeout(() => bar.removeEventListener('click', kill, { capture: true }), 120);
    // 吸附到滑块中心最近的子页
    const r = ind.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    let best = null, bestDist = Infinity;
    bar.querySelectorAll('.tab-btn').forEach((btn) => {
      const br = btn.getBoundingClientRect();
      const d = Math.abs(br.left + br.width / 2 - cx);
      if (d < bestDist) { bestDist = d; best = btn; }
    });
    if (best && best.dataset.plaza !== plazaTab) switchPlaza(best.dataset.plaza);
    else movePlazaInd();
  };
  bar.addEventListener('pointerup', settle);
  bar.addEventListener('pointercancel', settle);
}

function movePlazaInd() {
  const bar = document.getElementById('plazaBar');
  const ind = document.getElementById('plazaInd');
  const active = bar && bar.querySelector('.tab-btn.active');
  if (!bar || !ind || !active) return;
  const pr = bar.getBoundingClientRect();
  const r = active.getBoundingClientRect();
  ind.style.left = Math.round(r.left - pr.left) + 'px';
  ind.style.width = Math.round(r.width) + 'px';
}
window.addEventListener('resize', () => setTimeout(movePlazaInd, 60));
window.addEventListener('load', () => setTimeout(movePlazaInd, 60));

// ================= 二手市场 =================
let marketFilter = { category: '', status: '', q: '' };
async function renderMarketPage(container) {
  const list = container || $('#userList');
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  const params = new URLSearchParams();
  if (marketFilter.category) params.set('category', marketFilter.category);
  if (marketFilter.status) params.set('status', marketFilter.status);
  if (marketFilter.q) params.set('q', marketFilter.q);
  try {
    const data = await api('/market?' + params.toString());
    const cats = ['', '数码', '图书', '生活', '服饰', '运动', '美妆', '票券', '其他'];
    list.innerHTML = `
      <liquid-glass class="me-card">
        <div class="market-bar">
          <input id="mktQ" type="search" placeholder="搜索商品…" value="${escapeHtml(marketFilter.q)}" />
          <select id="mktCat">${cats.map((c) => `<option value="${c}" ${marketFilter.category === c ? 'selected' : ''}>${c || '全部分类'}</option>`).join('')}</select>
          <select id="mktStatus">
            <option value="" ${!marketFilter.status ? 'selected' : ''}>在售+预订</option>
            <option value="onsale" ${marketFilter.status === 'onsale' ? 'selected' : ''}>在售</option>
            <option value="reserved" ${marketFilter.status === 'reserved' ? 'selected' : ''}>已预订</option>
          </select>
          <button class="btn primary small" id="mktNew">＋ 发布商品</button>
        </div>
      </liquid-glass>` +
      (data.items.length
        ? data.items.map(marketCardHtml).join('')
        : '<div class="empty-state"><p class="empty-title">还没有商品</p><p class="empty-sub">发布第一件闲置吧</p></div>');
    $('#mktQ').addEventListener('input', (e) => { clearTimeout(window.__mktT); window.__mktT = setTimeout(() => { marketFilter.q = e.target.value.trim(); renderMarketPage(); }, 350); });
    $('#mktCat').addEventListener('change', (e) => { marketFilter.category = e.target.value; renderMarketPage(); });
    $('#mktStatus').addEventListener('change', (e) => { marketFilter.status = e.target.value; renderMarketPage(); });
    $('#mktNew').addEventListener('click', openMarketPublish);
    bindMarketCards(list);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p class="empty-title">加载失败</p><p class="empty-sub">${escapeHtml(err.message)}</p></div>`;
  }
}
function marketCardHtml(x) {
  return `
    <liquid-glass class="duo-item market-card" data-id="${x.id}" interactive>
      <div class="market-card-inner">
        ${x.images.length ? `<img class="market-thumb" src="${escapeHtml(absUrl(x.images[0]))}" loading="lazy" />` : `<div class="market-thumb market-thumb-ph">${ICONS.shop}</div>`}
        <div class="market-body">
          <div class="market-title">${escapeHtml(x.title)}</div>
          <div class="market-price">${MONEY(x.price)}<small>${escapeHtml(x.condition)} · ${escapeHtml(x.category)}</small></div>
          <div class="market-meta">${escapeHtml(x.seller ? x.seller.nickname : '?')}${x.seller && x.seller.verified ? '<span class="vtag">✓校园</span>' : ''} · ${x.views} 浏览 · ${x.favCount} 收藏</div>
        </div>
        <span class="state-tag ${MARKET_STATUS_CLS[x.status]}">${MARKET_STATUS[x.status]}</span>
      </div>
    </liquid-glass>`;
}
function bindMarketCards(container) {
  container.querySelectorAll('.market-card').forEach((el) =>
    el.addEventListener('click', () => openMarketDetail(Number(el.dataset.id)))
  );
}
async function openMarketDetail(id) {
  try {
    const { item: x } = await api('/market/' + id);
    const box = $('#detailBox');
    box.innerHTML = `
      <div class="modal-head"><h2>商品详情</h2><button class="close-btn" data-close="detailModal">✕</button></div>
      ${x.images.length ? `<div class="detail-images grid">${x.images.map((u) => `<a href="${escapeHtml(absUrl(u))}" target="_blank" rel="noopener"><img src="${escapeHtml(absUrl(u))}" loading="lazy" /></a>`).join('')}</div>` : ''}
      <h1 class="detail-title">${escapeHtml(x.title)}</h1>
      <div class="market-price big">${MONEY(x.price)}</div>
      <div class="market-meta">${escapeHtml(x.condition)} · ${escapeHtml(x.category)}${x.place ? ' · 建议：' + escapeHtml(x.place) : ''}</div>
      <div class="detail-author">${avatarHtml(x.seller, false)}<div>
        <div class="author-name">${authorName(x.seller, false)}${x.seller && x.seller.verified ? ' <span class="vtag">✓校园认证</span>' : ''}</div>
        <div class="post-time">浏览 ${x.views} · 收藏 ${x.favCount}</div>
      </div></div>
      <div class="detail-content">${escapeHtml(x.desc)}</div>
      <div class="detail-actions">
        <button class="foot-btn" id="mktFav">${x.favByMe ? '★' : '☆'} 收藏</button>
        ${!x.isMine && x.status === 'onsale' ? '<button class="foot-btn" id="mktContact">联系卖家</button>' : ''}
        ${!x.isMine && x.status === 'sold' && x.dealBuyerId === me.id && !x.myRating ? '<button class="foot-btn" id="mktRate">评价交易</button>' : ''}
        ${x.isMine ? `<select id="mktStatusSel">
          <option value="">改状态…</option>
          <option value="onsale">在售</option><option value="reserved">已预订</option><option value="sold">已售出</option><option value="off">下架</option>
        </select>
        <button class="foot-btn" id="mktDel">删除</button>` : ''}
      </div>
      <div id="mktRatings"></div>`;
    openModal('detailModal');
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('detailModal'));
    $('#mktFav').addEventListener('click', async () => {
      const r = await api(`/market/${id}/fav`, { method: 'POST' });
      $('#mktFav').textContent = (r.favByMe ? '★' : '☆') + ' 收藏';
      toast(r.favByMe ? '已收藏' : '已取消收藏');
    });
    const contact = $('#mktContact');
    if (contact) contact.addEventListener('click', async () => {
      // 联系卖家 = 发起含商品标记的私信（服务端交易确认依赖此标记）
      try {
        await api('/messages', { method: 'POST', body: { toUserId: x.seller.id, content: `你好，我对「${x.title}」（商品#${x.id}）感兴趣，请问还在出售吗？` } });
        closeModal('detailModal');
        toast('已私信卖家，请等待回复');
        updateUnreadBadge();
      } catch (err) { toast(err.message, 'error'); }
    });
    const rate = $('#mktRate');
    if (rate) rate.addEventListener('click', () => {
      const stars = Number(prompt('评价 1-5 星（输入数字）') || 0);
      if (!(stars >= 1 && stars <= 5)) return toast('请输入 1-5', 'error');
      const comment = prompt('评价内容（选填）') || '';
      api(`/market/${id}/rating`, { method: 'POST', body: { stars, comment } })
        .then(() => { toast('评价成功'); closeModal('detailModal'); })
        .catch((e) => toast(e.message, 'error'));
    });
    const sel = $('#mktStatusSel');
    if (sel) sel.addEventListener('change', async () => {
      if (!sel.value) return;
      if (sel.value === 'sold') {
        const buyers = await api('/conversations');
        const cand = buyers.conversations.filter((c) => c.lastMessage.content.includes('商品#' + id));
        if (!cand.length) return toast('还没有买家通过本商品私信联系过你', 'error');
        const buyerId = cand[0].user.id;
        if (!confirm(`确认已售予 ${cand[0].user.nickname}？`)) { sel.value = ''; return; }
        try { await api(`/market/${id}/deal`, { method: 'POST', body: { buyerId } }); toast('交易已确认'); openMarketDetail(id); }
        catch (e) { toast(e.message, 'error'); sel.value = ''; }
        return;
      }
      try { await api(`/market/${id}`, { method: 'PUT', body: { status: sel.value } }); toast('状态已更新'); openMarketDetail(id); }
      catch (e) { toast(e.message, 'error'); sel.value = ''; }
    });
    const del = $('#mktDel');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('删除该商品？')) return;
      await api(`/market/${id}`, { method: 'DELETE' });
      closeModal('detailModal'); toast('已删除'); renderPlaza();
    });
    // 评价列表
    const { ratings } = await api(`/market/${id}/ratings`);
    $('#mktRatings').innerHTML = ratings.length
      ? '<div class="comments-title">交易评价</div>' + ratings.map((r) => `<div class="comment"><div class="comment-body"><div class="comment-head"><span class="comment-author">★${r.stars}</span><span class="comment-time">${timeAgo(r.at)}</span></div><div class="comment-content">${escapeHtml(r.comment || '')}</div></div></div>`).join('')
      : '';
  } catch (err) { toast(err.message, 'error'); }
}
function openMarketPublish() {
  if (!me) return openAuthModal();
  $('#marketPublishForm').reset();
  openModal('marketPublishModal');
}
$('#marketPublishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('title', $('#mktTitle').value.trim());
  fd.append('desc', $('#mktDesc').value.trim());
  fd.append('price', $('#mktPrice').value);
  fd.append('condition', $('#mktCondition').value);
  fd.append('category', $('#mktCategory').value);
  fd.append('place', $('#mktPlace').value.trim());
  [...$('#mktImgs').files].slice(0, 6).forEach((f) => fd.append('images', f));
  try {
    await api('/market', { method: 'POST', body: fd });
    closeModal('marketPublishModal');
    toast('商品已发布');
    renderPlaza();
  } catch (err) { toast(err.message, 'error'); }
});

// ================= 活动组队 =================
let actFilter = { category: '', status: '' };
async function renderActivitiesPage(container) {
  const list = container || $('#userList');
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  const params = new URLSearchParams();
  if (actFilter.category) params.set('category', actFilter.category);
  if (actFilter.status) params.set('status', actFilter.status);
  try {
    const data = await api('/activities?' + params.toString());
    const cats = ['', '自习搭子', '课程学习', '运动约伴', '游戏组队', '社团活动', '其他'];
    list.innerHTML = `
      <liquid-glass class="me-card">
        <div class="market-bar">
          <select id="actCat">${cats.map((c) => `<option value="${c}" ${actFilter.category === c ? 'selected' : ''}>${c || '全部分类'}</option>`).join('')}</select>
          <select id="actStatus">${['', 'upcoming', 'ongoing', 'ended'].map((s) => `<option value="${s}" ${actFilter.status === s ? 'selected' : ''}>${s ? ACT_STATUS[s] : '全部状态'}</option>`).join('')}</select>
          <button class="btn primary small" id="actNew">＋ 发起活动</button>
        </div>
      </liquid-glass>` +
      (data.items.length ? data.items.map(actCardHtml).join('') : '<div class="empty-state"><p class="empty-title">还没有活动</p><p class="empty-sub">发起第一场组队吧</p></div>');
    $('#actCat').addEventListener('change', (e) => { actFilter.category = e.target.value; renderActivitiesPage(); });
    $('#actStatus').addEventListener('change', (e) => { actFilter.status = e.target.value; renderActivitiesPage(); });
    $('#actNew').addEventListener('click', () => { if (me) { $('#activityForm').reset(); openModal('activityModal'); } else openAuthModal(); });
    list.querySelectorAll('.act-card').forEach((el) => el.addEventListener('click', () => openActivityDetail(Number(el.dataset.id))));
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p class="empty-title">加载失败</p><p class="empty-sub">${escapeHtml(err.message)}</p></div>`;
  }
}
function actCardHtml(a) {
  return `
    <liquid-glass class="duo-item act-card" data-id="${a.id}" interactive>
      <div class="market-card-inner">
        <div class="market-thumb market-thumb-ph act-icon">${ICONS.cal}</div>
        <div class="market-body">
          <div class="market-title">${escapeHtml(a.title)}</div>
          <div class="market-meta">${escapeHtml(a.category)} · ${new Date(a.startAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${a.place ? escapeHtml(a.place) : '线上'}</div>
          <div class="market-meta">发起人 ${escapeHtml(a.owner ? a.owner.nickname : '?')} · ${a.joinedCount}/${a.capacity} 人${a.waitlistCount ? `（候补${a.waitlistCount}）` : ''}</div>
        </div>
        <span class="state-tag ${a.status === 'upcoming' ? 'followed-tag' : a.status === 'cancelled' ? 'hidden-tag' : 'draft-tag'}">${ACT_STATUS[a.status]}</span>
      </div>
    </liquid-glass>`;
}
async function openActivityDetail(id) {
  try {
    const { activity: a } = await api('/activities/' + id);
    const box = $('#detailBox');
    const joined = a.joinedCount < a.capacity;
    box.innerHTML = `
      <div class="modal-head"><h2>活动详情</h2><button class="close-btn" data-close="detailModal">✕</button></div>
      <span class="detail-board-tag">${escapeHtml(a.category)}</span>
      <h1 class="detail-title">${escapeHtml(a.title)}</h1>
      <div class="market-meta">开始 ${new Date(a.startAt).toLocaleString('zh-CN')} · 结束 ${new Date(a.endAt).toLocaleString('zh-CN')}<br>报名截止 ${new Date(a.joinDeadline).toLocaleString('zh-CN')} · ${a.place ? '地点：' + escapeHtml(a.place) : '线上'}</div>
      <div class="detail-author">${avatarHtml(a.owner, false)}<div><div class="author-name">${authorName(a.owner, false)}</div><div class="post-time">${a.joinedCount}/${a.capacity} 已报名${a.waitlistCount ? ` · 候补 ${a.waitlistCount}` : ''}</div></div></div>
      <div class="detail-content">${escapeHtml(a.desc)}</div>
      <div class="detail-actions">
        ${a.myJoin ? `<button class="foot-btn" id="actLeave">取消报名</button><span class="state-tag ${a.myJoin === 'joined' ? 'followed-tag' : 'private-tag'}">${a.myJoin === 'joined' ? '已报名' : '候补中'}</span>` : (a.status === 'upcoming' ? `<button class="foot-btn" id="actJoin">${joined ? '立即报名' : '加入候补'}</button>` : '')}
        ${a.canEdit && a.status === 'upcoming' ? '<button class="foot-btn" id="actCancel">取消活动</button>' : ''}
      </div>
      ${a.participants ? `<div class="comments-title">参与者（${a.participants.length}）</div><div class="comment-list">${a.participants.map((p) => `<div class="comment">${avatarHtml(p, false)}<div class="comment-body"><span class="comment-author">${escapeHtml(p.nickname)}</span></div></div>`).join('')}</div>` : ''}`;
    openModal('detailModal');
    box.querySelector('[data-close]').addEventListener('click', () => closeModal('detailModal'));
    const join = $('#actJoin');
    if (join) join.addEventListener('click', async () => {
      try {
        const r = await api(`/activities/${id}/join`, { method: 'POST' });
        toast(r.status === 'joined' ? '报名成功' : '已加入候补名单');
        openActivityDetail(id);
      } catch (e) { toast(e.message, 'error'); }
    });
    const leave = $('#actLeave');
    if (leave) leave.addEventListener('click', async () => {
      if (!confirm('取消报名？')) return;
      try { await api(`/activities/${id}/leave`, { method: 'POST' }); toast('已取消'); openActivityDetail(id); }
      catch (e) { toast(e.message, 'error'); }
    });
    const cancel = $('#actCancel');
    if (cancel) cancel.addEventListener('click', async () => {
      if (!confirm('取消活动将通知全部报名者，确认？')) return;
      try { await api(`/activities/${id}`, { method: 'PUT', body: { status: 'cancelled' } }); toast('活动已取消'); openActivityDetail(id); }
      catch (e) { toast(e.message, 'error'); }
    });
  } catch (err) { toast(err.message, 'error'); }
}
$('#activityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/activities', {
      method: 'POST',
      body: {
        title: $('#actTitle').value.trim(),
        desc: $('#actDesc').value.trim(),
        category: $('#actCategory').value,
        place: $('#actPlace').value.trim(),
        startAt: new Date($('#actStart').value).getTime(),
        endAt: new Date($('#actEnd').value).getTime(),
        capacity: Number($('#actCapacity').value) || 20,
      },
    });
    closeModal('activityModal');
    toast('活动已发布');
    plazaTab = 'activities'; renderPlaza();
  } catch (err) { toast(err.message, 'error'); }
});

// ================= 热榜 =================
async function renderHotPage(container) {
  const list = container || $('#userList');
  list.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const d = await api('/hot');
    list.innerHTML = `
      ${d.boards.map((b) => `
        <liquid-glass class="me-card"><div class="bg-title" style="padding:0">${escapeHtml(b.name)}</div>
          ${b.posts.length ? b.posts.map((p, i) => `<div class="hot-row"><span class="hot-rank r${i + 1}">${i + 1}</span><span class="hot-title" data-post="${p.id}">${escapeHtml(p.title)}</span><span class="hot-score">${p.score}</span></div>`).join('') : '<div class="field-hint">暂无热门内容</div>'}
        </liquid-glass>`).join('')}
      <liquid-glass class="me-card"><div class="bg-title" style="padding:0">热门商品</div>
        ${d.market.length ? d.market.map((x, i) => `<div class="hot-row"><span class="hot-rank r${i + 1}">${i + 1}</span><span class="hot-title" data-mkt="${x.id}">${escapeHtml(x.title)}</span><span class="hot-score">${x.score}</span></div>`).join('') : '<div class="field-hint">暂无</div>'}
      </liquid-glass>
      <liquid-glass class="me-card"><div class="bg-title" style="padding:0">热门活动</div>
        ${d.activities.length ? d.activities.map((x, i) => `<div class="hot-row"><span class="hot-rank r${i + 1}">${i + 1}</span><span class="hot-title" data-act="${x.id}">${escapeHtml(x.title)}</span><span class="hot-score">${x.score}人</span></div>`).join('') : '<div class="field-hint">暂无</div>'}
      </liquid-glass>
      <p class="field-hint">热度 = 互动加权 × 时间衰减（48h），刷量收益被压缩 · 生成于 ${new Date(d.generatedAt).toLocaleTimeString('zh-CN')}</p>`;
    list.querySelectorAll('[data-post]').forEach((el) => el.addEventListener('click', () => openDetail(Number(el.dataset.post))));
    list.querySelectorAll('[data-mkt]').forEach((el) => el.addEventListener('click', () => openMarketDetail(Number(el.dataset.mkt))));
    list.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', () => openActivityDetail(Number(el.dataset.act))));
      $('#discUsersWrap').hidden = false;
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p class="empty-title">加载失败</p><p class="empty-sub">${escapeHtml(err.message)}</p></div>`;
  }
}

// 隐私与互动弹窗 → 通知偏好（2.5.1 迁入）
$('#privacyNotifBtn')?.addEventListener('click', openNotifPrefs);

// ================= 校园栏目（认证/学校信息） =================
async function renderCampusPage(container) {
  const body = container || $('#plazaBody');
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    const [{ site }, meData] = await Promise.all([api('/site'), me ? api('/me') : Promise.resolve({ user: null })]);
    if (meData.user) me = meData.user;
    const verified = !!(me && me.verified);
    const policyText = { open: '开放注册', emailDomain: '校园邮箱认证', invite: '邀请码注册', manual: '人工审核注册' }[site.regPolicy] || site.regPolicy;
    body.innerHTML = `
      <liquid-glass class="me-card campus-card">
        <div class="campus-head">
          <div class="campus-logo"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/></svg></div>
          <div class="campus-info">
            <div class="campus-name">${escapeHtml(site.school || '我的校园')}</div>
            <div class="market-meta">${escapeHtml(site.name)} · ${policyText}</div>
          </div>
        </div>
        <div class="campus-verify ${verified ? 'ok' : ''}">
          ${verified
            ? `<div class="campus-ok">✓ 已完成校园认证<small>认证身份仅显示为已验证标识，其他人看不到你的邮箱</small></div>`
            : `<div class="campus-pending">未认证${site.emailDomain ? ` · 使用 @${escapeHtml(site.emailDomain)} 邮箱可自动通过` : ''}</div>
               ${me ? '<button class="btn primary" id="campusVerifyBtn">立即认证</button>' : '<button class="btn primary" id="campusLoginBtn">登录后认证</button>'}`}
        </div>
        <div class="duo-me-stats" style="margin-top:10px">
          <span><b>${Number(site.verifiedCount)}</b>已认证同学</span>
        </div>
      </liquid-glass>
      ${!verified && me && site.regPolicy === 'invite' ? '<p class="field-hint">当前注册策略为邀请码制，新同学需邀请码；认证状态与注册策略独立。</p>' : ''}
      <p class="field-hint">校园认证用于展示可信身份标识；匿名发帖与认证状态互不影响。</p>`;
    const vBtn = document.getElementById('campusVerifyBtn');
    if (vBtn) vBtn.addEventListener('click', openVerifyModal);
    const lBtn = document.getElementById('campusLoginBtn');
    if (lBtn) lBtn.addEventListener('click', openAuthModal);
    // 认证成功后刷新本页
    window.__refreshCampus = () => renderCampusPage(body);
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p class="empty-title">加载失败</p><p class="empty-sub">${escapeHtml(err.message)}</p></div>`;
  }
}
const __openVerifyModal = openVerifyModal;

// ================= 发帖扩展：投票 / 互助 =================
(function extendComposer() {
  const form = $('#newPostForm');
  const vis = document.getElementById('postVisibility')?.closest('.field');
  if (vis) {
    vis.insertAdjacentHTML('afterend', `
      <label class="field"><span class="field-label">帖子类型</span>
        <select id="postKind"><option value="post">普通帖子</option><option value="help">校园互助（求助）</option></select>
      </label>
      <div class="field" id="pollBuilder">
        <span class="field-label">投票（选填）</span>
        <textarea id="pollOptions" rows="2" placeholder="每行一个选项（2-10 个）"></textarea>
        <div class="tag-add-row" style="margin-top:8px">
          <select id="pollHours" class="poll-mini"><option value="24">24 小时截止</option><option value="48">48 小时</option><option value="72">72 小时</option><option value="168">一周</option></select>
          <label class="check-line"><input type="checkbox" id="pollMulti" /><span>多选</span></label>
          <label class="check-line"><input type="checkbox" id="pollAnon" checked /><span>匿名投票</span></label>
        </div>
      </div>`);
  }
  form.addEventListener('submit', () => {
    // 由既有提交处理器读取以下隐藏字段（在 submit 捕获阶段注入 FormData）
    const opts = $('#pollOptions').value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (opts.length >= 2) {
      form.dataset.poll = '1';
      form.__poll = {
        options: JSON.stringify(opts),
        hours: $('#pollHours').value,
        multi: $('#pollMulti').checked,
        anon: $('#pollAnon').checked,
      };
    } else { form.dataset.poll = ''; form.__poll = null; }
  }, true);
})();
// 挂进提交 FormData（拦截原 submit 前注入）
const _newPostSubmit = $('#newPostForm').onsubmit;
$('#newPostForm').addEventListener('submit', (e) => {
  if (e.defaultPrevented) return;
  const f = $('#newPostForm');
  if (f.dataset.poll === '1' && f.__poll) {
    // 原处理器使用局部 FormData，这里改为全局暂存 + 由捕获阶段后重写不可行；
    // 简化：把投票参数放进表单隐藏 input（每次提交前更新）
  }
}, false);
// 更可靠：提交前刷新隐藏域
(function pollHiddenFields() {
  const form = $('#newPostForm');
  ['pollOptions', 'pollDeadlineHours', 'pollMulti', 'pollAnonymous', 'kind'].forEach((n) => {
    const inp = document.createElement('input');
    inp.type = 'hidden'; inp.id = 'hf_' + n;
    form.appendChild(inp);
  });
  form.addEventListener('submit', () => {
    const opts = ($('#pollOptions').value || '').split('\n').map((x) => x.trim()).filter(Boolean);
    $('#hf_pollOptions').value = opts.length >= 2 ? JSON.stringify(opts) : '';
    $('#hf_pollDeadlineHours').value = $('#pollHours') ? $('#pollHours').value : '24';
    $('#hf_pollMulti').value = $('#pollMulti') && $('#pollMulti').checked;
    $('#hf_pollAnonymous').value = $('#pollAnon') ? $('#pollAnon').checked : true;
    $('#hf_kind').value = $('#postKind') ? $('#postKind').value : 'post';
  }, true);
})();
// 提交体附加投票字段（包装 api 调用点最稳妥：直接在 submit 监听里 append——
// 但原处理器自建 FormData；改为全局 patch：监听捕获阶段后，在原 submit 前把字段写入 form 的 __extra，由下方包装 fetch 注入）
const __origFetch = window.fetch;
window.fetch = function (input, init) {
  if (init && init.method === 'POST' && String(input).includes('/api/posts') && init.body instanceof FormData) {
    const form = $('#newPostForm');
    const opts = ($('#pollOptions') ? $('#pollOptions').value : '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (form.__composeMode !== 'edit' && opts.length >= 2 && !init.body.has('pollOptions')) {
      init.body.append('pollOptions', JSON.stringify(opts));
      init.body.append('pollDeadlineHours', $('#pollHours') ? $('#pollHours').value : '24');
      init.body.append('pollMulti', $('#pollMulti') && $('#pollMulti').checked);
      init.body.append('pollAnonymous', !($('#pollAnon') && $('#pollAnon').checked === false));
    }
    if ($('#postKind') && !init.body.has('kind')) init.body.append('kind', $('#postKind').value);
    else if (!init.body.has('kind')) init.body.append('kind', 'post');
  }
  return __origFetch.apply(this, arguments);
};
// 编辑模式标记
const __origOpenEdit = window.openEditModal;
window.openEditModal = function (id) { $('#newPostForm').__composeMode = 'edit'; return __origOpenEdit(id); };

// ================= 详情页：投票 / 互助状态 =================
const __renderDetail = window.renderDetail;
window.renderDetail = function (p, comments) {
  __renderDetail(p, comments);
  const box = $('#detailBox');
  // 互助状态条
  if (p.kind === 'help') {
    box.querySelector('.detail-board-tag').insertAdjacentHTML('afterend',
      `<span class="state-tag ${p.helpStatus === 'solved' ? 'followed-tag' : 'draft-tag'} help-tag" data-post="${p.id}" data-st="${p.helpStatus}">${HELP_STATUS[p.helpStatus] || '求助中'}${p.isMine && p.helpStatus !== 'solved' ? ' ⇄' : ''}</span>`);
    const tag = box.querySelector('.help-tag');
    if (p.isMine && p.helpStatus !== 'solved') {
      tag.style.cursor = 'pointer';
      tag.addEventListener('click', async () => {
        const next = p.helpStatus === 'open' ? 'doing' : 'solved';
        try { await api(`/posts/${p.id}/help-status`, { method: 'POST', body: { status: next } }); toast('已更新为' + HELP_STATUS[next]); openDetail(p.id); }
        catch (e) { toast(e.message, 'error'); }
      });
    }
  }
  // 投票区
  if (p.poll && p.poll.options.length) {
    const div = document.createElement('div');
    div.className = 'poll-box';
    div.innerHTML = '<div class="comments-title">投票' + (p.poll.multi ? '（多选）' : '') + ` · 截止 ${new Date(p.poll.deadline).toLocaleString('zh-CN')}</div><div class="poll-options" id="pollOpts"></div><button class="btn primary small" id="pollVote">投票</button><div id="pollResults"></div>`;
    box.querySelector('.detail-actions').after(div);
    let selected = new Set();
    const closed = p.poll.closed;
    p.poll.options.forEach((opt, i) => {
      const row = document.createElement('label');
      row.className = 'reason-item poll-opt';
      row.innerHTML = `<input type="${p.poll.multi ? 'checkbox' : 'radio'}" name="pollOpt" value="${i}" ${closed || p.poll.myVoted ? 'disabled' : ''} /><span>${escapeHtml(opt)}</span>`;
      row.querySelector('input').addEventListener('change', () => {
        if (p.poll.multi) { selected.has(i) ? selected.delete(i) : selected.add(i); }
        else selected = new Set([i]);
      });
      $('#pollOpts').appendChild(row);
    });
    $('#pollVote').hidden = closed || p.poll.myVoted;
    $('#pollVote').addEventListener('click', async () => {
      if (!selected.size) return toast('请先选择选项', 'error');
      try {
        await api(`/posts/${p.id}/poll/vote`, { method: 'POST', body: { options: [...selected] } });
        toast('投票成功');
        openDetail(p.id);
      } catch (e) { toast(e.message, 'error'); }
    });
    // 结果（投过或已截止才显示计数；匿名投票仅计数）
    if (p.poll.myVoted || closed) {
      api(`/posts/${p.id}/poll/results`).then(({ options, counts, total }) => {
        $('#pollResults').innerHTML = options.map((o, i) => `
          <div class="poll-result-row">
            <span class="poll-label">${escapeHtml(o)}</span>
            <div class="poll-bar"><i style="width:${total ? Math.round(counts[i] / total * 100) : 0}%"></i></div>
            <span class="poll-count">${counts[i]} 票</span>
          </div>`).join('') + `<p class="field-hint">共 ${total} 人投票</p>`;
        $('#pollVote').hidden = true;
      }).catch(() => {});
    }
  }
  // 认证标识渲染补强（authorName 已有 vtag 场景在市场页处理）
};

// ================= 群聊（私信页内） =================
async function renderGroupsSection() {
  const wrap = $('#convList');
  const { groups } = await api('/me/groups');
  if (!groups.length) return;
  const html = groups.map((g) => `
    <liquid-glass class="conv-item group-item" data-gid="${g.id}" interactive>
      <div class="conv-inner">
        <div class="avatar" style="background:var(--accent)">${(g.name || '群').slice(0, 1)}</div>
        <div class="conv-body">
          <div class="conv-top"><span class="conv-name">${escapeHtml(g.name)}<span class="group-tag">群</span></span>
          <span class="conv-time">${g.lastMessage ? timeAgo(g.lastMessage.createdAt) : ''}</span></div>
          <div class="conv-preview">${g.announcement ? escapeHtml(g.announcement.slice(0, 30)) : escapeHtml((g.lastMessage || {}).content || '群聊')}</div>
        </div>
      </div>
    </liquid-glass>`).join('');
  const hdr = document.createElement('div');
  hdr.className = 'group-header-row';
  hdr.innerHTML = `<span>我的群聊</span><button class="btn small ghost" id="createGroupBtn">＋ 建群</button>`;
  wrap.prepend(hdr, ...[]);
  wrap.insertAdjacentHTML('afterbegin', html);
  $('#createGroupBtn').addEventListener('click', async () => {
    const name = prompt('群名称（1-20 字）');
    if (!name) return;
    try { await api('/groups', { method: 'POST', body: { name } }); toast('群已创建'); loadConversations(); }
    catch (e) { toast(e.message, 'error'); }
  });
  wrap.querySelectorAll('.group-item').forEach((el) => el.addEventListener('click', () => openGroupThread(Number(el.dataset.gid))));
}
const __loadConversations = window.loadConversations;
window.loadConversations = async function () {
  await __loadConversations();
  try { await renderGroupsSection(); } catch {}
};
let currentGroup = null;
async function openGroupThread(gid) {
  try {
    const [{ group: g, members }, { messages }] = await Promise.all([api('/groups/' + gid), api(`/groups/${gid}/messages`)]);
    currentGroup = g;
    closeThread(false);
    $('#convList').hidden = true;
    $('#threadView').hidden = false;
    $('#threadName').innerHTML = `${escapeHtml(g.name)} <span class="group-tag">群·${g.memberCount}人</span>`;
    $('#msgList').innerHTML = messages.length ? messages.map((m) => `
      <div class="msg-row ${m.fromMe ? 'mine' : 'theirs'}">
        ${!m.fromMe ? `<div class="msg-author-tag">${escapeHtml(m.from ? m.from.nickname : '?')}</div>` : ''}
        <div class="msg-bubble ${m.recalled ? 'recalled' : ''}">${m.recalled ? '<i>已撤回</i>' : escapeHtml(m.content)}</div>
        <div class="msg-time">${timeAgo(m.createdAt)}</div>
      </div>`).join('') : '<div class="comment-empty">群里还没有消息</div>';
    $('#msgList').scrollTop = 1e9;
    // 群管理面板
    $('#threadName').insertAdjacentHTML('afterend', `<button class="icon-btn" id="groupMgr" title="群管理">⚙</button>`);
    $('#groupMgr').addEventListener('click', () => openGroupManager(g, members));
    // 发送走群接口
    $('#msgSend').onclick = async () => {
      const input = $('#msgInput');
      const content = input.value.trim();
      if (!content) return;
      try {
        await api(`/groups/${gid}/messages`, { method: 'POST', body: { content, clientId: Date.now() + '-' + Math.random().toString(36).slice(2, 8) } });
        input.value = '';
        openGroupThread(gid);
      } catch (e) { toast(e.message, 'error'); }
    };
  } catch (e) { toast(e.message, 'error'); }
}
function openGroupManager(g, members) {
  const box = $('#detailBox');
  box.innerHTML = `
    <div class="modal-head"><h2>群管理 · ${escapeHtml(g.name)}</h2><button class="close-btn" data-close="detailModal">✕</button></div>
    ${g.announcement ? `<div class="field-hint">公告：${escapeHtml(g.announcement)}</div>` : ''}
    <div class="comments-title">成员（${members.length}）</div>
    ${members.map((m) => `
      <div class="comment">${avatarHtml(m, false)}
        <div class="comment-body"><span class="comment-author">${escapeHtml(m.nickname)}${m.groupRole === 'owner' ? ' <span class="admin-tag">群主</span>' : ''}</span></div>
        ${g.myRole === 'owner' && m.id !== me.id ? `<button class="comment-del" data-kick="${m.id}">移出</button>` : ''}
      </div>`).join('')}
    ${g.myRole === 'owner' ? `
      <div class="tag-add-row" style="margin-top:12px">
        <input id="inviteName" placeholder="邀请用户名" />
        <button class="btn primary small" id="inviteBtn">邀请</button>
        <button class="btn small" id="annoBtn">改公告</button>
      </div>` : ''}
    <div class="modal-actions"><button class="btn ghost" data-close="detailModal">关闭</button>${g.myRole !== 'owner' ? '<button class="btn danger-ghost" id="leaveGroup">退出群聊</button>' : ''}</div>`;
  openModal('detailModal');
  box.querySelector('[data-close]').addEventListener('click', () => closeModal('detailModal'));
  box.querySelectorAll('[data-kick]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('移出该成员？')) return;
    try { await api(`/groups/${g.id}/kick`, { method: 'POST', body: { userId: Number(b.dataset.kick) } }); toast('已移出'); openGroupThread(g.id); }
    catch (e) { toast(e.message, 'error'); }
  }));
  const inv = $('#inviteBtn');
  if (inv) inv.addEventListener('click', async () => {
    const uname = $('#inviteName').value.trim();
    const target = (await api('/search?type=users&q=' + encodeURIComponent(uname))).items.find((u) => u.username === uname);
    if (!target) return toast('未找到该用户', 'error');
    try { await api(`/groups/${g.id}/invite`, { method: 'POST', body: { userId: target.id } }); toast('已邀请'); openGroupThread(g.id); }
    catch (e) { toast(e.message, 'error'); }
  });
  const anno = $('#annoBtn');
  if (anno) anno.addEventListener('click', async () => {
    const t = prompt('群公告（≤200 字）', g.announcement || '');
    if (t === null) return;
    try { await api(`/groups/${g.id}/announcement`, { method: 'PUT', body: { announcement: t } }); toast('公告已更新'); openGroupThread(g.id); }
    catch (e) { toast(e.message, 'error'); }
  });
  const lv = $('#leaveGroup');
  if (lv) lv.addEventListener('click', async () => {
    if (!confirm('退出群聊？')) return;
    try { await api(`/groups/${g.id}/leave`, { method: 'POST' }); closeModal('detailModal'); toast('已退出'); loadConversations(); }
    catch (e) { toast(e.message, 'error'); }
  });
}

// ================= 通知偏好 + 校园认证（我的页工具补位） =================
const __bindMeExtras21 = window.bindMeExtras;
window.bindMeExtras = function () {
  __bindMeExtras21();
  const row2 = document.getElementById('meExtrasRow2');
  if (!row2 || document.getElementById('meVerifyBtn')) return;
  // 2.5.1：校园认证迁至广场「校园」栏目；通知偏好迁入「隐私与互动」弹窗
};
async function openVerifyModal() {
  if (me.verified) return toast('你已完成校园认证 ✓');
  const email = prompt('输入校园邮箱完成认证（域名匹配自动通过，否则转人工审核）');
  if (!email) return;
  try {
    const r = await api('/me/verify', { method: 'POST', body: { email } });
    if (r.verified) { me.verified = true; toast('校园认证通过 ✓'); renderMeProfile(); }
    else toast('已提交，等待管理员人工审核');
  } catch (e) { toast(e.message, 'error'); }
}
async function openNotifPrefs() {
  const p = me.notifPrefs || { off: [], dndStart: null, dndEnd: null };
  const types = [['like', '点赞'], ['comment', '评论'], ['follow', '关注'], ['mention', '提及'], ['dm', '私信'], ['system', '系统']];
  const off = new Set(p.off || []);
  const picked = await new Promise((resolve) => {
    // 简易偏好面板（用 prompt 组合太粗糙，这里做轻量弹层）
    const div = document.createElement('div');
    div.className = 'modal-mask';
    div.id = 'notifPrefMask';
    div.innerHTML = `<liquid-glass class="modal narrow">
      <div class="modal-head"><h2>通知偏好</h2><button class="close-btn" id="npClose">✕</button></div>
      <div class="field"><span class="field-label">关闭以下类型通知</span>
        <div class="reason-list">${types.map(([t, n]) => `<label class="reason-item"><input type="checkbox" data-t="${t}" ${off.has(t) ? 'checked' : ''} /><span>${n}</span></label>`).join('')}</div>
      </div>
      <div class="tag-add-row">
        <input id="npStart" type="time" value="${p.dndStart || ''}" /><span>至</span><input id="npEnd" type="time" value="${p.dndEnd || ''}" /><span>免打扰</span>
      </div>
      <p class="field-hint">免打扰期间不产生新通知（系统关键通知除外）；多设备同步</p>
      <div class="modal-actions"><button class="btn ghost" id="npCancel">取消</button><button class="btn primary" id="npSave">保存</button></div>
    </liquid-glass>`;
    document.body.appendChild(div);
    const close = () => div.remove();
    $('#npClose').onclick = () => { close(); resolve(null); };
    $('#npCancel').onclick = () => { close(); resolve(null); };
    div.addEventListener('click', (e) => { if (e.target === div) { close(); resolve(null); } });
    $('#npSave').onclick = () => {
      const offList = [...div.querySelectorAll('[data-t]:checked')].map((x) => x.dataset.t);
      resolve({ off: offList, dndStart: $('#npStart').value || null, dndEnd: $('#npEnd').value || null });
      close();
    };
  });
  if (!picked) return;
  try {
    await api('/me/notif-prefs', { method: 'PUT', body: picked });
    me.notifPrefs = picked;
    toast('通知偏好已保存');
  } catch (e) { toast(e.message, 'error'); }
}

// ================= 管理后台扩展（feat21 的 openAdmin 之后注入新页签） =================
const __openAdminModal = window.openAdminModal;
window.openAdminModal = async function () {
  await __openAdminModal();
  const seg = document.getElementById('adminSeg');
  if (!seg || document.getElementById('asegSite')) return;
  seg.insertAdjacentHTML('beforeend', `
    <button class="seg-btn" id="asegSite" data-aseg25="site">站点设置</button>
    <button class="seg-btn" data-aseg25="verify">认证审核</button>
    <button class="seg-btn" data-aseg25="punish">处罚申诉</button>
    <button class="seg-btn" data-aseg25="hot">热榜</button>`);
  seg.querySelectorAll('[data-aseg25]').forEach((b) => b.addEventListener('click', () => renderAdmin25(b.dataset.aseg25)));
};
async function renderAdmin25(which) {
  const body = document.getElementById('adminBody');
  if (!body) return;
  body.innerHTML = '<div class="disc-loading">加载中…</div>';
  try {
    if (which === 'site') {
      const { site } = await api('/site');
      body.innerHTML = `
        <label class="field"><span class="field-label">站点名称</span><input id="stName" value="${escapeHtml(site.name)}" /></label>
        <label class="field"><span class="field-label">学校名称</span><input id="stSchool" value="${escapeHtml(site.school)}" placeholder="如：某某大学" /></label>
        <label class="field"><span class="field-label">校园邮箱域名（认证用）</span><input id="stDomain" value="${escapeHtml(site.emailDomain || '')}" placeholder="edu.cn 结尾域名" /></label>
        <label class="field"><span class="field-label">注册策略</span>
          <select id="stPolicy">
            <option value="open" ${site.regPolicy === 'open' ? 'selected' : ''}>开放注册</option>
            <option value="emailDomain" ${site.regPolicy === 'emailDomain' ? 'selected' : ''}>仅校园邮箱</option>
            <option value="invite" ${site.regPolicy === 'invite' ? 'selected' : ''}>邀请码</option>
            <option value="manual" ${site.regPolicy === 'manual' ? 'selected' : ''}>人工审核</option>
          </select>
        </label>
        <div class="tag-add-row"><input id="stInvite" placeholder="新增邀请码（逗号分隔可批量）" /><button class="btn small primary" id="stInviteAdd">加入</button></div>
        <p class="field-hint">当前邀请码在该策略下注册时一次性消耗</p>
        <button class="btn primary wide" id="stSave">保存站点设置</button>`;
      $('#stSave').addEventListener('click', async () => {
        const invites = $('#stInvite').value.split(',').map((x) => x.trim()).filter(Boolean);
        try {
          await api('/site', { method: 'PUT', body: {
            name: $('#stName').value, school: $('#stSchool').value, emailDomain: $('#stDomain').value,
            regPolicy: $('#stPolicy').value, inviteCodes: invites,
          } });
          toast('站点设置已保存');
        } catch (e) { toast(e.message, 'error'); }
      });
    } else if (which === 'verify') {
      const { requests } = await api('/admin/verify-requests');
      body.innerHTML = requests.length ? requests.map((r) => `
        <div class="admin-report">
          <div class="admin-report-head"><b>${escapeHtml(r.user ? r.user.nickname : '已注销')}</b><span class="creator-item-sub">${escapeHtml(r.email)}</span></div>
          <button class="btn small primary" data-vok="${r.id}">通过认证</button>
        </div>`).join('') : '<div class="comment-empty" style="padding:32px">没有待审核的认证申请</div>';
      body.querySelectorAll('[data-vok]').forEach((b) => b.addEventListener('click', async () => {
        try { await api(`/admin/verify-requests/${b.dataset.vok}/approve`, { method: 'POST' }); toast('已通过'); renderAdmin25('verify'); }
        catch (e) { toast(e.message, 'error'); }
      }));
    } else if (which === 'punish') {
      const { punishments } = await api('/admin/punishments');
      body.innerHTML = punishments.length ? punishments.map((p) => `
        <div class="admin-report">
          <div class="admin-report-head"><b>${escapeHtml(p.user ? p.user.nickname : '?')}</b> · ${p.type === 'mute' ? '禁言' : p.type} 至 ${p.until ? new Date(p.until).toLocaleString('zh-CN') : '-'}<span class="creator-item-sub">原因：${escapeHtml(p.reason)}</span></div>
          ${p.appeal ? `<div class="admin-report-detail">申诉（${p.appeal.status}）：${escapeHtml(p.appeal.note)}</div>
            ${p.appeal.status === 'pending' ? `<button class="btn small primary" data-ap="${p.id}" data-ok="1">申诉通过</button> <button class="btn small danger-ghost" data-ap="${p.id}" data-ok="0">驳回</button>` : ''}` : ''}
        </div>`).join('') : '<div class="comment-empty" style="padding:32px">没有处罚记录</div>';
      body.querySelectorAll('[data-ap]').forEach((b) => b.addEventListener('click', async () => {
        try { await api(`/admin/punishments/${b.dataset.ap}/appeal/resolve`, { method: 'POST', body: { accept: b.dataset.ok === '1' } }); toast('已处理'); renderAdmin25('punish'); }
        catch (e) { toast(e.message, 'error'); }
      }));
    } else if (which === 'hot') {
      const d = await api('/hot');
      body.innerHTML = d.boards.map((b) => `<div class="creator-section-title">${escapeHtml(b.name)}</div>` +
        (b.posts.length ? b.posts.map((p, i) => `<div class="hot-row"><span class="hot-rank r${i + 1}">${i + 1}</span><span class="hot-title">${escapeHtml(p.title)}</span><span class="hot-score">${p.score}</span></div>`).join('') : '<div class="field-hint">暂无</div>')
      ).join('') + `<p class="field-hint">生成于 ${new Date(d.generatedAt).toLocaleTimeString('zh-CN')}（60 秒缓存）</p>`;
    }
  } catch (err) {
    body.innerHTML = `<div class="comment-empty">${escapeHtml(err.message)}</div>`;
  }
}
