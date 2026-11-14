// Flashcard trong trang Kho từ của extension (Chrome headless, màn hình điện thoại cảm ứng): tự đọc mỗi thẻ mới, vuốt để chấm,
// mục tiêu ngày, nguồn "Từ mới 7 ngày qua" / "Từ hay quên", tổng kết cuối lượt, trắc nghiệm 4 đáp án.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromePath, launch, pageShim, startStaticServer } = require('./helpers/browser');
const { createFakeSupabase } = require('./helpers/fake-supabase');

// Đăng nhập đồng bộ như khi bấm "Đăng nhập & đồng bộ" trong Cài đặt (gửi thẳng message, không qua form mật khẩu
// – Chrome headless hiện hộp lưu mật khẩu sau khi submit và nuốt các thao tác tiếp theo).
const signIn = (page, sb, email, password = 'pw') =>
  page.evaluate(
    (msg) => chrome.runtime.sendMessage(msg),
    { type: 'syncSignIn', url: sb.url, anonKey: sb.anonKey, email, password }
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 60 * 60 * 1000;

test('flashcard: tự đọc, vuốt để chấm, mục tiêu ngày, tổng kết, trắc nghiệm', { skip: !chromePath && 'Không tìm thấy Chrome' }, async () => {
  const sb = createFakeSupabase();
  const email = 'me@x.com';
  const word = (w, translation, extra) => ({ word: w, translation, meanings: [], phonetics: { us: { ipa: '', audio: '' }, uk: { ipa: '', audio: '' } }, ...extra });
  // pure, dense: cần ôn hôm nay · bright: hay quên, chưa tới hạn · calm: lưu từ 30 ngày trước, chưa tới hạn
  const later = { interval: 3, due: Date.now() + 3 * DAY, reviews: 4 };
  sb.seed(email, 'pure', word('pure', 'nguyên chất', { mark: 0, addedAt: Date.now() - 3000 }));
  sb.seed(email, 'dense', word('dense', 'dày đặc', { mark: 0, addedAt: Date.now() - 2000 }));
  sb.seed(email, 'bright', word('bright', 'sáng sủa', { mark: 1, addedAt: Date.now() - 1000, srs: { ...later, lapses: 2 } }));
  sb.seed(email, 'calm', word('calm', 'bình tĩnh', { mark: 2, addedAt: Date.now() - 30 * DAY, srs: { ...later, lapses: 0 } }));

  const { server, origin } = await startStaticServer();
  const browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.evaluateOnNewDocument(pageShim());
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    // Ghi lại các lần đọc (giọng đọc của trình duyệt) thay vì phát ra loa
    window.__spoken = [];
    speechSynthesis.speak = (u) => window.__spoken.push(`${u.text}|${u.lang}`);
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

  const text = (sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
  const shown = (sel) => page.$eval(sel, (el) => !el.closest('[hidden]'));
  const spoken = () => page.evaluate(() => window.__spoken);
  const currentWord = () => page.evaluate(() => deck.queue[0]);
  // Vuốt ngang trên thẻ bằng ngón tay (pointer events kiểu touch)
  const swipe = (dx) =>
    page.evaluate((dx) => {
      const card = document.querySelector('#flashcard');
      const r = card.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const fire = (type, cx) => card.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', isPrimary: true, clientX: cx, clientY: y, bubbles: true }));
      fire('pointerdown', x);
      fire('pointermove', x + dx / 2);
      fire('pointermove', x + dx);
      fire('pointerup', x + dx);
    }, dx);

  try {
    await page.goto(origin + '/', { waitUntil: 'networkidle0' });
    assert.equal((await signIn(page, sb, email)).ok, true);
    await page.waitForFunction(() => document.querySelectorAll('.item').length === 4);

    await page.click('[data-tab="cards"]');
    await page.waitForFunction(() => !document.querySelector('#tab-cards').hidden && !!deck.queue.length);
    assert.match(await text('#tab-cards .goal'), /Hôm nay 0\/20 thẻ.*🔥 0 ngày liên tiếp/);
    const sources = await page.$$eval('#deck-source option', (opts) => opts.map((o) => o.textContent));
    assert.deepEqual(sources, ['Cần ôn hôm nay (2)', 'Từ mới 7 ngày qua (3)', 'Từ hay quên (1)', 'Theo mức thuộc (3)']);

    // Thẻ mới tự đọc giọng US (Anh → Việt)
    const first = await currentWord();
    await page.waitForFunction(() => window.__spoken.length === 1);
    assert.deepEqual(await spoken(), [`${first}|en-US`]);

    // Chưa lật thẻ thì vuốt không chấm; lật rồi vuốt phải = Đã thuộc → sang thẻ sau, thẻ sau cũng tự đọc
    await swipe(150);
    assert.equal(await currentWord(), first, 'chưa xem đáp án thì vuốt không chấm');
    await page.click('#flashcard');
    assert.ok(await shown('.back'));
    await swipe(150);
    await page.waitForFunction(() => /Đã ôn 1\/2/.test(document.querySelector('#progress').textContent));
    const second = await currentWord();
    assert.notEqual(second, first);
    assert.ok(await shown('.front'), 'thả tay sau khi vuốt không lật luôn thẻ mới');
    await page.waitForFunction(() => window.__spoken.length === 2);
    assert.equal((await spoken())[1], `${second}|en-US`);
    assert.match(await text('#tab-cards .goal'), /Hôm nay 1\/20 thẻ/);
    assert.equal(await page.evaluate((k) => words[k].mark, first), 2);

    // Vuốt trái = Chưa thuộc → gặp lại trong lượt; lần này nhớ → hết lượt, có tổng kết
    await page.click('#flashcard');
    await swipe(-150);
    await page.waitForFunction((k) => deck.queue[0] === k && !document.querySelector('.front').hidden, {}, second);
    await page.keyboard.press('3');
    await page.waitForFunction(() => !!document.querySelector('.deck-summary'));
    assert.match(await text('.deck-summary'), /1\s*chưa thuộc.*0\s*hơi nhớ.*1\s*đã thuộc/);
    assert.match(await text('.deck-summary'), new RegExp(`Vừa quên: ${second}`));
    assert.match(await text('#tab-cards .goal'), /Hôm nay 3\/20 thẻ/, 'mỗi lần chấm là một thẻ');

    // Ôn lại các từ vừa quên: lượt ôn thêm, chấm "Đã thuộc" không đổi lịch ôn nhưng vẫn tính vào mục tiêu
    const before = await page.evaluate((k) => JSON.stringify(words[k].srs), second);
    await page.click('#redo-forgotten');
    await page.waitForFunction(() => /Ôn thêm: 0\/1/.test(document.querySelector('#progress').textContent));
    await page.keyboard.press('3');
    await page.waitForFunction(() => /ôn thêm 1 từ/.test(document.querySelector('#deck-done').textContent));
    assert.equal(await page.evaluate((k) => JSON.stringify(words[k].srs), second), before);
    assert.match(await text('#tab-cards .goal'), /Hôm nay 4\/20 thẻ/);
    await page.waitForFunction(() => /Hôm nay 4\/20/.test(document.querySelector('#tab-stats .goal')?.textContent || ''));

    // Từ hay quên: chỉ có "bright" (đã quên 2 lần) và từ vừa quên trong lượt này
    await page.select('#deck-source', 'lapses');
    await page.waitForFunction(() => deck.total === 2);
    assert.ok([second, 'bright'].includes(await currentWord()));

    // Trắc nghiệm 4 đáp án (nguồn: từ mới 7 ngày qua): thẻ tự đọc, chọn đúng → báo đúng, gợi ý "Đã thuộc"
    await page.select('#deck-source', 'recent');
    await page.select('#deck-mode', 'choice');
    await page.waitForFunction(() => document.querySelectorAll('.choice').length === 4);
    const word3 = await currentWord();
    await page.waitForFunction((k) => window.__spoken.at(-1) === `${k}|en-US`, {}, word3);
    await page.click('#flashcard .fc-word'); // chưa chọn đáp án thì bấm vào thẻ không lật được
    assert.ok(await shown('.front'));
    const answer = await page.evaluate(() => words[deck.queue[0]].translation);
    const options = await page.$$eval('.choice span', (els) => els.map((el) => el.textContent));
    assert.equal(new Set(options).size, 4, 'không có đáp án trùng');
    await page.click(`.choice[data-choice="${options.indexOf(answer)}"]`);
    assert.ok(await shown('.back'));
    assert.match(await text('#fc-result'), /Chính xác/);
    assert.ok(await page.$eval('.grade-btn[data-grade="2"]', (el) => el.classList.contains('suggest')));

    // Chọn sai: đánh dấu đáp án sai và đáp án đúng, gợi ý "Chưa thuộc"
    await page.keyboard.press('3');
    await page.waitForFunction((k) => deck.queue[0] !== k, {}, word3);
    const answer2 = await page.evaluate(() => words[deck.queue[0]].translation);
    const options2 = await page.$$eval('.choice span', (els) => els.map((el) => el.textContent));
    const wrong = options2.findIndex((t) => t !== answer2);
    await page.click(`.choice[data-choice="${wrong}"]`);
    assert.match(await text('#fc-result'), /Bạn chọn/);
    assert.equal(await page.$$eval('.choice.is-correct', (els) => els.length), 1);
    assert.equal(await page.$$eval('.choice.is-wrong', (els) => els.length), 1);
    assert.ok(await page.$eval('.grade-btn[data-grade="0"]', (el) => el.classList.contains('suggest')));

    // Mục tiêu ngày đổi trong Cài đặt → thanh tiến độ theo mục tiêu mới; đạt mục tiêu → chuỗi 1 ngày
    await page.click('[data-tab="settings"]');
    await page.waitForFunction(() => !document.querySelector('#tab-settings').hidden);
    await page.$eval('#settings-form [name=dailyGoal]', (el) => (el.value = '5'));
    await page.click('#settings-form button[type=submit]');
    await page.waitForFunction(() => settings.dailyGoal === 5);
    assert.match(await text('#tab-cards .goal'), /Hôm nay 5\/5 thẻ · ✓ đạt mục tiêu.*🔥 1 ngày liên tiếp/);

    await sleep(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'không cuộn ngang trang điện thoại');
    assert.deepEqual(await page.evaluate(() => window.__csp), [], 'không vi phạm Content-Security-Policy');
    assert.deepEqual(errors, [], 'không có lỗi JS');
  } finally {
    await browser.close();
    server.close();
  }
});
