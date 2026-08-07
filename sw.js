// Service Worker for Crazy Factory / 金融帝国
// PWA 离线支持（ROADMAP 阶段三）
// 策略：核心资源预缓存（install）+ Stale-While-Revalidate（运行时缓存）+ 离线回退
// 版本号：与 version.json 同步，缓存名变更即触发全量更新
const CACHE_VERSION = 'cf-v2.15.0';
const CORE_CACHE = CACHE_VERSION + '-core';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// 预缓存清单：index + 样式 + 全部游戏脚本 + 配置
const CORE_ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.json',
  './version.json',
  './scripts/game-data.js',
  './scripts/formula-system.js',
  './scripts/log-system.js',
  './scripts/skill-system.js',
  './scripts/economy-system.js',
  './scripts/market-system.js',
  './scripts/event-system.js',
  './scripts/feedback-system.js',
  './scripts/save-system.js',
  './scripts/loop-system.js',
  './scripts/render-system.js',
  './scripts/debug-system.js',
  './scripts/update-detection-system.js',
  './scripts/tutorial-system.js',
  './scripts/daily-quest-system.js',
  './scripts/analytics-system.js',
  './scripts/leaderboard-system.js',
  './scripts/invite-system.js',
  './scripts/synergy-system.js',
  './scripts/derivatives-system.js',
  './scripts/global-market-system.js',
  './scripts/crisis-system.js',
  './scripts/asset-allocation-system.js',
  './scripts/guild-system.js',
  './scripts/boost-system.js',
  './scripts/treasury-system.js',
  './scripts/subscription-system.js',
  './scripts/i18n.js',
  './scripts/game-bridge.js',
  './scripts/timer-manager.js',
  './scripts/scenario-editor-system.js',
  './scripts/mod-system.js',
  './scripts/game.js',
];

// ── Install：预缓存核心资源 ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate：清理旧版本缓存 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：Stale-While-Revalidate + 离线回退 ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 仅处理同源 GET 请求
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 静态资源（js/css）优先缓存
  const isStatic = /\.(js|css|json|svg|png|jpg|webp)$/.test(url.pathname);

  event.respondWith(
    caches.match(req).then((cached) => {
      // 命中缓存：立即返回，同时后台拉取更新缓存
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(isStatic ? CORE_CACHE : RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // 网络失败且无缓存时返回 cached（可能 undefined）

      if (cached) {
        return cached;
      }

      // 未命中缓存：走网络（或回退到离线页）
      return networkFetch.then((res) => {
        if (res) return res;
        // 导航请求离线时回退到首页
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 404, statusText: 'Offline' });
      });
    })
  );
});
