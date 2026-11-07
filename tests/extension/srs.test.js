// Ôn tập ngắt quãng: khoảng cách ôn và ngày đến hạn.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension } = require('./helpers/env');

const { ctx } = loadExtension(['shared.js']);
const NOW = new Date(2026, 9, 27, 15, 0).getTime(); // 27/10/2026 15:00 giờ máy
const DAY = 86_400_000;

test('khoảng ôn theo từng mức chấm', () => {
  const fresh = { addedAt: NOW };
  assert.equal(ctx.gradeWord(fresh, 0, NOW).srs.interval, 1, 'chưa thuộc → ngày mai');
  assert.equal(ctx.gradeWord(fresh, 1, NOW).srs.interval, 3, 'hơi nhớ → 3 ngày');
  assert.equal(ctx.gradeWord(fresh, 2, NOW).srs.interval, 7, 'đã thuộc → 7 ngày');

  let w = fresh;
  const intervals = [];
  for (let i = 0; i < 4; i++) {
    w = { ...w, ...ctx.gradeWord(w, 2, NOW) };
    intervals.push(w.srs.interval);
  }
  assert.deepEqual(intervals, [7, 18, 45, 113], 'đã thuộc liên tiếp: ×2,5');
  w = { ...w, ...ctx.gradeWord(w, 2, NOW) };
  assert.equal(w.srs.interval, 180, 'tối đa 180 ngày');

  const lapsed = { ...w, ...ctx.gradeWord(w, 0, NOW) };
  assert.equal(lapsed.srs.interval, 1, 'quên thì quay về ngày mai');
  assert.equal(lapsed.srs.lapses, 1);
  assert.equal(lapsed.mark, 0);
  assert.equal(lapsed.srs.reviews, 6);
});

test('ngày đến hạn tính theo ngày (không theo giờ)', () => {
  const graded = { addedAt: NOW, ...ctx.gradeWord({ addedAt: NOW }, 1, NOW) };
  const midnight = new Date(2026, 9, 30).getTime();
  assert.equal(graded.srs.due, midnight, 'hơi nhớ hôm nay → 0 giờ ngày 30/10');
  assert.equal(ctx.isDue(graded, NOW), false);
  assert.equal(ctx.isDue(graded, midnight + 60_000), true);
  assert.equal(ctx.dueLabel(graded, NOW), '3 ngày nữa');
  assert.equal(ctx.dueLabel({ addedAt: NOW, ...ctx.gradeWord({}, 0, NOW) }, NOW), 'ngày mai');
});

test('từ mới lưu cần ôn ngay hôm nay', () => {
  const w = { addedAt: NOW };
  assert.equal(ctx.isDue(w, NOW), true);
  assert.equal(ctx.dueLabel(w, NOW), 'hôm nay');
  assert.equal(ctx.isDue({ addedAt: NOW - 10 * DAY }, NOW), true);
});

test('chấm điểm qua wordOp cập nhật cả wordIndex (để đếm số từ cần ôn)', async () => {
  const d = loadExtension(['shared.js']);
  await d.ctx.saveWord({ word: 'pure' });
  assert.ok(d.store.wordIndex.pure[1] <= Date.now(), 'mới lưu: đến hạn ngay');
  await d.ctx.gradeCard('pure', 2);
  const w = d.store['w:pure'];
  assert.equal(w.mark, 2);
  assert.equal(w.srs.interval, 7);
  assert.equal(d.store.wordIndex.pure[1], w.srs.due);
  d.dispose();
});
