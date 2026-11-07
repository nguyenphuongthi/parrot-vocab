// Service worker: mở được app khi mất mạng.
//   - Trang (navigation): lấy mạng trước, mất mạng thì dùng bản đã lưu
//   - /assets/* (tên file có mã băm, không đổi): lấy bộ nhớ trước
//   - /data/* (nội dung bài học, cần đăng nhập): lấy mạng trước, mất mạng thì dùng bản đã lưu
// Dữ liệu học (Supabase) không đi qua đây – đã có IndexedDB lo.
const SHELL = 'languages-shell-v1';
const DATA = 'languages-data-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/app.webmanifest', '/icons/icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(fallbackUrl || request, res.clone());
    return res;
  } catch {
    const hit = await caches.match(fallbackUrl || request);
    if (hit) return hit;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') return e.respondWith(networkFirst(e.request, SHELL, '/'));
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }
  if (url.pathname.startsWith('/data/')) e.respondWith(networkFirst(e.request, DATA));
});
