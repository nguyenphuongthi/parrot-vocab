// Nét chữ Hangul theo thứ tự viết (khung 100×100). Mỗi nét là một path SVG (chỉ dùng M H V L Q C tuyệt đối).
// Thứ tự viết: trên xuống dưới, trái sang phải; nét ngang viết từ trái sang phải, nét dọc từ trên xuống.
// Âm tiết (가–힣) được ghép từ nét của từng chữ cái theo bố cục khối vuông.
import { decompose } from './romanize.js';

const C = (cx, cy, rx, ry) =>
  `M${cx} ${cy - ry}C${cx - rx * 0.56} ${cy - ry} ${cx - rx} ${cy - ry * 0.56} ${cx - rx} ${cy}C${cx - rx} ${cy + ry * 0.56} ${cx - rx * 0.56} ${cy + ry} ${cx} ${cy + ry}C${cx + rx * 0.56} ${cy + ry} ${cx + rx} ${cy + ry * 0.56} ${cx + rx} ${cy}C${cx + rx} ${cy - ry * 0.56} ${cx + rx * 0.56} ${cy - ry} ${cx} ${cy - ry}`;

const BASIC = {
  // Phụ âm
  ㄱ: ['M20 22H78L74 84'],
  ㄴ: ['M24 18V78H82'],
  ㄷ: ['M22 22H78', 'M24 22V78H82'],
  ㄹ: ['M22 18H76V48', 'M24 48H76', 'M24 48V82H80'],
  ㅁ: ['M24 20V80', 'M24 20H76V80', 'M24 80H76'],
  ㅂ: ['M26 16V82', 'M74 16V82', 'M26 48H74', 'M26 82H74'],
  ㅅ: ['M50 18Q46 56 18 84', 'M48 44Q62 70 84 84'],
  ㅇ: [C(50, 50, 28, 30)],
  ㅈ: ['M22 22H76Q60 56 18 84', 'M52 50Q64 70 84 84'],
  ㅊ: ['M44 8L56 16', 'M22 28H76Q60 60 18 86', 'M52 54Q64 72 84 86'],
  ㅋ: ['M20 20H78L74 84', 'M22 50H76'],
  ㅌ: ['M24 20H78', 'M24 50H74', 'M24 20V80H82'],
  ㅍ: ['M20 22H80', 'M36 22V78', 'M64 22V78', 'M16 80H84'],
  ㅎ: ['M42 10H58', 'M20 28H80', C(50, 62, 20, 20)],
  // Nguyên âm
  ㅏ: ['M42 10V90', 'M42 50H68'],
  ㅑ: ['M42 10V90', 'M42 38H68', 'M42 62H68'],
  ㅓ: ['M30 50H56', 'M56 10V90'],
  ㅕ: ['M30 38H56', 'M30 62H56', 'M56 10V90'],
  ㅗ: ['M50 34V58', 'M12 58H88'],
  ㅛ: ['M38 34V58', 'M62 34V58', 'M12 58H88'],
  ㅜ: ['M12 42H88', 'M50 42V68'],
  ㅠ: ['M12 42H88', 'M38 42V68', 'M62 42V68'],
  ㅡ: ['M12 50H88'],
  ㅣ: ['M50 10V90'],
  ㅐ: ['M34 10V90', 'M34 50H54', 'M66 10V90'],
  ㅒ: ['M34 10V90', 'M34 38H54', 'M34 62H54', 'M66 10V90'],
  ㅔ: ['M22 50H44', 'M44 10V90', 'M68 10V90'],
  ㅖ: ['M20 38H42', 'M20 62H42', 'M42 10V90', 'M68 10V90'],
  ㅘ: ['M30 34V58', 'M10 58H52', 'M62 10V90', 'M62 50H84'],
  ㅙ: ['M26 34V58', 'M8 58H44', 'M56 10V90', 'M56 50H70', 'M80 10V90'],
  ㅚ: ['M32 34V58', 'M10 58H56', 'M70 10V90'],
  ㅝ: ['M8 42H50', 'M28 42V70', 'M52 54H70', 'M72 10V90'],
  ㅞ: ['M6 42H44', 'M24 42V70', 'M46 54H58', 'M60 10V90', 'M82 10V90'],
  ㅟ: ['M8 42H56', 'M32 42V70', 'M72 10V90'],
  ㅢ: ['M10 54H58', 'M72 10V90'],
};

