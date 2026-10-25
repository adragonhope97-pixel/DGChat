// DGChat 2.5 测试：认证/角色/市场/活动/投票/群聊/WS/写队列/备份恢复
// 运行：node --test tests/v25.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import WebSocket from 'ws';

const PORT = 3203;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dgchat-25-'));
let server;

const jfetch = async (p, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};
const mkUser = async (name) => {
  const r = await jfetch('/api/auth/register', { method: 'POST', body: { username: name, password: 'pass123456', nickname: name } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { id: r.data.user.id, token: r.data.token, user: r.data.user };
};

before(async () => {
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[srv] ' + d));
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});
after(() => { server?.kill(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

let A, B, C, D, adminToken;

test('准备：管理员与用户', async () => {
  A = await mkUser('u25a' + Date.now() % 100000);
  B = await mkUser('u25b' + Date.now() % 100000);
  C = await mkUser('u25c' + Date.now() % 100000);
  D = await mkUser('u25d' + Date.now() % 100000);
  // 直接提权 A 为 admin（改文件+重启，同 feature21 手法）
  server.kill();
  const file = path.join(DATA_DIR, 'data.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const me = raw.users.find((u) => u.id === A.id);
  me.role = 'admin';
  fs.writeFileSync(file, JSON.stringify(raw));
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const login = await jfetch('/api/auth/login', { method: 'POST', body: { username: A.user.username, password: 'pass123456' } });
  adminToken = login.data.token;
  assert.ok(adminToken);
});

// ---------- 校园认证 ----------
test('站点设置与校园邮箱认证', async () => {
  // 普通用户不可改站点
  assert.equal((await jfetch('/api/site', { method: 'PUT', token: B.token, body: { school: 'X大' } })).status, 403);
  await jfetch('/api/site', { method: 'PUT', token: adminToken, body: { school: '示范大学', emailDomain: 'demo.edu.cn', regPolicy: 'open' } });
  const site = (await jfetch('/api/site')).data.site;
  assert.equal(site.school, '示范大学');
  // 域名匹配自动通过
  const r1 = await jfetch('/api/me/verify', { method: 'POST', token: B.token, body: { email: 'b@demo.edu.cn' } });
  assert.ok(r1.data.verified, '域名匹配应自动通过');
  // 错误域名转人工
  const r2 = await jfetch('/api/me/verify', { method: 'POST', token: C.token, body: { email: 'c@gmail.com' } });
  assert.ok(r2.data.pending, '错误域名应转人工审核');
  // 管理员审核通过
  const reqs = (await jfetch('/api/admin/verify-requests', { token: adminToken })).data.requests;
  assert.equal(reqs.length, 1);
  await jfetch(`/api/admin/verify-requests/${reqs[0].id}/approve`, { method: 'POST', token: adminToken });
  const meC = (await jfetch('/api/me', { token: C.token })).data.user;
  // publicUser 只暴露布尔
  assert.equal(typeof meC.verified, 'boolean');
});

test('邀请码注册策略（一次性消耗）', async () => {
  await jfetch('/api/site', { method: 'PUT', token: adminToken, body: { regPolicy: 'invite', inviteCodes: ['CAMPUS2026'] } });
  const ok = await jfetch('/api/auth/register', { method: 'POST', body: { username: 'inv1' + Date.now() % 100000, password: 'pass123456', inviteCode: 'CAMPUS2026' } });
  assert.equal(ok.status, 200);
  const reuse = await jfetch('/api/auth/register', { method: 'POST', body: { username: 'inv2' + Date.now() % 100000, password: 'pass123456', inviteCode: 'CAMPUS2026' } });
  assert.equal(reuse.status, 403, '邀请码应一次性');
  await jfetch('/api/site', { method: 'PUT', token: adminToken, body: { regPolicy: 'open' } });
});

// ---------- 角色与禁言 ----------
test('版主角色与禁言/申诉全流程', async () => {
  await jfetch(`/api/admin/users/${D.id}/role`, { method: 'PUT', token: adminToken, body: { role: 'moderator', boards: ['market'] } });
  // 版主可以禁言但不能改角色
  await jfetch(`/api/admin/users/${B.id}/mute`, { method: 'POST', token: D.token, body: { hours: 1, reason: '测试禁言' } });
  const muted = await jfetch('/api/posts', { method: 'POST', token: B.token, body: { board: 'chat', title: '被禁言的帖子', content: 'x' } });
  assert.equal(muted.status, 403, '禁言后不能发帖');
  assert.match(muted.data.error, /禁言/);
  assert.equal((await jfetch(`/api/admin/users/${C.id}/role`, { method: 'PUT', token: D.token, body: { role: 'moderator' } })).status, 403, '版主不可授予角色');
  // 申诉 → 通过 → 解除
  const puns = (await jfetch('/api/admin/punishments', { token: adminToken })).data.punishments;
  const p = puns.find((x) => x.userId === B.id && x.type === 'mute');
  assert.ok(p);
  await jfetch(`/api/punishments/${p.id}/appeal`, { method: 'POST', token: B.token, body: { note: '我是清白的' } });
  await jfetch(`/api/admin/punishments/${p.id}/appeal/resolve`, { method: 'POST', token: adminToken, body: { accept: true } });
  const ok2 = await jfetch('/api/posts', { method: 'POST', token: B.token, body: { board: 'chat', title: '申诉成功后发帖', content: 'x' } });
  assert.equal(ok2.status, 200, '申诉通过应解除禁言');
});

// ---------- 二手交易 ----------
test('市场全流程：发布/编辑/状态机/收藏/联系/成交/评价/越权', async () => {
  const mk = await jfetch('/api/market', { method: 'POST', token: B.token, body: { title: 'iPad 第九代', desc: '95新带笔', price: 1999, condition: '几乎全新', category: '数码', place: '东门' } });
  assert.equal(mk.status, 200);
  const item = mk.data.item;
  // 越权编辑
  assert.equal((await jfetch(`/api/market/${item.id}`, { method: 'PUT', token: C.token, body: { title: 'hack' } })).status, 403);
  // 非法状态转换
  const bad = await jfetch(`/api/market/${item.id}`, { method: 'PUT', token: B.token, body: { status: 'sold' } });
  assert.equal(bad.status, 400, '在售不能直接标售出（需 deal 流程）');
  // 合法转换 onsale→reserved→onsale
  await jfetch(`/api/market/${item.id}`, { method: 'PUT', token: B.token, body: { status: 'reserved' } });
  await jfetch(`/api/market/${item.id}`, { method: 'PUT', token: B.token, body: { status: 'onsale' } });
  // 收藏 + 搜索/分类/状态筛选
  await jfetch(`/api/market/${item.id}/fav`, { method: 'POST', token: C.token });
  const listed = (await jfetch('/api/market?category=数码&status=onsale')).data;
  assert.ok(listed.items.some((x) => x.id === item.id));
  // 未私信联系不能确认交易（伪造防护）
  const fakeDeal = await jfetch(`/api/market/${item.id}/deal`, { method: 'POST', token: B.token, body: { buyerId: C.id } });
  assert.equal(fakeDeal.status, 400, '无私信往来不能确认交易');
  // C 联系卖家（含商品标记）→ 卖家确认 → C 评价
  await jfetch('/api/messages', { method: 'POST', token: C.token, body: { toUserId: B.id, content: '你好，我对「iPad 第九代」（商品#' + item.id + '）感兴趣' } });
  await jfetch(`/api/market/${item.id}/deal`, { method: 'POST', token: B.token, body: { buyerId: C.id } });
  const dupRate = await jfetch(`/api/market/${item.id}/rating`, { method: 'POST', token: C.token, body: { stars: 5 } });
  assert.equal(dupRate.status, 200);
  const again = await jfetch(`/api/market/${item.id}/rating`, { method: 'POST', token: C.token, body: { stars: 1 } });
  assert.equal(again.status, 409, '不能重复评价');
  const notBuyer = await jfetch(`/api/market/${item.id}/rating`, { method: 'POST', token: D.token, body: { stars: 5 } });
  assert.equal(notBuyer.status, 403, '非买家不能评价');
  const credit = (await jfetch(`/api/users/${B.id}/credit`)).data;
  assert.equal(credit.count, 1); assert.equal(credit.avg, 5);
});

// ---------- 活动与组队 ----------
test('活动全流程：创建/容量/候补/重复报名/递补/取消', async () => {
  const start = Date.now() + 48 * 3600e3, end = start + 2 * 3600e3;
  const mk = await jfetch('/api/activities', { method: 'POST', token: B.token, body: { title: '周末羽毛球', desc: '来打球', category: '运动约伴', place: '体育馆', startAt: start, endAt: end, capacity: 2 } });
  assert.equal(mk.status, 200);
  const a = mk.data.activity;
  assert.equal((await jfetch(`/api/activities/${a.id}/join`, { method: 'POST', token: C.token })).data.status, 'joined');
  assert.equal((await jfetch(`/api/activities/${a.id}/join`, { method: 'POST', token: C.token })).status, 409, '重复报名拒绝');
  assert.equal((await jfetch(`/api/activities/${a.id}/join`, { method: 'POST', token: D.token })).data.status, 'joined');
  // 满员 → A 候补
  assert.equal((await jfetch(`/api/activities/${a.id}/join`, { method: 'POST', token: A.token })).data.status, 'waitlist');
  // 越权编辑
  assert.equal((await jfetch(`/api/activities/${a.id}`, { method: 'PUT', token: C.token, body: { title: 'hack' } })).status, 403);
  // C 退出 → A 递补
  await jfetch(`/api/activities/${a.id}/leave`, { method: 'POST', token: C.token });
  const a2 = (await jfetch('/api/activities/' + a.id, { token: A.token })).data.activity;
  assert.equal(a2.myJoin, 'joined', '候补应自动递补');
  // 参与者名单仅发起人/管理可见（版主 D 可见，普通用户 C 不可见）
  const asD = (await jfetch('/api/activities/' + a.id, { token: D.token })).data.activity;
  assert.ok(Array.isArray(asD.participants), '版主可见名单');
  const asC = (await jfetch('/api/activities/' + a.id, { token: C.token })).data.activity;
  assert.equal(asC.participants, null);
  // 取消活动
  await jfetch(`/api/activities/${a.id}`, { method: 'PUT', token: B.token, body: { status: 'cancelled' } });
  assert.equal((await jfetch(`/api/activities/${a.id}/join`, { method: 'POST', token: C.token })).status, 400, '已取消不能报名');
});

// ---------- 投票 ----------
test('投票：多选/截止/重复防护/结果', async () => {
  const mk = await fetch(BASE + '/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.token },
    body: JSON.stringify({ board: 'chat', title: '投票测试', content: '选午餐', pollOptions: JSON.stringify(['食堂', '外卖', '自煮']), pollMulti: true, pollDeadlineHours: 1 }),
  }).then((r) => r.json());
  const pid = mk.post.id;
  await jfetch(`/api/posts/${pid}/poll/vote`, { method: 'POST', token: C.token, body: { options: [0, 2] } });
  assert.equal((await jfetch(`/api/posts/${pid}/poll/vote`, { method: 'POST', token: C.token, body: { options: [1] } })).status, 409, '重复投票拒绝');
  // 单选强投多选拒绝
  const single = await fetch(BASE + '/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.token },
    body: JSON.stringify({ board: 'chat', title: '单选投票', content: 'x', pollOptions: JSON.stringify(['A', 'B']), pollMulti: false, pollDeadlineHours: 1 }),
  }).then((r) => r.json());
  assert.equal((await jfetch(`/api/posts/${single.post.id}/poll/vote`, { method: 'POST', token: C.token, body: { options: [0, 1] } })).status, 400, '单选投多选拒绝');
  const res = (await jfetch(`/api/posts/${pid}/poll/results`, { token: D.token })).data;
  assert.equal(res.total, 1); assert.deepEqual(res.counts, [1, 0, 1]);
});

// ---------- 互助 ----------
test('互助帖状态机', async () => {
  const mk = await jfetch('/api/posts', { method: 'POST', token: B.token, body: { board: 'lost', title: '求助：捡到校园卡', content: 'x', kind: 'help' } });
  const pid = mk.data.post.id;
  assert.equal(mk.data.post.helpStatus, 'open');
  assert.equal((await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: C.token, body: { status: 'solved' } })).status, 403, '非作者不能改');
  await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: B.token, body: { status: 'doing' } });
  assert.equal((await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: B.token, body: { status: 'open' } })).status, 200, 'doing 可回 open（进度修正）');
  await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: B.token, body: { status: 'doing' } });
  await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: B.token, body: { status: 'solved' } });
  assert.equal((await jfetch(`/api/posts/${pid}/help-status`, { method: 'POST', token: B.token, body: { status: 'open' } })).status, 400, 'solved 为终态不可回退');
});

