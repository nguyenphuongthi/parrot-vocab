// Service worker của bản web (PWA) – extension không dùng file này.
// Ưu tiên mạng để luôn có bản mới nhất sau mỗi lần deploy; mất mạng thì lấy bản đã cache.
const CACHE = 'vocab-english-lens-v3';
const SHELL = [
  '/', 'review.html', 'review.css', 'review.js', 'shared.js', 'sync.js', 'platform.js', 'config.js',
  'app.webmanifest', 'icons/icon32.png', 'icons/icon128.png', 'icons/icon-192.png',
  'data/cefr-j.json', 'data/cefr-c1c2.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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
  const { request } = event;
  // Chỉ xử lý file của chính trang; Supabase, audio phát âm… đi thẳng ra mạng
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('/'))
      )
  );
});
