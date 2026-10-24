// 校园墙后端服务（REST API + 静态网页托管）
// 网页端、以后的安卓端 / iOS 端都调用同一套 /api 接口
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');

const app = express();
// 部署在反向代理之后时设置 TRUST_PROXY=1，使 req.ip 为真实客户端 IP（限流依赖它）
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || 'Campus Wall 校园墙';

// ---------- 图片上传 ----------
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) =>
      cb(null, req.user.id + '-' + Date.now() + (IMAGE_EXT[file.mimetype] || '.jpg')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('仅支持 JPG / PNG / GIF / WebP 图片'));
    }
    cb(null, true);
  },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + (IMAGE_EXT[file.mimetype] || '.jpg')),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 9 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new Error('仅支持 JPG / PNG / GIF / WebP 图片'));
    }
    cb(null, true);
  },
});

// 把上传的文件映射为可访问的 URL 列表
const fileUrls = (files) => (files || []).map((f) => '/uploads/' + f.filename);

app.use(express.json({ limit: '200kb' })); // 请求体上限，降低资源耗尽风险

// ---------- 安全响应头（helmet）：CSP 按实际资源定制，HSTS 仅在 HTTPS 部署启用 ----------
// CSP 说明：style-src 允许内联（站点大量使用 style 属性）；img 允许 data:/blob:（自定义背景）；
// script 仅同源（无内联脚本）；connect-src 同源（PWA 与页面同源；Capacitor 端从本地包加载，不走此头）。
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", 'data:', 'blob:'],
      "style-src": ["'self'", "'unsafe-inline'"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"],
      "font-src": ["'self'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": null, // 本机/局域网 HTTP 部署不能强制升级
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' }, // /uploads 图片只允许同站加载
  hsts: false, // 由下方中间件按 HTTPS 部署条件启用
  hidePoweredBy: true,
}));
app.use((req, res, next) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps || process.env.FORCE_HSTS === '1') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ---------- CORS 精确白名单（默认仅 Capacitor WebView 来源；自定义来源用 CORS_ORIGINS 环境变量） ----------
// 认证走 Authorization 头而非 Cookie，不使用跨域凭证；白名单外来源不返回 CORS 头
const CORS_EXTRA = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);
const CORS_ALLOWED = new Set([
  'capacitor://localhost', // iOS WebView
  'http://localhost', // Android WebView (androidScheme http)
  'https://localhost',
  'ionic://localhost',
  ...CORS_EXTRA,
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ALLOWED.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Credentials', 'false');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, '..', 'web')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- 工具 ----------

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    nickname: u.nickname,
    avatarColor: u.avatarColor,
    role: u.role || 'user',
    avatar: u.avatar || null,
  };
}

// 校验上传文件的真实格式（魔数），防止伪装成图片的可执行/脚本内容落盘
function verifyImageMagic(files, req) {
  for (const f of files || []) {
    let buf = Buffer.alloc(12);
    let fd;
    try {
      fd = fs.openSync(f.path, 'r');
      fs.readSync(fd, buf, 0, 12, 0);
    } catch {
      continue;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    const isWebp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
    if (!isJpeg && !isPng && !isGif && !isWebp) {
      fs.rmSync(f.path, { force: true }); // 删除伪装文件
      secLog('upload_rejected', 'fake_image ip=' + (req && req.ip));
      return '图片文件格式不正确'; // 固定文案，不透传内部信息
    }
  }
  return null;
}

// 删除旧头像文件（忽略错误）
function removeAvatarFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.rm(path.join(UPLOAD_DIR, url.replace('/uploads/', '')), { force: true }, () => {});
}

const isAdmin = (u) => !!u && u.role === 'admin';

// ---------- 会话与安全事件 ----------
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 30 * 24 * 3600e3; // 会话有效期，默认 30 天
const LOGIN_MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS) || 10; // 连续失败锁定阈值
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MS) || 15 * 60e3; // 锁定时长，默认 15 分钟

// 安全事件日志：只记录必要事实，不含密码 / 令牌 / 完整凭据
const SEC_LOG = path.join(__dirname, '..', 'logs', 'security.log');
fs.mkdirSync(path.dirname(SEC_LOG), { recursive: true });
function secLog(event, detail) {
  const line = '[' + new Date().toISOString() + '] ' + event + (detail ? ' ' + detail : '');
  try {
    fs.appendFileSync(SEC_LOG, line + '\n');
  } catch {}
  console.log('[sec]', line);
}

// ---------- 接口频率限制（express-rate-limit，标准 RateLimit-* 响应头） ----------
const mkLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: '操作太频繁，请稍后再试' },
    // 全局限流统计（可选）：validate 默认开启，部署在代理后请设 TRUST_PROXY=1
  });
const LIMITS = {
  login: mkLimiter(15 * 60e3, 30),
  register: mkLimiter(60 * 60e3, 20),
  postCreate: mkLimiter(10 * 60e3, 30),
  postList: mkLimiter(10 * 60e3, 300),
  comment: mkLimiter(60 * 60e3, 60),
  message: mkLimiter(10 * 60e3, 60),
  search: mkLimiter(10 * 60e3, 120),
  upload: mkLimiter(60 * 60e3, 10),
  report: mkLimiter(60 * 60e3, 30),
  profile: mkLimiter(60 * 60e3, 30),
  discover: mkLimiter(10 * 60e3, 120),
};

// 从 Authorization 头解析登录用户（会话超时自动失效）
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const rec = token ? db.data.tokens[token] : null;
  let userId = null;
  if (rec) {
    userId = typeof rec === 'number' ? rec : rec.u; // 兼容 v1 数字形态
    const createdAt = typeof rec === 'number' ? Date.now() : rec.t || 0;
    if (Date.now() - createdAt > SESSION_TTL_MS) {
      delete db.data.tokens[token]; // 会话过期，立即吊销
      db.save();
      userId = null;
    }
  }
  req.user = userId ? db.data.users.find((u) => u.id === userId) || null : null;
  req.token = token || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  // 账号状态：封禁/限制的用户立即失去操作能力（即使 token 还在）
  if (req.user.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });
  if (req.user.status === 'restricted') return res.status(403).json({ error: '账号已被限制使用，请联系管理员' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  if (!isAdmin(req.user)) return res.status(403).json({ error: '需要管理员权限' });
  next();
}

function boardById(id) {
  return db.BOARDS.find((b) => b.id === id) || null;
}

// 组装帖子的对外展示数据（匿名帖不暴露作者）
function postView(post, me) {
  const author = post.anonymous ? null : publicUser(db.data.users.find((u) => u.id === post.userId));
  const commentCount = db.data.comments.filter((c) => c.postId === post.id).length;
  return {
    id: post.id,
    board: post.board,
    boardName: (boardById(post.board) || {}).name || post.board,
    title: post.title,
    content: post.content,
    anonymous: !!post.anonymous,
    images: post.images || [],
    createdAt: post.createdAt,
    author,
    isMine: !!me && me.id === post.userId,
    canDelete: (!!me && (me.id === post.userId || isAdmin(me))) || false,
    likeCount: post.likes.length,
    likedByMe: !!me && post.likes.includes(me.id),
    favoriteCount: (post.favorites || []).length,
    favoritedByMe: !!me && (post.favorites || []).includes(me.id),
    commentCount,
    visibility: post.visibility || 'public',
    status: post.status || 'published',
    views: post.views || 0,
    canEdit: (!!me && me.id === post.userId) || false,
  };
}

function commentView(comment, me) {
  const author = comment.anonymous ? null : publicUser(db.data.users.find((u) => u.id === comment.userId));
  return {
    id: comment.id,
    postId: comment.postId,
    content: comment.content,
    anonymous: !!comment.anonymous,
    createdAt: comment.createdAt,
    author,
    isMine: !!me && me.id === comment.userId,
    canDelete: (!!me && (me.id === comment.userId || isAdmin(me))) || false,
    canReport: !!me && comment.userId !== me.id,
    hidden: !!comment.hidden && !(me && isAdmin(me)),
  };
}

// ---------- 2.0 隐私与权限 ----------

// 双向屏蔽判断
function blockedPair(a, b) {
  if (!a || !b) return false;
  return (a.blocked || []).includes(b.id) || (b.blocked || []).includes(a.id);
}

// 统一的动态可见性规则（列表 / 详情 / 搜索 / 推荐 / 互动全部走这里）
// - 隐藏帖（管理员处理举报）：仅作者与管理员可见
// - 草稿：仅作者与管理员可见
// - 仅自己可见：仅作者与管理员可见
// - 屏蔽：互相屏蔽的双方看不到对方发布的动态（管理员除外）
function canViewPost(post, me) {
  const author = db.data.users.find((u) => u.id === post.userId);
  if (!author) return false;
  const privileged = !!me && (isAdmin(me) || me.id === post.userId);
  if (!privileged) {
    if (post.hidden) return false;
    if (post.status === 'draft') return false;
    if (post.visibility === 'private') return false;
    if (me && blockedPair(author, me)) return false;
    // 私密账号：动态仅关注者可见
    if (author.settings && author.settings.privateAccount && !isFollower(me, author)) return false;
  }
  return true;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

// ---------- 2.1 通知中心 ----------
// 同一事件 10 分钟内去重（未读状态下不重复打扰）
function notify(userId, type, actorId, extra = {}) {
  if (!userId || userId === actorId) return;
  const recipient = db.data.users.find((u) => u.id === userId);
  const actor = db.data.users.find((u) => u.id === actorId);
  if (!recipient || !actor) return;
  if (blockedPair(recipient, actor)) return; // 屏蔽双方互不发通知
  if ((recipient.muted || []).includes(actor.id)) return; // 静音者不通知
  const window = Date.now() - 10 * 60e3;
  const dup = db.data.notifications.find(
    (n) => n.userId === userId && n.type === type && n.actorId === actorId &&
      n.postId === (extra.postId || null) && !n.readAt && n.createdAt > window
  );
  if (dup) {
    dup.createdAt = Date.now();
    return;
  }
  db.data.notifications.push({
    id: db.nextId('notification'),
    userId,
    type, // like | comment | follow | mention | dm | system
    actorId,
    postId: extra.postId || null,
    commentId: extra.commentId || null,
    text: extra.text || '',
    createdAt: Date.now(),
    readAt: null,
  });
}

// ---------- 2.1 话题规范化：#中文/字母/数字#，1-20 字，去重小写化（拉丁） ----------
function extractTopics(text) {
  const out = [];
  const re = /#([^#\s]{1,20})#/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const name = m[1].trim();
    if (!name) continue;
    const norm = /[a-z]/i.test(name) ? name.toLowerCase() : name;
    if (!out.includes(norm)) out.push(norm);
    if (out.length >= 5) break; // 每帖最多 5 个话题
  }
  return out;
}

// 私密账号：非关注者（且非本人/管理员）不可见其动态
function isFollower(viewer, author) {
  return !!viewer && (viewer.following || []).includes(author.id);
}

// ---------- 注册 / 登录 ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', LIMITS.register, (req, res) => {
  const { username, password, nickname, email } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: '用户名需为 3-20 位字母、数字或下划线' });
  }
  if (!password || password.length < 6 || password.length > 30) {
    return res.status(400).json({ error: '密码长度需为 6-30 位' });
  }
  if (db.data.users.some((u) => u.username === username)) {
    return res.status(409).json({ error: '该用户名已被注册' });
  }
  // 邮箱选填；填写后可用邮箱登录
  let emailNorm = null;
  if (email && String(email).trim()) {
    emailNorm = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(emailNorm) || emailNorm.length > 254) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    if (db.data.users.some((u) => u.email === emailNorm)) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const id = db.nextId('user');
  const user = {
    id,
    username,
    salt,
    passwordHash: db.hashPassword(password, salt),
    nickname: (nickname || username).slice(0, 20),
    email: emailNorm,
    avatarColor: db.AVATAR_COLORS[id % db.AVATAR_COLORS.length],
    createdAt: Date.now(),
    // 2.0 / 2.1 字段
    interests: [],
    following: [],
    blocked: [],
    status: 'active',
    bio: '',
    settings: { privateAccount: false, dmPolicy: 'everyone', commentPolicy: 'everyone', searchHistory: true },
    muted: [],
    hiddenPosts: [],
    followRequests: [],
    favoriteFolders: [{ id: 0, name: '默认收藏夹', createdAt: Date.now() }],
    favMap: {},
  };
  db.data.users.push(user);
  const token = crypto.randomBytes(24).toString('hex');
  db.data.tokens[token] = { u: user.id, t: Date.now() }; // 对象化：记录创建时间用于过期
  db.save();
  res.json({
    token,
    user: { ...publicUser(user), username: user.username, email: user.email },
  });
});

