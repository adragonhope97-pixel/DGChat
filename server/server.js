// 校园墙后端服务（REST API + 静态网页托管）
// 网页端、以后的安卓端 / iOS 端都调用同一套 /api 接口
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db');

const app = express();
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

app.use(express.json());

// 允许跨域：方便以后手机端 / 本地前端调试
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

// 删除旧头像文件（忽略错误）
function removeAvatarFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.rm(path.join(UPLOAD_DIR, url.replace('/uploads/', '')), { force: true }, () => {});
}

const isAdmin = (u) => !!u && u.role === 'admin';

// 从 Authorization 头解析登录用户
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const userId = token && db.data.tokens[token];
  req.user = userId ? db.data.users.find((u) => u.id === userId) || null : null;
  req.token = token || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
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
  };
}

// ---------- 注册 / 登录 ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', (req, res) => {
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
  };
  db.data.users.push(user);
  const token = crypto.randomBytes(24).toString('hex');
  db.data.tokens[token] = user.id;
  db.save();
  res.json({
    token,
    user: { ...publicUser(user), username: user.username, email: user.email },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const identifier = String(username || '').trim();
  // 支持用户名或邮箱登录
  const user =
    db.data.users.find((u) => u.username === identifier) ||
    db.data.users.find((u) => u.email && u.email === identifier.toLowerCase());
  if (!user || db.hashPassword(String(password || ''), user.salt) !== user.passwordHash) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.data.tokens[token] = user.id;
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
  res.json({
    user: { ...publicUser(req.user), username: req.user.username, email: req.user.email || null },
  });
});

// ---------- 版块 ----------

app.get('/api/boards', (req, res) => {
  res.json({ boards: db.BOARDS });
});

// ---------- 帖子 ----------

app.get('/api/posts', auth, (req, res) => {
  const { board, q, sort, mine, liked, fav } = req.query;
  if ((mine === '1' || liked === '1' || fav === '1') && !req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  let posts = db.data.posts.slice();

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
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
  const comments = db.data.comments
    .filter((c) => c.postId === post.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => commentView(c, req.user));
  res.json({ post: postView(post, req.user), comments });
});

app.post('/api/posts', auth, requireAuth, upload.array('images', 9), (req, res) => {
  const { board, title, content } = req.body;
  const anonymous = req.body.anonymous === 'true' || req.body.anonymous === true;
  if (!boardById(board)) return res.status(400).json({ error: '请选择正确的版块' });
  if (!title || !title.trim()) return res.status(400).json({ error: '请填写标题' });
  if (title.length > 60) return res.status(400).json({ error: '标题最多 60 字' });
  if (!content || !content.trim()) return res.status(400).json({ error: '请填写正文内容' });
  if (content.length > 5000) return res.status(400).json({ error: '正文最多 5000 字' });

  const post = {
    id: db.nextId('post'),
    userId: req.user.id,
    board,
    title: title.trim(),
    content: content.trim(),
    anonymous,
    images: fileUrls(req.files),
    likes: [],
    favorites: [],
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

  // 保留的旧图 + 新上传的图（按选择顺序）
  let kept = [];
  try {
    kept = JSON.parse(req.body.existingImages || '[]');
  } catch {}
  if (!Array.isArray(kept)) kept = [];
  kept = kept.filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
  post.title = title.trim();
  post.content = content.trim();
  post.images = [...kept, ...fileUrls(req.files)].slice(0, 9);
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
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
  const i = post.likes.indexOf(req.user.id);
  if (i === -1) post.likes.push(req.user.id);
  else post.likes.splice(i, 1);
  db.save();
  res.json({ likeCount: post.likes.length, likedByMe: i === -1 });
});

// 收藏 / 取消收藏（切换）
app.post('/api/posts/:id/favorite', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
  if (!post.favorites) post.favorites = [];
  const i = post.favorites.indexOf(req.user.id);
  if (i === -1) post.favorites.push(req.user.id);
  else post.favorites.splice(i, 1);
  db.save();
  res.json({ favoriteCount: post.favorites.length, favoritedByMe: i === -1 });
});

// ---------- 评论 ----------

app.post('/api/posts/:id/comments', auth, requireAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: '帖子不存在或已被删除' });
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
    posts: myPosts.length,
    likesReceived: myPosts.reduce((s, p) => s + p.likes.length, 0),
    favorites: db.data.posts.filter((p) => (p.favorites || []).includes(req.user.id)).length,
  });
});

// 上传 / 更换头像（正方形压缩由前端完成，服务端再校验类型与大小）
app.post('/api/me/avatar', auth, requireAuth, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到图片' });
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
app.post('/api/messages', auth, requireAuth, (req, res) => {
  const { toUserId, content } = req.body || {};
  const partner = db.data.users.find((u) => u.id === Number(toUserId));
  if (!partner) return res.status(404).json({ error: '用户不存在' });
  if (partner.id === req.user.id) return res.status(400).json({ error: '不能给自己发私信' });
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

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'example-campus-wall' }));

// 404（API）
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 统一错误处理（含图片上传错误）
app.use((err, req, res, next) => {
  const msg =
    err.code === 'LIMIT_FILE_SIZE'
      ? '单张图片最大 5MB'
      : err.code === 'LIMIT_FILE_COUNT'
        ? '最多上传 9 张图片'
        : err.message || '服务器错误';
  res.status(400).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`${APP_NAME} 已启动：http://localhost:${PORT}`);
});
