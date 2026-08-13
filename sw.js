// Service Worker — 飞行雪绒 · 星炬学院
// 设计目标：宁可走网络，也绝不返回空响应导致整页裸奔（无样式）。
//
// v11.4.0 加固（针对「样式空窗 / 体验劣于 9.x」的根因）：
//   1) CACHE_VERSION 升级 → 激活时强制清理所有旧的 snowfluff-* 缓存，
//      让带旧缓存的老用户必定拉取全新资源，彻底摆脱「旧 SW 不接管 / 旧缓存空窗」。
//   2) 安装阶段逐资源预缓存，单资源失败不再连累整体（避免 addAll 原子失败导致 SW 永不接管）。
//   3) 安装结束「无条件」skipWaiting + activate「无条件」clients.claim，
//      新版本必定接管，杜绝停留在 waiting 状态服务陈旧缓存。
//   4) 启用 navigationPreload，文档导航更快。
//   5) 静态资源命中缓存时校验体积：content-length 为 0 视为损坏，回退网络，
//      绝不让空/截断的 CSS/JS 误导“渲染成功”。
const CACHE_VERSION = 'snowfluff-v11.5.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 需要预缓存的 app shell 资源
const SHELL_ASSETS = [
  './',
  './index.html',
  './forum/',
  './forum/index.html',
  './css/tokens-base.css',
  './css/tokens-snow.css',
  './css/tokens-stf.css',
  './dist/bundle-main.js',
  './dist/bundle-forum.js',
  './dist/css/main.min.css',
  './dist/css/forum.min.css',
    './css/edge-compat.css',
    './js/reset-password.js',
  './assets/favicon.svg'
];

// 安装：逐资源预缓存（非原子，单点失败不阻断整体），完成后无条件接管。
// 每个请求使用 cache: 'reload' 强制绕过浏览器 HTTP 磁盘缓存，避免旧 dist 污染。
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (res && res.ok) {
              await cache.put(url, res.clone());
            }
          } catch (err) {
            // 单资源失败容忍：宁可后续走网络，也不让整体预缓存失败而卡死接管。
            console.warn('[SW] precache skip (tolerated):', url, err && err.message);
          }
        })
      );
      // 无条件接管，避免停留在 waiting 服务陈旧缓存。
      await self.skipWaiting();
    })()
  );
});

// 激活：清理旧 snowfluff-* 缓存、启用 navigationPreload、接管所有客户端。
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
      } catch (_) { /* noop */ }

      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('snowfluff-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key).catch(() => {}))
      );
      await self.clients.claim();
    })()
  );
});

// 缓存命中校验：拒绝空/截断响应（content-length 为 0 视为损坏），避免“样式空窗”。
async function safeCacheMatch(request) {
  const res = await caches.match(request, { ignoreVary: true });
  if (!res) return null;
  const len = res.headers.get('content-length');
  if (len !== null && Number(len) === 0) return null;
  return res;
}

// 请求拦截：任何分支都必须返回有效响应，绝不返回 undefined / 空体。
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 文档：网络优先（优先用 navigationPreload），回退缓存，再回退根 index（离线兜底）
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          let res = null;
          if (self.registration.navigationPreload) {
            res = await event.preloadResponse;
          }
          if (!res) {
            res = await fetch(request);
          }
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        } catch (e) {
          const cached = await safeCacheMatch(request);
          if (cached) return cached;
          const fallback = await caches.match('./index.html', { ignoreVary: true });
          if (fallback) return fallback;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
      })()
    );
    return;
  }

  // 静态资源：缓存优先（校验非空），未命中则网络，网络失败则任意缓存兜底（含旧缓存，避免裸奔）
  event.respondWith(
    (async () => {
      const cached = await safeCacheMatch(request);
      if (cached) return cached;
      try {
        const res = await fetch(request, { cache: 'reload' });
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        }
        const any = await safeCacheMatch(request);
        if (any) return any;
        return res;
      } catch (e) {
        const any = await safeCacheMatch(request);
        if (any) return any;
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })()
  );
});

// 消息：客户端请求立即接管
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync：投稿离线队列
self.addEventListener('sync', (event) => {
  if (event.tag === 'submit-post-queue') {
    event.waitUntil(replaySubmissionQueue());
  }
});

async function replaySubmissionQueue() {
  try {
    const all = await self.clients.matchAll();
    all.forEach((client) => client.postMessage({ type: 'sync-replay-submissions' }));
  } catch (e) { /* noop */ }
}

// Push 通知（回复提醒）
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || '你有新的回复',
    icon: 'assets/favicon.svg',
    badge: 'assets/favicon.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || '飞行雪绒', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
