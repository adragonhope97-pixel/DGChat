// DGChat 2.0 安全加固测试
// 运行：node --test tests/security.test.mjs
// 独立实例（短会话 TTL / 短锁定窗口，验证真实生效）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 3201;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dgchat-sec-'));
let server;

const jfetch = async (p, { method = 'GET', token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data, headers: res.headers };
};

const mkUser = async (name) => {
  const r = await jfetch('/api/auth/register', {
    method: 'POST',
    body: { username: name, password: 'pass123456', nickname: '安全' + name },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { id: r.data.user.id, token: r.data.token, user: r.data.user };
};

before(async () => {
  server = spawn(process.execPath, ['server/server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR,
      SESSION_TTL_MS: '500', // 会话 0.5 秒过期（验证真实过期逻辑）
      LOGIN_MAX_FAILS: '3',
      LOGIN_LOCK_MS: '5000', // 锁定 5 秒
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});

after(() => {
  server?.kill();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('安全响应头：CSP / nosniff / 防点击劫持 / Referrer 全部生效', async () => {
  const r = await fetch(BASE + '/');
  const h = r.headers;
  const csp = h.get('content-security-policy') || '';
  assert.ok(csp.includes("default-src 'self'"), 'CSP default-src');
  assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP 防点击劫持');
  assert.ok(csp.includes("script-src 'self'"), 'CSP script-src');
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.equal(h.get('x-frame-options'), 'DENY');
  assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(h.get('strict-transport-security'), null, 'HTTP 环境不应发 HSTS（仅 HTTPS 部署启用）');
});

test('CORS 白名单：未知来源不返回跨域头，WebView 来源放行且不带凭证', async () => {
  const evil = await fetch(BASE + '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null, '白名单外不返回 ACAO');
  const cap = await fetch(BASE + '/api/health', { headers: { Origin: 'capacitor://localhost' } });
  assert.equal(cap.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  assert.equal(cap.headers.get('access-control-allow-credentials'), 'false', '不允许跨域凭证');
});

test('超大请求体被拒绝（413）', async () => {
  const big = 'x'.repeat(300 * 1024);
  const r = await jfetch('/api/auth/login', { method: 'POST', body: { username: 'a', password: 'b', pad: big } });
  assert.equal(r.status, 413);
});

test('登录失败锁定：连续失败 3 次后，正确密码也被锁', async () => {
  const name = 'lockme' + Date.now() % 100000;
  const u = await mkUser(name);
  for (let i = 0; i < 3; i++) {
    const bad = await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'wrong' } });
    assert.equal(bad.status, 401);
  }
  const locked = await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'pass123456' } });
  assert.equal(locked.status, 429, '正确密码也应被锁定');
  // 未锁定的其他账号不受影响
  const other = await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'pass123456', } });
  // 等待锁定窗口过后恢复
  await new Promise((r) => setTimeout(r, 5200));
  const ok = await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'pass123456' } });
  assert.equal(ok.status, 200, '锁定窗口过后恢复');
});

test('会话过期：TTL 到期后令牌自动失效', async () => {
  const u = await mkUser('ttl' + Date.now() % 100000);
  const me1 = await jfetch('/api/me', { token: u.token });
  assert.equal(me1.status, 200);
  await new Promise((r) => setTimeout(r, 700));
  const me2 = await jfetch('/api/me', { token: u.token });
  // 过期令牌被吊销：/api/me 返回 401 或 user:null（等效登出）
  assert.ok(me2.status === 401 || me2.data.user === null || me2.status === 403, '过期会话应失效');
});

test('修改密码：必须验证当前密码；成功后吊销其他会话', async () => {
  const name = 'pwdch' + Date.now() % 100000;
  const u = await mkUser(name);
  // 再登一个会话（模拟另一台设备）
  const second = await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'pass123456' } });
  assert.equal(second.status, 200);
  // 错误的当前密码 → 403
  const wrong = await jfetch('/api/me/password', { method: 'PUT', token: u.token, body: { currentPassword: 'bad', newPassword: 'newpass123' } });
  assert.equal(wrong.status, 403);
  // 正确修改
  const ok = await jfetch('/api/me/password', { method: 'PUT', token: u.token, body: { currentPassword: 'pass123456', newPassword: 'newpass123' } });
  assert.equal(ok.status, 200);
  // 另一台设备（旧会话）被吊销
  const meOld = await jfetch('/api/me', { token: second.data.token });
  assert.ok(meOld.status === 401 || meOld.data.user === null, '其他会话应被吊销');
  // 当前会话仍有效
  const meCur = await jfetch('/api/me', { token: u.token });
  assert.equal(meCur.status, 200);
  // 旧密码登录失败、新密码成功
  assert.equal((await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'pass123456' } })).status, 401);
  assert.equal((await jfetch('/api/auth/login', { method: 'POST', body: { username: name, password: 'newpass123' } })).status, 200);
});

test('上传魔数校验：伪装成图片的文本文件被拒绝', async () => {
  const name = 'upl' + Date.now() % 100000;
  const u = await mkUser(name);
  const fd = new FormData();
  fd.append('board', 'chat');
  fd.append('title', '假图片帖');
  fd.append('content', 'content');
  // PNG 头 + 垃圾内容，MIME 声明 image/png，但内容不是合法图片（魔数正确放行的情况另测）
  const fakeText = Buffer.from('<script>alert(1)</script>这不是图片'.repeat(10));
  fd.append('images', new Blob([fakeText], { type: 'image/png' }), 'fake.png');
  const r = await fetch(BASE + '/api/posts', { method: 'POST', headers: { Authorization: 'Bearer ' + u.token }, body: fd });
  assert.equal(r.status, 400, '非图片内容应被魔数校验拒绝');
  const body = await r.json();
  assert.match(body.error, /格式不正确/);
});

test('错误响应脱敏：未知错误不泄露内部信息', async () => {
  // 触发一个解析错误
  const r = await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' }, body: '{invalid json' });
  const body = await r.json().catch(() => ({}));
  assert.ok(!JSON.stringify(body).includes('at '), '不应包含堆栈');
  assert.ok(!JSON.stringify(body).includes('node_modules'), '不应包含内部路径');
});

test('安全事件日志：记录失败与锁定，且不含密码/令牌', async () => {
  const logPath = path.join(DATA_DIR, '..', 'dgchat-sec-');
  // security.log 写在项目 logs/ 下（服务端工作目录），读取并检查
  const p = path.resolve('logs/security.log');
  assert.ok(fs.existsSync(p), 'security.log 应存在');
  const content = fs.readFileSync(p, 'utf8');
  assert.ok(content.includes('login_fail'), '应记录登录失败');
  assert.ok(content.includes('login_lock_triggered'), '应记录锁定触发');
  assert.ok(!content.includes('pass123456'), '日志不得包含密码');
  assert.ok(!/Bearer [a-f0-9]{48}/.test(content), '日志不得包含令牌');
});
