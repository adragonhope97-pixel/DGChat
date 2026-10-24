# THIRD-PARTY-NOTICES · 第三方开源组件致谢与许可声明

DGChat 在开发与运行中使用了以下优秀的开源项目。以下按用途列出**项目、作者/维护者、许可证、GitHub 链接与在本项目中的实际用途**。感谢这些项目的作者与贡献者。

> 本文件为项目直接使用的组件清单；各依赖自身的传递性依赖请见其各自仓库的 LICENSE / NOTICE。

---

## 运行时依赖（网站与移动端）

| 项目 | 作者 / 维护者 | 许可证 | 链接 | 在本项目中的用途 |
| --- | --- | --- | --- | --- |
| **Express** | Express.js 团队（OpenJS Foundation；项目由 TJ Holowaychuk 创建） | MIT | https://github.com/expressjs/express | Web 后端框架：全部 REST API 与静态资源托管 |
| **Multer** | Express.js 团队维护 | MIT | https://github.com/expressjs/multer | 帖子图片与头像的 multipart 文件上传 |
| **Helmet** | Evan Hahn 与 helmetjs 社区 | MIT | https://github.com/helmetjs/helmet | 安全响应头（CSP、nosniff、防点击劫持等） |
| **express-rate-limit** | Nathan Friedly 创建，express-rate-limit 社区维护 | MIT | https://github.com/express-rate-limit/express-rate-limit | 全部 API 的频率限制（登录/发帖/评论/私信/搜索等） |
| **Capacitor** | Ionic 团队 | MIT | https://github.com/ionic-team/capacitor | 将同一套网页代码打包为 Android / iOS 应用 |

## 前端视觉组件

| 项目 | 作者 / 维护者 | 许可证 | 链接 | 在本项目中的用途 |
| --- | --- | --- | --- | --- |
| **LiquidGlass-UI** | hwyuanzi | MIT | https://github.com/hwyuanzi/LiquidGlass-UI | 「液态玻璃」Web Components（卡片 / 弹窗 / 悬浮按钮），已本地化于 `web/vendor/liquid-glass/` |

## CI 安全扫描工具（开发与持续集成使用，非运行时中间件）

| 项目 | 作者 / 维护者 | 许可证 | 链接 | 在本项目中的用途 |
| --- | --- | --- | --- | --- |
| **Gitleaks** | Zachary Rice 创建，gitleaks 社区维护 | MIT | https://github.com/gitleaks/gitleaks | 全仓库历史密钥泄露扫描（GitHub Actions） |
| **OSV-Scanner** | Google OSV 团队 | Apache-2.0 | https://github.com/google/osv-scanner | package-lock.json 依赖漏洞扫描（GitHub Actions） |
| **Semgrep** | Semgrep（原 r2c）团队 | LGPL-2.1 | https://github.com/semgrep/semgrep | 静态安全分析（OWASP Top 10 + 项目定制规则 `.semgrep.yml`） |

## 评估过但未采用（致谢与记录）

| 项目 | 作者 / 维护者 | 许可证 | 链接 | 结论 |
| --- | --- | --- | --- | --- |
| **DOMPurify** | Cure53 与 Dominic Düsters | Apache-2.0 / MPL-2.0 双许可 | https://github.com/cure53/DOMPurify | 渲染路径审计确认本项目无 HTML 注入汇点（全部输出经转义），按最小集成原则未引入；结论记录于 CHANGELOG 2.0.1 |
| **DualPane** | Jory Shilmover | MIT | https://github.com/JoryShilmover/DualPane | 纯 Swift 双栏布局求解器，需原生 iOS 集成（本项目为 Capacitor 单 WebView 架构，且折叠区域需 iOS 27.1 SDK），评估后采用独立网页双栏方案替代；详见 `platforms/iphone-duo/docs/device-notes.md` |

---

## 许可证合规说明

- 以上 MIT / Apache-2.0 许可证均允许商用与修改，需保留版权与许可声明；本项目未修改其源码的部分（如 vendored 的 LiquidGlass-UI）保留其原始许可。
- Semgrep 为 LGPL-2.1，仅作为开发期命令行工具使用，不随本项目分发，不构成 LGPL 传染。
- 若个别项目要求在分发物中附带完整许可文本，请在正式分发安装包前将对应 LICENSE 文件一并打包。
