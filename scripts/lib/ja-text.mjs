// Kiểm tra một câu tiếng Nhật viết theo quy ước của src/features/ja/text.js.
// Trả về danh sách lỗi (rỗng nếu hợp lệ):
//   - mọi chữ Hán phải nằm trong {漢字|かな}; phần đọc chỉ gồm kana
//   - ngoặc {…} và 【…】 phải đóng mở đúng
//   - trợ từ を, は, へ phải đứng riêng thành một từ (cách bằng dấu cách) để romaji đọc đúng wa / e / o
import { KANJI, jaPlain } from '../../src/features/ja/text.js';

const RUBY = /\{([^|{}]+)\|([^|{}]+)\}/g;
// Từ kết thúc bằng は / へ nhưng không phải trợ từ đứng riêng
const WA_OK = new Set(['こんにちは', 'こんばんは', 'では', 'には', 'とは', 'からは', 'までは', 'へは', 'のは', 'それでは', 'じゃあ', 'または']);

export function checkJaText(s) {
  const problems = [];
  for (const [, base, rt] of s.matchAll(RUBY)) {
    if (!KANJI.test(base)) problems.push(`{${base}|${rt}} không có chữ Hán`);
    if (!/^[ぁ-ゖァ-ヺー]+$/.test(rt)) problems.push(`cách đọc "${rt}" phải là kana`);
  }
  const rest = s.replace(RUBY, '');
  if (/[{}|]/.test(rest)) problems.push(`ngoặc {…|…} viết sai: ${s}`);
  const bare = rest.match(new RegExp(KANJI.source, 'g'));
  if (bare) problems.push(`chữ Hán thiếu cách đọc: ${[...new Set(bare)].join('')} trong "${jaPlain(s)}"`);
  if ((s.match(/【/g) || []).length !== (s.match(/】/g) || []).length) problems.push(`dấu 【】 không khớp: ${s}`);
  for (const token of s.replace(/[【】]/g, '').split(/ +/)) {
    const plain = jaPlain(token).replace(/[。、？！「」…・]+$/g, '');
    if (plain.length > 1 && /を/.test(plain) && plain !== 'を') problems.push(`trợ từ を phải đứng riêng: "${plain}"`);
    if (plain.length > 1 && /[はへ]$/.test(plain) && !WA_OK.has(plain)) problems.push(`có thể thiếu dấu cách trước trợ từ: "${plain}"`);
  }
  return problems;
}
