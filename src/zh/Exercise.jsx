import { useState } from 'react';
import { Sentence } from './Sentence.jsx';

// Yêu cầu đề bài trong giáo trình và bản dịch tiếng Việt.
const TITLES = {
  完成句子或对话: 'Hoàn thành câu hoặc đoạn hội thoại',
  完成对话: 'Hoàn thành đoạn hội thoại',
  完成句子: 'Hoàn thành câu',
  用所学词语改写句子: 'Dùng từ vừa học viết lại câu',
  用所学词语完成句子: 'Dùng từ vừa học hoàn thành câu',
  选词填空: 'Chọn từ điền vào chỗ trống',
  选择合适的词语填空: 'Chọn từ thích hợp điền vào chỗ trống',
  选择正确答案: 'Chọn đáp án đúng',
  给括号里的词选择适当的位置: 'Chọn vị trí thích hợp cho từ trong ngoặc',
  画线连接可以搭配的词语: 'Nối các từ có thể kết hợp với nhau',
  根据下面的提示词复述课文内容: 'Dựa vào từ gợi ý, kể lại nội dung bài khóa',
  根据课文内容回答问题: 'Trả lời câu hỏi theo nội dung bài khóa',
  复述: 'Thuật lại nội dung bài khóa',
  从上表中选择合适的词语填空: 'Chọn từ thích hợp trong bảng trên điền vào chỗ trống',
  '判断各句中的“闻”是哪种意思': 'Xác định “闻” trong mỗi câu mang nghĩa nào',
  '指出下面各句中的“某”是哪种用法': 'Cho biết “某” trong mỗi câu thuộc cách dùng nào',
  '判断下列句中的“嗯”是哪种意思并在括号中填上正确的标点符号':
    'Xác định “嗯” trong mỗi câu mang nghĩa nào và điền dấu câu đúng vào ngoặc',
  '给“过”选择适当的位置': 'Chọn vị trí thích hợp cho “过”',
  '给“开”选择适当的位置': 'Chọn vị trí thích hợp cho “开”',
  '指出下列句中的“直”是哪种用法': 'Cho biết “直” trong mỗi câu thuộc cách dùng nào',
};

// Một câu bài tập: đề có pinyin sẵn; bấm để hiện đáp án (kèm pinyin và bản dịch).
function Item({ it, n, retell, open, onToggle }) {
  return (
    <li className={`ex-item ${open ? 'is-open' : ''}`}>
      <div
        className="ex-q"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onToggle();
        }}
      >
        <span className="ex-num">{n}</span>
        <div className="ex-body">
          {it.q.map((line, i) => (
            <Sentence key={i} line={line} revealed />
          ))}
          {it.hint &&
            (retell ? (
              <div className="ex-keywords">
                <span className="ex-label">Từ gợi ý</span>
                <Sentence line={it.hint} revealed inline />
              </div>
            ) : (
              <div className="ex-hint">
                <span className="ex-label">Dùng từ</span>
                <Sentence line={it.hint} revealed inline />
              </div>
            ))}
          {it.opts && (
            <div className="ex-opts">
              {it.opts.map((o, i) => (
                <Sentence key={i} line={o} revealed inline />
              ))}
            </div>
          )}
        </div>
        <span className="ex-toggle">{open ? 'Ẩn' : 'Đáp án'}</span>
      </div>
      {open && (
        <div className="ex-answer">
          {(it.key || it.sample) && (
            <p className="ex-key">
              {it.key && (
                <>
                  Đáp án: <b lang="zh-CN">{it.key}</b>
                </>
              )}
              {it.sample && <span className="ex-sample">Câu trả lời mẫu</span>}
            </p>
          )}
          {it.a && (
            <>
              {it.a.ruby.map((line, i) => (
                <Sentence key={i} line={line} revealed />
              ))}
              <div className="translation">
                {it.a.vi.map((t, i) => (
                  <p key={`vi${i}`}>{t}</p>
                ))}
                {it.a.en.map((t, i) => (
                  <p key={`en${i}`} className="en">
                    {t}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

// Một bài tập (练一练, 做一做, các bài trong 练习, bài tập 扩展). lead: nhãn đứng trước yêu cầu đề.
export default function Exercise({ ex, lead }) {
  const [open, setOpen] = useState(() => new Set());
  const allOpen = ex.items.every((_, i) => open.has(i));
  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="exercise">
      <div className="ex-head">
        <h4>
          {lead && (
            <span className="ex-lead" lang="zh-CN">
              {lead}
            </span>
          )}
          <span lang="zh-CN">{ex.title}</span>
          {TITLES[ex.title] && <small>{TITLES[ex.title]}</small>}
        </h4>
        <button
          type="button"
          className="link-btn"
          onClick={() => setOpen(allOpen ? new Set() : new Set(ex.items.map((_, i) => i)))}
        >
          {allOpen ? 'Ẩn hết đáp án' : 'Hiện hết đáp án'}
        </button>
      </div>
      {ex.bank && (
        <div className="ex-bank">
          {ex.bank.map((w, i) => (
            <Sentence key={i} line={w} revealed inline className="ex-word" />
          ))}
        </div>
      )}
      <ol className="ex-items">
        {ex.items.map((it, i) => [
          it.label && it.label !== ex.items[i - 1]?.label && (
            <li key={`l${i}`} className="ex-group" lang="zh-CN">
              {it.label}
            </li>
          ),
          <Item
            key={i}
            it={it}
            n={i + 1}
            retell={ex.kind === 'retell'}
            open={open.has(i)}
            onToggle={() => toggle(i)}
          />,
        ])}
      </ol>
    </div>
  );
}