const loginFailures = new Map(); // username -> { count, lockUntil }
app.post('/api/auth/login', LIMITS.login, (req, res) => {
  const { username, password } = req.body || {};
  const identifier = String(username || '').trim().slice(0, 254);
  const failRec = loginFailures.get(identifier.toLowerCase());
  if (failRec && failRec.lockUntil > Date.now()) {
    secLog('login_locked', 'ip=' + req.ip);
    return res.status(429).json({ error: '失败次数过多，账号已临时锁定，请稍后再试' });
  }
  // 支持用户名或邮箱登录
  const user =
    db.data.users.find((u) => u.username === identifier) ||
    db.data.users.find((u) => u.email && u.email === identifier.toLowerCase());
  if (!user || db.hashPassword(String(password || ''), user.salt) !== user.passwordHash) {
    const rec = loginFailures.get(identifier.toLowerCase()) || { count: 0, lockUntil: 0 };
    rec.count += 1;
    if (rec.count >= LOGIN_MAX_FAILS) {
      rec.lockUntil = Date.now() + LOGIN_LOCK_MS;
      rec.count = 0;
      const uh = crypto.createHash('sha256').update(identifier.toLowerCase()).digest('hex').slice(0, 12);
      secLog('login_lock_triggered', 'user_hash=' + uh + ' ip=' + req.ip);
    }
    loginFailures.set(identifier.toLowerCase(), rec);
    secLog('login_fail', 'ip=' + req.ip);
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  loginFailures.delete(identifier.toLowerCase());
  if (user.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });
  if (user.status === 'restricted') return res.status(403).json({ error: '账号已被限制使用，请联系管理员' });
  const token = crypto.randomBytes(24).toString('hex');
  db.data.tokens[token] = { u: user.id, t: Date.now() }; // 对象化：记录创建时间用于过期
  db.save();
  res.json({
    token,
    user: { ...publicUser(user), username: user.username, email: user.email },
  });
});

app.post('/api/auth/logout', auth, (req, res) => {
  if (req.token) {
    delete db.data.tokens[req.token];
    db.save();
  }
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  if (!req.user) return res.json({ user: null });
  // 被封禁/限制的账号让客户端清掉本地登录态
  if (req.user.status === 'banned') return res.status(403).json({ error: '账号已被封禁' });
  if (req.user.status === 'restricted') return res.status(403).json({ error: '账号已被限制使用，请联系管理员' });
  res.json({
    user: {
      ...publicUser(req.user),
      username: req.user.username,
      email: req.user.email || null,
      bio: req.user.bio || '',
      interests: req.user.interests || [],
      status: req.user.status || 'active',
    },
  });
});

// 修改密码：必须验证当前密码；成功后吊销除当前会话外的全部会话
app.put('/api/me/password', auth, requireAuth, mkLimiter(60 * 60e3, 5), (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (db.hashPassword(String(currentPassword || ''), req.user.salt) !== req.user.passwordHash) {
    secLog('password_change_fail', 'uid=' + req.user.id);
    return res.status(403).json({ error: '当前密码不正确' });
  }
  if (!newPassword || String(newPassword).length < 6 || String(newPassword).length > 30) {
    return res.status(400).json({ error: '新密码长度需为 6-30 位' });
  }
  req.user.salt = crypto.randomBytes(16).toString('hex');
  req.user.passwordHash = db.hashPassword(String(newPassword), req.user.salt);
  // 吊销其他会话（保留当前登录）
  for (const [tk, rec] of Object.entries(db.data.tokens)) {
    if ((typeof rec === 'number' ? rec : rec.u) === req.user.id && tk !== req.token) delete db.data.tokens[tk];
  }
  db.save();
  secLog('password_changed', 'uid=' + req.user.id);
  res.json({ ok: true });
});
// ---------- 版块 ----------

app.get('/api/boards', (req, res) => {
  res.json({ boards: db.BOARDS });
});

// ---------- 帖子 ----------

app.get('/api/posts', auth, LIMITS.postList, (req, res) => {
  const { board, q, sort, mine, liked, fav } = req.query;
  if ((mine === '1' || liked === '1' || fav === '1') && !req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  let posts = db.data.posts.slice().filter((p) => canViewPost(p, req.user));

  if (mine === '1') {
    posts = posts.filter((p) => p.userId === req.user.id);
  } else if (liked === '1') {
    posts = posts.filter((p) => p.likes.includes(req.user.id));
  } else if (fav === '1') {
    posts = posts.filter((p) => (p.favorites || []).includes(req.user.id));
  } else if (board && board !== 'all') {
    if (!boardById(board)) return res.status(400).json({ error: '版块不存在' });
    posts = posts.filter((p) => p.board === board);
  }
  if (q) {
    const kw = String(q).trim().toLowerCase();
    if (kw) {
      posts = posts.filter(
        (p) => p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw)
      );
    }
  }

  let finalPosts = posts;
  if (mine !== '1' && liked !== '1' && fav !== '1') {
    finalPosts = filterPersonal(posts, req.user); // 静音/个人隐藏只影响公共视图
  }
  const views = finalPosts.map((p) => postView(p, req.user));
  if (sort === 'hot') {
    views.sort(
      (a, b) =>
        b.likeCount * 3 + b.commentCount * 2 - (a.likeCount * 3 + a.commentCount * 2) ||
        b.createdAt - a.createdAt
    );
  } else {
    views.sort((a, b) => b.createdAt - a.createdAt); // 默认最新
  }
  res.json({ posts: views.slice(0, 200) });
});

app.get('/api/posts/:id', auth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) {
    return res.status(404).json({ error: '帖子不存在或已被删除' });
  }
  // 浏览量：仅统计非作者打开已发布帖的详情（草稿/自己查看不计）
  if (post.status === 'published' && (!req.user || req.user.id !== post.userId)) {
    post.views = (post.views || 0) + 1;
    const tk = todayKey();
    post.viewsOn[tk] = (post.viewsOn[tk] || 0) + 1;
    db.save();
  }
  const isAdminUser = isAdmin(req.user);
  const comments = db.data.comments
    .filter((c) => c.postId === post.id && (isAdminUser || !c.hidden))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => commentView(c, req.user));
  res.json({ post: postView(post, req.user), comments });
});

app.post('/api/posts', auth, requireAuth, LIMITS.postCreate, upload.array('images', 9), (req, res) => {
  const { board, title, content } = req.body;
  const anonymous = req.body.anonymous === 'true' || req.body.anonymous === true;
  const visibility = req.body.visibility === 'private' ? 'private' : 'public';
  const draft = req.body.draft === 'true' || req.body.draft === true;
  if (!boardById(board)) return res.status(400).json({ error: '请选择正确的版块' });
  if (!title || !title.trim()) return res.status(400).json({ error: '请填写标题' });
  if (title.length > 60) return res.status(400).json({ error: '标题最多 60 字' });
  if (!content || !content.trim()) return res.status(400).json({ error: '请填写正文内容' });
  if (content.length > 5000) return res.status(400).json({ error: '正文最多 5000 字' });

  const badImage = verifyImageMagic(req.files, req);
  if (badImage) return res.status(400).json({ error: badImage });
  const post = {
    id: db.nextId('post'),
    topics: extractTopics(title + ' ' + content),
    userId: req.user.id,
    board,
    title: title.trim(),
    content: content.trim(),
    anonymous,
    visibility,
    status: draft ? 'draft' : 'published',
    images: fileUrls(req.files),
    likes: [],
    favorites: [],
    likesOn: {},
    viewsOn: {},
    views: 0,
    hidden: false,
    createdAt: Date.now(),
  };
  db.data.posts.push(post);
  db.save();
  res.json({ post: postView(post, req.user) });
});

