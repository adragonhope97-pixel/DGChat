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
  }
  return true;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

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
    // 2.0 字段
    interests: [],
    following: [],
    blocked: [],
    status: 'active',
    bio: '',
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

  const views = posts.map((p) => postView(p, req.user));
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
  db.data.posts.splice(idx, 1);
  db.data.comments = db.data.comments.filter((c) => c.postId !== postId);
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
  } else {
    post.likes.splice(i, 1);
    if (post.likesOn[tk]) post.likesOn[tk] -= 1;
  }
  db.save();
  res.json({ likeCount: post.likes.length, likedByMe: i === -1 });
});

// 收藏 / 取消收藏（切换）
app.post('/api/posts/:id/favorite', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) return res.status(404).json({ error: '帖子不存在或已被删除' });
  if (!post.favorites) post.favorites = [];
  const i = post.favorites.indexOf(req.user.id);
  if (i === -1) post.favorites.push(req.user.id);
  else post.favorites.splice(i, 1);
  db.save();
  res.json({ favoriteCount: post.favorites.length, favoritedByMe: i === -1 });
});

// ---------- 评论 ----------

app.post('/api/posts/:id/comments', auth, requireAuth, LIMITS.comment, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post || !canViewPost(post, req.user)) return res.status(404).json({ error: '帖子不存在或已被删除' });
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
      return { id: m.id, content: m.content, createdAt: m.createdAt, fromMe: m.fromId === req.user.id };
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

  const msg = {
    id: db.nextId('message'),
    fromId: req.user.id,
    toId: partner.id,
    content: content.trim(),
    createdAt: Date.now(),
    readAt: null,
  };
  db.data.messages.push(msg);
  db.save();
  res.json({ message: { id: msg.id, content: msg.content, createdAt: msg.createdAt, fromMe: true } });
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
  if (!req.user.following.includes(target.id)) {
    req.user.following.push(target.id);
    db.save();
  }
  res.json({ ok: true, following: true });
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

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'DGChat', version: '2.0.1', schema: db.SCHEMA_VERSION }));

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
