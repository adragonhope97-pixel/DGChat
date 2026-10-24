// 校园墙 Service Worker —— v7
// 策略：全部资源网络优先（并绕过 HTTP 缓存），保证永远拿到最新版；
//       只缓存完整成功的响应（res.ok 校验，杜绝截断残页进缓存）；
//       断网时：页面导航返回极简提示页，静态资源回退缓存。
const CACHE = 'appshell-v7';
const OFFLINE_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>服务暂不可用</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1424;color:#dfe7f5;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}div{text-align:center;padding:24px}b{font-size:18px}p{color:#8fa3c7;font-size:14px}</style></head><body><div><b>服务暂时不可用</b><p>请确认电脑上的服务已启动，<br>然后刷新本页面。</p></div></body></html>`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((res) => {
        // 只缓存完整成功的静态资源（导航页不缓存，永远走网络）
        if (
          res.ok &&
          url.origin === location.origin &&
          !url.pathname.startsWith('/api') &&
          !url.pathname.startsWith('/uploads') &&
          event.request.mode !== 'navigate'
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => {
        // 断网回退
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }
        return caches.match(event.request);
      })
  );
});