// ---------- 匿名保护 ----------
test('匿名发布与去匿名审计', async () => {
  const mk = await jfetch('/api/posts', { method: 'POST', token: B.token, body: { board: 'confession', title: '匿名表白', content: 'x', anonymous: true } });
  const pid = mk.data.post.id;
  assert.equal(mk.data.post.author, null, '普通响应不带作者');
  // 普通用户无权去匿名
  assert.equal((await jfetch('/api/admin/anon/' + pid, { token: C.token })).status, 403);
  const reveal = await jfetch('/api/admin/anon/' + pid, { token: adminToken });
  assert.equal(reveal.status, 200);
  assert.equal(reveal.data.user.id, B.id, '管理员可审计真实身份');
});

// ---------- 群聊 ----------
test('群聊：创建/邀请/权限/消息/幂等', async () => {
  const mk = await jfetch('/api/groups', { method: 'POST', token: B.token, body: { name: '羽毛球群' } });
  const g = mk.data.group;
  await jfetch(`/api/groups/${g.id}/invite`, { method: 'POST', token: B.token, body: { userId: C.id } });
  // 非成员读消息拒绝
  assert.equal((await jfetch(`/api/groups/${g.id}/messages`, { token: D.token })).status, 403);
  // 成员发消息（幂等）
  const cid = 'g' + Date.now();
  const m1 = await jfetch(`/api/groups/${g.id}/messages`, { method: 'POST', token: C.token, body: { content: '周日开打？', clientId: cid } });
  const m2 = await jfetch(`/api/groups/${g.id}/messages`, { method: 'POST', token: C.token, body: { content: '周日开打？', clientId: cid } });
  assert.equal(m2.data.deduped, true);
  // 群公告仅群主
  assert.equal((await jfetch(`/api/groups/${g.id}/announcement`, { method: 'PUT', token: C.token, body: { announcement: 'x' } })).status, 403);
  await jfetch(`/api/groups/${g.id}/announcement`, { method: 'PUT', token: B.token, body: { announcement: '每周日上午' } });
  // 踢人/退群
  await jfetch(`/api/groups/${g.id}/kick`, { method: 'POST', token: B.token, body: { userId: C.id } });
  assert.equal((await jfetch(`/api/groups/${g.id}/messages`, { token: C.token })).status, 403, '被移出后不能读');
});

