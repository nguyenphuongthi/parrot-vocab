// Kho từ: mỗi từ một key, một nơi ghi tuần tự, wordIndex, chuyển dữ liệu dạng cũ.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension, words, plain } = require('./helpers/env');

const entry = (word, extra = {}) => ({ word, translation: 'nghĩa của ' + word, meanings: [], ...extra });
const ctxOf = (text, extra = {}) => ({ text, url: 'https://example.com', title: 'Example', at: Date.now(), ...extra });

test('lưu từ: mỗi từ một key, có wordIndex và đánh dấu cần đồng bộ', async () => {
  const d = loadExtension(['shared.js']);
  const saved = await d.ctx.saveWord(entry('Perform', { contexts: [ctxOf('We perform tests.')] }));
  assert.equal(saved.key, 'perform');
  assert.equal(saved.mark, 0);
  assert.ok(d.store['w:perform']);
  assert.equal(d.store.wordIndex.perform[0], 0, 'mức thuộc trong index');
  assert.ok(d.store.dirty.perform, 'có trong dirty');
  assert.equal(d.store.words, undefined, 'không còn dùng key gộp cũ');
  d.dispose();
});

test('lưu lại cùng một từ: gộp ngữ cảnh (mới nhất trước, không trùng, tối đa 5) và các dạng', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('exaggerate', { contexts: [ctxOf('Câu 1')], forms: ['exaggerating'] }));
  for (let i = 2; i <= 7; i++) await d.ctx.addContext('exaggerate', ctxOf('Câu ' + i));
  // Trùng câu (khác hoa thường): giữ bản mới nhất (nguồn/thời điểm mới), không thành hai câu
  await d.ctx.addContext('exaggerate', ctxOf('câu 7', { url: 'https://new.example' }));
  await d.ctx.saveWord(entry('exaggerate', { forms: ['exaggerated'] }));
  const w = words(d).exaggerate;
  assert.deepEqual(w.contexts.map((c) => c.text), ['câu 7', 'Câu 6', 'Câu 5', 'Câu 4', 'Câu 3']);
  assert.equal(w.contexts[0].url, 'https://new.example');
  assert.deepEqual(w.forms.sort(), ['exaggerated', 'exaggerating']);
  assert.deepEqual(d.store.wordIndex.exaggerate.slice(2).sort(), ['exaggerated', 'exaggerating']);
  d.dispose();
});

test('đổi mức, sửa, xoá', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('pure'));
  await d.ctx.setMark('pure', 2);
  assert.equal(words(d).pure.mark, 2);
  assert.equal(d.store.wordIndex.pure[0], 2);
  await d.ctx.patchWord('pure', { translation: 'tinh khiết' });
  assert.equal(words(d).pure.translation, 'tinh khiết');
  assert.equal(await d.ctx.setMark('không có', 1), null, 'sửa từ không tồn tại thì không làm gì');
  await d.ctx.removeWord('pure');
  assert.equal(words(d).pure, undefined);
  assert.equal(d.store.wordIndex.pure, undefined);
  assert.ok(d.store.dirty.pure, 'xoá cũng phải đồng bộ');
  d.dispose();
});

test('nhiều thao tác cùng lúc không đè mất nhau', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('busy'));
  await Promise.all([
    ...Array.from({ length: 40 }, (_, i) => d.ctx.saveWord(entry('word' + i))),
    ...Array.from({ length: 5 }, (_, i) => d.ctx.addContext('busy', ctxOf('Ngữ cảnh ' + i))),
    d.ctx.setMark('busy', 1)
  ]);
  const all = words(d);
  assert.equal(Object.keys(all).length, 41);
  assert.equal(all.busy.contexts.length, 5);
  assert.equal(all.busy.mark, 1);
  assert.equal(Object.keys(d.store.wordIndex).length, 41);
  assert.equal(Object.keys(d.store.dirty).length, 41);
  d.dispose();
});

