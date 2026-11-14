// Từ vựng tiếng Hàn theo chủ đề: lưới chữ (giống HSK), bấm vào để xem nghĩa, phiên âm, Hán Việt.
import { Fragment, useMemo, useRef, useState } from 'react';
import { useKo } from './data.js';
import { fold } from '../../lib/text.js';
import { useColumns } from '../../hooks/useColumns.js';
import DetailNav, { DetailPager, useDetailCard, useDetailKeys } from '../../components/ui/DetailNav.jsx';
import { MarkFilter, MarkGlyph, MarkPicker } from '../../components/ui/Mark.jsx';
import { SearchIcon, SpeakerIcon } from '../../components/ui/Icons.jsx';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { speak, useCanSpeak, useSpeakOnOpen } from '../../lib/speech.js';
import { usePersisted } from '../../hooks/usePersisted.js';
import { originOf, usePresence, useSelection } from '../../lib/motion.js';

export function KoSpeak({ text, label = 'Nghe phát âm', size = 18, onPlay }) {
  const can = useCanSpeak('ko-KR');
  if (!can) return null;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        if (onPlay) onPlay();
        else speak(text, 'ko-KR', { rate: 0.85 });
      }}
      aria-label={label}
      title={label}
    >
      <SpeakerIcon size={size} />
    </button>
  );
}

function WordDetail({ entry, nav }) {
  const ref = useRef(null);
  const enter = useDetailCard(ref, nav);
  const mark = markOf(useLangItems('ko')[entry.id]);
  useSpeakOnOpen(entry.ko, 'ko-KR');
  return (
    <div className={`detail ${enter}`} ref={ref}>
      <div className="detail-head">
        <span className="detail-word" lang="ko">{entry.ko}</span>
        <KoSpeak text={entry.ko} />
        <DetailNav noun="Từ" {...nav} />
      </div>
      <div className="reading">
        <span className="pinyin">{entry.rr}</span>
        {entry.pron && (
          <span className="hanviet" title="Cách đọc thực tế" lang="ko">
            [{entry.pron}]
          </span>
        )}
        {entry.hv && (
          <span className="hanviet" title="Âm Hán Việt">
            {entry.hv}
          </span>
        )}
        {entry.level > 0 && (
          <span className={`cefr ${entry.level === 1 ? 'cefr-a' : 'cefr-b'}`} title="Cấp TOPIK">
            TOPIK {entry.level}
          </span>
        )}
        <MarkPicker value={mark} onChange={(v) => setMark('items', itemKey('ko', entry.id), v)} />
      </div>
      <dl className="meaning">
        <div>
          <dt>VI</dt>
          <dd>{entry.vi}</dd>
        </div>
      </dl>
      <DetailPager noun="Từ" {...nav} />
    </div>
  );
}

