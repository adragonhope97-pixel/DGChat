// DGChat iPhone Duo —— 独立开发/预览服务器（零依赖，Node ≥ 18）
// 作用：静态服务本目录 + 把 /api、/uploads 反向代理到现有 DGChat 后端，
//      使 duo/index.html 以同源方式访问 API，无需修改主服务器的任何文件。
//
// 用法：
//   1. 启动 DGChat 主服务（仓库根目录 npm start，默认 3000）
//   2. node config/serve.mjs            # 默认 http://localhost:4173
//      环境变量：PORT（默认 4173）、DGCHAT_API（默认 http://127.0.0.1:3000）
//   3. 浏览器打开 http://localhost:4173/
//
// 这是本目录的独立入口，不依赖也不修改主项目的 express 服务器。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;
const API = (process.env.DGCHAT_API || 'http://127.0.0.1:3000').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API / 上传文件 → 代理到 DGChat 后端（流式转发，不缓存不落盘）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    const target = API + url.pathname + url.search;
    const proxied = http.request(
      target,
      { method: req.method, headers: { ...req.headers, host: new URL(API).host } },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      }
    );
    proxied.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '无法连接 DGChat 后端（' + API + '），请先启动主服务' }));
    });
    req.pipe(proxied);
    return;
  }

  // 静态文件（限制在本目录内，防路径穿越）
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (url.pathname === '/' || url.pathname === '') file = path.join(ROOT, 'index.html');
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache', // 开发预览：始终拿最新代码
      });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });
});

server.listen(PORT, () => {
  console.log(`DGChat Duo 预览服务：http://localhost:${PORT}/  （API 代理 → ${API}）`);
});
