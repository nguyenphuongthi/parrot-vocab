// Huy hiệu thành tích – tính từ dữ liệu học (không lưu riêng trên server).
// Huy hiệu đã thấy lưu trong localStorage để chỉ báo "mở khoá" một lần.
import { useEffect, useMemo } from 'react';
import { useTable } from './store.js';
import { reviewStats } from './srs.js';
import { useSettings } from './settings.js';
import { emitFx } from './events.js';

const SEEN_KEY = 'languages.badges.seen';
export const JAMO_HEARD_KEY = 'languages.ui.jamoHeard';
export const JAMO_TOTAL = 40; // 10 + 11 nguyên âm, 14 + 5 phụ âm

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// Đếm các con số cần cho huy hiệu
export function learningCounts(words, items) {
  const c = { all: 0, en: 0, zh: 0, ko: 0, hsk1: 0, koPhrases: 0, reviews: 0 };
  for (const w of Object.values(words)) {
    c.reviews += (w.reviewLog || []).length;
    if (w.mark === 2) c.en++;
  }
  for (const [k, v] of Object.entries(items)) {
    c.reviews += (v.reviewLog || []).length;
    if (v.mark !== 2) continue;
    if (k.startsWith('zh:')) {
      if (k.startsWith('zh:g')) continue;
      c.zh++;
      if (k.startsWith('zh:1-')) c.hsk1++;
    } else if (k.startsWith('ko:')) {
      c.ko++;
      if (k.startsWith('ko:p:')) c.koPhrases++;
    }
  }
  c.all = c.en + c.zh + c.ko;
  return c;
}

// [id, icon, tên, mô tả, giá trị hiện tại, mục tiêu]
export function computeBadges(c, streak, jamoHeard) {
  const list = [
    ['first', '🌱', 'Từ đầu tiên', 'Thuộc 1 từ', c.all, 1],
    ['m50', '🌿', '50 từ', 'Thuộc 50 từ (cả 3 ngôn ngữ)', c.all, 50],
    ['m100', '🌳', '100 từ', 'Thuộc 100 từ', c.all, 100],
    ['m500', '🏆', '500 từ', 'Thuộc 500 từ', c.all, 500],
    ['en100', '📚', 'Mọt sách tiếng Anh', 'Thuộc 100 từ tiếng Anh', c.en, 100],
    ['hsk1', '🀄', '100 từ HSK 1', 'Thuộc 100 từ HSK 1', c.hsk1, 100],
    ['hsk1all', '🐉', 'Trọn bộ HSK 1', 'Thuộc cả 150 từ HSK 1', c.hsk1, 150],
    ['ko50', '🌸', '50 từ tiếng Hàn', 'Thuộc 50 từ / câu tiếng Hàn', c.ko, 50],
    ['koTalk', '💬', 'Nói chuyện được rồi', 'Thuộc 30 câu giao tiếp tiếng Hàn', c.koPhrases, 30],
    ['hangul', '한', 'Bảng chữ cái', 'Nghe hết 40 chữ cái Hangul', jamoHeard, JAMO_TOTAL],
    ['poly', '🌏', 'Đa ngôn ngữ', 'Thuộc ít nhất 10 từ mỗi ngôn ngữ', Math.min(c.en, c.zh, c.ko), 10],
    ['s7', '🔥', '7 ngày liên tiếp', 'Đạt mục tiêu 7 ngày liền', streak, 7],
    ['s30', '💎', '30 ngày liên tiếp', 'Đạt mục tiêu 30 ngày liền', streak, 30],
    ['r100', '🃏', 'Chăm ôn bài', 'Chấm 100 thẻ flashcard', c.reviews, 100],
    ['r1000', '🎓', 'Bậc thầy ôn tập', 'Chấm 1.000 thẻ flashcard', c.reviews, 1000],
  ];
  return list.map(([id, icon, title, desc, value, goal]) => ({
    id,
    icon,
    title,
    desc,
    value: Math.min(value, goal),
    goal,
    done: value >= goal,
  }));
}

// Huy hiệu mở khoá trong phiên này (trang Thống kê cho chúng lật ra)
export const freshBadges = new Set();

export function useBadges() {
  const words = useTable('words');
  const items = useTable('items');
  const { dailyGoal } = useSettings();
  return useMemo(() => {
    const all = [...Object.values(words), ...Object.values(items)];
    const { streak } = reviewStats(all, dailyGoal);
    const jamo = readJson(JAMO_HEARD_KEY, []).length;
    return computeBadges(learningCounts(words, items), streak, jamo);
  }, [words, items, dailyGoal]);
}

// Gọi một lần trong App: báo khi có huy hiệu mới mở khoá.
// Lần đầu chạy (chưa có danh sách "đã thấy") thì ghi nhận hết, không báo dồn dập.
export function useBadgeWatcher(ready) {
  const badges = useBadges();
  useEffect(() => {
    if (!ready) return;
    const done = badges.filter((b) => b.done).map((b) => b.id);
    const seen = readJson(SEEN_KEY, null);
    if (!seen) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(done));
      } catch {
        /* bỏ qua */
      }
      return;
    }
    const fresh = badges.filter((b) => b.done && !seen.includes(b.id));
    if (!fresh.length) return;
    for (const b of fresh) {
      freshBadges.add(b.id);
      emitFx('badge', { icon: b.icon, title: b.title });
    }
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((b) => b.id)]));
    } catch {
      /* bỏ qua */
    }
  }, [badges, ready]);
}

// Bảng chữ cái: ghi nhận chữ đã nghe (huy hiệu "Bảng chữ cái")
export function markJamoHeard(jamo) {
  const list = readJson(JAMO_HEARD_KEY, []);
  if (list.includes(jamo)) return;
  try {
    localStorage.setItem(JAMO_HEARD_KEY, JSON.stringify([...list, jamo]));
  } catch {
    /* bỏ qua */
  }
}
