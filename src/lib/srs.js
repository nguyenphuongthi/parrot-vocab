// Logic thuần (không đụng tới trình duyệt / mạng) – dùng chung cho cả 3 ngôn ngữ và chạy được trong test Node.
// Chuyển từ extension/shared.js của Vocab English Lens; định dạng dữ liệu giữ NGUYÊN để extension cũ
// và app này cùng đọc/ghi bảng `words` trên Supabase:
//   mark      0 = chưa thuộc (mặc định) · 1 = hơi nhớ · 2 = đã thuộc
//   srs       { interval, due, reviews, lapses, last } – lịch ôn ngắt quãng
//   markLog   [[thời điểm, mức cũ, mức mới], ...] – cho biểu đồ thống kê
//   reviewLog [thời điểm, ...] – cho mục tiêu ngày và chuỗi ngày học
//   addedAt / updatedAt (ms)

export const STATES = [
  { value: 0, label: 'Chưa thuộc' },
  { value: 1, label: 'Hơi nhớ' },
  { value: 2, label: 'Đã thuộc' },
];

export const markOf = (entry) => entry?.mark ?? 0;

export const DAY = 86_400_000;
export const MAX_INTERVAL = 180;
export const MAX_MARK_LOG = 50;
export const MAX_REVIEW_LOG = 50;
export const MAX_CONTEXTS = 5;

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------- Ôn tập ngắt quãng (bản rút gọn của SM-2) ----------

// Chấm điểm một thẻ: đặt mức thuộc và hẹn ngày ôn lại
//   chưa thuộc → ngày mai · hơi nhớ → ≥ 3 ngày, tăng chậm · đã thuộc → ≥ 7 ngày, tăng ×2,5
export function gradeWord(w, grade, now = Date.now()) {
  const prev = w?.srs?.interval || 0;
  const raw = grade === 0 ? 1 : grade === 1 ? Math.max(3, Math.round(prev * 1.2)) : Math.max(7, Math.round(prev * 2.5));
  const interval = Math.min(raw, MAX_INTERVAL);
  return {
    mark: grade,
    srs: {
      interval,
      due: startOfDay(now) + interval * DAY,
      reviews: (w?.srs?.reviews || 0) + 1,
      lapses: (w?.srs?.lapses || 0) + (grade === 0 ? 1 : 0),
      last: now,
    },
  };
}

// Mục chưa ôn lần nào thì đến hạn ngay từ ngày lưu / ngày bắt đầu học
export const dueAt = (w) => w?.srs?.due ?? startOfDay(w?.addedAt || 0);
export const isDue = (w, now = Date.now()) => dueAt(w) < startOfDay(now) + DAY;

export function dueLabel(w, now = Date.now()) {
  const days = Math.round((startOfDay(dueAt(w)) - startOfDay(now)) / DAY);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'ngày mai';
  return `${days} ngày nữa`;
}

// ---------- Thống kê ----------

