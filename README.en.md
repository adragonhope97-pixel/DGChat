# DGChat 🐉

**DGChat** is a ready-to-run campus forum (campus wall) app: one codebase covering **Web / PWA / Android / iOS** all at once. The backend is Node.js + Express with zero database dependencies (JSON file storage), and the frontend is a vanilla HTML/CSS/JS single-page app with a "liquid glass" visual style and a multi-theme background system.

> Design philosophy: simple enough, fast enough, works out of the box. No framework, no build step, no database — clone it, `npm start`, and it runs.

简体中文 | **English** | [繁體中文（臺灣）](README.zh-TW.md)

---

## ✨ Features

### Forum core
- **Five boards**: Confessions, Second-hand Market, Lost & Found, Campus News, Free Talk
- **Post / edit / delete**: with image upload (auto-compressed); authors and admins can edit or delete
- **Comments & likes**: comment on the post detail page; like from cards or the detail page
- **Favorites**: saved posts are archived under "My Favorites" on your profile
- **Search & sorting**: keyword search, plus Latest / Hottest sorting

### Social & accounts
- **Sign up / log in**: username or email + password, with persistent sessions (token-based)
- **Profile avatar**: upload after registering (auto center-cropped and compressed to 256px JPEG on the client)
- **Direct messages**: one-on-one DMs with a conversation list, message thread, and unread badge
- **Profile page**: My Posts / My Favorites / My Likes, all in one place
- **Admin**: account #1 is the site owner (admin) and can moderate all posts and comments

