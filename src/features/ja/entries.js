// Chuẩn hoá dữ liệu tiếng Nhật thành danh sách mục học (dùng ở giao diện, flashcard và scripts/build-ja.mjs).
//   Từ vựng:  [chữ viết, cách đọc ("" nếu chữ viết toàn kana), nghĩa, Hán Việt, tuỳ chọn { t, id }]
//   Kanji:    [chữ, Hán Việt, nghĩa, âm On ("・" ngăn cách), âm Kun, [[từ ví dụ, cách đọc, nghĩa], …]]
//   Câu:      [câu có đánh dấu ({漢字|かな}, dấu cách tách từ), nghĩa, ghi chú, tuỳ chọn { id }]
import { furiganaOf, hasKanji, jaPlain, jaReading, jaRomaji, toRomaji } from './text.js';

function word(group, [written, reading, vi, hv = '', opts = {}]) {
  const kana = reading || written;
  return {
    id: `w:${opts.id || written}`,
    kind: 'w',
    group,
    ja: written,
    kana,
    ruby: furiganaOf(written, reading),
    // 勉強する → "benkyou suru"
    rm: toRomaji(kana, { particles: false }).replace(/(.)suru$/, '$1 suru'),
    vi,
    hv,
    t: opts.t || '',
  };
}

// "た.べる" → { kana: "たべる", stem: "た", oku: "べる" } – phần sau dấu chấm là okurigana
export const splitKun = (r) => {
  const [stem, oku = ''] = r.replace(/^-|-$/g, '').split('.');
  return { kana: stem + oku, stem, oku, prefix: r.startsWith('-'), suffix: r.endsWith('-') };
};

function kanji(group, [char, hv, vi, on, kun, examples = []]) {
  const list = (s) => (s ? s.split('・') : []);
  return {
    id: `k:${char}`,
    kind: 'k',
    group,
    ja: char,
    hv,
    vi,
    on: list(on),
    kun: list(kun),
    ex: examples.map(([w, r, m]) => ({ ja: w, kana: r, ruby: furiganaOf(w, r), rm: toRomaji(r, { particles: false }), vi: m })),
  };
}

function phrase(group, [text, vi, note = '', opts = {}]) {
  const plain = jaPlain(text);
  return { id: `p:${opts.id || plain}`, kind: 'p', group, ja: plain, text, kana: jaReading(text).replace(/ +/g, ''), rm: jaRomaji(text), vi, note };
}

export function jaEntries(wordsData, kanjiData, phrasesData) {
  const problems = [];
  const seen = new Set();
  const check = (e) => {
    if (seen.has(e.id)) problems.push(`Trùng id: ${e.id}`);
    seen.add(e.id);
    return e;
  };
  const words = wordsData.topics.flatMap((t) => t.words.map((w) => check(word(t.id, w))));
  const kanjis = kanjiData.groups.flatMap((g) => g.items.map((k) => check(kanji(g.id, k))));
  const phrases = phrasesData.situations.flatMap((s) => s.items.map((p) => check(phrase(s.id, p))));
  for (const w of words) {
    if (hasKanji(w.ja) && !w.ruby.startsWith('{') && !/\{/.test(w.ruby)) problems.push(`Thiếu cách đọc: ${w.ja}`);
    if (/^\{[^}]*\}$/.test(w.ruby) && /[ぁ-んァ-ン]/.test(w.ja)) problems.push(`Cách đọc không khớp chữ viết: ${w.ja} / ${w.kana}`);
  }
  return { words, kanji: kanjis, phrases, problems };
}
