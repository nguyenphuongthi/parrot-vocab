// Chữ Nhật trong dữ liệu: furigana, romaji, chuyển romaji → kana.
//
// Cách viết câu tiếng Nhật trong data-src/ja (ví dụ ngữ pháp, câu giao tiếp, …):
//   {私|わたし} は {学生|がくせい} です。
//   - {漢字|かな}: chữ Hán kèm cách đọc (furigana). Mọi chữ Hán trong câu đều phải có cách đọc.
//   - Dấu cách: ranh giới từ – chỉ dùng để tách romaji ("watashi wa gakusei desu."), không hiện trong chữ Nhật.
//     Trợ từ は / へ / を đứng riêng thành một từ thì đọc wa / e / o.
//   - 【…】: phần ngữ pháp cần chú ý (tô đậm).
// Từ vựng chỉ ghi [chữ viết, cách đọc] – furigana được ghép tự động (furiganaOf).

const RUBY = /\{([^|{}]+)\|([^|{}]+)\}/g;
export const KANJI = /[㐀-䶿一-鿿々〆ヶ]/;
const KANJI_G = /[㐀-䶿一-鿿々〆ヶ]/g;
export const JAPANESE = /[぀-ヿ㐀-䶿一-鿿々〆ヶ]/;

// Chữ hiển thị: bỏ cách đọc, dấu cách, dấu 【】
export const jaPlain = (s) => s.replace(RUBY, '$1').replace(/[【】]/g, '').replace(/ +/g, '');
// Cách đọc bằng kana (giữ dấu cách để tách romaji)
export const jaReading = (s) => s.replace(RUBY, '$2').replace(/[【】]/g, '');

// Tách chuỗi có đánh dấu thành các đoạn để hiển thị: { text, rt?, mark }
export function jaSegments(s, { keepSpaces = false } = {}) {
  const out = [];
  let mark = false;
  const push = (text, rt) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (!rt && last && !last.rt && last.mark === mark) last.text += text;
    else out.push(rt ? { text, rt, mark } : { text, mark });
  };
  const re = /\{([^|{}]+)\|([^|{}]+)\}|【|】|[^{【】]+|\{/g;
  for (const [m, base, rt] of s.matchAll(re)) {
    if (m === '【') mark = true;
    else if (m === '】') mark = false;
    else if (base) push(base, rt);
    else push(keepSpaces ? m : m.replace(/ +/g, ''));
  }
  return out;
}

// ---------- Kana ----------
export const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
export const isKana = (c) => /[぀-ヿ]/.test(c);

// ---------- Kana → romaji (Hepburn, trường âm viết đôi nguyên âm: ou, uu, ee, ー → lặp nguyên âm) ----------
const BASE = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
};
// Âm ghép: chữ cái + ゃゅょ (và các âm mở rộng của katakana: ティ, ファ, ウィ…)
const COMBO = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', しゃ: 'sha', しゅ: 'shu', しょ: 'sho', ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo', じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo', びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  しぇ: 'she', ちぇ: 'che', じぇ: 'je', てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', てゅ: 'tyu', でゅ: 'dyu',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', ふゅ: 'fyu', うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  いぇ: 'ye', くぁ: 'kwa', ぐぁ: 'gwa',
};
const PUNCT = { '。': '.', '、': ',', '？': '?', '！': '!', '「': '"', '」': '"', '『': '"', '』': '"', '・': ' ', '〜': '~', '～': '~', '…': '...', '（': '(', '）': ')', '：': ':', '　': ' ' };
// Trợ từ (và vài từ cố định) có は / へ đọc khác chữ viết
const PARTICLE = { は: 'wa', へ: 'e', を: 'o', では: 'dewa', には: 'niwa', とは: 'towa', からは: 'karawa', までは: 'madewa', へは: 'ewa', のは: 'nowa', こんにちは: 'konnichiwa', こんばんは: 'konbanwa' };

function wordToRomaji(word, particles = true) {
  const s = toHiragana(word);
  if (particles && PARTICLE[s]) return PARTICLE[s];
  if (s === 'こんにちは' || s === 'こんばんは') return PARTICLE[s];
  let out = '';
  let geminate = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let r;
    if (COMBO[s.slice(i, i + 2)]) {
      r = COMBO[s.slice(i, i + 2)];
      i++;
    } else if (c === 'っ') {
      geminate = true;
      continue;
    } else if (c === 'ー') {
      const v = out.match(/[aeiou]$/);
      out += v ? v[0] : '-';
      continue;
    } else if (c === 'ん') {
      const next = s[i + 1] && (COMBO[s.slice(i + 1, i + 3)] || BASE[s[i + 1]]);
      r = next && /^[aeiouy]/.test(next) ? "n'" : 'n';
    } else r = BASE[c] ?? PUNCT[c] ?? c;
    if (geminate) {
      geminate = false;
      if (/^ch/.test(r)) r = 't' + r;
      else if (/^[bcdfghjkmprstvwz]/.test(r)) r = r[0] + r;
    }
    out += r;
  }
  if (geminate) out += "'"; // っ cuối câu (thán từ): ghi bằng dấu '
  return out;
}

