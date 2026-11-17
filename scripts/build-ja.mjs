// Kiểm tra và xuất dữ liệu tiếng Nhật: data-src/ja → public/data/ja (nằm sau middleware đăng nhập).
//   npm run data:ja
// - words/NN-<chủ đề>.json: { id, name, ja, words: [[chữ viết, cách đọc ("" nếu toàn kana), nghĩa, Hán Việt, { t, id }], …] }
//   t = loại từ để tự chia: v1 | v2 | v3 (động từ nhóm I/II/III), i | na (tính từ い / な)
// - kanji.json: Kanji N5 theo nhóm (định dạng ghi ở trường "about")
// - phrases.json: câu giao tiếp theo tình huống
// - grammar/NN-*.json: ngữ pháp N5 (định dạng chung: scripts/lib/grammar.mjs)
// - vendor/kanjivg.json: nét chữ (KanjiVG, CC BY-SA 3.0) – tải bằng scripts/ja/fetch-kanjivg.mjs
// Câu tiếng Nhật viết theo quy ước ở src/features/ja/text.js: {漢字|かな}, dấu cách tách từ, 【…】 tô đậm.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jaEntries } from '../src/features/ja/entries.js';
import { DAKUON, GOJUON } from '../src/features/ja/kana.js';
import { JAPANESE, toKatakana } from '../src/features/ja/text.js';
import { checkBook, readUnits } from './lib/grammar.mjs';
import { checkJaText } from './lib/ja-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'data-src', 'ja');
const out = join(root, 'public', 'data', 'ja');
mkdirSync(out, { recursive: true });

const read = (...f) => JSON.parse(readFileSync(join(src, ...f), 'utf8'));
const wordsData = {
  topics: readdirSync(join(src, 'words'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => read('words', f)),
};
const kanjiData = read('kanji.json');
const phrasesData = read('phrases.json');
const { words, kanji, phrases, problems } = jaEntries(wordsData, kanjiData, phrasesData);

const TYPES = new Set(['', 'v1', 'v2', 'v3', 'i', 'na']);
for (const w of words) {
  if (!w.vi) problems.push(`Thiếu nghĩa: ${w.ja}`);
  if (!TYPES.has(w.t)) problems.push(`Loại từ lạ "${w.t}": ${w.ja}`);
  if (/^v/.test(w.t) && !/[うくぐすつぬぶむる]$/.test(w.kana)) problems.push(`Động từ phải kết thúc bằng âm -u: ${w.ja}`);
  if (w.t === 'v2' && !/[いきぎしじちにひびみりえけげせぜてでねへべめれ]る$/.test(w.kana)) problems.push(`Động từ nhóm II phải kết thúc bằng -iる / -eる: ${w.ja}`);
  if (w.t === 'i' && !/い$/.test(w.kana)) problems.push(`Tính từ い phải kết thúc bằng い: ${w.ja}`);
  if (!/^[a-z' -]+$/.test(w.rm)) problems.push(`Romaji lạ: ${w.ja} → ${w.rm}`);
}
for (const k of kanji) {
  if (!k.hv || !k.vi) problems.push(`Kanji thiếu Hán Việt / nghĩa: ${k.ja}`);
  if (!k.on.length && !k.kun.length) problems.push(`Kanji thiếu âm đọc: ${k.ja}`);
  if (!k.ex.length) problems.push(`Kanji thiếu từ ví dụ: ${k.ja}`);
  for (const e of k.ex) if (!e.ja.includes(k.ja)) problems.push(`Từ ví dụ không chứa chữ ${k.ja}: ${e.ja}`);
}
for (const p of phrases) problems.push(...checkJaText(p.text).map((m) => `Câu giao tiếp "${p.ja}": ${m}`));

// Nét chữ: chỉ xuất những chữ app dùng (kana + Kanji)
const vendor = read('vendor', 'kanjivg.json');
const kana = [...GOJUON, ...DAKUON].flat().filter(Boolean);
const needed = [...kana, ...kana.map(toKatakana), ...kanji.map((k) => k.ja)];
const strokes = {};
for (const c of needed) {
  if (vendor.strokes[c]) strokes[c] = vendor.strokes[c];
  else problems.push(`Chưa có nét chữ ${c} – chạy node scripts/ja/fetch-kanjivg.mjs`);
}

// Ngữ pháp
const book = checkBook(readUnits(join(src, 'grammar')), { levels: ['N5'], script: JAPANESE });
problems.push(...book.problems);
for (const u of book.units) {
  for (const p of u.points) {
    const at = `Ngữ pháp ${p.id}`;
    for (const use of p.uses) for (const [ja] of use.ex) problems.push(...checkJaText(ja).map((m) => `${at}: ${m}`));
    for (const [q] of p.practice || []) problems.push(...checkJaText(q).map((m) => `${at} (bài tập): ${m}`));
    for (const [wrong, right] of p.mistakes || []) problems.push(...[wrong, right].flatMap((s) => checkJaText(s).map((m) => `${at} (lỗi sai): ${m}`)));
  }
}

writeFileSync(join(out, 'words.json'), JSON.stringify(wordsData));
writeFileSync(join(out, 'kanji.json'), JSON.stringify(kanjiData));
writeFileSync(join(out, 'phrases.json'), JSON.stringify(phrasesData));
writeFileSync(join(out, 'grammar.json'), JSON.stringify({ units: book.units }));
writeFileSync(join(out, 'strokes.json'), JSON.stringify({ source: vendor.source, license: vendor.license, strokes }));

const extra = new Set(kanjiData.extra);
console.log(
  `Từ vựng: ${words.length} (${wordsData.topics.length} chủ đề) · Kanji: ${kanji.length} (N5: ${kanji.filter((k) => !extra.has(k.ja)).length}, bổ sung: ${extra.size})` +
    ` · Câu giao tiếp: ${phrases.length} · Ngữ pháp: ${book.units.length} chủ đề, ${book.count} điểm · Nét chữ: ${Object.keys(strokes).length}`,
);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
