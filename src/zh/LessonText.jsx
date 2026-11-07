import { useState } from 'react';
import { Sentence } from './Sentence.jsx';

// Một bài khóa (课文): chữ Hán có pinyin sẵn; bấm vào từng đoạn/lượt lời để hiện bản dịch VI/EN. Kèm bảng
// 生词 (start: số thứ tự của từ đầu tiên, sách đánh số liên tục qua các bài khóa), 专有名词 và 科学名词.
export default function LessonText({ text, label, start = 1 }) {
  const { words, names } = text;
  const [shown, setShown] = useState(() => new Set());
  const allShown = text.paras.every((_, i) => shown.has(i));
  const toggle = (i) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <div className="text-head">
        {label && <span className="text-label">{label}</span>}
        {text.title && <Sentence line={text.title} revealed className="text-title" />}
        <button
          type="button"
          className="link-btn"
          onClick={() => setShown(allShown ? new Set() : new Set(text.paras.map((_, i) => i)))}
        >
          {allShown ? 'Ẩn hết bản dịch' : 'Hiện hết bản dịch'}
        </button>
      </div>
      {text.paras.map((p, i) => (
        <div
          key={i}
          className={`para ${shown.has(i) ? 'is-revealed' : ''}`}
          role="button"
          tabIndex={0}
          aria-expanded={shown.has(i)}
          aria-label={shown.has(i) ? 'Ẩn bản dịch' : 'Hiện bản dịch'}
          onClick={() => toggle(i)}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            toggle(i);
          }}
        >
          {p.ruby.map((line, j) => (
            <Sentence key={j} line={line} revealed />
          ))}
          {shown.has(i) && (
            <div className="translation">
              {p.vi.map((t, j) => (
                <p key={`vi${j}`}>{t}</p>
              ))}
              {p.en.map((t, j) => (
                <p key={`en${j}`} className="en">
                  {t}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
      {text.source && (
        <p className="text-source" lang="zh-CN">
          {text.source}
        </p>
      )}

      {words && (
        <>
          <h4 className="sub-head">
            <span lang="zh-CN">生词</span> Từ mới
          </h4>
          <ol className="words">
            {words.map((w, i) => (
              <li key={i}>
                <span className="w-num">{start + i}</span>
                <span className="w-zh" lang="zh-CN">
                  {w.zh}
                  {w.x && (
                    <sup className="w-x" title="Từ ngoài đề cương HSK cấp này (đánh dấu * trong sách)">
                      *
                    </sup>
                  )}
                </span>
                <span className="w-py">{w.py}</span>
                <span className="w-mean">
                  {w.pos && <i className="w-pos">{w.pos}</i>} {w.vi}
                  <span className="en">{w.en}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <NameList list={names} zh="专有名词" vi="Danh từ riêng" />
      <NameList list={text.terms} zh="科学名词" vi="Thuật ngữ khoa học" />
    </>
  );
}

function NameList({ list, zh, vi }) {
  if (!list?.length) return null;
  return (
    <>
      <h4 className="sub-head">
        <span lang="zh-CN">{zh}</span> {vi}
      </h4>
      <ol className="words">
        {list.map((w, i) => (
          <li key={i}>
            <span className="w-num">{i + 1}</span>
            <span className="w-zh" lang="zh-CN">
              {w.zh}
            </span>
            <span className="w-py">{w.py}</span>
            <span className="w-mean">
              {w.vi}
              {w.en && <span className="en">{w.en}</span>}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
