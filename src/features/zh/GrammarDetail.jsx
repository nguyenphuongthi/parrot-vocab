import { useRef, useState } from 'react';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { useSpeakOnOpen } from '../../lib/speech.js';
import { markOf } from '../../lib/srs.js';
import { MarkPicker } from '../../components/ui/Mark.jsx';
import { Sentence } from './Sentence.jsx';
import Exercise from './Exercise.jsx';
import DetailNav, { DetailPager, useDetailCard } from '../../components/ui/DetailNav.jsx';

// Một câu ví dụ: mặc định chỉ hiện chữ Hán; bấm để hiện pinyin và bản dịch VI/EN.
function Example({ ex, revealed, onToggle }) {
  return (
    <div
      className={`example g-example ${revealed ? 'is-revealed' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={revealed}
      aria-label={revealed ? 'Ẩn pinyin và bản dịch' : 'Hiện pinyin và bản dịch'}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onToggle();
      }}
    >
      <div className="g-example-body">
        {ex.ruby.map((line, li) => (
          <Sentence key={li} line={line} revealed={revealed} />
        ))}
        {revealed && (
          <div className="translation">
            {ex.vi.map((t, i) => (
              <p key={`vi${i}`}>{t}</p>
            ))}
            {ex.en.map((t, i) => (
              <p key={`en${i}`} className="en">
                {t}
              </p>
            ))}
          </div>
        )}
      </div>
      <svg className="example-chev" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// Danh sách câu ví dụ độc lập (vd ví dụ trong mục 扩展), mỗi câu bấm để hiện pinyin và bản dịch.
export function Examples({ list }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const toggle = (i) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div className="g-examples">
      {list.map((ex, i) => (
        <Example key={i} ex={ex} revealed={revealed.has(i)} onToggle={() => toggle(i)} />
      ))}
    </div>
  );
}

// Trong mục So sánh, phần đầu "Giống nhau:", "Khác nhau 1:"… được in đậm.
function Explain({ text, labeled }) {
  const m = labeled && text.match(/^([^:：]{1,24}):\s*/);
  if (!m) return text;
  return (
    <>
      <b>{m[1]}:</b> {text.slice(m[0].length)}
    </>
  );
}

function Uses({ uses, prefix, labeled, revealed, toggle }) {
  return uses.map((u, i) => (
    <div className="use" key={i}>
      {!labeled && uses.length > 1 && <div className="use-label">Cách dùng {i + 1}</div>}
      <dl className="meaning">
        <div>
          <dt>VI</dt>
          <dd>
            <Explain text={u.vi} labeled={labeled} />
          </dd>
        </div>
        <div>
          <dt>EN</dt>
          <dd className="en">
            <Explain text={u.en} labeled={labeled} />
          </dd>
        </div>
      </dl>
      <div className="g-examples">
        {u.ex.map((ex, j) => {
          const key = `${prefix}${i}-${j}`;
          return <Example key={key} ex={ex} revealed={revealed.has(key)} onToggle={() => toggle(key)} />;
        })}
      </div>
    </div>
  ));
}

export default function GrammarDetail({ point, num, nav }) {
  const ref = useRef(null);
  const status = markOf(useLangItems('zh')[point.id]);
  const enter = useDetailCard(ref, nav);

  const allKeys = [
    ...point.uses.flatMap((u, i) => u.ex.map((_, j) => `u${i}-${j}`)),
    ...(point.cmp?.uses.flatMap((u, i) => u.ex.map((_, j) => `c${i}-${j}`)) ?? []),
  ];
  const [revealed, setRevealed] = useState(() => new Set(allKeys)); // mở thẻ là hiện hết
  useSpeakOnOpen(point.title.replace(/[A-Za-z]+/g, ' '), 'zh-CN');
  const allShown = allKeys.every((k) => revealed.has(k));

  const toggle = (key) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={`detail g-detail ${enter}`} ref={ref}>
      <div className="detail-head">
        <span className="g-num">{num}</span>
        <span className="g-title" lang="zh-CN">
          {point.title}
        </span>
        <DetailNav noun="Điểm ngữ pháp" {...nav} />
      </div>

      <div className="reading g-tools">
        <span className="pinyin">{point.py}</span>
        <MarkPicker value={status} onChange={(v) => setMark('items', itemKey('zh', point.id), v)} label="Mức độ thuộc điểm ngữ pháp" />
        <button
          type="button"
          className="link-btn"
          onClick={() => setRevealed(allShown ? new Set() : new Set(allKeys))}
        >
          {allShown ? 'Ẩn hết pinyin và bản dịch' : 'Hiện hết pinyin và bản dịch'}
        </button>
      </div>

      <Uses uses={point.uses} prefix="u" labeled={point.compare} revealed={revealed} toggle={toggle} />
      {point.practice && <Exercise ex={point.practice} lead={point.compare ? '做一做' : '练一练'} />}

      {point.cmp && (
        <section className="compare">
          <h3>
            So sánh <span lang="zh-CN">{point.cmp.title}</span>
          </h3>
          <Uses uses={point.cmp.uses} prefix="c" labeled revealed={revealed} toggle={toggle} />
          {point.cmp.practice && <Exercise ex={point.cmp.practice} lead="做一做" />}
        </section>
      )}
      <DetailPager noun="Điểm ngữ pháp" {...nav} />
    </div>
  );
}
