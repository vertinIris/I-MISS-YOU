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
const CACHE_VERSION = 'snowfluff-v11.6.0-sw-perf';
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
  './assets/fonts/noto-serif-sc-subset.woff2',
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

// ── v11.6.0 dist 缓存策略 ──────────────────────────────────────
// 旧策略（network-first + cache:'reload'）每次刷新强制全量重下 ~725KB，
// 且国内访问 github.io 网络抖动时失败 → SW 返回空 504 → 页面裸奔（论坛“无法进入”、
// 页脚堆叠塌陷的元凶）。新策略：
//   1) 缓存优先 → 秒开、零重复下载（刷新缓慢的根治）；
//   2) 命中缓存后用 request.integrity 做 SHA-384 校验：哈希匹配才服务，
//      部署新版本时新 HTML 带新 integrity，旧缓存必然校验失败 → 自动走网络拿新产物，
//      从机制上杜绝「SW 回旧 bundle 与新 HTML 的 SRI 冲突 → 浏览器静默拒绝执行」；
//   3) 命中缓存的同时后台 revalidate（SWR），下一次刷新即为最新；
//   4) CI 每次部署改写 CACHE_VERSION → 新 SW 安装期会用 cache:'reload' 重预缓存全部
//      shell 资源，激活后缓存必然新鲜，与上述校验双保险。
function distUrl(url) {
  return url.pathname.includes('/dist/');
}

async function sha384Matches(buffer, integrity) {
  try {
    const digest = await crypto.subtle.digest('SHA-384', buffer);
    const bytes = new Uint8Array(digest);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return ('sha384-' + btoa(bin)) === integrity;
  } catch (e) {
    return false;
  }
}

// 校验缓存体是否满足页面要求的 integrity；满足则返回可用的 Response（body 重建）。
async function verifiedResponse(cached, integrity) {
  if (!integrity) return cached;
  try {
    const buf = await cached.arrayBuffer();
    if (await sha384Matches(buf, integrity)) {
      return new Response(buf, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
    }
  } catch (e) { /* 校验失败走网络 */ }
  return null;
}

// SWR：后台静默拉最新 dist 产物更新缓存（正常 fetch，可享浏览器 HTTP 缓存）。
function revalidateDist(request) {
  return fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        return caches.open(RUNTIME_CACHE)
          .then((c) => c.put(request, res.clone()).catch(() => {}));
      }
    })
    .catch(() => { /* 离线/抖动时静默保留旧缓存 */ });
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

  // 静态资源：dist 构建产物与其余资源分治
  //  - dist/*：缓存优先 + integrity 校验 + SWR（见文件头 v11.6.0 说明）
  //  - 其余（图片/字体/css 等）cache-first，校验非空防截断。
  event.respondWith(
    (async () => {
      const url = new URL(request.url);
      const integrity = request.integrity || '';

      if (distUrl(url)) {
        const cached = await safeCacheMatch(request);
        if (cached) {
          const verified = await verifiedResponse(cached, integrity);
          if (verified) {
            event.waitUntil(revalidateDist(request));
            return verified;
          }
          // 缓存体哈希不符（新部署）→ 继续走下方网络分支
        }
        try {
          const res = await fetch(request);
          if (res && (res.ok || res.type === 'opaque')) {
            if (!integrity) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {});
              return res;
            }
            try {
              const buf = await res.clone().arrayBuffer();
              if (await sha384Matches(buf, integrity)) {
                const copy = res.clone();
                caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {});
                return res;
              }
              // 网络体也不满足 integrity：交给浏览器自行判定（返回原响应，
              // 浏览器会按 SRI 规则拒绝，行为与无 SW 时一致）
              return res;
            } catch (e) {
              return res;
            }
          }
        } catch (e) { /* 网络失败 → 兜底 */ }
        const stale = await safeCacheMatch(request);
        if (stale) return stale;
        return new Response('', { status: 504, statusText: 'offline' });
      }

      const cached = await safeCacheMatch(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
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