test('cấp độ CEFR: tra theo từ, dạng gốc, bỏ đuôi; ưu tiên loại từ khớp nghĩa', () => {
  const { ctx } = loadExtension(['shared.js']);
  const index = {
    settle: { v: 'B1' }, book: { n: 'A1', v: 'B1' }, clue: { n: 'A2' }, run: { n: 'A1', v: 'A1' },
    study: { v: 'A1', n: 'A2' }, perform: { v: 'A2' }, 'according to': { prep: 'B1' }, seven: { x: 'A1' }
  };
  const level = (word, opts) => ctx.cefrOf(index, word, opts)?.level ?? null;
  assert.equal(level('SETTLE'), 'B1');
  assert.equal(level('settled'), 'B1', 'bỏ đuôi -ed');
  assert.equal(level('clues'), 'A2', 'bỏ đuôi -s');
  assert.equal(level('studies'), 'A1', '-ies → -y');
  assert.equal(level('running'), 'A1', 'running → runn → run');
  assert.equal(level('performing', { baseForm: 'perform' }), 'A2');
  assert.equal(level('According  to'), 'B1', 'cụm từ');
  assert.equal(level('book'), 'A1', 'không biết loại từ: lấy cấp thấp nhất');
  assert.equal(level('book', { classes: ['động từ'] }), 'B1', 'từ đã lưu là động từ: lấy cấp của động từ');
  assert.equal(level('book', { classes: ['tính từ'] }), 'A1', 'loại từ không khớp: cấp thấp nhất');
  assert.equal(level('seven'), 'A1');
  assert.equal(level('collision'), null, 'ngoài danh sách');
  assert.equal(level('bus'), null, 'bỏ đuôi ra "bu" không có trong danh sách thì thôi');
  const book = ctx.cefrOf(index, 'books');
  assert.deepEqual(plain(book), { level: 'A1', byPos: { 'danh từ': 'A1', 'động từ': 'B1' }, lemma: 'book' });

  const esc = (s) => String(s);
  assert.match(ctx.cefrBadge(book, esc), /class="cefr cefr-a" title="Cấp độ CEFR A1 \(danh từ A1 · động từ B1\) – theo “book”">A1</);
  assert.equal(ctx.cefrBadge(null, esc), '');
  assert.match(ctx.cefrBadge(null, esc, { showUnknown: true }), /chưa xếp cấp/);
});

test('dữ liệu CEFR: gộp A1–B2 và C1–C2, trùng thì lấy cấp thấp hơn; lỗi tải thì coi như không có', async () => {
  const files = {
    'data/cefr-j.json': { abolish: { v: 'B2' }, pure: { adj: 'B1' } },
    'data/cefr-c1c2.json': { abolish: { v: 'C2', n: 'C1' }, timid: { adj: 'C1' } }
  };
  const fetch = async (url) => new Response(JSON.stringify(files[url]), { status: files[url] ? 200 : 404 });
  const { ctx } = loadExtension(['shared.js'], { fetch });
  const index = await ctx.loadCefrIndex();
  assert.deepEqual(plain(index), { abolish: { v: 'B2', n: 'C1' }, pure: { adj: 'B1' }, timid: { adj: 'C1' } });
  assert.equal(await ctx.loadCefrIndex(), index, 'chỉ tải một lần');

  const offline = loadExtension(['shared.js'], { fetch: () => Promise.reject(new TypeError('offline')) });
  assert.deepEqual(plain(await offline.ctx.loadCefrIndex()), {});
});

test('file dữ liệu CEFR đi kèm extension đọc được và có các cấp A1–C2', () => {
  const read = (f) => JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'extension', 'data', f), 'utf8'));
  const a = read('cefr-j.json');
  const c = read('cefr-c1c2.json');
  assert.ok(Object.keys(a).length > 6000 && Object.keys(c).length > 1500);
  assert.deepEqual(a.book, { n: 'A1', v: 'B1' });
  assert.deepEqual(a.advisor, a.adviser, '"adviser/advisor" tách thành hai từ');
  assert.deepEqual(c.timid, { adj: 'C1' });
  const levels = new Set([...Object.values(a), ...Object.values(c)].flatMap((e) => Object.values(e)));
  assert.deepEqual([...levels].sort(), ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
});

test('từ luôn lưu chữ thường: bôi đen "SETTLE" / "Settle", nhập từ file', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('SETTLE'));
  await d.ctx.saveWord(entry('Settle', { forms: ['settled'] }));
  assert.equal(words(d).settle.word, 'settle');
  assert.deepEqual(words(d).settle.forms, ['settled'], 'cùng một từ, không thành hai mục');
  await d.ctx.importWords([entry('Take Off'), entry('PURE')]);
  assert.equal(words(d)['take off'].word, 'take off');
  assert.equal(words(d).pure.word, 'pure');
  d.dispose();
});

