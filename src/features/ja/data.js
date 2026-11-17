// Tải dữ liệu tiếng Nhật (nằm sau middleware đăng nhập, xuất từ data-src/ja bằng `npm run data:ja`),
// giữ lại trong bộ nhớ khi chuyển trang.
import { useEffect, useState } from 'react';
import { UNAUTHORIZED, getJson } from '../../lib/supabase.js';
import { jaEntries } from './entries.js';

let promise = null;
export function loadJa() {
  promise ||= Promise.all([getJson('/data/ja/words.json'), getJson('/data/ja/kanji.json'), getJson('/data/ja/phrases.json')]).then(
    ([words, kanjiData, phrases]) => {
      const { words: wordList, kanji, phrases: phraseList } = jaEntries(words, kanjiData, phrases);
      const extra = new Set(kanjiData.extra);
      for (const k of kanji) k.extra = extra.has(k.ja);
      return {
        topics: words.topics.map((t) => ({ ...t, items: wordList.filter((e) => e.group === t.id) })),
        kanjiGroups: kanjiData.groups.map((g) => ({ ...g, items: kanji.filter((k) => k.group === g.id) })),
        situations: phrases.situations.map((s) => ({ ...s, items: phraseList.filter((e) => e.group === s.id) })),
        words: wordList,
        kanji,
        phrases: phraseList,
      };
    },
    (e) => {
      promise = null; // lỗi mạng / hết phiên: lần sau tải lại
      throw e;
    },
  );
  return promise;
}

// Dữ liệu cho các trang tiếng Nhật: { data, error }. Hết phiên đăng nhập thì gọi onUnauthorized (về màn đăng nhập).
export function useJa(onUnauthorized) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let live = true;
    loadJa().then(
      (data) => live && setState({ data, error: null }),
      (e) => {
        if (!live) return;
        if (e.message === UNAUTHORIZED) onUnauthorized?.();
        else setState({ data: null, error: 'Không tải được dữ liệu tiếng Nhật.' });
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

// Nét chữ (KanjiVG) – tải một lần khi cần vẽ
let strokesPromise = null;
export function loadStrokes() {
  strokesPromise ||= getJson('/data/ja/strokes.json').then(
    (d) => d.strokes,
    (e) => {
      strokesPromise = null;
      throw e;
    },
  );
  return strokesPromise;
}
