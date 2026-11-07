// Dùng chung cho content script, background (importScripts), trang Kho từ và bản web.
// Dữ liệu trong chrome.storage.local:
//   settings   – cấu hình người dùng
//   w:<key>    – mỗi từ một key (key = từ viết thường), để lưu một từ không phải ghi lại cả kho
//   wordIndex  – { [key]: [mark, due, ...các dạng khác] } bản gọn: content script dùng để gạch chân
//                từ trên trang, background dùng để đếm số từ cần ôn hiện trên icon
//   dirty      – { [key]: updatedAt } thay đổi (kể cả xoá) chưa đẩy lên Supabase
//   words      – (định dạng cũ: cả kho trong một key) – được tách ra ở lần ghi đầu tiên
//
// Chỉ một nơi được GHI kho từ: background của extension, hoặc chính trang web (platform.js).
// Popup và trang Kho từ gửi thao tác qua callBackground({ type: 'wordOp' }), nơi ghi chạy tuần tự.

const DEFAULT_SETTINGS = {
  enabled: true,
  accent: 'us',          // 'us' | 'uk' – giọng ưu tiên khi tự phát âm
  autoPlay: true,        // tự phát âm khi popup hiện ra / khi lật flashcard
  highlight: true,       // gạch chân từ đã có trong kho trên các trang web
  youtube: true,         // YouTube: bấm vào từ trong phụ đề để tra, video tự dừng
  ytTranslate: true,     // YouTube: phụ đề không phải tiếng Anh thì hiện thêm dòng dịch sang tiếng Anh
  deckSource: 'due',     // flashcard: 'due' = cần ôn hôm nay | 'marks' = theo mức thuộc
  deckStates: [0, 1],    // flashcard (theo mức thuộc): ôn những mức nào
  deckMode: 'en-vi',     // 'en-vi' | 'vi-en' | 'listen' | 'type'
  deckPos: 'all',        // lọc flashcard theo từ loại
  dailyGoal: 20,         // mục tiêu số thẻ flashcard ôn mỗi ngày
  msKey: '',             // Microsoft Translator – nguồn dịch dự phòng (tuỳ chọn)
  msRegion: ''
};

// Mức thuộc của từ (giống HSK-Vocab): 0 = chưa thuộc (mặc định), 1 = hơi nhớ, 2 = đã thuộc
const STATES = [
  { value: 0, label: 'Chưa thuộc' },
  { value: 1, label: 'Hơi nhớ' },
  { value: 2, label: 'Đã thuộc' }
];

const markOf = (entry) => entry?.mark ?? 0;

// Từ loại – Google trả tên tiếng Việt (hl=vi); thứ tự ở đây là thứ tự tab trong Kho từ
const POS_INFO = {
  'danh từ': { abbr: 'n.', en: 'noun' },
  'động từ': { abbr: 'v.', en: 'verb' },
  'tính từ': { abbr: 'adj.', en: 'adjective' },
  'trạng từ': { abbr: 'adv.', en: 'adverb' },
  'giới từ': { abbr: 'prep.', en: 'preposition' },
  'liên từ': { abbr: 'conj.', en: 'conjunction' },
  'đại từ': { abbr: 'pron.', en: 'pronoun' },
  'thán từ': { abbr: 'interj.', en: 'interjection' },
  'từ hạn định': { abbr: 'det.', en: 'determiner' }
};

// Từ đã lưu trước khi chuẩn hoá Unicode có thể mang tên từ loại dạng NFD
const normalizePos = (pos) => (pos || '').normalize('NFC').trim().toLowerCase();

function wordKey(text) {
  return text.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
}

