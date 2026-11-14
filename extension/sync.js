// Đồng bộ sổ từ với Supabase (chạy trong background của extension).
// chrome.storage.local vẫn là bản chính trên máy: dùng được khi offline, thay đổi chưa gửi nằm trong `dirty`.
// Mọi lần ghi kho từ đi qua withWriteLock (shared.js) để không đè lên thao tác của người dùng.
// Lưu trong storage:
//   syncConfig:  { url, anonKey }
//   syncSession: { access_token, refresh_token, expires_at, email }
//   syncCursor:  synced_at lớn nhất đã kéo về
//   syncState:   { status: 'off' | 'syncing' | 'ok' | 'error', message, lastSync }

const SYNC_ALARM = 'vocab-sync';
const PUSH_DELAY = 1500; // ms: gom các thao tác liên tiếp thành một lần gửi
const PAGE_SIZE = 500;
const PULL_OVERLAP = 60_000; // kéo chồng 1 phút để không sót dòng ghi cùng lúc

class SyncError extends Error {}

async function setSyncState(patch) {
  const { syncState } = await chrome.storage.local.get('syncState');
  await chrome.storage.local.set({ syncState: { status: 'off', ...syncState, ...patch } });
}

function normalizeProjectUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(clean)) {
    throw new SyncError('Project URL phải có dạng https://xxxx.supabase.co');
  }
  return clean;
}

// ---------- Đăng nhập (Supabase Auth REST) ----------

async function authRequest(config, path, body) {
  let res;
  try {
    res = await fetch(`${config.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new SyncError('Không kết nối được Supabase. Kiểm tra mạng và Project URL.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error_description || data.msg || data.message || `HTTP ${res.status}`;
    if (res.status === 400 && /invalid login/i.test(detail)) throw new SyncError('Sai email hoặc mật khẩu.');
    if (res.status === 401 || /api ?key/i.test(detail)) throw new SyncError('Anon key không đúng với project này.');
    throw Object.assign(new SyncError(detail), { status: res.status });
  }
  return data;
}

function toSession(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || ''
  };
}

async function syncSignIn({ url, anonKey, email, password }) {
  const config = { url: normalizeProjectUrl(url), anonKey: (anonKey || '').trim() };
  if (!config.anonKey) throw new SyncError('Thiếu anon key.');
  const session = toSession(await authRequest(config, 'token?grant_type=password', { email, password }));

  // Lần đầu kết nối: đánh dấu mọi từ đang có trên máy là cần đẩy lên.
  // Server chỉ nhận bản nào mới hơn bản nó đang giữ, nên không đè mất dữ liệu từ máy khác.
  await withWriteLock(async () => {
    await migrateLegacyUnlocked();
    const words = await getWords();
    const { dirty = {} } = await chrome.storage.local.get('dirty');
    for (const [key, w] of Object.entries(words)) dirty[key] ??= w.updatedAt || w.addedAt || Date.now();
    await chrome.storage.local.set({ syncConfig: config, syncSession: session, syncCursor: null, dirty });
  });
  await setSyncState({ status: 'syncing', message: '', email: session.email });
  return syncNow();
}

async function syncSignOut() {
  await chrome.storage.local.remove(['syncSession', 'syncCursor']);
  await setSyncState({ status: 'off', message: '', email: '' });
}

async function getAccessToken(forceRefresh = false) {
  const { syncConfig: config, syncSession: session } = await chrome.storage.local.get(['syncConfig', 'syncSession']);
  if (!config || !session) return null;
  if (!forceRefresh && session.expires_at * 1000 - 60_000 > Date.now()) return { config, token: session.access_token };

  try {
    const fresh = toSession(
      await authRequest(config, 'token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    );
    await chrome.storage.local.set({ syncSession: { ...fresh, email: fresh.email || session.email } });
    return { config, token: fresh.access_token };
  } catch (err) {
    if (err.status >= 400 && err.status < 500) {
      await chrome.storage.local.remove('syncSession');
      throw new SyncError('Phiên đăng nhập đã hết hạn, hãy đăng nhập lại trong Cài đặt.');
    }
    throw err;
  }
}

// ---------- Gọi REST (PostgREST) ----------

async function rest(path, { method = 'GET', body } = {}, retried = false) {
  const auth = await getAccessToken();
  if (!auth) throw new SyncError('Chưa đăng nhập.');
  let res;
  try {
    res = await fetch(`${auth.config.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: auth.config.anonKey,
        authorization: `Bearer ${auth.token}`,
        'content-type': 'application/json'
      },
      body: body && JSON.stringify(body)
    });
  } catch {
    throw new SyncError('Không kết nối được Supabase.');
  }
  if (res.status === 401 && !retried) {
    await getAccessToken(true);
    return rest(path, { method, body }, true);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 404 || ['PGRST202', 'PGRST205', '42P01', '42883'].includes(data?.code)) {
      throw new SyncError('Supabase chưa có bảng words – hãy chạy file supabase/schema.sql trong SQL Editor.');
    }
    throw new SyncError(data?.message || `Supabase lỗi ${res.status}`);
  }
  return data;
}

