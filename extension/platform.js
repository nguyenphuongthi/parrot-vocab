// Cho phép trang Kho từ chạy ở hai nơi với cùng một bộ code:
//   - trong extension: dùng API chrome.* thật, đồng bộ do background.js lo;
//   - trên web (Vercel): giả lập phần chrome.* mà trang cần – lưu trữ bằng IndexedDB,
//     message gửi "background" được xử lý ngay trong trang, phát âm bằng Audio / Web Speech.
(() => {
  const html = document.documentElement;

  if (globalThis.chrome?.storage?.local) {
    globalThis.VEL_WEB = false;
    html.classList.add('is-extension');
    return;
  }

  globalThis.VEL_WEB = true;
  globalThis.SYNC_HOST = true; // sync.js chạy ngay trong trang (trên web không có background)
  html.classList.add('is-web', 'checking'); // 'checking' ẩn mọi thứ tới khi biết đã đăng nhập hay chưa

  // ---------- chrome.storage.local trên IndexedDB ----------

  const dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open('vocab-english-lens', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  async function transact(mode, work) {
    const db = await dbReady;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const result = work(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  const listeners = [];
  const channel = new BroadcastChannel('vocab-english-lens-storage'); // báo cho các tab khác
  const emit = (changes) => listeners.forEach((fn) => fn(changes, 'local'));
  channel.onmessage = (e) => emit(e.data);

  // get(null) trả về toàn bộ, giống chrome.storage.local
  async function get(keys) {
    const out = {};
    await transact('readonly', (store) => {
      if (keys == null) {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          out[cursor.key] = cursor.value;
          cursor.continue();
        };
        return;
      }
      for (const key of [].concat(keys)) {
        const req = store.get(key);
        req.onsuccess = () => req.result !== undefined && (out[key] = req.result);
      }
    });
    return out;
  }

  async function set(items) {
    await transact('readwrite', (store) => {
      for (const [key, value] of Object.entries(items)) store.put(value, key);
    });
    const changes = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: structuredClone(v) }]));
    emit(changes);
    channel.postMessage(changes);
  }

  async function remove(keys) {
    const list = [].concat(keys);
    await transact('readwrite', (store) => list.forEach((key) => store.delete(key)));
    const changes = Object.fromEntries(list.map((k) => [k, { newValue: undefined }]));
    emit(changes);
    channel.postMessage(changes);
  }

  // ---------- "Background" chạy trong trang ----------

  const player = new Audio();

  async function speak({ text, accent, audio }) {
    if (audio) {
      try {
        player.pause();
        player.src = audio;
        await player.play();
        return 'audio';
      } catch {
        // rơi xuống giọng đọc của trình duyệt
      }
    }
    const lang = accent === 'uk' ? 'en-GB' : 'en-US';
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.9;
    utter.voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-') === lang) || null;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
    return 'tts';
  }

  // Đăng xuất trên web thì xoá luôn dữ liệu trên thiết bị (máy dùng chung), dữ liệu vẫn còn trên Supabase
  async function signOutWeb() {
    await syncNow();
    await syncSignOut();
    // Lượt đồng bộ bắt đầu trước khi xoá phiên (hẹn giờ đẩy, quay lại tab…) có thể vẫn đang kéo dữ liệu
    // về – đợi nó xong rồi mới xoá, kẻo từ bị ghi lại sau khi đã xoá. Lượt mới sau đó thấy hết phiên thì dừng.
    await syncing;
    await clearLocalWords();
  }

  const handlers = {
    speak,
    wordOp: (msg) => applyWordOp(msg.op),
    syncSignIn: (msg) => syncSignIn(msg),
    syncSignOut: signOutWeb,
    syncNow: () => syncNow()
  };

  async function sendMessage(msg) {
    const handler = handlers[msg.type];
    if (!handler) return { ok: false, error: 'Chức năng này chỉ có trong extension.' };
    try {
      return { ok: true, data: await handler(msg) };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  const alarmListeners = [];
  const noopEvent = { addListener() {} };

  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    writable: true,
    value: {
      storage: { local: { get, set, remove }, onChanged: { addListener: (fn) => listeners.push(fn) } },
      runtime: { sendMessage, onInstalled: noopEvent, onStartup: noopEvent },
      alarms: {
        create: (name, { periodInMinutes }) =>
          setInterval(() => alarmListeners.forEach((fn) => fn({ name })), periodInMinutes * 60_000),
        onAlarm: { addListener: (fn) => alarmListeners.push(fn) }
      }
    }
  });

  // Đồng bộ lại khi quay lại tab / có mạng trở lại (để thấy thay đổi từ máy khác)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  window.addEventListener('online', () => syncNow());

  // PWA: cache giao diện để mở được khi mất mạng
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
