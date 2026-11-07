// Kho dữ liệu học trên máy + đồng bộ Supabase. Máy luôn giữ một bản đầy đủ (dùng được khi mất mạng);
// mỗi thay đổi được đẩy lên sau ~1,5 giây; thay đổi từ máy khác (kể cả extension tiếng Anh) được kéo về
// khi mở app, khi quay lại tab, khi có mạng trở lại và mỗi 15 phút. Hai nơi cùng sửa một mục: bản sửa sau thắng.
//
// Bảng:
//   words – tiếng Anh, key = từ viết thường (định dạng giống hệt extension Vocab English Lens)
//   items – tiếng Trung / Hàn, key = "zh:<id>" | "ko:<id>"; mục chưa học thì chưa có bản ghi (= chưa thuộc)
import { useSyncExternalStore } from 'react';
import * as kv from './kv.js';
import { supabase } from './supabase.js';
import { computeChanges, mergeRemote, wordKey } from './srs.js';

export const TABLES = ['words', 'items'];
const RPC = { words: 'push_words', items: 'push_items' };
const PUSH_DELAY = 1500;
const PAGE_SIZE = 500;
const PULL_OVERLAP = 60_000; // kéo chồng 1 phút để không sót dòng ghi cùng lúc
const PERIOD = 15 * 60_000;

let data = { words: {}, items: {} };
let dirty = { words: {}, items: {} }; // key -> updatedAt chưa đẩy lên
let status = { state: 'idle', message: '', lastSync: 0 };
let ready = false;

const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function setStatus(patch) {
  status = { ...status, ...patch };
  notify();
}

// Báo cho các tab khác cùng mở app
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('languages-store') : null;
channel?.addEventListener('message', ({ data: msg }) => {
  if (msg.type === 'changes') applyInMemory(msg.table, msg.changes, msg.dirty);
  if (msg.type === 'cleared') resetMemory();
});

function applyInMemory(table, changes, dirtyPatch) {
  const next = { ...data[table] };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  data = { ...data, [table]: next };
  if (dirtyPatch) {
    const d = { ...dirty[table] };
    for (const [k, v] of Object.entries(dirtyPatch)) {
      if (v === null) delete d[k];
      else d[k] = v;
    }
    dirty = { ...dirty, [table]: d };
  }
  notify();
}

function resetMemory() {
  data = { words: {}, items: {} };
  dirty = { words: {}, items: {} };
  notify();
}

// ---------- Nạp từ máy ----------

let loading = null;
export function loadLocal() {
  loading ||= (async () => {
    try {
      const [words, items, d] = await Promise.all([kv.getAll('words'), kv.getAll('items'), kv.getAll('dirty')]);
      const dirt = { words: {}, items: {} };
      for (const [k, v] of Object.entries(d)) {
        const [table, ...rest] = k.split('|');
        if (dirt[table]) dirt[table][rest.join('|')] = v;
      }
      data = { words, items };
      dirty = dirt;
    } catch {
      // trình duyệt chặn IndexedDB (chế độ riêng tư…): vẫn chạy được, chỉ không giữ dữ liệu trên máy
    }
    ready = true;
    notify();
  })();
  return loading;
}

// ---------- Ghi ----------

async function persist(table, changes, { markDirty = true } = {}) {
  const now = Date.now();
  const dirtyPatch = {};
  if (markDirty) for (const [k, v] of Object.entries(changes)) dirtyPatch[k] = v?.updatedAt ?? now;
  applyInMemory(table, changes, markDirty ? dirtyPatch : null);
  channel?.postMessage({ type: 'changes', table, changes, dirty: markDirty ? dirtyPatch : null });
  try {
    await kv.putMany(table, changes);
    if (markDirty) {
      await kv.putMany('dirty', Object.fromEntries(Object.entries(dirtyPatch).map(([k, v]) => [`${table}|${k}`, v])));
    }
  } catch {
    /* không ghi được IndexedDB: dữ liệu vẫn còn trong bộ nhớ và sẽ được đẩy lên */
  }
  if (markDirty) schedulePush();
}

// op: { op: 'mark', key, mark } | { op: 'grade', key, grade } | { op: 'practice', key } | { op: 'remove', key } …
export async function apply(table, op) {
  await loadLocal();
  const { changes, results } = computeChanges(op, (k) => data[table][k], { virtual: table === 'items' });
  if (Object.keys(changes).length) await persist(table, changes);
  return op.op === 'import' ? results.length : results[0];
}

export const setMark = (table, key, mark) => apply(table, { op: 'mark', key, mark });
export const gradeCard = (table, key, grade) => apply(table, { op: 'grade', key, grade });
export const practiceCard = (table, key) => apply(table, { op: 'practice', key });
export const removeEntry = (table, key) => apply(table, { op: 'remove', key });
export const importWords = (entries) => apply('words', { op: 'import', entries });

// ---------- Đồng bộ ----------

class SyncError extends Error {}

