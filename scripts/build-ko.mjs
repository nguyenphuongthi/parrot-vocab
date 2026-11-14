// Kiểm tra và xuất dữ liệu tiếng Hàn: data-src/ko → public/data/ko (nằm sau middleware đăng nhập).
//   npm run data:ko
// - words/NN-<chủ đề>.json: { id, name, ko, t1: [từ TOPIK 1…], t2: [từ TOPIK 2…] }
//   Mỗi từ: [tiếng Hàn, nghĩa tiếng Việt, âm Hán Việt (nếu là từ Hán Hàn), tuỳ chọn { id, pron, rr }].
//   Phiên âm Latin và cách đọc tính tự động (src/features/ko/romanize.js); pron / rr chỉ ghi khi đọc bất quy tắc;
//   id chỉ cần khi hai từ cùng chữ (vd. "일(1)" số một / "일(2)" công việc).
// - phrases.json: câu giao tiếp theo tình huống
// - grammar/topik{1,2}/NN-*.json: ngữ pháp TOPIK 1, 2 (định dạng: scripts/lib/grammar.mjs)
// Bảng phiên âm để rà tay ghi vào data-src/ko/reports/review.txt (không đưa lên git).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { koEntries } from '../src/features/ko/entries.js';
import { checkBook, readUnits } from './lib/grammar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'data-src', 'ko');
const out = join(root, 'public', 'data', 'ko');
const reports = join(src, 'reports');
mkdirSync(out, { recursive: true });
mkdirSync(reports, { recursive: true });

const read = (f) => JSON.parse(readFileSync(join(src, f), 'utf8'));
const wordsData = {
  topics: readdirSync(join(src, 'words'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => read(join('words', f))),
};
const phrasesData = read('phrases.json');
const { words, phrases, problems } = koEntries(wordsData, phrasesData);

const lines = [];
for (const e of [...words, ...phrases]) {
  lines.push(`${e.id}\t${e.ko}\t${e.rr}\t${e.pron ? '[' + e.pron + ']' : ''}\t${e.vi}`);
  if (!/^[a-z' .,?!-]+$/.test(e.rr)) problems.push(`Phiên âm lạ: ${e.ko} → ${e.rr}`);
  if (!e.vi) problems.push(`Thiếu nghĩa: ${e.ko}`);
}
writeFileSync(join(reports, 'review.txt'), lines.join('\n') + '\n');
writeFileSync(join(out, 'words.json'), JSON.stringify(wordsData));
writeFileSync(join(out, 'phrases.json'), JSON.stringify(phrasesData));
const byLevel = [1, 2].map((l) => words.filter((w) => w.level === l).length);
console.log(`Từ vựng: ${words.length} (TOPIK 1: ${byLevel[0]} · TOPIK 2: ${byLevel[1]}) · Câu giao tiếp: ${phrases.length}`);

const HANGUL = /[가-힣]/;
const grammarIds = new Set();
for (const level of [1, 2]) {
  const dir = join(src, 'grammar', `topik${level}`);
  if (!existsSync(dir)) continue;
  const book = checkBook(readUnits(dir), { levels: [level], script: HANGUL });
  problems.push(...book.problems.map((p) => `TOPIK ${level} · ${p}`));
  for (const u of book.units) {
    for (const p of u.points) {
      if (grammarIds.has(p.id)) problems.push(`Ngữ pháp trùng id giữa hai cấp: ${p.id}`);
      grammarIds.add(p.id);
    }
  }
  writeFileSync(join(out, `grammar${level}.json`), JSON.stringify({ level, units: book.units }));
  console.log(`Ngữ pháp TOPIK ${level}: ${book.units.length} chủ đề, ${book.count} điểm`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
