import { Fragment, useEffect, useRef, useState } from 'react';
import WordDetail from './WordDetail.jsx';
import { useDetailKeys } from '../../components/ui/DetailNav.jsx';
import { MarkFilter, MarkGlyph } from '../../components/ui/Mark.jsx';
import { useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { useColumns } from '../../lib/useColumns.js';

// Đếm theo mức trong một cấp: mục chưa có bản ghi = chưa thuộc.
function countLevel(progress, level, total) {
  const prefix = `${level}-`;
  const c = [0, 0, 0];
  for (const [id, v] of Object.entries(progress)) if (id.startsWith(prefix)) c[markOf(v)]++;
  c[0] = total - c[1] - c[2];
  return c;
}

export default function LevelSection({ info, tags, words, open, searching, onToggle }) {
  const gridRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState(null); // null = tất cả; 0/1/2 = chỉ mức đó
  const progress = useLangItems('zh');
  const counts = countLevel(progress, info.level, info.total);
  const activeFilter = searching ? null : filter;
  const markIdOf = (id) => markOf(progress[id]);

  // Từ đang mở vẫn được giữ lại dù đổi mức khi đang lọc (đến khi đóng khung chi tiết).
  const shown =
    words && activeFilter !== null
      ? words.filter((x) => markIdOf(x.id) === activeFilter || x.id === selectedId)
      : words;
  const cols = useColumns(gridRef, open && !!shown && shown.length > 0);
  const selected = shown && selectedId !== null ? shown.findIndex((x) => x.id === selectedId) : -1;

  useEffect(() => setSelectedId(null), [words]);

  const goPrev = selected > 0 ? () => setSelectedId(shown[selected - 1].id) : null;
  const goNext = selected >= 0 && selected < shown.length - 1 ? () => setSelectedId(shown[selected + 1].id) : null;
  const close = () => setSelectedId(null);
  useDetailKeys(selectedId, { onPrev: goPrev, onNext: goNext, onClose: close });

  if (searching && words && words.length === 0) return null;

  const pickFilter = (value) => {
    setFilter((f) => (f === value ? null : value));
    setSelectedId(null);
    if (!open) onToggle();
  };

  const rowEnd = selected < 0 ? -1 : Math.min(shown.length - 1, Math.floor(selected / cols) * cols + cols - 1);
  const learned = counts[1] + counts[2];

  return (
    <section className={`level tone-${(info.level - 1) % 8} ${open ? 'is-open' : ''}`}>
      <div className="level-head" onClick={searching ? undefined : onToggle}>
        <button
          className="level-title"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
          disabled={searching}
        >
          <span className="level-name">HSK {info.level}</span>
          <span className="level-count">
            {searching && words ? `${words.length} kết quả` : `${info.total.toLocaleString('vi-VN')} từ`}
          </span>
        </button>
        {!searching && <MarkFilter counts={counts} active={filter} onPick={pickFilter} compact />}
        {!searching && (
          <span className="level-meter" title={`Đã học ${learned}/${info.total} từ`} aria-hidden="true">
            <span style={{ width: `${(counts[2] / info.total) * 100}%` }} className="m2" />
            <span style={{ width: `${(counts[1] / info.total) * 100}%` }} className="m1" />
          </span>
        )}
        {!searching && (
          <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </div>

      {open && (
        <div className="level-body">
          {activeFilter !== null && (
            <p className="filter-note">
              <MarkGlyph value={activeFilter} size={14} /> Đang lọc: {STATES[activeFilter].label.toLowerCase()}
              <button className="link-btn" onClick={() => pickFilter(activeFilter)}>
                Bỏ lọc
              </button>
            </p>
          )}
          {!words && <p className="loading">Đang tải…</p>}
          {shown && shown.length === 0 && <p className="muted">Không có từ nào ở mức này.</p>}
          {shown && shown.length > 0 && (
            <div className="grid" ref={gridRef}>
              {shown.map((x, i) => (
                <Fragment key={x.id}>
                  <button
                    style={{ '--i': i }}
                    className={`tile ${selected === i ? 'is-selected' : ''} ${x.py ? '' : 'is-empty'} ${
                      [...x.w].length > 4 ? 'is-long' : ''
                    }`}
                    onClick={() => setSelectedId(selected === i ? null : x.id)}
                    aria-expanded={selected === i}
                    aria-label={`${x.w} – ${STATES[markIdOf(x.id)].label.toLowerCase()}`}
                    lang="zh-CN"
                  >
                    <span className="tile-mark">
                      <MarkGlyph value={markIdOf(x.id)} size={12} />
                    </span>
                    {/* Ô đang chọn lật sang mặt sau: pinyin */}
                    {selected === i && x.py ? (
                      <span className="tile-back" lang="zh-Latn">
                        {x.py}
                      </span>
                    ) : (
                      x.w
                    )}
                  </button>
                  {i === rowEnd && (
                    <WordDetail
                      key={`d-${selectedId}`}
                      entry={shown[selected]}
                      tags={tags}
                      nav={{ pos: selected + 1, total: shown.length, onPrev: goPrev, onNext: goNext, onClose: close }}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
