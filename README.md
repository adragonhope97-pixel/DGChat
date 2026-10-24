# DGChat 🐉

**DGChat** 是一个开箱即用的校园论坛（校园墙）应用：一套代码，同时覆盖 **Web / PWA / Android / iOS** 四种形态。后端为零数据库依赖的 Node.js + Express（JSON 文件存储），前端为原生 HTML/CSS/JS 单页应用，配合「液态玻璃」视觉风格与多主题背景系统。

> 设计理念：足够简洁、足够快、开箱即用。没有框架、没有构建步骤、没有数据库 —— 克隆下来 `npm start` 就能跑。

---

## ✨ 功能特性

### 论坛核心
- **五大版块**：表白墙、二手交易、失物招领、校园资讯、树洞闲聊
- **发帖 / 编辑 / 删帖**：支持帖子图片上传（自动压缩），作者与管理员可编辑删除
- **评论与点赞**：帖子详情页内评论，卡片与详情页均可点赞
- **收藏**：收藏的帖子归档在个人页「我的收藏」
- **搜索与排序**：关键词搜索，最新 / 最热排序切换

### 社交与账号
- **注册 / 登录**：用户名或邮箱 + 密码，支持记住登录（token 会话）
- **个人头像**：注册后可上传头像（前端自动中心裁方 + 压缩到 256px JPEG）
- **私信系统**：站内一对一私信，会话列表 + 消息流，未读提醒
- **个人主页**：我的帖子 / 我的收藏 / 我点赞的，一站式管理
- **管理员**：1 号账号为站长（管理员），可管理全部帖子与评论

### 视觉与体验
- **液态玻璃 UI**：基于开源库 [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)（MIT，已本地化），卡片、弹窗、悬浮按钮均为玻璃材质，带光斑跟手、弹性阻尼动效
- **五套背景主题**：波纹 / 极光 / 暮色 / 翡翠 / 曜石，切换背景后顶栏与玻璃面板自动取色联动（亮部加权取色，避免暗部拖偏色调）
- **通用屏幕自适应**：安全区、窄屏单行滚动、超窄屏与横屏紧凑布局、系统字体缩放免疫，从小屏手机到桌面浏览器都正常
- **PWA**：可安装到桌面 / 主屏幕，Service Worker 全网络优先 + 极简离线页
- **SF 风格动效**：苹果式三阶贝塞尔缓动，卡片进场对焦动画

---

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Node.js + Express + Multer（图片上传） |
| 数据存储 | JSON 文件（`data/data.json`，无数据库依赖） |
| 前端 | 原生 HTML / CSS / JavaScript 单页应用，无框架无构建 |
| 视觉 | [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)（Web Components，MIT） |
| 移动端 | Capacitor 8（Android / iOS 共用同一套网页代码） |
| CI | GitHub Actions（安卓 APK / iOS 未签名 IPA 自动构建） |

---

## 🚀 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 18）
npm install

# 2. 启动服务
npm start
# 或开发模式（文件变动自动重启）
npm run dev

# 3. 打开浏览器访问
# http://localhost:3000
```

**内置演示账号**（首次启动自动生成）：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `demo` | `demo123456` | 站长（管理员） |
| `test` / `orange` / `awei` | `123456` | 演示用户 |

> ⚠️ 演示账号仅用于本地体验，正式部署请注册新账号并删除种子数据（清空 `data/data.json` 后重启即可重新初始化）。

### 配置项

| 配置 | 位置 | 说明 |
| --- | --- | --- |
| 端口 | 环境变量 `PORT`（默认 `3000`） | 服务监听端口 |
| 站点名 | 环境变量 `APP_NAME`（默认 `Campus Wall 校园墙`） | 启动日志显示 |
| 品牌文案 | `web/js/brand.js` | 应用名、标题、页脚标语全站唯一出处 |
| 原生端接口地址 | `web/js/brand.js` → `nativeServerHost` | 手机 App 访问电脑服务的局域网地址 |

---

## 📱 移动端构建（Capacitor）

网页代码通过 Capacitor 打包为 Android / iOS 应用，与网页共用同一套后端 API：

```bash
# Android（生成 android/ 工程并同步网页资源）
npx cap sync android
cd android && ./gradlew assembleDebug   # 产物：android/app/build/outputs/apk/debug/app-debug.apk

