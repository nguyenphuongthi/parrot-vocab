import { useEffect, useMemo, useState } from 'react';
import LevelSection from './LevelSection.jsx';
import { fold } from '../../lib/text.js';
import { loadIndex, loadLevel } from './data.js';
import { UNAUTHORIZED } from '../../lib/supabase.js';
import { usePersisted } from '../../hooks/usePersisted.js';

export default function ZhVocab({ onUnauthorized }) {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [words, setWords] = useState({}); // level -> danh sách từ
  const [open, setOpen] = usePersisted('zh.openLevels', [1]);
  const [query, setQuery] = useState('');

  const fail = (e, msg) => (e.message === UNAUTHORIZED ? onUnauthorized() : setError(msg));

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e) => fail(e, 'Không tải được dữ liệu HSK.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searching = query.trim().length > 0;

  // Tải dữ liệu cho các cấp đang mở; khi tìm kiếm thì tải hết.
  useEffect(() => {
    if (!index) return;
    for (const { level } of index.levels) {
      if ((searching || open.includes(level)) && !words[level]) {
        loadLevel(level)
          .then((list) => setWords((p) => (p[level] ? p : { ...p, [level]: list })))
          .catch((e) => fail(e, `Không tải được dữ liệu HSK ${level}.`));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open, searching]);

  const toggle = (level) =>
    setOpen((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level].sort()));

  const q = fold(query.trim());
  const filtered = useMemo(() => {
    if (!q) return words;
    const raw = query.trim();
    const out = {};
    for (const [level, list] of Object.entries(words)) {
      out[level] = list.filter(
        (x) =>
          x.w.includes(raw) ||
          (x.py && fold(x.py).replace(/\s/g, '').includes(q.replace(/\s/g, ''))) ||
          (x.hv && fold(x.hv).includes(q)) ||
          (x.vi && fold(x.vi).includes(q)) ||
          (x.en && fold(x.en).includes(q)),
      );
    }
    return out;
  }, [words, q, query]);

  const total = index?.levels.reduce((s, l) => s + l.total, 0) ?? 0;

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Tìm chữ Hán, pinyin, Hán Việt, nghĩa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="toolbar-note">HSK 1–6 · {total.toLocaleString('vi-VN')} từ</span>
      </div>
      {error && <p className="error">{error}</p>}
      {!index && !error && <p className="loading">Đang tải…</p>}

      {index?.levels.map((info) => (
        <LevelSection
          key={info.level}
          info={info}
          tags={index.tags}
          words={filtered[info.level]}
          open={searching || open.includes(info.level)}
          searching={searching}
          onToggle={() => toggle(info.level)}
        />
      ))}

      <footer className="foot">
        Danh sách từ theo đề cương HSK 2.0 (mock.tangce.cn). Pinyin đối chiếu với CC-CEDICT (CC BY-SA 4.0).
      </footer>
    </>
  );
}
