# DGChat 🐉

简体中文 | [English](README.en.md) | [繁體中文（臺灣）](README.zh-TW.md)

> **当前版本 v2.5** · 功能状态登记册见 [docs/FEATURE-REGISTRY.md](docs/FEATURE-REGISTRY.md) · 完整版本记录见 [CHANGELOG.md](CHANGELOG.md)

**DGChat** 是一个开箱即用的校园论坛（校园墙）应用：一套代码，同时覆盖 **Web / PWA / Android / iOS** 四种形态。后端为零数据库依赖的 Node.js + Express（JSON 文件存储），前端为原生 HTML/CSS/JS 单页应用，配合「液态玻璃」视觉风格与多主题背景系统。

> 设计理念：足够简洁、足够快、开箱即用。没有框架、没有构建步骤、没有数据库 —— 克隆下来 `npm start` 就能跑。

**整体架构**：浏览器 / PWA / 手机 App 加载同一套单页前端，通过 REST API 与后端通信；后端把所有业务数据（用户、帖子、评论、私信、会话令牌）持久化在一个 JSON 文件里，图片落盘到 `uploads/`。手机端由 Capacitor 打包同一份前端代码，仅把接口地址指向电脑的局域网 IP，因此一个功能改完，四端同时生效。

**设计原则**：

- **零依赖心智** —— 数据一个 JSON、静态资源直接托管，备份 = 拷文件，迁移 = 拷目录
- **移动优先的交互** —— 底部三标签导航、贴底弹窗、安全区适配，桌面端自动切换为居中卡片式弹窗与宽版布局
- **确定性渲染** —— 弹窗放弃 backdrop-filter 改用半透明实底，杜绝 Chromium 下玻璃闪断；所有动效走 CSS 缓动曲线，不依赖 JS 动画库

---

## ✨ 功能特性

### 论坛核心
- **五大版块**：表白墙、二手交易、失物招领、校园资讯、树洞闲聊
- **发帖 / 编辑 / 删帖**：支持帖子图片上传（自动压缩），作者与管理员可编辑删除
- **评论与点赞**：帖子详情页内评论（支持**匿名评论**），卡片与详情页均可点赞
- **收藏**：收藏的帖子归档在个人页「我的收藏」
- **搜索与排序**：关键词搜索，最新 / 最热排序切换

### 社交与账号
- **注册 / 登录**：用户名或邮箱 + 密码，支持记住登录（token 会话）
- **个人头像**：注册后可上传头像（前端自动中心裁方 + 压缩到 256px JPEG）
- **私信系统**：站内一对一私信，会话列表 + 消息流，未读角标（顶栏头像处实时显示未读数）
- **个人主页**：我的帖子 / 我的收藏 / 我点赞的，一站式管理
- **管理员**：1 号账号为站长（管理员），可管理全部帖子与评论

### 视觉与体验
- **液态玻璃 UI**：基于开源库 [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)（MIT，已本地化），卡片、弹窗、悬浮按钮均为玻璃材质，带光斑跟手、弹性阻尼动效
- **五套背景主题**：波纹 / 极光 / 暮色 / 翡翠 / 曜石，切换背景后顶栏与玻璃面板自动取色联动（亮部加权取色，避免暗部拖偏色调）
- **通用屏幕自适应**：安全区、窄屏单行滚动、超窄屏与横屏紧凑布局、系统字体缩放免疫，从小屏手机到桌面浏览器都正常
- **PWA**：可安装到桌面 / 主屏幕，Service Worker 全网络优先 + 极简离线页
- **SF 风格动效**：苹果式三阶贝塞尔缓动，卡片进场对焦动画

---

## 🆕 DGChat 2.0 新特性

### 发现与交友
- **发现页**（底部第四个标签）：推荐用户 / 最新动态 / 热门动态三个分区
- **用户搜索**：按用户名、昵称搜索，支持兴趣标签筛选；**兴趣标签**最多 8 个，用于推荐匹配
- **用户推荐**：共同兴趣 + 活跃度的简单稳定规则，每条推荐都标注理由（兴趣相投 / 活跃创作者 / 热门用户）
- **关注系统**：关注、取关、关注列表、粉丝列表；已关注用户自动退出推荐池
- **热门动态**基于真实互动数据：点赞×3 + 评论×2 + 近 7 天浏览×0.1，不用虚构数字