// Chữ kép / patchim đôi = hai chữ cái đặt cạnh nhau
const PAIRS = {
  ㄲ: ['ㄱ', 'ㄱ'], ㄸ: ['ㄷ', 'ㄷ'], ㅃ: ['ㅂ', 'ㅂ'], ㅆ: ['ㅅ', 'ㅅ'], ㅉ: ['ㅈ', 'ㅈ'],
  ㄳ: ['ㄱ', 'ㅅ'], ㄵ: ['ㄴ', 'ㅈ'], ㄶ: ['ㄴ', 'ㅎ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'], ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅀ: ['ㄹ', 'ㅎ'], ㅄ: ['ㅂ', 'ㅅ'],
};

// Dời + co giãn một path (chỉ toạ độ tuyệt đối, không xoay nên H / V vẫn đúng)
function place(d, [x0, y0, x1, y1]) {
  const sx = (x1 - x0) / 100;
  const sy = (y1 - y0) / 100;
  const tokens = d.match(/[MHVLQC]|-?\d*\.?\d+/g);
  let out = '';
  let cmd = '';
  let axis = 0; // 0 = x, 1 = y (với M L Q C luân phiên)
  for (const t of tokens) {
    if (/[MHVLQC]/.test(t)) {
      cmd = t;
      axis = 0;
      out += t;
      continue;
    }
    const n = Number(t);
    let v;
    if (cmd === 'H') v = x0 + n * sx;
    else if (cmd === 'V') v = y0 + n * sy;
    else {
      v = axis === 0 ? x0 + n * sx : y0 + n * sy;
      axis = 1 - axis;
    }
    out += `${Math.round(v * 10) / 10} `;
  }
  return out.trim();
}

function jamoIn(ch, box) {
  if (PAIRS[ch]) {
    const [a, b] = PAIRS[ch];
    const [x0, y0, x1, y1] = box;
    const mid = (x0 + x1) / 2;
    return [...jamoIn(a, [x0, y0, mid + 2, y1]), ...jamoIn(b, [mid - 2, y0, x1, y1])];
  }
  return (BASIC[ch] || []).map((d) => place(d, box));
}

const VERTICAL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅣ';
const HORIZONTAL = 'ㅗㅛㅜㅠㅡ';

// Bố cục khối âm tiết: [ô phụ âm đầu, ô nguyên âm, ô patchim]
function layout(v, hasFinal) {
  const kind = VERTICAL.includes(v) ? 'v' : HORIZONTAL.includes(v) ? 'h' : 'm';
  if (!hasFinal) {
    if (kind === 'v') return [[6, 14, 54, 86], [46, 4, 96, 96]];
    if (kind === 'h') return [[20, 2, 80, 52], [2, 28, 98, 96]];
    return [[6, 2, 50, 40], [2, 4, 98, 96]];
  }
  if (kind === 'v') return [[6, 6, 52, 54], [46, 2, 96, 62], [18, 60, 82, 98]];
  if (kind === 'h') return [[24, 0, 76, 34], [4, 16, 96, 62], [20, 60, 80, 98]];
  return [[6, 0, 48, 30], [4, 2, 96, 64], [18, 62, 82, 98]];
}

// Danh sách nét của một ký tự: chữ cái (ㄱ, ㅏ, ㄲ…) hoặc âm tiết (한, 학…). [] nếu không hỗ trợ.
export function strokesOf(ch) {
  if (!ch) return [];
  if (BASIC[ch] || PAIRS[ch]) return jamoIn(ch, [6, 6, 94, 94]);
  if (ch >= '가' && ch <= '힣') {
    const { i, v, f } = decompose(ch);
    const [bi, bv, bf] = layout(v, !!f);
    return [...jamoIn(i, bi), ...jamoIn(v, bv), ...(f ? jamoIn(f, bf) : [])];
  }
  return [];
}
