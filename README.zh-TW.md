# DGChat 🐉

**DGChat** 是一套開箱即用的校園論壇（校園牆）應用：一套程式碼，同時涵蓋 **Web / PWA / Android / iOS** 四種形態。後端為零資料庫依賴的 Node.js + Express（JSON 檔案儲存），前端為原生 HTML/CSS/JS 單頁應用，搭配「液態玻璃」視覺風格與多主題背景系統。

> 設計理念：夠簡潔、夠快、開箱即用。沒有框架、沒有建置流程、沒有資料庫 —— 複製下來 `npm start` 就能跑。

[简体中文](README.md) | English | **繁體中文（臺灣）**

> ※ 文中應用內功能名稱（帖子、私信、我的、发帖、评论、点赞等）保留與應用實際介面一致的簡體顯示；其餘敘述採臺灣慣用語。

---

## ✨ 功能特色

### 論壇核心
- **五大版块**：表白墙、二手交易、失物招领、校园资讯、树洞闲聊
- **发帖 / 编辑 / 删除**：支援帖子圖片上傳（自動壓縮），作者與管理員可编辑刪除
- **评论與点赞**：帖子详情页可评论，卡片與详情页都能点赞
- **收藏**：收藏的帖子歸檔在個人頁「我的收藏」
- **搜索與排序**：關鍵字搜索，最新 / 最熱排序切換

### 社交與帳號
- **注册 / 登录**：用户名或 Email + 密碼，支援記住登录狀態（token 工作階段）
- **個人头像**：注册後可上傳头像（前端自動置中裁切 + 壓縮成 256px JPEG）
- **私信系統**：站內一對一私信，會話列表 + 訊息流，未讀提醒
- **個人主頁**：我的帖子 / 我的收藏 / 我点赞的，一站式管理
- **管理員**：1 號帳號為站長（管理員），可管理所有帖子與评论

### 視覺與體驗
- **液態玻璃 UI**：基於開源套件 [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)（MIT，已本地化），卡片、彈窗、懸浮按鈕皆為玻璃材質，附光斑跟手、彈性阻尼動效
- **五套背景主題**：波纹 / 极光 / 暮色 / 翡翠 / 曜石，切換背景後頂欄與玻璃面板自動取色聯動（亮部加權取色，避免暗部拖偏色調）
- **通用螢幕自適應**：安全區、窄螢幕單行捲動、超窄螢幕與橫向緊湊版面、免疫系統字體縮放，從小螢幕手機到桌機瀏覽器都正常
- **PWA**：可安裝到桌面 / 主畫面，Service Worker 全網路優先 + 極簡離線頁
- **蘋果風格動效**：三階貝茲曲線緩動，卡片進場對焦動畫

---

## 🧱 技術棧

| 層 | 技術 |
| --- | --- |
| 後端 | Node.js + Express + Multer（圖片上傳） |
| 資料儲存 | JSON 檔案（`data/data.json`，無資料庫依賴） |
| 前端 | 原生 HTML / CSS / JavaScript 單頁應用，無框架無建置 |
| 視覺 | [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)（Web Components，MIT） |
| 行動端 | Capacitor 8（Android / iOS 共用同一套網頁程式碼） |
| CI | GitHub Actions（Android APK / iOS 未簽名 IPA 自動建置） |

---

## 📖 使用教學

### 1. 啟動與進入

1. 依照下方「快速開始」啟動服務後，瀏覽器開啟 `http://localhost:3000`。
2. 同一區域網路內的其他裝置（手機／平板）直接連 `http://<你的電腦IP>:3000` 即可使用，不必安裝任何東西。

### 2. 注册與登录

- 第一次使用點右上角「登录」→ 切換到「注册」：填**用户名**（或直接用 Email 當登录帳號）、**Email**（可選）、**密碼**。
- 之後登录時，輸入**用户名或 Email** + 密碼都可以。登录狀態會存在本機，不必每次重打。
- 想退出：底部「我的」頁 → 右上角退出按鈕。

### 3. 看文與发帖

- 首頁頂部是**版块列**（表白墙 / 二手交易 / 失物招领 / 校园资讯 / 树洞闲聊），點擊切換；右側可切換「最新 / 最熱」排序，搜索框可用關鍵字找文。
- 點右下角的 **＋ 懸浮按鈕** 发帖：選版块 → 寫標題和內文 →（可選）加一張圖片 → 發布。
- 點任一帖子卡片進入**详情页**：可看全部评论、点赞、收藏。