test('từ cũ còn chữ hoa được sửa thành chữ thường một lần, không đẩy lên server', async () => {
  const old = { key: 'settle', word: 'SETTLE', mark: 2, addedAt: 1, updatedAt: 5, srs: { interval: 7, due: 9 } };
  const d = loadExtension(['shared.js'], {
    storage: { 'w:settle': old, 'w:pure': { key: 'pure', word: 'pure', mark: 0, addedAt: 2 }, wordIndex: { settle: [2, 9], pure: [0, 2] } }
  });
  await d.ctx.migrateLegacyWords();
  assert.deepEqual(plain(words(d).settle), { ...old, word: 'settle' }, 'mức thuộc, lịch ôn, updatedAt giữ nguyên');
  assert.equal(d.store.dirty, undefined, 'không đánh dấu cần đồng bộ');
  assert.equal(d.store.wordsLowercased, true);
  d.dispose();
});

test('dữ liệu dạng cũ (cả kho trong một key) được tách ra, giữ nguyên câu ngữ cảnh', async () => {
  const legacy = {
    words: {
      pure: { key: 'pure', word: 'pure', mark: 1, addedAt: 1, context: 'pure water', source: { url: 'https://a.com', title: 'A' } },
      running: { key: 'running', word: 'running', mark: 2, addedAt: 2 }
    }
  };
  const d = loadExtension(['shared.js'], { storage: legacy });
  assert.equal(Object.keys(await d.ctx.getWords()).length, 2, 'đọc được cả trước khi tách');
  await d.ctx.saveWord(entry('new'));
  assert.equal(d.store.words, undefined);
  assert.deepEqual(Object.keys(words(d)).sort(), ['new', 'pure', 'running']);
  assert.deepEqual(Object.keys(d.store.wordIndex).sort(), ['new', 'pure', 'running']);
  assert.deepEqual(plain(d.ctx.contextsOf(words(d).pure).map((c) => c.text)), ['pure water']);
  await d.ctx.addContext('pure', ctxOf('pure gold'));
  assert.deepEqual(words(d).pure.contexts.map((c) => c.text), ['pure gold', 'pure water']);
  d.dispose();
});

test('nhập nhiều từ một lần', async () => {
  const d = loadExtension(['shared.js']);
  const count = await d.ctx.importWords([entry('a1', { mark: 2 }), entry('a2'), entry('a3')]);
  assert.equal(count, 3);
  assert.equal(words(d).a1.mark, 2);
  d.dispose();
});

test('lịch sử đổi mức (markLog): chỉ ghi khi mức thật sự đổi, tối đa 50 lần', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('fade'));
  assert.equal(words(d).fade.markLog, undefined, 'từ mới không cần ghi lịch sử');
  await d.ctx.setMark('fade', 2);
  await d.ctx.gradeCard('fade', 0);
  await d.ctx.gradeCard('fade', 0); // vẫn chưa thuộc: không ghi thêm
  await d.ctx.patchWord('fade', { translation: 'phai' });
  const log = words(d).fade.markLog;
  assert.deepEqual(log.map(([, from, to]) => [from, to]), [[0, 2], [2, 0]]);
  assert.ok(log.every(([at]) => typeof at === 'number'));
  for (let i = 0; i < 60; i++) await d.ctx.setMark('fade', i % 2 ? 0 : 1);
  assert.equal(words(d).fade.markLog.length, 50);
  d.dispose();
});

test('lịch sử ôn thẻ (reviewLog): chấm thẻ và ôn thêm đều ghi; ôn thêm không đổi mức / lịch ôn', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord(entry('fade'));
  await d.ctx.setMark('fade', 1);
  await d.ctx.patchWord('fade', { translation: 'phai' });
  assert.equal(words(d).fade.reviewLog, undefined, 'lưu / đổi mức bằng thanh trượt / sửa không phải là ôn thẻ');
  await d.ctx.gradeCard('fade', 2);
  const graded = words(d).fade;
  await d.ctx.practiceCard('fade');
  const practiced = words(d).fade;
  assert.equal(practiced.reviewLog.length, 2);
  assert.deepEqual(plain({ mark: practiced.mark, srs: practiced.srs }), plain({ mark: graded.mark, srs: graded.srs }));
  assert.ok(d.store.dirty.fade, 'ôn thêm cũng được đồng bộ (mục tiêu ngày trên máy khác)');
  for (let i = 0; i < 60; i++) await d.ctx.practiceCard('fade');
  assert.equal(words(d).fade.reviewLog.length, 50);
  d.dispose();
});

