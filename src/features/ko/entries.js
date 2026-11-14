// Chuẩn hoá dữ liệu tiếng Hàn thành danh sách mục học (dùng ở giao diện, flashcard và scripts/check-ko.mjs).
import { pronunciationHint, romanize } from './romanize.js';

function entry(kind, group, [ko, vi, third = '', opts = {}], level = 0) {
  // Từ vựng: [ko, vi, hán việt, opts]; câu: [ko, vi, ghi chú, opts]
  const base = kind === 'w' ? { hv: third, level } : { note: third };
  return {
    id: `${kind}:${opts.id || ko}`,
    kind,
    group,
    ko,
    vi,
    ...base,
    rr: opts.rr || romanize(ko),
    pron: pronunciationHint(ko, opts.pron),
  };
}

export function koEntries(wordsData, phrasesData) {
  const problems = [];
  const seen = new Set();
  const check = (e) => {
    if (seen.has(e.id)) problems.push(`Trùng id: ${e.id}`);
    seen.add(e.id);
    return e;
  };
  // Mỗi chủ đề: t1 = từ mức TOPIK 1, t2 = từ mức TOPIK 2
  const words = wordsData.topics.flatMap((t) =>
    [1, 2].flatMap((level) => (t[`t${level}`] || []).map((w) => check(entry('w', t.id, w, level)))),
  );
  const phrases = phrasesData.situations.flatMap((s) => s.items.map((p) => check(entry('p', s.id, p))));
  return { words, phrases, problems };
}
