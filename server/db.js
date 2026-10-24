// 数据层：用 JSON 文件存储，零依赖、易迁移（后续可换成 SQLite/MySQL）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
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
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else {
    db = seed();
  }
  // 旧数据文件兼容：补齐私信存储
  if (!db.messages) db.messages = [];
  if (!db.seq) db.seq = {};
  if (db.seq.message === undefined) db.seq.message = 0;
  save();
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
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
  hashPassword,
  save,
  nextId,
};
