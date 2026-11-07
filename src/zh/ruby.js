// Gắn dấu câu vào chữ liền kề để không bị xuống dòng một mình.
// ruby: mảng [chữ, pinyin] (chữ Hán) hoặc [ký tự] (dấu câu, số...); trả về các nhóm { c, py, i }.
const OPENING = '“‘（《「';

export function groupPunctuation(ruby) {
  const groups = [];
  let pending = [];
  ruby.forEach(([c, py], i) => {
    const item = { c, py, i };
    if (!py && OPENING.includes(c)) pending.push(item);
    else if (!py && groups.length && !pending.length) groups[groups.length - 1].push(item);
    else {
      groups.push([...pending, item]);
      pending = [];
    }
  });
  if (pending.length) groups.push(pending);
  return groups;
}