### 隐私与安全
- **动态可见性**：发帖可选「公开 / 仅自己可见」；列表、详情、搜索、推荐、点赞、评论全部走服务端统一校验，直接请求 API 也绕不过
- **用户屏蔽**：屏蔽双方动态互不可见（含搜索与推荐）、禁止关注与私信；屏蔽列表可管理
- **举报与审核**：举报帖子/评论/用户 → 管理员处理（忽略/隐藏/删除/限制/封禁）→ 全部动作写入操作日志
- **账号状态**：正常/限制/封禁，封禁立即吊销全部会话；登录/注册/评论/举报接口有频率限制

### 创作者与运营工具
- **创作者中心**：浏览/获赞/评论/收藏统计 + 近 7 天真实趋势图 + 草稿箱（保存、继续编辑、发布、删除）
- **管理后台**（仅管理员可见入口）：用户管理、举报处理、运营数据面板、操作日志；高风险操作二次确认并留痕
- **统计口径透明**：浏览量 = 非作者打开详情页次数；趋势为按天新增，不混用指标

---

## 📦 版本说明与文件定位（1.0 / 2.0）

仓库同时保留两个大版本的源码，通过 git 标签区分，互不覆盖：

| | **v1.0.0** | **v2.0.0**（当前 main） |
| --- | --- | --- |
| 内容 | 网页论坛基础版 | 新增发现与交友 / 隐私与安全 / 创作者与运营工具 |
| 源码获取 | `git checkout v1.0.0`，或 [v1.0.0 Release](https://github.com/adragonhope97-pixel/DGChat/releases/tag/v1.0.0) 的 Source code 包 | `git clone` 默认 main 分支 |
| 安装包 | 无（仅源码存档） | [v2.0.0 Release](https://github.com/adragonhope97-pixel/DGChat/releases/tag/v2.0.0) 提供 APK / IPA |
| 数据文件 | schema v1 | schema v2（旧数据首次启动自动迁移并备份） |

**v1.0.0 关键文件**（在该标签下路径相同，直接切换即可阅读）：

| 文件 | 定位 |
| --- | --- |
| `server/server.js` | 全部 REST 接口：帖子 / 评论 / 点赞收藏 / 私信 / 头像 |
| `server/db.js` | JSON 数据层、版块定义、种子数据 |
| `web/index.html` | 页面骨架：帖子 / 私信 / 我的 三视图 + 各弹窗 |
| `web/js/app.js` | 全部前端交互（单文件） |
| `web/style.css` | 玻璃设计令牌 + 屏幕自适应层 |
| `web/assets/` · `web/vendor/liquid-glass/` | 图标背景图 / 液态玻璃组件库 |

**v2.0.0 新增与改动**（在 1.0 基础上）：

| 文件 | 定位 |
| --- | --- |
| `web/js/discover.js` 🆕 | 2.0 前端主体（约 700 行）：发现页 `loadDiscover()`、用户资料 `openUserModal()`、举报 `openReportModal()`、兴趣标签、关注粉丝屏蔽列表、创作者中心 `openCreatorModal()`、管理后台 `openAdminModal()` |
| `web/index.html` | 新增 `<section id="discoverView">`（底部第四个标签「发现」）+ 6 个新弹窗（举报 / 用户资料 / 兴趣编辑 / 关系列表 / 创作者中心 / 管理后台）+ 发帖弹窗的「谁可以看 / 存草稿」 |
| `web/js/app.js` | 改动点：`switchTab()` 接入发现页、`postCardHtml()` 草稿/仅自己/已隐藏标记、`openDetail()` 举报入口与作者资料跳转、`loadConversations()` 置顶备忘录会话 |
| `server/server.js` | 新增 25 个接口（`/api/discover/*`、`/api/users/:id/(follow|block)`、`/api/reports`、`/api/me/creator`、`/api/admin/*`）；权限核心在文件前部：`canViewPost()`（动态可见性统一校验）、`blockedPair()`（屏蔽判断）、`requireAdmin()`、`rateLimit()` |
| `server/db.js` | `migrate()`（schema v1→v2 自动迁移，迁移前备份到 `data/migrations/`）、原子写 `save()`、`SCHEMA_VERSION` |
| `tests/api.test.mjs` 🆕 | 13 项权限与安全测试（屏蔽绕过 / 跨用户访问 / 管理员越权 / 频控等），`node --test tests/` 运行 |
| `CHANGELOG.md` 🆕 | 完整版本记录 |
| `data/migrations/`（运行时生成） | 升级前的原始数据备份，可回滚 |

---

## 🆕 DGChat 2.5 新特性

- **广场（新底栏标签）**：二手市场（状态机/收藏/联系卖家/交易确认防伪造/买家评价/卖家信用）、活动组队（报名/候补/递补/开始前提醒）、校园热榜（互动×时间衰减防刷）
- **实时通讯**：WebSocket /ws（认证/频控/降级轮询）——实时私信、在线状态、正在输入、已读回执；**群聊**（建群/邀请/公告/群主权限）
- **帖子投票**（单/多选/匿名/截止/防重复）与**校园互助**（求助→处理→已解决）
- **校园认证**：注册策略四种（开放/校园邮箱/邀请码一次性/人工审核）+ 认证徽章；**匿名保护**（去匿名仅管理员+双日志审计）
- **治理体系**：五级角色（owner/admin/moderator/auditor/user）+ 版主分版块授权 + 禁言/处罚/申诉人工复核 + 反垃圾（重复内容/垃圾链接自动举报）
- **通知偏好**：类型开关 + 免打扰时段；**数据可靠性**：写队列防并发覆盖（测试证据）+ 损坏自动恢复
- **部署**：Dockerfile + docker-compose + .env.example + [docs/DEPLOY.md](docs/DEPLOY.md)（三模式/HTTPS/备份恢复/升级回滚/卸载）+ 首次启动向导（站点设置）+ 插件接口
- 数据 schema v4（自动迁移 + 迁移前备份）；测试 **61 项**全绿

## 🆕 DGChat 2.1 新特性

- **收藏夹**：多收藏夹管理（创建/重命名/删除），收藏可归入指定夹；专属管理页 + 分页 + 取消收藏；仅本人可见
- **通知中心**：顶栏铃铛 + 未读角标；点赞 / 评论 / @提及 / 关注 / 私信通知；去重、已读、删除、点击跳转
- **统一搜索**：动态（时间/作者/带图/相关度）/ 用户 / 话题三合一；本机搜索历史（可关闭）
- **话题系统**：发帖用 `#话题名#` 创建；发现页「热门话题」（按独立参与者防刷榜）；话题详情页
- **隐私与互动**：私密账号（关注需审批）、谁可私信/评论（所有人或我关注的人）、静音、隐藏单条动态——全部服务端强制
- **私信增强**：5 分钟内撤回、引用回复、会话内搜索、clientId 幂等防重发、断线保留待重发
- **账号安全中心**：登录会话列表（按设备）、退出其他设备、我的数据导出、账号自助注销（三重确认+审计）
- **管理统计 v2**：近 7 天活跃用户、14 天趋势、60 秒缓存
- **体验**：发帖草稿自动保存（本地，防冲突）、断网横幅提示、SW v8

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

### 一次请求的生命周期

以「发帖」为例：前端在 `web/js/app.js` 中收集表单 → `fetch` 发送 `POST /api/posts`（multipart 表单，带登录 token）→ `server/server.js` 校验 token 与参数 → 帖子写入内存中的 `db` 对象并写盘到 `data/data.json`，图片经 multer 存入 `data/uploads/` → 返回新帖 JSON → 前端渲染卡片并播放进场动画。其他操作（评论、点赞、私信）走同一条链路，改动后端只需盯住 `server/server.js` 一个文件。

---

## 🛠 自定义与二次开发

项目刻意保持「改一处、全站生效」的结构，常见定制都不需要碰构建工具：

| 想改什么 | 去哪里改 | 说明 |
| --- | --- | --- |
| 应用名 / 标题 / 页脚标语 | `web/js/brand.js` | 全站文案唯一出处，浏览器刷新即生效 |
| 版块（增删改名） | `server/db.js` → `BOARDS` | 数组顺序即版块栏顺序；改完重启服务 |
| 背景图与主题色 | `web/assets/` 加图 + `web/js/app.js` → `BG_THEMES` | 每套背景一组 HSL 强调色；顶栏/玻璃面板自动跟随 |
| 弹窗/卡片玻璃质感 | `web/style.css` 顶部 `:root` 设计令牌 | blur / tint / sheen 等全部参数化 |
| 端口 / 站点名 | 环境变量 `PORT` / `APP_NAME` | 或直接改 `server/server.js` 默认值 |
| 种子账号 | `server/db.js` → `seed()` | 仅首次启动生成；正式部署前清空 `data/` 重来 |

### 数据备份与迁移

- 全部状态只有两处：`data/data.json`（业务数据）和 `data/uploads/`（图片）。**备份 = 定时拷这两个路径**，例如 crontab：`0 3 * * * cp -r data /backup/dgchat-$(date +\%F)`。
- 迁移到新电脑 / 新服务器：整个项目目录拷走，`npm install` 重装依赖，启动即可；换域名或 IP 只需更新手机端 `brand.js` 里的 `nativeServerHost`。

### 安全注意事项

- 密码使用 **scrypt + 每用户随机盐**散列存储（`server/db.js → hashPassword`），数据库中不存在明文密码；会话使用随机 token，失效需重新登录。
- 内置演示账号密码是公开的，**正式部署前务必**：清空 `data/data.json` 重新初始化，或至少修改/删除 `seed()` 中的演示账号。
- 服务默认 HTTP 明文。公网部署时建议前置 Nginx / Caddy 做 HTTPS 反向代理，并限制 CORS 与上传大小（`server.js` 内已有单图限制，可按需收紧）。
- 管理员 = id 为 1 的账号，拥有删帖/删评论全权；请像保管服务器密码一样保管它。

---

## 🗺 路线图

以下为计划中的改进（按优先级），欢迎在 Issues 中催更或认领：

- [ ] **数据防丢加固**：JSON 原子写（临时文件 + rename）+ 每日自动备份滚动保留 —— 解决异常断电丢数据
- [ ] **私信实时化**：轮询升级为 WebSocket，消息即时到达
- [ ] **iOS 端字体缩放适配**：与安卓 `textZoom=100` 对齐的系统缩放免疫
- [ ] **状态栏原生控制**：接入 `@capacitor/status-bar`，深色背景下状态栏图标自动反色
- [ ] **账号体系增强**：找回密码（邮箱验证码）、修改用户名
- [ ] **示例部署文档**：Dockerfile 与云服务器一键部署脚本

---

## 📖 使用教程

### 1. 启动与进入

1. 按上面的「快速开始」启动服务后，浏览器打开 `http://localhost:3000`。
2. 同一局域网内的其他设备（手机/平板）直接访问 `http://<你的电脑IP>:3000` 即可使用，无需安装任何东西。

### 2. 注册与登录

- 首次使用点右上角「登录」→ 切换到「注册」：填**用户名**（或直接填邮箱作为登录名）、**邮箱**（可选）、**密码**。
- 之后登录时，输入**用户名或邮箱** + 密码均可。登录状态会保存在本机，不用每次重输。
- 想退出登录：底部「我的」页 → 右上角退出按钮。

### 3. 看帖与发帖

- 首页顶部是**版块栏**（表白墙 / 二手交易 / 失物招领 / 校园资讯 / 树洞闲聊），点击切换；右侧可切换「最新 / 最热」排序，搜索框可按关键词找帖。
- 点右下角的 **＋ 悬浮按钮** 发帖：选版块 → 写标题和正文 →（可选）添加一张图片 → 发布。
- 点任意帖子卡片进入**详情页**：可查看全部评论、点赞、收藏。

### 4. 编辑与删除

- 自己发的帖子：详情页里有「编辑」「删除」按钮；编辑可改标题、正文和版块。
- 管理员（1 号账号）可以删除任何人的帖子，用于处理违规内容。

### 5. 评论、点赞与收藏

- **评论**：详情页底部输入框发言，自己的评论可删除。
- **点赞**：卡片和详情页的心形按钮，再点一次取消。
- **收藏**：详情页收藏图标 → 到底栏「我的」→「我的收藏」随时回看。

### 6. 私信

- 在帖子详情页点对方头像/用户名即可发起私信；或到底栏「私信」页选择会话继续聊。
- 会话列表显示最近联系人、最后一条消息与未读提示；新消息自动轮询刷新。

### 7. 头像与个人资料

- 底栏「我的」→ 点击自己的头像圈 → 选一张图片：应用会自动裁成圆形构图并压缩后上传，全站（帖子、评论、私信列表）同步显示。
- 「我的」页还有三个标签页：我的帖子 / 我的收藏 / 我点赞的。

### 8. 背景与主题

- 底栏「我的」→ **背景**栏有五套主题：波纹 / 极光 / 暮色 / 翡翠 / 曜石。
- 切换后不只是换壁纸：顶栏、玻璃面板的色调会自动从背景图取色联动，全局统一。

### 9. 手机安装（两种方式）

| 方式 | 步骤 | 适合 |
| --- | --- | --- |
| **PWA（最简单）** | 手机浏览器访问服务地址 → 安卓 Chrome 菜单「添加到主屏幕」/ iOS Safari 分享 →「添加到主屏幕」 | 不想装 App，点开即用 |
| **App 安装包** | 到本仓库 [Releases / Actions](https://github.com/adragonhope97-pixel/DGChat/actions) 下载 `dgchat-debug.apk`（安卓直接安装）或 `dgchat-unsigned.ipa`（iOS 需用 AltStore / Sideloadly 侧载签名） | 想要独立 App 图标与全屏体验 |

> 手机 App / PWA 访问的是你电脑上跑的服务：确保手机和电脑在同一 Wi-Fi，且电脑 IP 没变（变了就改 `web/js/brand.js` 里的 `nativeServerHost` 后重新构建，PWA 则无需任何操作）。

### 10. 常见问题

| 问题 | 解决 |
| --- | --- |
| 打不开页面 | 确认服务在跑（`npm start`），确认端口 3000 没被占用，手机端确认同一局域网 |
| 图片/头像上传失败 | `uploads/` 目录会自动创建；确认没有手工把 `data/`、`uploads/` 设为只读 |
| 数据想清空重来 | 停服 → 删除 `data/data.json` → 重启，自动重建种子数据 |
| 忘记管理员密码 | 同上清空数据（管理员是种子里的 1 号账号 `demo`） |
| 换了电脑/迁移 | 整个目录拷走即可，数据都在 `data/` 里；`node_modules` 重装一遍 |

---

## 🧑‍💻 导入 VS Code 开发

### 1. 把项目拿到本地

**方式 A：git 克隆（推荐，方便以后拉更新）**

```bash
git clone https://github.com/adragonhope97-pixel/DGChat.git
cd DGChat
```

**方式 B：直接下载压缩包**

打开仓库首页 → 绿色 **Code** 按钮 → **Download ZIP** → 解压到任意目录（路径建议不含中文和空格，例如 `D:\projects\DGChat`）。

### 2. 用 VS Code 打开

- 启动 VS Code → **文件 → 打开文件夹**（File → Open Folder）→ 选中 `DGChat` 根目录（注意是根目录，不是某个子文件夹）。
- 或者更省事：在项目文件夹里右键 →「通过 Code 打开」（安装 VS Code 时勾选了该选项即可），或在 VS Code 终端里执行 `code .`。
- 首次打开如果弹出「是否信任此文件夹的作者」，点 **是，我信任**（本地自建项目）。

### 3. 安装依赖

VS Code 里按 <kbd>Ctrl</kbd>+<kbd>`</kbd>（反引号，Tab 上面那个键）打开**集成终端**，执行：

```bash
npm install
```

> 前提是已安装 Node.js（≥ 18）：终端里运行 `node -v` 能打印版本号即可。没装的话去 [nodejs.org](https://nodejs.org) 下载 LTS 版安装后**重启 VS Code**。

### 4. 一键启动（两种方式任选）

**方式 A：调试模式（可打断点，推荐开发时用）**

1. 仓库自带调试配置，按 <kbd>F5</kbd>（或左侧「运行和调试」面板 → 顶部的绿色 ▶）。
2. 底部终端会打印 `已启动：http://localhost:3000`。
3. 在 `server/server.js` 的任意行号左侧点击可以打**断点**，请求打过来时会自动停住，可以逐行查看变量——这是调后端最方便的方式。

**方式 B：普通终端运行**

```bash
npm start        # 普通启动
npm run dev      # 开发模式：改了后端代码自动重启
```

### 5. 修改与实时预览

- **后端**（`server/` 下的文件）：用 `npm run dev` 或 F5（配置里带 `restart: true`），保存后自动重启生效。
- **前端**（`web/` 下的文件）：**无需重启**，保存后直接刷新浏览器就能看到。若改动没生效，强制刷新（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>）清掉浏览器缓存。
- 浏览器访问 `http://localhost:3000`，改一个地方刷新一下，即时看到效果。

### 6. 推荐的 VS Code 扩展（可选）

| 扩展 | 作用 |
| --- | --- |
| Live Server | 静态页热重载（本项目后端托管静态文件，一般用不到，改纯前端时可选） |
| ESLint / Prettier | 代码风格与格式化 |
| 中文语言包 | 界面中文化（仓库的 `.vscode/extensions.json` 已预置推荐，打开项目时 VS Code 会自动提示安装） |

### 7. 常见问题

| 问题 | 解决 |
| --- | --- |
| <kbd>F5</kbd> 没反应 / 报找不到 node | 没装 Node.js 或装完没重启 VS Code |
| 终端 `npm install` 很慢 | 换国内镜像：`npm config set registry https://registry.npmmirror.com` 后重试 |
| 端口被占用 | 终端运行 `PORT=3001 npm start` 换端口（Windows PowerShell 用 `$env:PORT=3001; npm start`） |
| 改了 CSS/JS 看不到变化 | 强制刷新浏览器；确认改的是 `web/` 目录下的文件而不是构建产物 |
| 想重置所有数据 | 停止服务 → 删除 `data/` 文件夹 → 重新启动 |

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

## 🔒 安全与部署

**已内置的防护**（详见 [CHANGELOG.md](CHANGELOG.md) 安全加固章节）：CSP 等安全响应头、CORS 白名单、会话 30 天过期、登录失败锁定、修改密码验证并吊销其他会话、上传魔数校验、请求体上限与服务器超时、全接口频控、错误响应脱敏、安全事件日志（不含敏感信息）、`node --test tests/` 覆盖权限绕过/屏蔽/越权/限频等 22 项测试。

**公网部署需人工配置**（应用层无法替代）：

| 项 | 说明 |
| --- | --- |
| Docker 一键部署 | `docker compose up -d --build`（数据卷持久化 + 健康检查），详见 [docs/DEPLOY.md](docs/DEPLOY.md) |
| HTTPS | Nginx/Caddy 终止 TLS 并反代，透传 `X-Forwarded-Proto` 后 HSTS 自动启用 |
| CDN / WAF / DDoS | 应用层限流无法抵御大流量攻击，请启用部署平台提供的防护能力 |
| 环境变量 | `PORT` / `APP_NAME` / `CORS_ORIGINS`（额外跨域来源）/ `FORCE_HSTS=1` / `SESSION_TTL_MS` / `LOGIN_MAX_FAILS` / `LOGIN_LOCK_MS` |

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

**2.0 新增接口：**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| PUT | `/api/me/profile` | 更新昵称 / 简介 / 兴趣标签 |
| GET | `/api/users/:id` | 用户公开资料（含关注状态） |
| GET | `/api/discover/users?q=&interest=` | 用户搜索（用户名/昵称/兴趣） |
| GET | `/api/discover/recommendations` | 用户推荐（共同兴趣 + 活跃度） |
| GET | `/api/discover/latest` · `/api/discover/hot` | 最新 / 热门动态 |
| POST / DELETE | `/api/users/:id/follow` | 关注 / 取关 |
| GET | `/api/me/following` · `/api/me/followers` | 关注 / 粉丝列表 |
| POST / DELETE | `/api/users/:id/block` | 屏蔽 / 取消屏蔽 |
| GET | `/api/me/blocked` | 屏蔽列表 |
| POST | `/api/reports` | 举报帖子 / 评论 / 用户 |
| GET | `/api/me/creator` | 创作者中心（统计 + 草稿 + 趋势） |
| GET | `/api/admin/users` · `/api/admin/reports` | 用户管理 / 举报处理（仅管理员） |
| POST | `/api/admin/users/:id/status` · `/api/admin/reports/:id/handle` | 账号状态 / 举报处理（仅管理员） |
| GET | `/api/admin/stats` · `/api/admin/logs` | 运营数据 / 操作日志（仅管理员） |

**2.1 新增接口：**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST / PUT / DELETE | `/api/me/folders` | 收藏夹管理 |
| GET | `/api/me/favorites?folderId=&page=` | 我的收藏（分页，仅本人） |
| DELETE | `/api/posts/:id/favorite` | 取消收藏 |
| POST / DELETE | `/api/posts/:id/hide-personal` | 隐藏 / 取消隐藏（个人视图） |
| POST / DELETE | `/api/users/:id/mute` · GET `/api/me/muted` | 静音管理 |
| GET | `/api/me/notifications` · POST `/read` · DELETE `/:id` | 通知中心 |
| PUT | `/api/me/settings` | 隐私与互动设置 |
| GET | `/api/search?type=&q=&time=&author=&sort=&page=` | 统一搜索 |
| GET | `/api/topics` · `/api/topics/:name/posts` | 话题列表与详情 |
| GET | `/api/me/follow-requests` · POST `/:id/(approve\|decline)` | 私密账号关注审批 |
| GET / DELETE | `/api/me/sessions` · POST `/logout-others` | 会话管理 |
| POST | `/api/messages/:id/recall` · GET `/api/messages/search` | 消息撤回 / 搜索 |
| GET | `/api/me/export` | 我的数据导出（频控 3 次/小时） |
| POST | `/api/me/delete` | 账号自助注销（密码 + 确认词） |

完整字段与行为以 `server/server.js` 为准（含注释）。权限测试覆盖见 `tests/api.test.mjs`（`node --test tests/` 运行）。

---

## 📄 说明

### 版本

当前版本 **v2.0.0**（数据 schema v2，旧数据自动迁移并备份到 `data/migrations/`）。版本记录见 [CHANGELOG.md](CHANGELOG.md)。

### 反馈与联系

发现 bug 或有功能建议？欢迎发邮件到 **gandragon1949@outlook.com**，或在 [Issues](https://github.com/adragonhope97-pixel/DGChat/issues) 页面提交。

### 制作名单

| 角色 | 成员 |
| --- | --- |
| 产品设计 / 需求 / 测试 | A_Dragon（adragonhope97-pixel） |
| 开发实现 | [ZCode](https://z.ai)（AI 编程助手，GLM 驱动） |

> 本项目由 A_Dragon 提出需求、把控体验并与 ZCode 结对完成：从网页版基础论坛到三端（Web / Android / iOS）交付的全部功能迭代。

### 开源致谢

本项目站在以下开源项目的肩膀上，感谢这些作者与社区（完整清单与许可声明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)）：

| 项目 | 作者 / 维护者 | 许可证 | 链接 |
| --- | --- | --- | --- |
| Express | Express.js 团队（OpenJS Foundation） | MIT | [expressjs/express](https://github.com/expressjs/express) |
| Multer | Express.js 团队 | MIT | [expressjs/multer](https://github.com/expressjs/multer) |
| Helmet | Evan Hahn 与 helmetjs 社区 | MIT | [helmetjs/helmet](https://github.com/helmetjs/helmet) |
| express-rate-limit | Nathan Friedly 创建，社区维护 | MIT | [express-rate-limit/express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) |
| Capacitor | Ionic 团队 | MIT | [ionic-team/capacitor](https://github.com/ionic-team/capacitor) |
| LiquidGlass-UI | hwyuanzi | MIT | [hwyuanzi/LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI) |
| Gitleaks | Zachary Rice 与 gitleaks 社区 | MIT | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) |
| OSV-Scanner | Google OSV 团队 | Apache-2.0 | [google/osv-scanner](https://github.com/google/osv-scanner) |
| Semgrep | Semgrep（原 r2c）团队 | LGPL-2.1 | [semgrep/semgrep](https://github.com/semgrep/semgrep) |

评估过但未采用（同样感谢）：[DOMPurify](https://github.com/cure53/DOMPurify)（Cure53，无 HTML 注入汇点故未引入）、[DualPane](https://github.com/JoryShilmover/DualPane)（Jory Shilmover，与 Capacitor 单 WebView 架构不兼容）。

### 开源与授权

- **字体**：本项目使用系统字体栈（`-apple-system / PingFang SC / 微软雅黑`）。如需苹果 SF Pro 观感，可自行获取授权字体放入 `web/assets/fonts/` 并添加 `@font-face`（SF Pro 为 Apple 专有字体，随本仓库分发需遵守其许可条款）。
- **数据**：所有数据存储于 `data/data.json` 与 `data/uploads/`，均为运行时生成。部署时注意定期备份；服务异常断电可能导致最后一次写盘丢失。
- **图标与背景**：`web/assets/` 内图标与背景图为项目自有资源，可自由替换（背景图切换后主题色自动联动）。
- **LiquidGlass-UI**：[hwyuanzi/LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)，MIT License，已本地化于 `web/vendor/liquid-glass/`。
