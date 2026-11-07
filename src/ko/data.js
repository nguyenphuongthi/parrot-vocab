// Nội dung tiếng Hàn đi kèm app (tách thành chunk riêng, chỉ tải khi mở phần tiếng Hàn).
import { koEntries } from './entries.js';

let promise = null;
export function loadKo() {
  promise ||= Promise.all([import('./data/words.json'), import('./data/phrases.json')]).then(([w, p]) => {
    const words = w.default;
    const phrases = p.default;
    const { words: wordList, phrases: phraseList } = koEntries(words, phrases);
    return {
      topics: words.topics.map((t) => ({ ...t, items: wordList.filter((e) => e.group === t.id) })),
      situations: phrases.situations.map((s) => ({ ...s, items: phraseList.filter((e) => e.group === s.id) })),
      words: wordList,
      phrases: phraseList,
    };
  });
  return promise;
}
