// Tra từ tiếng Anh → tiếng Việt cho web app (chạy phía server trong api/lookup.js, không phụ thuộc trình duyệt).
// Cùng nguồn và cùng định dạng dữ liệu với extension Vocab English Lens (extension/background.js) để từ lưu
// ở app và ở extension giống hệt nhau:
//   - Nghĩa, từ loại, định nghĩa, ví dụ, đồng nghĩa: Google Translate (endpoint miễn phí của Chrome / gtx)
//   - Phiên âm US / UK và file ghi âm: Free Dictionary API, dự phòng Wiktionary
//   - Bản dịch tiếng Việt của định nghĩa / ví dụ (giải thích chi tiết): Google Translate, một request cho cả từ
import { wordKey } from './srs.js';

const SINGLE_WORD = /^[a-z]+(?:['’-][a-z]+)*$/i;
const TIMEOUT = { google: 8000, dictionary: 3500, wiktionary: 5000 };
const POS_EN = {
  'danh từ': 'noun', 'động từ': 'verb', 'tính từ': 'adjective', 'trạng từ': 'adverb', 'giới từ': 'preposition',
  'liên từ': 'conjunction', 'đại từ': 'pronoun', 'thán từ': 'interjection', 'từ hạn định': 'determiner',
};
const TRANSLATE_ENDPOINTS = [
  'https://clients5.google.com/translate_a/single?client=dict-chrome-ex',
  'https://translate.googleapis.com/translate_a/single?client=gtx',
];

export const isLookupText = (text) => {
  const t = wordKey(text);
  return t.length > 0 && t.length <= 60 && /^[a-z][a-z' -]*$/i.test(t) && t.split(' ').length <= 5;
};

function withTimeout(fetchFn, ms) {
  return (url, init = {}) => fetchFn(url, { ...init, signal: AbortSignal.timeout(ms) });
}

async function googleTranslate(fetchFn, text, dt) {
  const params = `&sl=en&tl=vi&hl=vi&dj=1${dt.map((d) => `&dt=${d}`).join('')}&q=${encodeURIComponent(text)}`;
  let lastError;
  for (const endpoint of TRANSLATE_ENDPOINTS) {
    try {
      const res = await withTimeout(fetchFn, TIMEOUT.google)(endpoint + params);
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
const SKIP_REGISTER = /archaic|rare|vulgar|offensive|dated/i;
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Gom định nghĩa, ví dụ và đồng nghĩa theo từng từ loại (giống extension)
export function buildSenses(data) {
  const examplesById = {};
  for (const ex of data.examples?.example || []) (examplesById[ex.definition_id] ||= []).push(stripTags(ex.text));
  return (data.definitions || []).slice(0, 4).map((group) => {
    const synonyms = new Set();
    for (const set of (data.synsets || []).filter((s) => s.pos === group.pos)) {
      for (const e of set.entry) {
        if (SKIP_REGISTER.test((e.label_info?.register || []).join(' '))) continue;
        e.synonym.forEach((s) => synonyms.add(s));
      }
    }
    return {
      pos: group.pos,
      posEn: POS_EN[(group.pos || '').normalize('NFC').trim().toLowerCase()] || '',
      baseForm: group.base_form || '',
      definitions: group.entry.slice(0, 3).map((d) => ({
        gloss: stripTags(d.gloss),
        example: stripTags(d.example) || examplesById[d.definition_id]?.[0] || '',
      })),
      synonyms: [...synonyms].slice(0, 8),
    };
  });
}

// "/pɚˈfɔɹm/" → "[pɚˈfɔrm]"
function formatIpa(ipa) {
  const clean = (ipa || '').trim().replace(/^[/[]+|[/\]]+$/g, '').replace(/ɹ/g, 'r');
  return clean ? `[${clean}]` : '';
}

function finishPhonetics(found, generic) {
  for (const accent of ['us', 'uk']) {
    found[accent] ||= { ipa: '', audio: '' };
    found[accent].ipa = formatIpa(found[accent].ipa || generic);
  }
  return found;
}

async function fromFreeDictionary(fetchFn, word) {
  const res = await withTimeout(fetchFn, TIMEOUT.dictionary)(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
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

async function fromWiktionary(fetchFn, word) {
  const url = `https://en.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&page=${encodeURIComponent(word)}`;
  const res = await withTimeout(fetchFn, TIMEOUT.wiktionary)(url, { headers: { 'user-agent': 'LanguagesApp/1.0 (vocabulary lookup)' } });
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

// Hỏi song song hai nguồn; nguồn nào đủ phiên âm + audio thì dùng luôn, không thì chọn bản tốt hơn
function phoneticsFromSources(fetchFn, word) {
  const score = (r) => (r && (r.us.ipa || r.uk.ipa) ? 2 : 0) + (r && (r.us.audio || r.uk.audio) ? 1 : 0);
  return new Promise((resolve) => {
    let pending = 2;
    let best = null;
    for (const source of [fromFreeDictionary, fromWiktionary]) {
      source(fetchFn, word)
        .catch(() => null)
        .then((r) => {
          if (score(r) === 3) return resolve(r);
          if (score(r) > score(best)) best = r;
          if (--pending === 0) resolve(score(best) >= 2 ? best : null);
        });
    }
  });
}

const EMPTY_PHONETICS = () => ({ us: { ipa: '', audio: '' }, uk: { ipa: '', audio: '' } });

async function phonetics(fetchFn, word, baseForm) {
  if (!SINGLE_WORD.test(word)) return EMPTY_PHONETICS();
  const direct = await phoneticsFromSources(fetchFn, word);
  if (direct) return direct;
  const base = wordKey(baseForm);
  return (base && base !== word && SINGLE_WORD.test(base) && (await phoneticsFromSources(fetchFn, base))) || EMPTY_PHONETICS();
}

// Bản dịch tiếng Việt cho định nghĩa và câu ví dụ – một request cho cả từ (lỗi thì bỏ qua)
async function explain(fetchFn, senses, meanings) {
  const lines = [];
  const slot = (s) => (s ? lines.push(s.replace(/\s+/g, ' ')) - 1 : -1);
  const plan = senses.map((s) => ({ ...s, definitions: s.definitions.map((d) => ({ ...d, g: slot(d.gloss), e: slot(d.example) })) }));
  let vi = [];
  if (lines.length) {
    try {
      const out = sentenceText(await googleTranslate(fetchFn, lines.join('\n'), ['t'])).split('\n');
      if (out.length === lines.length) vi = out.map((s) => s.trim());
    } catch {
      /* không có bản dịch chi tiết cũng được */
    }
  }
  const at = (i) => (i >= 0 ? vi[i] || '' : '');
  return {
    context: '',
    contextVi: '',
    senses: plan.map((s) => ({
      pos: s.pos,
      posEn: s.posEn,
      baseForm: s.baseForm,
      terms: meanings.find((m) => m.pos === s.pos)?.terms || [],
      synonyms: s.synonyms,
      definitions: s.definitions.map(({ g, e, ...d }) => ({ ...d, glossVi: at(g), exampleVi: at(e) })),
    })),
  };
}

// Kết quả có dạng giống mục từ extension lưu: { word, isWord, translation, meanings, senses, baseForm, phonetics, details }
export async function lookupWord(text, fetchFn = fetch) {
  const word = wordKey(text);
  if (!isLookupText(word)) throw new Error('Chỉ tra được từ / cụm từ tiếng Anh (tối đa 5 từ).');
  const data = await googleTranslate(fetchFn, word, ['t', 'bd', 'md', 'ex', 'ss']);
  const meanings = (data.dict || []).map((d) => ({ pos: d.pos, terms: (d.terms || []).slice(0, 6) }));
  const senses = buildSenses(data);
  const baseForm = data.dict?.[0]?.base_form || data.definitions?.[0]?.base_form || '';
  const [phon, details] = await Promise.all([phonetics(fetchFn, word, baseForm), explain(fetchFn, senses, meanings)]);
  return {
    word,
    isWord: SINGLE_WORD.test(word),
    translation: sentenceText(data).trim(),
    meanings,
    senses,
    baseForm,
    phonetics: phon,
    details,
  };
}
