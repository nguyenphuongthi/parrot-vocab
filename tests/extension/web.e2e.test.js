// Bản web (Vercel/PWA) chạy trong Chrome headless với header thật từ vercel.json (gồm CSP)
// và Supabase giả: đăng nhập, kéo kho từ, đổi mức, flashcard gõ chính tả, đăng xuất.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromePath, launch, startStaticServer } = require('./helpers/browser');
const { createFakeSupabase } = require('./helpers/fake-supabase');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Chờ tới khi điều kiện đúng (vd. server giả đã nhận dữ liệu đồng bộ) thay vì ngủ một khoảng cố định –
// runner CI chậm hơn máy cá nhân nên sleep cố định từng làm test lúc qua lúc trượt
async function until(check, { timeout = 10_000, step = 100 } = {}) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > end) return false;
    await sleep(step);
  }
  return true;
}

test('bản web: đăng nhập, kho từ, flashcard, CSP, đăng xuất', { skip: !chromePath && 'Không tìm thấy Chrome' }, async () => {
  const sb = createFakeSupabase();
  const email = 'me@x.com';
  sb.seed(email, 'pure', {
    word: 'pure', mark: 0, addedAt: Date.now() - 2000, translation: 'nguyên chất',
    meanings: [{ pos: 'tính từ', terms: ['trong', 'tinh khiết'] }],
    senses: [{ pos: 'tính từ', synonyms: ['clean', 'unmixed'], definitions: [{ gloss: 'not mixed with anything else', example: 'pure gold' }] }],
    phonetics: { us: { ipa: '[ˈpjʊr]', audio: '' }, uk: { ipa: '[ˈpjʊə]', audio: '' } },
    // Nguồn có tiêu đề rất dài + tiền tố giờ (như tên commit GitHub) – từng làm vỡ giao diện điện thoại
    contexts: [{
      text: 'feat(user): add quarterly pure leaderboard from reputation history',
      url: 'https://github.com/LostLink-HCM/LostLink/commit/93df14e0a1b2c3d4e5f60718293a4b5c6d7e8f90',
      title: '14:40 feat(user): add quarterly leaderboard from reputation history · LostLink-HCM/LostLink@93df14e',
      at: 2
    }]
  });
  sb.seed(email, 'exaggerate', {
    word: 'exaggerate', mark: 1, addedAt: Date.now() - 1000, translation: 'phóng đại', forms: ['exaggerating'],
    meanings: [{ pos: 'động từ', terms: ['làm to thêm'] }],
    contexts: [{ text: "I'm genuinely not exaggerating", url: 'https://www.youtube.com/watch?v=abc&t=93s', title: 'Song', time: 93, at: 1 }],
    phonetics: { us: { ipa: '[ɪɡˈzædʒəreɪt]', audio: '' }, uk: { ipa: '[ɪɡˈzædʒəreɪt]', audio: '' } }
  });

  const { server, origin } = await startStaticServer();
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Lỗi tải tài nguyên (vd. 400 khi cố tình nhập sai mật khẩu) là chủ đích của test, không tính
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().startsWith(sb.url)) {
      const r = sb.handle(req.url(), { method: req.method(), headers: req.headers(), body: req.postData() });
      return req.respond({ status: r.status, headers: r.headers, body: r.body });
    }
    if (req.url().endsWith('/config.js')) {
      return req.respond({ status: 200, contentType: 'text/javascript', body: `globalThis.VEL_CONFIG = { supabaseUrl: '${sb.url}', supabaseAnonKey: '${sb.anonKey}' };` });
    }
    req.continue();
  });
  const shown = (sel) => page.$eval(sel, (el) => getComputedStyle(el).display !== 'none');

  try {
    await page.goto(origin + '/', { waitUntil: 'networkidle0' });
    assert.ok(await shown('#gate'), 'chưa đăng nhập: hiện màn hình đăng nhập');
    assert.equal(await shown('main'), false);

    await page.type('#gate-form [name=email]', email);
    await page.type('#gate-form [name=password]', 'sai');
    await page.click('#gate-form button');
    await page.waitForFunction(() => !document.querySelector('#gate-error').hidden);
    assert.match(await page.$eval('#gate-error', (el) => el.textContent), /Sai email/);

    await page.$eval('#gate-form [name=password]', (el) => (el.value = ''));
    await page.type('#gate-form [name=password]', 'pw');
    await page.click('#gate-form button');
    await page.waitForFunction(() => document.querySelectorAll('.item').length === 2);
    assert.equal(await shown('#gate'), false);
    assert.equal(await page.$eval('#due-count', (el) => el.textContent), '2', 'số từ cần ôn trên tab Flashcard');
    assert.match(await page.$eval('.item.st-1', (el) => el.textContent), /▶ 1:33/, 'ngữ cảnh YouTube có thời điểm');
    // Thẻ từ gọn: nghĩa ẩn cho tới khi bấm vào từ
    assert.equal(await shown('.item.st-1 .item-body'), false, 'mặc định chỉ hiện từ, loại từ, phiên âm');
    await page.evaluate(() => {
      window.__spoken = [];
      speechSynthesis.speak = (u) => window.__spoken.push(`${u.text}|${u.lang}`);
    });
    await page.click('.item.st-1 .item-word');
    assert.ok(await shown('.item.st-1 .item-body'), 'bấm vào từ thì hiện nghĩa');
    await page.waitForFunction(() => window.__spoken.length > 0, { timeout: 2000 });
    assert.deepEqual(await page.evaluate(() => window.__spoken), ['exaggerate|en-US'], 'mở thẻ thì tự đọc giọng US');
    await page.click('.item.st-1 .item-word');
    await sleep(200);
    assert.equal(await page.evaluate(() => window.__spoken.length), 1, 'đóng thẻ thì không đọc');
    await page.click('.item.st-1 .item-word'); // mở lại cho các bước sau
    assert.ok(await shown('.item.st-1 .item-body'));
    assert.equal(await shown('#sync-form'), false, 'form đồng bộ của extension bị ẩn trên web');
    const width = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: innerWidth }));
    assert.ok(width.page <= width.screen, `trang không rộng hơn màn hình điện thoại (${width.page} > ${width.screen})`);
    const source = await page.$eval('.item.st-0 .ctx-source', (el) => el.textContent);
    assert.ok(!/^14:40/.test(source) && source.length <= 60, 'tiêu đề nguồn đã bỏ tiền tố giờ và rút gọn: ' + source);

    // Cấp độ CEFR (dữ liệu offline, đọc được dưới CSP của bản web) + lọc theo cấp
    assert.equal(await page.$eval('.item.st-0 .cefr', (el) => el.textContent), 'B1', 'pure: tính từ B1');
    assert.equal(await page.$eval('.item.st-1 .cefr', (el) => el.textContent), 'B2', 'exaggerate: B2');
    const levels = await page.$$eval('#level option', (opts) => opts.map((o) => o.textContent));
    assert.deepEqual(levels, ['Mọi cấp độ (2)', 'A1 (0)', 'A2 (0)', 'B1 (1)', 'B2 (1)', 'C1 (0)', 'C2 (0)', 'Chưa xếp cấp (0)']);
    await page.select('#level', 'B1');
    assert.deepEqual(await page.$$eval('.item .item-word', (els) => els.map((el) => el.textContent)), ['pure']);
    await page.select('#level', 'all');
    await page.waitForFunction(() => document.querySelectorAll('.item').length === 2);

    // Đổi mức thuộc bằng thanh trượt → đẩy lên server
    await page.click('.status[data-key="pure"] .status-stop[data-mark="1"]');
    await page.waitForFunction(() => document.querySelector('.item.st-0') === null);
    await until(() => sb.row(email, 'pure')?.data.mark === 1);
    assert.equal(sb.row(email, 'pure').data.mark, 1);

    // Flashcard – gõ chính tả
    await page.goto(origin + '/#cards', { waitUntil: 'networkidle0' });
    await page.select('#deck-mode', 'type');
    await page.waitForFunction(() => !document.querySelector('#fc-type').hidden);
    const prompt = await page.$eval('#fc-prompt', (el) => el.textContent);
    const answer = /nguyên chất/.test(prompt) ? 'pure' : 'exaggerating'; // gõ dạng đã gặp cũng được tính đúng
    await page.type('#fc-answer', answer);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Chính xác/.test(document.querySelector('#fc-hint').textContent));
    assert.ok(await page.$eval('.grade-btn[data-grade="2"]', (el) => el.classList.contains('suggest')));
    assert.ok(await shown('.back'), 'kiểm tra xong thì lật thẻ');
    // Mặt sau gọn: từ, phiên âm, nghĩa, đồng nghĩa; ngữ cảnh / định nghĩa chỉ hiện khi bấm "Xem chi tiết"
    if (answer === 'pure') assert.match(await page.$eval('.back', (el) => el.textContent), /Đồng nghĩa:\s*clean, unmixed/);
    assert.equal(await shown('.fc-details'), false, 'chi tiết ẩn mặc định');
    await page.click('.fc-more');
    assert.ok(await shown('.fc-details'));
    assert.match(await page.$eval('.fc-details', (el) => el.textContent), /pure leaderboard|not exaggerating/, 'ngữ cảnh nằm trong phần chi tiết');
    await page.keyboard.press('3');
    await page.waitForFunction(() => /Đã ôn 1\/2/.test(document.querySelector('#progress').textContent));
    const gradedKey = answer === 'pure' ? 'pure' : 'exaggerate';
    await until(() => sb.row(email, gradedKey)?.data.srs?.interval === 7);
    assert.equal(sb.row(email, gradedKey).data.srs.interval, 7, 'lịch ôn được đồng bộ lên server');
    assert.equal(await page.$eval('#due-count', (el) => el.textContent), '1');

    // Việt → Anh: mặt trước hiện nghĩa, không hiện từ
    await page.select('#deck-mode', 'vi-en');
    const front = await page.$eval('#fc-prompt', (el) => el.textContent);
    assert.ok(!/\bpure\b|\bexaggerate\b/.test(front), 'mặt trước không lộ đáp án');

    // Thống kê: biểu đồ 3 đường của tháng hiện tại, không làm tràn ngang trang điện thoại
    await page.click('[data-tab="stats"]');
    await page.waitForFunction(() => document.querySelectorAll('#chart .series').length === 3);
    // pure: thêm → Hơi nhớ (thanh trượt) [→ Đã thuộc]; exaggerate: thêm ở mức Hơi nhớ [→ Đã thuộc] – một trong hai vừa chấm "Đã thuộc"
    assert.match(await page.$eval('#chart-legend', (el) => el.textContent), /Chưa thuộc 0.*Hơi nhớ 1.*Đã thuộc 1/);
    assert.equal(await page.$eval('#month-next', (el) => el.disabled), true, 'không xem được tháng tương lai');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'không cuộn ngang cả trang');

    await page.click('[data-tab="cards"]');
    await page.waitForFunction(() => !document.querySelector('#tab-cards').hidden);
    // Ôn hết từ cần ôn hôm nay → ôn thêm ngẫu nhiên trong kho; chấm "Đã thuộc" không đổi mức / lịch ôn
    await page.keyboard.press('3');
    await page.waitForFunction(() => !!document.querySelector('#extra-deck'));
    assert.match(await page.$eval('#deck-done', (el) => el.textContent), /ôn xong 1 từ cần ôn hôm nay/);
    const schedule = () => page.evaluate(async () => {
      const items = await chrome.storage.local.get(['w:pure', 'w:exaggerate']);
      return Object.values(items).map((w) => ({ key: w.key, mark: w.mark, srs: w.srs }));
    });
    // Màn "ôn xong" hiện trước khi điểm vừa chấm ghi xong vào kho – chờ ghi xong rồi mới chụp lại lịch ôn
    // (máy chậm như runner CI từng chụp sớm: thẻ còn mức cũ, rồi bị coi là "ôn thêm làm đổi mức")
    const lastKey = gradedKey === 'pure' ? 'exaggerate' : 'pure';
    await page.waitForFunction(
      async (key) => (await chrome.storage.local.get('w:' + key))['w:' + key]?.mark === 2, // vừa chấm "Đã thuộc"
      { timeout: 5000 },
      lastKey
    );
    const before = await schedule();
    await page.click('#extra-deck');
    await page.waitForFunction(() => /Ôn thêm: 0\/2/.test(document.querySelector('#progress').textContent));
    await page.keyboard.press('3');
    await page.keyboard.press('3');
    await page.waitForFunction(() => /ôn thêm 2 từ/.test(document.querySelector('#deck-done').textContent));
    assert.deepEqual(await schedule(), before);

    // Tải lại: vẫn đăng nhập, dữ liệu còn trong IndexedDB; service worker đã đăng ký
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.documentElement.classList.contains('signed-in'));
    assert.ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));

    // Đăng xuất: xoá dữ liệu trên thiết bị, server vẫn giữ
    await page.goto(origin + '/#settings', { waitUntil: 'networkidle0' });
    await page.click('#sync-out');
    await page.waitForFunction(() => !document.documentElement.classList.contains('signed-in'));
    // Giao diện báo đã đăng xuất ngay khi xoá phiên; dữ liệu trên thiết bị được xoá ngay sau đó
    await page.waitForFunction(async () => !Object.keys(await chrome.storage.local.get(null)).some((k) => k.startsWith('w:')), { timeout: 5000 });
    assert.equal(sb.rows.size, 2);

    assert.deepEqual(await page.evaluate(() => window.__csp), [], 'không vi phạm Content-Security-Policy');
    assert.deepEqual(errors, [], 'không có lỗi JS');
  } finally {
    await browser.close();
    server.close();
  }
});
