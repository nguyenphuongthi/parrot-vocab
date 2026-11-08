// Cấp độ CEFR (A1–C2) – dữ liệu offline trong public/data/en (CEFR-J Wordlist 1.5 cho A1–B2,
// Octanove Vocabulary Profile C1/C2 – nguồn và giấy phép xem public/data/en/README.md).
// Chuyển từ extension/shared.js của Vocab English Lens.
import { useEffect, useState } from 'react';
import { getJson } from '../../lib/supabase.js';
import { wordKey } from '../../lib/srs.js';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_POS = {
  n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ',
  conj: 'liên từ', pron: 'đại từ', interj: 'thán từ', det: 'từ hạn định',
};

// Từ loại – Google trả tên tiếng Việt; thứ tự ở đây là thứ tự tab trong Kho từ
export const POS_INFO = {
  'danh từ': { abbr: 'n.', en: 'noun' },
  'động từ': { abbr: 'v.', en: 'verb' },
  'tính từ': { abbr: 'adj.', en: 'adjective' },
  'trạng từ': { abbr: 'adv.', en: 'adverb' },
  'giới từ': { abbr: 'prep.', en: 'preposition' },
  'liên từ': { abbr: 'conj.', en: 'conjunction' },
  'đại từ': { abbr: 'pron.', en: 'pronoun' },
  'thán từ': { abbr: 'interj.', en: 'interjection' },
  'từ hạn định': { abbr: 'det.', en: 'determiner' },
};
export const POS_ORDER = Object.keys(POS_INFO);

export const normalizePos = (pos) => (pos || '').normalize('NFC').trim().toLowerCase();

export function wordClasses(w) {
  const classes = new Set();
  for (const m of [...(w.meanings || []), ...(w.senses || [])]) if (m.pos) classes.add(normalizePos(m.pos));
  return classes;
}

// Một từ có thể thuộc nhiều nhóm; mục nhiều chữ còn thuộc nhóm "Cụm từ"
export function categoriesOf(w) {
  const cats = wordClasses(w);
  if (w.key.includes(' ')) cats.add('phrase');
  if (!cats.size) cats.add('other');
  return cats;
}

export function categoryName(cat) {
  if (cat === 'phrase') return 'Cụm từ';
  if (cat === 'other') return 'Khác';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

let indexPromise = null;
export function loadCefrIndex() {
  indexPromise ||= Promise.all(
    ['/data/en/cefr-j.json', '/data/en/cefr-c1c2.json'].map((f) => getJson(f).catch(() => ({}))),
  ).then(([main, ...more]) => {
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
  });
  return indexPromise;
}

function simpleLemmas(word) {
  const out = [];
  const add = (w) => w.length > 1 && out.push(w);
  if (/ies$/.test(word)) add(word.slice(0, -3) + 'y');
  if (/es$/.test(word)) add(word.slice(0, -2));
  if (/s$/.test(word)) add(word.slice(0, -1));
  if (/ied$/.test(word)) add(word.slice(0, -3) + 'y');
  if (/ed$/.test(word)) add(word.slice(0, -2)), add(word.slice(0, -1));
  if (/ing$/.test(word)) add(word.slice(0, -3)), add(word.slice(0, -3) + 'e');
  for (const w of [...out]) if (/([bdgklmnprt])\1$/.test(w)) add(w.slice(0, -1));
  return out;
}

// { level, byPos, lemma } hoặc null (chưa xếp cấp)
export function cefrOf(index, w) {
  if (!index || !w?.key) return null;
  const key = wordKey(w.key);
  for (const lemma of [key, w.baseForm && wordKey(w.baseForm), ...simpleLemmas(key)]) {
    const hit = lemma && index[lemma];
    if (!hit) continue;
    const lowest = (list) => list.sort((a, b) => CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b))[0];
    const wanted = wordClasses(w);
    const matching = Object.entries(hit).filter(([pos]) => wanted.has(CEFR_POS[pos])).map(([, lv]) => lv);
    const byPos = Object.fromEntries(Object.entries(hit).filter(([pos]) => CEFR_POS[pos]).map(([pos, lv]) => [CEFR_POS[pos], lv]));
    return { level: lowest(matching.length ? matching : Object.values(hit)), byPos, lemma };
  }
  return null;
}

// Bảng CEFR tải một lần, dùng ở Kho từ và Flashcard (null khi đang tải).
export function useCefr() {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    loadCefrIndex().then(setIndex);
  }, []);
  return index;
}
