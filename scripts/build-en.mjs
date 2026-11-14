// Kiểm tra và xuất ngữ pháp tiếng Anh: data-src/en/grammar/NN-*.json → public/data/en/grammar.json
//   npm run data:en
// Định dạng điểm ngữ pháp: scripts/lib/grammar.mjs. Cấp độ theo CEFR (A1–C1), app gom thành 3 mức:
// Cơ bản (A1–A2) · Trung cấp (B1–B2) · Nâng cao (C1).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBook, readUnits } from './lib/grammar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'data', 'en');
mkdirSync(out, { recursive: true });

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const book = checkBook(readUnits(join(root, 'data-src', 'en', 'grammar')), { levels: LEVELS, script: /[A-Za-z]/ });
writeFileSync(join(out, 'grammar.json'), JSON.stringify({ units: book.units }));

const per = Object.fromEntries(LEVELS.map((l) => [l, 0]));
for (const u of book.units) for (const p of u.points) per[p.level]++;
console.log(`Ngữ pháp tiếng Anh: ${book.units.length} chủ đề, ${book.count} điểm (${LEVELS.map((l) => `${l}: ${per[l]}`).join(' · ')})`);
if (book.problems.length) {
  console.error(book.problems.join('\n'));
  process.exitCode = 1;
}