// 编辑自己的帖子（标题 + 正文 + 图片）
app.put('/api/posts/:id', auth, requireAuth, upload.array('images', 9), (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: '只能编辑自己的帖子' });

  const { title, content } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: '请填写标题' });
  if (title.length > 60) return res.status(400).json({ error: '标题最多 60 字' });
  if (!content || !content.trim()) return res.status(400).json({ error: '请填写正文内容' });
  if (content.length > 5000) return res.status(400).json({ error: '正文最多 5000 字' });
  if (req.body.visibility !== undefined && !['public', 'private'].includes(req.body.visibility)) {
    return res.status(400).json({ error: '可见性参数不正确' });
  }

  // 保留的旧图 + 新上传的图（按选择顺序）
  let kept = [];
  try {
    kept = JSON.parse(req.body.existingImages || '[]');
  } catch {}
  if (!Array.isArray(kept)) kept = [];
  kept = kept.filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
  const badImage = verifyImageMagic(req.files, req);
  if (badImage) return res.status(400).json({ error: badImage });
  post.title = title.trim();
  post.content = content.trim();
  post.topics = extractTopics(post.title + ' ' + post.content);
  post.images = [...kept, ...fileUrls(req.files)].slice(0, 9);
  if (req.body.visibility !== undefined) post.visibility = req.body.visibility;
  if (req.body.publish === 'true' || req.body.publish === true) post.status = 'published';
  db.save();
  res.json({ post: postView(post, req.user) });
});

app.delete('/api/posts/:id', auth, requireAuth, (req, res) => {
  const idx = db.data.posts.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '帖子不存在' });
  // 作者本人或管理员可删除
  if (db.data.posts[idx].userId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: '只能删除自己的帖子' });
  }
  const postId = db.data.posts[idx].id;
  const ownerId = db.data.posts[idx].userId;
  // 清理图片文件
  for (const img of db.data.posts[idx].images || []) {
    if (img.startsWith('/uploads/')) fs.rm(path.join(UPLOAD_DIR, img.replace('/uploads/', '')), { force: true }, () => {});
  }
  db.data.posts.splice(idx, 1);
  db.data.comments = db.data.comments.filter((c) => c.postId !== postId);
  for (const u of db.data.users) if (u.favMap) delete u.favMap[postId]; // 收藏映射清理
  db.data.notifications = db.data.notifications.filter((n) => n.postId !== postId);
  secLog('post_deleted', 'postId=' + postId + ' ownerId=' + ownerId + ' by=' + req.user.id);
  db.save();
  res.json({ ok: true });
});

// 点赞 / 取消点赞（切换）
app.post('/api/posts/:id/like', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) return res.status(404).json({ error: '帖子不存在或已被删除' });
  const i = post.likes.indexOf(req.user.id);
  const tk = todayKey();
  if (i === -1) {
    post.likes.push(req.user.id);
    post.likesOn[tk] = (post.likesOn[tk] || 0) + 1;
    notify(post.userId, 'like', req.user.id, { postId: post.id });
  } else {
    post.likes.splice(i, 1);
    if (post.likesOn[tk]) post.likesOn[tk] -= 1;
  }
  db.save();
  res.json({ likeCount: post.likes.length, likedByMe: i === -1 });
});

// 收藏 / 取消收藏（切换）
// 收藏：POST 加入指定收藏夹（幂等，可换文件夹），DELETE 移出
app.post('/api/posts/:id/favorite', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) return res.status(404).json({ error: '帖子不存在或已被删除' });
  if (!post.favorites) post.favorites = [];
  const folders = req.user.favoriteFolders;
  let folderId = Number(req.body && req.body.folderId) || 0;
  if (!folders.some((f) => f.id === folderId)) folderId = 0;
  if (!req.user.favMap[post.id]) {
    req.user.favMap[post.id] = folderId;
    if (!post.favorites.includes(req.user.id)) post.favorites.push(req.user.id);
  } else {
    req.user.favMap[post.id] = folderId; // 已收藏：仅移动到目标文件夹
  }
  db.save();
  res.json({ favoriteCount: post.favorites.length, favoritedByMe: true, folderId: req.user.favMap[post.id] });
});
app.delete('/api/posts/:id/favorite', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
  delete req.user.favMap[post.id];
  const i = (post.favorites || []).indexOf(req.user.id);
  if (i !== -1) post.favorites.splice(i, 1);
  db.save();
  res.json({ favoriteCount: (post.favorites || []).length, favoritedByMe: false });
});

// ---------- 评论 ----------

app.post('/api/posts/:id/comments', auth, requireAuth, LIMITS.comment, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) return res.status(404).json({ error: '帖子不存在或已被删除' });
  const author = db.data.users.find((u) => u.id === post.userId);
  const cp = author && author.settings && author.settings.commentPolicy;
  if (cp === 'following' && post.userId !== req.user.id && !isAdmin(req.user) && !isFollower(req.user, author)) {
    return res.status(403).json({ error: '作者仅允许关注者评论' });
  }
  const { content, anonymous } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: '评论内容不能为空' });
  if (content.length > 2000) return res.status(400).json({ error: '评论最多 2000 字' });

  const comment = {
    id: db.nextId('comment'),
    postId: post.id,
    userId: req.user.id,
    content: content.trim(),
    anonymous: !!anonymous,
    createdAt: Date.now(),
  };
  db.data.comments.push(comment);
  db.save();
  notify(post.userId, 'comment', req.user.id, { postId: post.id, commentId: comment.id });
  for (const t of extractTopics(comment.content)) {} // 评论话题不入库，仅防误用
  // @提及：通知被提及者（存在、非本人、未屏蔽）
  for (const mm of String(comment.content || '').matchAll(/@([a-zA-Z0-9_]{3,20})/g)) {
    const mentioned = db.data.users.find((u) => u.username === mm[1]);
    if (mentioned) notify(mentioned.id, 'mention', req.user.id, { postId: post.id, commentId: comment.id });
  }
  res.json({ comment: commentView(comment, req.user) });
});

app.delete('/api/comments/:id', auth, requireAuth, (req, res) => {
  const idx = db.data.comments.findIndex((c) => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '评论不存在' });
  // 作者本人或管理员可删除
  if (db.data.comments[idx].userId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: '只能删除自己的评论' });
  }
  db.data.comments.splice(idx, 1);
  db.save();
  res.json({ ok: true });
});

// ---------- 个人资料统计 ----------

app.get('/api/me/stats', auth, requireAuth, (req, res) => {
  const myPosts = db.data.posts.filter((p) => p.userId === req.user.id);
  res.json({
    posts: myPosts.filter((p) => p.status === 'published').length,
    drafts: myPosts.filter((p) => p.status === 'draft').length,
    likesReceived: myPosts.reduce((s, p) => s + p.likes.length, 0),
    favorites: db.data.posts.filter((p) => (p.favorites || []).includes(req.user.id)).length,
    followers: db.data.users.filter((u) => (u.following || []).includes(req.user.id)).length,
    following: (req.user.following || []).length,
  });
});

// 上传 / 更换头像（正方形压缩由前端完成，服务端再校验类型与大小）
app.post('/api/me/avatar', auth, requireAuth, LIMITS.upload, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到图片' });
  const badImage = verifyImageMagic([req.file], req);
  if (badImage) return res.status(400).json({ error: badImage });
  removeAvatarFile(req.user.avatar);
  req.user.avatar = '/uploads/avatars/' + req.file.filename;
  db.save();
  res.json({ user: { ...publicUser(req.user), username: req.user.username, email: req.user.email } });
});

// 移除头像（恢复默认彩色首字）
app.delete('/api/me/avatar', auth, requireAuth, (req, res) => {
  removeAvatarFile(req.user.avatar);
  req.user.avatar = null;
  db.save();
  res.json({ ok: true });
});

app.get('/api/me/unread', auth, requireAuth, (req, res) => {
  res.json({ unread: db.data.messages.filter((m) => m.toId === req.user.id && !m.readAt).length });
});

// ---------- 私信 ----------

// 会话列表（按最近一条消息排序，含未读数）
app.get('/api/conversations', auth, requireAuth, (req, res) => {
  const myId = req.user.id;
  const byPartner = new Map();
  for (const m of db.data.messages) {
    if (m.fromId !== myId && m.toId !== myId) continue;
    if (m.fromId === myId && m.toId === myId) continue; // 备忘录单独渲染
    const partnerId = m.fromId === myId ? m.toId : m.fromId;
    const known = byPartner.get(partnerId);
    if (!known || known.createdAt < m.createdAt) byPartner.set(partnerId, m);
  }
  const list = [...byPartner.entries()]
    .map(([partnerId, last]) => ({
      user: publicUser(db.data.users.find((u) => u.id === partnerId)),
      lastMessage: {
        content: last.content,
        createdAt: last.createdAt,
        fromMe: last.fromId === myId,
      },
      unread: db.data.messages.filter((m) => m.fromId === partnerId && m.toId === myId && !m.readAt).length,
    }))
    .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
  res.json({ conversations: list });
});

