// Tra từ trong background: đọc dữ liệu Google / Wiktionary (fixture chụp từ phản hồi thật),
// cache, Microsoft Translator dự phòng, số từ cần ôn trên icon.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadExtension, plain } = require('./helpers/env');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

// Fetch giả tôn trọng AbortSignal (giới hạn thời gian của extension)
const delayed = (ms, signal, value) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(value()), ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)));
  });

// Mạng giả: Google lỗi khi googleDown; câu dịch gộp trả "VI: <câu>" cho từng dòng.
// dictionaryDelay: dictionaryapi.dev trả lời chậm (Infinity = treo hẳn).
function fakeNetwork({ googleDown = false, dictionaryDelay = 0 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    // Dữ liệu cấp độ CEFR đi kèm extension (đường dẫn tương đối như trong service worker)
    if (url.startsWith('data/')) return json(fs.readFileSync(path.join(__dirname, '..', '..', 'extension', url), 'utf8'));
    const u = new URL(url);
    calls.push(u.hostname);
    if (/google/.test(u.hostname)) {
      if (googleDown) return json({}, 429);
      const q = u.searchParams.get('q');
      // Dịch phụ đề sang tiếng Anh: câu toàn ký tự ASCII coi như tiếng Anh, còn lại là tiếng Việt
      if (u.searchParams.get('tl') === 'en') return json({ src: /^[ -~]*$/.test(q) ? 'en' : 'vi', sentences: [{ trans: 'EN: ' + q }] });
      if (q === 'perform' || q === 'performed') return json(fixture('google-perform.json')); // base_form: perform
      return json({ sentences: [{ trans: q.split('\n').map((l) => 'VI: ' + l).join('\n') }] });
    }
    if (u.hostname === 'api.dictionaryapi.dev') {
      return delayed(dictionaryDelay === Infinity ? 1e9 : dictionaryDelay, init.signal, () => json({ title: 'No Definitions Found' }, 404));
    }
    if (u.hostname === 'en.wiktionary.org') {
      return u.searchParams.get('page') === 'perform' ? json(fixture('wiktionary-perform.json')) : json({ parse: { wikitext: '' } });
    }
    if (u.hostname === 'api.cognitive.microsofttranslator.com') {
      calls.push('ms:' + u.pathname + ':' + init.headers['Ocp-Apim-Subscription-Key']);
      if (u.pathname === '/translate') {
        const detected = u.searchParams.get('from') ? {} : { detectedLanguage: { language: 'ko', score: 1 } };
        return json(JSON.parse(init.body).map(({ Text }) => ({ ...detected, translations: [{ text: 'MS: ' + Text }] })));
      }
      return json([{ translations: [
        { displayTarget: 'thực hiện', posTag: 'VERB' },
        { displayTarget: 'biểu diễn', posTag: 'VERB' },
        { displayTarget: 'màn trình diễn', posTag: 'NOUN' }
      ] }]);
    }
    throw new Error('Không có mạng: ' + url);
  };
  return { fetch, calls };
}

const ask = (d, msg) => d.ctx.chrome.runtime.sendMessage(msg);

test('tra "perform": nghĩa, từ loại, định nghĩa (chỉ gọi Google)', async () => {
  const net = fakeNetwork();
  const d = loadExtension(['background.js'], { fetch: net.fetch });
  const { ok, data } = await ask(d, { type: 'lookup', text: 'Perform' });
  assert.ok(ok);
  assert.equal(data.source, 'google');
  assert.equal(data.translation, 'trình diễn');
  assert.equal(data.meanings[0].pos, 'động từ', 'tên từ loại đã chuẩn hoá NFC');
  assert.ok(data.meanings[0].terms.includes('thực hiện'));
  assert.equal(data.senses[0].posEn, 'verb');
  assert.match(data.senses[0].definitions[0].gloss, /carry out/);
  assert.ok(data.senses[0].synonyms.length > 0);
  assert.deepEqual(net.calls, ['clients5.google.com'], 'phần nghĩa không chờ từ điển phiên âm');

  await ask(d, { type: 'lookup', text: 'perform' });
  assert.equal(net.calls.length, 1, 'tra lại dùng cache, không gọi mạng');
  d.dispose();
});

test('tra từ kèm cấp độ CEFR (dữ liệu offline), kể cả dạng chia và từ ngoài danh sách', async () => {
  const net = fakeNetwork();
  const d = loadExtension(['background.js'], { fetch: net.fetch });
  const { data } = await ask(d, { type: 'lookup', text: 'Performed' }); // Google trả base_form: perform
  assert.deepEqual(plain(data.cefr), { level: 'A2', byPos: { 'động từ': 'A2' }, lemma: 'perform' });
  const timid = await ask(d, { type: 'lookup', text: 'timid' });
  assert.equal(timid.data.cefr.level, 'C1', 'cấp C1–C2 từ bộ Octanove');
  const rare = await ask(d, { type: 'lookup', text: 'accomplice' });
  assert.equal(rare.data.cefr, null);
  const cached = await ask(d, { type: 'lookup', text: 'performed' });
  assert.equal(cached.data.cefr.level, 'A2', 'tra lại từ cache vẫn có cấp độ');
  d.dispose();
});

