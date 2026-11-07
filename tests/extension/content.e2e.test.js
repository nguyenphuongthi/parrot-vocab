// Content script trong Chrome headless: gạch chân từ đã lưu, bấm từ để tra, gợi ý dạng gốc,
// lưu thêm ngữ cảnh, và chế độ YouTube (bấm phụ đề → dừng video, lưu kèm thời điểm, đóng → phát tiếp).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromePath, launch, readExtensionFile, contentType } = require('./helpers/browser');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DUE = Date.now() - 1000;

const ENTRIES = {
  perform: { key: 'perform', word: 'perform', mark: 0, addedAt: 1, translation: 'trình diễn', meanings: [] },
  running: { key: 'running', word: 'running', mark: 2, addedAt: 2, translation: 'đang chạy', meanings: [] },
  exaggerate: { key: 'exaggerate', word: 'exaggerate', mark: 1, addedAt: 3, translation: 'phóng đại', meanings: [], forms: ['exaggerated'] }
};
const STORE = {
  settings: { autoPlay: false },
  wordIndex: { perform: [0, DUE], running: [2, DUE], exaggerate: [1, DUE, 'exaggerated'] },
  ...Object.fromEntries(Object.entries(ENTRIES).map(([k, v]) => [`w:${k}`, v]))
};
const LOOKUPS = {
  perform: { word: 'perform', isWord: true, translation: 'trình diễn', meanings: [{ pos: 'động từ', terms: ['thực hiện'] }], senses: [], baseForm: 'perform' },
  exaggerating: {
    word: 'exaggerating', isWord: true, translation: 'phóng đại', meanings: [{ pos: 'động từ', terms: ['nói quá'] }], senses: [], baseForm: 'exaggerate',
    cefr: { level: 'B2', byPos: { 'động từ': 'B2' }, lemma: 'exaggerate' }
  },
  exaggerate: { word: 'exaggerate', isWord: true, translation: 'phóng đại', meanings: [], senses: [], baseForm: 'exaggerate' }
};

// chrome.* giả cho content script; shadow root mở để test đọc được nội dung popup
function stubScript() {
  return `
    (() => {
      const attach = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (o) { return attach.call(this, { ...o, mode: 'open' }); };
      const store = ${JSON.stringify(STORE)};
      const lookups = ${JSON.stringify(LOOKUPS)};
      const listeners = [];
      const emit = (changes) => listeners.forEach((fn) => fn(changes, 'local'));
      window.__store = store;
      window.chrome = {
        storage: {
          local: {
            async get(keys) {
              const list = keys == null ? Object.keys(store) : [].concat(keys);
              return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
            },
            async set(items) {
              const changes = {};
              for (const [k, v] of Object.entries(items)) { store[k] = structuredClone(v); changes[k] = { newValue: structuredClone(v) }; }
              emit(changes);
            },
            async remove(keys) { for (const k of [].concat(keys)) delete store[k]; }
          },
          onChanged: { addListener: (fn) => listeners.push(fn) }
        },
        runtime: {
          id: 'test-extension', // extension còn kết nối (bản mồ côi thì runtime.id không còn)
          async sendMessage(msg) {
            if (msg.type === 'lookup') {
              const d = lookups[msg.text.toLowerCase()] || { word: msg.text, isWord: true, translation: 'VI', meanings: [], senses: [] };
              return { ok: true, data: d };
            }
            if (msg.type === 'phonetics') {
              // Phiên âm về chậm hơn phần nghĩa (như từ điển thật)
              await new Promise((r) => setTimeout(r, 300));
              return { ok: true, data: { us: { ipa: '[US-' + msg.text + ']', audio: '' }, uk: { ipa: '[UK-' + msg.text + ']', audio: '' } } };
            }
            if (msg.type === 'details') return { ok: true, data: { context: msg.context, contextVi: 'VI: ' + msg.context, senses: [] } };
            // Dịch phụ đề: câu toàn ASCII coi như tiếng Anh
            if (msg.type === 'captionEn') {
              const english = /^[ -~]*$/.test(msg.text);
              return { ok: true, data: english ? { lang: 'en', en: '' } : { lang: 'vi', en: "I'm really not exaggerating" } };
            }
            if (msg.type === 'wordOp') return { ok: true, data: await applyWordOp(msg.op) };
            return { ok: true, data: null };
          }
        }
      };
    })();`;
}

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>(3) Song - YouTube</title></head>
  <body style="font: 18px/1.6 sans-serif; padding: 20px">${body}
  <script src="/ext/stub.js"></script><script src="/ext/shared.js"></script><script src="/ext/content.js"></script></body></html>`;

const ARTICLE = page(`
  <input id="search" placeholder="Ô tìm kiếm của trang">
  <p id="p1">We still need to perform more tests. The engine is running smoothly.</p>
  <p id="p2">He never exaggerated anything, and I'm not exaggerating either.</p>`);

