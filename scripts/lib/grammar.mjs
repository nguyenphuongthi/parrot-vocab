// Đọc và kiểm tra sách ngữ pháp (tiếng Anh, tiếng Hàn) – định dạng chung để app dùng một giao diện.
//
// Nguồn: một thư mục, mỗi file NN-ten.json là một chủ đề (unit), sắp theo tên file:
//   { "id": "tenses", "name": "Các thì", "intro": "(tuỳ chọn)", "points": [ điểm, … ] }
// Một điểm ngữ pháp:
//   {
//     "id": "present-simple",            // duy nhất trong cả sách; tiến độ lưu với key "<lang>:g:<id>"
//     "title": "Present simple",         // tên / mẫu câu
//     "sub": "Thì hiện tại đơn",         // tên tiếng Việt hoặc nghĩa ngắn
//     "level": "A1" | 1,                 // tiếng Anh: CEFR A1–C1 · tiếng Hàn: cấp TOPIK 1 | 2
//     "form": ["S + V(s/es)", …],        // công thức / cách chia (tuỳ chọn)
//     "uses": [{ "vi": "khi nào dùng", "ex": [["câu", "dịch"], …] }],
//     "notes": ["lưu ý", …],             // tuỳ chọn
//     "mistakes": [["sai", "đúng", "vì sao"], …],   // tuỳ chọn
//     "practice": [["câu có ___", "đáp án (nhiều đáp án cách nhau bởi /)"], …],  // tuỳ chọn
//     "see": ["id-khác", …]              // điểm liên quan (tuỳ chọn)
//   }
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const KEYS = new Set(['id', 'title', 'sub', 'level', 'form', 'uses', 'notes', 'mistakes', 'practice', 'see']);

export function readUnits(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

// levels: các giá trị level hợp lệ. Trả về { units, problems, count } – units đã bỏ trường "file".
export function checkBook(units, { levels, script }) {
  const problems = [];
  const ids = new Set();
  const unitIds = new Set();
  const all = [];
  for (const u of units) {
    const at = u.file;
    if (!u.id || !u.name) problems.push(`${at}: chủ đề thiếu id / name`);
    if (unitIds.has(u.id)) problems.push(`${at}: trùng id chủ đề ${u.id}`);
    unitIds.add(u.id);
    if (!Array.isArray(u.points) || !u.points.length) problems.push(`${at}: chưa có điểm ngữ pháp`);
    for (const p of u.points || []) {
      const where = `${at} › ${p.id || p.title}`;
      all.push(p);
      for (const k of Object.keys(p)) if (!KEYS.has(k)) problems.push(`${where}: trường lạ "${k}"`);
      if (!/^[a-z0-9-]+$/.test(p.id || '')) problems.push(`${where}: id phải là chữ thường, số, dấu gạch`);
      if (ids.has(p.id)) problems.push(`${where}: trùng id`);
      ids.add(p.id);
      if (!p.title || !p.sub) problems.push(`${where}: thiếu title / sub`);
      if (!levels.includes(p.level)) problems.push(`${where}: level "${p.level}" không hợp lệ`);
      if (!Array.isArray(p.uses) || !p.uses.length) problems.push(`${where}: thiếu uses`);
      for (const use of p.uses || []) {
        if (!use.vi) problems.push(`${where}: một cách dùng thiếu giải thích`);
        if (!Array.isArray(use.ex) || !use.ex.length) problems.push(`${where}: "${(use.vi || '').slice(0, 30)}…" chưa có ví dụ`);
        for (const ex of use.ex || []) {
          if (!Array.isArray(ex) || ex.length !== 2 || !ex[0] || !ex[1]) problems.push(`${where}: ví dụ sai dạng ${JSON.stringify(ex)}`);
          else if (script && !script.test(ex[0])) problems.push(`${where}: ví dụ không đúng ngôn ngữ: ${ex[0]}`);
        }
      }
      for (const m of p.mistakes || []) if (!Array.isArray(m) || m.length !== 3) problems.push(`${where}: lỗi sai phải có [sai, đúng, vì sao]`);
      for (const q of p.practice || []) {
        if (!Array.isArray(q) || q.length !== 2) problems.push(`${where}: bài tập phải có [câu, đáp án]`);
        else if (q[0].split('___').length !== 2) problems.push(`${where}: bài tập phải có đúng một chỗ trống ___: ${q[0]}`);
      }
    }
  }
  for (const p of all) for (const s of p.see || []) if (!ids.has(s)) problems.push(`${p.id}: "see" trỏ tới id không có: ${s}`);
  const clean = units.map(({ file, ...u }) => u);
  return { units: clean, problems, count: all.length };
}
