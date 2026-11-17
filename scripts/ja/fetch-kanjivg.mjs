// Tải nét chữ (thứ tự viết) của kana và Kanji N5 từ KanjiVG → data-src/ja/vendor/kanjivg.json.
//   node scripts/ja/fetch-kanjivg.mjs
// Chỉ cần chạy lại khi thêm chữ mới vào data-src/ja/kanji.json hoặc bảng kana.
// KanjiVG © Ulrich Apel – giấy phép CC BY-SA 3.0 (https://kanjivg.tagaini.net). File kết quả giữ nguyên
// giấy phép này; chỉ lấy đường nét (thuộc tính d của từng nét, theo đúng thứ tự viết), khung 109×109.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAKUON, GOJUON } from '../../src/features/ja/kana.js';
import { toKatakana } from '../../src/features/ja/text.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'data-src', 'ja', 'vendor', 'kanjivg.json');
const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';

const kana = [...GOJUON, ...DAKUON].flat().filter(Boolean);
const kanjiData = JSON.parse(readFileSync(join(root, 'data-src', 'ja', 'kanji.json'), 'utf8'));
const chars = [...new Set([...kana, ...kana.map(toKatakana), ...kanjiData.groups.flatMap((g) => g.items.map((i) => i[0]))])];

let old = {};
try {
  old = JSON.parse(readFileSync(out, 'utf8')).strokes;
} catch {
  /* chưa có file */
}

const strokes = {};
const missing = [];
for (const c of chars) {
  if (old[c]) {
    strokes[c] = old[c];
    continue;
  }
  const hex = c.codePointAt(0).toString(16).padStart(5, '0');
  const res = await fetch(BASE + hex + '.svg');
  if (!res.ok) {
    missing.push(c);
    continue;
  }
  const svg = await res.text();
  // Các nét nằm trong nhóm StrokePaths, theo thứ tự id ...-s1, -s2, …
  const paths = [...svg.matchAll(/<path[^>]*id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)]
    .sort((a, b) => a[1] - b[1])
    .map((m) => m[2].replace(/\s+/g, ' ').trim());
  if (!paths.length) missing.push(c);
  else strokes[c] = paths;
}

const sorted = Object.fromEntries(chars.filter((c) => strokes[c]).map((c) => [c, strokes[c]]));
writeFileSync(
  out,
  JSON.stringify(
    {
      source: 'KanjiVG (https://kanjivg.tagaini.net) © Ulrich Apel',
      license: 'CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)',
      viewBox: '0 0 109 109',
      strokes: sorted,
    },
    null,
    0,
  ).replace(/\],"/g, '],\n"') + '\n',
);
console.log(`Nét chữ: ${Object.keys(sorted).length}/${chars.length}${missing.length ? ' · thiếu: ' + missing.join(' ') : ''}`);
