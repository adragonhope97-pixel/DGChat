// 数据层：用 JSON 文件存储，零依赖、易迁移（后续可换成 SQLite/MySQL）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// 版块定义（全站固定）
const BOARDS = [
  { id: 'confession', name: '表白墙' },
  { id: 'market', name: '二手交易' },
  { id: 'lost', name: '失物招领' },
  { id: 'news', name: '校园资讯' },
  { id: 'chat', name: '树洞闲聊' },
];

const AVATAR_COLORS = [
  '#3ba772', '#4f8ef7', '#f28b3b', '#9b6bf2', '#ef5b8a',
  '#26b5c2', '#e0a63b', '#6b7ff2', '#42a68a', '#d96f5b',
];

let db = null;

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeUser(id, username, password, nickname, email, role = 'user') {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id,
    username,
    salt,
    passwordHash: hashPassword(password, salt),
    nickname,
    email: email ? String(email).toLowerCase() : null,
    role,
    avatarColor: AVATAR_COLORS[id % AVATAR_COLORS.length],
    createdAt: Date.now() - 30 * 24 * 3600e3,
  };
}

// 首次启动时预置账号：1 号为站长（管理员），其余为演示账号
function seed() {
  const users = [
    makeUser(1, 'demo', 'demo123456', 'Demo', 'demo@example.edu', 'admin'),
    makeUser(2, 'test', '123456', '测试同学', 'test@example.edu'),
    makeUser(3, 'orange', '123456', '小橘子', 'orange@example.edu'),
    makeUser(4, 'awei', '123456', '阿伟', 'awei@example.edu'),
  ];

  return {
    users,
    posts: [],
    comments: [],
    tokens: {}, // token -> userId
    seq: { post: 0, comment: 0, user: users.length },
  };
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    let raw = null;
    try {
      raw = fs.readFileSync(DATA_FILE, 'utf8');
      db = JSON.parse(raw);
    } catch (err) {
      // data.json 损坏（异常断电/磁盘错误）：隔离损坏文件，优先从最近备份恢复
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const corrupt = DATA_FILE + '.corrupt-' + stamp;
      fs.renameSync(DATA_FILE, corrupt);
      console.error('[db] data.json 解析失败，已隔离到', corrupt, '，尝试从备份恢复…');
      const bak = latestBackup();
      if (bak) {
        fs.copyFileSync(bak, DATA_FILE);
        db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.error('[db] 已从备份恢复：', bak);
      } else {
        console.error('[db] 无可用备份，只能以种子数据启动（原文件已保留在 ' + corrupt + '）');
        db = seed();
      }
    }
  } else {
    db = seed();
  }
  migrate();
  rotateDailyBackup();
  save();
}

// 最近一次可用备份（backups/ 与 migrations/ 都找，取最新）
function latestBackup() {
  const dirs = [path.join(DATA_DIR, 'backups'), path.join(DATA_DIR, 'migrations')];
  let best = null;
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(d, f);
      if (!best || fs.statSync(full).mtimeMs > fs.statSync(best).mtimeMs) best = full;
    }
  }
  return best;
}

// 每日轮转备份：每天首次启动把当前 data.json 存入 backups/，保留最近 7 份
function rotateDailyBackup() {
  if (!fs.existsSync(DATA_FILE)) return;
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const today = 'data-' + new Date().toISOString().slice(0, 10) + '.json';
  const target = path.join(dir, today);
  if (!fs.existsSync(target)) fs.copyFileSync(DATA_FILE, target);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith('data-') && f.endsWith('.json')).sort();
  while (files.length > 7) fs.rmSync(path.join(dir, files.shift()), { force: true });
}

// ---------- 2.0 数据迁移 ----------
// 可追踪：升级前把原文件完整备份到 data/migrations/，失败不覆盖原数据
function migrate() {
  const FROM = Number(db.schemaVersion || 1);
  if (FROM >= SCHEMA_VERSION) return;

  // 旧数据文件兼容：补齐私信存储
  if (!db.messages) db.messages = [];
  if (!db.seq) db.seq = {};
  if (db.seq.message === undefined) db.seq.message = 0;

  // 备份当前文件（迁移前的原始状态，可用于回滚）
  if (fs.existsSync(DATA_FILE)) {
    const bakDir = path.join(DATA_DIR, 'migrations');
    fs.mkdirSync(bakDir, { recursive: true });
    const bakName = `backup-v${FROM}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.copyFileSync(DATA_FILE, path.join(bakDir, bakName));
    console.log(`[db] 迁移 v${FROM} -> v${SCHEMA_VERSION}，原数据已备份：data/migrations/${bakName}`);
  }

  for (const u of db.users) {
    if (!Array.isArray(u.interests)) u.interests = [];
    if (!Array.isArray(u.following)) u.following = []; // 关注的人（用户 id 数组）
    if (!Array.isArray(u.blocked)) u.blocked = []; // 屏蔽的人
    if (!u.status) u.status = 'active'; // active | restricted | banned
    if (u.bio === undefined) u.bio = '';
  }
  for (const p of db.posts) {
    if (!p.visibility) p.visibility = 'public'; // public | private（仅自己可见）
    if (p.status === undefined) p.status = 'published'; // published | draft（草稿）
    if (p.hidden === undefined) p.hidden = false; // 被管理员隐藏
    if (!p.views) p.views = 0;
    if (!p.viewsOn) p.viewsOn = {}; // 按天浏览量（真实统计口径：非作者打开详情页次数）
    if (!p.likesOn) p.likesOn = {}; // 按天新增点赞
  }
  for (const c of db.comments) {
    if (c.hidden === undefined) c.hidden = false;
  }
  // 会话对象化（带创建时间，用于 30 天过期与吊销）
  for (const [tk, v] of Object.entries(db.tokens)) {
    if (typeof v === 'number') db.tokens[tk] = { u: v, t: Date.now() };
  }
  if (!db.reports) db.reports = [];
  if (!db.adminLogs) db.adminLogs = [];
  if (db.seq.report === undefined) db.seq.report = 0;
  if (db.seq.adminLog === undefined) db.seq.adminLog = 0;

  db.schemaVersion = SCHEMA_VERSION;
}

const SCHEMA_VERSION = 2;

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // 原子写：先写临时文件再 rename，异常断电不会截断 data.json
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function nextId(kind) {
  db.seq[kind] += 1;
  return db.seq[kind];
}

load();

module.exports = {
  data: db,
  BOARDS,
  AVATAR_COLORS,
  SCHEMA_VERSION,
  hashPassword,
  save,
  nextId,
};