### 4. 编辑與刪除

- 自己發的帖子：详情页有「编辑」「刪除」按鈕；编辑可改標題、內文和版块。
- 管理員（1 號帳號）可以刪任何人的帖子，用於處理違規內容。

### 5. 评论、点赞與收藏

- **评论**：详情页底部輸入框發言，自己的评论可刪除。
- **点赞**：卡片和详情页的愛心按鈕，再點一次取消。
- **收藏**：详情页收藏圖示 → 到底欄「我的」→「我的收藏」隨時回看。

### 6. 私信

- 在帖子详情页點對方头像／用户名即可開啟私信；或到底欄「私信」頁選擇會話繼續聊。
- 會話列表顯示最近聯絡人、最後一則訊息與未讀提示；新訊息自動輪詢重新整理。

### 7. 头像與個人資料

- 底欄「我的」→ 點自己的头像圈 → 選一張圖片：應用會自動裁成圓形構圖並壓縮後上傳，全站（帖子、评论、私信列表）同步顯示。
- 「我的」頁還有三個分頁：我的帖子 / 我的收藏 / 我点赞的。

### 8. 背景與主題

- 底欄「我的」→ **背景**欄有五套主題：波纹 / 极光 / 暮色 / 翡翠 / 曜石。
- 切換後不只是換桌布：頂欄、玻璃面板的色調會自動從背景圖取色聯動，全域統一。

### 9. 手機安裝（兩種方式）