// ---------- WebSocket 实时 ----------
test('WS：认证/实时 DM/输入中/未认证拒绝', async () => {
  // 未认证关闭
  const noAuth = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.on('close', (c) => resolve(c)); ws.on('open', () => ws.close());
  });
  assert.ok(noAuth === 4003 || noAuth === 1006, '未认证应被拒绝, got ' + noAuth);
  // C 与 D 实时对话
  const wsC = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${C.token}`);
  const wsD = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${D.token}`);
  await Promise.all([onceOpen(wsC), onceOpen(wsD)]);
  const gotTyping = new Promise((r) => wsD.on('message', (raw) => { const m = JSON.parse(raw); if (m.type === 'typing') r(true); }));
  wsC.send(JSON.stringify({ type: 'typing', to: D.id }));
  assert.ok(await gotTyping, 'D 应收到 C 的输入中提示');
  const gotMsg = new Promise((r) => wsD.on('message', (raw) => { const m = JSON.parse(raw); if (m.type === 'message' && m.message.content === '实时消息测试') r(m); }));
  wsC.send(JSON.stringify({ type: 'send', to: D.id, content: '实时消息测试', clientId: 'ws' + Date.now() }));
  const m = await gotMsg;
  assert.equal(m.message.fromMe, false);
  assert.ok(m.message.id, '服务器分配了消息 ID');
  wsC.close(); wsD.close();
});

