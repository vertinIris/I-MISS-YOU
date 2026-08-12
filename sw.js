// Service Worker — 飞行雪绒 · 星炬学院
// 设计目标：宁可走网络，也绝不返回空响应导致整页裸奔（无样式）。
const CACHE_VERSION = 'snowfluff-v11.2';
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
  './assets/favicon.svg'
];

// 安装：必须等 SHELL 全部预缓存成功，再 skipWaiting 接管。
// 若 addAll 任一资源失败，安装整体 reject → 旧 SW 继续控制 → 不会出现样式空窗。
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] shell precache failed, keeping old worker:', err);
        // 不 skipWaiting，让旧 SW 继续服务
      })
  );
});

// 激活：仅删除旧的 snowfluff-* 缓存；新 SHELL 已在 install 阶段填满，无需担心空窗。
// 逐条 catch，避免单条删除失败导致整个 claim 失败。
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
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

// 请求拦截：任何分支都必须返回有效响应，绝不返回 undefined / 空体。
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 文档：网络优先，回退缓存，再回退根 index（离线兜底）
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        } catch (e) {
          const cached = await caches.match(request, { ignoreVary: true });
          if (cached) return cached;
          const fallback = await caches.match('./index.html', { ignoreVary: true });
          if (fallback) return fallback;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
      })()
    );
    return;
  }

  // 静态资源：缓存优先，未命中则网络，网络失败则任意缓存兜底（含旧缓存，避免裸奔）
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        // 即使非 ok（如 404），也回退到任意缓存，避免返回损坏资源
        if (res && (res.ok || res.type === 'opaque')) return res;
        const any = await caches.match(request, { ignoreVary: true });
        if (any) return any;
        return res;
      } catch (e) {
        const any = await caches.match(request, { ignoreVary: true });
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