// ---------- Cấp độ CEFR (A1–C2) ----------
// Dữ liệu offline trong data/ (tạo bằng scripts/build-cefr.js): CEFR-J Wordlist 1.5 (A1–B2, © Tono Laboratory,
// TUFS) và Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0). Cấp độ tính khi hiển thị, không lưu vào kho từ.

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_POS = {
  n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ',
  conj: 'liên từ', pron: 'đại từ', interj: 'thán từ', det: 'từ hạn định'
};
const CEFR_FILES = ['data/cefr-j.json', 'data/cefr-c1c2.json'];
let cefrIndexP = null;

// { từ: { loại từ: cấp } } gộp hai bộ; trùng từ + loại từ thì lấy cấp thấp hơn. Lỗi tải thì coi như không có dữ liệu.
function loadCefrIndex(base = '') {
  cefrIndexP ||= Promise.all(CEFR_FILES.map((f) => fetch(base + f).then((r) => (r.ok ? r.json() : {})).catch(() => ({})))).then(
    ([main, ...more]) => {
      const index = { ...main };
      for (const extra of more) {
        for (const [word, levels] of Object.entries(extra)) {
          const entry = (index[word] = { ...index[word] });
          for (const [pos, lv] of Object.entries(levels)) {
            if (!entry[pos] || CEFR_LEVELS.indexOf(lv) < CEFR_LEVELS.indexOf(entry[pos])) entry[pos] = lv;
          }
        }
      }
      return index;
    }
  );
  return cefrIndexP;
}

// Các dạng gốc đoán bằng cách bỏ đuôi (clues → clue, studied → study, running → run); chỉ dùng khi có trong danh sách
function simpleLemmas(word) {
  const out = [];
  const add = (w) => w.length > 1 && out.push(w);
  if (/ies$/.test(word)) add(word.slice(0, -3) + 'y');
  if (/es$/.test(word)) add(word.slice(0, -2));
  if (/s$/.test(word)) add(word.slice(0, -1));
  if (/ied$/.test(word)) add(word.slice(0, -3) + 'y');
  if (/ed$/.test(word)) add(word.slice(0, -2)), add(word.slice(0, -1));
  if (/ing$/.test(word)) add(word.slice(0, -3)), add(word.slice(0, -3) + 'e');
  for (const w of [...out]) if (/([bdgklmnprt])\1$/.test(w)) add(w.slice(0, -1)); // stopped → stopp → stop
  return out;
}

// Cấp độ của một từ: { level, byPos: { 'động từ': 'B1', ... }, lemma } hoặc null (chưa xếp cấp).
// level = cấp thấp nhất trong các loại từ khớp với nghĩa của từ (classes), không khớp loại nào thì thấp nhất nói chung.
function cefrOf(index, word, { baseForm = '', classes = [] } = {}) {
  if (!index || !word) return null;
  const key = wordKey(word);
  for (const lemma of [key, baseForm && wordKey(baseForm), ...simpleLemmas(key)]) {
    const hit = lemma && index[lemma];
    if (!hit) continue;
    const lowest = (list) => list.sort((a, b) => CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b))[0];
    const wanted = new Set([...classes].map(normalizePos));
    const matching = Object.entries(hit).filter(([pos]) => wanted.has(CEFR_POS[pos])).map(([, lv]) => lv);
    const byPos = Object.fromEntries(Object.entries(hit).filter(([pos]) => CEFR_POS[pos]).map(([pos, lv]) => [CEFR_POS[pos], lv]));
    return { level: lowest(matching.length ? matching : Object.values(hit)), byPos, lemma };
  }
  return null;
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function updateSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings });
  return settings;
}

// ---------- Đọc kho từ ----------

const WORD_PREFIX = 'w:';
const storageKeyOf = (key) => WORD_PREFIX + key;

function wordsFromItems(items) {
  const out = {};
  for (const [k, v] of Object.entries(items)) if (k.startsWith(WORD_PREFIX)) out[k.slice(WORD_PREFIX.length)] = v;
  for (const [k, v] of Object.entries(items.words || {})) out[k] ??= v; // dữ liệu dạng cũ chưa tách
  return out;
}