// Số mục được đánh dấu vào từng mức mỗi ngày của tháng (month: 0–11): counts[mức][ngày].
// Lưu mới = đánh dấu "Chưa thuộc". Mỗi mục tính tối đa một lần mỗi ngày, ở mức cuối cùng của ngày;
// cuối ngày quay về đúng mức đầu ngày thì không tính. (Giữ nguyên cách tính của bản tiếng Anh cũ.)
export function marksByDay(list, year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const out = { days, counts: STATES.map(() => Array(days).fill(0)) };
  const dayOf = (t) => {
    const d = new Date(t);
    return d.getFullYear() === year && d.getMonth() === month ? d.getDate() - 1 : -1;
  };
  for (const w of list) {
    const log = w.markLog || [];
    const addedMark = log.length ? log[0][1] : markOf(w);
    const events = [...(w.addedAt ? [[w.addedAt, null, addedMark]] : []), ...log].sort((a, b) => a[0] - b[0]);
    const byDay = new Map();
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

// Số thẻ đã ôn hôm nay và chuỗi ngày liên tiếp đạt mục tiêu. Hôm nay chưa đạt thì chưa làm đứt chuỗi.
export function reviewStats(list, goal, now = Date.now()) {
  goal = Math.max(1, Math.round(goal) || 1);
  const perDay = new Map();
  for (const w of list) {
    for (const t of w.reviewLog || []) perDay.set(startOfDay(t), (perDay.get(startOfDay(t)) || 0) + 1);
  }
  const reached = (day) => (perDay.get(day) || 0) >= goal;
  const today = startOfDay(now);
  let streak = reached(today) ? 1 : 0;
  for (let day = startOfDay(today - 1); reached(day); day = startOfDay(day - 1)) streak++;
  return { today: perDay.get(today) || 0, goal, reached: reached(today), streak, perDay };
}

// Số thẻ đã ôn mỗi ngày trong N ngày gần nhất (cũ → mới), cho dải "hoạt động" ở trang Thống kê.
export function reviewsLastDays(list, days, now = Date.now()) {
  const { perDay } = reviewStats(list, 1, now);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(startOfDay(now) - i * DAY + DAY / 2);
    out.push({ day, count: perDay.get(day) || 0 });
  }
  return out;
}

export function countMarks(list) {
  const counts = [0, 0, 0];
  for (const w of list) counts[markOf(w)]++;
  return counts;
}

// ---------- Tiếng Anh: chuẩn hoá từ, ngữ cảnh ----------

export function wordKey(text) {
  return String(text || '').trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
}

export function contextsOf(w) {
  if (w?.contexts?.length) return w.contexts;
  if (!w?.context) return [];
  return [{ text: w.context, url: w.source?.url || '', title: w.source?.title || '', at: w.addedAt || 0 }];
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
    word: wordKey(entry.word),
    contexts: mergeContexts(contextsOf(prev), entry.contexts || contextsOf(entry)),
    forms: [...new Set([...(prev?.forms || []), ...(entry.forms || [])])].filter((f) => f !== wordKey(entry.word)),
  };
  delete merged.context;
  delete merged.source;
  return merged;
}

// ---------- Thao tác ghi ----------
// op: { op: 'mark' | 'grade' | 'practice' | 'remove' | 'patch' | 'import', key, ... }
// Trả về bản mới của mục; undefined = không đổi gì, null = xoá.
function nextEntry(op, prev, i, now) {
  switch (op.op) {
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
    case 'remove':
      return prev ? null : undefined;
    default:
      throw new Error('Thao tác không hợp lệ: ' + op.op);
  }
}

function withMarkLog(op, prev, next, now) {
  if (!prev || !next || op.op === 'import' || markOf(prev) === markOf(next)) return next;
  return { ...next, markLog: [...(prev.markLog || []), [now, markOf(prev), markOf(next)]].slice(-MAX_MARK_LOG) };
}

function withReviewLog(op, prev, next, now) {
  if (!prev || !next || (op.op !== 'grade' && op.op !== 'practice')) return next;
  return { ...next, reviewLog: [...(prev.reviewLog || []), now].slice(-MAX_REVIEW_LOG) };
}

// Tính các thay đổi cho một thao tác. get(key) trả về bản đang có (hoặc undefined).
// virtual = true (bảng items: tiếng Trung / Hàn): mục chưa từng học vẫn "tồn tại" ở mức chưa thuộc –
// lần đầu đánh dấu / chấm thẻ sẽ tạo bản ghi, addedAt = lúc bắt đầu học.
// Trả về { changes: { [key]: entry | null }, results: [...] }.
export function computeChanges(op, get, { virtual = false, now = Date.now() } = {}) {
  const keys = op.op === 'import' ? op.entries.map((e) => wordKey(e.word)) : [op.key];
  const changes = {};
  const results = keys.map((key, i) => {
    const stored = key in changes ? changes[key] : get(key);
    const prev = stored ?? (virtual && op.op !== 'remove' ? { mark: 0, addedAt: now } : null);
    if (virtual && !stored && op.op === 'mark' && op.mark === 0) return stored ?? null; // chưa học + chưa thuộc = không đổi
    const next = withReviewLog(op, prev, withMarkLog(op, prev, nextEntry(op, prev, i, now), now), now);
    if (next === undefined) return stored ?? null;
    changes[key] = next === null ? null : { ...next, key, updatedAt: now };
    return changes[key];
  });
  return { changes, results };
}

// Gộp một dòng kéo từ server vào bản trên máy: bản nào sửa sau thắng.
export function mergeRemote(local, dirtyAt, row, normalize = (d) => d) {
  const localTime = Math.max(local?.updatedAt || 0, dirtyAt || 0);
  if (!(row.updated_at > localTime)) return undefined;
  return row.deleted ? null : { ...normalize(row.data, row.key), key: row.key, updatedAt: row.updated_at };
}
