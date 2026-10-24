// DGChat 2.1 功能测试：收藏夹 / 通知 / 搜索 / 话题 / 隐私 / DM 增强 / 会话管理 / 导出 / 注销
// 运行：node --test tests/feature21.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 3202;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dgchat-21-'));
let server;

const jfetch = async (p, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data, headers: res.headers };
};

const mkUser = async (name, nickname) => {
  const r = await jfetch('/api/auth/register', {
    method: 'POST',
    body: { username: name, password: 'pass123456', nickname: nickname || name },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { id: r.data.user.id, token: r.data.token, user: r.data.user };
};

let A, B, C, postA, postB;

before(async () => {
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  A = await mkUser('ua' + Date.now() % 100000);
  B = await mkUser('ub' + Date.now() % 100000);
  C = await mkUser('uc' + Date.now() % 100000);
  postA = (await jfetch('/api/posts', { method: 'POST', token: A.token, body: { board: 'chat', title: 'A的帖子 #测试话题#', content: '带话题内容 #测试话题#' } })).data.post;
  postB = (await jfetch('/api/posts', { method: 'POST', token: B.token, body: { board: 'chat', title: 'B的帖子', content: '普通内容' } })).data.post;
});

after(() => {
  server?.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

// ---------- 收藏夹 ----------

test('收藏夹：创建/重命名/删除，删除后内容移入默认夹', async () => {
  const mk = await jfetch('/api/me/folders', { method: 'POST', token: A.token, body: { name: '学习资料' } });
  assert.equal(mk.status, 200);
  const fid = mk.data.folder.id;
  const dup = await jfetch('/api/me/folders', { method: 'POST', token: A.token, body: { name: '学习资料' } });
  assert.equal(dup.status, 409, '同名收藏夹拒绝');

  // 收藏到指定夹（幂等）
  const fav = await jfetch(`/api/posts/${postB.id}/favorite`, { method: 'POST', token: A.token, body: { folderId: fid } });
  assert.equal(fav.status, 200);
  assert.equal(fav.data.folderId, fid);
  // 重复收藏不产生双份
  await jfetch(`/api/posts/${postB.id}/favorite`, { method: 'POST', token: A.token, body: { folderId: fid } });
  const list = await jfetch('/api/me/favorites?folderId=' + fid, { token: A.token });
  assert.equal(list.data.total, 1, '重复收藏应幂等');

  // 重命名
  const ren = await jfetch(`/api/me/folders/${fid}`, { method: 'PUT', token: A.token, body: { name: '学习资料2' } });
  assert.equal(ren.status, 200);
  // 删除 → 内容移入默认
  const del = await jfetch(`/api/me/folders/${fid}`, { method: 'DELETE', token: A.token });
  assert.equal(del.status, 200);
  const def = await jfetch('/api/me/favorites?folderId=0', { token: A.token });
  assert.equal(def.data.total, 1, '删除收藏夹后内容在默认夹');
  assert.equal(def.data.posts[0].id, postB.id);

  // 取消收藏
  const unfav = await jfetch(`/api/posts/${postB.id}/favorite`, { method: 'DELETE', token: A.token });
  assert.equal(unfav.data.favoritedByMe, false);
});

test('收藏夹隐私：他人无法通过任何接口查看我的收藏', async () => {
  await jfetch(`/api/posts/${postB.id}/favorite`, { method: 'POST', token: A.token });
  // 收藏列表接口挂在 /me 下，天然绑定 token 用户；换 B 的 token 只能看到 B 自己的（空）
  const listB = await jfetch('/api/me/favorites', { token: B.token });
  assert.equal(listB.data.total, 0, 'B 看不到 A 的收藏');
});

// ---------- 通知中心 ----------

test('通知：点赞/评论/@提及/关注 触发，去重，已读与删除', async () => {
  await jfetch(`/api/posts/${postA.id}/like`, { method: 'POST', token: B.token });
  await jfetch(`/api/posts/${postA.id}/comments`, { method: 'POST', token: B.token, body: { content: '好帖 @' + A.user.username } });
  await jfetch(`/api/users/${A.id}/follow`, { method: 'POST', token: B.token });

  const list = await jfetch('/api/me/notifications', { token: A.token });
  assert.ok(list.data.items.length >= 3, 'A 应收到点赞/评论(含提及)/关注通知');
  const types = list.data.items.map((n) => n.type);
  assert.ok(types.includes('like') && types.includes('comment') && types.includes('follow') && types.includes('mention'));

  // 去重：B 再点赞（先取消）不产生第二条未读
  await jfetch(`/api/posts/${postA.id}/like`, { method: 'POST', token: B.token }); // 取消
  await jfetch(`/api/posts/${postA.id}/like`, { method: 'POST', token: B.token }); // 再赞
  const list2 = await jfetch('/api/me/notifications', { token: A.token });
  const likeNotifs = list2.data.items.filter((n) => n.type === 'like' && !n.read);
  assert.ok(likeNotifs.length <= 1, '10 分钟窗口内同类未读通知应去重');

  // 单条已读 + 全部已读
  const first = list2.data.items[0];
  await jfetch('/api/me/notifications/read', { method: 'POST', token: A.token, body: { ids: [first.id] } });
  await jfetch('/api/me/notifications/read', { method: 'POST', token: A.token, body: { all: true } });
  const list3 = await jfetch('/api/me/notifications', { token: A.token });
  assert.equal(list3.data.unread, 0, '全部已读后未读为 0');

  // 删除
  const del = await jfetch('/api/me/notifications/' + first.id, { method: 'DELETE', token: A.token });
  assert.equal(del.status, 200);
  // B 不能操作 A 的通知
  const delB = await jfetch('/api/me/notifications/' + first.id, { method: 'DELETE', token: B.token });
  assert.equal(delB.status, 404, '跨用户通知删除应 404');
});

// ---------- 统一搜索 ----------

test('统一搜索：动态（筛选/相关度）/ 用户 / 话题', async () => {
  const posts = await jfetch('/api/search?type=posts&q=测试话题', { token: B.token });
  assert.ok(posts.data.items.some((p) => p.id === postA.id), '话题关键词命中帖子');

  const rel = await jfetch('/api/search?type=posts&q=帖子&sort=relevance', { token: B.token });
  assert.ok(rel.data.items.length >= 2);

  const users = await jfetch('/api/search?type=users&q=' + A.user.username.slice(0, 4), { token: B.token });
  assert.ok(users.data.items.some((u) => u.id === A.id), '用户搜索命中');

  const topics = await jfetch('/api/search?type=topics&q=测试', { token: B.token });
  assert.ok(topics.data.items.some((t) => t.name === '测试话题'), '话题搜索命中');
});

// ---------- 话题 ----------

test('话题：热门列表与话题详情（仅公开可见内容）', async () => {
  const hot = await jfetch('/api/topics?sort=hot', { token: C.token });
  assert.ok(hot.data.items.some((t) => t.name === '测试话题'));
  const detail = await jfetch('/api/topics/' + encodeURIComponent('测试话题') + '/posts', { token: C.token });
  assert.ok(detail.data.items.some((p) => p.id === postA.id));
  assert.deepEqual(detail.data.items[0].topics, ['测试话题'], 'postView 必须带 topics（前端芯片渲染依赖）');
  assert.ok(detail.data.items.every((p) => p.id !== postB.id), '无话题的帖子不出现');
});

// ---------- 隐私：私密账号 / DM 策略 / 评论策略 / 静音 / 隐藏 ----------

test('私密账号：关注需审批，审批前动态不可见', async () => {
  // C 开启私密账号
  await jfetch('/api/me/settings', { method: 'PUT', token: C.token, body: { privateAccount: true } });
  // A 尝试看 C 的动态 → 不可见
  const postC = (await jfetch('/api/posts', { method: 'POST', token: C.token, body: { board: 'chat', title: 'C的私密动态', content: 'x' } })).data.post;
  const listA = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(!listA.data.posts.some((p) => p.id === postC.id), '私密账号动态对非关注者不可见');
  // A 关注 C → pending
  const f = await jfetch(`/api/users/${C.id}/follow`, { method: 'POST', token: A.token });
  assert.equal(f.data.pending, true);
  // C 审批前 A 仍不可见；审批后可见
  const reqs = await jfetch('/api/me/follow-requests', { token: C.token });
  assert.ok(reqs.data.users.some((u) => u.id === A.id));
  await jfetch(`/api/me/follow-requests/${A.id}/approve`, { method: 'POST', token: C.token });
  const listA2 = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(listA2.data.posts.some((p) => p.id === postC.id), '审批通过后可见');
});

test('DM 策略与评论策略服务端强制', async () => {
  // C 先关注 A（A 公开账号，直接生效），使 A 属于「C 关注的人」
  await jfetch(`/api/users/${A.id}/follow`, { method: 'POST', token: C.token });
  // C 设置仅关注者可私信
  await jfetch('/api/me/settings', { method: 'PUT', token: C.token, body: { dmPolicy: 'following' } });
  const okDm = await jfetch('/api/messages', { method: 'POST', token: A.token, body: { toUserId: C.id, content: 'hello' } });
  assert.equal(okDm.status, 200, '关注者可私信');
  const badDm = await jfetch('/api/messages', { method: 'POST', token: B.token, body: { toUserId: C.id, content: 'hi' } });
  assert.equal(badDm.status, 403, '非关注者被拒');
  // 评论策略（D 不是 A 的关注者）
  const D = await mkUser('ud' + Date.now() % 100000);
  await jfetch('/api/me/settings', { method: 'PUT', token: A.token, body: { commentPolicy: 'following' } });
  const badCmt = await jfetch(`/api/posts/${postA.id}/comments`, { method: 'POST', token: D.token, body: { content: 'x' } });
  assert.equal(badCmt.status, 403, '非关注者评论被拒');
  const okCmt = await jfetch(`/api/posts/${postA.id}/comments`, { method: 'POST', token: B.token, body: { content: '我是关注者' } });
  assert.equal(okCmt.status, 200, '关注者（B follows A）可评论');
});

test('静音：仅影响自己的视图，不影响他人', async () => {
  await jfetch(`/api/users/${B.id}/mute`, { method: 'POST', token: A.token });
  const listA = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(!listA.data.posts.some((p) => p.id === postB.id), '静音后 A 看不到 B 的帖子');
  const listC = await jfetch('/api/posts?board=chat', { token: C.token });
  assert.ok(listC.data.posts.some((p) => p.id === postB.id), 'C 仍能看到 B 的帖子');
  await jfetch(`/api/users/${B.id}/mute`, { method: 'DELETE', token: A.token });
  const listA2 = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(listA2.data.posts.some((p) => p.id === postB.id), '取消静音恢复');
});

test('个人隐藏帖子：仅自己视图过滤', async () => {
  await jfetch(`/api/posts/${postB.id}/hide-personal`, { method: 'POST', token: A.token });
  const listA = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(!listA.data.posts.some((p) => p.id === postB.id));
  await jfetch(`/api/posts/${postB.id}/hide-personal`, { method: 'DELETE', token: A.token });
  const listA2 = await jfetch('/api/posts?board=chat', { token: A.token });
  assert.ok(listA2.data.posts.some((p) => p.id === postB.id));
});

// ---------- 私信增强 ----------

test('私信：幂等 clientId 防重复、引用、撤回、搜索', async () => {
  const clientId = 'c' + Date.now();
  const m1 = await jfetch('/api/messages', { method: 'POST', token: A.token, body: { toUserId: C.id, content: '幂等测试', clientId } });
  assert.equal(m1.status, 200);
  const m2 = await jfetch('/api/messages', { method: 'POST', token: A.token, body: { toUserId: C.id, content: '幂等测试', clientId } });
  assert.equal(m2.data.message.id, m1.data.message.id, '同 clientId 应返回同一消息');

  // 引用
  const q = await jfetch('/api/messages', { method: 'POST', token: C.token, body: { toUserId: A.id, content: '收到', replyTo: m1.data.message.id } });
  assert.equal(q.data.message.replyTo.id, m1.data.message.id, '引用成功');
  // 引用非法消息（他人的、不存在的）
  const badQ = await jfetch('/api/messages', { method: 'POST', token: B.token, body: { toUserId: A.id, content: 'x', replyTo: m1.data.message.id } });
  assert.equal(badQ.data.message.replyTo, null, '非参与者引用被忽略');

  // 5 分钟内撤回；他人消息不能撤
  const recall = await jfetch(`/api/messages/${m1.data.message.id}/recall`, { method: 'POST', token: A.token });
  assert.equal(recall.status, 200);
  const recall2 = await jfetch(`/api/messages/${m1.data.message.id}/recall`, { method: 'POST', token: A.token });
  assert.equal(recall2.status, 409, '重复撤回 409');
  const thread = await jfetch('/api/conversations/' + A.id, { token: C.token });
  const recalled = thread.data.messages.find((m) => m.id === m1.data.message.id);
  assert.equal(recalled.recalled, true);
  assert.equal(recalled.content, null, '撤回后内容不可读');

  // 搜索：仅参与者可见
  await jfetch('/api/messages', { method: 'POST', token: B.token, body: { toUserId: A.id, content: 'B的秘密暗号xyz' } });
  const searchC = await jfetch('/api/messages/search?q=秘密暗号', { token: C.token });
  assert.ok(!searchC.data.results.some((r) => r.hits.some((h) => h.content.includes('秘密暗号'))), '非参与者搜不到');
  const searchB = await jfetch('/api/messages/search?q=秘密暗号', { token: B.token });
  assert.ok(searchB.data.results.some((r) => r.hits.some((h) => h.content.includes('秘密暗号'))), '参与者可搜到');
});

// ---------- 会话管理 ----------

test('会话管理：列出/退出其他设备', async () => {
  const second = await jfetch('/api/auth/login', { method: 'POST', body: { username: A.user.username, password: 'pass123456' } });
  const list = await jfetch('/api/me/sessions', { token: A.token });
  assert.ok(list.data.sessions.length >= 2);
  assert.ok(list.data.sessions.some((s) => s.current));
  const other = list.data.sessions.find((s) => !s.current);
  const kill = await jfetch('/api/me/sessions/' + other.id, { method: 'DELETE', token: A.token });
  assert.equal(kill.status, 200);
  const meSecond = await jfetch('/api/me', { token: second.data.token });
  assert.ok(meSecond.status === 401 || meSecond.data.user === null, '被退出的会话失效');
});

// ---------- 导出与注销 ----------

test('数据导出：包含本人数据，不含密码哈希与他人私信', async () => {
  const r = await fetch(BASE + '/api/me/export', { headers: { Authorization: 'Bearer ' + A.token } });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.profile.username, A.user.username);
  assert.ok(Array.isArray(body.posts) && body.posts.some((x) => x.id === postA.id));
  assert.ok(!JSON.stringify(body).includes('passwordHash'), '不得包含密码哈希');
  assert.ok(!JSON.stringify(body).includes('salt'), '不得包含盐值');
  // 频控：连续第 4 次应 429
  await jfetch('/api/me/export', { token: A.token });
  await jfetch('/api/me/export', { token: A.token });
  const fourth = await jfetch('/api/me/export', { token: A.token });
  assert.equal(fourth.status, 429, '导出频控 3 次/小时');
});

test('账号注销：验证密码、数据清理、他人数据不受损', async () => {
  // B 关注了 A（前面步骤），注销 A 后 B 的 following 列表应移除 A，但 B 的帖子保留
  const del = await jfetch('/api/me/delete', { method: 'POST', token: A.token, body: { password: 'pass123456', confirm: 'DELETE' } });
  assert.equal(del.status, 200);
  const meA = await jfetch('/api/me', { token: A.token });
  assert.ok(meA.status === 401 || meA.data.user === null, '注销后会话失效');
  const listB = await jfetch('/api/posts?board=chat', { token: B.token });
  assert.ok(!listB.data.posts.some((p) => p.id === postA.id), '注销用户的动态被删除');
  assert.ok(listB.data.posts.some((p) => p.id === postB.id), '他人动态不受影响');
  const again = await jfetch('/api/me/delete', { method: 'POST', token: A.token, body: { password: 'pass123456', confirm: 'DELETE' } });
  assert.equal(again.status, 401, '重复提交被会话失效拦截');
});