async function getWords() {
  return wordsFromItems(await chrome.storage.local.get(null));
}

async function getWord(text) {
  const key = wordKey(text);
  const items = await chrome.storage.local.get([storageKeyOf(key), 'words']);
  return items[storageKeyOf(key)] || items.words?.[key] || null;
}

// Các câu ngữ cảnh của từ (từ lưu bằng bản cũ chỉ có một câu `context` + `source`)
function contextsOf(w) {
  if (w?.contexts?.length) return w.contexts;
  if (!w?.context) return [];
  return [{ text: w.context, url: w.source?.url || '', title: w.source?.title || '', at: w.addedAt || 0 }];
}

// ---------- Ôn tập ngắt quãng (bản rút gọn của SM-2) ----------

const DAY = 86_400_000;
const MAX_INTERVAL = 180;

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Chấm điểm một thẻ: đặt mức thuộc và hẹn ngày ôn lại
//   chưa thuộc → ngày mai · hơi nhớ → ≥ 3 ngày, tăng chậm · đã thuộc → ≥ 7 ngày, tăng ×2,5
function gradeWord(w, grade, now = Date.now()) {
  const prev = w.srs?.interval || 0;
  const raw = grade === 0 ? 1 : grade === 1 ? Math.max(3, Math.round(prev * 1.2)) : Math.max(7, Math.round(prev * 2.5));
  const interval = Math.min(raw, MAX_INTERVAL);
  return {
    mark: grade,
    srs: {
      interval,
      due: startOfDay(now) + interval * DAY,
      reviews: (w.srs?.reviews || 0) + 1,
      lapses: (w.srs?.lapses || 0) + (grade === 0 ? 1 : 0),
      last: now
    }
  };
}

// Từ chưa ôn lần nào thì đến hạn ngay từ ngày lưu
const dueAt = (w) => w.srs?.due ?? startOfDay(w.addedAt || 0);
const isDue = (w, now = Date.now()) => dueAt(w) < startOfDay(now) + DAY;

function dueLabel(w, now = Date.now()) {
  const days = Math.round((startOfDay(dueAt(w)) - startOfDay(now)) / DAY);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'ngày mai';
  return `${days} ngày nữa`;
}

// ---------- Thống kê ----------

// Số từ được đánh dấu vào từng mức thuộc mỗi ngày của tháng (month: 0–11): counts[mức][ngày].
// Lưu từ mới = đánh dấu "Chưa thuộc". Mỗi từ tính tối đa một lần mỗi ngày, ở mức cuối cùng của ngày
// (đổi mức nhiều lần trong ngày: mức trước bị trừ 1, mức mới cộng 1); cuối ngày quay về đúng mức
// đầu ngày thì không tính. Mức đã đặt từ hôm trước không bị trừ.
function marksByDay(list, year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const out = { days, counts: STATES.map(() => Array(days).fill(0)) };
  const dayOf = (t) => {
    const d = new Date(t);
    return d.getFullYear() === year && d.getMonth() === month ? d.getDate() - 1 : -1;
  };
  for (const w of list) {
    // [thời điểm, mức trước, mức sau] – lưu mới: trước đó chưa có trong kho (null). Mức lúc thêm là
    // "Chưa thuộc", trừ từ nhập từ file (không có lịch sử): lấy từ lần đổi mức đầu tiên, hoặc mức hiện tại.
    const log = w.markLog || [];
    const addedMark = log.length ? log[0][1] : markOf(w);
    const events = [...(w.addedAt ? [[w.addedAt, null, addedMark]] : []), ...log].sort((a, b) => a[0] - b[0]);
    const byDay = new Map(); // ngày -> { start: mức đầu ngày, end: mức cuối ngày }
    for (const [at, from, to] of events) {
      const day = dayOf(at);
      if (day < 0) continue;
      if (byDay.has(day)) byDay.get(day).end = to;
      else byDay.set(day, { start: from, end: to });
    }
    for (const [day, { start, end }] of byDay) if (start !== end) out.counts[end][day]++;
  }
  return out;
}

