// Test end-to-end trên bản build (dist/) bằng Chrome headless và một Supabase GIẢ (chặn request ở trình duyệt):
// đăng nhập, kho từ tiếng Anh, HSK, tiếng Hàn, flashcard, thống kê – và kiểm tra dữ liệu đẩy lên đúng định dạng.
// Cần: `npm run build` trước, Chrome có trên máy (hoặc CHROME_PATH). Không có thì tự bỏ qua.
// SCREENSHOT_DIR=<thư mục> để lưu ảnh chụp từng trang.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = join(root, 'dist');
const chromePath = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));
const skip = !chromePath ? 'không tìm thấy Chrome' : !existsSync(join(dist, 'index.html')) ? 'chưa build (npm run build)' : false;
const shots = process.env.SCREENSHOT_DIR;

// ---------- Server tĩnh giống Vercel (fallback về index.html + header trong vercel.json) ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const csp = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;

let server;
let base;
let browser;

// ---------- Supabase giả ----------
const USER = { id: '00000000-0000-0000-0000-000000000001', email: 'me@example.com', aud: 'authenticated', role: 'authenticated' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const now = Date.now();
const remote = {
  words: [
    { key: 'settle', data: { key: 'settle', word: 'settle', translation: 'giải quyết, ổn định', mark: 0, addedAt: now - 86_400_000, updatedAt: now - 86_400_000, meanings: [{ pos: 'động từ', terms: ['giải quyết', 'định cư'] }], phonetics: { us: { ipa: '/ˈsɛtəl/', audio: '' }, uk: { ipa: '', audio: '' } }, contexts: [{ text: 'They settle the dispute quickly.', url: 'https://example.com', title: 'Example' }] }, deleted: false, updated_at: now - 86_400_000, synced_at: new Date(now - 86_400_000).toISOString() },
    { key: 'take off', data: { key: 'take off', word: 'take off', translation: 'cất cánh', mark: 2, addedAt: now - 3 * 86_400_000, updatedAt: now - 3 * 86_400_000, meanings: [{ pos: 'động từ', terms: ['cất cánh'] }] }, deleted: false, updated_at: now - 3 * 86_400_000, synced_at: new Date(now - 3 * 86_400_000).toISOString() },
  ],
  items: [],
};
const pushed = { words: [], items: [] };

// Kết quả mẫu của /api/lookup (định dạng của src/lib/dictionary.js)
const LOOKUP = (q) => ({
  word: q,
  isWord: true,
  translation: 'kiên cường',
  meanings: [{ pos: 'tính từ', terms: ['kiên cường', 'đàn hồi'] }],
  senses: [{ pos: 'tính từ', posEn: 'adjective', baseForm: q, definitions: [{ gloss: 'able to recover quickly', example: 'a resilient economy' }], synonyms: ['tough'] }],
  baseForm: q,
  phonetics: { us: { ipa: '[rɪˈzɪljənt]', audio: '' }, uk: { ipa: '', audio: '' } },
  details: { context: '', contextVi: '', senses: [] },
});

async function fakeSupabase(req) {
  const url = new URL(req.url());
  const json = (body, status = 200) => req.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') {
    return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  }
  if (url.pathname === '/auth/v1/token') {
    return json({ access_token: TOKEN, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: USER });
  }
  if (url.pathname === '/auth/v1/user') return json(USER);
  if (url.pathname === '/auth/v1/logout') return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/push_(words|items)$/);
  if (rpc) {
    const { items } = JSON.parse(req.postData());
    pushed[rpc[1]].push(...items);
    return req.respond({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  }
  const table = url.pathname.match(/^\/rest\/v1\/(words|items)$/);
  if (table) return json(remote[table[1]]);
  return json({ message: 'not found ' + url.pathname }, 404);
}

before(async () => {
  if (skip) return;
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || path.endsWith('/')) file = join(dist, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'content-security-policy': csp });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const puppeteer = (await import('puppeteer-core')).default;
  browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: process.env.CI ? ['--no-sandbox'] : [] });
  if (shots) mkdirSync(shots, { recursive: true });
});

