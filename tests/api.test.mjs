// DGChat 2.0 权限与安全测试
// 运行：node --test tests/api.test.mjs
// 起独立服务实例（PORT=3100，独立 DATA_DIR），不接触真实数据
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dgchat-test-'));
let server;

const jfetch = async (path, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

before(async () => {
  // 预置一份 v1 旧数据，验证迁移
  const v1 = {
    users: [
      { id: 1, username: 'root', salt: 'x', passwordHash: 'x', nickname: 'Old Admin', role: 'admin', email: null, avatarColor: '#333', createdAt: Date.now() },
      { id: 2, username: 'olduser', salt: 'x', passwordHash: 'x', nickname: 'Old User', email: null, avatarColor: '#444', createdAt: Date.now() },
    ],
    posts: [{ id: 1, userId: 2, board: 'chat', title: 'v1 post', content: 'old data', anonymous: false, images: [], likes: [1], favorites: [], createdAt: Date.now() }],
    comments: [],
    tokens: {},
    seq: { post: 1, comment: 0, user: 2, message: 0 },
    messages: [],
  };
  fs.writeFileSync(path.join(DATA_DIR, 'data.json'), JSON.stringify(v1));
  // 注意：v1 数据的 passwordHash 是假的，root 无法登录；测试管理员走注册+直接改 JSON 的方式
  server = spawn(process.execPath, ['server/server.js'], {
    cwd: path.resolve('..') === '/' ? '.' : process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  // 等服务就绪
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => {
  server?.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

// ---------- 迁移 ----------

test('v1 数据迁移：补齐 2.0 字段且生成备份文件', async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'data.json'), 'utf8'));
  assert.equal(raw.schemaVersion, 2);
  for (const u of raw.users) {
    assert.deepEqual(u.interests, []);
    assert.deepEqual(u.following, []);
    assert.deepEqual(u.blocked, []);
    assert.equal(u.status, 'active');
  }
  assert.equal(raw.posts[0].visibility, 'public');
  assert.equal(raw.posts[0].status, 'published');
  assert.equal(raw.posts[0].hidden, false);
  const migDir = path.join(DATA_DIR, 'migrations');
  assert.ok(fs.existsSync(migDir) && fs.readdirSync(migDir).length >= 1, '应生成迁移备份');
});

// ---------- 注册 / 登录 ----------

const mkUser = async (name) => {
  const r = await jfetch('/api/auth/register', {
    method: 'POST',
    body: { username: name, password: 'pass123456', nickname: '测试' + name },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { id: r.data.user.id, token: r.data.token, user: r.data.user };
};

let A, B, C, adminToken, adminId;
let pubPost, privPost, draftPost;

test('注册登录基础', async () => {
  A = await mkUser('usera' + Date.now() % 100000);
  B = await mkUser('userb' + Date.now() % 100000);
  C = await mkUser('userc' + Date.now() % 100000);
  const bad = await jfetch('/api/auth/login', { method: 'POST', body: { username: A.user.username, password: 'wrong' } });
  assert.equal(bad.status, 401);
});

// 提升一个账号为管理员（直接写数据文件，模拟站长）
test('准备管理员', async () => {
  const file = path.join(DATA_DIR, 'data.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.users[0].username = 'rootadmin';
  raw.users[0].role = 'admin';
  const crypto = await import('node:crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  raw.users[0].salt = salt;
  raw.users[0].passwordHash = crypto.scryptSync('adminpass123', salt, 64).toString('hex');
  fs.writeFileSync(file, JSON.stringify(raw));
  // 修改文件后服务的内存还是旧的；通过重新登录触发不了 —— 用重启进程方式加载
  server.kill();
  server = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const login = await jfetch('/api/auth/login', { method: 'POST', body: { username: 'rootadmin', password: 'adminpass123' } });
  assert.equal(login.status, 200);
  adminToken = login.data.token;
  adminId = login.data.user.id;
});

// ---------- 动态可见性 ----------

test('仅自己可见的动态：他人列表/详情/互动全部拒绝', async () => {
  pubPost = (await jfetch('/api/posts', { method: 'POST', token: A.token, body: { board: 'chat', title: '公开帖', content: '大家都能看' } })).data.post;
  const priv = await jfetch('/api/posts', { method: 'POST', token: A.token, body: { board: 'chat', title: '私密帖', content: '只有我能看', visibility: 'private' } });
  privPost = priv.data.post;
  assert.equal(privPost.visibility, 'private');

  const listB = await jfetch('/api/posts?board=chat', { token: B.token });
  assert.ok(!listB.data.posts.some((p) => p.id === privPost.id), '他人列表不应包含私密帖');
  assert.ok(listB.data.posts.some((p) => p.id === pubPost.id), '公开帖应可见');

  const detail = await jfetch('/api/posts/' + privPost.id, { token: B.token });
  assert.equal(detail.status, 404, '直接请求详情也应 404');

  const like = await jfetch(`/api/posts/${privPost.id}/like`, { method: 'POST', token: B.token });
  assert.equal(like.status, 404, '不能给私密帖点赞');

  const cmt = await jfetch(`/api/posts/${privPost.id}/comments`, { method: 'POST', token: B.token, body: { content: 'hi' } });
  assert.equal(cmt.status, 404, '不能给私密帖评论');

  const search = await jfetch('/api/posts?q=私密帖', { token: B.token });
  assert.ok(!search.data.posts.some((p) => p.id === privPost.id), '搜索不能漏出私密帖');

  const own = await jfetch('/api/posts?q=私密帖', { token: A.token });
  assert.ok(own.data.posts.some((p) => p.id === privPost.id), '作者自己可见');

  const adminList = await jfetch('/api/posts?q=私密帖', { token: adminToken });
  assert.ok(adminList.data.posts.some((p) => p.id === privPost.id), '管理员可见（审核需要）');
});

test('草稿：他人不可见，创作者中心可见，可发布', async () => {
  const d = await jfetch('/api/posts', { method: 'POST', token: A.token, body: { board: 'chat', title: '草稿帖', content: '未发布', draft: true } });
  draftPost = d.data.post;
  assert.equal(draftPost.status, 'draft');
  const listB = await jfetch('/api/posts', { token: B.token });
  assert.ok(!listB.data.posts.some((p) => p.id === draftPost.id));
  const mine = await jfetch('/api/me/creator', { token: A.token });
  assert.ok(mine.data.drafts.some((x) => x.id === draftPost.id), '创作者中心应展示草稿');
  // 发布草稿
  const cur = await jfetch('/api/posts/' + draftPost.id, { token: A.token });
  const fd = new FormData();
  fd.append('title', cur.data.post.title);
  fd.append('content', cur.data.post.content);
  fd.append('publish', 'true');
  const res = await fetch(`${BASE}/api/posts/${draftPost.id}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + A.token }, body: fd });
  assert.equal(res.status, 200);
  const after = await jfetch('/api/posts', { token: B.token });
  assert.ok(after.data.posts.some((p) => p.id === draftPost.id), '发布后他人可见');
});

// ---------- 屏蔽 ----------

test('屏蔽：动态/搜索/资料/关注/私信全链路生效', async () => {
  const blk = await jfetch(`/api/users/${B.id}/block`, { method: 'POST', token: A.token });
  assert.equal(blk.status, 200);

  const listB = await jfetch('/api/posts', { token: B.token });
  assert.ok(!listB.data.posts.some((p) => p.id === pubPost.id), '被屏蔽者看不到屏蔽者的动态');

  const searchB = await jfetch('/api/posts?q=公开帖', { token: B.token });
  assert.ok(!searchB.data.posts.some((p) => p.id === pubPost.id), '搜索也不能绕过屏蔽');

  const profile = await jfetch(`/api/users/${A.id}`, { token: B.token });
  assert.equal(profile.status, 404, '屏蔽后资料互相不可见');

  const follow = await jfetch(`/api/users/${A.id}/follow`, { method: 'POST', token: B.token });
  assert.equal(follow.status, 403, '不能关注屏蔽自己的人');

  const dm = await jfetch('/api/messages', { method: 'POST', token: B.token, body: { toUserId: A.id, content: 'hi' } });
  assert.equal(dm.status, 403, '屏蔽后不能发私信');

  const recB = await jfetch('/api/discover/recommendations', { token: B.token });
  assert.ok(!recB.data.users.some((u) => u.id === A.id), '推荐不出现屏蔽用户');

  const searchU = await jfetch('/api/discover/users?q=' + A.user.username, { token: B.token });
  assert.ok(!searchU.data.users.some((u) => u.id === A.id), '用户搜索不能绕过屏蔽');

  // 解除屏蔽后恢复
  await jfetch(`/api/users/${B.id}/block`, { method: 'DELETE', token: A.token });
  const listB2 = await jfetch('/api/posts', { token: B.token });
  assert.ok(listB2.data.posts.some((p) => p.id === pubPost.id), '解除屏蔽后恢复可见');
});

// ---------- 关注与推荐 ----------

test('关注系统与推荐过滤', async () => {
  await jfetch(`/api/users/${A.id}/follow`, { method: 'POST', token: B.token });
  const following = await jfetch('/api/me/following', { token: B.token });
  assert.ok(following.data.users.some((u) => u.id === A.id));
  const followers = await jfetch('/api/me/followers', { token: A.token });
  assert.ok(followers.data.users.some((u) => u.id === B.id));

  const rec = await jfetch('/api/discover/recommendations', { token: B.token });
  assert.ok(!rec.data.users.some((u) => u.id === A.id), '已关注的人不再推荐');
  const self = await jfetch('/api/discover/recommendations', { token: B.token });
  assert.ok(!self.data.users.some((u) => u.id === B.id), '不推荐自己');
});

// ---------- 举报与审核 ----------

test('举报：普通用户不能进管理接口，管理员可处理', async () => {
  const rep = await jfetch('/api/reports', { method: 'POST', token: B.token, body: { targetType: 'post', targetId: pubPost.id, reason: '垃圾广告', detail: '测试举报' } });
  assert.equal(rep.status, 200);
  const dup = await jfetch('/api/reports', { method: 'POST', token: B.token, body: { targetType: 'post', targetId: pubPost.id, reason: '垃圾广告' } });
  assert.equal(dup.status, 409, '同一对象重复举报应拒绝');

  // 越权：普通用户访问管理接口
  assert.equal((await jfetch('/api/admin/reports', { token: B.token })).status, 403);
  assert.equal((await jfetch('/api/admin/stats', { token: B.token })).status, 403);
  assert.equal((await jfetch('/api/admin/users', { token: B.token })).status, 403);
  assert.equal((await jfetch(`/api/admin/users/${A.id}/status`, { method: 'POST', token: B.token, body: { status: 'banned' } })).status, 403);
  // 未登录
  assert.equal((await jfetch('/api/admin/reports')).status, 401);

  // 管理员看到举报并隐藏动态
  const reports = await jfetch('/api/admin/reports?status=pending', { token: adminToken });
  const target = reports.data.reports.find((r) => r.targetId === pubPost.id);
  assert.ok(target, '管理员应看到该举报');
  const handled = await jfetch(`/api/admin/reports/${target.id}/handle`, { method: 'POST', token: adminToken, body: { action: 'hide_post', note: '测试隐藏' } });
  assert.equal(handled.status, 200);

  const listB = await jfetch('/api/posts', { token: B.token });
  assert.ok(!listB.data.posts.some((p) => p.id === pubPost.id), '被隐藏的动态对普通用户不可见');
  const listA = await jfetch('/api/posts', { token: A.token });
  assert.ok(listA.data.posts.some((p) => p.id === pubPost.id), '作者仍可见自己的被隐藏动态');

  // 操作日志已记录
  const logs = await jfetch('/api/admin/logs', { token: adminToken });
  assert.ok(logs.data.logs.some((l) => l.action === 'handle_report:hide_post'));
});

test('跨用户数据访问：不能编辑/删除他人动态，管理员可以删', async () => {
  const fd = new FormData();
  fd.append('title', '黑');
  fd.append('content', '黑');
  const edit = await fetch(`${BASE}/api/posts/${pubPost.id}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + B.token }, body: fd });
  assert.equal(edit.status, 403, 'B 不能编辑 A 的帖子');
  const del = await jfetch(`/api/posts/${pubPost.id}`, { method: 'DELETE', token: B.token });
  assert.equal(del.status, 403, 'B 不能删除 A 的帖子');
  const adminDel = await jfetch(`/api/posts/${draftPost.id}`, { method: 'DELETE', token: adminToken });
  assert.equal(adminDel.status, 200, '管理员可以删除');
});

test('账号状态：封禁后立即失效且无法登录', async () => {
  const st = await jfetch(`/api/admin/users/${C.id}/status`, { method: 'POST', token: adminToken, body: { status: 'banned', reason: '测试封禁' } });
  assert.equal(st.status, 200);
  const meC = await jfetch('/api/me', { token: C.token });
  // 封禁即吊销会话：要么 403，要么 token 失效返回 user:null，两者都算立即失效
  assert.ok(meC.status === 403 || meC.data.user === null, '封禁后现有 token 立即失效');
  const loginC = await jfetch('/api/auth/login', { method: 'POST', body: { username: C.user.username, password: 'pass123456' } });
  assert.equal(loginC.status, 403, '封禁后无法登录');
  // 不能封禁管理员/自己
  const selfBan = await jfetch(`/api/admin/users/${adminId}/status`, { method: 'POST', token: adminToken, body: { status: 'banned' } });
  assert.equal(selfBan.status, 400);
});

test('频控：登录接口触发 429', async () => {
  let got429 = false;
  for (let i = 0; i < 35; i++) {
    const r = await jfetch('/api/auth/login', { method: 'POST', body: { username: 'nosuchuser', password: 'x' } });
    if (r.status === 429) { got429 = true; break; }
  }
  assert.ok(got429, '连续失败登录应触发限频');
});

test('运营统计与管理员保护', async () => {
  const stats = await jfetch('/api/admin/stats?days=7', { token: adminToken });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.users.total >= 4);
  assert.ok(typeof stats.data.pendingReports === 'number');
  // 管理员不可被屏蔽
  const blkAdmin = await jfetch(`/api/users/${adminId}/block`, { method: 'POST', token: B.token });
  assert.equal(blkAdmin.status, 403);
});

test('创建者统计口径：浏览量只统计非作者查看', async () => {
  // B 打开 A 的公开新帖详情 → views 至少 1
  const np = (await jfetch('/api/posts', { method: 'POST', token: A.token, body: { board: 'chat', title: '统计口径帖' + Date.now(), content: 'x' } })).data.post;
  await jfetch('/api/posts/' + np.id, { token: B.token });
  await jfetch('/api/posts/' + np.id, { token: A.token }); // 作者查看不计
  const creator = await jfetch('/api/me/creator', { token: A.token });
  const item = creator.data.posts.find((x) => x.id === np.id);
  assert.equal(item.views, 1, 'views 应为 1（B 查看一次，作者查看不计）');
});
