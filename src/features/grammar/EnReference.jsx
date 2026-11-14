// Bảng tra cứu ngữ pháp tiếng Anh: động từ bất quy tắc (tìm kiếm, nghe), 12 thì, lùi thì trong câu tường thuật.
// Dữ liệu: public/data/en/reference.json (sinh từ data-src/en/reference bằng npm run data:en).
import { useEffect, useMemo, useState } from 'react';
import { getJson, UNAUTHORIZED } from '../../lib/supabase.js';
import { speak } from '../../lib/speech.js';
import { fold } from '../../lib/text.js';
import Disclosure from '../../components/ui/Disclosure.jsx';
import { SearchIcon, SpeakerIcon } from '../../components/ui/Icons.jsx';

let cache = null;

// "read /red/", "got / gotten (Mỹ)" → đọc thành "read", "got, gotten"
const spoken = (form) =>
  form
    .replace(/\(.*?\)|\/[^/\s]+\//g, '')
    .replace(/\s+\/\s+/g, ', ')
    .trim();

function Verbs({ verbs }) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const shown = useMemo(
    () => (q ? verbs.filter((v) => v.slice(0, 4).some((x) => fold(x).includes(q))) : verbs),
    [verbs, q],
  );
  return (
    <>
      <label className="search ref-search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Tìm động từ (go, went, gone) hoặc nghĩa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="muted small">
        {shown.length} / {verbs.length} động từ · V1 nguyên mẫu, V2 quá khứ, V3 phân từ hai (dùng cho thì hoàn thành và bị động)
      </p>
      <div className="ref-table-wrap">
        <table className="ref-table verbs-table">
          <thead>
            <tr>
              <th>V1</th>
              <th>V2</th>
              <th>V3</th>
              <th>Nghĩa</th>
              <th aria-label="Cấp độ và phát âm" />
            </tr>
          </thead>
          <tbody>
            {shown.map(([v1, v2, v3, vi, level]) => (
              <tr key={v1}>
                <td lang="en">
                  <b>{v1}</b>
                </td>
                <td lang="en">{v2}</td>
                <td lang="en">{v3}</td>
                <td>{vi}</td>
                <td className="ref-actions">
                  <span className={`cefr cefr-${level[0].toLowerCase()}`}>{level}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Nghe ${v1}, ${v2}, ${v3}`}
                    title="Nghe ba dạng"
                    onClick={() => speak(`${spoken(v1)}, ${spoken(v2)}, ${spoken(v3)}`, 'en-US', { rate: 0.85 })}
                  >
                    <SpeakerIcon size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const SIGNS = ['+', '−', '?'];

function Tenses({ tenses, onOpenPoint }) {
  return (
    <div className="tense-grid">
      {tenses.map((t, i) => (
        <article key={t.name} className={`tense-card tone-${i % 8}`}>
          <header>
            <h4 lang="en">{t.name}</h4>
            <span className="muted">{t.vi}</span>
          </header>
          <ul className="tense-form" lang="en">
            {t.form.map((f, j) => (
              <li key={j}>
                <span className="tense-sign" aria-label={['Khẳng định', 'Phủ định', 'Câu hỏi'][j]}>
                  {SIGNS[j]}
                </span>
                {f}
              </li>
            ))}
          </ul>
          <p>
            <b>Dùng khi:</b> {t.use}
          </p>
          <p className="muted small">
            <b>Dấu hiệu:</b> <span lang="en">{t.signals}</span>
          </p>
          <p className="tense-ex">
            <span lang="en">{t.ex[0]}</span>
            <span className="muted">{t.ex[1]}</span>
          </p>
          <button type="button" className="link-btn" onClick={() => onOpenPoint(t.point)}>
            Xem chi tiết →
          </button>
        </article>
      ))}
    </div>
  );
}

function Backshift({ data, onOpenPoint }) {
  return (
    <>
      <p className="muted small">Khi động từ tường thuật ở quá khứ (said, told, asked…), lùi thì và đổi từ chỉ thời gian, nơi chốn.</p>
      <div className="ref-table-wrap">
        <table className="ref-table">
          <thead>
            <tr>
              <th>Lời nói trực tiếp</th>
              <th>Câu tường thuật</th>
              <th>Ví dụ</th>
            </tr>
          </thead>
          <tbody>
            {data.tenses.map(([from, to, direct, reported]) => (
              <tr key={from}>
                <td lang="en">{from}</td>
                <td lang="en">
                  <b>{to}</b>
                </td>
                <td lang="en">
                  {direct}
                  <br />→ {reported}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ref-table-wrap">
        <table className="ref-table">
          <thead>
            <tr>
              <th>Trực tiếp</th>
              <th>Tường thuật</th>
            </tr>
          </thead>
          <tbody>
            {data.words.map(([from, to]) => (
              <tr key={from}>
                <td lang="en">{from}</td>
                <td lang="en">
                  <b>{to}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="link-btn" onClick={() => onOpenPoint(data.point)}>
        Xem điểm ngữ pháp câu tường thuật →
      </button>
    </>
  );
}

export default function EnReference({ onOpenPoint, onUnauthorized }) {
  const [state, setState] = useState(() => (cache ? { data: cache } : {}));
  useEffect(() => {
    if (cache) return;
    let live = true;
    getJson('/data/en/reference.json').then(
      (data) => {
        cache = data;
        if (live) setState({ data });
      },
      (e) => {
        if (!live) return;
        if (e.message === UNAUTHORIZED) onUnauthorized?.();
        else setState({ error: 'Không tải được bảng tra cứu.' });
      },
    );
    return () => {
      live = false;
    };
  }, [onUnauthorized]);

  if (state.error) return <p className="error">{state.error}</p>;
  if (!state.data) return <p className="loading">Đang tải…</p>;
  const { verbs, tenses, backshift } = state.data;
  return (
    <div className="en-reference">
      <Disclosure title="Động từ bất quy tắc" lang="vi" sub={`${verbs.length} động từ thường gặp · V1 – V2 – V3`} defaultOpen>
        <Verbs verbs={verbs} />
      </Disclosure>
      <Disclosure title="12 thì tiếng Anh" lang="vi" sub="Công thức, cách dùng, dấu hiệu nhận biết">
        <Tenses tenses={tenses} onOpenPoint={onOpenPoint} />
      </Disclosure>
      <Disclosure title="Lùi thì trong câu tường thuật" lang="vi" sub="Thì và từ chỉ thời gian, nơi chốn">
        <Backshift data={backshift} onOpenPoint={onOpenPoint} />
      </Disclosure>
    </div>
  );
}