test('mục tiêu ngày và chuỗi ngày liên tiếp đạt mục tiêu', () => {
  const { ctx } = loadExtension(['shared.js']);
  const at = (day, hour = 10) => new Date(2026, 9, day, hour).getTime(); // tháng 10/2026
  const reviews = (day, n) => Array.from({ length: n }, (_, i) => at(day, 8 + (i % 12)));
  const list = [
    { reviewLog: [...reviews(10, 2), ...reviews(11, 3), ...reviews(12, 1)] },
    { reviewLog: [...reviews(10, 1), ...reviews(12, 2), ...reviews(13, 3)] },
    { reviewLog: reviews(14, 1) },
    {}
  ];
  // Ngày 14: mới 1/3 thẻ – chưa đạt nhưng chưa làm đứt chuỗi 11, 12, 13 (10 cũng đạt nên chuỗi là 4)
  assert.deepEqual(plain(ctx.reviewStats(list, 3, at(14, 20))), { today: 1, goal: 3, reached: false, streak: 4 });
  assert.deepEqual(plain(ctx.reviewStats(list, 3, at(13, 22))), { today: 3, goal: 3, reached: true, streak: 4 });
  assert.equal(ctx.reviewStats(list, 4, at(14)).streak, 0, 'không ngày nào đủ 4 thẻ');
  assert.equal(ctx.reviewStats(list, 3, at(16)).streak, 0, 'bỏ một ngày (15) là đứt chuỗi');
  assert.equal(ctx.reviewStats(list, 0, at(14)).goal, 1, 'mục tiêu tối thiểu 1 thẻ');
});

test('thống kê theo ngày: số từ được đánh dấu vào từng mức, đổi nhiều lần trong ngày tính theo mức cuối', () => {
  const { ctx } = loadExtension(['shared.js']);
  const at = (day, hour = 10) => new Date(2026, 9, day, hour).getTime(); // tháng 10/2026
  const list = [
    { addedAt: at(1) },                                                    // A: thêm mới → Chưa thuộc
    { addedAt: at(1, 23), markLog: [[at(3), 0, 1], [at(5), 1, 0]] },        // B: lên Hơi nhớ, rồi về Chưa thuộc
    { addedAt: at(2), markLog: [[at(3), 0, 2], [at(5), 2, 0]] },            // C: lên Đã thuộc, rồi về Chưa thuộc
    { addedAt: at(10, 8), markLog: [[at(10, 9), 0, 1], [at(10, 11), 1, 2]] }, // D: thêm rồi đổi 2 lần cùng ngày
    { addedAt: at(1), markLog: [[at(12, 9), 0, 1], [at(12, 11), 1, 0]] },   // E: ngày 12 đổi rồi quay về mức cũ
    { addedAt: at(1), markLog: [[at(15), 0, 2]] },                          // F: mức cũ đặt từ hôm trước
    { addedAt: new Date(2026, 8, 1).getTime(), markLog: [[at(31, 23), 1, 2]] }, // G: ngày cuối tháng
    { addedAt: new Date(2026, 8, 30).getTime(), markLog: [[new Date(2026, 10, 1).getTime(), 1, 0]] }, // ngoài tháng
    { addedAt: at(20), mark: 2 },                                           // I: nhập từ file ở mức Đã thuộc
    { word: 'không có addedAt' }
  ];
  const s = ctx.marksByDay(list, 2026, 9);
  const [m0, m1, m2] = s.counts;
  const sum = (a) => a.reduce((x, y) => x + y);
  assert.equal(s.days, 31);
  assert.equal(m0[0], 4, 'ngày 1: A, B, E, F thêm mới');
  assert.equal(m0[1], 1);
  assert.equal(m1[2], 1);
  assert.equal(m2[2], 1);
  assert.equal(m0[4], 2, 'ngày 5: B và C bị đánh về Chưa thuộc');
  assert.equal(m0[9], 0, 'D: Chưa thuộc +1 rồi -1 khi đổi mức trong ngày');
  assert.equal(m1[9], 0, 'D: Hơi nhớ +1 rồi -1');
  assert.equal(m2[9], 1, 'D: chỉ tính mức cuối của ngày');
  assert.equal(m0[11] + m1[11] + m2[11], 0, 'E: cuối ngày quay về mức đầu ngày thì không tính');
  assert.equal(m2[14], 1, 'F: Đã thuộc +1');
  assert.equal(m0[0], 4, 'F: mức đặt từ hôm trước không bị trừ');
  assert.equal(m2[30], 1, 'ngày cuối tháng');
  assert.equal(m2[19], 1, 'I: từ nhập ở mức Đã thuộc không tính là Chưa thuộc');
  assert.deepEqual([sum(m0), sum(m1), sum(m2)], [7, 1, 5]);
  assert.equal(ctx.marksByDay([], 2026, 1).days, 28);
});
