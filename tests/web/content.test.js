// Dữ liệu nội dung trong data-src hợp lệ và bản trong public/data đã được build lại (npm run data:en / data:ko).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBook, readUnits } from '../../scripts/lib/grammar.mjs';
import { koEntries } from '../../src/features/ko/entries.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (...p) => join(root, 'data-src', ...p);
const built = (...p) => JSON.parse(readFileSync(join(root, 'public', 'data', ...p), 'utf8'));

test('ngữ pháp tiếng Anh: đúng định dạng, đủ 3 mức, public/data đã cập nhật', () => {
  const book = checkBook(readUnits(src('en', 'grammar')), { levels: ['A1', 'A2', 'B1', 'B2', 'C1'], script: /[A-Za-z]/ });
  assert.deepEqual(book.problems, []);
  const levels = new Set(book.units.flatMap((u) => u.points.map((p) => p.level)));
  assert.deepEqual([...levels].sort(), ['A1', 'A2', 'B1', 'B2', 'C1']);
  assert.ok(book.units.some((u) => u.id === 'spoken'), 'có phần ngữ pháp giao tiếp');
  assert.deepEqual(built('en', 'grammar.json'), { units: book.units }, 'chạy npm run data:en');
});

test('bảng tra cứu tiếng Anh: động từ bất quy tắc, 12 thì, lùi thì – trỏ tới điểm ngữ pháp có thật', () => {
  const ref = built('en', 'reference.json');
  const ids = new Set(built('en', 'grammar.json').units.flatMap((u) => u.points.map((p) => p.id)));
  assert.ok(ref.verbs.length >= 120);
  assert.deepEqual(ref.verbs.find((v) => v[0] === 'go').slice(0, 3), ['go', 'went', 'gone / been']);
  assert.equal(ref.tenses.length, 12);
  for (const t of ref.tenses) assert.ok(ids.has(t.point), t.point);
  assert.ok(ids.has(ref.backshift.point));
  const src = (f) => JSON.parse(readFileSync(join(root, 'data-src', 'en', 'reference', f), 'utf8'));
  assert.deepEqual(ref.verbs, src('irregular-verbs.json').verbs, 'chạy npm run data:en');
});

test('ngữ pháp TOPIK 1, 2: đúng định dạng, không trùng id giữa hai cấp', () => {
  const ids = new Set();
  for (const level of [1, 2]) {
    const book = checkBook(readUnits(src('ko', 'grammar', `topik${level}`)), { levels: [level], script: /[가-힣]/ });
    assert.deepEqual(book.problems, []);
    for (const u of book.units) for (const p of u.points) assert.ok(!ids.has(p.id), `trùng id ${p.id}`), ids.add(p.id);
    assert.deepEqual(built('ko', `grammar${level}.json`), { level, units: book.units }, 'chạy npm run data:ko');
  }
});

test('từ vựng tiếng Hàn: không trùng, có nghĩa, phiên âm hợp lệ, đủ hai cấp TOPIK', () => {
  const topics = readdirSync(src('ko', 'words'))
    .sort()
    .map((f) => JSON.parse(readFileSync(src('ko', 'words', f), 'utf8')));
  const { words, problems } = koEntries({ topics }, JSON.parse(readFileSync(src('ko', 'phrases.json'), 'utf8')));
  assert.deepEqual(problems, []);
  for (const w of words) {
    assert.ok(w.vi, `thiếu nghĩa: ${w.ko}`);
    assert.match(w.rr, /^[a-z' .,?!-]+$/, `phiên âm lạ: ${w.ko}`);
  }
  assert.ok(words.filter((w) => w.level === 1).length >= 900);
  assert.ok(words.filter((w) => w.level === 2).length >= 800);
  assert.deepEqual(built('ko', 'words.json'), { topics }, 'chạy npm run data:ko');
});
