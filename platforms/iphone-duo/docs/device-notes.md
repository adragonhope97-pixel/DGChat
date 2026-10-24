# iPhone Duo 适配 —— 设备说明与开发文档

## 1. 适配范围与方法

- **判定原则**：不读取设备型号，只依据真实窗口环境（`window.innerWidth/innerHeight`、`visualViewport`、`env(safe-area-inset-*)`）判定布局。所有阈值集中在 `config/duo.config.js`，真机适配时只调数值，不改逻辑。
- **两种布局状态**：
  | 状态 | 条件（窗口宽度） | 布局 |
  | --- | --- | --- |
  | 闭合 / 窄屏 | `< 760px` | 单栏；列表 ↔ 详情互斥切换（选中内容优先展示） |
  | 展开 / 宽屏 | `≥ 760px` | 双栏：聊天=会话列表+对话；动态=列表+详情；空间不足（<320px）强制单栏 |
- **键盘**：`visualViewport.height < innerHeight × 0.82` 判定弹出；不改变栏式，只标记状态（`data-duo-keyboard`），输入条随 `100dvh` 贴住可视底部。
- **旋转 / 分屏 / 窗口缩放**：`resize` + `visualViewport.resize` 统一走 `applyLayout()`，状态机在 `src/window-state.js`（纯函数，已单测）。

## 2. DualPane（JoryShilmover/DualPane）评估结论

| 项 | 结论 |
| --- | --- |
| 许可证 | MIT ✅ |
| 形态 | 纯 Swift：DualPaneCore（几何求解）/ DualPaneSwiftUI（Layout 协议）/ DualPaneUIKit |
| 依赖/系统要求 | iOS 原生；折叠区域（fold regions）能力需 iOS 27.1 SDK，旧系统降级为安全区推导 |
| 与本项目兼容性 | ❌ 无法直接接入 |

**不接入的原因**：DGChat 的 iOS 端是 **Capacitor 单 WebView** 架构（`ios/App/SceneDelegate.swift` 承载一个 WKWebView），而 DualPane 解决的是**两个原生视图**的排布。要真正使用它必须：① 改造 `ios/` 工程引入 Swift Package 与自定义 SwiftUI ViewController、再托管两个 WebView —— 这会直接修改现有 iPhone 平台文件（本次任务明确禁止混入）；② 本机为 Windows，无 macOS/Xcode，无法编译验证。**替代方案**：在独立目录内用响应式 CSS/JS 实现等效双栏（本目录全部内容），接口与现有后端完全一致；若未来需要原生级双栏（如真正的折叠屏分栏动画），可在 `native/` 目录新增独立 SwiftUI 模块并独立出壳，再评估引入 DualPaneCore。

## 3. 已完成的验证（模拟尺寸）

| 验证项 | 方式 | 结果 |
| --- | --- | --- |
| 布局判定逻辑 | `node --test tests/layout.test.mjs`（9 项：断点边界/横竖屏/键盘/面板去留/兜底） | ✅ 全过 |
| 414×896（iPhone 竖屏量级） | 浏览器视口模拟 → 单栏，列表↔详情切换 | ✅ |
| 900×820（Duo 展开量级，模拟） | 浏览器视口模拟 → 双栏同显 | ✅ |
| 896×414（横屏） | 浏览器视口模拟 → 双栏（宽度驱动） | ✅ |
| 键盘弹出 | `visualViewport` 模拟高度收缩 | ✅ 状态标记正确 |
| 登录/动态/详情/聊天/发消息 | 经 serve.mjs 代理打真实后端 | ✅ |

## 4. 尚未验证 / 已知限制（如实声明）

- **未在真实 iPhone Duo 设备上验证** —— 该设备屏幕的精确折叠宽度、折叠铰链安全区、系统级分屏行为均未实测；当前断点（760px）为合理估计值，真机到手后仅需调整 `config/duo.config.js`。
- 闭合状态的中间尺寸（700~759px）按单栏处理；真实设备的 hinge 阴影区域（若有）未做内边距补偿，需真机确认后加 `env()` 或配置项。
- 本适配版为**独立网页入口**，尚未打包成独立 iOS App；与现有 Capacitor iOS 工程的集成属跨目录改动，按任务要求未实施。
- 离线能力未做（主站 SW 不覆盖本目录）；发帖图片上传入口未放入第一版。