const YOUTUBE = page(`
  <div id="movie_player" class="html5-video-player" style="position:relative;width:640px;height:360px;background:#000">
    <video class="html5-main-video"></video>
    <div class="caption-window" style="position:absolute;bottom:20px;left:20px;color:#fff;font-size:22px;user-select:none;cursor:move">
      <span class="ytp-caption-segment">I'm genuinely not exaggerating</span>
    </div>
  </div>
  <script>
    // Video giả: ghi lại pause/play, đang phát ở giây 95
    const v = document.querySelector('video');
    window.__video = { paused: false, calls: [] };
    Object.defineProperty(v, 'paused', { get: () => window.__video.paused });
    Object.defineProperty(v, 'currentTime', { get: () => 95 });
    v.pause = () => { window.__video.paused = true; window.__video.calls.push('pause'); };
    v.play = () => { window.__video.paused = false; window.__video.calls.push('play'); return Promise.resolve(); };
    // Như YouTube: bấm vào trình phát thì bật/tắt video
    document.querySelector('#movie_player').addEventListener('click', () => window.__video.calls.push('player-toggle'));
    // Phụ đề không dò được bằng API caret (user-select: none) – extension phải tự dò theo vị trí chữ
    document.caretPositionFromPoint = () => null;
    document.caretRangeFromPoint = () => null;
  </script>`);

async function openPage(browser, url) {
  const tab = await browser.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.setRequestInterception(true);
  tab.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname === '/ext/stub.js') return req.respond({ status: 200, contentType: 'text/javascript', body: stubScript() });
    if (u.pathname.startsWith('/ext/')) {
      const file = u.pathname.slice(5);
      return req.respond({ status: 200, contentType: contentType(file), body: readExtensionFile(file) });
    }
    if (u.hostname === 'example.test') return req.respond({ status: 200, contentType: 'text/html', body: ARTICLE });
    if (u.hostname === 'www.youtube.com') return req.respond({ status: 200, contentType: 'text/html', body: YOUTUBE });
    req.respond({ status: 404, body: '' });
  });
  await tab.goto(url, { waitUntil: 'load' });
  await tab.waitForFunction(() => window.__store && typeof applyWordOp === 'function');
  return { tab, errors };
}

// Toạ độ giữa một từ trong phần tử
const wordPoint = (tab, selector, word) =>
  tab.evaluate(
    (sel, w) => {
      const node = document.querySelector(sel);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const i = walker.currentNode.data.indexOf(w);
        if (i < 0) continue;
        const r = new Range();
        r.setStart(walker.currentNode, i);
        r.setEnd(walker.currentNode, i + w.length);
        const b = r.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    },
    selector,
    word
  );

