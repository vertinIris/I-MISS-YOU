// Service Worker — 飞行雪绒 · 星炬学院
const CACHE_VERSION = 'snowfluff-v11.0';
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

// 安装：预缓存 app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截：缓存优先，网络回退
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML 请求：网络优先，回退缓存
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return res;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：缓存优先，网络回退
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
    })
  );
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
  const url = event.notification.data && event.notification.data.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
