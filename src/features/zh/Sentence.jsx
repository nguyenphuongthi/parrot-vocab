import { groupPunctuation } from './ruby.js';

// Gộp các chữ liền nhau cùng trạng thái tô màu để phần ngữ pháp được tô thành một khối.
function runs(line) {
  const out = [];
  for (const [c, , hl] of line) {
    const last = out[out.length - 1];
    if (last && last.hl === !!hl) last.text += c;
    else out.push({ hl: !!hl, text: c });
  }
  return out;
}

// Ô trống của bài tập (build gộp ____ thành một ký tự ＿).
const BLANK = '＿';

// Một dòng chữ Hán ([chữ, pinyin, tô màu?] mỗi ký tự): ẩn pinyin thì gộp phần tô màu thành khối,
// hiện pinyin thì ghi pinyin trên từng chữ. inline: dùng <span> để đặt trong dòng chữ khác.
export function Sentence({ line, revealed, inline, className = '' }) {
  const Tag = inline ? 'span' : 'p';
  return revealed ? (
    <Tag className={`sentence with-pinyin ${className}`} lang="zh-CN">
      {groupPunctuation(line).map((g, gi) => (
        <span key={gi} className="grp">
          {g.map(({ c, py, i }) =>
            c === BLANK ? (
              <span key={i} className="rb blank" aria-label="chỗ trống">
                <span className="py">{' '}</span>
                <span className="hz" />
              </span>
            ) : (
              <span key={i} className={`rb ${py ? '' : 'punct'} ${line[i][2] ? 'hl' : ''}`}>
                <span className="py">{py || ' '}</span>
                <span className="hz">{c}</span>
              </span>
            ),
          )}
        </span>
      ))}
    </Tag>
  ) : (
    <Tag className={`sentence ${className}`} lang="zh-CN">
      {runs(line).map((r, i) => (
        <span key={i} className={r.hl ? 'hl' : undefined}>
          {r.text.split(BLANK).flatMap((t, j) => (j ? [<span key={j} className="blank" />, t] : [t]))}
        </span>
      ))}
    </Tag>
  );
}
