// Kiểm tra dữ liệu tiếng Hàn (src/features/ko/data) và xuất bảng phiên âm để rà tay: data-src/ko/review.txt
//   npm run check:ko
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { koEntries } from '../src/features/ko/entries.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, 'src', 'features', 'ko', 'data', f), 'utf8'));
const { words, phrases, problems } = koEntries(read('words.json'), read('phrases.json'));

const lines = [];
for (const e of [...words, ...phrases]) {
  lines.push(`${e.id}\t${e.ko}\t${e.rr}\t${e.pron ? '[' + e.pron + ']' : ''}\t${e.vi}`);
  if (!/^[a-z' .,?!-]+$/.test(e.rr)) problems.push(`Phiên âm lạ: ${e.ko} → ${e.rr}`);
  if (!e.vi) problems.push(`Thiếu nghĩa: ${e.ko}`);
}
writeFileSync(join(root, 'data-src', 'ko', 'review.txt'), lines.join('\n') + '\n');
console.log(`Từ vựng: ${words.length} · Câu giao tiếp: ${phrases.length} → data-src/ko/review.txt`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