# iOS（需 macOS + Xcode）
npm run ios:sync
cd ios/App && xcodebuild -scheme App -configuration Debug -destination 'generic/platform=iOS'
```

**CI 自动构建**：仓库内置两条 GitHub Actions 流水线，推送到 `main` 分支后自动构建并在 Artifacts 中提供：

- `.github/workflows/android-build.yml` → `dgchat-debug.apk`
- `.github/workflows/ios-build.yml` → `dgchat-unsigned.ipa`（未签名，需自行签名或用 AltStore / Sideloadly 侧载）

> 手机 App 访问本机服务需在同一局域网，并把 `web/js/brand.js` 的 `nativeServerHost` 改为电脑的局域网 IP。

---

## 🗂 项目结构

```
DGChat/
├── server/               # 后端
│   ├── server.js         # 全部 REST 路由 + 静态托管（端口 3000）
│   └── db.js             # JSON 数据层（版块定义 / 种子数据 / 读写）
├── web/                  # 前端单页应用
│   ├── index.html        # 三视图（帖子/私信/我的）+ 弹窗
│   ├── style.css         # 玻璃设计令牌 + 通用屏幕自适应层
│   ├── js/
│   │   ├── app.js        # 主逻辑（视图/私信/头像/主题/动效）
│   │   └── brand.js      # 品牌配置（全站文案唯一出处）
│   ├── assets/           # 图标与背景图
│   └── vendor/liquid-glass/  # 液态玻璃组件库（本地化）
├── android/              # Capacitor Android 工程
├── ios/                  # Capacitor iOS 工程
├── .github/workflows/    # APK / IPA 自动构建流水线
└── data/                 # 运行时生成：data.json + uploads/（已 gitignore）
```

---

## 🔌 API 概览

所有接口前缀 `/api`，登录态通过 `Authorization: Bearer <token>` 传递。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/register` · `/api/login` | 注册 / 登录（支持用户名或邮箱） |
| GET | `/api/posts?board=&sort=&q=` | 帖子列表（版块 / 排序 / 搜索） |
| POST | `/api/posts` | 发帖（multipart，可带图） |
| PUT / DELETE | `/api/posts/:id` | 编辑 / 删除帖子（作者或管理员） |
| POST / DELETE | `/api/posts/:id/like` | 点赞 / 取消点赞 |
| POST / DELETE | `/api/posts/:id/favorite` | 收藏 / 取消收藏 |
| GET / POST | `/api/posts/:id/comments` | 评论列表 / 发表评论 |
| GET / POST | `/api/messages` · `/api/messages/:peerId` | 私信会话列表 / 消息收发 |
| GET | `/api/me` · `/api/me/favorites` | 个人信息 / 我的收藏 |
| POST / DELETE | `/api/me/avatar` | 上传 / 移除头像 |

完整字段与行为以 `server/server.js` 为准（含注释）。

---

## 📄 说明

- **字体**：本项目使用系统字体栈（`-apple-system / PingFang SC / 微软雅黑`）。如需苹果 SF Pro 观感，可自行获取授权字体放入 `web/assets/fonts/` 并添加 `@font-face`（SF Pro 为 Apple 专有字体，随本仓库分发需遵守其许可条款）。
- **数据**：所有数据存储于 `data/data.json` 与 `data/uploads/`，均为运行时生成。部署时注意定期备份；服务异常断电可能导致最后一次写盘丢失。
- **图标与背景**：`web/assets/` 内图标与背景图为项目自有资源，可自由替换（背景图切换后主题色自动联动）。
- **LiquidGlass-UI**：[hwyuanzi/LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)，MIT License，已本地化于 `web/vendor/liquid-glass/`。