function explain(error, table) {
  const code = error?.code;
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(code) || /does not exist|could not find/i.test(error?.message || '')) {
    return table === 'items'
      ? 'Supabase chưa có bảng items – hãy chạy file supabase/schema.sql trong SQL Editor.'
      : 'Supabase chưa có bảng words – hãy chạy schema của Vocab English Lens.';
  }
  if (/fetch|network|Failed to fetch/i.test(error?.message || '')) return 'Không kết nối được Supabase.';
  return error?.message || String(error);
}

async function pushTable(table) {
  const keys = Object.keys(dirty[table]);
  for (let i = 0; i < keys.length; i += PAGE_SIZE) {
    const batch = keys.slice(i, i + PAGE_SIZE);
    const sent = Object.fromEntries(batch.map((k) => [k, dirty[table][k]]));
    const items = batch.map((key) => {
      const w = data[table][key];
      return w
        ? { key, data: w, deleted: false, updated_at: w.updatedAt || sent[key] }
        : { key, data: null, deleted: true, updated_at: sent[key] };
    });
    const { error } = await supabase.rpc(RPC[table], { items });
    if (error) throw new SyncError(explain(error, table));
    // Chỉ bỏ những thay đổi đã gửi; mục nào vừa sửa tiếp trong lúc gửi thì giữ lại cho lần sau.
    const cleared = {};
    for (const key of batch) if (dirty[table][key] === sent[key]) cleared[key] = null;
    applyInMemory(table, {}, cleared);
    channel?.postMessage({ type: 'changes', table, changes: {}, dirty: cleared });
    await kv.putMany('dirty', Object.fromEntries(Object.keys(cleared).map((k) => [`${table}|${k}`, null]))).catch(() => {});
  }
}

const normalize = {
  words: (d, key) => ({ ...d, word: wordKey(d?.word || key) }),
  items: (d) => d,
};

async function pullTable(table) {
  const cursorKey = `cursor:${table}`;
  const cursor = await kv.get('meta', cursorKey).catch(() => null);
  const since = cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP).toISOString() : null;
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = supabase
      .from(table)
      .select('key,data,deleted,updated_at,synced_at')
      .order('synced_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (since) q = q.gt('synced_at', since);
    const { data: page, error } = await q;
    if (error) throw new SyncError(explain(error, table));
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (!rows.length) return;

  const changes = {};
  let next = cursor;
  for (const row of rows) {
    const local = row.key in changes ? changes[row.key] : data[table][row.key];
    const merged = mergeRemote(local, dirty[table][row.key], row, normalize[table]);
    if (merged !== undefined) changes[row.key] = merged;
    if (!next || row.synced_at > next) next = row.synced_at;
  }
  if (Object.keys(changes).length) await persist(table, changes, { markDirty: false });
  await kv.putMany('meta', { [cursorKey]: next }).catch(() => {});
}

let syncing = null;
export function syncNow() {
  syncing ||= (async () => {
    await loadLocal();
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    setStatus({ state: 'syncing', message: '' });
    const run = async () => {
      for (const table of TABLES) {
        await pushTable(table);
        await pullTable(table);
      }
    };
    try {
      // Nhiều tab: chỉ một tab đồng bộ tại một thời điểm
      if (navigator.locks) await navigator.locks.request('languages-sync', run);
      else await run();
      setStatus({ state: 'ok', message: '', lastSync: Date.now() });
    } catch (err) {
      setStatus({ state: navigator.onLine === false ? 'offline' : 'error', message: err.message || String(err) });
    }
  })().finally(() => (syncing = null));
  return syncing;
}

let pushTimer = null;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, PUSH_DELAY);
}

// Gọi khi đã đăng nhập. Trả về hàm huỷ.
export function startSync() {
  const onVisible = () => document.visibilityState === 'visible' && syncNow();
  const onOnline = () => syncNow();
  const timer = setInterval(syncNow, PERIOD);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  syncNow();
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

export function pendingCount() {
  return Object.keys(dirty.words).length + Object.keys(dirty.items).length;
}

// Đăng xuất: cố đẩy nốt thay đổi, rồi xoá dữ liệu trên thiết bị (vẫn còn trên Supabase).
export async function clearLocal() {
  clearTimeout(pushTimer);
  await syncing;
  await kv.clearAll().catch(() => {});
  resetMemory();
  channel?.postMessage({ type: 'cleared' });
  status = { state: 'idle', message: '', lastSync: 0 };
}

// ---------- React ----------

export function useTable(table) {
  return useSyncExternalStore(subscribe, () => data[table]);
}

export function useStoreReady() {
  return useSyncExternalStore(subscribe, () => ready);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, () => status);
}

export function usePending() {
  return useSyncExternalStore(subscribe, pendingCount);
}

// Tiến độ một ngôn ngữ trong bảng items: { "<id>": entry } (bỏ tiền tố "zh:" / "ko:")
const langCache = new Map();
export function useLangItems(lang) {
  const items = useTable('items');
  const cached = langCache.get(lang);
  if (cached && cached.src === items) return cached.out;
  const prefix = `${lang}:`;
  const out = {};
  for (const [k, v] of Object.entries(items)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  langCache.set(lang, { src: items, out });
  return out;
}

export const itemKey = (lang, id) => `${lang}:${id}`;
