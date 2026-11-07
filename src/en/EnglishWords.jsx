// Kho từ tiếng Anh: các từ đã lưu bằng extension Vocab English Lens (đồng bộ qua Supabase).
import { useEffect, useMemo, useState } from 'react';
import { removeEntry, setMark, useTable } from '../lib/store.js';
import { countMarks, dueLabel, markOf } from '../lib/srs.js';
import { useSettings } from '../lib/settings.js';
import { MarkButton, MarkFilter, MarkPicker } from '../components/Mark.jsx';
import { SearchIcon, TrashIcon } from '../components/Icons.jsx';
import EmptyParrot from '../components/EmptyParrot.jsx';
import { CEFR_LEVELS, POS_INFO, POS_ORDER, categoriesOf, categoryName, cefrOf, loadCefrIndex, wordClasses } from './cefr.js';
import { AccentButtons, CefrBadge, Contexts, Details, Meanings, playEnglish } from './parts.jsx';

export function useCefr() {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    loadCefrIndex().then(setIndex);
  }, []);
  return index;
}

// Màu (tông pastel) của một loại từ – dùng chung cho thẻ từ và nút lọc loại từ
function toneOfCategory(cat) {
  const i = POS_ORDER.indexOf(cat);
  return i >= 0 ? i % 8 : cat === 'phrase' ? 6 : 7;
}

// Thẻ mang màu của loại từ đầu tiên (cách dùng phổ biến nhất)
function toneOf(w) {
  return toneOfCategory([...categoriesOf(w)][0]);
}

