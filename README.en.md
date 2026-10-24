# DGChat 🐉

**DGChat** is a ready-to-run campus forum (campus wall) app: one codebase covering **Web / PWA / Android / iOS** all at once. The backend is Node.js + Express with zero database dependencies (JSON file storage), and the frontend is a vanilla HTML/CSS/JS single-page app with a "liquid glass" visual style and a multi-theme background system.

> Design philosophy: simple enough, fast enough, works out of the box. No framework, no build step, no database — clone it, `npm start`, and it runs.

**Architecture**: the browser / PWA / mobile app all load the same single-page frontend and talk to the backend over a REST API; the backend persists everything (users, posts, comments, DMs, session tokens) into one JSON file, with images on disk under `uploads/`. The mobile apps package the same frontend via Capacitor and only point the API host at the computer's LAN IP — one change ships to all four platforms at once.

**Design principles**:

- **Zero-dependency mindset** — one JSON for data, static files served directly; backup = copy files, migration = copy folder
- **Mobile-first interaction** — bottom three-tab navigation, bottom-sheet dialogs, safe-area adaptation; desktop automatically switches to centered card dialogs and a roomier layout
- **Deterministic rendering** — dialogs use a translucent solid fill instead of backdrop-filter, eliminating the Chromium glass flicker; all motion is CSS easing, no JS animation libraries

简体中文 | **English** | [繁體中文（臺灣）](README.zh-TW.md)

> **Current version v2.1** · See [CHANGELOG.md](CHANGELOG.md) for the full changelog

---

## ✨ Features

### Forum core
- **Five boards**: Confessions, Second-hand Market, Lost & Found, Campus News, Free Talk
- **Post / edit / delete**: with image upload (auto-compressed); authors and admins can edit or delete
- **Comments & likes**: comment on the post detail page (**anonymous comments** supported); like from cards or the detail page
- **Favorites**: saved posts are archived under "My Favorites" on your profile
- **Search & sorting**: keyword search, plus Latest / Hottest sorting

### Social & accounts
- **Sign up / log in**: username or email + password, with persistent sessions (token-based)
- **Profile avatar**: upload after registering (auto center-cropped and compressed to 256px JPEG on the client)
- **Direct messages**: one-on-one DMs with a conversation list, message thread, and an unread badge (live unread count on the top-bar avatar)
- **Profile page**: My Posts / My Favorites / My Likes, all in one place
- **Admin**: account #1 is the site owner (admin) and can moderate all posts and comments