// ---------- 反垃圾 ----------
test('重复内容拦截与禁言静默', async () => {
  const dup1 = await jfetch('/api/posts', { method: 'POST', token: C.token, body: { board: 'chat', title: '重复测试帖', content: '一样的内容' } });
  assert.equal(dup1.status, 200);
  const dup2 = await jfetch('/api/posts', { method: 'POST', token: C.token, body: { board: 'chat', title: '重复测试帖', content: '一样的内容' } });
  assert.equal(dup2.status, 429, '一小时内重复内容应拦截');
});

// ---------- 通知偏好 ----------
test('通知免打扰与类型关闭', async () => {
  await jfetch('/api/me/notifications/read', { method: 'POST', token: D.token, body: { all: true } }); // 清历史未读（system 类按设计穿透 DND）
  await jfetch('/api/me/notif-prefs', { method: 'PUT', token: D.token, body: { off: ['like'], dndStart: '00:00', dndEnd: '23:59' } });
  const pid = (await jfetch('/api/posts', { method: 'POST', token: D.token, body: { board: 'chat', title: 'DND 测试帖 ' + Date.now(), content: 'x' } })).data.post.id;
  await jfetch(`/api/posts/${pid}/like`, { method: 'POST', token: C.token });
  const notifs = (await jfetch('/api/me/notifications', { token: D.token })).data;
  const likeUnread = notifs.items.filter((n) => n.type === 'like' && !n.read).length;
  assert.equal(likeUnread, 0, '类型关闭 + DND 下点赞通知不应产生');
  await jfetch('/api/me/notif-prefs', { method: 'PUT', token: D.token, body: { off: [], dndStart: null, dndEnd: null } });
});