| 方式 | 步驟 | 適合 |
| --- | --- | --- |
| **PWA（最簡單）** | 手機瀏覽器連上服務網址 → Android Chrome 選單「加到主畫面」/ iOS Safari 分享 →「加入主畫面」 | 不想裝 App，點開即用 |
| **App 安裝包** | 到本儲存庫 [Releases / Actions](https://github.com/adragonhope97-pixel/DGChat/actions) 下載 `dgchat-debug.apk`（Android 直接安裝）或 `dgchat-unsigned.ipa`（iOS 需用 AltStore / Sideloadly 側載簽名） | 想要獨立 App 圖示與全螢幕體驗 |

> 手機 App / PWA 連的是你電腦上跑的服務：確認手機和電腦在同一個 Wi-Fi，且電腦 IP 沒變（變了就改 `web/js/brand.js` 裡的 `nativeServerHost` 後重新建置；PWA 則完全不用動）。

### 10. 常見問題

| 問題 | 解法 |
| --- | --- |
| 頁面打不開 | 確認服務在跑（`npm start`），確認連接埠 3000 沒被占用，手機端確認同一區網 |
| 圖片／头像上傳失敗 | `uploads/` 目錄會自動建立；確認沒有手動把 `data/`、`uploads/` 設成唯讀 |
| 資料想清空重來 | 停服 → 刪除 `data/data.json` → 重啟，自動重建種子資料 |
| 忘記管理員密碼 | 同上清空資料（管理員是種子裡的 1 號帳號 `demo`） |
| 換電腦／搬遷 | 整個資料夾拷走即可，資料都在 `data/` 裡；`node_modules` 重裝一次 |

---

## 🧑‍💻 匯入 VS Code 開發

### 1. 把專案抓到本機

**方式 A：git 複製（推薦，之後方便拉更新）**

```bash
git clone https://github.com/adragonhope97-pixel/DGChat.git
cd DGChat
```

**方式 B：直接下載壓縮檔**

開啟儲存庫首頁 → 綠色 **Code** 按鈕 → **Download ZIP** → 解壓到任意目錄（路徑建議不要有中文和空格，例如 `D:\projects\DGChat`）。

### 2. 用 VS Code 開啟

- 啟動 VS Code → **檔案 → 開啟資料夾**（File → Open Folder）→ 選 `DGChat` 根目錄（注意是根目錄，不是某個子資料夾）。
- 或是更省事：在專案資料夾按右鍵 →「以 Code 開啟」（安裝 VS Code 時有勾選即可），或在 VS Code 終端機執行 `code .`。
- 第一次開啟若跳出「是否信任此資料夾的作者」，點 **是，我信任**（本地自建專案）。

### 3. 安裝依賴

VS Code 裡按 <kbd>Ctrl</kbd>+<kbd>`</kbd>（反引號，Tab 上面那顆鍵）開啟**整合終端機**，執行：

```bash
npm install
```

> 前提是已安裝 Node.js（≥ 18）：終端機跑 `node -v` 能印出版本號即可。沒裝的話到 [nodejs.org](https://nodejs.org) 下載 LTS 版安裝後**重啟 VS Code**。

### 4. 一鍵啟動（兩種方式任選）

**方式 A：偵錯模式（可設中斷點，開發時推薦）**

1. 儲存庫自帶偵錯設定，按 <kbd>F5</kbd>（或左側「執行和偵錯」面板 → 頂部綠色 ▶）。
2. 底部終端機會印出 `已啟動：http://localhost:3000`。
3. 在 `server/server.js` 的任一行號左側點一下可以設**中斷點**，請求打進來時會自動停住，可以逐行檢視變數——這是調後端最方便的方式。

**方式 B：一般終端機執行**

```bash
npm start        # 一般啟動
npm run dev      # 開發模式：改了後端程式碼自動重啟
```

### 5. 修改與即時預覽

- **後端**（`server/` 下的檔案）：用 `npm run dev` 或 F5（設定帶 `restart: true`），存檔後自動重啟生效。
- **前端**（`web/` 下的檔案）：**不必重啟**，存檔後直接重新整理瀏覽器就能看到。若改動沒生效，強制重新整理（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>）清掉瀏覽器快取。
- 瀏覽器開 `http://localhost:3000`，改一個地方重新整理一下，即時看到效果。

### 6. 推薦的 VS Code 擴充功能（可選）

| 擴充功能 | 用途 |
| --- | --- |
| Live Server | 靜態頁熱重載（本專案由後端託管靜態檔案，一般用不到，改純前端時可選） |
| ESLint / Prettier | 程式碼風格與格式化 |
| 中文語言包 | 介面中文化（儲存庫的 `.vscode/extensions.json` 已預先建議，開啟專案時 VS Code 會自動提示安裝） |

### 7. 常見問題

| 問題 | 解法 |
| --- | --- |
| <kbd>F5</kbd> 沒反應 / 報找不到 node | 沒裝 Node.js，或裝完沒重啟 VS Code |
| 終端機 `npm install` 很慢 | 換鏡像站：`npm config set registry https://registry.npmmirror.com` 後重試 |
| 連接埠被占用 | 終端機跑 `PORT=3001 npm start` 換埠（Windows PowerShell 用 `$env:PORT=3001; npm start`） |
| 改了 CSS/JS 看不到變化 | 強制重新整理瀏覽器；確認改的是 `web/` 目錄下的檔案而不是建置產物 |
| 想重設所有資料 | 停止服務 → 刪除 `data/` 資料夾 → 重新啟動 |

---

## 🚀 快速開始

```bash
# 1. 安裝依賴（Node.js ≥ 18）
npm install

# 2. 啟動服務
npm start
# 或開發模式（檔案變動自動重啟）
npm run dev

# 3. 開瀏覽器連上
# http://localhost:3000
```

**內建示範帳號**（首次啟動自動產生）：

| 帳號 | 密碼 | 角色 |
| --- | --- | --- |
| `demo` | `demo123456` | 站長（管理員） |
| `test` / `orange` / `awei` | `123456` | 示範使用者 |

> ⚠️ 示範帳號僅供本地體驗，正式部署請注册新帳號並刪除種子資料（清空 `data/data.json` 後重啟即可重新初始化）。

### 設定項

| 設定 | 位置 | 說明 |
| --- | --- | --- |
| 連接埠 | 環境變數 `PORT`（預設 `3000`） | 服務監聽埠 |
| 站點名 | 環境變數 `APP_NAME`（預設 `Campus Wall 校園牆`） | 啟動日誌顯示 |
| 品牌文案 | `web/js/brand.js` | 應用名、標題、頁尾標語全站唯一出處 |
| 原生端介面位址 | `web/js/brand.js` → `nativeServerHost` | 手機 App 存取電腦服務的區網位址 |

---

## 📱 行動端建置（Capacitor）

網頁程式碼透過 Capacitor 打包成 Android / iOS 應用，與網頁共用同一套後端 API：

```bash
# Android（產生 android/ 專案並同步網頁資源）
npx cap sync android
cd android && ./gradlew assembleDebug   # 產物：android/app/build/outputs/apk/debug/app-debug.apk

# iOS（需 macOS + Xcode）
npm run ios:sync
cd ios/App && xcodebuild -scheme App -configuration Debug -destination 'generic/platform=iOS'
```

**CI 自動建置**：儲存庫內建兩條 GitHub Actions 流水線，推送到 `main` 分支後自動建置並在 Artifacts 提供：

- `.github/workflows/android-build.yml` → `dgchat-debug.apk`
- `.github/workflows/ios-build.yml` → `dgchat-unsigned.ipa`（未簽名，需自行簽名或用 AltStore / Sideloadly 側載）

> 手機 App 連本機服務需在同一區網，並把 `web/js/brand.js` 的 `nativeServerHost` 改成電腦的區網 IP。

---

## 🗂 專案結構

```
DGChat/
├── server/               # 後端
│   ├── server.js         # 全部 REST 路由 + 靜態託管（連接埠 3000）
│   └── db.js             # JSON 資料層（版块定義 / 種子資料 / 讀寫）
├── web/                  # 前端單頁應用
│   ├── index.html        # 三視圖（帖子/私信/我的）+ 彈窗
│   ├── style.css         # 玻璃設計令牌 + 通用螢幕自適應層
│   ├── js/
│   │   ├── app.js        # 主邏輯（視圖/私信/头像/主題/動效）
│   │   └── brand.js      # 品牌設定（全站文案唯一出處）
│   ├── assets/           # 圖示與背景圖
│   └── vendor/liquid-glass/  # 液態玻璃元件庫（本地化）
├── android/              # Capacitor Android 專案
├── ios/                  # Capacitor iOS 專案
├── .github/workflows/    # APK / IPA 自動建置流水線
└── data/                 # 執行時產生：data.json + uploads/（已 gitignore）
```

---

## 🔌 API 總覽

所有介面前綴 `/api`，登录狀態透過 `Authorization: Bearer <token>` 傳遞。

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| POST | `/api/register` · `/api/login` | 注册 / 登录（支援用户名或 Email） |
| GET | `/api/posts?board=&sort=&q=` | 帖子列表（版块 / 排序 / 搜索） |
| POST | `/api/posts` | 发帖（multipart，可帶圖） |
| PUT / DELETE | `/api/posts/:id` | 编辑 / 刪除帖子（作者或管理員） |
| POST / DELETE | `/api/posts/:id/like` | 点赞 / 取消讚 |
| POST / DELETE | `/api/posts/:id/favorite` | 收藏 / 取消收藏 |
| GET / POST | `/api/posts/:id/comments` | 评论列表 / 發表评论 |
| GET / POST | `/api/messages` · `/api/messages/:peerId` | 私信會話列表 / 訊息收發 |
| GET | `/api/me` · `/api/me/favorites` | 個人資料 / 我的收藏 |
| POST / DELETE | `/api/me/avatar` | 上傳 / 移除头像 |

完整欄位與行為以 `server/server.js` 為準（含註解）。

---

## 📄 說明

### 問題回饋

發現 bug 或有功能建議？歡迎寄信到 **gandragon1949@outlook.com**，或到 [Issues](https://github.com/adragonhope97-pixel/DGChat/issues) 頁面提交。

### 製作名單

| 角色 | 成員 |
| --- | --- |
| 產品設計 / 需求 / 測試 | A_Dragon（adragonhope97-pixel） |
| 開發實作 | [ZCode](https://z.ai)（AI 編程助理，GLM 驅動） |

> 本專案由 A_Dragon 提出需求、把控體驗並與 ZCode 結對完成：從網頁版基礎論壇到三端（Web / Android / iOS）交付的全部功能迭代。

### 開源與授權

- **字型**：本專案使用系統字型堆疊（`-apple-system / PingFang SC / 微軟正黑體`）。如需蘋果 SF Pro 觀感，可自行取得授權字型放入 `web/assets/fonts/` 並加上 `@font-face`（SF Pro 為 Apple 專有字型，隨本儲存庫散布需遵守其授權條款）。
- **資料**：所有資料儲存於 `data/data.json` 與 `data/uploads/`，皆為執行時產生。部署時請定期備份；服務異常斷電可能導致最後一次寫盤遺失。
- **圖示與背景**：`web/assets/` 內圖示與背景圖為專案自有資源，可自由替換（背景圖切換後主題色自動聯動）。
- **LiquidGlass-UI**：[hwyuanzi/LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI)，MIT License，已本地化於 `web/vendor/liquid-glass/`。
