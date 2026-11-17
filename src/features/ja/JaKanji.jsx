// Kanji N5 theo nhóm: lưới chữ, bấm để xem viết từng nét (KanjiVG), âm Hán Việt, âm On / Kun và từ ví dụ.
import { Fragment, useMemo, useRef, useState } from 'react';
import { useJa } from './data.js';
import { JaSpeak, JaStrokes, Romaji, RomajiSwitch, Ruby, sayJa, useStrokeCount } from './JaText.jsx';
import { splitKun } from './entries.js';
import { answerKey, toHiragana, toRomaji } from './text.js';
import { fold } from '../../lib/text.js';
import { useColumns } from '../../hooks/useColumns.js';
import DetailNav, { DetailPager, useDetailCard, useDetailKeys } from '../../components/ui/DetailNav.jsx';
import { MarkFilter, MarkGlyph, MarkPicker } from '../../components/ui/Mark.jsx';
import { SearchIcon } from '../../components/ui/Icons.jsx';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { usePersisted } from '../../hooks/usePersisted.js';
import { originOf, usePresence, useSelection } from '../../lib/motion.js';

// Âm Kun: phần okurigana (sau dấu chấm) in nhạt – た(べる)
function Kun({ r }) {
  const k = splitKun(r);
  return (
    <span lang="ja" className="ja-reading-chip">
      <span>
        {k.prefix && '-'}
        {k.stem}
        {k.oku && <span className="okuri">{k.oku}</span>}
        {k.suffix && '-'}
      </span>
    </span>
  );
}

function KanjiDetail({ entry, nav }) {
  const ref = useRef(null);
  const enter = useDetailCard(ref, nav);
  const mark = markOf(useLangItems('ja')[entry.id]);
  const [play, setPlay] = useState(0);
  const count = useStrokeCount(entry.ja);
  return (
    <div className={`detail ${enter} kanji-detail`} ref={ref}>
      <div className="detail-head">
        <button type="button" className="kanji-big has-strokes" onClick={() => setPlay((n) => n + 1)} title="Vẽ lại từng nét">
          <JaStrokes char={entry.ja} size={120} playKey={play} numbers />
        </button>
        <div className="kanji-head-info">
          <span className="kanji-hv">{entry.hv}</span>
          <span className="kanji-vi">{entry.vi}</span>
          <span className="muted small">
            {count > 0 && `${count} nét · `}
            {entry.extra ? 'Bổ sung (hay gặp ở sơ cấp)' : 'JLPT N5'}
          </span>
        </div>
        <DetailNav noun="Chữ" {...nav} />
      </div>
      <div className="reading">
        <MarkPicker value={mark} onChange={(v) => setMark('items', itemKey('ja', entry.id), v)} />
      </div>
      <dl className="meaning kanji-readings">
        {entry.on.length > 0 && (
          <div>
            <dt title="Âm On – cách đọc theo âm Hán, thường dùng trong từ ghép">On</dt>
            <dd>
              {entry.on.map((r) => (
                <span key={r} className="ja-reading-chip" lang="ja">
                  {r}
                  <Romaji rm={toRomaji(toHiragana(r), { particles: false })} className="small" />
                </span>
              ))}
            </dd>
          </div>
        )}
        {entry.kun.length > 0 && (
          <div>
            <dt title="Âm Kun – cách đọc thuần Nhật, thường khi chữ đứng một mình hoặc có okurigana">Kun</dt>
            <dd>
              {entry.kun.map((r) => (
                <Fragment key={r}>
                  <Kun r={r} />
                </Fragment>
              ))}
            </dd>
          </div>
        )}
      </dl>
      <ul className="kanji-examples">
        {entry.ex.map((x) => (
          <li key={x.ja + x.kana}>
            <button type="button" className="word-chip" onClick={() => sayJa(x.kana)}>
              <Ruby text={x.ruby} />
              <Romaji rm={x.rm} className="small" />
              <span>· {x.vi}</span>
            </button>
          </li>
        ))}
      </ul>
      <DetailPager noun="Chữ" {...nav} />
    </div>
  );
}

