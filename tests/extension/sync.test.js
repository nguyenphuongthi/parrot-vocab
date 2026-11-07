// Đồng bộ hai "máy" qua Supabase giả.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension, words } = require('./helpers/env');
const { createFakeSupabase } = require('./helpers/fake-supabase');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const marks = (d) => Object.fromEntries(Object.entries(words(d)).map(([k, w]) => [k, w.mark]));

test('đồng bộ hai máy: đăng nhập, đổi mức, xoá, xung đột, mất mạng, hết hạn token, đăng xuất', async () => {
  const sb = createFakeSupabase();
  const login = { url: sb.url + '/', anonKey: sb.anonKey, email: 'me@x.com', password: 'pw' };
  let online = true;
  const A = loadExtension(['shared.js', 'sync.js'], { fetch: (...a) => (online ? sb.fetch(...a) : Promise.reject(new TypeError('offline'))) });
  const B = loadExtension(['shared.js', 'sync.js'], { fetch: sb.fetch });

  await assert.rejects(A.ctx.syncSignIn({ ...login, password: 'sai' }), /Sai email/);
  await assert.rejects(A.ctx.syncSignIn({ ...login, url: 'http://evil.com' }), /Project URL/);

  // A có sẵn từ (cả dạng cũ) trước khi đăng nhập
  await A.ctx.saveWord({ word: 'perform', translation: 'thực hiện' });
  await A.ctx.saveWord({ word: 'take off', translation: 'cất cánh' });
  await A.ctx.syncSignIn(login);
  assert.equal(A.store.syncState.status, 'ok');
  assert.deepEqual(A.store.dirty, {});
  assert.equal(sb.rows.size, 2);

  await B.ctx.syncSignIn(login);
  assert.deepEqual(Object.keys(words(B)).sort(), ['perform', 'take off']);
  assert.deepEqual(Object.keys(B.store.wordIndex).sort(), ['perform', 'take off'], 'kéo về cũng cập nhật index');
  assert.deepEqual(B.store.dirty, {}, 'dữ liệu kéo về không bị đẩy ngược lên');

  await sleep(5);
  await B.ctx.gradeCard('perform', 2);
  await B.ctx.syncNow();
  await A.ctx.syncNow();
  assert.equal(marks(A).perform, 2);
  assert.equal(words(A).perform.srs.interval, 7, 'lịch ôn cũng được đồng bộ');

  await sleep(5);
  await A.ctx.removeWord('take off');
  await A.ctx.syncNow();
  await B.ctx.syncNow();
  assert.equal(words(B)['take off'], undefined);

  // Cả hai sửa khi chưa đồng bộ: bản sửa sau thắng
  await A.ctx.setMark('perform', 0);
  await sleep(5);
  await B.ctx.setMark('perform', 1);
  await A.ctx.syncNow();
  await B.ctx.syncNow();
  await A.ctx.syncNow();
  assert.equal(marks(A).perform, 1);
  assert.equal(marks(B).perform, 1);

  // Mất mạng: thay đổi nằm chờ trong dirty, có mạng thì gửi
  online = false;
  await A.ctx.saveWord({ word: 'running', translation: 'đang chạy' });
  await A.ctx.syncNow();
  assert.equal(A.store.syncState.status, 'error');
  assert.ok(A.store.dirty.running);
  online = true;
  await A.ctx.syncNow();
  await B.ctx.syncNow();
  assert.ok(words(B).running);

  // Token hết hạn thì tự làm mới
  A.store.syncSession.expires_at = 0;
  await A.ctx.syncNow();
  assert.equal(A.store.syncState.status, 'ok');
  assert.ok(A.store.syncSession.expires_at > Date.now() / 1000);

  await A.ctx.syncSignOut();
  assert.equal(A.store.syncSession, undefined);
  assert.equal(Object.keys(words(A)).length, 2, 'đăng xuất trong extension giữ nguyên kho');

  // clearLocalWords (dùng khi đăng xuất trên web) xoá sạch kho trên thiết bị
  await B.ctx.clearLocalWords();
  assert.equal(Object.keys(words(B)).length, 0);
  assert.equal(B.store.wordIndex, undefined);
  assert.equal(sb.rows.size, 3, 'dữ liệu trên server vẫn còn');

  A.dispose();
  B.dispose();
});

test('dữ liệu kéo về từ máy chưa cập nhật (từ còn chữ hoa) được viết thường', async () => {
  const sb = createFakeSupabase();
  sb.seed('me@x.com', 'settle', { word: 'SETTLE', mark: 1, addedAt: 1, translation: 'giải quyết' });
  const d = loadExtension(['shared.js', 'sync.js'], { fetch: sb.fetch });
  await d.ctx.syncSignIn({ url: sb.url, anonKey: sb.anonKey, email: 'me@x.com', password: 'pw' });
  assert.equal(words(d).settle.word, 'settle');
  assert.equal(words(d).settle.mark, 1);
  d.dispose();
});

test('Supabase chưa chạy schema.sql: báo lỗi dễ hiểu', async () => {
  const sb = createFakeSupabase();
  const fetch = async (url, init) =>
    /rpc|rest/.test(url) && !/auth/.test(url)
      ? new Response(JSON.stringify({ code: 'PGRST202', message: 'not found' }), { status: 404 })
      : sb.fetch(url, init);
  const d = loadExtension(['shared.js', 'sync.js'], { fetch });
  await d.ctx.saveWord({ word: 'pure' });
  await d.ctx.syncSignIn({ url: sb.url, anonKey: sb.anonKey, email: 'me@x.com', password: 'pw' });
  assert.equal(d.store.syncState.status, 'error');
  assert.match(d.store.syncState.message, /schema\.sql/);
  d.dispose();
});