// 与某用户的完整消息记录（同时把对方发来的标记为已读）
app.get('/api/conversations/:userId', auth, requireAuth, (req, res) => {
  const partnerId = Number(req.params.userId);
  const partner = db.data.users.find((u) => u.id === partnerId);
  if (!partner) return res.status(404).json({ error: '用户不存在' });
  let changed = false;
  const msgs = db.data.messages
    .filter(
      (m) =>
        (m.fromId === req.user.id && m.toId === partnerId) ||
        (m.fromId === partnerId && m.toId === req.user.id)
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((m) => {
      if (m.toId === req.user.id && !m.readAt) {
        m.readAt = Date.now();
        changed = true;
      }
      return {
        id: m.id,
        content: m.recalledAt ? null : m.content,
        recalled: !!m.recalledAt,
        replyTo: m.replyTo || null,
        createdAt: m.createdAt,
        fromMe: m.fromId === req.user.id,
      };
    });
  if (changed) db.save();
  res.json({ user: publicUser(partner), messages: msgs });
});

// 发送私信
app.post('/api/messages', auth, requireAuth, LIMITS.message, (req, res) => {
  const { toUserId, content } = req.body || {};
  const partner = db.data.users.find((u) => u.id === Number(toUserId));
  if (!partner) return res.status(404).json({ error: '用户不存在' });
  // 发给自己 = 备忘录（单方面对话，只有自己可见）
  if (partner.id !== req.user.id && blockedPair(partner, req.user)) {
    return res.status(403).json({ error: '无法向该用户发送私信' });
  }
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' });
  if (content.length > 2000) return res.status(400).json({ error: '内容最多 2000 字' });

  // 私信策略：对方仅允许关注者私信
  if (partner.id !== req.user.id && partner.settings && partner.settings.dmPolicy === 'following') {
    if (!(partner.following || []).includes(req.user.id)) {
      return res.status(403).json({ error: '对方仅接收关注者的私信' });
    }
  }
  // 幂等：同 clientId 24h 内不重复落库（弱网重试防重复发送）
  const clientId = String(req.body.clientId || '').slice(0, 64) || null;
  if (clientId) {
    const dup = db.data.messages.find(
      (m) => m.fromId === req.user.id && m.clientId === clientId && Date.now() - m.createdAt < 24 * 3600e3
    );
    if (dup) {
      return res.json({ message: { id: dup.id, content: dup.content, createdAt: dup.createdAt, fromMe: true }, deduped: true });
    }
  }
  // 引用：校验引用消息必须是双方会话内的消息
  let replyTo = null;
  if (req.body.replyTo) {
    const src = db.data.messages.find((m) => m.id === Number(req.body.replyTo));
    const participants = src && [src.fromId, src.toId];
    if (src && participants.includes(req.user.id) && participants.includes(partner.id)) {
      replyTo = { id: src.id, preview: src.content.slice(0, 50), fromMe: src.fromId === req.user.id };
    }
  }
  const msg = {
    id: db.nextId('message'),
    fromId: req.user.id,
    toId: partner.id,
    content: content.trim(),
    createdAt: Date.now(),
    readAt: null,
    recalledAt: null,
    replyTo,
    clientId,
  };
  db.data.messages.push(msg);
  db.save();
  if (partner.id !== req.user.id) notify(partner.id, 'dm', req.user.id, { text: '' }); // 通知不含消息内容
  res.json({ message: { id: msg.id, content: msg.content, createdAt: msg.createdAt, fromMe: true, replyTo } });
});
// 消息撤回：仅发送者本人，5 分钟内
app.post('/api/messages/:id/recall', auth, requireAuth, (req, res) => {
  const m = db.data.messages.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).json({ error: '消息不存在' });
  if (m.fromId !== req.user.id) return res.status(403).json({ error: '只能撤回自己的消息' });
  if (m.recalledAt) return res.status(409).json({ error: '该消息已撤回' });
  if (Date.now() - m.createdAt > 5 * 60e3) return res.status(400).json({ error: '超过 5 分钟无法撤回' });
  m.recalledAt = Date.now();
  m.content = '';
  db.save();
  res.json({ ok: true });
});
// 会话内消息搜索（仅参与者可见）
app.get('/api/messages/search', auth, requireAuth, LIMITS.search, (req, res) => {
  const kw = String(req.query.q || '').trim().toLowerCase();
  if (!kw) return res.json({ results: [] });
  const seen = new Map();
  for (const m of db.data.messages) {
    if (m.recalledAt) continue;
    const involved = m.fromId === req.user.id || m.toId === req.user.id;
    if (!involved || !m.content.toLowerCase().includes(kw)) continue;
    const partnerId = m.fromId === req.user.id ? m.toId : m.fromId;
    if (!seen.has(partnerId)) {
      seen.set(partnerId, { partner: publicUser(db.data.users.find((u) => u.id === partnerId)), hits: [] });
    }
    const entry = seen.get(partnerId);
    if (entry.hits.length < 5) {
      entry.hits.push({ id: m.id, content: m.content, createdAt: m.createdAt, fromMe: m.fromId === req.user.id });
    }
  }
  res.json({ results: [...seen.values()].slice(0, 20) });
});


// ========== 2.0 发现与交友 ==========

// 个人资料更新（昵称 / 简介 / 兴趣标签）
app.put('/api/me/profile', auth, requireAuth, LIMITS.profile, (req, res) => {
  const { nickname, bio, interests } = req.body || {};
  if (nickname !== undefined) {
    const n = String(nickname).trim();
    if (!n || n.length > 20) return res.status(400).json({ error: '昵称需为 1-20 个字符' });
    req.user.nickname = n;
  }
  if (bio !== undefined) {
    const b = String(bio).trim();
    if (b.length > 100) return res.status(400).json({ error: '简介最多 100 字' });
    req.user.bio = b;
  }
  if (interests !== undefined) {
    if (!Array.isArray(interests)) return res.status(400).json({ error: '兴趣格式不正确' });
    const clean = [...new Set(interests.map((i) => String(i).trim()).filter(Boolean))];
    if (clean.length > 8) return res.status(400).json({ error: '兴趣标签最多 8 个' });
    if (clean.some((i) => i.length > 12)) return res.status(400).json({ error: '单个兴趣标签最多 12 个字' });
    req.user.interests = clean;
  }
  db.save();
  res.json({ user: { ...publicUser(req.user), username: req.user.username, email: req.user.email || null } });
});

// 用户公开资料
app.get('/api/users/:id', auth, (req, res) => {
  const u = db.data.users.find((x) => x.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const isMe = !!req.user && req.user.id === u.id;
  if (!isMe && req.user && blockedPair(u, req.user)) {
    return res.status(404).json({ error: '用户不存在' }); // 屏蔽后互相不可见，不泄露存在性
  }
  const myPublicPosts = db.data.posts.filter(
    (x) => x.userId === u.id && x.status === 'published' && x.visibility === 'public' && !x.hidden
  );
  res.json({
    user: {
      ...publicUser(u),
      username: u.username,
      bio: u.bio || '',
      interests: u.interests || [],
      followerCount: db.data.users.filter((x) => (x.following || []).includes(u.id)).length,
      followingCount: (u.following || []).length,
      postCount: myPublicPosts.length,
      isMe,
      isFollowing: !!req.user && (req.user.following || []).includes(u.id),
    },
  });
});

// 用户搜索：用户名 / 昵称 / 兴趣（排除屏蔽与封禁）
app.get('/api/discover/users', auth, requireAuth, LIMITS.search, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const interest = String(req.query.interest || '').trim().toLowerCase();
  const list = db.data.users
    .filter((u) => {
      if (u.id === req.user.id) return false;
      if (u.status === 'banned') return false;
      if (blockedPair(u, req.user)) return false;
      if (q && !(u.username.toLowerCase().includes(q) || u.nickname.toLowerCase().includes(q))) return false;
      if (interest && !(u.interests || []).some((i) => i.toLowerCase().includes(interest))) return false;
      return true;
    })
    .slice(0, 50)
    .map((u) => {
      const shared = (u.interests || []).filter((i) => (req.user.interests || []).includes(i));
      return {
        ...publicUser(u),
        bio: u.bio || '',
        interests: u.interests || [],
        followerCount: db.data.users.filter((x) => (x.following || []).includes(u.id)).length,
        postCount: db.data.posts.filter((x) => x.userId === u.id && x.status === 'published' && !x.hidden).length,
        isFollowing: (req.user.following || []).includes(u.id),
        sharedInterests: shared,
      };
    });
  // 有共同兴趣的排前面，其次按粉丝数
  list.sort((a, b) => b.sharedInterests.length - a.sharedInterests.length || b.followerCount - a.followerCount);
  res.json({ users: list });
});

