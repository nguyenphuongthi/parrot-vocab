// Câu giao tiếp tiếng Hàn theo tình huống. Mặc định ẩn nghĩa để tự đoán trước; bấm vào câu để hiện.
import { useEffect, useState } from 'react';
import { useKo, KoSpeak } from './KoWords.jsx';
import { MarkButton, MarkFilter } from '../components/Mark.jsx';
import { itemKey, setMark, useLangItems } from '../lib/store.js';
import { markOf } from '../lib/srs.js';
import { usePersisted } from '../lib/usePersisted.js';
import { useKaraoke } from '../lib/speech.js';
import { getSettings } from '../lib/settings.js';

function Phrase({ e, mark, revealAll, index }) {
  const [open, setOpen] = useState(false);
  const shown = open || revealAll;
  // Mở câu / bấm nghe: câu sáng dần từng âm tiết theo giọng đọc
  const [ka, playKa] = useKaraoke();
  const play = () => playKa(e.ko, 'ko-KR', { rate: 0.85 });
  useEffect(() => {
    if (open && getSettings().autoPlay) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <li style={{ '--i': index }} className={`card phrase ${shown ? 'is-open' : ''}`}>
      <MarkButton value={mark} onChange={(v) => setMark('items', itemKey('ko', e.id), v)} label={e.ko} />
      <button type="button" className="phrase-main" aria-expanded={shown} onClick={() => setOpen((o) => !o)}>
        <span className="phrase-ko" lang="ko">
          {ka < 0
            ? e.ko
            : [...e.ko].map((c, i) => (
                <span key={i} className={`ka-char ${i < ka ? 'ka-on' : ''} ${i === ka ? 'ka-now' : ''}`}>
                  {c}
                </span>
              ))}
        </span>
        <span className="phrase-rr">{e.rr}</span>
        {shown && (
          <span className="phrase-more">
            {e.pron && (
              <span className="phrase-pron" lang="ko">
                Đọc: [{e.pron}]
              </span>
            )}
            <span className="phrase-vi">{e.vi}</span>
            {e.note && <span className="phrase-note">{e.note}</span>}
          </span>
        )}
      </button>
      <KoSpeak text={e.ko} label="Nghe câu" onPlay={play} />
    </li>
  );
}

export default function KoPhrases() {
  const data = useKo();
  const progress = useLangItems('ko');
  const [revealAll, setRevealAll] = usePersisted('ko.phrases.reveal', false);
  const [situation, setSituation] = usePersisted('ko.phrases.situation', 'greeting');
  const [filter, setFilter] = useState(null);
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
      </div>
      <ul className={`phrases tone-${data.situations.indexOf(current) % 8}`}>
        {items.map((e, i) => (
          <Phrase key={e.id} index={i} e={e} mark={markOf(progress[e.id])} revealAll={revealAll} />
        ))}
      </ul>
      <footer className="foot">
        Đuôi <span lang="ko">-요</span>: lịch sự thân thiện, dùng hằng ngày. Đuôi <span lang="ko">-습니다 / -ㅂ니다</span>: trang
        trọng (công việc, thông báo). Đuôi không có <span lang="ko">-요</span>: thân mật, chỉ dùng với bạn bè thân hoặc người nhỏ tuổi
        hơn.
      </footer>
    </>
  );
}