// Romaji của một chuỗi kana (có thể có dấu cách tách từ).
// particles = false: đọc là một từ (歯 は → ha), không coi は / へ / を là trợ từ.
export function toRomaji(kana, { particles = true } = {}) {
  return kana
    .split(/ +/)
    .filter(Boolean)
    .map((w) => wordToRomaji(w, particles))
    .join(' ')
    .replace(/ ([.,?!:)])/g, '$1')
    .replace(/\( /g, '(')
    .trim();
}

// Romaji của câu có đánh dấu
export const jaRomaji = (s) => toRomaji(jaReading(s));

// ---------- Romaji → hiragana (để gõ đáp án bằng bàn phím Latin) ----------
// Chấp nhận cả Hepburn (shi, tsu, fu, ja) và kiểu gõ IME (si, tu, hu, zya), "nn" / "n'" cho ん, phụ âm đôi cho っ.
const R2K = (() => {
  const m = {};
  for (const [k, r] of Object.entries(BASE)) if (!/[ぁぃぅぇぉゃゅょゎゐゑ]/.test(k) && !m[r]) m[r] = k;
  for (const [k, r] of Object.entries(COMBO)) if (!m[r]) m[r] = k;
  Object.assign(m, {
    o: 'お', wo: 'を', n: 'ん', si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ', di: 'ぢ', du: 'づ',
    sya: 'しゃ', syu: 'しゅ', syo: 'しょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
    zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
    thi: 'てぃ', dhi: 'でぃ', xtu: 'っ', ltu: 'っ', xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ',
    xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
    ji: 'じ', ja: 'じゃ', ju: 'じゅ', jo: 'じょ', ye: 'いぇ', '-': 'ー',
  });
  return m;
})();

export function romajiToKana(input) {
  const s = input.toLowerCase().replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu').replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'ou');
  let out = '';
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === 'n' && s[i + 1] === "'") {
      out += 'ん';
      i += 2;
      continue;
    }
    // "nn": ん; nếu sau đó là nguyên âm thì chữ n thứ hai thuộc âm sau (konnichiwa → こんにちわ, onna → おんな)
    if (c === 'n' && s[i + 1] === 'n') {
      out += 'ん';
      i += /[aiueoy]/.test(s[i + 2] || '') ? 1 : 2;
      continue;
    }
    if (c === 'n' && (!s[i + 1] || !/[aiueoy]/.test(s[i + 1]))) {
      out += 'ん';
      i++;
      continue;
    }
    if (c === s[i + 1] && /[bcdfghjkmprstvwz]/.test(c)) {
      out += 'っ';
      i++;
      continue;
    }
    if (c === 't' && s.slice(i + 1, i + 3) === 'ch') {
      out += 'っ';
      i++;
      continue;
    }
    let hit = false;
    for (let len = 3; len > 0; len--) {
      const k = R2K[s.slice(i, i + len)];
      if (k) {
        out += k;
        i += len;
        hit = true;
        break;
      }
    }
    if (!hit) {
      out += c;
      i++;
    }
  }
  return out;
}

// Chuẩn hoá đáp án gõ vào để so sánh:
//   - có chữ Nhật: hiragana (katakana → hiragana), bỏ dấu câu / khoảng trắng; chữ Hán giữ nguyên
//   - chữ Latin: romaji chuẩn (đổi sang kana rồi đổi lại) – chấp nhận si/shi, tu/tsu, ha/wa, ou/ō…
export function answerKey(s) {
  const t = (s || '').trim();
  if (!t) return '';
  if (JAPANESE.test(t)) return toHiragana(jaPlain(t)).replace(/[^ぁ-ゖー㐀-䶿一-鿿々]/g, '');
  return romajiKey(romajiToKana(t.replace(/[^a-zA-Zāīūēōâîûêô'-]/g, '')));
}

// Romaji chuẩn của một chuỗi kana để so đáp án (chỉ chữ thường a–z)
export const romajiKey = (kana) => toRomaji(toHiragana(kana).replace(/ +/g, ''), { particles: false }).replace(/[^a-z]/g, '');

// ---------- Furigana tự động cho từ vựng ----------
// Ghép cách đọc vào từng cụm chữ Hán: furiganaOf('食べる', 'たべる') → '{食|た}べる'.
// Kana trong chữ viết phải khớp với cách đọc; không ghép được thì cả cụm dùng chung một cách đọc.
export function furiganaOf(written, reading) {
  if (!reading || !KANJI.test(written)) return written;
  const parts = written.match(/[㐀-䶿一-鿿々〆ヶ]+|[^㐀-䶿一-鿿々〆ヶ]+/g);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '^' + parts.map((p) => (KANJI.test(p) ? '(.+?)' : `(${esc(toHiragana(p))})`)).join('') + '$',
  );
  const m = toHiragana(reading).match(re);
  if (!m) return `{${written}|${reading}}`;
  // Kana trong phần đọc giữ nguyên chữ viết gốc (katakana vẫn là katakana)
  return parts.map((p, i) => (KANJI.test(p) ? `{${p}|${m[i + 1]}}` : p)).join('');
}

export const hasKanji = (s) => KANJI.test(s);
export const kanjiOf = (s) => s.match(KANJI_G) || [];
