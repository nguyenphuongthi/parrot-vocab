self.SYNC_HOST = true; // background là nơi duy nhất trong extension ghi kho từ và chạy đồng bộ
importScripts('shared.js', 'sync.js');

// ---------- Định tuyến message ----------

const handlers = {
  lookup: (msg) => lookupWithLevel(msg.text),
  phonetics: (msg) => phonetics(msg.text),
  details: (msg) => details(msg.text, msg.context),
  captionEn: (msg) => captionToEnglish(msg.text),
  speak: (msg) => speak(msg),
  wordOp: (msg) => applyWordOp(msg.op),
  testMicrosoft: () => microsoftTranslate(['Hello, world']).then(([vi]) => vi),
  syncSignIn: (msg) => syncSignIn(msg),
  syncSignOut: () => syncSignOut(),
  syncNow: () => syncNow(),
  openPage: (msg) => chrome.tabs.create({ url: chrome.runtime.getURL('review.html' + (msg.hash || '')) })
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target === 'offscreen') return false; // dành cho offscreen.js
  const handler = handlers[msg.type];
  if (!handler) return false;
  Promise.resolve(handler(msg))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
  return true; // giữ kênh mở cho phản hồi bất đồng bộ
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('review.html') });
});

// Tách dữ liệu dạng cũ (cả kho trong một key) ngay khi service worker chạy
migrateLegacyWords().then(updateBadge).catch(() => {});

// Lưu ý: sau khi extension được tải lại / cập nhật, content script trên các tab đang mở mất kết nối.
// Không nạp lại được (Chrome dùng lại isolated world cũ, chrome.* trong đó đã vô hiệu) – content.js
// tự nhận ra và mời người dùng tải lại trang.

// ---------- Số từ cần ôn hôm nay trên icon ----------

const BADGE_ALARM = 'vocab-badge';
let badgeTimer = null;

async function updateBadge() {
  const { wordIndex = {} } = await chrome.storage.local.get('wordIndex');
  const endOfToday = startOfDay(Date.now()) + DAY;
  const due = Object.values(wordIndex).filter((row) => row[1] < endOfToday).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#46976A' });
  await chrome.action.setBadgeText({ text: due ? (due > 999 ? '999+' : String(due)) : '' });
  await chrome.action.setTitle({ title: due ? `Vocab English Lens – ${due} từ cần ôn hôm nay` : 'Vocab English Lens – Mở sổ từ vựng' });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.wordIndex) return;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => updateBadge().catch(() => {}), 500);
});
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 30 }));
chrome.runtime.onStartup.addListener(() => updateBadge().catch(() => {}));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_ALARM) updateBadge().catch(() => {}); // qua ngày mới thì số từ đến hạn tăng
});

// ---------- Cache kết quả tra (IndexedDB) ----------
// Tra lại từ cũ không cần gọi mạng; nếu Google / từ điển tạm lỗi thì từ đã tra vẫn dùng được.

const CACHE_TTL = 30 * DAY;
const SHORT_TTL = DAY; // kết quả thiếu phiên âm (từ điển đang lỗi) thì sớm tra lại
const memoryCache = new Map();