// Số thẻ flashcard đã ôn hôm nay và chuỗi ngày liên tiếp đạt mục tiêu. Hôm nay chưa đạt thì chưa
// làm đứt chuỗi (chuỗi tính tới hôm qua); mỗi lần chấm một thẻ là một thẻ.
function reviewStats(list, goal, now = Date.now()) {
  goal = Math.max(1, Math.round(goal) || 1);
  const perDay = new Map();
  for (const w of list) {
    for (const t of w.reviewLog || []) perDay.set(startOfDay(t), (perDay.get(startOfDay(t)) || 0) + 1);
  }
  const reached = (day) => (perDay.get(day) || 0) >= goal;
  const today = startOfDay(now);
  let streak = reached(today) ? 1 : 0;
  for (let day = startOfDay(today - 1); reached(day); day = startOfDay(day - 1)) streak++;
  return { today: perDay.get(today) || 0, goal, reached: reached(today), streak };
}

// ---------- Ghi kho từ (chỉ chạy ở nơi ghi: background / trang web) ----------

const MAX_CONTEXTS = 5;
let writeQueue = Promise.resolve();

// Web Locks giữ thứ tự ghi giữa nhiều tab (web) hoặc nhiều lượt chạy của service worker
function withWriteLock(fn) {
  if (globalThis.navigator?.locks) return navigator.locks.request('vocab-english-lens-write', () => fn());
  const run = writeQueue.then(() => fn());
  writeQueue = run.catch(() => {});
  return run;
}