function TopicSection({ topic, tone, base, items, open, searching, onToggle }) {
  const gridRef = useRef(null);
  const [selectedId, setSelectedId, close, closing] = useSelection();
  const [filter, setFilter] = useState(null);
  const progress = useLangItems('ko');
  const markId = (id) => markOf(progress[id]);
  const counts = [0, 0, 0];
  for (const e of base) counts[markId(e.id)]++;
  const activeFilter = searching ? null : filter;
  const shown = activeFilter === null ? items : items.filter((e) => markId(e.id) === activeFilter || e.id === selectedId);
  const cols = useColumns(gridRef, open && shown.length > 0);
  const selected = selectedId === null ? -1 : shown.findIndex((e) => e.id === selectedId);
  const goPrev = selected > 0 ? () => setSelectedId(shown[selected - 1].id) : null;
  const goNext = selected >= 0 && selected < shown.length - 1 ? () => setSelectedId(shown[selected + 1].id) : null;
  useDetailKeys(selectedId, { onPrev: goPrev, onNext: goNext, onClose: close });
  const body = usePresence(open);

  if (!base.length || (searching && !items.length)) return null;
  const rowEnd = selected < 0 ? -1 : Math.min(shown.length - 1, Math.floor(selected / cols) * cols + cols - 1);
  const pickFilter = (v) => {
    setFilter((f) => (f === v ? null : v));
    setSelectedId(null);
    if (!open) onToggle();
  };

  return (
    <section className={`level tone-${tone % 8} ${open ? 'is-open' : ''}`}>
      <div className="level-head" onClick={searching ? undefined : onToggle}>
        <button className="level-title" onClick={(e) => (e.stopPropagation(), onToggle())} aria-expanded={open} disabled={searching}>
          <span className="level-name">{topic.name}</span>
          <span className="level-count">
            <span lang="ko">{topic.ko}</span> · {searching ? `${items.length} kết quả` : `${base.length} từ`}
          </span>
        </button>
        {!searching && <MarkFilter counts={counts} active={filter} onPick={pickFilter} compact />}
        {!searching && (
          <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </div>
      {body.mounted && (
        <div className={`level-body ${body.closing ? 'is-closing' : ''}`}>
          {activeFilter !== null && (
            <p className="filter-note">
              <MarkGlyph value={activeFilter} size={14} /> Đang lọc: {STATES[activeFilter].label.toLowerCase()}
              <button className="link-btn" onClick={() => pickFilter(activeFilter)}>
                Bỏ lọc
              </button>
            </p>
          )}
          {shown.length === 0 && <p className="muted">Không có từ nào ở mức này.</p>}
          <div className="grid ko-grid" ref={gridRef} style={{ '--sel-x': originOf(selected, cols) }}>
            {shown.map((e, i) => (
              <Fragment key={e.id}>
                <button
                  style={{ '--i': i }}
                  className={`tile ko-tile ${selected === i ? 'is-selected' : ''} ${[...e.ko].length > 4 ? 'is-long' : ''}`}
                  onClick={() => (selected === i ? close() : setSelectedId(e.id))}
                  aria-expanded={selected === i}
                  aria-label={`${e.ko} – ${STATES[markId(e.id)].label.toLowerCase()}`}
                  lang="ko"
                >
                  <span className="tile-mark">
                    <MarkGlyph value={markId(e.id)} size={12} />
                  </span>
                  {/* Ô đang chọn lật sang mặt sau: phiên âm */}
                  {selected === i ? (
                    <span className="tile-back" lang="ko-Latn">
                      {e.rr}
                    </span>
                  ) : (
                    e.ko
                  )}
                </button>
                {i === rowEnd && (
                  <WordDetail
                    key={`d-${selectedId}`}
                    entry={shown[selected]}
                    nav={{ pos: selected + 1, total: shown.length, onPrev: goPrev, onNext: goNext, onClose: close, closing }}
                  />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function KoWords({ onUnauthorized }) {
  const { data, error } = useKo(onUnauthorized);
  const [open, setOpen] = usePersisted('ko.openTopics', ['greet']);
  const [query, setQuery] = useState('');
  const [level, setLevel] = usePersisted('ko.level', 0); // 0 = mọi cấp, 1 / 2 = TOPIK 1 / 2
  const q = fold(query.trim());
  const searching = q.length > 0;

  const { filtered, bases } = useMemo(() => {
    if (!data) return { filtered: {}, bases: {} };
    const out = {};
    const bases = {};
    for (const t of data.topics) {
      const base = level ? t.items.filter((e) => e.level === level) : t.items;
      bases[t.id] = base;
      out[t.id] = !q
        ? base
        : base.filter(
            (e) => e.ko.includes(query.trim()) || e.rr.includes(q.replace(/\s/g, '')) || fold(e.vi).includes(q) || (e.hv && fold(e.hv).includes(q)),
          );
    }
    return { filtered: out, bases };
  }, [data, q, query, level]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading">Đang tải…</p>;
  const toggle = (id) => setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input type="search" placeholder="Tìm chữ Hàn, phiên âm, nghĩa, Hán Việt…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="toolbar-note">
          {data.topics.length} chủ đề · {data.words.length} từ
        </span>
      </div>
      <div className="pills" role="group" aria-label="Cấp TOPIK">
        {[
          [0, 'Tất cả', data.words.length],
          [1, 'TOPIK 1', data.words.filter((e) => e.level === 1).length],
          [2, 'TOPIK 2', data.words.filter((e) => e.level === 2).length],
        ].map(([v, label, n]) => (
          <button
            key={v}
            type="button"
            className={`pill ${v ? `pill-tone tone-${v === 1 ? 3 : 5}` : ''} ${level === v ? 'is-on' : ''}`}
            aria-pressed={level === v}
            onClick={() => setLevel(v)}
          >
            {label}
            <span className="pill-count">{n.toLocaleString('vi-VN')}</span>
          </button>
        ))}
      </div>
      {data.topics.map((t, i) => (
        <TopicSection
          key={t.id}
          topic={t}
          tone={i}
          base={bases[t.id] || []}
          items={filtered[t.id] || []}
          open={searching || open.includes(t.id)}
          searching={searching}
          onToggle={() => toggle(t.id)}
        />
      ))}
      <footer className="foot">
        Từ vựng sơ cấp TOPIK I (cấp 1 và 2) chọn theo 한국어 학습용 어휘 목록 (국립국어원), danh sách từ thường gặp trong đề
        TOPIK I và các chủ đề của giáo trình 세종한국어. Phiên âm theo Romanization chuẩn của Hàn Quốc.
      </footer>
    </>
  );
}
