// Từ vựng tiếng Nhật (N5) theo chủ đề: lưới chữ, bấm vào để xem cách đọc (furigana, romaji), nghĩa, Hán Việt
// và các thể đã chia sẵn của động từ / tính từ.
import { Fragment, useMemo, useRef, useState } from 'react';
import { useJa } from './data.js';
import { Romaji, RomajiSwitch, Ruby, JaSpeak, JA_VOICE, useRomaji } from './JaText.jsx';
import { TYPE_LABEL, formsOf } from './conjugate.js';
import { answerKey, toHiragana } from './text.js';
import { fold } from '../../lib/text.js';
import { useColumns } from '../../hooks/useColumns.js';
import DetailNav, { DetailPager, useDetailCard, useDetailKeys } from '../../components/ui/DetailNav.jsx';
import { MarkFilter, MarkGlyph, MarkPicker } from '../../components/ui/Mark.jsx';
import { SearchIcon } from '../../components/ui/Icons.jsx';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { useSpeakOnOpen } from '../../lib/speech.js';
import { usePersisted } from '../../hooks/usePersisted.js';
import { originOf, usePresence, useSelection } from '../../lib/motion.js';

export function Forms({ entry }) {
  const forms = formsOf(entry.ruby, entry.t);
  if (!forms.length) return null;
  return (
    <div className="ja-forms">
      {forms.map(([label, form]) => (
        <div key={label} className="ja-form">
          <span className="ja-form-label">{label}</span>
          <Ruby text={form} />
          <Romaji text={form} className="small" />
        </div>
      ))}
    </div>
  );
}

function WordDetail({ entry, nav }) {
  const ref = useRef(null);
  const enter = useDetailCard(ref, nav);
  const mark = markOf(useLangItems('ja')[entry.id]);
  useSpeakOnOpen(entry.kana, JA_VOICE);
  return (
    <div className={`detail ${enter}`} ref={ref}>
      <div className="detail-head">
        <span className="detail-word ja-word">
          <Ruby text={entry.ruby} />
        </span>
        <JaSpeak text={entry.kana} />
        <DetailNav noun="Từ" {...nav} />
      </div>
      <div className="reading">
        <Romaji rm={entry.rm} className="pinyin" />
        {entry.kana !== entry.ja && (
          <span className="hanviet" lang="ja" title="Cách đọc">
            {entry.kana}
          </span>
        )}
        {entry.hv && (
          <span className="hanviet" title="Âm Hán Việt">
            {entry.hv}
          </span>
        )}
        {entry.t && <span className="cefr cefr-a">{TYPE_LABEL[entry.t]}</span>}
        <MarkPicker value={mark} onChange={(v) => setMark('items', itemKey('ja', entry.id), v)} />
      </div>
      <dl className="meaning">
        <div>
          <dt>VI</dt>
          <dd>{entry.vi}</dd>
        </div>
      </dl>
      <Forms entry={entry} />
      <DetailPager noun="Từ" {...nav} />
    </div>
  );
}

function TopicSection({ topic, tone, base, items, open, searching, onToggle }) {
  const gridRef = useRef(null);
  const [selectedId, setSelectedId, close, closing] = useSelection();
  const [filter, setFilter] = useState(null);
  const progress = useLangItems('ja');
  const showRm = useRomaji();
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
            <span lang="ja">{topic.ja}</span> · {searching ? `${items.length} kết quả` : `${base.length} từ`}
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
          <div className="grid ja-grid" ref={gridRef} style={{ '--sel-x': originOf(selected, cols) }}>
            {shown.map((e, i) => (
              <Fragment key={e.id}>
                <button
                  style={{ '--i': i }}
                  className={`tile ja-tile ${selected === i ? 'is-selected' : ''} ${[...e.ja].length > 5 ? 'is-long' : ''}`}
                  onClick={() => (selected === i ? close() : setSelectedId(e.id))}
                  aria-expanded={selected === i}
                  aria-label={`${e.ja} – ${STATES[markId(e.id)].label.toLowerCase()}`}
                  lang="ja"
                >
                  <span className="tile-mark">
                    <MarkGlyph value={markId(e.id)} size={12} />
                  </span>
                  {/* Ô đang chọn lật sang mặt sau: cách đọc */}
                  {selected === i ? (
                    <span className="tile-back" lang={showRm ? 'ja-Latn' : 'ja'}>
                      {showRm ? e.rm : e.kana}
                    </span>
                  ) : (
                    e.ja
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

const KINDS = [
  ['all', 'Tất cả', () => true],
  ['verb', 'Động từ', (e) => e.t.startsWith('v')],
  ['adj', 'Tính từ', (e) => e.t === 'i' || e.t === 'na'],
];

export default function JaWords({ onUnauthorized }) {
  const { data, error } = useJa(onUnauthorized);
  const [open, setOpen] = usePersisted('ja.openTopics', ['greet']);
  const [query, setQuery] = useState('');
  const [kind, setKind] = usePersisted('ja.kind', 'all');
  const q = fold(query.trim());
  const searching = q.length > 0;

  const { filtered, bases } = useMemo(() => {
    if (!data) return { filtered: {}, bases: {} };
    const test = (KINDS.find((k) => k[0] === kind) || KINDS[0])[2];
    const raw = query.trim();
    const kanaQ = raw ? toHiragana(answerKey(raw)) : '';
    const out = {};
    const bases = {};
    for (const t of data.topics) {
      const base = t.items.filter(test);
      bases[t.id] = base;
      out[t.id] = !q
        ? base
        : base.filter(
            (e) =>
              e.ja.includes(raw) ||
              (kanaQ && toHiragana(e.kana).includes(kanaQ)) ||
              e.rm.replace(/[ ']/g, '').includes(q.replace(/[\s']/g, '')) ||
              fold(e.vi).includes(q) ||
              (e.hv && fold(e.hv).includes(q)),
          );
    }
    return { filtered: out, bases };
  }, [data, q, query, kind]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading">Đang tải…</p>;
  const toggle = (id) => setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input type="search" placeholder="Tìm chữ Nhật, kana, romaji, nghĩa, Hán Việt…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="toolbar-note">
          {data.topics.length} chủ đề · {data.words.length} từ
        </span>
      </div>
      <div className="filter-row">
        <div className="pills" role="group" aria-label="Loại từ">
          {KINDS.map(([id, label, test], i) => (
            <button
              key={id}
              type="button"
              className={`pill ${i ? `pill-tone tone-${i === 1 ? 3 : 5}` : ''} ${kind === id ? 'is-on' : ''}`}
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
            >
              {label}
              <span className="pill-count">{data.words.filter(test).length.toLocaleString('vi-VN')}</span>
            </button>
          ))}
        </div>
        <RomajiSwitch />
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
        Từ vựng JLPT N5 theo danh sách thông dụng của Jonathan Waller (tanos.co.uk, qua bộ open-anki-jlpt-decks), đối chiếu chủ đề
        của みんなの日本語 初級 I và まるごと 入門; thêm vài từ hiện đại hay dùng (スマホ, コンビニ…). Nghĩa tiếng Việt và âm Hán Việt
        được soạn riêng.
      </footer>
    </>
  );
}
