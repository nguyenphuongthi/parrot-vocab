// Thống kê chung cho cả 3 ngôn ngữ, lọc được theo ngôn ngữ.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from '../lib/store.js';
import { STATES, countMarks, isDue, marksByDay, reviewsLastDays } from '../lib/srs.js';
import { LANGS } from '../lib/langs.js';
import GoalBar from '../components/GoalBar.jsx';
import { MarkGlyph } from '../components/Mark.jsx';
import { loadIndex } from '../zh/data.js';
import { loadKo } from '../ko/data.js';
import { freshBadges, useBadges } from '../lib/achievements.js';

// Huy hiệu thành tích: đã mở có ánh sáng quét qua; vừa mở trong phiên này thì lật ra
function Badges() {
  const badges = useBadges();
  const done = badges.filter((b) => b.done).length;
  return (
    <section className="card">
      <h3 className="card-title">
        Huy hiệu <span className="muted small">· {done}/{badges.length}</span>
      </h3>
      <div className="badges">
        {badges.map((b, i) => (
          <div
            key={b.id}
            className={`badge ${b.done ? 'is-on' : 'is-locked'} ${b.done && freshBadges.has(b.id) ? 'is-new' : ''}`}
            style={{ '--i': i }}
            title={b.desc}
          >
            <span className="badge-icon" aria-hidden="true">
              {b.icon}
            </span>
            <span className="badge-title">{b.title}</span>
            <span className="badge-desc">{b.done ? b.desc : `${b.value.toLocaleString('vi-VN')} / ${b.goal.toLocaleString('vi-VN')}`}</span>
            {!b.done && (
              <span className="badge-progress" aria-hidden="true">
                <span style={{ width: `${(b.value / b.goal) * 100}%` }} />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const FILTERS = [['all', 'Tất cả'], ...Object.entries(LANGS).map(([id, l]) => [id, l.name])];

function useEntries() {
  const words = useTable('words');
  const items = useTable('items');
  return useMemo(() => {
    const out = { en: Object.values(words), zh: [], ko: [] };
    for (const [k, v] of Object.entries(items)) {
      const lang = k.slice(0, 2);
      if (out[lang]) out[lang].push({ ...v, _id: k.slice(3) });
    }
    return out;
  }, [words, items]);
}

function useTotals() {
  const [totals, setTotals] = useState({ zh: null, ko: null });
  useEffect(() => {
    loadIndex()
      .then((i) => setTotals((t) => ({ ...t, zh: i.levels.reduce((s, l) => s + l.total, 0) })))
      .catch(() => {});
    loadKo().then((d) => setTotals((t) => ({ ...t, ko: d.words.length + d.phrases.length })));
  }, []);
  return totals;
}

// Thanh xếp chồng 3 mức (đã thuộc – hơi nhớ – chưa thuộc)
function MarkBar({ counts, total }) {
  const sum = total || counts[0] + counts[1] + counts[2] || 1;
  return (
    <div className="markbar" aria-hidden="true">
      {[2, 1, 0].map((m) => (counts[m] ? <span key={m} className={`m${m}`} style={{ width: `${(counts[m] / sum) * 100}%` }} /> : null))}
    </div>
  );
}

function LangCard({ lang, list, total, index = 0 }) {
  const l = LANGS[lang];
  // Tiếng Trung: tách từ vựng và ngữ pháp (id ngữ pháp bắt đầu bằng "g")
  const vocab = lang === 'zh' ? list.filter((e) => !e._id.startsWith('g')) : list;
  const grammar = lang === 'zh' ? list.filter((e) => e._id.startsWith('g')) : [];
  const counts = countMarks(vocab);
  if (total != null && lang !== 'en') counts[0] = Math.max(0, total - counts[1] - counts[2]);
  const due = vocab.filter((e) => isDue(e)).length; // điểm ngữ pháp không có trong flashcard
  const shownTotal = lang === 'en' ? list.length : total;
  return (
    <section className="card stat-card" style={{ '--i': index }}>
      <header>
        <span className="lang-glyph" data-lang={lang} aria-hidden="true">
          {l.glyph}
        </span>
        <div>
          <h3>{l.name}</h3>
          <p className="muted small">
            {lang === 'en' ? `${list.length} từ đã lưu` : shownTotal != null ? `${shownTotal.toLocaleString('vi-VN')} ${l.unit}` : '…'}
          </p>
        </div>
        <span className="stat-due" title="Số thẻ cần ôn hôm nay">
          <b>{due}</b> cần ôn
        </span>
      </header>
      <MarkBar counts={counts} total={lang === 'en' ? list.length : shownTotal} />
      <ul className="stat-legend">
        {STATES.map((s) => (
          <li key={s.value}>
            <MarkGlyph value={s.value} size={14} /> {s.label}
            <b>{counts[s.value].toLocaleString('vi-VN')}</b>
          </li>
        ))}
      </ul>
      {grammar.length > 0 && (
        <p className="muted small">
          Ngữ pháp HSK: {countMarks(grammar)[2]} đã thuộc · {countMarks(grammar)[1]} hơi nhớ
        </p>
      )}
    </section>
  );
}

function Activity({ list }) {
  const days = reviewsLastDays(list, 30);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <section className="card">
      <h3 className="card-title">
        Thẻ đã ôn 30 ngày qua <span className="muted small">· tổng {total}</span>
      </h3>
      <div className="activity" role="img" aria-label={`Số thẻ ôn mỗi ngày trong 30 ngày qua, tổng ${total}`}>
        {days.map((d, i) => {
          const date = new Date(d.day).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
          return (
            <span key={d.day} style={{ '--i': i }} className="activity-col" data-tip={`${date}: ${d.count} thẻ`} tabIndex={0} aria-label={`${date}: ${d.count} thẻ`}>
              <span className="activity-bar" style={{ height: `${d.count ? Math.max(6, (d.count / max) * 100) : 0}%` }} />
            </span>
          );
        })}
      </div>
      <div className="activity-axis muted small">
        <span>{new Date(days[0].day).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}</span>
        <span>hôm nay</span>
      </div>
    </section>
  );
}

// Trục tung: số nguyên, khoảng chia gọn (1, 2, 5, 10…), khoảng 4 vạch
function niceTicks(max) {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw));
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

function MonthChart({ list }) {
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const boxRef = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCurrent = month.year === now.getFullYear() && month.month === now.getMonth();
  const data = marksByDay(list, month.year, month.month);
  const shown = isCurrent ? now.getDate() : data.days;
  const shift = (delta) => {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
    setHover(null);
  };

  const height = 240;
  const pad = { top: 16, right: 12, bottom: 26, left: 34 };
  const w = Math.max(width, pad.left + pad.right + data.days * 18);
  const plotW = w - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...STATES.flatMap((s) => data.counts[s.value].slice(0, shown)));
  const ticks = niceTicks(max);
  const top = ticks.at(-1);
  const x = (d) => pad.left + (data.days === 1 ? plotW / 2 : (d * plotW) / (data.days - 1));
  const y = (v) => pad.top + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil((data.days * 26) / plotW));
  const sums = STATES.map((s) => data.counts[s.value].reduce((a, b) => a + b, 0));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const day = Math.round(((e.clientX - rect.left - pad.left) / plotW) * (data.days - 1));
    setHover(day >= 0 && day < shown ? day : null);
  };

  return (
    <section className="card">
      <div className="chart-head">
        <h3 className="card-title">Số mục được đánh dấu mỗi ngày</h3>
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Tháng trước">
            ‹
          </button>
          <span>
            Tháng {month.month + 1}/{month.year}
          </span>
          <button type="button" className="icon-btn" onClick={() => shift(1)} disabled={isCurrent} aria-label="Tháng sau">
            ›
          </button>
        </div>
      </div>
      <ul className="chart-legend">
        {STATES.map((s, i) => (
          <li key={s.value}>
            <span className={`swatch m${s.value}`} />
            {s.label} <b>{sums[i]}</b>
          </li>
        ))}
      </ul>
      <div className="chart" ref={boxRef}>
        <svg width={w} height={height} role="img" aria-label={`Biểu đồ số mục được đánh dấu theo mức thuộc mỗi ngày, tháng ${month.month + 1}/${month.year}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} />
              <text className="axis-text" x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {Array.from({ length: data.days }, (_, d) =>
            d % every === 0 ? (
              <text key={d} className="axis-text" x={x(d)} y={height - 6} textAnchor="middle">
                {d + 1}
              </text>
            ) : null,
          )}
          {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + plotH} />}
          {STATES.map((s) => (
            <polyline
              key={s.value}
              className={`series m${s.value}`}
              points={data.counts[s.value]
                .slice(0, shown)
                .map((v, d) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`)
                .join(' ')}
            />
          ))}
          {hover !== null &&
            STATES.map((s) => <circle key={s.value} className={`dot m${s.value}`} cx={x(hover)} cy={y(data.counts[s.value][hover])} r={4.5} />)}
        </svg>
        {hover !== null && (
          <div className="chart-tip" style={{ left: Math.min(x(hover) + 12, w - 170) }}>
            <strong>
              {hover + 1}/{month.month + 1}/{month.year}
            </strong>
            {STATES.map((s) => (
              <div key={s.value}>
                <span className={`swatch m${s.value}`} />
                {s.label}
                <b>{data.counts[s.value][hover]}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="link-btn" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? 'Ẩn bảng số liệu' : 'Xem bảng số liệu'}
      </button>
      {showTable && <MonthTable data={data} shown={shown} month={month} />}
    </section>
  );
}

function MonthTable({ data, shown, month }) {
  const rows = [];
  for (let d = 0; d < shown; d++) {
    const values = STATES.map((s) => data.counts[s.value][d]);
    if (values.some(Boolean)) rows.push([d, values]);
  }
  if (!rows.length) return <p className="muted">Không có số liệu trong tháng này.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Ngày</th>
          {STATES.map((s) => (
            <th key={s.value}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([d, values]) => (
          <tr key={d}>
            <td>
              {d + 1}/{month.month + 1}
            </td>
            {values.map((v, i) => (
              <td key={i}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StatsView() {
  const entries = useEntries();
  const totals = useTotals();
  const [filter, setFilter] = useState('all');
  const list = filter === 'all' ? [...entries.en, ...entries.zh, ...entries.ko] : entries[filter];
  const langs = filter === 'all' ? Object.keys(LANGS) : [filter];

  return (
    <div className="stats">
      <div className="pills" role="tablist" aria-label="Lọc theo ngôn ngữ">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={`pill ${filter === id ? 'is-on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <GoalBar list={list} label={filter === 'all' ? 'Hôm nay (cả 3 ngôn ngữ)' : `Hôm nay (${LANGS[filter].name})`} />

      <div className="stat-cards">
        {langs.map((lang, i) => (
          <LangCard key={lang} index={i} lang={lang} list={entries[lang]} total={totals[lang]} />
        ))}
      </div>

      <Badges />
      <Activity list={list} />
      <MonthChart key={filter} list={list} />
    </div>
  );
}
