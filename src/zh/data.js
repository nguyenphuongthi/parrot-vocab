// Tải dữ liệu HSK (nằm sau middleware đăng nhập), giữ lại trong bộ nhớ khi chuyển trang.
import { getJson } from '../lib/supabase.js';

const cache = new Map();
const once = (path) => {
  if (!cache.has(path)) cache.set(path, getJson(path).catch((e) => (cache.delete(path), Promise.reject(e))));
  return cache.get(path);
};

export const loadIndex = () => once('/data/zh/index.json');
export const loadLevel = (level) => once(`/data/zh/hsk${level}.json`);

// Mọi từ HSK 1–6 (cho flashcard): [{ id, w, py, hv, vi, en, ex, level }]
export async function loadAllWords() {
  const index = await loadIndex();
  const lists = await Promise.all(index.levels.map(({ level }) => loadLevel(level)));
  return lists.flatMap((list, i) => list.filter((x) => x.py).map((x) => ({ ...x, level: index.levels[i].level })));
}
