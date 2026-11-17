// Câu giao tiếp tiếng Nhật theo tình huống. Mặc định ẩn nghĩa để tự đoán trước; bấm vào câu để hiện.
import { useEffect, useState } from 'react';
import { useJa } from './data.js';
import { JA_VOICE, JaSpeak, Romaji, RomajiSwitch, Ruby } from './JaText.jsx';
import { MarkButton, MarkFilter } from '../../components/ui/Mark.jsx';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { markOf } from '../../lib/srs.js';
import { usePersisted } from '../../hooks/usePersisted.js';
import { useKaraoke } from '../../lib/speech.js';
import { getSettings } from '../../lib/settings.js';

function Phrase({ e, mark, revealAll, index }) {
  const [open, setOpen] = useState(false);
  const shown = open || revealAll;
  // Mở câu / bấm nghe: câu sáng dần từng chữ theo giọng đọc
  const [ka, playKa] = useKaraoke();
  const play = () => playKa(e.ja, JA_VOICE, { rate: 0.85 });
  useEffect(() => {
    if (open && getSettings().autoPlay) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <li style={{ '--i': index }} className={`card phrase ${shown ? 'is-open' : ''}`}>
      <MarkButton value={mark} onChange={(v) => setMark('items', itemKey('ja', e.id), v)} label={e.ja} />
      <button type="button" className="phrase-main" aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        <span className="phrase-ko phrase-ja" lang="ja">
          {ka < 0 ? (
            <Ruby text={e.text} />
          ) : (
            [...e.ja].map((c, i) => (
              <span key={i} className={`ka-char ${i < ka ? 'ka-on' : ''} ${i === ka ? 'ka-now' : ''}`}>
                {c}
              </span>
            ))
          )}
        </span>
        <Romaji rm={e.rm} className="phrase-rr" />
        {shown && (
          <span className="phrase-more">
            <span className="phrase-vi">{e.vi}</span>
            {e.note && <span className="phrase-note">{e.note}</span>}
          </span>
        )}
      </button>
      <JaSpeak text={e.ja} label="Nghe câu" onPlay={play} />
    </li>
  );
}

export default function JaPhrases({ onUnauthorized }) {
  const { data, error } = useJa(onUnauthorized);
  const progress = useLangItems('ja');
  const [revealAll, setRevealAll] = usePersisted('ja.phrases.reveal', false);
  const [situation, setSituation] = usePersisted('ja.phrases.situation', 'greeting');
  const [filter, setFilter] = useState(null);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading">Đang tải…</p>;
  const current = data.situations.find((s) => s.id === situation) || data.situations[0];
  const counts = [0, 0, 0];
  for (const e of current.items) counts[markOf(progress[e.id])]++;
  const items = filter === null ? current.items : current.items.filter((e) => markOf(progress[e.id]) === filter);

  return (
    <>
      <div className="pills" role="tablist" aria-label="Tình huống">
        {data.situations.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === current.id}
            className={`pill ${s.id === current.id ? 'is-on' : ''}`}
            onClick={() => (setSituation(s.id), setFilter(null))}
          >
            {s.name}
            <span className="pill-count">{s.items.length}</span>
          </button>
        ))}
      </div>
      <div className="filter-row">
        <MarkFilter counts={counts} active={filter} onPick={(v) => setFilter((f) => (f === v ? null : v))} />
        <label className="switch">
          <input type="checkbox" checked={revealAll} onChange={(e) => setRevealAll(e.target.checked)} />
          <span>Hiện nghĩa tất cả</span>
        </label>
        <RomajiSwitch />
      </div>
      <ul className={`phrases tone-${data.situations.indexOf(current) % 8}`}>
        {items.map((e, i) => (
          <Phrase key={e.id} index={i} e={e} mark={markOf(progress[e.id])} revealAll={revealAll} />
        ))}
      </ul>
      <footer className="foot">
        Đuôi <span lang="ja">です／ます</span>: lịch sự, dùng với người mới gặp, người lớn tuổi, ở cửa hàng, nơi làm việc. Thể thông
        thường (bỏ です／ます) chỉ dùng với bạn bè thân, gia đình. Tình huống tham khảo giáo trình いろどり 入門 và まるごと 入門 (Japan
        Foundation).
      </footer>
    </>
  );
}