function WordItem({ w, cefr, open, onToggle, index }) {
  const date = w.addedAt ? new Date(w.addedAt).toLocaleDateString('vi-VN') : '';
  const abbrs = [...wordClasses(w)].map((c) => POS_INFO[c]?.abbr).filter(Boolean);
  const mark = markOf(w);
  const change = (v) => setMark('words', w.key, v);
  return (
    <article style={{ '--i': index }} className={`card en-item tone-${toneOf(w)} ${open ? 'is-open' : ''}`}>
      <div className="en-head" onClick={onToggle}>
        <MarkButton value={mark} onChange={change} label={w.word} />
        <button type="button" className="en-toggle" aria-expanded={open} onClick={(e) => (e.stopPropagation(), onToggle())}>
          <span className="en-word">{w.word}</span>
          {abbrs.length > 0 && <span className="en-pos">{abbrs.join(' · ')}</span>}
          <CefrBadge cefr={cefr} />
        </button>
        <AccentButtons entry={w} />
      </div>
      {open && (
        <div className="en-body">
          <div className="translation-main">{w.translation}</div>
          <Meanings entry={w} />
          {w.forms?.length > 0 && <div className="forms">Dạng đã gặp: {w.forms.join(', ')}</div>}
          <Contexts entry={w} limit={5} />
          {w.details && (
            <details className="en-details" open>
              <summary>Giải thích chi tiết</summary>
              <Details d={w.details} word={w.word} />
            </details>
          )}
          <div className="en-foot">
            <MarkPicker value={mark} onChange={change} />
            <span className="muted small">
              {date && `Lưu ngày ${date} · `}Ôn tiếp: {dueLabel(w)}
            </span>
            <button
              type="button"
              className="icon-btn danger"
              title="Xoá từ này"
              aria-label={`Xoá ${w.word}`}
              onClick={() => confirm(`Xoá "${w.word}" khỏi kho từ?`) && removeEntry('words', w.key)}
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function EnglishWords() {
  const words = useTable('words');
  const settings = useSettings();
  const cefrIndex = useCefr();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [pos, setPos] = useState('all');
  const [level, setLevel] = useState('all');
  const [markFilter, setMarkFilter] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [limit, setLimit] = useState(60);

  const list = useMemo(() => Object.values(words), [words]);
  const levelOf = (w) => cefrOf(cefrIndex, w);

  const { counts: posCounts, order } = useMemo(() => {
    const counts = new Map();
    for (const w of list) for (const c of categoriesOf(w)) counts.set(c, (counts.get(c) || 0) + 1);
    const extra = [...counts.keys()].filter((c) => !POS_ORDER.includes(c) && c !== 'phrase' && c !== 'other').sort();
    return { counts, order: [...POS_ORDER, ...extra, 'phrase', 'other'].filter((c) => counts.has(c)) };
  }, [list]);

  const activePos = pos !== 'all' && !posCounts.has(pos) ? 'all' : pos;
  const inTab = list.filter((w) => activePos === 'all' || categoriesOf(w).has(activePos));
  const levelCounts = new Map();
  for (const w of inTab) {
    const lv = levelOf(w)?.level || 'none';
    levelCounts.set(lv, (levelCounts.get(lv) || 0) + 1);
  }

  const q = query.trim().toLowerCase();
  const shown = inTab
    .filter(
      (w) =>
        (markFilter === null || markOf(w) === markFilter) &&
        (level === 'all' || (levelOf(w)?.level || 'none') === level) &&
        (!q ||
          w.key.includes(q) ||
          (w.forms || []).some((f) => f.includes(q)) ||
          (w.translation || '').toLowerCase().includes(q) ||
          (w.meanings || []).some((m) => m.terms.some((t) => t.toLowerCase().includes(q)))),
    )
    .sort(sort === 'az' ? (a, b) => a.key.localeCompare(b.key) : (a, b) => (b.addedAt || 0) - (a.addedAt || 0));

  const toggle = (key) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      if (settings.autoPlay) playEnglish(words[key], settings.accent);
    }
    setOpen(next);
  };

  if (!list.length) {
    return (
      <div className="empty-state">
        <EmptyParrot kind="book" />
        <p className="empty-title">Kho từ tiếng Anh đang trống</p>
        <p className="muted">
          Từ được lưu bằng extension <b>Vocab English Lens</b> khi bạn đọc web (bôi đen một từ → ☆ Lưu). Extension và app
          này dùng chung tài khoản Supabase nên từ sẽ tự xuất hiện ở đây sau khi đồng bộ.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input type="search" placeholder="Tìm từ hoặc nghĩa…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Lọc theo cấp độ CEFR">
          <option value="all">Mọi cấp độ ({inTab.length})</option>
          {CEFR_LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {lv} ({levelCounts.get(lv) || 0})
            </option>
          ))}
          <option value="none">Chưa xếp cấp ({levelCounts.get('none') || 0})</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
          <option value="new">Mới lưu trước</option>
          <option value="az">A → Z</option>
        </select>
      </div>

      <div className="pills" role="tablist" aria-label="Từ loại">
        {[['all', 'Tất cả', list.length], ...order.map((c) => [c, categoryName(c), posCounts.get(c)])].map(([c, label, n]) => (
          <button
            key={c}
            type="button"
            className={`pill ${c === 'all' ? '' : `pill-tone tone-${toneOfCategory(c)}`} ${activePos === c ? 'is-on' : ''}`}
            aria-pressed={activePos === c}
            onClick={() => setPos(c)}
          >
            {POS_INFO[c] && <b>{POS_INFO[c].abbr}</b>} {label}
            <span className="pill-count">{n}</span>
          </button>
        ))}
      </div>

      <div className="filter-row">
        <MarkFilter counts={countMarks(inTab)} active={markFilter} onPick={(v) => setMarkFilter((f) => (f === v ? null : v))} />
        {markFilter !== null && (
          <button type="button" className="link-btn" onClick={() => setMarkFilter(null)}>
            Bỏ lọc
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <EmptyParrot kind="search">
          <p className="muted">Không có từ nào khớp bộ lọc.</p>
        </EmptyParrot>
      )}
      <div className="en-list">
        {shown.slice(0, limit).map((w, i) => (
          <WordItem key={w.key} index={i} w={w} cefr={levelOf(w)} open={open.has(w.key)} onToggle={() => toggle(w.key)} />
        ))}
      </div>
      {shown.length > limit && (
        <button type="button" className="btn ghost more-btn" onClick={() => setLimit((l) => l + 100)}>
          Xem thêm ({shown.length - limit} từ)
        </button>
      )}
    </>
  );
}