function mergeContexts(old, added) {
  const seen = new Set();
  return [...(added || []), ...(old || [])]
    .filter((c) => {
      const id = (c?.text || '').trim().toLowerCase();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, MAX_CONTEXTS);
}

function mergeEntry(prev, entry, now) {
  const merged = {
    mark: 0,
    addedAt: now,
    ...prev,
    ...entry,
    word: wordKey(entry.word), // luôn lưu chữ thường: bôi đen "SETTLE" / "Settle" → "settle"
    contexts: mergeContexts(contextsOf(prev), entry.contexts || contextsOf(entry)),
    forms: [...new Set([...(prev?.forms || []), ...(entry.forms || [])])].filter((f) => f !== wordKey(entry.word))
  };
  delete merged.context; // đã chuyển sang `contexts`
  delete merged.source;
  return merged;
}

// Trả về bản mới của từ; undefined = không đổi gì, null = xoá
function nextEntry(op, prev, i, now) {
  switch (op.op) {
    case 'save':
      return mergeEntry(prev, op.entry, now);
    case 'import':
      return mergeEntry(prev, op.entries[i], now);
    case 'patch':
      return prev ? { ...prev, ...op.patch } : undefined;
    case 'mark':
      return prev ? { ...prev, mark: op.mark } : undefined;
    case 'grade':
      return prev ? { ...prev, ...gradeWord(prev, op.grade, now) } : undefined;
    case 'practice': // ôn thêm: chỉ ghi nhận đã ôn (reviewLog), không đổi mức / lịch ôn
      return prev ? { ...prev } : undefined;
    case 'addContext':
      return prev ? { ...prev, contexts: mergeContexts(contextsOf(prev), [op.context]) } : undefined;
    case 'remove':
      return prev ? null : undefined;
    default:
      throw new Error('Thao tác không hợp lệ: ' + op.op);
  }
}

// Lịch sử đổi mức thuộc (cho tab Thống kê): markLog = [[thời điểm, mức cũ, mức mới], ...], giữ tối đa 50 lần gần nhất.
// Chỉ ghi khi mức thật sự đổi; từ mới lưu không cần ghi vì đã có addedAt.
const MAX_MARK_LOG = 50;

function withMarkLog(op, prev, next, now) {
  if (!prev || !next || op.op === 'import' || markOf(prev) === markOf(next)) return next;
  return { ...next, markLog: [...(prev.markLog || []), [now, markOf(prev), markOf(next)]].slice(-MAX_MARK_LOG) };
}

// Lịch sử ôn thẻ (mục tiêu ngày, chuỗi ngày học): reviewLog = [thời điểm, ...], giữ tối đa 50 lần gần nhất.
const MAX_REVIEW_LOG = 50;

function withReviewLog(op, prev, next, now) {
  if (!prev || !next || (op.op !== 'grade' && op.op !== 'practice')) return next;
  return { ...next, reviewLog: [...(prev.reviewLog || []), now].slice(-MAX_REVIEW_LOG) };
}

const indexRow = (w) => [markOf(w), dueAt(w), ...(w.forms || [])];

// Tách dữ liệu dạng cũ (`words`) ra từng key và dựng wordIndex. Gọi bên trong withWriteLock.
async function migrateLegacyUnlocked() {
  const { words, wordIndex, wordsLowercased } = await chrome.storage.local.get(['words', 'wordIndex', 'wordsLowercased']);
  if (words || !wordIndex) {
    const all = { ...(await getWords()) };
    const items = { wordIndex: Object.fromEntries(Object.entries(all).map(([k, w]) => [k, indexRow(w)])) };
    for (const [key, w] of Object.entries(words || {})) items[storageKeyOf(key)] = w;
    await chrome.storage.local.set(items);
    if (words) await chrome.storage.local.remove('words');
  }
  if (!wordsLowercased) await lowercaseWordsUnlocked();
}

// Một lần: từ lưu trước đây còn chữ hoa ("SETTLE") → chữ thường. Chỉ sửa trên máy này, không đẩy lên
// server (không đè thay đổi của máy khác) – máy nào cũng tự sửa, dữ liệu kéo về cũng được viết thường.
async function lowercaseWordsUnlocked() {
  const changes = {};
  for (const [key, w] of Object.entries(await getWords())) {
    if (w.word && w.word !== wordKey(w.word)) changes[key] = { ...w, word: wordKey(w.word) };
  }
  await writeEntriesUnlocked(changes, { markDirty: false, extra: { wordsLowercased: true } });
}

function migrateLegacyWords() {
  return withWriteLock(migrateLegacyUnlocked);
}

// Ghi một nhóm thay đổi đã tính sẵn: { [key]: entry | null }. markDirty = false khi dữ liệu đến từ server.
async function writeEntriesUnlocked(changes, { markDirty = true, extra = {} } = {}) {
  const { dirty = {}, wordIndex = {} } = await chrome.storage.local.get(['dirty', 'wordIndex']);
  const toSet = {};
  const toRemove = [];
  for (const [key, entry] of Object.entries(changes)) {
    if (entry === null) {
      toRemove.push(storageKeyOf(key));
      delete wordIndex[key];
    } else {
      toSet[storageKeyOf(key)] = entry;
      wordIndex[key] = indexRow(entry);
    }
    if (markDirty) dirty[key] = entry?.updatedAt ?? Date.now();
  }
  if (toRemove.length) await chrome.storage.local.remove(toRemove);
  await chrome.storage.local.set({ ...toSet, wordIndex, ...(markDirty ? { dirty } : {}), ...extra });
}

function applyWordOp(op) {
  return withWriteLock(async () => {
    await migrateLegacyUnlocked();
    const keys = op.op === 'import' ? op.entries.map((e) => wordKey(e.word)) : [wordKey(op.key ?? op.entry.word)];
    const items = await chrome.storage.local.get(keys.map(storageKeyOf));
    const now = Date.now();
    const changes = {};
    const results = keys.map((key, i) => {
      const prev = changes[key] ?? items[storageKeyOf(key)] ?? null;
      const next = withReviewLog(op, prev, withMarkLog(op, prev, nextEntry(op, prev, i, now), now), now);
      if (next === undefined) return prev;
      changes[key] = next === null ? null : { ...next, key, updatedAt: now };
      return changes[key];
    });
    if (Object.keys(changes).length) await writeEntriesUnlocked(changes);
    return op.op === 'import' ? results.length : results[0];
  });
}

// Xoá toàn bộ kho trên thiết bị (đăng xuất trên web). Không đánh dấu dirty.
function clearLocalWords() {
  return withWriteLock(async () => {
    const keys = Object.keys(await getWords()).map(storageKeyOf);
    await chrome.storage.local.remove([...keys, 'words', 'wordIndex', 'dirty', 'syncCursor']);
  });
}

// ---------- Thao tác từ phía giao diện (gửi về nơi ghi) ----------

const wordOp = (op) => callBackground({ type: 'wordOp', op });
const saveWord = (entry) => wordOp({ op: 'save', entry });
const patchWord = (text, patch) => wordOp({ op: 'patch', key: wordKey(text), patch });
const practiceCard = (text) => wordOp({ op: 'practice', key: wordKey(text) });
const setMark = (text, mark) => wordOp({ op: 'mark', key: wordKey(text), mark });
const gradeCard = (text, grade) => wordOp({ op: 'grade', key: wordKey(text), grade });
const addContext = (text, context) => wordOp({ op: 'addContext', key: wordKey(text), context });
const removeWord = (text) => wordOp({ op: 'remove', key: wordKey(text) });
const importWords = (entries) => wordOp({ op: 'import', entries });

// ---------- Hiển thị dùng chung ----------

// Tô từ (và các dạng của nó) trong câu đã escape – chỉ khớp nguyên từ, không tô nửa chữ
function highlightWord(safeText, words, esc) {
  const list = [].concat(words).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return safeText;
  const pattern = list.map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|');
  return safeText.replace(new RegExp(`(?<![A-Za-z])(?:${pattern})(?![A-Za-z])`, 'gi'), (m) => `<mark>${m}</mark>`);
}

// Tiêu đề trang để lưu kèm ngữ cảnh: bỏ số thông báo "(106)", giờ "14:57" ở đầu, đuôi " - YouTube";
// rút gọn nếu quá dài (tiêu đề commit GitHub có thể rất dài)
function cleanSourceTitle(title, max = 70) {
  const clean = (title || '')
    .replace(/^(?:\(\d+\)\s*|\d{1,2}:\d{2}(?::\d{2})?\s+)+/, '')
    .replace(/\s*[-–]\s*YouTube$/, '')
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

// 95 -> "1:35"
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// HTML cho phần "Giải thích chi tiết" – dùng ở cả popup và trang Kho từ
function detailsHtml(d, word, esc) {
  const context = d.context
    ? `<div class="dt-context">
        <div class="dt-caption">Trong câu bạn đang đọc</div>
        <div class="dt-en">${highlightWord(esc(d.context), word, esc)}</div>
        ${d.contextVi ? `<div class="dt-vi">${esc(d.contextVi)}</div>` : ''}
      </div>`
    : '';

  const senses = (d.senses || [])
    .map((s) => {
      const defs = s.definitions
        .map(
          (def) => `
          <li>
            <div class="dt-gloss">${esc(def.gloss)}</div>
            ${def.glossVi ? `<div class="dt-vi">${esc(def.glossVi)}</div>` : ''}
            ${def.example ? `<div class="dt-example">“${highlightWord(esc(def.example), word, esc)}”</div>` : ''}
            ${def.exampleVi ? `<div class="dt-vi">${esc(def.exampleVi)}</div>` : ''}
          </li>`
        )
        .join('');
      const otherForm = s.baseForm && wordKey(s.baseForm) !== wordKey(word) ? s.baseForm : '';
      return `
        <div class="dt-sense">
          <div class="dt-pos"><span class="pos">${esc(s.pos)}${s.posEn ? ` · ${esc(s.posEn)}` : ''}</span>
            ${otherForm ? `<span class="dt-form">(theo từ “${esc(otherForm)}”)</span>` : ''}
            ${s.terms.length ? `<span class="dt-terms">${esc(s.terms.join(', '))}</span>` : ''}</div>
          ${defs ? `<ol class="dt-defs">${defs}</ol>` : ''}
          ${s.synonyms.length ? `<div class="dt-syn"><b>Đồng nghĩa:</b> ${esc(s.synonyms.join(', '))}</div>` : ''}
        </div>`;
    })
    .join('');

  return `<div class="dt">${context}${senses || '<div class="muted">Từ điển chưa có định nghĩa chi tiết cho mục này.</div>'}</div>`;
}

const DETAILS_STYLES = `
  .dt-context { padding: 8px 10px; border-radius: 8px; background: var(--chip); margin-bottom: 8px; }
  .dt-caption { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); margin-bottom: 2px; }
  .dt-context mark, .dt-example mark { background: var(--accent-bg); color: inherit; padding: 0 2px; border-radius: 3px; }
  .dt-sense { padding: 6px 0; border-top: 1px dashed var(--line); }
  .dt-sense:first-of-type { border-top: 0; }
  .dt-pos { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-bottom: 4px; }
  .dt-terms { font-weight: 600; }
  .dt-form { font-size: 12.5px; color: var(--muted); }
  .dt-defs { margin: 0; padding-left: 20px; }
  .dt-defs li { margin: 4px 0; }
  .dt-gloss { font-weight: 500; }
  .dt-example { font-style: italic; margin-top: 2px; }
  .dt-vi { color: var(--muted); }
  .dt-syn { margin-top: 4px; font-size: 13px; }
  .cefr { display: inline-block; padding: 0 6px; border-radius: 4px; font: 700 11px/1.6 system-ui, sans-serif;
          letter-spacing: .02em; vertical-align: middle; white-space: nowrap; cursor: help; }
  .cefr-a { color: #1f8a4c; background: rgba(47, 158, 92, .14); }
  .cefr-b { color: #2563eb; background: rgba(37, 99, 235, .13); }
  .cefr-c { color: #8b3fd1; background: rgba(139, 63, 209, .14); }
  .cefr-none { color: var(--muted); background: var(--chip); font-weight: 500; }
  @media (prefers-color-scheme: dark) {
    .cefr-a { color: #5fd08f; } .cefr-b { color: #7aa7ff; } .cefr-c { color: #c18cf5; }
  }
`;

// Nhãn cấp độ CEFR (B1…). showUnknown: từ ngoài danh sách thì hiện "chưa xếp cấp" (popup tra từ đơn)
function cefrBadge(cefr, esc, { showUnknown = false } = {}) {
  if (!cefr) {
    return showUnknown
      ? '<span class="cefr cefr-none" title="Không có trong danh sách CEFR-J / Octanove – thường là từ hiếm hoặc chuyên ngành">chưa xếp cấp</span>'
      : '';
  }
  const detail = Object.entries(cefr.byPos).map(([pos, lv]) => `${pos} ${lv}`).join(' · ');
  const title = `Cấp độ CEFR ${cefr.level}${detail ? ` (${detail})` : ''}${cefr.lemma ? ` – theo “${cefr.lemma}”` : ''}`;
  return `<span class="cefr cefr-${cefr.level[0].toLowerCase()}" title="${esc(title)}">${esc(cefr.level)}</span>`;
}

// Gửi message tới background và nhận lại kết quả dạng { ok, data } | { ok: false, error }
async function callBackground(message) {
  const res = await chrome.runtime.sendMessage(message);
  if (!res) throw new Error('Không nhận được phản hồi từ extension.');
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
