// Tạo dữ liệu cấp độ CEFR (A1–C2) từ Open Language Profiles, ghi giống nhau cho extension (extension/data/)
// và app (public/data/en/):
//   extension/data/cefr-j.json      ← CEFR-J Wordlist 1.5 (A1–B2) – © Tono Laboratory, TUFS; dùng miễn phí, kể cả
//                                     thương mại, khi ghi nguồn
//   extension/data/cefr-c1c2.json   ← Octanove Vocabulary Profile C1/C2 1.0 – CC BY-SA 4.0 (file chuyển đổi giữ
//                                     nguyên giấy phép, nên để riêng, không gộp với CEFR-J)
// Định dạng: { "từ viết thường": { "<loại từ>": "B1", ... } } – loại từ: n, v, adj, adv, prep, conj, pron, interj,
// det, x (không thuộc loại nào của app, vd. số đếm). Chạy lại: npm run data:cefr
const fs = require('fs');
const path = require('path');

const SOURCE = 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/';
const OUT_DIRS = [path.join(__dirname, '..', 'extension', 'data'), path.join(__dirname, '..', 'public', 'data', 'en')];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const POS = {
  noun: 'n', verb: 'v', vern: 'v', 'modal auxiliary': 'v', 'be-verb': 'v', 'do-verb': 'v', 'have-verb': 'v',
  adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron',
  interjection: 'interj', determiner: 'det'
};

// CSV có ô trong ngoặc kép chứa dấu phẩy (cột chủ đề) – tách đúng chuẩn
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function build(csv) {
  const out = {};
  const [header, ...rows] = parseCsv(csv);
  const col = (name) => header.indexOf(name);
  const [hw, pos, level] = [col('headword'), col('pos'), col('CEFR')];
  for (const row of rows) {
    const lv = (row[level] || '').trim().toUpperCase();
    if (!LEVELS.includes(lv)) continue;
    const p = POS[(row[pos] || '').trim().toLowerCase()] || 'x';
    // "adviser/advisor", "a.m./A.M./am/AM": mỗi cách viết là một từ
    for (const variant of (row[hw] || '').split('/')) {
      const word = variant.trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
      if (!word) continue;
      const entry = (out[word] ||= {});
      // Cùng từ + loại từ xuất hiện nhiều lần: giữ cấp thấp nhất (nghĩa thông dụng nhất)
      if (!entry[p] || LEVELS.indexOf(lv) < LEVELS.indexOf(entry[p])) entry[p] = lv;
    }
  }
  return out;
}

async function main() {
  for (const dir of OUT_DIRS) fs.mkdirSync(dir, { recursive: true });
  for (const [file, out] of [
    ['cefrj-vocabulary-profile-1.5.csv', 'cefr-j.json'],
    ['octanove-vocabulary-profile-c1c2-1.0.csv', 'cefr-c1c2.json']
  ]) {
    const res = await fetch(SOURCE + file);
    if (!res.ok) throw new Error(`Không tải được ${file}: ${res.status}`);
    const data = build(await res.text());
    const sorted = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
    for (const dir of OUT_DIRS) fs.writeFileSync(path.join(dir, out), JSON.stringify(sorted) + '\n');
    console.log(`${out}: ${Object.keys(sorted).length} từ`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