function GroupSection({ group, tone, base, items, open, searching, onToggle }) {
  const gridRef = useRef(null);
  const [selectedId, setSelectedId, close, closing] = useSelection();
  const [filter, setFilter] = useState(null);
  const progress = useLangItems('ja');
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
          <span className="level-name">{group.name}</span>
          <span className="level-count">{searching ? `${items.length} kết quả` : `${base.length} chữ`}</span>
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
          {shown.length === 0 && <p className="muted">Không có chữ nào ở mức này.</p>}
          <div className="grid kanji-grid" ref={gridRef} style={{ '--sel-x': originOf(selected, cols) }}>
            {shown.map((e, i) => (
              <Fragment key={e.id}>
                <button
                  style={{ '--i': i }}
                  className={`tile kanji-tile ${selected === i ? 'is-selected' : ''}`}
                  onClick={() => (selected === i ? close() : setSelectedId(e.id))}
                  aria-expanded={selected === i}
                  aria-label={`${e.ja} (${e.hv}) – ${STATES[markId(e.id)].label.toLowerCase()}`}
                  lang="ja"
                >
                  <span className="tile-mark">
                    <MarkGlyph value={markId(e.id)} size={12} />
                  </span>
                  {selected === i ? <span className="tile-back">{e.hv}</span> : e.ja}
                  {e.extra && selected !== i && <span className="kanji-extra" aria-hidden="true" title="Bổ sung" />}
                </button>
                {i === rowEnd && (
                  <KanjiDetail
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

export default function JaKanji({ onUnauthorized }) {
  const { data, error } = useJa(onUnauthorized);
  const [open, setOpen] = usePersisted('ja.openKanji', ['numbers']);
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const searching = q.length > 0;

  const filtered = useMemo(() => {
    if (!data) return {};
    const raw = query.trim();
    const kanaQ = raw ? answerKey(raw) : '';
    const out = {};
    for (const g of data.kanjiGroups) {
      out[g.id] = !q
        ? g.items
        : g.items.filter(
            (k) =>
              k.ja === raw ||
              fold(k.hv).includes(q) ||
              fold(k.vi).includes(q) ||
              [...k.on.map(toHiragana), ...k.kun.map((r) => splitKun(r).kana)].some((r) => r === kanaQ) ||
              k.ex.some((x) => x.ja.includes(raw)),
          );
    }
    return out;
  }, [data, q, query]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading">Đang tải…</p>;
  const toggle = (id) => setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input type="search" placeholder="Tìm chữ, Hán Việt, nghĩa, cách đọc…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="toolbar-note">
          {data.kanji.filter((k) => !k.extra).length} chữ N5 · {data.kanji.filter((k) => k.extra).length} chữ bổ sung
        </span>
      </div>
      <div className="filter-row">
        <p className="muted small kanji-legend">
          Âm <b>On</b> (katakana): đọc theo âm Hán, hay dùng trong từ ghép. Âm <b>Kun</b> (hiragana): đọc thuần Nhật; phần in nhạt là
          okurigana viết bằng kana. Chữ có chấm nhỏ ở góc là chữ bổ sung.
        </p>
        <RomajiSwitch />
      </div>
      {data.kanjiGroups.map((g, i) => (
        <GroupSection
          key={g.id}
          group={g}
          tone={i + 2}
          base={g.items}
          items={filtered[g.id] || []}
          open={searching || open.includes(g.id)}
          searching={searching}
          onToggle={() => toggle(g.id)}
        />
      ))}
      <footer className="foot">
        79 chữ Kanji N5 theo danh sách JLPT N5 thông dụng (Jonathan Waller, theo đề cũ cấp 4) và 21 chữ bổ sung hay gặp ở trình độ sơ cấp.
        Âm đọc đối chiếu KANJIDIC (EDRDG) qua bộ dữ liệu kanji-data; thứ tự nét: KanjiVG © Ulrich Apel (CC BY-SA 3.0). Nghĩa và âm Hán
        Việt được soạn riêng.
      </footer>
    </>
  );
}
