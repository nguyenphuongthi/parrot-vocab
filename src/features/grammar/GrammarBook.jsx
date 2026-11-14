// Sách ngữ pháp dùng chung cho tiếng Anh và tiếng Hàn: các chủ đề (mở/thu), mỗi chủ đề là danh sách điểm ngữ pháp;
// bấm một điểm để mở khung chi tiết. Lọc theo mức độ khó (tiếng Anh), mức thuộc ○ ◐ ● và tìm kiếm.
// Dữ liệu: public/data/<lang>/… (sinh từ data-src bằng npm run data:en / data:ko, định dạng ở scripts/lib/grammar.mjs).
import { useEffect, useMemo, useState } from 'react';
import { getJson, UNAUTHORIZED } from '../../lib/supabase.js';
import { useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { fold } from '../../lib/text.js';
import { usePersisted } from '../../hooks/usePersisted.js';
import { usePresence, useSelection } from '../../lib/motion.js';
import { useDetailKeys } from '../../components/ui/DetailNav.jsx';
import { MarkFilter, MarkGlyph } from '../../components/ui/Mark.jsx';
import { SearchIcon } from '../../components/ui/Icons.jsx';
import EmptyParrot from '../../components/mascot/EmptyParrot.jsx';
import GrammarPoint, { plain } from './GrammarPoint.jsx';
import { LevelBadge, TIERS, tierOf } from './levels.jsx';

const cache = new Map();

function useBook(path, onUnauthorized) {
  const [state, setState] = useState(() => ({ data: cache.get(path) ?? null, error: null }));
  useEffect(() => {
    if (cache.has(path)) return;
    let live = true;
    getJson(path).then(
      (data) => {
        cache.set(path, data);
        if (live) setState({ data, error: null });
      },
      (e) => {
        if (!live) return;
        if (e.message === UNAUTHORIZED) onUnauthorized?.();
        else setState({ data: null, error: 'Không tải được dữ liệu ngữ pháp.' });
      },
    );
    return () => {
      live = false;
    };
  }, [path, onUnauthorized]);
  return state;
}

// Chuỗi để tìm kiếm của một điểm: tên, nghĩa, công thức, ví dụ (bỏ dấu tiếng Việt, không phân biệt hoa thường)
const searchText = (p) =>
  fold(
    [p.title, p.sub, ...(p.form || []), ...p.uses.flatMap((u) => [u.vi, ...u.ex.flat()])].map(plain).join('\n'),
  );

function Unit({ unit, index, open, forced, onToggle, points, counts, children }) {
  const body = usePresence(open);
  const learned = counts[2];
  return (
    <section className={`level lesson gb-unit tone-${index % 8} ${open ? 'is-open' : ''}`}>
      <div className="level-head" onClick={forced ? undefined : onToggle}>
        <button
          type="button"
          className="level-title"
          disabled={forced}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
        >
          <span className="level-name">{index + 1}</span>
          <span className="lesson-name">
            <span className="gb-unit-name">{unit.name}</span>
            <span className="level-count">
              {points.length} điểm{learned > 0 && ` · ${learned} đã thuộc`}
            </span>
          </span>
        </button>
        {!forced && (
          <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </div>
      {body.mounted && (
        <div className={`level-body ${body.closing ? 'is-closing' : ''}`}>
          {unit.intro && !forced && <p className="gb-intro">{unit.intro}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

// reference: component bảng tra cứu (tuỳ chọn) – có thì hiện nút chuyển “Điểm ngữ pháp / Bảng tra cứu”.
export default function GrammarBook({ lang, path, storageKey, footer, reference: Reference, onUnauthorized }) {
  const { data, error } = useBook(path, onUnauthorized);
  const progress = useLangItems(lang);
  const [query, setQuery] = useState('');
  const [tier, setTier] = usePersisted(`${storageKey}.tier`, -1); // -1 = mọi mức
  const [markFilter, setMarkFilter] = useState(null);
  const [openUnits, setOpenUnits] = usePersisted(`${storageKey}.open`, []);
  const [selectedId, select, close, closing] = useSelection();
  const [view, setView] = usePersisted(`${storageKey}.view`, 'points');
  const showRef = !!Reference && view === 'ref';
  const markOfId = (id) => markOf(progress[`g:${id}`]);

  const index = useMemo(() => {
    if (!data) return null;
    const byId = new Map();
    const units = data.units.map((u) => ({
      ...u,
      points: u.points.map((p, i) => {
        const point = { ...p, num: i + 1, unit: u.id, text: searchText(p) };
        byId.set(p.id, point);
        return point;
      }),
    }));
    return { units, byId };
  }, [data]);

  const q = fold(query.trim());
  const filtering = !!q || tier >= 0 || markFilter !== null;
  const passBase = (p) => (tier < 0 || tierOf(p.level) === tier) && (!q || p.text.includes(q));
  // Điểm đang mở vẫn hiện dù vừa đổi mức thuộc khi đang lọc (đến khi đóng)
  const pass = (p) => passBase(p) && (markFilter === null || markOfId(p.id) === markFilter || p.id === selectedId);

  const units = index
    ? index.units
        .map((u) => ({ unit: u, shown: u.points.filter(pass), base: u.points.filter(passBase) }))
        .filter((x) => !filtering || x.shown.length > 0)
    : [];
  const isOpen = (u) => filtering || openUnits.includes(u.id);
  const visible = units.flatMap((x) => (isOpen(x.unit) ? x.shown : []));
  const counts = [0, 0, 0];
  for (const x of units) for (const p of x.base) counts[markOfId(p.id)]++;
  const tierCounts = TIERS.map((_, i) => (index ? [...index.byId.values()].filter((p) => tierOf(p.level) === i).length : 0));

  const pos = visible.findIndex((p) => p.id === selectedId);
  const goPrev = pos > 0 ? () => select(visible[pos - 1].id) : null;
  const goNext = pos >= 0 && pos < visible.length - 1 ? () => select(visible[pos + 1].id) : null;
  useDetailKeys(selectedId, { onPrev: goPrev, onNext: goNext, onClose: close });

  const toggleUnit = (id) =>
    setOpenUnits((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const jump = (id) => {
    const target = index?.byId.get(id);
    if (!target) return;
    if (!pass(target)) {
      setQuery('');
      setTier(-1);
      setMarkFilter(null);
    }
    setOpenUnits((prev) => (prev.includes(target.unit) ? prev : [...prev, target.unit]));
    select(id);
  };

  const switcher = Reference && (
    <div className="seg" role="tablist" aria-label="Chế độ xem">
      <button type="button" role="tab" aria-selected={!showRef} className={!showRef ? 'is-on' : ''} onClick={() => setView('points')}>
        Điểm ngữ pháp
      </button>
      <button type="button" role="tab" aria-selected={showRef} className={showRef ? 'is-on' : ''} onClick={() => setView('ref')}>
        Bảng tra cứu
      </button>
    </div>
  );
  if (showRef) {
    return (
      <div className="grammar-book" data-lang={lang}>
        {switcher}
        <Reference
          onOpenPoint={(id) => {
            setView('points');
            jump(id);
          }}
          onUnauthorized={onUnauthorized}
        />
      </div>
    );
  }
  if (error) return <p className="error">{error}</p>;
  if (!index) return <p className="loading">Đang tải…</p>;

  return (
    <div className="grammar-book" data-lang={lang}>
      {switcher}
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder={lang === 'en' ? 'Tìm cấu trúc, nghĩa hoặc ví dụ…' : 'Tìm ngữ pháp (vd. 고 싶다), nghĩa…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {lang === 'en' && (
        <div className="pills" role="group" aria-label="Mức độ">
          {[{ label: 'Tất cả mức', levels: [] }, ...TIERS].map((t, i) => {
            const value = i - 1;
            const on = tier === value;
            return (
              <button
                key={t.label}
                type="button"
                className={`pill ${value >= 0 ? `pill-tone tone-${[3, 5, 6][value]}` : ''} ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() => setTier(value)}
              >
                {t.label}
                {t.levels.length > 0 && <span className="gb-pill-levels">{t.levels.join('–')}</span>}
                <span className="pill-count">{value < 0 ? index.byId.size : tierCounts[value]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="filter-row">
        <MarkFilter counts={counts} active={markFilter} onPick={(v) => setMarkFilter((f) => (f === v ? null : v))} />
        {filtering && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery('');
              setTier(-1);
              setMarkFilter(null);
            }}
          >
            Bỏ lọc
          </button>
        )}
      </div>
      {markFilter !== null && (
        <p className="filter-note">
          <MarkGlyph value={markFilter} size={14} /> Đang lọc: {STATES[markFilter].label.toLowerCase()}
        </p>
      )}

      {units.length === 0 && (
        <EmptyParrot kind="search">
          <p className="muted">Không có điểm ngữ pháp nào khớp bộ lọc.</p>
        </EmptyParrot>
      )}

      {units.map(({ unit, shown, base }, ui) => (
        <Unit
          key={unit.id}
          unit={unit}
          index={index.units.indexOf(unit)}
          open={isOpen(unit)}
          forced={filtering}
          onToggle={() => toggleUnit(unit.id)}
          points={base}
          counts={base.reduce((c, p) => (c[markOfId(p.id)]++, c), [0, 0, 0])}
        >
          <ul className="points">
            {shown.map((p, i) => {
              const isSel = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    style={{ '--i': i + ui }}
                    className={`point gb-point ${isSel ? 'is-selected' : ''}`}
                    onClick={() => (isSel ? close() : select(p.id))}
                    aria-expanded={isSel}
                  >
                    <MarkGlyph value={markOfId(p.id)} size={16} />
                    <span className="g-num">{p.num}</span>
                    <span className="gb-point-text">
                      <span className="point-title gb-point-title" lang={lang}>
                        {p.title}
                      </span>
                      <span className="gb-point-sub">{p.sub}</span>
                    </span>
                    <LevelBadge lang={lang} level={p.level} />
                  </button>
                  {isSel && (
                    <GrammarPoint
                      key={p.id}
                      point={p}
                      num={p.num}
                      lang={lang}
                      onJump={jump}
                      titleOf={(id) => index.byId.get(id)?.title ?? id}
                      nav={{ pos: pos + 1, total: visible.length, onPrev: goPrev, onNext: goNext, onClose: close, closing }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Unit>
      ))}

      <footer className="foot">{footer}</footer>
    </div>
  );
}
