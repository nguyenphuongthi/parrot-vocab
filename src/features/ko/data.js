// Tải dữ liệu tiếng Hàn (nằm sau middleware đăng nhập, xuất từ data-src/ko bằng `npm run data:ko`),
// giữ lại trong bộ nhớ khi chuyển trang.
import { useEffect, useState } from 'react';
import { UNAUTHORIZED, getJson } from '../../lib/supabase.js';
import { koEntries } from './entries.js';

let promise = null;
export function loadKo() {
  promise ||= Promise.all([getJson('/data/ko/words.json'), getJson('/data/ko/phrases.json')]).then(
    ([words, phrases]) => {
      const { words: wordList, phrases: phraseList } = koEntries(words, phrases);
      return {
        topics: words.topics.map((t) => ({ ...t, items: wordList.filter((e) => e.group === t.id) })),
        situations: phrases.situations.map((s) => ({ ...s, items: phraseList.filter((e) => e.group === s.id) })),
        words: wordList,
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

// Dữ liệu cho các trang tiếng Hàn: { data, error }. Hết phiên đăng nhập thì gọi onUnauthorized (về màn đăng nhập).
export function useKo(onUnauthorized) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let live = true;
    loadKo().then(
      (data) => live && setState({ data, error: null }),
      (e) => {
        if (!live) return;
        if (e.message === UNAUTHORIZED) onUnauthorized?.();
        else setState({ data: null, error: 'Không tải được dữ liệu tiếng Hàn.' });
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}