// 用户推荐：共同兴趣 + 活跃度（简单稳定的规则，不引入复杂服务）
app.get('/api/discover/recommendations', auth, requireAuth, LIMITS.discover, (req, res) => {
  const scored = db.data.users
    .filter((u) => {
      if (u.id === req.user.id) return false;
      if (u.status === 'banned') return false;
      if (blockedPair(u, req.user)) return false;
      if ((req.user.following || []).includes(u.id)) return false; // 已关注不再推荐
      return true;
    })
    .map((u) => {
      const shared = (u.interests || []).filter((i) => (req.user.interests || []).includes(i));
      const postCount = db.data.posts.filter((x) => x.userId === u.id && x.status === 'published' && !x.hidden).length;
      const commentCount = db.data.comments.filter((c) => c.userId === u.id).length;
      const followerCount = db.data.users.filter((x) => (x.following || []).includes(u.id)).length;
      const score = shared.length * 5 + Math.min(postCount, 10) + Math.min(commentCount, 10) * 0.5 + followerCount * 0.5;
      let reason = '活跃用户';
      if (shared.length > 0) reason = '兴趣相投 · ' + shared.slice(0, 2).join('、');
      else if (postCount >= 3) reason = '活跃创作者';
      else if (followerCount >= 2) reason = '热门用户';
      return { ...publicUser(u), bio: u.bio || '', interests: u.interests || [], sharedInterests: shared, reason, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  res.json({ users: scored });
});

// 关注 / 取关
app.post('/api/users/:id/follow', auth, requireAuth, (req, res) => {
  const target = db.data.users.find((u) => u.id === Number(req.params.id));
  if (!target || target.status === 'banned') return res.status(404).json({ error: '用户不存在' });
  if (target.id === req.user.id) return res.status(400).json({ error: '不能关注自己' });
  if (blockedPair(target, req.user)) return res.status(403).json({ error: '无法关注该用户' });
  if ((req.user.following || []).includes(target.id)) return res.json({ ok: true, following: true });
  // 私密账号：进入审批队列，不直接建立关注
  if (target.settings && target.settings.privateAccount) {
    if (!target.followRequests.includes(req.user.id)) {
      target.followRequests.push(req.user.id);
      db.save();
    }
    return res.json({ ok: true, following: false, pending: true });
  }
  req.user.following.push(target.id);
  notify(target.id, 'follow', req.user.id);
  db.save();
  res.json({ ok: true, following: true });
});
// 私密账号的关注申请：列表 / 同意 / 拒绝
app.get('/api/me/follow-requests', auth, requireAuth, (req, res) => {
  const list = (req.user.followRequests || []).map((id) => publicUser(db.data.users.find((u) => u.id === id))).filter(Boolean);
  res.json({ users: list });
});
app.post('/api/me/follow-requests/:id/approve', auth, requireAuth, (req, res) => {
  const rid = Number(req.params.id);
  if (!(req.user.followRequests || []).includes(rid)) return res.status(404).json({ error: '申请不存在' });
  req.user.followRequests = req.user.followRequests.filter((x) => x !== rid);
  const requester = db.data.users.find((u) => u.id === rid);
  if (requester && !requester.following.includes(req.user.id)) requester.following.push(req.user.id);
  if (requester) notify(req.user.id, 'follow', rid);
  db.save();
  res.json({ ok: true });
});
app.post('/api/me/follow-requests/:id/decline', auth, requireAuth, (req, res) => {
  const rid = Number(req.params.id);
  req.user.followRequests = (req.user.followRequests || []).filter((x) => x !== rid);
  db.save();
  res.json({ ok: true });
});
app.delete('/api/users/:id/follow', auth, requireAuth, (req, res) => {
  const target = db.data.users.find((u) => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: '用户不存在' });
  req.user.following = (req.user.following || []).filter((id) => id !== target.id);
  db.save();
  res.json({ ok: true, following: false });
});

// 我的关注 / 粉丝列表
app.get('/api/me/following', auth, requireAuth, (req, res) => {
  const list = (req.user.following || [])
    .map((id) => db.data.users.find((u) => u.id === id))
    .filter((u) => u && u.status !== 'banned')
    .map((u) => ({
      ...publicUser(u),
      isFollowing: true,
      followerCount: db.data.users.filter((x) => (x.following || []).includes(u.id)).length,
    }));
  res.json({ users: list });
});
app.get('/api/me/followers', auth, requireAuth, (req, res) => {
  const list = db.data.users
    .filter((u) => (u.following || []).includes(req.user.id) && u.status !== 'banned' && !blockedPair(u, req.user))
    .map((u) => ({
      ...publicUser(u),
      isFollowing: (req.user.following || []).includes(u.id),
      followerCount: db.data.users.filter((x) => (x.following || []).includes(u.id)).length,
    }));
  res.json({ users: list });
});

// ========== 2.0 屏蔽 ==========

app.post('/api/users/:id/block', auth, requireAuth, (req, res) => {
  const target = db.data.users.find((u) => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.id === req.user.id) return res.status(400).json({ error: '不能屏蔽自己' });
  if (isAdmin(target)) return res.status(403).json({ error: '不能屏蔽管理员' });
  if (!req.user.blocked.includes(target.id)) {
    req.user.blocked.push(target.id);
    // 屏蔽即解除双方关注
    req.user.following = (req.user.following || []).filter((id) => id !== target.id);
    target.following = (target.following || []).filter((id) => id !== req.user.id);
    db.save();
  }
  res.json({ ok: true, blocked: true });
});
app.delete('/api/users/:id/block', auth, requireAuth, (req, res) => {
  const target = db.data.users.find((u) => u.id === Number(req.params.id));
  if (!target) return res.status(404).json({ error: '用户不存在' });
  req.user.blocked = (req.user.blocked || []).filter((id) => id !== target.id);
  db.save();
  res.json({ ok: true, blocked: false });
});
app.get('/api/me/blocked', auth, requireAuth, (req, res) => {
  const list = (req.user.blocked || [])
    .map((id) => db.data.users.find((u) => u.id === id))
    .filter(Boolean)
    .map(publicUser);
  res.json({ users: list });
});

// ========== 2.0 发现：最新 / 热门动态 ==========

app.get('/api/discover/latest', auth, (req, res) => {
  const posts = db.data.posts
    .filter((x) => x.status === 'published' && x.visibility === 'public' && !x.hidden)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
  res.json({ posts: posts.map((x) => postView(x, req.user)) });
});

// 热门：真实互动数据 = 点赞*3 + 评论*2 + 近7天浏览*0.1（近7天无动态时回退全期）
app.get('/api/discover/hot', auth, (req, res) => {
  const cutoff = Date.now() - 7 * 24 * 3600e3;
  const publicOk = (x) => x.status === 'published' && x.visibility === 'public' && !x.hidden;
  const recent = db.data.posts.filter((x) => publicOk(x) && x.createdAt > cutoff);
  const pool = recent.length ? recent : db.data.posts.filter(publicOk);
  const views7 = (x) => {
    let sum = 0;
    for (const [d, n] of Object.entries(x.viewsOn || {})) {
      if (new Date(d + 'T00:00:00Z').getTime() > cutoff) sum += n;
    }
    return sum;
  };
  const ranked = pool
    .map((x) => ({
      x,
      score: x.likes.length * 3 + db.data.comments.filter((c) => c.postId === x.id).length * 2 + views7(x) * 0.1,
    }))
    .sort((a, b) => b.score - a.score || b.x.createdAt - a.x.createdAt)
    .slice(0, 50);
  res.json({ posts: ranked.map((r) => postView(r.x, req.user)) });
});

// ========== 2.0 举报 ==========

app.post('/api/reports', auth, requireAuth, LIMITS.report, (req, res) => {
  const { targetType, targetId, reason, detail } = req.body || {};
  if (!['post', 'comment', 'user'].includes(targetType)) {
    return res.status(400).json({ error: '举报对象类型不正确' });
  }
  const rid = Number(targetId);
  let exists = null;
  if (targetType === 'post') exists = db.data.posts.find((x) => x.id === rid);
  if (targetType === 'comment') exists = db.data.comments.find((x) => x.id === rid);
  if (targetType === 'user') exists = db.data.users.find((x) => x.id === rid);
  if (!exists) return res.status(404).json({ error: '举报对象不存在' });
  if (!reason || String(reason).trim().length === 0) return res.status(400).json({ error: '请选择举报原因' });
  if (String(reason).length > 100 || String(detail || '').length > 500) {
    return res.status(400).json({ error: '举报内容过长' });
  }
  const dup = db.data.reports.find(
    (r) => r.reporterId === req.user.id && r.targetType === targetType && r.targetId === rid && r.status === 'pending'
  );
  if (dup) return res.status(409).json({ error: '你已举报过该内容，请等待管理员处理' });
  const report = {
    id: db.nextId('report'),
    targetType,
    targetId: rid,
    reporterId: req.user.id,
    reason: String(reason).trim(),
    detail: String(detail || '').trim(),
    status: 'pending', // pending | resolved | dismissed
    createdAt: Date.now(),
    handledBy: null,
    handledAt: null,
    handleNote: '',
    action: '',
  };
  db.data.reports.push(report);
  db.save();
  res.json({ ok: true, reportId: report.id });
});

// ========== 2.0 创作者中心 ==========

// 我的动态统计（口径：views=非作者打开详情页次数；likes/comments 为累计值；趋势为按天新增）
app.get('/api/me/creator', auth, requireAuth, (req, res) => {
  const mine = db.data.posts.filter((x) => x.userId === req.user.id);
  const published = mine.filter((x) => x.status === 'published');
  const statsFor = (x) => ({
    id: x.id,
    title: x.title,
    board: x.board,
    boardName: (boardById(x.board) || {}).name || x.board,
    status: x.status,
    visibility: x.visibility,
    hidden: !!x.hidden,
    createdAt: x.createdAt,
    views: x.views || 0,
    likes: x.likes.length,
    comments: db.data.comments.filter((c) => c.postId === x.id && !c.hidden).length,
    favorites: (x.favorites || []).length,
  });
  const totals = {
    views: published.reduce((sum, x) => sum + (x.views || 0), 0),
    likes: published.reduce((sum, x) => sum + x.likes.length, 0),
    comments: published.reduce((sum, x) => sum + db.data.comments.filter((c) => c.postId === x.id && !c.hidden).length, 0),
  };
  // 近 7 天趋势（真实数据：浏览/点赞按天累计差值，评论按评论时间）
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600e3).toISOString().slice(0, 10);
    trend.push({
      date: d,
      views: published.reduce((sum, x) => sum + ((x.viewsOn || {})[d] || 0), 0),
      likes: published.reduce((sum, x) => sum + ((x.likesOn || {})[d] || 0), 0),
      comments: db.data.comments.filter((c) => {
        if (c.hidden) return false;
        const post = db.data.posts.find((pp) => pp.id === c.postId);
        return post && post.userId === req.user.id && new Date(c.createdAt).toISOString().slice(0, 10) === d;
      }).length,
    });
  }
  res.json({
    totals,
    trend,
    drafts: mine.filter((x) => x.status === 'draft').sort((a, b) => b.createdAt - a.createdAt).map(statsFor),
    posts: published.sort((a, b) => b.createdAt - a.createdAt).map(statsFor),
  });
});

// ========== 2.0 管理后台 ==========

function adminLog(admin, action, targetType, targetId, note) {
  db.data.adminLogs.push({
    id: db.nextId('adminLog'),
    adminId: admin.id,
    action,
    targetType,
    targetId,
    note: String(note || ''),
    at: Date.now(),
  });
}

app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const list = db.data.users
    .filter(
      (u) =>
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.nickname.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    )
    .slice(0, 100)
    .map((u) => ({
      ...publicUser(u),
      username: u.username,
      email: u.email || null,
      status: u.status || 'active',
      createdAt: u.createdAt,
      postCount: db.data.posts.filter((x) => x.userId === u.id).length,
    }));
  res.json({ users: list });
});

