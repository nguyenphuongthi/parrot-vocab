// Tra từ cho web app (src/lib/dictionary.js, dùng trong api/lookup.js) với các nguồn giả – không cần mạng.
// Dữ liệu mẫu dùng chung với test của extension (tests/extension/fixtures), nên hai bên đọc cùng một định dạng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLookupText, lookupWord } from '../../src/lib/dictionary.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'fixtures');
const fixture = (name) => readFileSync(join(fixtures, name), 'utf8');
const ok = (body) => new Response(body, { status: 200 });

function fakeFetch({ google = true, dictionary = false } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url.includes('translate_a/single')) {
      if (!google) return new Response('', { status: 503 });
      // Lần gọi thứ hai (dt=t, nhiều dòng) là dịch định nghĩa / ví dụ: trả số dòng bằng số dòng gửi lên
      if (!url.includes('dt=bd')) {
        const q = decodeURIComponent(new URL(url).searchParams.get('q'));
        return ok(JSON.stringify({ sentences: [{ trans: q.split('\n').map((_, i) => `VI ${i}`).join('\n') }] }));
      }
      return ok(fixture('google-perform.json'));
    }
    if (url.includes('dictionaryapi.dev')) return dictionary ? ok(JSON.stringify([])) : new Response('[]', { status: 404 });
    if (url.includes('wiktionary.org')) return ok(fixture('wiktionary-perform.json'));
    throw new Error('Không mong đợi: ' + url);
  };
  return { fn, calls };
}

test('chỉ tra từ / cụm từ tiếng Anh ngắn', () => {
  assert.ok(isLookupText('perform'));
  assert.ok(isLookupText('Take Off'));
  assert.ok(isLookupText("don't"));
  assert.ok(!isLookupText(''));
  assert.ok(!isLookupText('xin chào'));
  assert.ok(!isLookupText('a b c d e f'));
  assert.ok(!isLookupText('x'.repeat(61)));
});

test('tra "Perform": nghĩa, từ loại, định nghĩa, phiên âm Wiktionary, bản dịch định nghĩa – cùng định dạng extension', async () => {
  const { fn } = fakeFetch();
  const d = await lookupWord('  Perform ', fn);
  assert.equal(d.word, 'perform');
  assert.equal(d.isWord, true);
  assert.equal(d.translation, 'trình diễn');
  assert.equal(d.meanings[0].pos, 'động từ');
  assert.ok(d.meanings[0].terms.length <= 6);
  assert.ok(d.senses.length > 0 && d.senses[0].definitions[0].gloss);
  assert.equal(d.senses[0].posEn, 'verb');
  assert.match(d.phonetics.us.ipa, /^\[.+\]$/);
  assert.match(d.details.senses[0].definitions[0].glossVi, /^VI \d+$/);
  assert.deepEqual(Object.keys(d).sort(), ['baseForm', 'details', 'isWord', 'meanings', 'phonetics', 'senses', 'translation', 'word']);
});

test('Google lỗi cả hai endpoint: báo lỗi dễ hiểu', async () => {
  const { fn, calls } = fakeFetch({ google: false });
  await assert.rejects(lookupWord('perform', fn), /Không dịch được/);
  assert.equal(calls.filter((u) => u.includes('translate_a')).length, 2, 'thử cả hai endpoint');
});

test('từ không hợp lệ bị từ chối trước khi gọi mạng', async () => {
  const { fn, calls } = fakeFetch();
  await assert.rejects(lookupWord('xin chào', fn), /tiếng Anh/);
  assert.equal(calls.length, 0);
});