test('phiên âm US/UK lấy từ Wiktionary, có cache', async () => {
  const net = fakeNetwork();
  const d = loadExtension(['background.js'], { fetch: net.fetch });
  const { data } = await ask(d, { type: 'phonetics', text: 'perform' });
  assert.equal(data.uk.ipa, '[pəˈfɔːm]');
  assert.equal(data.us.ipa, '[pɚˈform]', 'ɹ đổi thành r');
  assert.match(data.us.audio, /en-us-perform\.ogg$/);
  const before = net.calls.length;
  await ask(d, { type: 'phonetics', text: 'perform' });
  assert.equal(net.calls.length, before);
  d.dispose();
});

test('phiên âm không phải chờ nguồn chậm / treo', async () => {
  for (const dictionaryDelay of [3000, Infinity]) {
    const d = loadExtension(['background.js'], { fetch: fakeNetwork({ dictionaryDelay }).fetch });
    const start = Date.now();
    const { data } = await ask(d, { type: 'phonetics', text: 'perform' });
    const ms = Date.now() - start;
    assert.equal(data.uk.ipa, '[pəˈfɔːm]');
    assert.ok(ms < 1000, `có đủ phiên âm + audio từ Wiktionary thì trả về ngay (mất ${ms} ms)`);
    d.dispose();
  }
});

test('dạng chia không có phiên âm riêng: dùng phiên âm của dạng gốc', async () => {
  const d = loadExtension(['background.js'], { fetch: fakeNetwork().fetch });
  const { data } = await ask(d, { type: 'phonetics', text: 'performed' });
  assert.equal(data.uk.ipa, '[pəˈfɔːm]');
  const phrase = await ask(d, { type: 'phonetics', text: 'take off' });
  assert.equal(phrase.data.us.ipa, '', 'cụm từ không tra phiên âm');
  d.dispose();
});

test('giải thích chi tiết: dịch gộp câu ngữ cảnh, định nghĩa, ví dụ', async () => {
  const d = loadExtension(['background.js'], { fetch: fakeNetwork().fetch });
  const { data } = await ask(d, { type: 'details', text: 'perform', context: 'We still need to perform more tests.' });
  assert.equal(data.contextVi, 'VI: We still need to perform more tests.');
  const def = data.senses[0].definitions[0];
  assert.equal(def.glossVi, 'VI: ' + def.gloss);
  assert.equal(def.exampleVi, 'VI: ' + def.example);
  d.dispose();
});

test('phụ đề YouTube: nhận diện ngôn ngữ, dịch sang tiếng Anh, có cache', async () => {
  const net = fakeNetwork();
  const d = loadExtension(['background.js'], { fetch: net.fetch });
  const vi = await ask(d, { type: 'captionEn', text: '  Tôi   không nói quá ' });
  assert.deepEqual(plain(vi.data), { lang: 'vi', en: 'EN: Tôi không nói quá' });
  const en = await ask(d, { type: 'captionEn', text: "I'm not exaggerating" });
  assert.deepEqual(plain(en.data), { lang: 'en', en: '' }, 'phụ đề đã là tiếng Anh thì không cần dòng dịch');
  const before = net.calls.length;
  await ask(d, { type: 'captionEn', text: 'Tôi không nói quá' });
  assert.equal(net.calls.length, before, 'câu đã dịch dùng cache');
  d.dispose();

  // Google lỗi + có key Microsoft: Microsoft tự nhận diện ngôn ngữ (không gửi from=)
  const down = fakeNetwork({ googleDown: true });
  const d2 = loadExtension(['background.js'], { fetch: down.fetch });
  await d2.ctx.updateSettings({ msKey: 'secret-key' });
  const ko = await ask(d2, { type: 'captionEn', text: '정말 과장 안 해요' });
  assert.deepEqual(plain(ko.data), { lang: 'ko', en: 'MS: 정말 과장 안 해요' });
  d2.dispose();
});

test('Google lỗi: không có key Microsoft thì báo lỗi, có key thì dùng Microsoft Translator', async () => {
  const net = fakeNetwork({ googleDown: true });
  const d = loadExtension(['background.js'], { fetch: net.fetch });
  const failed = await ask(d, { type: 'lookup', text: 'perform' });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /Không dịch được/);

  await d.ctx.updateSettings({ msKey: 'secret-key', msRegion: 'southeastasia' });
  const { ok, data } = await ask(d, { type: 'lookup', text: 'perform' });
  assert.ok(ok);
  assert.equal(data.source, 'microsoft');
  assert.equal(data.translation, 'MS: perform');
  assert.deepEqual(plain(data.meanings), [
    { pos: 'động từ', terms: ['thực hiện', 'biểu diễn'] },
    { pos: 'danh từ', terms: ['màn trình diễn'] }
  ]);
  assert.ok(net.calls.includes('ms:/translate:secret-key'));

  const test = await ask(d, { type: 'testMicrosoft' });
  assert.equal(test.data, 'MS: Hello, world');
  d.dispose();
});

test('số từ cần ôn hiện trên icon extension', async () => {
  const d = loadExtension(['background.js'], { fetch: fakeNetwork().fetch });
  await ask(d, { type: 'wordOp', op: { op: 'save', entry: { word: 'pure' } } });
  await ask(d, { type: 'wordOp', op: { op: 'save', entry: { word: 'running' } } });
  await new Promise((r) => setTimeout(r, 700)); // badge cập nhật sau 500 ms
  assert.equal(d.badge.text, '2');
  await ask(d, { type: 'wordOp', op: { op: 'grade', key: 'pure', grade: 2 } });
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(d.badge.text, '1');
  d.dispose();
});