app.post('/api/admin/users/:id/status', auth, requireAdmin, (req, res) => {
  const u = db.data.users.find((x) => x.id === Number(req.params.id));
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const { status, reason } = req.body || {};
  if (!['active', 'restricted', 'banned'].includes(status)) {
    return res.status(400).json({ error: '状态参数不正确' });
  }
  if (u.id === req.user.id) return res.status(400).json({ error: '不能修改自己的账号状态' });
  if (isAdmin(u)) return res.status(403).json({ error: '不能修改其他管理员的状态' });
  u.status = status;
  // 封禁/限制时吊销该用户全部会话
  if (status !== 'active') {
    for (const [tk, rec] of Object.entries(db.data.tokens)) {
      if ((typeof rec === 'number' ? rec : rec.u) === u.id) delete db.data.tokens[tk];
    }
    secLog('account_' + status, 'uid=' + u.id + ' by=admin#' + req.user.id);
  }
  adminLog(req.user, 'set_user_status:' + status, 'user', u.id, reason);
  db.save();
  res.json({ ok: true, user: { ...publicUser(u), username: u.username, status: u.status } });
});

app.get('/api/admin/reports', auth, requireAdmin, (req, res) => {
  const status = String(req.query.status || 'pending');
  const list = db.data.reports
    .filter((r) => (status === 'all' ? true : r.status === status))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 200)
    .map((r) => {
      let targetAuthor = null;
      let targetPreview = '（已删除）';
      if (r.targetType === 'post') {
        const x = db.data.posts.find((pp) => pp.id === r.targetId);
        targetAuthor = x ? publicUser(db.data.users.find((u) => u.id === x.userId)) : null;
        targetPreview = x ? x.title : targetPreview;
      } else if (r.targetType === 'comment') {
        const c = db.data.comments.find((cc) => cc.id === r.targetId);
        targetAuthor = c ? publicUser(db.data.users.find((u) => u.id === c.userId)) : null;
        targetPreview = c ? c.content.slice(0, 80) : targetPreview;
      } else {
        const u = db.data.users.find((uu) => uu.id === r.targetId);
        targetAuthor = publicUser(u);
        targetPreview = u ? '@' + u.username : targetPreview;
      }
      return {
        ...r,
        reporter: publicUser(db.data.users.find((u) => u.id === r.reporterId)),
        targetAuthor,
        targetPreview,
      };
    });
  res.json({ reports: list });
});

app.post('/api/admin/reports/:id/handle', auth, requireAdmin, (req, res) => {
  const report = db.data.reports.find((r) => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: '举报不存在' });
  if (report.status !== 'pending') return res.status(409).json({ error: '该举报已处理' });
  const { action, note } = req.body || {};
  const actions = ['dismiss', 'hide_post', 'delete_post', 'delete_comment', 'restrict_user', 'ban_user'];
  if (!actions.includes(action)) return res.status(400).json({ error: '处理动作不正确' });

  let applied = '已记录，未对内容做改动';
  if (report.targetType === 'post') {
    const x = db.data.posts.find((pp) => pp.id === report.targetId);
    if (action === 'hide_post' && x) { x.hidden = true; applied = '动态已隐藏'; }
    if (action === 'delete_post' && x) {
      db.data.posts = db.data.posts.filter((y) => y.id !== x.id);
      db.data.comments = db.data.comments.filter((c) => c.postId !== x.id);
      applied = '动态已删除';
    }
    const author = x ? db.data.users.find((u) => u.id === x.userId) : null;
    if (action === 'restrict_user' && author) { author.status = 'restricted'; applied = '账号已限制'; }
    if (action === 'ban_user' && author) { author.status = 'banned'; applied = '账号已封禁'; }
  } else if (report.targetType === 'comment') {
    const c = db.data.comments.find((cc) => cc.id === report.targetId);
    if (action === 'delete_comment' && c) {
      db.data.comments = db.data.comments.filter((y) => y.id !== c.id);
      applied = '评论已删除';
    }
    const author = c ? db.data.users.find((u) => u.id === c.userId) : null;
    if (action === 'restrict_user' && author) { author.status = 'restricted'; applied = '账号已限制'; }
    if (action === 'ban_user' && author) { author.status = 'banned'; applied = '账号已封禁'; }
  } else {
    const u = db.data.users.find((uu) => uu.id === report.targetId);
    if (action === 'restrict_user' && u) { u.status = 'restricted'; applied = '账号已限制'; }
    if (action === 'ban_user' && u) { u.status = 'banned'; applied = '账号已封禁'; }
  }

  report.status = action === 'dismiss' ? 'dismissed' : 'resolved';
  report.action = action;
  report.handleNote = String(note || '');
  report.handledBy = req.user.id;
  report.handledAt = Date.now();
  adminLog(req.user, 'handle_report:' + action, report.targetType, report.targetId, note);
  db.save();
  res.json({ ok: true, status: report.status, applied });
});

// 运营数据面板（口径：总数=当前存量；新增=所选时间范围内创建；互动为累计值）
app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const days = Number(req.query.days) || 0; // 0=全部
  const cutoff = days > 0 ? Date.now() - days * 24 * 3600e3 : 0;
  const inRange = (ts) => ts >= cutoff;
  res.json({
    days,
    users: { total: db.data.users.length, new: db.data.users.filter((u) => inRange(u.createdAt)).length },
    posts: {
      total: db.data.posts.filter((x) => x.status === 'published').length,
      new: db.data.posts.filter((x) => x.status === 'published' && inRange(x.createdAt)).length,
      drafts: db.data.posts.filter((x) => x.status === 'draft').length,
      hidden: db.data.posts.filter((x) => x.hidden).length,
    },
    interactions: {
      likes: db.data.posts.reduce((sum, x) => sum + x.likes.length, 0),
      comments: db.data.comments.filter((c) => !c.hidden).length,
      messages: db.data.messages.length,
      views: db.data.posts.reduce((sum, x) => sum + (x.views || 0), 0),
    },
    pendingReports: db.data.reports.filter((r) => r.status === 'pending').length,
  });
});

app.get('/api/admin/logs', auth, requireAdmin, (req, res) => {
  const list = db.data.adminLogs
    .slice()
    .sort((a, b) => b.at - a.at)
    .slice(0, 200)
    .map((l) => ({ ...l, admin: publicUser(db.data.users.find((u) => u.id === l.adminId)) }));
  res.json({ logs: list });
});


// ========== 2.1 收藏夹管理 ==========

app.get('/api/me/folders', auth, requireAuth, (req, res) => {
  const folders = (req.user.favoriteFolders || []).map((f) => ({
    ...f,
    count: Object.values(req.user.favMap).filter((fid) => fid === f.id).length,
  }));
  res.json({ folders });
});
app.post('/api/me/folders', auth, requireAuth, LIMITS.profile, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 20) return res.status(400).json({ error: '收藏夹名称需为 1-20 字' });
  if ((req.user.favoriteFolders || []).length >= 20) return res.status(400).json({ error: '收藏夹最多 20 个' });
  if (req.user.favoriteFolders.some((f) => f.name === name)) return res.status(409).json({ error: '已有同名收藏夹' });
  const folder = { id: Date.now(), name, createdAt: Date.now() };
  req.user.favoriteFolders.push(folder);
  db.save();
  res.json({ folder: { ...folder, count: 0 } });
});
app.put('/api/me/folders/:id', auth, requireAuth, (req, res) => {
  const f = (req.user.favoriteFolders || []).find((x) => x.id === Number(req.params.id));
  if (!f) return res.status(404).json({ error: '收藏夹不存在' });
  if (f.id === 0) return res.status(400).json({ error: '默认收藏夹不能重命名' });
  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 20) return res.status(400).json({ error: '收藏夹名称需为 1-20 字' });
  f.name = name;
  db.save();
  res.json({ ok: true });
});
app.delete('/api/me/folders/:id', auth, requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const f = (req.user.favoriteFolders || []).find((x) => x.id === id);
  if (!f) return res.status(404).json({ error: '收藏夹不存在' });
  if (id === 0) return res.status(400).json({ error: '默认收藏夹不能删除' });
  // 其内容移入默认收藏夹，不丢数据
  for (const pid of Object.keys(req.user.favMap)) {
    if (req.user.favMap[pid] === id) req.user.favMap[pid] = 0;
  }
  req.user.favoriteFolders = req.user.favoriteFolders.filter((x) => x.id !== id);
  db.save();
  res.json({ ok: true });
});
// 我的收藏列表（分页，仅本人；收藏夹内容对他人完全不可见）
app.get('/api/me/favorites', auth, requireAuth, (req, res) => {
  const folderId = req.query.folderId === undefined ? null : Number(req.query.folderId);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Number(req.query.limit) || 10);
  let ids = Object.keys(req.user.favMap).map(Number);
  if (folderId !== null) ids = ids.filter((pid) => req.user.favMap[pid] === folderId);
  const posts = ids
    .map((pid) => db.data.posts.find((x) => x.id === pid))
    .filter(Boolean)
    .sort((a, b) => b.id - a.id);
  const slice = posts.slice((page - 1) * limit, page * limit);
  res.json({
    total: posts.length,
    page,
    posts: slice.map((x) => ({ ...postView(x, req.user), folderId: req.user.favMap[x.id] })),
  });
});

// ========== 2.1 静音与隐藏（个人视图过滤） ==========

app.post('/api/users/:id/mute', auth, requireAuth, (req, res) => {
  const t = db.data.users.find((u) => u.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: '用户不存在' });
  if (t.id === req.user.id) return res.status(400).json({ error: '不能静音自己' });
  if (!req.user.muted.includes(t.id)) req.user.muted.push(t.id);
  db.save();
  res.json({ ok: true, muted: true });
});
app.delete('/api/users/:id/mute', auth, requireAuth, (req, res) => {
  req.user.muted = (req.user.muted || []).filter((id) => id !== Number(req.params.id));
  db.save();
  res.json({ ok: true, muted: false });
});
app.get('/api/me/muted', auth, requireAuth, (req, res) => {
  res.json({ users: (req.user.muted || []).map((id) => publicUser(db.data.users.find((u) => u.id === id))).filter(Boolean) });
});
app.post('/api/posts/:id/hide-personal', auth, requireAuth, (req, res) => {
  const pid = Number(req.params.id);
  if (!db.data.posts.some((x) => x.id === pid)) return res.status(404).json({ error: '帖子不存在' });
  if (!req.user.hiddenPosts.includes(pid)) req.user.hiddenPosts.push(pid);
  db.save();
  res.json({ ok: true });
});
app.delete('/api/posts/:id/hide-personal', auth, requireAuth, (req, res) => {
  req.user.hiddenPosts = (req.user.hiddenPosts || []).filter((id) => id !== Number(req.params.id));
  db.save();
  res.json({ ok: true });
});

