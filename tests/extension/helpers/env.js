// Nạp các file của extension vào một "thiết bị" riêng (vm context) với chrome.* giả lập.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT_DIR = path.join(__dirname, '..', '..', '..', 'extension');
const read = (file) => fs.readFileSync(path.join(EXT_DIR, file), 'utf8');

function event() {
  const listeners = [];
  return { listeners, addListener: (fn) => listeners.push(fn) };
}

// chrome.storage.local trong bộ nhớ, có onChanged giống thật (xoá thì không có newValue)
function createStorage(initial = {}) {
  const store = structuredClone(initial);
  const onChanged = event();
  const emit = (changes) => onChanged.listeners.forEach((fn) => fn(changes, 'local'));
  const local = {
    async get(keys) {
      const list = keys == null ? Object.keys(store) : [].concat(keys);
      const out = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    async set(items) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: store[k], newValue: structuredClone(v) };
        store[k] = structuredClone(v);
      }
      emit(changes);
    },
    async remove(keys) {
      const changes = {};
      for (const k of [].concat(keys)) {
        if (!(k in store)) continue;
        changes[k] = { oldValue: store[k] };
        delete store[k];
      }
      if (Object.keys(changes).length) emit(changes);
    }
  };
  return { store, api: { local, onChanged } };
}

/**
 * files: các file trong extension/ cần nạp, theo thứ tự (vd. ['shared.js', 'sync.js'] hoặc ['background.js']).
 * Nếu không nạp background.js, message 'wordOp' được chuyển thẳng tới applyWordOp như nơi ghi thật.
 */
function loadExtension(files, { fetch, storage: initial, now } = {}) {
  const storage = createStorage(initial);
  const onMessage = event();
  const badge = { text: '' };
  const chrome = {
    storage: storage.api,
    runtime: {
      onMessage,
      onInstalled: event(),
      onStartup: event(),
      getURL: (p) => p,
      sendMessage: (msg) =>
        new Promise((resolve) => {
          for (const listener of onMessage.listeners) if (listener(msg, {}, resolve) === true) return;
          resolve(undefined);
        })
    },
    alarms: { create() {}, onAlarm: event() },
    action: {
      onClicked: event(),
      setBadgeText: async ({ text }) => (badge.text = text),
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {}
    },
    tabs: { create: async () => {} },
    tts: {},
    offscreen: {}
  };

  const timers = new Set();
  const ctx = vm.createContext({
    chrome,
    console,
    URL,
    AbortSignal,
    structuredClone,
    fetch: fetch || (async () => { throw new Error('Không có mạng trong test'); }),
    setTimeout: (fn, ms) => {
      const t = setTimeout(() => (timers.delete(t), fn()), ms);
      timers.add(t);
      return t;
    },
    clearTimeout: (t) => (timers.delete(t), clearTimeout(t))
  });
  ctx.self = ctx;
  if (now) ctx.Date = class extends Date { constructor(...a) { super(...(a.length ? a : [now()])); } static now() { return now(); } };
  ctx.importScripts = (...names) => names.forEach((n) => vm.runInContext(read(n), ctx, { filename: n }));
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });

  if (!files.includes('background.js')) {
    onMessage.addListener((msg, _sender, respond) => {
      const handlers = {
        wordOp: () => ctx.applyWordOp(msg.op),
        syncSignIn: () => ctx.syncSignIn(msg),
        syncSignOut: () => ctx.syncSignOut(),
        syncNow: () => ctx.syncNow()
      };
      if (!handlers[msg.type]) return false;
      Promise.resolve(handlers[msg.type]())
        .then((data) => respond({ ok: true, data }))
        .catch((err) => respond({ ok: false, error: err.message }));
      return true;
    });
  }

  // Hàm/hằng khai báo bằng const ở đầu file không thành thuộc tính của context → tra qua runInContext
  const api = new Proxy(ctx, {
    get: (target, name) => (typeof name !== 'string' || name in target ? target[name] : vm.runInContext(name, ctx))
  });

  return {
    ctx: api,
    store: storage.store,
    badge,
    // Huỷ các timer còn chờ (vd. hẹn đẩy đồng bộ) để test kết thúc gọn
    dispose: () => timers.forEach((t) => clearTimeout(t))
  };
}

const words = (device) =>
  Object.fromEntries(Object.entries(device.store).filter(([k]) => k.startsWith('w:')).map(([k, v]) => [k.slice(2), v]));

// Giá trị tạo trong vm context thuộc "realm" khác – đổi về object thường trước khi deepEqual
const plain = (v) => JSON.parse(JSON.stringify(v));

module.exports = { EXT_DIR, loadExtension, words, plain };
