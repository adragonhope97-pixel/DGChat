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

  // ----- v4：2.5 校园平台结构 -----（v3 之前结构见下）
  if (Number(db.schemaVersion || 1) < 4) {
    // 站点配置（单校默认；多校仅预留 schoolId 字段，隔离未启用）
    if (!db.site) db.site = {
      name: 'DGChat', school: '', logo: '', themeColor: '',
      regPolicy: 'open', // open | emailDomain | invite | manual
      emailDomain: '', inviteCodes: [], manualApproved: [],
    };
    for (const u of db.users) {
      if (!u.verified) u.verified = null; // {school, method:'email'|'invite'|'manual', at}
      if (u.role === 'user' || u.role === 'admin') { /* 保持；新角色: moderator/auditor 由管理员授予 */ }
      if (!u.mute) u.mute = null; // {until, reason}
      if (!u.notifPrefs) u.notifPrefs = { off: [], dndStart: null, dndEnd: null }; // off: 通知类型数组
    }
    if (!db.marketItems) db.marketItems = [];
    if (!db.activities) db.activities = [];
    if (!db.activityJoins) db.activityJoins = []; // {id, activityId, userId, status: joined|waitlist, at}
    if (!db.groups) db.groups = [];
    if (!db.groupMembers) db.groupMembers = []; // {groupId, userId, role: owner|member, joinedAt}
    if (!db.ratings) db.ratings = []; // {id, itemId, raterId, sellerId, stars, comment, at}
    if (!db.anonMap) db.anonMap = []; // 匿名身份映射：仅管理员审计接口可查
    if (!db.punishments) db.punishments = []; // {id, userId, type: mute|restrict|ban, reason, until, by, at, appeal:{note,status}}
    if (!db.hotCache) db.hotCache = { at: 0, data: null };
    for (const x of db.posts) {
      if (x.poll === undefined) x.poll = null;
      if (x.kind === undefined) x.kind = 'post'; // post | help
      if (x.helpStatus === undefined) x.helpStatus = null; // open | doing | solved（kind=help）
    }
    for (const m of db.messages) if (m.groupId === undefined) m.groupId = null;
    if (db.seq.marketItem === undefined) db.seq.marketItem = 0;
    if (db.seq.activity === undefined) db.seq.activity = 0;
    if (db.seq.group === undefined) db.seq.group = 0;
    if (db.seq.rating === undefined) db.seq.rating = 0;
    if (db.seq.punishment === undefined) db.seq.punishment = 0;
  }

  // ----- v3：2.1 新结构 -----
  if (Number(db.schemaVersion || 1) < 3) {
    for (const u of db.users) {
      if (!u.settings) u.settings = {
        privateAccount: false,     // 私密账号：动态仅关注者可见，关注需审批
        dmPolicy: 'everyone',     // who can DM: everyone | following
        commentPolicy: 'everyone',// who can comment my posts: everyone | following
        searchHistory: true,      // 本地搜索历史开关
      };
      if (!Array.isArray(u.muted)) u.muted = [];        // 静音（不再看 TA 的内容）
      if (!Array.isArray(u.hiddenPosts)) u.hiddenPosts = []; // 个人隐藏的帖子
      if (!Array.isArray(u.followRequests)) u.followRequests = []; // 私密账号的关注申请
      if (!Array.isArray(u.favoriteFolders)) u.favoriteFolders = [{ id: 0, name: '默认收藏夹', createdAt: Date.now() }];
      if (!u.favMap || typeof u.favMap !== 'object') {
        // v2 迁移：帖子上的 favorites 数组 -> 个人收藏夹映射（默认收藏夹 id=0）
        u.favMap = {};
      }
    }
    // 依据帖子 favorites 建立初始映射
    for (const x of db.posts) {
      const owner = db.users.find((u) => u.id === x.userId);
      for (const uid of x.favorites || []) {
        const u = db.users.find((w) => w.id === uid);
        if (u && u.favMap[x.id] === undefined) u.favMap[x.id] = 0;
      }
      if (owner && !Array.isArray(x.topics)) x.topics = [];
      if (x.topics === undefined) x.topics = [];
    }
    for (const m of db.messages) {
      if (m.recalledAt === undefined) m.recalledAt = null;
      if (m.replyTo === undefined) m.replyTo = null;
      if (m.clientId === undefined) m.clientId = null;
    }
    for (const [tk, rec] of Object.entries(db.tokens)) {
      if (rec && typeof rec === 'object' && !rec.ua) rec.ua = '未知设备';
  }
    if (!db.notifications) db.notifications = [];
    if (db.seq.notification === undefined) db.seq.notification = 0;
  }
  if (db.seq.report === undefined) db.seq.report = 0;
  if (db.seq.adminLog === undefined) db.seq.adminLog = 0;

  db.schemaVersion = SCHEMA_VERSION;
}

const SCHEMA_VERSION = 4;

// ---------- 写队列：所有落盘串行执行，防止并发快照互相覆盖 ----------
// save() 只入队立即返回；_drain 逐任务执行（任务捕获当时数据快照引用，
// 由于 Node 单线程且任务间无 await，快照在执行时即为最新完整状态）。
let _saveQueue = [];
let _saving = false;
function save() {
  return new Promise((resolve) => {
    _saveQueue.push(resolve);
    _drain();
  });
}
function _drain() {
  if (_saving) return;
  const next = _saveQueue.shift();
  if (!next) return;
  _saving = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // 原子写 + 写后完整性校验（回读 JSON.parse）
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DATA_FILE);
    JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); // 校验
  } catch (err) {
    console.error('[db] 写盘失败（保留内存态，下次重试）:', err.message);
    // 失败时立即再排一次重试，避免队列静默丢失
    _saveQueue.unshift(next);
    _saving = false;
    setTimeout(() => _drain(), 200);
    return;
  }
  _saving = false;
  next();
  _drain();
}
// 测试/停机辅助：等待队列排空
function flush() {
  return new Promise((resolve) => {
    const tick = () => (_saveQueue.length || _saving ? setTimeout(tick, 10) : resolve());
    tick();
  });
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
  flush,
  nextId,
};