### Visuals & experience
- **Liquid glass UI**: built on the open-source [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI) library (MIT, vendored locally) — cards, dialogs, and the compose button are all glass panels with cursor-tracking highlights and springy damping motion
- **Five background themes**: Ripple / Aurora / Sunset / Jade / Obsidian. Switching the background re-tints the top bar and glass panels automatically (highlight-weighted color extraction, so dark areas don't skew the hue)
- **Universal screen adaptation**: safe areas, single-row scrolling on narrow screens, compact layouts for ultra-narrow and landscape modes, immunity to system font scaling — from small phones to desktop browsers
- **PWA**: installable on desktop / home screen, Service Worker with network-first caching and a minimal offline page
- **Apple-style motion**: cubic-bezier easing throughout, with focus-in card entrance animations

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js + Express + Multer (image uploads) |
| Storage | JSON file (`data/data.json`, no database needed) |
| Frontend | Vanilla HTML / CSS / JavaScript SPA, no framework, no build |
| Visuals | [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI) (Web Components, MIT) |
| Mobile | Capacitor 8 (Android / iOS share the same web code) |
| CI | GitHub Actions (automated Android APK / unsigned iOS IPA builds) |

---

## 📖 User Guide

### 1. Launch & enter

1. After starting the server (see "Quick Start" below), open `http://localhost:3000` in your browser.
2. Other devices on the same LAN (phones/tablets) can visit `http://<your-computer-IP>:3000` directly — nothing to install.

### 2. Sign up & log in

- First time? Click "Log In" in the top-right corner → switch to "Sign Up": pick a **username** (or just use your email as the login name), an **email** (optional), and a **password**.
- Afterwards, log in with **either username or email** + password. Your session persists on the device.
- To log out: bottom tab "Me" → the logout button in the top-right corner.

### 3. Browsing & posting

- The top of the home page shows the **board bar** (Confessions / Second-hand / Lost & Found / Campus News / Free Talk); tap to switch. On the right you can toggle Latest / Hottest, and the search box finds posts by keyword.
- Tap the **＋ floating button** at the bottom-right to post: pick a board → write a title and body → (optionally) add one image → publish.
- Tap any post card to open the **detail page**: view all comments, like, and favorite.

### 4. Editing & deleting

- Your own posts: "Edit" and "Delete" buttons on the detail page; editing can change the title, body, and board.
- The admin (account #1) can delete anyone's post to handle rule-breaking content.

### 5. Comments, likes & favorites

- **Comments**: type in the box at the bottom of the detail page; you can delete your own comments.
- **Likes**: the heart button on cards and the detail page; tap again to undo.
- **Favorites**: the bookmark icon on the detail page → bottom tab "Me" → "My Favorites" to revisit anytime.

### 6. Direct messages

- On a post's detail page, tap the person's avatar/username to start a DM; or open the "Messages" tab and pick a conversation.
- The conversation list shows recent contacts, the last message, and unread badges; new messages are refreshed by polling.

### 7. Avatar & profile

- Bottom tab "Me" → tap your avatar circle → pick a picture: the app crops it into a circle, compresses it, and uploads it; it then shows everywhere (posts, comments, message lists).
- The "Me" page has three tabs: My Posts / My Favorites / My Likes.

### 8. Backgrounds & themes

- Bottom tab "Me" → the **Background** section offers five themes: Ripple / Aurora / Sunset / Jade / Obsidian.
- Switching does more than change the wallpaper: the top bar and glass panels automatically re-tint from the background image, globally and consistently.

### 9. Installing on phones (two ways)

| Method | Steps | Best for |
| --- | --- | --- |
| **PWA (simplest)** | Visit the service address in the phone browser → Android Chrome menu "Add to Home screen" / iOS Safari share → "Add to Home Screen" | No install needed; tap and go |
| **App package** | Grab `dgchat-debug.apk` (install directly on Android) or `dgchat-unsigned.ipa` (sideload on iOS via AltStore / Sideloadly) from this repo's [Releases / Actions](https://github.com/adragonhope97-pixel/DGChat/actions) | A standalone app icon and full-screen feel |

> The phone app / PWA talks to the service running on your computer: make sure the phone and computer are on the same Wi-Fi and the computer's IP hasn't changed (if it did, update `nativeServerHost` in `web/js/brand.js` and rebuild; the PWA needs nothing).

### 10. FAQ

| Problem | Fix |
| --- | --- |
| Page won't load | Make sure the server is running (`npm start`), port 3000 isn't taken, and phones are on the same LAN |
| Image/avatar upload fails | The `uploads/` folder is auto-created; make sure `data/` and `uploads/` aren't read-only |
| Start over with fresh data | Stop the server → delete `data/data.json` → restart; seed data is regenerated |
| Forgot the admin password | Same as above (the admin is seed account #1, `demo`) |
| Moving to another computer | Copy the whole folder — all data lives in `data/`; reinstall `node_modules` |

---

## 🧑‍💻 Opening in VS Code

### 1. Get the project

**Option A: git clone (recommended, easy to pull updates later)**

```bash
git clone https://github.com/adragonhope97-pixel/DGChat.git
cd DGChat
```

**Option B: download the ZIP**

On the repo home page → green **Code** button → **Download ZIP** → extract anywhere (avoid paths with non-ASCII characters or spaces, e.g. `D:\projects\DGChat`).

### 2. Open it in VS Code

- Launch VS Code → **File → Open Folder** → select the `DGChat` root folder (the root, not a subfolder).
- Or the easy way: right-click the project folder → "Open with Code" (available if you checked that option when installing VS Code), or run `code .` in a terminal.
- If asked "Do you trust the authors of the files in this folder?", click **Yes** (it's your own local project).

### 3. Install dependencies

Press <kbd>Ctrl</kbd>+<kbd>`</kbd> (backtick, above Tab) in VS Code to open the **integrated terminal**, then run:

```bash
npm install
```

> Prerequisite: Node.js ≥ 18 — running `node -v` should print a version. If not installed, get the LTS from [nodejs.org](https://nodejs.org), then **restart VS Code**.

### 4. One-click launch (pick either)

**Option A: debug mode (with breakpoints, recommended while developing)**

1. A debug config ships with the repo: press <kbd>F5</kbd> (or open the "Run and Debug" panel → the green ▶ at the top).
2. The bottom terminal prints `started: http://localhost:3000`.
3. Click left of any line number in `server/server.js` to set a **breakpoint** — execution pauses when a request hits it, so you can step through variables. The easiest way to debug the backend.

**Option B: plain terminal**

```bash
npm start        # normal start
npm run dev      # dev mode: backend auto-restarts on save
```

### 5. Edit & live preview

- **Backend** (`server/` files): use `npm run dev` or F5 (the config has `restart: true`) — it auto-restarts on save.
- **Frontend** (`web/` files): **no restart needed** — save and refresh the browser. If a change doesn't show, hard-refresh (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>).
- Browse `http://localhost:3000`, tweak, refresh, see it instantly.

### 6. Recommended VS Code extensions (optional)

| Extension | Purpose |
| --- | --- |
| Live Server | Static page hot reload (this project serves static files from the backend, so rarely needed) |
| ESLint / Prettier | Code style & formatting |
| Chinese Language Pack | Localized UI (pre-listed in `.vscode/extensions.json`; VS Code will prompt on first open) |

### 7. Troubleshooting

| Problem | Fix |
| --- | --- |
| <kbd>F5</kbd> does nothing / can't find node | Node.js not installed, or VS Code wasn't restarted after installing |
| Slow `npm install` | Switch registry: `npm config set registry https://registry.npmmirror.com`, then retry |
| Port already in use | `PORT=3001 npm start` (Windows PowerShell: `$env:PORT=3001; npm start`) |
| CSS/JS changes not showing | Hard-refresh the browser; make sure you edited files under `web/`, not build output |
| Reset all data | Stop the server → delete the `data/` folder → start again |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies (Node.js ≥ 18)
npm install

# 2. Start the server
npm start
# or dev mode (auto-restart on file changes)
npm run dev

# 3. Open in your browser
# http://localhost:3000
```

**Built-in demo accounts** (auto-created on first launch):

| Account | Password | Role |
| --- | --- | --- |
| `demo` | `demo123456` | Site owner (admin) |
| `test` / `orange` / `awei` | `123456` | Demo users |

> ⚠️ Demo accounts are for local trial only. For a real deployment, register new accounts and reset the seed data (delete `data/data.json` and restart to re-initialize).

### Configuration

| Setting | Location | Description |
| --- | --- | --- |
| Port | Env var `PORT` (default `3000`) | Server listen port |
| Site name | Env var `APP_NAME` (default `Campus Wall`) | Shown in the startup log |
| Branding copy | `web/js/brand.js` | Single source of truth for app name, title, footer tagline |
| Native API host | `web/js/brand.js` → `nativeServerHost` | LAN address of the computer running the server, used by the mobile apps |

---

## 📱 Mobile Builds (Capacitor)

The web app is packaged for Android / iOS via Capacitor, sharing the same backend API:

```bash
# Android (generate the android/ project and sync web assets)
npx cap sync android
cd android && ./gradlew assembleDebug   # output: android/app/build/outputs/apk/debug/app-debug.apk

# iOS (requires macOS + Xcode)
npm run ios:sync
cd ios/App && xcodebuild -scheme App -configuration Debug -destination 'generic/platform=iOS'
```

**CI builds**: the repo ships with two GitHub Actions pipelines — push to `main` and artifacts appear automatically:

- `.github/workflows/android-build.yml` → `dgchat-debug.apk`
- `.github/workflows/ios-build.yml` → `dgchat-unsigned.ipa` (unsigned; sign it yourself or sideload with AltStore / Sideloadly)

> The mobile app needs the same LAN as your computer, with `nativeServerHost` in `web/js/brand.js` set to the computer's LAN IP.

---

## 🗂 Project Structure

```
DGChat/
├── server/               # Backend
│   ├── server.js         # All REST routes + static hosting (port 3000)
│   └── db.js             # JSON data layer (boards / seed data / read & write)
├── web/                  # Frontend SPA
│   ├── index.html        # Three views (Posts / Messages / Me) + dialogs
│   ├── style.css         # Glass design tokens + universal screen adaptation layer
│   ├── js/
│   │   ├── app.js        # Main logic (views / DMs / avatar / themes / motion)
│   │   └── brand.js      # Branding config (single source for all copy)
│   ├── assets/           # Icons & background images
│   └── vendor/liquid-glass/  # Liquid glass component library (vendored)
├── android/              # Capacitor Android project
├── ios/                  # Capacitor iOS project
├── .github/workflows/    # APK / IPA build pipelines
└── data/                 # Generated at runtime: data.json + uploads/ (gitignored)
```

---

## 🔌 API Overview

All endpoints are prefixed with `/api`; authenticated calls pass `Authorization: Bearer <token>`.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/register` · `/api/login` | Register / log in (username or email) |
| GET | `/api/posts?board=&sort=&q=` | Post list (board / sorting / search) |
| POST | `/api/posts` | Create a post (multipart, optional image) |
| PUT / DELETE | `/api/posts/:id` | Edit / delete a post (author or admin) |
| POST / DELETE | `/api/posts/:id/like` | Like / unlike |
| POST / DELETE | `/api/posts/:id/favorite` | Favorite / unfavorite |
| GET / POST | `/api/posts/:id/comments` | Comment list / add a comment |
| GET / POST | `/api/messages` · `/api/messages/:peerId` | Conversation list / send & fetch DMs |
| GET | `/api/me` · `/api/me/favorites` | My profile / my favorites |
| POST / DELETE | `/api/me/avatar` | Upload / remove avatar |

Full fields and behavior live in `server/server.js` (commented).

---

## 📄 Notes

### Feedback & Contact

Found a bug or have a feature request? Email **gandragon1949@outlook.com**, or open an [Issue](https://github.com/adragonhope97-pixel/DGChat/issues).

### Credits

| Role | Member |
| --- | --- |
| Product design / requirements / testing | A_Dragon (adragonhope97-pixel) |
| Development | [ZCode](https://z.ai) (AI coding assistant, powered by GLM) |

> This project was conceived and shaped by A_Dragon, pair-programmed with ZCode: from the basic web forum to the full three-platform (Web / Android / iOS) delivery.

### Licensing & open source

- **Fonts**: this project uses the system font stack (`-apple-system / PingFang SC / Microsoft YaHei`). For the Apple SF Pro look, place licensed font files in `web/assets/fonts/` and add `@font-face` rules (SF Pro is Apple proprietary; redistributing it requires complying with its license terms).
- **Data**: everything is stored in `data/data.json` and `data/uploads/`, generated at runtime. Back up regularly in production; an abnormal power-off may lose the last write.
- **Icons & backgrounds**: assets in `web/assets/` are project-owned and free to replace (theme colors re-sync automatically after a background switch).
- **LiquidGlass-UI**: [hwyuanzi/LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI), MIT License, vendored at `web/vendor/liquid-glass/`.
