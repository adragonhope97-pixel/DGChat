# DGChat —— iPhone Duo 独立适配版

本目录是 DGChat 面向 **iPhone Duo（折叠/双栏形态）** 的独立工作目录：单独开发、单独运行、单独测试，**不修改**现有网页版、Android、iOS（Capacitor）的任何工作文件。

## 适配思路

- **不按设备名称硬编码**：布局完全由真实窗口尺寸与视口环境驱动（`window.innerWidth/Height`、`visualViewport`、安全区 `env()`），阈值集中在 `config/duo.config.js`。
- **闭合（窄屏）**：单栏移动端布局，动态列表 ↔ 详情、会话列表 ↔ 对话互斥切换，选中内容优先展示。
- **展开（宽屏）**：双栏——聊天为「左会话列表 + 右对话」；动态为「左列表 + 右详情」；空间不足自动回退单栏。
- **键盘/旋转/分屏**：`visualViewport` 监听 + 状态机（`src/window-state.js`，纯函数、已单测）。
- **数据**：通过 REST 接口复用现有 DGChat 后端（不复制后端）；登录令牌独立存储（`duo_token`，与主站 `zdcw_token` 隔离）。
- **DualPane（Swift）评估结论**：MIT 许可、iOS 27.1 SDK 才有折叠区域能力、面向原生双视图——与 Capacitor 单 WebView 架构不兼容且需改造 `ios/` 工程（本任务禁止）。**未接入**，采用上述网页方案替代，详见 `docs/device-notes.md`。

## 目录结构

```
platforms/iphone-duo/
├── index.html          # 独立入口页面（双栏壳）
├── src/
│   ├── window-state.js # 布局状态机（纯函数，浏览器/Node 双环境）
│   ├── api.js          # 现有后端 REST 薄接口层（令牌独立存储）
│   └── duo-app.js      # 应用编排：布局切换、数据加载、交互
├── components/
│   └── duo-panes.js    # 面板 DOM 组件（卡片/详情/会话/气泡，全部转义输出）
├── styles/
│   └── duo.css         # 专属样式：双栏布局 + 单栏回退 + 键盘/安全区
├── config/
│   ├── duo.config.js   # 断点与 API 配置
│   └── serve.mjs       # 独立预览服务器（静态 + API 代理，零依赖）
├── tests/
│   └── layout.test.mjs # 布局判定逻辑单测（node:test，9 项）
└── docs/
    └── device-notes.md # 设备适配说明、DualPane 评估、未验证声明
```

## 运行方式（开发/预览）

```bash
# 1. 启动 DGChat 主服务（提供 API）
#    仓库根目录：npm start   （默认 http://localhost:3000）

# 2. 启动 Duo 预览服务器（独立入口，不改主服务器）
cd platforms/iphone-duo
node config/serve.mjs
# → http://localhost:4173/   （API 已同源代理，无需改 CORS）

# 可选环境变量：PORT=5000  DGCHAT_API=http://127.0.0.1:3000
```

浏览器直接打开 `http://localhost:4173/`，登录后即可使用。顶栏右侧实时显示当前布局状态（闭合/展开、键盘、窗口尺寸），配合浏览器开发者工具的响应式模式可模拟 Duo 的开合与旋转。

## 测试

```bash
# 布局状态机单测（无需浏览器/真机）
node --test platforms/iphone-duo/tests/layout.test.mjs
```

模拟尺寸验证矩阵与结果见 `docs/device-notes.md` 第 3 节（414×896 单栏 / 900×820 双栏 / 896×414 横屏双栏 / 键盘场景，全部通过）。

## 隔离承诺

- 本目录不 import、不修改 `web/`、`android/`、`ios/` 的任何文件；不改动根目录 `package.json`、构建脚本与 Capacitor 配置。
- 仅静态引用一张主站 logo 图（`../../web/assets/logo.png`，加载失败自动隐藏）。
- 存储键前缀 `duo_`，与主站令牌隔离。

## 功能清单（已与主站 2.1 对齐）

- 底栏：透明大胶囊 + 有色小滑块（跟随激活标签动画）；顶栏居中搜索框 + 通知铃铛 + 发帖按钮 + 头像（直达我的）
- 我的页：个人名片（头像/昵称/管理员标签/账号邮箱/五项统计/兴趣标签展示与提示）、内容分类（我的帖子/赞过/收藏，卡片带编辑删除）、功能矩阵玻璃网格（兴趣标签/我的收藏/关注列表/隐私与互动/账号安全/创作者中心/通知中心）、背景设置（5 预设 + 自定义上传压缩）、红色退出登录
- 创作者中心：真实统计（浏览/获赞/评论）+ 草稿箱（发布/编辑）；兴趣标签编辑（增删/保存）

- 动态：列表/详情双栏、点赞、收藏（含收藏夹选择）、评论（匿名）、发帖（版块/图片 9 张/匿名/可见性/草稿保存/话题自动提取）、隐藏动态
- 聊天：会话列表/对话双栏、备忘录（自己）、发送（clientId 幂等）、5 分钟内撤回、引用回复、未读角标
- 通知中心：铃铛 + 未读角标（30 秒轮询）、已读跳转
- 统一搜索：动态/用户/话题三tab、相关度排序、分页
- 话题：卡片与详情的话题芯片点击查看话题动态

## 已知限制

- **未在真实 iPhone Duo 设备上验证**：断点（760px）为估计值，真机到手后只需调整 `config/duo.config.js`。详见 `docs/device-notes.md` 第 4 节。
- 私信通知与消息为轮询（20 秒）；桌面通知授权、账号安全中心（会话管理/导出/注销）暂未放入 Duo 版（可用主站操作）。