const popupText = (tab) =>
  tab.evaluate(() => {
    const host = [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647');
    return host && host.style.display !== 'none' ? host.shadowRoot.textContent.replace(/\s+/g, ' ') : '';
  });

const clickInPopup = (tab, act) =>
  tab.evaluate((a) => {
    const host = [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647');
    host.shadowRoot.querySelector(`[data-act="${a}"]`).click();
  }, act);

const highlightSizes = (tab) => tab.evaluate(() => [0, 1, 2].map((i) => CSS.highlights.get(`vel-${i}`)?.size ?? 0));

test('content script trên trang bài viết', { skip: !chromePath && 'Không tìm thấy Chrome' }, async () => {
  const browser = await launch();
  try {
    const { tab, errors } = await openPage(browser, 'https://example.test/article');
    await tab.waitForFunction(() => (CSS.highlights.get('vel-0')?.size ?? 0) > 0, { timeout: 5000 });
    assert.deepEqual(await highlightSizes(tab), [1, 1, 1], 'perform (chưa thuộc), exaggerated (dạng của exaggerate), running (đã thuộc)');

    // Bấm vào từ đang được gạch chân → popup của từ đó
    const p = await wordPoint(tab, '#p1', 'perform');
    await tab.mouse.click(p.x, p.y);
    await tab.waitForFunction(() => document.querySelector('div[style*="2147483647"]')?.style.display === 'block');
    await sleep(100);
    assert.match(await popupText(tab), /perform.*★.*trình diễn/);
    assert.match(await popupText(tab), /perform chưa xếp cấp/, 'từ ngoài danh sách CEFR');
    assert.match(await popupText(tab), /US…/, 'nghĩa hiện trước, phiên âm đang tải');
    await sleep(400);
    assert.match(await popupText(tab), /\[US-perform\].*\[UK-perform\]/, 'phiên âm hiện khi về tới');

    // Bôi đen dính dấu câu, trong lúc ô tìm kiếm của trang đang được focus → vẫn tra "smoothly"
    await tab.keyboard.press('Escape');
    await tab.focus('#search');
    await tab.evaluate(() => {
      const node = document.querySelector('#p1').firstChild;
      const i = node.data.indexOf('smoothly.');
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 'smoothly.'.length);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
    await tab.waitForFunction(() => /smoothly/.test(
      [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647')?.shadowRoot.textContent || ''));
    assert.doesNotMatch(await popupText(tab), /smoothly\./);
    // Dọn vùng bôi đen tạo bằng code + bỏ focus ô tìm kiếm (người dùng thật bôi đen bằng chuột)
    await tab.evaluate(() => (document.activeElement.blur(), getSelection().removeAllRanges()));

    // Bôi đen dạng chia của từ đã lưu → báo đã có ở dạng gốc, lưu thêm câu này vào từ gốc
    await tab.keyboard.press('Escape'); // popup trước đang che đoạn văn bên dưới
    const q = await wordPoint(tab, '#p2', 'exaggerating');
    await tab.mouse.click(q.x, q.y, { clickCount: 2 });
    await tab.waitForFunction(() => /Đã có trong kho/.test(
      [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647')?.shadowRoot.textContent || ''));
    assert.match(await popupText(tab), /Đã có trong kho: exaggerate/);
    await clickInPopup(tab, 'addctx-base');
    await tab.waitForFunction(() => window.__store['w:exaggerate'].contexts?.length === 1);
    const ctx = await tab.evaluate(() => window.__store['w:exaggerate'].contexts[0]);
    assert.match(ctx.text, /not exaggerating either/);
    assert.equal(ctx.url, 'https://example.test/article');

    // Nội dung mới thêm vào trang cũng được gạch chân
    await tab.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<p>Can you perform it again?</p>'));
    await tab.waitForFunction(() => CSS.highlights.get('vel-0').size === 2, { timeout: 3000 });

    // Đổi mức thuộc ở nơi khác → màu gạch chân đổi theo
    await tab.evaluate(() => applyWordOp({ op: 'mark', key: 'perform', mark: 2 }));
    await tab.waitForFunction(() => CSS.highlights.get('vel-0').size === 0 && CSS.highlights.get('vel-2').size === 3, { timeout: 3000 });

    // Extension vừa được tải lại (chrome.* trên tab cũ vô hiệu) → popup mời tải lại trang, không im lặng
    await tab.keyboard.press('Escape');
    await tab.evaluate(() => (window.__savedId = chrome.runtime.id, delete chrome.runtime.id));
    const r = await wordPoint(tab, '#p1', 'engine');
    await tab.mouse.click(r.x, r.y, { clickCount: 2 });
    await tab.waitForFunction(() => /vừa được cập nhật/.test(
      [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647')?.shadowRoot.textContent || ''));
    assert.match(await popupText(tab), /Tải lại trang/);
    await tab.evaluate(() => (chrome.runtime.id = window.__savedId, getSelection().removeAllRanges()));

    // Một bản content script khác nhận trang → bản này tự gỡ, không chặn gì
    await tab.keyboard.press('Escape');
    await tab.evaluate(() => (document.documentElement.dataset.vocabLens = 'ban-moi'));
    await tab.mouse.click(r.x, r.y, { clickCount: 2 });
    await sleep(300);
    assert.equal(await tab.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.style.zIndex === '2147483647')), false, 'popup của bản cũ đã gỡ');
    assert.equal(await tab.evaluate(() => CSS.highlights.get('vel-2').size), 0, 'gạch chân của bản cũ đã xoá');

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('content script trên YouTube: bấm phụ đề', { skip: !chromePath && 'Không tìm thấy Chrome' }, async () => {
  const browser = await launch();
  try {
    const { tab, errors } = await openPage(browser, 'https://www.youtube.com/watch?v=abc123');
    const p = await wordPoint(tab, '.ytp-caption-segment', 'exaggerating');
    await tab.mouse.click(p.x, p.y);
    await tab.waitForFunction(() => document.querySelector('div[style*="2147483647"]')?.style.display === 'block');
    await sleep(100);
    assert.deepEqual(await tab.evaluate(() => window.__video.calls), ['pause'], 'video tự dừng, click không lọt tới trình phát');
    assert.match(await popupText(tab), /exaggerating.*phóng đại/);
    assert.match(await popupText(tab), /exaggerating B2/, 'cấp độ CEFR cạnh từ');

    // Kéo popup bằng thanh tiêu đề ra chỗ khác (khi che phụ đề); phiên âm về sau đó không kéo popup về chỗ cũ
    const hostBox = () => tab.evaluate(() => {
      const h = [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647');
      const r = h.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top) };
    });
    const before = await hostBox();
    await tab.mouse.move(before.x + 80, before.y + 20);
    await tab.mouse.down();
    await tab.mouse.move(before.x + 80 + 150, before.y + 20 - 50, { steps: 6 });
    await tab.mouse.up();
    const after = await hostBox();
    assert.deepEqual(after, { x: before.x + 150, y: before.y - 50 }, 'popup đi theo chuột');
    await sleep(400); // phiên âm về → popup vẽ lại
    assert.deepEqual(await hostBox(), after, 'vẽ lại không đưa popup về chỗ cũ');
    assert.ok(await popupText(tab), 'kéo xong popup vẫn mở');
    assert.deepEqual(await tab.evaluate(() => window.__video.calls), ['pause'], 'kéo popup không làm video phát lại');

    // Lưu: câu ngữ cảnh là dòng phụ đề, link mở lại đúng thời điểm (lùi 2 giây), tiêu đề đã làm gọn
    await clickInPopup(tab, 'save');
    await tab.waitForFunction(() => !!window.__store['w:exaggerating']);
    const saved = await tab.evaluate(() => window.__store['w:exaggerating']);
    assert.equal(saved.contexts[0].text, "I'm genuinely not exaggerating");
    assert.equal(saved.contexts[0].url, 'https://www.youtube.com/watch?v=abc123&t=93s');
    assert.equal(saved.contexts[0].time, 93);
    assert.equal(saved.contexts[0].title, 'Song');
    // Lưu trước khi phiên âm về tới → phiên âm được bổ sung sau
    await tab.waitForFunction(() => window.__store['w:exaggerating'].phonetics?.us?.ipa === '[US-exaggerating]', { timeout: 2000 });
    // Chưa bấm "Giải thích chi tiết" nhưng lưu thì vẫn lưu luôn phần giải thích
    await tab.waitForFunction(() => !!window.__store['w:exaggerating'].details, { timeout: 2000 });
    assert.equal(await tab.evaluate(() => window.__store['w:exaggerating'].details.contextVi), "VI: I'm genuinely not exaggerating");

    await tab.keyboard.press('Escape');
    assert.deepEqual(await tab.evaluate(() => window.__video.calls), ['pause', 'play'], 'đóng popup thì phát tiếp');

    // Phụ đề tiếng Anh: không thêm dòng dịch
    const captionEnShown = () => tab.evaluate(() => {
      const el = document.querySelector('.vel-caption-en');
      return el && el.style.display !== 'none' ? el.textContent : '';
    });
    await sleep(500);
    assert.equal(await captionEnShown(), '');

    // Phụ đề tiếng Việt → thêm dòng tiếng Anh phía trên; bấm vào từ trong dòng này để tra / lưu
    await tab.evaluate(() => (document.querySelector('.ytp-caption-segment').textContent = 'Tôi thật sự không nói quá'));
    await tab.waitForFunction(() => document.querySelector('.vel-caption-en')?.style.display === 'block', { timeout: 2000 });
    assert.equal(await captionEnShown(), "I'm really not exaggerating");
    const above = await tab.evaluate(() =>
      document.querySelector('.vel-caption-en').getBoundingClientRect().bottom <= document.querySelector('.caption-window').getBoundingClientRect().top);
    assert.ok(above, 'dòng tiếng Anh nằm trên phụ đề gốc');
    const r = await wordPoint(tab, '.vel-caption-en', 'really');
    await tab.mouse.click(r.x, r.y);
    await tab.waitForFunction(() => /really/.test(
      [...document.querySelectorAll('div')].find((d) => d.shadowRoot && d.style.zIndex === '2147483647')?.shadowRoot.textContent || ''));
    assert.deepEqual(await tab.evaluate(() => window.__video.calls), ['pause', 'play', 'pause'], 'bấm dòng dịch cũng dừng video');
    await clickInPopup(tab, 'save');
    await tab.waitForFunction(() => !!window.__store['w:really']?.details, { timeout: 2000 });
    assert.equal(await tab.evaluate(() => window.__store['w:really'].contexts[0].text), "I'm really not exaggerating", 'câu ngữ cảnh là câu đã dịch');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