### Visuals & experience
- **Liquid glass UI**: built on the open-source [LiquidGlass-UI](https://github.com/hwyuanzi/LiquidGlass-UI) library (MIT, vendored locally) — cards, dialogs, and the compose button are all glass panels with cursor-tracking highlights and springy damping motion
- **Five background themes**: Ripple / Aurora / Sunset / Jade / Obsidian. Switching the background re-tints the top bar and glass panels automatically (highlight-weighted color extraction, so dark areas don't skew the hue)
- **Universal screen adaptation**: safe areas, single-row scrolling on narrow screens, compact layouts for ultra-narrow and landscape modes, immunity to system font scaling — from small phones to desktop browsers
- **PWA**: installable on desktop / home screen, Service Worker with network-first caching and a minimal offline page
- **Apple-style motion**: cubic-bezier easing throughout, with focus-in card entrance animations

---

## 🆕 What's New in 2.0

### Discovery & social
- **Discover tab** (fourth bottom tab): recommended users / latest posts / trending posts
- **User search** by username and nickname with interest filtering; up to 8 **interest tags** per user
- **User recommendations** from shared interests + activity, each with a reason label
- **Follow system**: follow / unfollow, following & follower lists; followed users leave the recommendation pool
- **Trending** uses real interaction data: likes×3 + comments×2 + 7-day views×0.1

### Privacy & safety
- **Post visibility**: public / only-me, enforced server-side across list, detail, search, recommendations, likes and comments
- **User blocking**: blocked users can't see each other anywhere (including search), can't follow or DM each other; manageable block list
- **Reports & moderation**: report posts/comments/users → admin actions (dismiss/hide/delete/restrict/ban) → every action logged
- **Account states**: active/restricted/banned with immediate session revocation; rate limits on auth, comment and report endpoints

### Creator & operations tools
- **Creator center**: views/likes/comments/favorites stats + 7-day real trend chart + drafts (save, edit, publish, delete)
- **Admin console** (admin-only entry): user management, report handling, operations dashboard, action logs; high-risk actions require confirmation and are logged
- **Honest metrics**: views = non-author detail opens; trends are daily increments

---

## 📦 Versions & File Locations (1.0 / 2.0)

Both major versions live in this repository as git tags — neither overwrites the other:

| | **v1.0.0** | **v2.0.0** (current main) |
| --- | --- | --- |
| Scope | Basic web forum | + Discovery & social / Privacy & safety / Creator & ops tools |
| Source | `git checkout v1.0.0`, or the Source code zip on the [v1.0.0 Release](https://github.com/adragonhope97-pixel/DGChat/releases/tag/v1.0.0) | `git clone` (default main branch) |
| Binaries | none (source archive only) | [v2.0.0 Release](https://github.com/adragonhope97-pixel/DGChat/releases/tag/v2.0.0) ships APK / IPA |
| Data file | schema v1 | schema v2 (existing data auto-migrates on first launch) |

**Key files in v1.0.0** (same paths under that tag):

| File | Role |
| --- | --- |
| `server/server.js` | All REST routes: posts / comments / likes & favorites / DMs / avatar |
| `server/db.js` | JSON data layer, boards, seed data |
| `web/index.html` | Page skeleton: Posts / Messages / Me views + dialogs |
| `web/js/app.js` | All frontend logic (single file) |
| `web/style.css` | Glass design tokens + screen adaptation layer |
| `web/assets/` · `web/vendor/liquid-glass/` | Icons & backgrounds / liquid glass components |

**Added or changed in v2.0.0:**

| File | Role |
| --- | --- |
| `web/js/discover.js` 🆕 | The 2.0 frontend (~700 lines): Discover `loadDiscover()`, user profile `openUserModal()`, reports `openReportModal()`, interest tags, follow/follower/block lists, creator center `openCreatorModal()`, admin console `openAdminModal()` |
| `web/index.html` | Adds `<section id="discoverView">` (fourth bottom tab "Discover") + 6 new dialogs (report / user profile / interest editor / relations / creator center / admin) + "who can see / save draft" in the compose dialog |
| `web/js/app.js` | Changes: `switchTab()` wires the Discover tab, `postCardHtml()` draft/private/hidden badges, `openDetail()` report entry & author profile link, `loadConversations()` pinned memo thread |
| `server/server.js` | +25 endpoints (`/api/discover/*`, `/api/users/:id/(follow|block)`, `/api/reports`, `/api/me/creator`, `/api/admin/*`); permission core near the top: `canViewPost()` (unified visibility check), `blockedPair()`, `requireAdmin()`, `rateLimit()` |
| `server/db.js` | `migrate()` (schema v1→v2 auto migration, backed up to `data/migrations/`), atomic `save()`, `SCHEMA_VERSION` |
| `tests/api.test.mjs` 🆕 | 13 permission & security tests (block bypass / cross-user access / admin escalation / rate limits), run with `node --test tests/` |
| `CHANGELOG.md` 🆕 | Full version history |
| `data/migrations/` (generated) | Pre-upgrade data backups, restorable |

---

## 🆕 What's New in 2.1

- **Favorite folders**: multiple folders (create/rename/delete), paged manager, private to you
- **Notification center**: top-bar bell with unread badge; like / comment / mention / follow / DM notifications; dedupe, read, delete, click-through
- **Unified search**: posts (time/author/has-image/relevance) / users / topics; local search history (optional)
- **Topics**: create with `#topic#`; trending topics in Discover (ranked by unique participants); topic detail pages
- **Privacy controls**: private accounts (follow approval), who can DM / comment (everyone or people I follow), mute, hide individual posts — all enforced server-side
- **DM upgrades**: recall within 5 minutes, quote reply, in-conversation search, idempotent clientIds, offline retry
- **Account security center**: session list per device, revoke other sessions, data export, self-service account deletion (triple confirmation + audit)
- **Admin stats v2**: 7-day active users, 14-day trends, 60s cache
- **UX**: compose draft autosave (local, conflict-safe), offline banner, SW v8

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

### Life of a request

Take "creating a post" as an example: the frontend collects the form in `web/js/app.js` → sends `POST /api/posts` (multipart, with the session token) → `server/server.js` validates token and parameters → the post is added to the in-memory `db` object and written to `data/data.json`, while the image goes to `data/uploads/` via multer → the new post JSON returns → the frontend renders the card with its entrance animation. Every other action (comments, likes, DMs) follows the same path — backend changes happen in one file.

---

## 🛠 Customization & Secondary Development

The project is deliberately structured as "change one place, the whole site follows" — common tweaks need no build tooling:

| What to change | Where | Notes |
| --- | --- | --- |
| App name / title / footer tagline | `web/js/brand.js` | Single source for all copy; refresh to apply |
| Boards (add / remove / rename) | `server/db.js` → `BOARDS` | Array order = board bar order; restart to apply |
| Backgrounds & theme colors | add image to `web/assets/` + `BG_THEMES` in `web/js/app.js` | Each background carries its own HSL accent set; top bar / glass panels follow |
| Glass look of dialogs/cards | `:root` design tokens at the top of `web/style.css` | blur / tint / sheen — everything parameterized |
| Port / site name | env vars `PORT` / `APP_NAME` | or edit the defaults in `server/server.js` |
| Seed accounts | `seed()` in `server/db.js` | Only created on first launch; wipe `data/` to regenerate |

### Data backup & migration

- All state lives in two places: `data/data.json` (business data) and `data/uploads/` (images). **Backup = copy these two paths on a schedule**, e.g. crontab: `0 3 * * * cp -r data /backup/dgchat-$(date +\%F)`.
- Moving to a new computer / server: copy the whole project folder, `npm install`, start. Changing domain/IP only requires updating `nativeServerHost` in `brand.js` for the mobile apps.

### Security notes

- Passwords are stored as **scrypt hashes with a per-user random salt** (`server/db.js → hashPassword`) — no plaintext anywhere; sessions use random tokens that require re-login when expired.
- The demo account passwords are public. **Before a real deployment**: wipe `data/data.json` to re-initialize, or at least change/remove the accounts in `seed()`.
- The server speaks plain HTTP. For public deployment put Nginx / Caddy in front for HTTPS termination, and tighten CORS and upload limits (per-image limits already exist in `server.js`).
- The admin is the account with id 1 — full moderation power. Treat its credentials like your server password.

---

## 🗺 Roadmap

Planned improvements (in priority order) — nudge or claim them in Issues:

- [ ] **Data-loss hardening**: atomic JSON writes (temp file + rename) + rolling daily backups — fixes data loss on abnormal power-off
- [ ] **Realtime DMs**: upgrade polling to WebSocket
- [ ] **iOS font-scaling adaptation**: parity with Android's `textZoom=100`
- [ ] **Native status bar**: adopt `@capacitor/status-bar` for auto icon contrast on dark backgrounds
- [ ] **Account enhancements**: password recovery (email codes), username changes
- [ ] **Deployment docs**: Dockerfile and one-click cloud deployment script

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

## 🔒 Security & Deployment

**Built in** (see the security section of [CHANGELOG.md](CHANGELOG.md)): CSP and other security headers, CORS allowlist, 30-day session expiry, login failure lockout, password change with other-session revocation, upload magic-byte validation, request body limits and server timeouts, rate limiting across endpoints, sanitized error responses, security event logging (no secrets), and 22 permission/security tests via `node --test tests/`.

**Manual deployment requirements** (cannot be replaced by the app layer):

| Item | Note |
| --- | --- |
| HTTPS | Terminate TLS with Nginx/Caddy; HSTS auto-enables when `X-Forwarded-Proto` is forwarded |
| CDN / WAF / DDoS | App-layer rate limiting cannot stop volumetric attacks — use your platform's protection |
| Env vars | `PORT` / `APP_NAME` / `CORS_ORIGINS` / `FORCE_HSTS=1` / `SESSION_TTL_MS` / `LOGIN_MAX_FAILS` / `LOGIN_LOCK_MS` |

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

**New in 2.0:**

| Method | Path | Description |
| --- | --- | --- |
| PUT | `/api/me/profile` | Update nickname / bio / interests |
| GET | `/api/users/:id` | Public profile (with follow state) |
| GET | `/api/discover/users?q=&interest=` | User search |
| GET | `/api/discover/recommendations` | User recommendations |
| GET | `/api/discover/latest` · `/api/discover/hot` | Latest / trending posts |
| POST / DELETE | `/api/users/:id/follow` | Follow / unfollow |
| GET | `/api/me/following` · `/api/me/followers` | Following / followers |
| POST / DELETE | `/api/users/:id/block` | Block / unblock |
| GET | `/api/me/blocked` | Block list |
| POST | `/api/reports` | Report a post / comment / user |
| GET | `/api/me/creator` | Creator center (stats + drafts + trend) |
| GET | `/api/admin/users` · `/api/admin/reports` | User management / reports (admin) |
| POST | `/api/admin/users/:id/status` · `/api/admin/reports/:id/handle` | Account status / report handling (admin) |
| GET | `/api/admin/stats` · `/api/admin/logs` | Operations stats / logs (admin) |

Full fields and behavior live in `server/server.js` (commented). Permission tests: `node --test tests/`.

---

## 📄 Notes

### Version

Current version **v2.0.0** (data schema v2, existing data migrates automatically with backups in `data/migrations/`). See [CHANGELOG.md](CHANGELOG.md).

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