const cacheDb =
  typeof indexedDB === 'undefined'
    ? null
    : new Promise((resolve, reject) => {
        const req = indexedDB.open('vocab-english-lens-cache', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('entries');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch(() => null);

function idbRequest(mode, work) {
  return cacheDb.then(
    (db) =>
      db &&
      new Promise((resolve, reject) => {
        const tx = db.transaction('entries', mode);
        const req = work(tx.objectStore('entries'));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

async function cacheGet(key) {
  const hit = memoryCache.get(key) || (cacheDb && (await idbRequest('readonly', (s) => s.get(key)).catch(() => null)));
  if (!hit || hit.expires < Date.now()) return null;
  memoryCache.set(key, hit);
  return hit.value;
}

async function cachePut(key, value, ttl = CACHE_TTL) {
  const entry = { value, expires: Date.now() + ttl };
  memoryCache.set(key, entry);
  if (memoryCache.size > 300) memoryCache.delete(memoryCache.keys().next().value);
  if (cacheDb) await idbRequest('readwrite', (s) => s.put(entry, key)).catch(() => {});
  return value;
}

// Dọn mục hết hạn mỗi lần service worker khởi động
if (cacheDb) {
  idbRequest('readwrite', (store) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (cursor.value.expires < Date.now()) cursor.delete();
      cursor.continue();
    };
    return req;
  }).catch(() => {});
}

// ---------- Tra từ: Google Translate (nghĩa, định nghĩa, ví dụ) ----------
// Nghĩa và phiên âm là hai request riêng: popup hiện nghĩa ngay khi Google trả về,
// phiên âm (từ điển chậm hơn nhiều) hiện sau.

const SINGLE_WORD = /^[a-z]+(?:['’-][a-z]+)*$/i;
const TIMEOUT = { google: 8000, dictionary: 3500, wiktionary: 5000, microsoft: 8000 };

// fetch có giới hạn thời gian – nguồn nào treo thì bỏ qua, không bắt người dùng chờ
const fetchWithTimeout = (url, init, ms) => fetch(url, { ...init, signal: AbortSignal.timeout(ms) });

// Gộp các lần gọi trùng đang chạy (vd. phiên âm cần base form từ lần tra nghĩa đang chạy)
const inflight = new Map();
function once(key, fn) {
  if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
  return inflight.get(key);
}

function lookup(text) {
  const key = wordKey(text);
  return once('lookup:' + key, async () => {
    const cached = await cacheGet('lookup:' + key);
    if (cached) return cached;
    const translation = await translateWord(key);
    const result = { word: key, isWord: SINGLE_WORD.test(key), ...translation };
    return cachePut('lookup:' + key, result, translation.source === 'google' ? CACHE_TTL : SHORT_TTL);
  });
}

// Kèm cấp độ CEFR (dữ liệu offline trong data/) – tính mỗi lần, không nằm trong cache tra từ
async function lookupWithLevel(text) {
  const data = await lookup(text);
  const classes = (data.meanings || []).map((m) => m.pos);
  return { ...data, cefr: cefrOf(await loadCefrIndex(), text, { baseForm: data.baseForm, classes }) };
}

const EMPTY_PHONETICS = () => ({ us: { ipa: '', audio: '' }, uk: { ipa: '', audio: '' } });

function phonetics(text) {
  const key = wordKey(text);
  if (!SINGLE_WORD.test(key)) return Promise.resolve(EMPTY_PHONETICS());
  return once('phon:' + key, async () => {
    const cached = await cacheGet('phon:' + key);
    if (cached) return cached;
    const baseFormP = lookup(key).then((t) => t.baseForm).catch(() => '');
    const result = (await lookupPhonetics(key, baseFormP)) || EMPTY_PHONETICS();
    return cachePut('phon:' + key, result, result.us.ipa || result.uk.ipa ? CACHE_TTL : SHORT_TTL);
  });
}

const TRANSLATE_ENDPOINTS = [
  'https://clients5.google.com/translate_a/single?client=dict-chrome-ex',
  'https://translate.googleapis.com/translate_a/single?client=gtx'
];

// dt: t = bản dịch, bd = nghĩa theo từ loại, md = định nghĩa, ex = ví dụ, ss = đồng nghĩa
// sl / tl: ngôn ngữ nguồn / đích – sl = 'auto' thì Google tự nhận diện và trả về trong data.src
async function googleTranslate(text, dt, { sl = 'en', tl = 'vi' } = {}) {
  const params = `&sl=${sl}&tl=${tl}&hl=vi&dj=1${dt.map((d) => `&dt=${d}`).join('')}&q=${encodeURIComponent(text)}`;
  let lastError;
  for (const endpoint of TRANSLATE_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint + params, {}, TIMEOUT.google);
      if (!res.ok) throw new Error(`Google Translate lỗi ${res.status}`);
      // Google trả tiếng Việt dạng tổ hợp (NFD) – chuẩn hoá để so khớp và tìm kiếm được
      return JSON.parse((await res.text()).normalize('NFC'));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error('Không dịch được: ' + (lastError?.message || 'lỗi mạng'));
}

const sentenceText = (data) => (data.sentences || []).map((s) => s.trans || '').join('');

async function translateWord(text) {
  try {
    const data = await googleTranslate(text, ['t', 'bd', 'md', 'ex', 'ss']);
    return {
      source: 'google',
      translation: sentenceText(data).trim(),
      meanings: (data.dict || []).map((d) => ({ pos: d.pos, terms: (d.terms || []).slice(0, 6) })),
      senses: buildSenses(data),
      baseForm: data.dict?.[0]?.base_form || data.definitions?.[0]?.base_form || ''
    };
  } catch (googleError) {
    const { msKey } = await getSettings();
    if (!msKey) throw googleError;
    return microsoftWord(text);
  }
}

const SKIP_REGISTER = /archaic|rare|vulgar|offensive|dated/i;
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Gom định nghĩa (Oxford), ví dụ và đồng nghĩa theo từng từ loại
function buildSenses(data) {
  const examplesById = {};
  for (const ex of data.examples?.example || []) {
    (examplesById[ex.definition_id] ||= []).push(stripTags(ex.text));
  }

  return (data.definitions || []).slice(0, 4).map((group) => {
    const definitions = group.entry.slice(0, 3).map((d) => ({
      gloss: stripTags(d.gloss),
      example: stripTags(d.example) || examplesById[d.definition_id]?.[0] || ''
    }));
    const synonyms = new Set();
    for (const set of (data.synsets || []).filter((s) => s.pos === group.pos)) {
      for (const e of set.entry) {
        if (SKIP_REGISTER.test((e.label_info?.register || []).join(' '))) continue;
        e.synonym.forEach((s) => synonyms.add(s));
      }
    }
    return {
      pos: group.pos,
      posEn: POS_INFO[normalizePos(group.pos)]?.en || '',
      baseForm: group.base_form || '', // vd. "take off" -> định nghĩa của danh từ "takeoff"
      definitions,
      synonyms: [...synonyms].slice(0, 8)
    };
  });
}

// ---------- Microsoft Translator (nguồn dự phòng, cần key Azure miễn phí) ----------

const MS_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';
const MS_POS = {
  NOUN: 'danh từ', VERB: 'động từ', ADJ: 'tính từ', ADV: 'trạng từ', PREP: 'giới từ',
  CONJ: 'liên từ', PRON: 'đại từ', DET: 'từ hạn định'
};

async function microsoftRequest(path, body) {
  const { msKey, msRegion } = await getSettings();
  if (!msKey) throw new Error('Chưa nhập key Microsoft Translator.');
  const headers = { 'content-type': 'application/json', 'Ocp-Apim-Subscription-Key': msKey };
  if (msRegion) headers['Ocp-Apim-Subscription-Region'] = msRegion;
  const res = await fetchWithTimeout(`${MS_ENDPOINT}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }, TIMEOUT.microsoft);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new Error('Key hoặc region Microsoft Translator không đúng.');
    throw new Error(data?.error?.message || `Microsoft Translator lỗi ${res.status}`);
  }
  return data;
}

async function microsoftTranslate(texts) {
  const data = await microsoftRequest('/translate?api-version=3.0&from=en&to=vi', texts.map((Text) => ({ Text })));
  return data.map((item) => item.translations?.[0]?.text || '');
}

async function microsoftWord(text) {
  const [translation] = await microsoftTranslate([text]);
  const meanings = [];
  try {
    const [entry] = await microsoftRequest('/dictionary/lookup?api-version=3.0&from=en&to=vi', [{ Text: text }]);
    const byPos = new Map();
    for (const t of entry?.translations || []) {
      const pos = MS_POS[t.posTag];
      if (!pos) continue;
      if (!byPos.has(pos)) byPos.set(pos, []);
      byPos.get(pos).push(t.displayTarget);
    }
    for (const [pos, terms] of byPos) meanings.push({ pos, terms: terms.slice(0, 6) });
  } catch {
    // tra từ điển không được thì vẫn còn bản dịch
  }
  return { source: 'microsoft', translation, meanings, senses: [], baseForm: '' };
}

// Dịch nhiều dòng một lần: Google trước, lỗi thì Microsoft (nếu có key)
async function translateLines(lines) {
  try {
    const translated = sentenceText(await googleTranslate(lines.join('\n'), ['t'])).split('\n');
    if (translated.length === lines.length) return translated.map((s) => s.trim());
    throw new Error('Số dòng dịch không khớp');
  } catch (googleError) {
    const { msKey } = await getSettings();
    if (!msKey) return [];
    return microsoftTranslate(lines).catch(() => []);
  }
}

// ---------- Phụ đề YouTube → tiếng Anh ----------
// Tự nhận diện ngôn ngữ của dòng phụ đề (Việt, Hàn, Pháp…); đã là tiếng Anh thì en rỗng – không cần dòng dịch.

const CAPTION_TTL = 7 * DAY;

function captionToEnglish(text) {
  const line = (text || '').replace(/\s+/g, ' ').trim();
  return once('cap:' + line, async () => {
    const cached = await cacheGet('cap:' + line);
    if (cached) return cached;
    let result;
    try {
      const data = await googleTranslate(line, ['t'], { sl: 'auto', tl: 'en' });
      result = { lang: data.src || '', en: sentenceText(data).trim() };
    } catch (googleError) {
      const { msKey } = await getSettings();
      if (!msKey) throw googleError;
      const [item] = await microsoftRequest('/translate?api-version=3.0&to=en', [{ Text: line }]);
      result = { lang: item?.detectedLanguage?.language || '', en: item?.translations?.[0]?.text || '' };
    }
    if (/^en(-|$)/i.test(result.lang)) result.en = '';
    return cachePut('cap:' + line, result, CAPTION_TTL);
  });
}

// ---------- Phiên âm US / UK ----------
// Nguồn chính: Free Dictionary API (JSON gọn, có file mp3).
// Nguồn dự phòng: Wiktionary (cùng dữ liệu gốc, ổn định hơn nhưng phải tự đọc wikitext).

// Hỏi song song hai nguồn: nguồn nào về trước mà có đủ phiên âm + audio thì dùng luôn;
// không thì chờ cả hai (đã có giới hạn thời gian) rồi chọn bản tốt hơn.
function phoneticsFromSources(word) {
  const score = (r) => (r && (r.us.ipa || r.uk.ipa) ? 2 : 0) + (r && (r.us.audio || r.uk.audio) ? 1 : 0);
  return new Promise((resolve) => {
    let pending = 2;
    let best = null;
    for (const source of [fromFreeDictionary, fromWiktionary]) {
      source(word)
        .catch(() => null)
        .then((r) => {
          if (score(r) === 3) return resolve(r);
          if (score(r) > score(best)) best = r;
          if (--pending === 0) resolve(score(best) >= 2 ? best : null);
        });
    }
  });
}

// Thử từ đang tra trước; nếu không có (vd. "performed") thì thử base form mà Google trả về
async function lookupPhonetics(word, baseFormP) {
  const direct = await phoneticsFromSources(word);
  if (direct) return direct;
  const baseForm = (await baseFormP).toLowerCase();
  return baseForm && baseForm !== word ? phoneticsFromSources(baseForm) : null;
}

async function fromFreeDictionary(word) {
  const res = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {}, TIMEOUT.dictionary);
  if (!res.ok) return null;
  const entries = await res.json();
  if (!Array.isArray(entries)) return null;

  const found = { us: null, uk: null };
  let generic = '';
  for (const entry of entries) {
    generic ||= entry.phonetic || '';
    for (const p of entry.phonetics || []) {
      generic ||= p.text || '';
      const accent = /-us\.mp3$/i.test(p.audio) ? 'us' : /-uk\.mp3$/i.test(p.audio) ? 'uk' : null;
      if (accent && !found[accent]) found[accent] = { ipa: p.text || '', audio: p.audio };
    }
  }
  return finishPhonetics(found, generic);
}

async function fromWiktionary(word) {
  const url = `https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&page=${encodeURIComponent(word)}`;
  const res = await fetchWithTimeout(url, {}, TIMEOUT.wiktionary);
  if (!res.ok) return null;
  const wikitext = (await res.json()).parse?.wikitext || '';
  const english = wikitext.match(/==English==([\s\S]*?)(?=\n==[^=]|$)/)?.[1];
  if (!english) return null;

  const found = { us: null, uk: null };
  let generic = '';
  for (const [, args] of english.matchAll(/\{\{IPA\|en\|([^}]+)\}\}/g)) {
    const parts = args.split('|');
    const ipa = parts.find((p) => p.startsWith('/')) || parts.find((p) => p.startsWith('[')) || '';
    const label = parts.find((p) => p.startsWith('a='))?.slice(2) || '';
    const accent = /\b(GA|US|GenAm)\b/.test(label) ? 'us' : /\b(RP|UK|SSB)\b/.test(label) ? 'uk' : null;
    if (accent && !found[accent]) found[accent] = { ipa, audio: '' };
    else if (!accent) generic ||= ipa;
  }
  for (const [, file] of english.matchAll(/\{\{audio\|en\|([^|}]+)/g)) {
    const accent = /^en-us-/i.test(file) ? 'us' : /^en-(uk|gb)-/i.test(file) ? 'uk' : null;
    if (!accent) continue;
    found[accent] ||= { ipa: '', audio: '' };
    found[accent].audio ||= `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.trim())}`;
  }
  return finishPhonetics(found, generic);
}

// Giọng nào thiếu phiên âm thì dùng phiên âm chung; giọng nào thiếu audio sẽ đọc bằng chrome.tts
function finishPhonetics(found, generic) {
  for (const accent of ['us', 'uk']) {
    found[accent] ||= { ipa: '', audio: '' };
    found[accent].ipa = formatIpa(found[accent].ipa || generic);
  }
  return found;
}

// "/pɚˈfɔɹm/" -> "[pɚˈfɔrm]" (Wiktionary dùng ɹ, từ điển phổ thông dùng r)
function formatIpa(ipa) {
  const clean = (ipa || '').trim().replace(/^[\/\[]+|[\/\]]+$/g, '').replace(/ɹ/g, 'r');
  return clean ? `[${clean}]` : '';
}

// ---------- Giải thích chi tiết ----------
// Dịch định nghĩa, câu ví dụ và câu ngữ cảnh sang tiếng Việt trong một request duy nhất.

async function details(text, context) {
  const cacheKey = 'details:' + wordKey(text) + '|' + (context || '');
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { senses, meanings } = await lookup(text);
  const lines = [];
  const slot = (s) => (s ? lines.push(s.replace(/\s+/g, ' ')) - 1 : -1);

  const contextSlot = slot(context);
  const plan = senses.map((sense) => ({
    ...sense,
    definitions: sense.definitions.map((d) => ({ ...d, glossSlot: slot(d.gloss), exampleSlot: slot(d.example) }))
  }));

  const vi = lines.length ? await translateLines(lines) : [];
  const at = (i) => (i >= 0 ? vi[i] || '' : '');

  const result = {
    context: context || '',
    contextVi: at(contextSlot),
    senses: plan.map((sense) => ({
      pos: sense.pos,
      posEn: sense.posEn,
      baseForm: sense.baseForm,
      terms: meanings.find((m) => m.pos === sense.pos)?.terms || [],
      synonyms: sense.synonyms,
      definitions: sense.definitions.map(({ glossSlot, exampleSlot, ...d }) => ({
        ...d,
        glossVi: at(glossSlot),
        exampleVi: at(exampleSlot)
      }))
    }))
  };
  return cachePut(cacheKey, result, vi.length ? CACHE_TTL : SHORT_TTL);
}

// ---------- Phát âm ----------
// Ưu tiên file ghi âm thật (phát trong offscreen document để không bị CSP của trang chặn),
// nếu không có hoặc lỗi thì dùng giọng đọc máy của Chrome.

async function speak({ text, accent, audio }) {
  if (audio) {
    try {
      await playInOffscreen(audio);
      return 'audio';
    } catch {
      // rơi xuống TTS
    }
  }
  await new Promise((resolve, reject) => {
    chrome.tts.stop();
    chrome.tts.speak(text, {
      lang: accent === 'uk' ? 'en-GB' : 'en-US',
      rate: 0.9,
      onEvent: (e) => {
        if (e.type === 'error') reject(new Error(e.errorMessage || 'Không phát âm được.'));
        if (e.type === 'start') resolve();
      }
    });
  });
  return 'tts';
}

let creatingOffscreen = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  creatingOffscreen ||= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Phát file ghi âm phát âm của từ vựng.'
    })
    .finally(() => (creatingOffscreen = null));
  await creatingOffscreen;
}

async function playInOffscreen(url) {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play', url });
  if (!res?.ok) throw new Error(res?.error || 'Không phát được audio.');
}
