// Chia động từ / tính từ ở mức N5 (thể lịch sự ます, thể て, thể ない, thể た; tính từ: phủ định, quá khứ).
// Đầu vào là từ đã gắn furigana ({食|た}べる) và loại từ:
//   v1 – động từ nhóm I (う), v2 – nhóm II (る), v3 – nhóm III (する, 来る), i – tính từ -い, na – tính từ -な.

export const TYPE_LABEL = {
  v1: 'Động từ nhóm I',
  v2: 'Động từ nhóm II',
  v3: 'Động từ nhóm III',
  i: 'Tính từ -い',
  na: 'Tính từ -な',
};

const I_ROW = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
const A_ROW = { う: 'わ', く: 'か', ぐ: 'が', す: 'さ', つ: 'た', ぬ: 'な', ぶ: 'ば', む: 'ま', る: 'ら' };
const TE = { う: 'って', つ: 'って', る: 'って', む: 'んで', ぶ: 'んで', ぬ: 'んで', く: 'いて', ぐ: 'いで', す: 'して' };

// Thân từ cho 来る: {来|く}る → {来|き} / {来|こ}
const kuru = (w, rt) => w.replace(/\{来\|く\}る$/, `{来|${rt}}`).replace(/くる$/, rt);

export function conjugate(word, type) {
  if (type === 'v2') {
    const stem = word.slice(0, -1);
    return { masu: stem + 'ます', te: stem + 'て', nai: stem + 'ない', ta: stem + 'た' };
  }
  if (type === 'v3') {
    if (/る$/.test(word) && /(来|く)\}?る$/.test(word) && !/する$/.test(word)) {
      return { masu: kuru(word, 'き') + 'ます', te: kuru(word, 'き') + 'て', nai: kuru(word, 'こ') + 'ない', ta: kuru(word, 'き') + 'た' };
    }
    const stem = word.replace(/する$/, '');
    return { masu: stem + 'します', te: stem + 'して', nai: stem + 'しない', ta: stem + 'した' };
  }
  if (type === 'v1') {
    const last = word.slice(-1);
    const stem = word.slice(0, -1);
    // 行く: thể て / た là 行って / 行った; ある: thể ない là ない
    const isIku = /(\{行\|い\}|^い)く$/.test(word);
    const te = isIku ? 'って' : TE[last];
    const nai = /^(\{有\|あ\}|\{在\|あ\}|あ)る$/.test(word) ? 'ない' : stem + A_ROW[last] + 'ない';
    return { masu: stem + I_ROW[last] + 'ます', te: stem + te, nai, ta: stem + te.replace(/て$/, 'た').replace(/で$/, 'だ') };
  }
  if (type === 'i') {
    // いい → よ… (よくない, よかった)
    const stem = word === 'いい' ? 'よ' : word.slice(0, -1);
    return { neg: stem + 'くない', past: stem + 'かった', pastNeg: stem + 'くなかった', te: stem + 'くて' };
  }
  if (type === 'na') {
    return { neg: word + ' じゃない', past: word + ' だった', pastNeg: word + ' じゃなかった', te: word + ' で' };
  }
  return null;
}

// Các dạng để hiển thị: [[nhãn, từ đã chia], …]
export function formsOf(word, type) {
  const f = conjugate(word, type);
  if (!f) return [];
  if (f.masu) {
    return [
      ['Thể ます', f.masu],
      ['Thể て', f.te],
      ['Thể ない', f.nai],
      ['Thể た', f.ta],
    ];
  }
  return [
    ['Phủ định', f.neg],
    ['Quá khứ', f.past],
    ['Quá khứ phủ định', f.pastNeg],
    ['Nối câu (て)', f.te],
  ];
}
