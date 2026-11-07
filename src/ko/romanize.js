// Phiên âm tiếng Hàn:
//  - romanize(): Latin theo Romanization chuẩn (국어의 로마자 표기법, Viện Quốc ngữ Quốc gia – 국립국어원, 2000).
//    Ghi theo cách ĐỌC (có nối âm, mũi hoá, ㄹ hoá, bật hơi…) nhưng KHÔNG ghi căng hoá (학교 → hakgyo).
//    Danh từ: ㄱ, ㅂ + ㅎ vẫn ghi h (입학 → iphak, 축하 → chukha) như quy định 제3장 제1항 붙임.
//  - pronounce(): cách đọc thực tế bằng Hangul theo 표준 발음법 (có căng hoá) – vd. 학교 → 학꾜, 입학 → 이팍.
// Chỉ áp dụng các quy tắc biến âm có quy luật; trường hợp đặc biệt (thêm ㄴ: 꽃잎 [꼰닙], căng hoá trong
// từ Hán Hàn: 발달 [발딸]…) ghi tay ở trường "pron" / "rr" của dữ liệu.

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const INITIAL_RR = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
const VOWEL_RR = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
const FINAL_RR = { '': '', ㄱ: 'k', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng' };

// Âm đại diện của patchim (7 âm cuối: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ)
export const REPRESENTATIVE = {
  '': '', ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ',
  ㄴ: 'ㄴ', ㄵ: 'ㄴ', ㄶ: 'ㄴ',
  ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ',
  ㄹ: 'ㄹ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ',
  ㄻ: 'ㅁ', ㅁ: 'ㅁ',
  ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ',
  ㅇ: 'ㅇ',
};

const CLUSTER = { ㄳ: ['ㄱ', 'ㅅ'], ㄵ: ['ㄴ', 'ㅈ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'], ㄼ: ['ㄹ', 'ㅂ'], ㄽ: ['ㄹ', 'ㅅ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅄ: ['ㅂ', 'ㅅ'] };
const H_FINAL = { ㅎ: '', ㄶ: 'ㄴ', ㅀ: 'ㄹ' };
const ASPIRATE = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅈ: 'ㅊ' };
// patchim + ㅎ → [patchim còn lại, phụ âm bật hơi]
const BEFORE_H = { ㄱ: ['', 'ㅋ'], ㄲ: ['', 'ㅋ'], ㄺ: ['ㄹ', 'ㅋ'], ㄷ: ['', 'ㅌ'], ㅅ: ['', 'ㅌ'], ㅆ: ['', 'ㅌ'], ㅈ: ['', 'ㅊ'], ㅊ: ['', 'ㅊ'], ㅌ: ['', 'ㅌ'], ㅂ: ['', 'ㅍ'], ㅍ: ['', 'ㅍ'], ㄼ: ['ㄹ', 'ㅍ'], ㄵ: ['ㄴ', 'ㅊ'] };
const TENSE = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };
const NASAL = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' };

const isSyllable = (ch) => ch >= '가' && ch <= '힣';

export function decompose(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  return { i: CHO[Math.floor(code / 588)], v: JUNG[Math.floor((code % 588) / 28)], f: JONG[code % 28] };
}

export function compose({ i, v, f = '' }) {
  return String.fromCharCode(0xac00 + (CHO.indexOf(i) * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(f));
}

// Áp dụng biến âm trên một từ (chuỗi âm tiết Hangul liền nhau).
// display = true: cách đọc thực tế (có căng hoá, bật hơi mọi trường hợp).
// display = false: dạng dùng để phiên âm Latin.
function applyRules(word, display) {
  const s = [...word].map(decompose);
  for (let k = 0; k < s.length - 1; k++) {
    const a = s[k];
    const b = s[k + 1];
    const original = a.f;

    // 1. Patchim ㅎ (ㄶ, ㅀ): bật hơi phụ âm sau, rơi trước nguyên âm, thành ㄴ trước ㄴ
    if (a.f in H_FINAL) {
      const rest = H_FINAL[a.f];
      if (ASPIRATE[b.i]) b.i = ASPIRATE[b.i];
      else if (b.i === 'ㅅ' && display) b.i = 'ㅆ';
      else if (b.i === 'ㄴ' && a.f === 'ㅎ') {
        a.f = 'ㄴ';
        continue;
      }
      a.f = rest;
    }

    // 2. Patchim + ㅎ → bật hơi (축하 [추카], 못하다 [모타다], 맞히다 [마치다])
    if (b.i === 'ㅎ' && BEFORE_H[a.f]) {
      // Danh từ: ㄱ, ㅂ + ㅎ vẫn phiên âm "kh", "ph"; hậu tố bị động / sai khiến 히, 혀 thì nhập lại (잡혀 japyeo)
      const suffix = b.v === 'ㅣ' || (b.v === 'ㅕ' && (b.f === '' || b.f === 'ㅆ'));
      const keepH = !display && (a.f === 'ㄱ' || a.f === 'ㅂ') && !suffix;
      if (!keepH) {
        const [rest, asp] = BEFORE_H[a.f];
        a.f = rest;
        b.i = asp === 'ㅌ' && b.v === 'ㅣ' ? 'ㅊ' : asp; // 닫히다 [다치다]
      }
    }

    // 3. Nối âm: patchim chuyển sang âm tiết sau khi âm tiết sau bắt đầu bằng nguyên âm
    const linked = b.i === 'ㅇ' && a.f && a.f !== 'ㅇ';
    if (linked) {
      let [stay, move] = CLUSTER[a.f] || ['', a.f];
      if (display && move === 'ㅅ' && CLUSTER[a.f]) move = 'ㅆ'; // 없어 [업써]
      if (b.v === 'ㅣ' && (move === 'ㄷ' || move === 'ㅌ')) move = move === 'ㄷ' ? 'ㅈ' : 'ㅊ'; // 같이 [가치]
      a.f = stay;
      b.i = move;
    }

    // 4. Âm đại diện của patchim (ㄺ trước ㄱ đọc ㄹ: 읽고 [일꼬])
    a.f = original === 'ㄺ' && b.i === 'ㄱ' && a.f === 'ㄺ' ? 'ㄹ' : REPRESENTATIVE[a.f];

    // 5. ㄹ: ㄴ+ㄹ / ㄹ+ㄴ → ㄹㄹ (신라 [실라], 설날 [설랄]); sau ㅁ ㅇ ㄱ ㄷ ㅂ thì ㄹ → ㄴ (종로 [종노])
    if (a.f === 'ㄴ' && b.i === 'ㄹ') a.f = 'ㄹ';
    else if (a.f === 'ㄹ' && b.i === 'ㄴ') b.i = 'ㄹ';
    else if (b.i === 'ㄹ' && a.f && 'ㅁㅇㄱㄷㅂ'.includes(a.f)) b.i = 'ㄴ';

    // 6. Mũi hoá: ㄱ ㄷ ㅂ trước ㄴ ㅁ → ㅇ ㄴ ㅁ (감사합니다 [감사함니다], 국물 [궁물])
    if ((b.i === 'ㄴ' || b.i === 'ㅁ') && NASAL[a.f]) a.f = NASAL[a.f];

    // 7. Căng hoá (chỉ khi đọc): sau ㄱ ㄷ ㅂ, và sau gốc động từ ㄵ ㄻ ㄼ ㄾ ㄺ (앉다 [안따], 읽고 [일꼬]).
    //    Không áp dụng cho phụ âm vừa được nối sang (앉아 [안자], không phải [안짜]).
    const stem = !linked && original && 'ㄵㄻㄼㄾㄺ'.includes(original);
    if (display && TENSE[b.i] && ((a.f && 'ㄱㄷㅂ'.includes(a.f)) || stem)) b.i = TENSE[b.i];
  }
  const last = s.at(-1);
  if (last) last.f = REPRESENTATIVE[last.f];
  if (display) for (const x of s) if (x.v === 'ㅢ' && x.i !== 'ㅇ') x.v = 'ㅣ'; // 희망 [히망]
  return s;
}

function mapWords(text, fn) {
  return text.replace(/[가-힣]+/g, fn);
}

export function romanize(text) {
  return mapWords(text || '', (word) => {
    const s = applyRules(word, false);
    let out = '';
    s.forEach((x, k) => {
      const prevFinal = k ? s[k - 1].f : '';
      out += (x.i === 'ㄹ' && prevFinal === 'ㄹ' ? 'l' : INITIAL_RR[x.i]) + VOWEL_RR[x.v] + (FINAL_RR[x.f] ?? '');
    });
    return out;
  });
}

export function pronounce(text) {
  return mapWords(text || '', (word) => applyRules(word, true).map(compose).join(''));
}

// Cách đọc chỉ hiện khi khác cách viết (bỏ dấu câu để so sánh)
export function pronunciationHint(text, override) {
  const p = override || pronounce(text);
  const strip = (x) => x.replace(/[^가-힣\s]/g, '').trim();
  return strip(p) === strip(text) ? '' : p.replace(/[.?!,]+$/, '');
}

export function isHangul(text) {
  return [...(text || '')].some(isSyllable);
}
