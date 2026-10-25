# DGChat 部署与运维指南（v2.5.0）

## 一、三种运行模式

### 1. 开发模式（本机改代码）
```bash
npm install
npm run dev          # 文件变动自动重启，http://localhost:3000
```
测试：`node --test tests/api.test.mjs tests/security.test.mjs tests/feature21.test.mjs tests/v25.test.mjs`

### 2. 本地生产模式（不用 Docker）
```bash
npm ci --omit=dev
npm start
```

### 3. Docker 生产模式（推荐）
```bash
cp .env.example .env       # 按需修改
docker compose up -d --build
docker compose logs -f     # 观察启动
```
- 数据卷：`dgchat-data`（data.json/uploads/backups）与 `dgchat-logs`（含 security.log）
- 健康检查：内置 `/api/health`（30s 间隔）
- 升级：`git pull && docker compose up -d --build`（数据卷不受影响）

## 二、首次启动向导

1. 用首个注册账号登录 → 管理后台（我的 → 管理后台 → 站点设置）
2. 配置：站点名称 / 学校名称 / 校园邮箱域名 / 注册策略（开放|校园邮箱|邀请码|人工）
3. 邀请码策略下：站点设置中批量录入邀请码（一次性消耗）
4. （可选）授予版主：管理后台 → 用户管理 → 设置角色（可限定版块）

## 三、HTTPS 生产部署（强烈建议）

```nginx
server {
  listen 443 ssl;
  server_name chat.example.edu;
  ssl_certificate     /etc/letsencrypt/live/.../fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # WebSocket (/ws)
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-Proto https;    # HSTS 自动启用
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```
环境变量同步：`TRUST_PROXY=1`（限流取真实 IP）。WS 反代必须保留 Upgrade 头，否则实时降级为轮询（功能仍可用）。

## 四、原生推送（可选，当前未启用）

站内通知完整可用；如需 FCM/APNs 推送：
1. Android：Firebase 项目 → `google-services.json` 放 `android/app/`，安装 @capacitor/push-notifications
2. iOS：APNs 证书/Key + Xcode Capability
3. 服务端需可访问推送网关并保存设备 token（当前未实现——**未配置前系统不会声称推送成功**）

## 五、备份与恢复

- 自动：每日 `data/backups/data-YYYY-MM-DD.json`（保留 7 份）+ 迁移前 `data/migrations/`
- 手动：`docker compose exec dgchat cp data/data.json data/backups/data-manual.json`（或直接拷贝卷）
- 恢复步骤：
  1. 停服：`docker compose down`（保留卷）
  2. `docker run --rm -v dgchat-data:/data -v $PWD/backup.json:/b.json alpine cp /b.json /data/data.json`
  3. 启动：`docker compose up -d` —— 若 data.json 损坏，服务会自动隔离损坏文件并从最近备份恢复（启动日志可见）
- 回滚版本：`git checkout v2.1.0 && docker compose up -d --build`（v4 数据对旧版只读兼容字段多余、不破坏）

## 六、升级到 v2.5.0 的安全步骤

1. 备份：手动复制整个 `data/` 目录（本次升级前已自动做 `data_backup_pre_v25_*`）
2. 拉代码重启；启动日志确认 `[db] 迁移 v3 -> v4`（自动备份于 data/migrations/）
3. 验证：`curl http://localhost:3000/api/health` → `{"version":"2.5.0","schema":4}`
4. 冒烟：登录 → 发帖 → 广场三个子页 → 私信
5. 回滚：停服 → 用第 1 步备份覆盖 data/data.json → `git checkout <旧版本>` 重启

## 七、故障排查

| 症状 | 排查 |
| --- | --- |
| 启动报 data.json 解析失败 | 自动恢复已触发；查 data/migrations/ 与启动日志 |
| 实时消息不达 | 反代是否透传 Upgrade；客户端会自动回落 REST 轮询 |
| 头像/图片 404 | uploads 卷挂载；跨域头 CORP=cross-origin 已默认 |
| 登录 429 | LOGIN_LOCK_MS 锁定窗口；查 logs/security.log |
| 磁盘满 | data/backups 仅 7 份轮转；logs/ 定期清理 |

## 八、卸载

```bash
docker compose down -v      # -v 同时删除数据卷（不可逆！先备份）
```
本地模式：删除项目目录即可（数据都在 data/ 内）。