// 个人视图过滤：屏蔽 + 静音 + 个人隐藏（管理员不受限）
function filterPersonal(list, me) {
  if (!me || isAdmin(me)) return list;
  return list.filter((x) => {
    if ((me.muted || []).includes(x.userId)) return false;
    if ((me.hiddenPosts || []).includes(x.id)) return false;
    return true;
  });
}

// ========== 2.1 隐私设置 ==========

app.put('/api/me/settings', auth, requireAuth, (req, res) => {
  const b = req.body || {};
  const st = req.user.settings;
  if (b.privateAccount !== undefined) st.privateAccount = !!b.privateAccount;
  if (b.searchHistoryEnabled !== undefined) st.searchHistory = !!b.searchHistoryEnabled;
  if (b.dmPolicy !== undefined) {
    if (!['everyone', 'following'].includes(b.dmPolicy)) return res.status(400).json({ error: '私信策略参数不正确' });
    st.dmPolicy = b.dmPolicy;
  }
  if (b.commentPolicy !== undefined) {
    if (!['everyone', 'following'].includes(b.commentPolicy)) return res.status(400).json({ error: '评论策略参数不正确' });
    st.commentPolicy = b.commentPolicy;
  }
  db.save();
  res.json({ settings: st });
});

// ========== 2.1 通知中心 ==========

app.get('/api/me/notifications', auth, requireAuth, (req, res) => {
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const mine = db.data.notifications
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const slice = mine.slice(offset, offset + limit).map((n) => {
    const actor = db.data.users.find((u) => u.id === n.actorId);
    const post = n.postId ? db.data.posts.find((x) => x.id === n.postId) : null;
    return {
      id: n.id,
      type: n.type,
      actor: publicUser(actor),
      postTitle: post ? post.title : null,
      postDeleted: !!n.postId && !post,
      commentId: n.commentId,
      text: n.text || '',
      createdAt: n.createdAt,
      read: !!n.readAt,
    };
  });
  res.json({ total: mine.length, unread: mine.filter((n) => !n.readAt).length, items: slice });
});
app.post('/api/me/notifications/read', auth, requireAuth, (req, res) => {
  const { ids, all } = req.body || {};
  for (const n of db.data.notifications) {
    if (n.userId !== req.user.id || n.readAt) continue;
    if (all || (Array.isArray(ids) && ids.includes(n.id))) n.readAt = Date.now();
  }
  db.save();
  res.json({ ok: true });
});
app.delete('/api/me/notifications/:id', auth, requireAuth, (req, res) => {
  const n = db.data.notifications.find((x) => x.id === Number(req.params.id));
  if (!n || n.userId !== req.user.id) return res.status(404).json({ error: '通知不存在' });
  db.data.notifications = db.data.notifications.filter((x) => x.id !== n.id);
  db.save();
  res.json({ ok: true });
});

// /api/me/unread 合并通知未读数


// ========== 2.1 统一搜索（用户 / 公开动态 / 话题） ==========

app.get('/api/search', auth, LIMITS.search, (req, res) => {
  const q = String(req.query.q || '').trim();
  const type = ['posts', 'users', 'topics'].includes(req.query.type) ? req.query.type : 'posts';
  const time = ['day', 'week', 'month', 'all'].includes(req.query.time) ? req.query.time : 'all';
  const author = String(req.query.author || '').trim().toLowerCase();
  const hasImage = req.query.hasImage === '1';
  const sort = ['relevance', 'latest'].includes(req.query.sort) ? req.query.sort : 'latest';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Number(req.query.limit) || 10);
  const kw = q.toLowerCase();
  const cutoff = time === 'day' ? Date.now() - 86400e3 : time === 'week' ? Date.now() - 7 * 86400e3 : time === 'month' ? Date.now() - 30 * 86400e3 : 0;

  if (type === 'users') {
    if (!kw && !author) return res.json({ items: [], total: 0 });
    const items = db.data.users
      .filter((u) => {
        if (u.id === (req.user && req.user.id)) return false;
        if (u.status === 'banned') return false;
        if (req.user && blockedPair(u, req.user)) return false;
        const hay = (u.username + ' ' + u.nickname + ' ' + (u.bio || '')).toLowerCase();
        if (kw && !hay.includes(kw)) return false;
        if (author && !u.username.toLowerCase().includes(author)) return false;
        return true;
      })
      .slice((page - 1) * limit, page * limit)
      .map((u) => ({
        ...publicUser(u),
        username: u.username,
        bio: u.bio || '',
        interests: u.interests || [],
        followerCount: db.data.users.filter((x) => (x.following || []).includes(u.id)).length,
      }));
    return res.json({ items, page });
  }

  if (type === 'topics') {
    const agg = new Map();
    for (const x of db.data.posts) {
      if (x.status !== 'published' || x.visibility !== 'public' || x.hidden) continue;
      if (!canViewPost(x, req.user)) continue;
      for (const t of x.topics || []) {
        if (kw && !t.toLowerCase().includes(kw)) continue;
        const cur = agg.get(t) || { name: t, posts: 0, authors: new Set(), lastAt: 0 };
        cur.posts += 1;
        cur.authors.add(x.userId);
        cur.lastAt = Math.max(cur.lastAt, x.createdAt);
        agg.set(t, cur);
      }
    }
    const items = [...agg.values()]
      .map((t) => ({ name: t.name, posts: t.posts, authors: t.authors.size, lastAt: t.lastAt }))
      .sort((a, b) => b.posts - a.posts)
      .slice((page - 1) * limit, page * limit);
    return res.json({ items, page });
  }

  // 动态搜索：canViewPost 统一可见性（私密账号/屏蔽/仅自己/草稿全部生效）
  let pool = db.data.posts.filter((x) => {
    if (x.status !== 'published') return false;
    if (!canViewPost(x, req.user)) return false;
    if (x.createdAt < cutoff) return false;
    if (hasImage && !(x.images || []).length) return false;
    if (author) {
      const au = db.data.users.find((u) => u.id === x.userId);
      if (!au || !au.username.toLowerCase().includes(author)) return false;
    }
    if (kw) {
      const hit = x.title.toLowerCase().includes(kw) || x.content.toLowerCase().includes(kw) || (x.topics || []).some((t) => t.includes(kw));
      if (!hit) return false;
    }
    return true;
  });
  let views = filterPersonal(pool, req.user).map((x) => ({ post: postView(x, req.user), score: 0 }));
  if (kw && sort === 'relevance') {
    for (const v of views) {
      const t = v.post.title.toLowerCase(), c = v.post.content.toLowerCase();
      v.score = (t.includes(kw) ? 3 : 0) + (c.includes(kw) ? 2 : 0) + v.post.likeCount * 0.1;
    }
    views.sort((a, b) => b.score - a.score || b.post.createdAt - a.post.createdAt);
  } else {
    views.sort((a, b) => b.post.createdAt - a.post.createdAt);
  }
  res.json({ items: views.slice((page - 1) * limit, page * limit).map((v) => v.post), page, total: views.length });
});

// ========== 2.1 话题 ==========

// 热门/最新话题（热门：近 7 天，按独立作者数与互动计算，防单人多帖刷榜）
app.get('/api/topics', auth, (req, res) => {
  const sort = req.query.sort === 'new' ? 'new' : 'hot';
  const cutoff = Date.now() - 7 * 86400e3;
  const agg = new Map();
  for (const x of db.data.posts) {
    if (x.status !== 'published' || x.visibility !== 'public' || x.hidden) continue;
    if (sort === 'hot' && x.createdAt < cutoff) continue;
    if (!canViewPost(x, req.user)) continue;
    const engagement = x.likes.length * 2 + db.data.comments.filter((c) => c.postId === x.id).length;
    for (const t of x.topics || []) {
      const cur = agg.get(t) || { name: t, posts: 0, authors: new Set(), score: 0, lastAt: 0 };
      cur.posts += 1;
      cur.authors.add(x.userId);
      cur.score += 1 + engagement * 0.5;
      cur.lastAt = Math.max(cur.lastAt, x.createdAt);
      agg.set(t, cur);
    }
  }
  const items = [...agg.values()].map((t) => ({ name: t.name, posts: t.posts, authors: t.authors.size, lastAt: t.lastAt }));
  if (sort === 'hot') items.sort((a, b) => b.authors - a.authors || b.posts - a.posts);
  else items.sort((a, b) => b.lastAt - a.lastAt);
  res.json({ items: items.slice(0, 20) });
});

// 话题详情：相关公开动态（分页，遵循全部可见性规则）
app.get('/api/topics/:name/posts', auth, (req, res) => {
  const name = decodeURIComponent(String(req.params.name)).toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Number(req.query.limit) || 10);
  const posts = db.data.posts
    .filter((x) => x.status === 'published' && !x.hidden && (x.topics || []).includes(name) && canViewPost(x, req.user))
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({
    total: posts.length,
    page,
    items: filterPersonal(posts.slice((page - 1) * limit, page * limit), req.user).map((x) => postView(x, req.user)),
  });
});

// ========== 2.1 账号安全中心：会话管理 ==========

const hashToken = (tk) => crypto.createHash('sha256').update(tk).digest('hex').slice(0, 12);

