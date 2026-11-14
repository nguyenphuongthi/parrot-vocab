// Logic lõi: ôn tập ngắt quãng, ghi lịch sử, gộp dữ liệu từ server, thống kê.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, computeChanges, gradeWord, isDue, marksByDay, mergeRemote, reviewStats, startOfDay } from '../../src/lib/srs.js';

const NOW = new Date(2026, 10, 6, 10, 0).getTime(); // 6/11/2026 10:00

test('chấm điểm: chưa thuộc → mai, hơi nhớ ≥ 3 ngày, đã thuộc ≥ 7 ngày rồi ×2,5 (tối đa 180)', () => {
  assert.equal(gradeWord({}, 0, NOW).srs.interval, 1);
  assert.equal(gradeWord({}, 1, NOW).srs.interval, 3);
  assert.equal(gradeWord({}, 2, NOW).srs.interval, 7);
  assert.equal(gradeWord({ srs: { interval: 7 } }, 2, NOW).srs.interval, 18);
  assert.equal(gradeWord({ srs: { interval: 100 } }, 2, NOW).srs.interval, 180);
  const g = gradeWord({ srs: { interval: 7, reviews: 2, lapses: 1 } }, 0, NOW);
  assert.deepEqual([g.mark, g.srs.reviews, g.srs.lapses, g.srs.due], [0, 3, 2, startOfDay(NOW) + DAY]);
});

test('items (Trung / Hàn): mục chưa học được tạo khi đánh dấu lần đầu, có addedAt và markLog', () => {
  const { changes } = computeChanges({ op: 'mark', key: 'zh:1-爱', mark: 2 }, () => undefined, { virtual: true, now: NOW });
  const e = changes['zh:1-爱'];
  assert.equal(e.mark, 2);
  assert.equal(e.addedAt, NOW);
  assert.deepEqual(e.markLog, [[NOW, 0, 2]]);
  assert.equal(e.updatedAt, NOW);
});

test('items: đặt "chưa thuộc" cho mục chưa học thì không tạo bản ghi', () => {
  const { changes } = computeChanges({ op: 'mark', key: 'ko:w:학교', mark: 0 }, () => undefined, { virtual: true, now: NOW });
  assert.deepEqual(changes, {});
});

test('words (Anh): không tạo từ mới khi đánh dấu từ không có trong kho', () => {
  const { changes } = computeChanges({ op: 'mark', key: 'ghost', mark: 1 }, () => undefined, { now: NOW });
  assert.deepEqual(changes, {});
});

test('chấm thẻ ghi reviewLog; ôn thêm (practice) chỉ ghi reviewLog, không đổi lịch', () => {
  const prev = { key: 'settle', word: 'settle', mark: 1, srs: { interval: 3, due: NOW, reviews: 1, lapses: 0 } };
  const graded = computeChanges({ op: 'grade', key: 'settle', grade: 2 }, () => prev, { now: NOW }).changes.settle;
  assert.equal(graded.srs.interval, 8); // max(7, 3 × 2,5)
  assert.deepEqual(graded.reviewLog, [NOW]);
  assert.deepEqual(graded.markLog, [[NOW, 1, 2]]);
  const practiced = computeChanges({ op: 'practice', key: 'settle' }, () => prev, { now: NOW }).changes.settle;
  assert.deepEqual(practiced.srs, prev.srs);
  assert.deepEqual(practiced.reviewLog, [NOW]);
});

test('gộp từ server: bản sửa sau thắng, có thay đổi chưa gửi thì giữ bản trên máy', () => {
  const row = { key: 'k', data: { mark: 2 }, deleted: false, updated_at: 200 };
  assert.equal(mergeRemote({ updatedAt: 100 }, undefined, row).mark, 2);
  assert.equal(mergeRemote({ updatedAt: 300 }, undefined, row), undefined);
  assert.equal(mergeRemote({ updatedAt: 100 }, 250, row), undefined);
  assert.equal(mergeRemote({ updatedAt: 100 }, undefined, { ...row, deleted: true }), null);
});

test('isDue: mục chưa có lịch thì đến hạn từ ngày lưu', () => {
  assert.ok(isDue({ addedAt: NOW - DAY }, NOW));
  assert.ok(!isDue({ srs: { due: startOfDay(NOW) + 2 * DAY } }, NOW));
});

test('thống kê: mỗi mục tính một lần mỗi ngày ở mức cuối ngày; chuỗi ngày đạt mục tiêu', () => {
  const day = (d, h = 10) => new Date(2026, 10, d, h).getTime();
  const list = [
    { addedAt: day(3), mark: 2, markLog: [[day(3, 11), 0, 1], [day(3, 12), 1, 2]], reviewLog: [day(5), day(6)] },
    { mark: 1, markLog: [[day(4), 0, 1]], reviewLog: [day(5), day(6)] },
  ];
  const { counts } = marksByDay(list, 2026, 10);
  assert.equal(counts[2][2], 1); // ngày 3: mục 1 cuối ngày "đã thuộc"
  assert.equal(counts[1][3], 1); // ngày 4: mục 2 "hơi nhớ"
  const s = reviewStats(list, 2, NOW);
  assert.deepEqual([s.today, s.reached, s.streak], [2, true, 2]);
});