after(async () => {
  await browser?.close();
  server?.close();
});

// Bấm bằng element.click(): các khung đang chạy hiệu ứng trượt / mở ra thì bấm theo toạ độ chuột có thể trượt
const tap = (page, sel) => page.$eval(sel, (el) => el.click());

const waitPushed = async (table, pred, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = pushed[table].find(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Không thấy dữ liệu đẩy lên bảng ${table}: ${JSON.stringify(pushed[table]).slice(0, 400)}`);
};

async function openPage({ session = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1180, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  if (session) {
    // Nạp sẵn phiên đăng nhập (giống supabase-js lưu trong localStorage)
    const s = { access_token: TOKEN, refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: USER };
    await page.evaluateOnNewDocument((v) => {
      try {
        localStorage.setItem('languages-auth', v);
      } catch {
        /* about:blank không có localStorage */
      }
    }, JSON.stringify(s));
  }
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('.supabase.co')) return fakeSupabase(req);
    // API tra từ (Vercel Function – server tĩnh của test không chạy): trả kết quả mẫu
    if (new URL(req.url()).pathname === '/api/lookup') {
      const q = new URL(req.url()).searchParams.get('q');
      return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(LOOKUP(q)) });
    }
    return req.continue();
  });
  return { page, errors };
}

test('đăng nhập bằng form', { skip, timeout: 30_000 }, async () => {
  const { page, errors } = await openPage();
  await page.goto(base + '/');
  await page.waitForSelector('.login-card');
  if (shots) await page.screenshot({ path: join(shots, '01-login.png') });
  await page.type('input[type=email]', USER.email);
  await page.type('input[type=password]', 'secret');
  await page.click('.login-card button[type=submit]');
  await page.waitForSelector('.topbar');
  assert.deepEqual(errors, []);
  // Chrome headless hiện hộp "Lưu mật khẩu?" sau khi gửi form và hộp này giữ mọi input của trang,
  // nên phần thao tác bên dưới dùng trang mới với phiên đã đăng nhập sẵn.
  await page.close();
});

test('học và đồng bộ cả 3 ngôn ngữ', { skip, timeout: 90_000 }, async () => {
  const { page, errors } = await openPage({ session: true });
  const snap = async (name) => shots && page.screenshot({ path: join(shots, `${name}.png`), fullPage: false });
  await page.goto(base + '/');
  await page.waitForSelector('.topbar');

  // Tiếng Anh: từ từ server hiện ra; bấm icon mức → đẩy lên bảng words có markLog
  await page.goto(base + '/#/en/words');
  await page.waitForSelector('.en-item');
  assert.equal(await page.$$eval('.en-item', (els) => els.length), 2);
  await snap('02-en-words');
  const settleBtn = await page.$$('.en-item .mark-btn');
  const words = await page.$$eval('.en-word', (els) => els.map((e) => e.textContent));
  await settleBtn[words.indexOf('settle')].click();
  const w = await waitPushed('words', (i) => i.key === 'settle' && i.data.mark === 1);
  assert.equal(w.data.markLog.at(-1)[2], 1, 'markLog ghi lần đổi mức');
  assert.equal(w.data.word, 'settle');
  await page.click('.en-item .en-toggle');
  await page.waitForSelector('.en-body');
  await snap('03-en-open');

  // Tra từ mới ngay trong Kho từ: gõ + Enter → kết quả từ điển → lưu kèm câu ví dụ → đẩy lên bảng words
  await page.type('.toolbar .search input', 'Resilient');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.lookup-card .translation-main');
  assert.equal(await page.$eval('.lookup-card .translation-main', (e) => e.textContent), 'kiên cường');
  await page.type('.lookup-context', 'She is a resilient person.');
  await snap('03b-en-lookup');
  await tap(page, '.lookup-save .btn.primary');
  await page.waitForSelector('.lookup-saved');
  const saved = await waitPushed('words', (i) => i.key === 'resilient');
  assert.equal(saved.data.translation, 'kiên cường');
  assert.equal(saved.data.mark, 0);
  assert.equal(saved.data.contexts[0].text, 'She is a resilient person.');
  assert.equal(saved.data.phonetics.us.ipa, '[rɪˈzɪljənt]');
  await page.waitForFunction(() => [...document.querySelectorAll('.en-word')].some((e) => e.textContent === 'resilient'));
  await tap(page, '.lookup-close');

  // Tiếng Trung: mở từ 爱 ở HSK 1, đánh dấu "Đã thuộc"
  await page.goto(base + '/#/zh/vocab');
  await page.waitForSelector('.tile');
  await snap('04-zh-vocab');
  const tiles = await page.$$('.tile');
  await tiles[0].click();
  await page.waitForSelector('.detail .mark-picker');
  await snap('05-zh-detail');
  await page.click('.detail .mark-picker button:nth-child(3)');
  const z = await waitPushed('items', (i) => i.key.startsWith('zh:1-') && i.data.mark === 2);
  assert.ok(z.data.addedAt && z.data.markLog.length === 1);

  // Ngữ pháp HSK 4 tải được
  await page.goto(base + '/#/zh/grammar4');
  await page.waitForSelector('.lesson');

  // Ngữ pháp tiếng Anh: mở chủ đề đầu, mở điểm "to be", đánh dấu "Đã thuộc" → items "en:g:to-be";
  // bài tập gõ đáp án được chấm; lọc mức "Nâng cao" chỉ còn điểm C1
  await page.goto(base + '/#/en/grammar');
  await page.waitForSelector('.gb-unit');
  await tap(page, '.gb-unit .level-title');
  await page.waitForSelector('.gb-point');
  await tap(page, '.gb-point');
  await page.waitForSelector('.gb-detail .gb-form');
  await snap('05b-en-grammar');
  await tap(page, '.gb-detail .mark-picker button:nth-child(3)');
  const eg = await waitPushed('items', (i) => i.key === 'en:g:to-be' && i.data.mark === 2);
  assert.ok(eg.data.markLog.length === 1);
  await page.type('.gb-practice input', 'are');
  await tap(page, '.gb-practice button[type=submit]');
  await page.waitForSelector('.gb-practice .gb-ok');
  await tap(page, '.grammar-book .pills .pill:nth-child(4)');
  await page.waitForFunction(() => document.querySelectorAll('.gb-point').length > 0 && [...document.querySelectorAll('.gb-point .cefr')].every((e) => e.textContent === 'C1'));

  // Bảng tra cứu: tìm động từ bất quy tắc theo dạng quá khứ; từ thẻ 12 thì mở điểm ngữ pháp chi tiết
  await tap(page, '.grammar-book .seg button:nth-child(2)');
  await page.waitForSelector('.verbs-table tbody tr');
  await page.type('.ref-search input', 'went');
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.verbs-table tbody tr')];
    return rows.length === 1 && rows[0].querySelector('b').textContent === 'go';
  });
  await snap('05c-en-reference');
  await tap(page, '.en-reference .panel:nth-child(2) .panel-head');
  await page.waitForSelector('.tense-card .link-btn');
  await tap(page, '.tense-card .link-btn');
  await page.waitForFunction(() => document.querySelector('.gb-detail .gb-title')?.textContent === 'Present simple');

  // Ngữ pháp TOPIK 1, 2: ví dụ tiếng Hàn có phiên âm Latin
  await page.goto(base + '/#/ko/grammar1');
  await page.waitForSelector('.gb-unit');
  await tap(page, '.gb-unit .level-title');
  await page.waitForSelector('.gb-point');
  await tap(page, '.gb-point');
  await page.waitForSelector('.gb-detail .gb-ex-rr');
  assert.match(await page.$eval('.gb-detail .gb-ex-rr', (e) => e.textContent), /^[a-z' .,?!-]+$/);
  await snap('07b-ko-grammar');
  await page.goto(base + '/#/ko/grammar2');
  await page.waitForSelector('.gb-unit');

  // Tiếng Hàn
  await page.goto(base + '/#/ko/alphabet');
  await page.waitForSelector('.jamo');
  await snap('06-ko-alphabet');
  await page.goto(base + '/#/ko/words');
  await page.waitForSelector('.ko-tile');
  (await page.$$('.ko-tile'))[0].click();
  await page.waitForSelector('.detail .pinyin');
  assert.equal(await page.$eval('.detail .pinyin', (e) => e.textContent), 'annyeonghaseyo');
  await snap('07-ko-words');
  // Lọc TOPIK 2: chỉ còn từ cấp 2 (ô đầu tiên không còn là 안녕하세요)
  await tap(page, '.pills .pill:nth-child(3)');
  await page.waitForFunction(() => document.querySelector('.ko-tile')?.textContent.trim() !== '안녕하세요');
  await tap(page, '.pills .pill:nth-child(1)');
  await page.goto(base + '/#/ko/phrases');
  await page.waitForSelector('.phrase');
  await page.click('.phrase .mark-btn');
  await waitPushed('items', (i) => i.key.startsWith('ko:p:') && i.data.mark === 1);
  await snap('08-ko-phrases');

  // Flashcard tiếng Hàn: học từ mới, chấm "Đã thuộc" → có lịch ôn (srs) và reviewLog
  await page.goto(base + '/#/ko/review');
  await page.waitForSelector('.deck-controls');
  await page.select('.deck-controls label:nth-child(1) select', 'new');
  await page.waitForSelector('.flashcard');
  await snap('09-ko-flashcard');
  await page.click('.flashcard');
  await page.waitForSelector('.fc-back');
  await snap('10-ko-flashcard-back');
  await page.click('.grade.g-2');
  const g = await waitPushed('items', (i) => i.key.startsWith('ko:w:') && i.data.srs?.interval === 7);
  assert.equal(g.data.reviewLog.length, 1);

  // Flashcard tiếng Anh: thẻ cần ôn hôm nay
  await page.goto(base + '/#/en/review');
  await page.waitForSelector('.flashcard');
  await page.keyboard.press('Space');
  await page.waitForSelector('.fc-back');
  await page.keyboard.press('2');
  await waitPushed('words', (i) => i.data.srs?.interval === 3);

  // Thống kê chung
  await page.goto(base + '/#/stats');
  await page.waitForSelector('.stat-card');
  assert.equal(await page.$$eval('.stat-card', (els) => els.length), 3);
  await page.waitForSelector('.chart svg');
  await snap('11-stats');
  const today = await page.$eval('.goal-text b', (e) => Number(e.textContent));
  assert.equal(today, 2, 'đã ôn 2 thẻ hôm nay');

  assert.deepEqual(errors, []);
});


test('giao diện điện thoại không tràn ngang', { skip, timeout: 60_000 }, async () => {
  const { page, errors } = await openPage({ session: true });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const [route, sel, name] of [['#/zh/vocab', '.tile', '12-mobile-zh'], ['#/stats', '.stat-card', '13-mobile-stats'], ['#/ko/review', '.deck-controls', '14-mobile-ko-review'], ['#/en/words', '.en-item', '15-mobile-en'], ['#/en/grammar', '.gb-unit', '16-mobile-en-grammar'], ['#/ko/grammar2', '.gb-unit', '17-mobile-ko-grammar']]) {
    await page.goto(base + '/' + route);
    await page.waitForSelector(sel);
    if (shots) await page.screenshot({ path: join(shots, name + '.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, route + ': trang bị tràn ngang ' + overflow + 'px trên điện thoại');
  }
  assert.deepEqual(errors, []);
});