app.get('/api/me/sessions', auth, requireAuth, (req, res) => {
  const list = [];
  for (const [tk, rec] of Object.entries(db.data.tokens)) {
    if ((typeof rec === 'number' ? rec : rec.u) !== req.user.id) continue;
    list.push({
      id: hashToken(tk),
      createdAt: typeof rec === 'number' ? Date.now() : rec.t || Date.now(), // v1 会话无时间记录，以当前时间兜底
      ua: (typeof rec === 'number' ? '' : rec.ua) || '未知设备',
      current: tk === req.token,
    });
  }
  list.sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.createdAt - a.createdAt);
  res.json({ sessions: list });
});
app.delete('/api/me/sessions/:id', auth, requireAuth, (req, res) => {
  if (req.params.id === hashToken(req.token)) return res.status(400).json({ error: '不能注销当前会话，请使用退出登录' });
  for (const tk of Object.keys(db.data.tokens)) {
    if ((typeof db.data.tokens[tk] === 'number' ? db.data.tokens[tk] : db.data.tokens[tk].u) === req.user.id && hashToken(tk) === req.params.id) {
      delete db.data.tokens[tk];
      db.save();
      secLog('session_revoked', 'uid=' + req.user.id + ' sid=' + req.params.id);
      return res.json({ ok: true });
    }
  }
  res.status(404).json({ error: '会话不存在' });
});
app.post('/api/me/sessions/logout-others', auth, requireAuth, (req, res) => {
  let n = 0;
  for (const tk of Object.keys(db.data.tokens)) {
    const rec = db.data.tokens[tk];
    if ((typeof rec === 'number' ? rec : rec.u) === req.user.id && tk !== req.token) {
      delete db.data.tokens[tk];
      n += 1;
    }
  }
  db.save();
  secLog('sessions_logout_others', 'uid=' + req.user.id + ' revoked=' + n);
  res.json({ ok: true, revoked: n });
});

// ========== 2.1 数据导出（仅本人数据；频控 3 次/小时；直接鉴权下载，无临时链接落盘） ==========

app.get('/api/me/export', auth, requireAuth, mkLimiter(60 * 60e3, 3), (req, res) => {
  const uid = req.user.id;
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: req.user.id,
      username: req.user.username,
      nickname: req.user.nickname,
      email: req.user.email,
      bio: req.user.bio,
      interests: req.user.interests,
      settings: req.user.settings,
      createdAt: req.user.createdAt,
    },
    posts: db.data.posts.filter((x) => x.userId === uid).map((x) => ({
      id: x.id, board: x.board, title: x.title, content: x.content,
      visibility: x.visibility, status: x.status, topics: x.topics,
      images: x.images, createdAt: x.createdAt, views: x.views || 0, likes: x.likes.length,
    })),
    comments: db.data.comments.filter((c) => c.userId === uid).map((c) => ({
      id: c.id, postId: c.postId, content: c.content, anonymous: !!c.anonymous, createdAt: c.createdAt,
    })),
    favorites: Object.entries(req.user.favMap).map(([pid, fid]) => ({
      postId: Number(pid),
      folder: (req.user.favoriteFolders.find((f) => f.id === fid) || {}).name || '默认收藏夹',
    })),
    drafts: db.data.posts.filter((x) => x.userId === uid && x.status === 'draft').map((x) => ({ id: x.id, title: x.title, content: x.content, createdAt: x.createdAt })),
    following: (req.user.following || []).map((id) => (db.data.users.find((u) => u.id === id) || {}).username).filter(Boolean),
  };
  // 绝不包含：passwordHash / salt / tokens / 他人私信 / 他人资料
  secLog('data_exported', 'uid=' + uid);
  res.set('Content-Disposition', 'attachment; filename="dgchat-export-' + uid + '-' + new Date().toISOString().slice(0, 10) + '.json"');
  res.json(payload);
});

// ========== 2.1 账号注销（验证密码；关联数据全清理；幂等保护） ==========
app.post('/api/me/delete', auth, requireAuth, mkLimiter(60 * 60e3, 3), (req, res) => {
  const { password, confirm } = req.body || {};
  if (confirm !== 'DELETE') return res.status(400).json({ error: '请输入 DELETE 确认' });
  if (db.hashPassword(String(password || ''), req.user.salt) !== req.user.passwordHash) {
    secLog('account_delete_fail', 'uid=' + req.user.id);
    return res.status(403).json({ error: '密码不正确' });
  }
  const uid = req.user.id;
  // 1. 本人动态（含图片文件）与评论
  const myPosts = db.data.posts.filter((x) => x.userId === uid);
  for (const x of myPosts) {
    for (const img of x.images || []) {
      if (img.startsWith('/uploads/')) fs.rm(path.join(UPLOAD_DIR, img.replace('/uploads/', '')), { force: true }, () => {});
    }
  }
  db.data.posts = db.data.posts.filter((x) => x.userId !== uid);
  db.data.comments = db.data.comments.filter((c) => c.userId !== uid);
  // 2. 社交关系双向清理
  for (const u of db.data.users) {
    u.following = (u.following || []).filter((id) => id !== uid);
    u.blocked = (u.blocked || []).filter((id) => id !== uid);
    u.muted = (u.muted || []).filter((id) => id !== uid);
    u.followRequests = (u.followRequests || []).filter((id) => id !== uid);
    delete u.favMap[uid];
  }
  // 3. 头像文件
  removeAvatarFile(req.user.avatar);
  // 4. 私信（双向删除：会话历史不留存）
  db.data.messages = db.data.messages.filter((m) => m.fromId !== uid && m.toId !== uid);
  // 5. 举报与通知
  db.data.reports = db.data.reports.filter((r) => r.reporterId !== uid);
  db.data.notifications = db.data.notifications.filter((n) => n.userId !== uid && n.actorId !== uid);
  // 6. 会话全部吊销 + 移除用户
  for (const tk of Object.keys(db.data.tokens)) {
    const rec = db.data.tokens[tk];
    if ((typeof rec === 'number' ? rec : rec.u) === uid) delete db.data.tokens[tk];
  }
  db.data.users = db.data.users.filter((u) => u.id !== uid);
  db.data.adminLogs.push({
    id: db.nextId('adminLog'),
    adminId: uid,
    action: 'account_self_deleted',
    targetType: 'user',
    targetId: uid,
    note: '用户自助注销（无敏感凭据）',
    at: Date.now(),
  });
  secLog('account_deleted', 'uid=' + uid);
  db.save();
  res.json({ ok: true });
});

// ========== 2.1 管理统计 v2（60 秒缓存，避免反复全量扫描） ==========

let statsCache = { at: 0, data: null };
app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const days = Number(req.query.days) || 0;
  const now = Date.now();
  if (statsCache.data && now - statsCache.at < 60e3) {
    const c = statsCache.data;
    return res.json(recomputeStats(c.snapshot, days, now)); // 用缓存快照按范围重算，不重扫数据
  }
  const snapshot = {
    users: db.data.users.map((u) => ({ id: u.id, createdAt: u.createdAt, status: u.status })),
    posts: db.data.posts.map((x) => ({ userId: x.userId, createdAt: x.createdAt, status: x.status, hidden: !!x.hidden, likes: x.likes.length })),
    comments: db.data.comments.filter((c) => !c.hidden).map((c) => ({ userId: c.userId, createdAt: c.createdAt })),
    messages: db.data.messages.length,
    views: db.data.posts.reduce((sum, x) => sum + (x.views || 0), 0),
    drafts: db.data.posts.filter((x) => x.status === 'draft').length,
    hidden: db.data.posts.filter((x) => x.hidden).length,
    pendingReports: db.data.reports.filter((r) => r.status === 'pending').length,
  };
  statsCache = { at: now, data: { snapshot } };
  res.json(recomputeStats(snapshot, days, now));
});

function recomputeStats(snap, days, now) {
  const cutoff = days > 0 ? now - days * 86400e3 : 0;
  const inRange = (ts) => ts >= cutoff;
  const published = snap.posts.filter((x) => x.status === 'published');
  // 近 7 天活跃用户：发布/评论过内容的真实去重用户
  const weekAgo = now - 7 * 86400e3;
  const active = new Set();
  for (const x of snap.posts) if (x.createdAt > weekAgo) active.add(x.userId);
  for (const c of snap.comments) if (c.createdAt > weekAgo) active.add(c.userId);
  // 14 天注册与内容趋势
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400e3).toISOString().slice(0, 10);
    const dStart = new Date(d + 'T00:00:00Z').getTime();
    const dEnd = dStart + 86400e3;
    trend.push({
      date: d,
      users: snap.users.filter((u) => u.createdAt >= dStart && u.createdAt < dEnd).length,
      posts: snap.posts.filter((x) => x.createdAt >= dStart && x.createdAt < dEnd).length,
      comments: snap.comments.filter((c) => c.createdAt >= dStart && c.createdAt < dEnd).length,
    });
  }
  return {
    days,
    generatedAt: now,
    users: { total: snap.users.length, new: snap.users.filter((u) => inRange(u.createdAt)).length, active7: active.size, banned: snap.users.filter((u) => u.status === 'banned').length },
    posts: { total: published.length, new: published.filter((x) => inRange(x.createdAt)).length, drafts: snap.drafts, hidden: snap.hidden },
    interactions: {
      likes: published.reduce((sum, x) => sum + x.likes, 0),
      comments: snap.comments.length,
      messages: snap.messages,
      views: snap.views,
    },
    pendingReports: snap.pendingReports,
    trend,
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'DGChat', version: '2.1.0', schema: db.SCHEMA_VERSION }));

// 404（API）
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 统一错误处理：已知业务错误回传友好信息；未知错误返回通用提示并在服务端记录（不含令牌）
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '单张图片最大 5MB' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: '最多上传 9 张图片' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: '请求体过大' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: '请求格式错误' });
  console.error('[error]', req.method, req.path, err.status || '', err.message);
  res.status(500).json({ error: '服务器错误，请稍后重试' });
});

const server = app.listen(PORT, () => {
  console.log(`${APP_NAME} 已启动：http://localhost:${PORT}`);
  const hasSeedDemo = db.data.users.some((u) => ['demo', 'test', 'orange', 'awei'].includes(u.username));
  if (hasSeedDemo) {
    console.warn('[安全提示] 当前存在内置演示账号（demo/test/orange/awei，密码公开）。公网部署前请清空 data/ 重新初始化，或用管理员账号处理。');
    secLog('seed_demo_accounts_present');
  }
});
server.requestTimeout = 30e3; // 请求处理超时
server.headersTimeout = 31e3; // 防慢速 HTTP 攻击（必须略大于 requestTimeout）
server.keepAliveTimeout = 15e3;
