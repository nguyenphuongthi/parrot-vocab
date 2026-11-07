import { useState } from 'react';
import { Sentence } from './Sentence.jsx';

// Tên thành phần câu trong bảng 词语搭配 của giáo trình.
const ROLES = {
  动词: 'Động từ',
  宾语: 'Tân ngữ',
  定语: 'Định ngữ',
  中心语: 'Trung tâm ngữ',
  状语: 'Trạng ngữ',
  补语: 'Bổ ngữ',
  数量词: 'Số lượng từ',
  名词: 'Danh từ',
  主语: 'Chủ ngữ',
  谓语: 'Vị ngữ',
};

function Role({ zh, plus }) {
  return (
    <span className="colloc-role">
      {plus && <span className="colloc-plus">+</span>}
      <span lang="zh-CN">{zh}</span>
      {ROLES[zh] && <small>{ROLES[zh]}</small>}
    </span>
  );
}

// Một dòng: mặc định chỉ hiện chữ Hán; bấm để hiện pinyin và nghĩa VI/EN.
function Row({ row, revealed, onToggle }) {
  return (
    <div
      className={`colloc-row ${revealed ? 'is-revealed' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={revealed}
      aria-label={revealed ? 'Ẩn pinyin và nghĩa' : 'Hiện pinyin và nghĩa'}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onToggle();
      }}
    >
      <Sentence line={row.a} revealed={revealed} />
      <Sentence line={row.b} revealed={revealed} />
      {revealed && (
        <div className="translation">
          <p>{row.vi}</p>
          <p className="en">{row.en}</p>
        </div>
      )}
    </div>
  );
}

// Nội dung mục 词语搭配: các nhóm "动词 + 宾语", "定语 + 中心语"…
export default function Collocations({ groups }) {
  const [revealed, setRevealed] = useState(() => new Set());
  const allKeys = groups.flatMap((g, i) => g.rows.map((_, j) => `${i}-${j}`));
  const allShown = allKeys.every((k) => revealed.has(k));

  const toggle = (key) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setRevealed(allShown ? new Set() : new Set(allKeys))}>
        {allShown ? 'Ẩn hết pinyin và nghĩa' : 'Hiện hết pinyin và nghĩa'}
      </button>
      {groups.map((g, i) => (
        <div className="colloc-group" key={i}>
          <div className="colloc-roles">
            <Role zh={g.a} />
            <Role zh={g.b} plus />
          </div>
          {g.rows.map((row, j) => {
            const key = `${i}-${j}`;
            return <Row key={key} row={row} revealed={revealed.has(key)} onToggle={() => toggle(key)} />;
          })}
        </div>
      ))}
    </>
  );
}
