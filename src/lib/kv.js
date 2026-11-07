// IndexedDB tối giản: mỗi "store" là một bảng key → value.
//   words – kho từ tiếng Anh (giống bảng words trên Supabase)
//   items – tiến độ tiếng Trung / tiếng Hàn (bảng items)
//   dirty – "<bảng>|<key>" → updatedAt: thay đổi chưa đẩy lên server (mỗi mục một dòng để nhiều tab không ghi đè nhau)
//   meta  – con trỏ đồng bộ…
const DB_NAME = 'languages-app';
const STORES = ['words', 'items', 'dirty', 'meta'];

let dbPromise = null;

function open() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, work) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const result = work(t.objectStore(store));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function getAll(store) {
  const out = {};
  await tx(store, 'readonly', (s) => {
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out[c.key] = c.value;
      c.continue();
    };
  });
  return out;
}

export function get(store, key) {
  return tx(store, 'readonly', (s) => {
    const box = {};
    s.get(key).onsuccess = (e) => (box.value = e.target.result);
    return box;
  }).then((box) => box.value);
}

// changes: { key: value | null } – null = xoá
export function putMany(store, changes) {
  return tx(store, 'readwrite', (s) => {
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined) s.delete(k);
      else s.put(v, k);
    }
  });
}

export function clearAll() {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORES, 'readwrite');
        for (const name of STORES) t.objectStore(name).clear();
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  );
}