// ---------- 热榜 ----------
test('热榜缓存与结构', async () => {
  const h1 = (await jfetch('/api/hot', { token: C.token })).data;
  assert.ok(Array.isArray(h1.boards) && h1.boards.length === 5);
  assert.ok(Array.isArray(h1.market) && Array.isArray(h1.activities));
});

// ---------- 写队列并发 + 备份恢复 ----------
test('并发写不丢失（写队列）', async () => {
  const before = (await jfetch('/api/posts?mine=1', { token: C.token })).data.posts.length;
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    jfetch('/api/posts', { method: 'POST', token: C.token, body: { board: 'chat', title: '并发帖 ' + i + ' ' + Date.now(), content: 'x' + i } })
  ));
  assert.ok(results.every((r) => r.status === 200));
  await new Promise((r) => setTimeout(r, 400)); // 等队列排空
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data.json'), 'utf8'));
  const mine = raw.posts.filter((x) => x.userId === C.id);
  assert.equal(mine.length, before + results.length, '全部并发写都应落盘');
});

test('备份恢复：损坏自动恢复', async () => {
  server.kill();
  const file = path.join(DATA_DIR, 'data.json');
  // 先做一次正常备份
  fs.copyFileSync(file, path.join(DATA_DIR, 'backups', 'data-manual.json'));
  // 制造损坏
  fs.writeFileSync(file, '{"broken":');
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const users = (await jfetch('/api/site')).data.site.verifiedCount;
  assert.ok(typeof users === 'number', '损坏后应从备份恢复并正常启动');
  const raw2 = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(raw2.users && raw2.users.length > 0, '数据已从备份恢复');
});
function onceOpen(ws) { return new Promise((r) => ws.on('open', r)); }
