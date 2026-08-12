// Service Worker 注册 + 投稿离线队列管理
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  // 干净更新策略：新 SW 安装完成后自动接管，并在接管后重载一次页面，
  // 避免停留于「旧缓存已删、新缓存未接管」的样式空窗（无需手动清缓存）。
  function setupCleanUpdate(reg) {
    // 若页面加载时已有等待中的新 SW，直接命令其接管
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    reg.addEventListener('updatefound', function () {
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function () {
        // 新 SW 已安装且当前有旧 SW 在控制 → 立即接管
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }

  // 当新 SW 真正接管页面（controllerchange），自动重载一次以进入干净状态
  var isReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (isReloading) return;
    isReloading = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js?v=11.3')
      .then(function (reg) {
        console.log('[SW] registered, scope:', reg.scope);
        setupCleanUpdate(reg);
      })
      .catch(function (err) {
        console.warn('[SW] registration failed:', err);
      });
  });

  // 投稿离线队列：断网时存 IndexedDB，联网后 Background Sync 重放
  var SUBMIT_QUEUE_DB = 'snowfluff-submit-queue';
  var SUBMIT_QUEUE_STORE = 'pending';

  function openQueueDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open(SUBMIT_QUEUE_DB, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(SUBMIT_QUEUE_STORE)) {
          db.createObjectStore(SUBMIT_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  window.__SNOW_SUBMIT_QUEUE__ = {
    add: function (payload) {
      return openQueueDB().then(function (db) {
        if (!db) return false;
        return new Promise(function (resolve) {
          var tx = db.transaction([SUBMIT_QUEUE_STORE], 'readwrite');
          tx.objectStore(SUBMIT_QUEUE_STORE).add({ payload: payload, ts: Date.now() });
          tx.oncomplete = function () {
            if (reg.sync) { reg.sync.register('submit-post-queue'); }
            resolve(true);
          };
          tx.onerror = function () { resolve(false); };
        });
      });
    }
  };

  var reg = null;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function (r) { reg = r; });
  }

  // 监听 SW 重放消息
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'sync-replay-submissions') {
      openQueueDB().then(function (db) {
        if (!db) return;
        var tx = db.transaction([SUBMIT_QUEUE_STORE], 'readonly');
        tx.objectStore(SUBMIT_QUEUE_STORE).getAll().onsuccess = function (e) {
          var items = e.target.result || [];
          if (items.length > 0) {
            window.dispatchEvent(new CustomEvent('snowfluff:replay-submissions', { detail: items }));
          }
        };
      });
    }
  });
})();
