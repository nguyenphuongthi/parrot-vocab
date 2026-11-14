// Chạy trang Kho từ của extension (extension/review.html) như một trang web thường trong Chrome headless:
// giả lập phần chrome.* mà trang cần – lưu trữ bằng IndexedDB (giữ được qua lần tải lại trang),
// message gửi "background" được xử lý ngay trong trang (sync.js chạy tại chỗ), phát âm bằng Audio / Web Speech.
// Nạp bằng page.evaluateOnNewDocument(pageShim()) trước khi mở trang. Chỉ dùng cho test.
(() => {
  if (globalThis.chrome?.storage?.local || !/^https?:$/.test(location.protocol)) return; // bỏ qua about:blank
  globalThis.SYNC_HOST = true; // không có background: sync.js trong trang tự ghi kho và đồng bộ

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

  const handlers = {
    speak,
    wordOp: (msg) => applyWordOp(msg.op),
    syncSignIn: (msg) => syncSignIn(msg),
    syncSignOut: () => syncSignOut(),
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

})();