// ---------- Đẩy lên / kéo về ----------

async function pushChanges() {
  const { dirty = {} } = await chrome.storage.local.get('dirty');
  const keys = Object.keys(dirty);
  for (let i = 0; i < keys.length; i += PAGE_SIZE) {
    const batch = keys.slice(i, i + PAGE_SIZE);
    const stored = await chrome.storage.local.get(batch.map(storageKeyOf));
    const items = batch.map((key) => {
      const w = stored[storageKeyOf(key)];
      return w
        ? { key, data: w, deleted: false, updated_at: w.updatedAt || dirty[key] }
        : { key, data: null, deleted: true, updated_at: dirty[key] };
    });
    await rest('rpc/push_words', { method: 'POST', body: { items } });

    // Chỉ bỏ những thay đổi đã gửi; từ nào vừa sửa tiếp trong lúc gửi thì giữ lại cho lần sau.
    await withWriteLock(async () => {
      const { dirty: current = {} } = await chrome.storage.local.get('dirty');
      for (const key of batch) if (current[key] === dirty[key]) delete current[key];
      await chrome.storage.local.set({ dirty: current });
    });
  }
}

async function pullChanges() {
  const { syncCursor } = await chrome.storage.local.get('syncCursor');
  const since = syncCursor ? new Date(Date.parse(syncCursor) - PULL_OVERLAP).toISOString() : null;
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const filter = since ? `&synced_at=gt.${encodeURIComponent(since)}` : '';
    const page = await rest(
      `words?select=key,data,deleted,updated_at,synced_at&order=synced_at.asc${filter}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (!rows.length) return;

  // Gộp trong khoá ghi để không đè lên thao tác người dùng vừa làm
  await withWriteLock(async () => {
    await migrateLegacyUnlocked();
    const keys = [...new Set(rows.map((r) => r.key))];
    const stored = await chrome.storage.local.get([...keys.map(storageKeyOf), 'dirty']);
    const dirty = stored.dirty || {};
    const changes = {};
    let cursor = syncCursor;
    for (const row of rows) {
      const local = changes[row.key] !== undefined ? changes[row.key] : stored[storageKeyOf(row.key)];
      const localTime = Math.max(local?.updatedAt || 0, dirty[row.key] || 0);
      if (row.updated_at > localTime) {
        changes[row.key] = row.deleted
          ? null
          : { ...row.data, key: row.key, word: wordKey(row.data.word || row.key), updatedAt: row.updated_at };
      }
      if (!cursor || row.synced_at > cursor) cursor = row.synced_at;
    }
    await writeEntriesUnlocked(changes, { markDirty: false, extra: { syncCursor: cursor } });
  });
}

let syncing = null;

function syncNow() {
  syncing ||= (async () => {
    const { syncSession } = await chrome.storage.local.get('syncSession');
    if (!syncSession) return setSyncState({ status: 'off', message: '' });
    await setSyncState({ status: 'syncing', message: '' });
    try {
      await pushChanges();
      await pullChanges();
      await setSyncState({ status: 'ok', message: '', lastSync: Date.now() });
    } catch (err) {
      await setSyncState({ status: 'error', message: err.message || String(err) });
    }
  })().finally(() => (syncing = null));
  return syncing;
}

let pushTimer = null;

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, PUSH_DELAY);
}

// ---------- Kích hoạt ----------
// Chỉ nơi giữ vai trò đồng bộ (SYNC_HOST) mới tự kích hoạt: background của extension.
// Trang Kho từ bên trong extension cũng nạp file này nhưng chỉ gọi qua background.

function ensureSyncAlarm() {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
}

if (globalThis.SYNC_HOST) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.dirty && Object.keys(changes.dirty.newValue || {}).length) schedulePush();
  });
  chrome.runtime.onInstalled.addListener(ensureSyncAlarm);
  chrome.runtime.onStartup.addListener(() => {
    ensureSyncAlarm();
    syncNow();
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) syncNow();
  });
}
