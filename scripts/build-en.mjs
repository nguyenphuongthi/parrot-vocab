// Kiểm tra và xuất ngữ pháp tiếng Anh: data-src/en/grammar/NN-*.json → public/data/en/grammar.json
// và bảng tra cứu: data-src/en/reference/*.json (động từ bất quy tắc, 12 thì, lùi thì) → public/data/en/reference.json
//   npm run data:en
// Định dạng điểm ngữ pháp: scripts/lib/grammar.mjs. Cấp độ theo CEFR (A1–C1), app gom thành 3 mức:
// Cơ bản (A1–A2) · Trung cấp (B1–B2) · Nâng cao (C1).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
// ---------- Bảng tra cứu ----------
const ref = (f) => JSON.parse(readFileSync(join(root, 'data-src', 'en', 'reference', f), 'utf8'));
const ids = new Set(book.units.flatMap((u) => u.points.map((p) => p.id)));
const problems = [...book.problems];
const { verbs } = ref('irregular-verbs.json');
const { tenses } = ref('tenses.json');
const backshift = ref('backshift.json');
const seen = new Set();
for (const v of verbs) {
  if (v.length !== 5 || v.slice(0, 4).some((x) => !x)) problems.push(`Động từ bất quy tắc sai dạng: ${JSON.stringify(v)}`);
  if (seen.has(v[0])) problems.push(`Động từ trùng: ${v[0]}`);
  if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(v[4])) problems.push(`Cấp CEFR lạ: ${v[0]} ${v[4]}`);
  seen.add(v[0]);
}
if ([...seen].join() !== [...seen].sort().join()) problems.push('Động từ bất quy tắc cần xếp theo A → Z');
for (const t of tenses) {
  if (t.form?.length !== 3 || !t.use || !t.ex?.[1]) problems.push(`Thì thiếu nội dung: ${t.name}`);
  if (!ids.has(t.point)) problems.push(`Thì ${t.name}: point không có: ${t.point}`);
}
if (tenses.length !== 12) problems.push(`Cần đủ 12 thì (đang có ${tenses.length})`);
if (!ids.has(backshift.point)) problems.push(`Lùi thì: point không có: ${backshift.point}`);
const { about, ...backshiftData } = backshift;
writeFileSync(join(out, 'reference.json'), JSON.stringify({ verbs, tenses, backshift: backshiftData }));
console.log(`Bảng tra cứu: ${verbs.length} động từ bất quy tắc · ${tenses.length} thì · ${backshift.tenses.length} dòng lùi thì`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
}
