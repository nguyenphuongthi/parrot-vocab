// Flashcard – ôn tập ngắt quãng, dùng chung cho cả 3 ngôn ngữ (chuyển từ bản tiếng Anh cũ).
//   Chấm "Chưa thuộc" → ôn lại ngày mai (và gặp lại sau vài thẻ trong lượt này)
//   "Hơi nhớ" → ≥ 3 ngày (tăng chậm) · "Đã thuộc" → ≥ 7 ngày rồi ×2,5 mỗi lần (tối đa 180 ngày)
import { useEffect, useMemo, useRef, useState } from 'react';
import { DECK_HOOKS, MODES, normalizeAnswer } from './adapters.jsx';
import GoalBar from '../../components/ui/GoalBar.jsx';
import { MARK_EMOJI, MarkGlyph } from '../../components/ui/Mark.jsx';
import { SpeakerIcon } from '../../components/ui/Icons.jsx';
import { gradeCard, practiceCard } from '../../lib/store.js';
import { DAY, STATES, dueAt, isDue, markOf, startOfDay } from '../../lib/srs.js';
import { updateDeck, useSettings } from '../../lib/settings.js';
import { emitFx } from '../../lib/events.js';
import Logo from '../../components/mascot/Logo.jsx';
import EmptyParrot from '../../components/mascot/EmptyParrot.jsx';
import HugParrot from '../../components/mascot/HugParrot.jsx';
import LevelPet from '../../components/mascot/LevelPet.jsx';

const EXTRA_SIZE = 20;
const RECENT_DAYS = 7;
const SWIPE_MIN = 80;

const SOURCES = [
  ['due', 'Cần ôn hôm nay'],
  ['new', 'Học từ mới'],
  ['recent', `Mới học ${RECENT_DAYS} ngày qua`],
  ['lapses', 'Từ hay quên'],
  ['marks', 'Theo mức thuộc'],
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const inScope = (c, scope) => scope === 'all' || c.scopes.has(scope);

function selectCards(cards, s, now = Date.now()) {
  const pool = cards.filter((c) => inScope(c, s.scope));
  switch (s.source) {
    case 'new': {
      const fresh = pool.filter((c) => !c.entry).sort((a, b) => a.order - b.order).slice(0, s.newCount);
      return s.order === 'random' ? shuffle(fresh) : fresh;
    }
    case 'recent':
      return order(pool.filter((c) => (c.entry?.addedAt || 0) >= now - RECENT_DAYS * DAY), s.order);
    case 'lapses': {
      const list = pool.filter((c) => (c.entry?.srs?.lapses || 0) > 0);
      return s.order === 'random' ? shuffle(list) : list.sort((a, b) => b.entry.srs.lapses - a.entry.srs.lapses);
    }
    case 'marks':
      return order(pool.filter((c) => s.states.includes(markOf(c.entry))), s.order);
    default:
      return order(pool.filter((c) => c.entry && isDue(c.entry, now)), s.order);
  }
}

function order(list, how) {
  return how === 'random' ? shuffle(list) : [...list].sort((a, b) => a.order - b.order);
}

// Ôn thêm: bốc ngẫu nhiên có trọng số (Efraimidis–Spirakis), ưu tiên từ yếu (mức thấp, hay quên)
function extraPick(cards, scope) {
  return cards
    .filter((c) => c.entry && inScope(c, scope))
    .map((c) => ({ key: c.key, rank: Math.random() ** (1 / (3 - markOf(c.entry) + Math.min(c.entry.srs?.lapses || 0, 5))) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, EXTRA_SIZE)
    .map((x) => x.key);
}

function choiceOptions(card, cards) {
  const norm = (s) => (s || '').trim().toLowerCase();
  const seen = new Set([norm(card.meaning)]);
  const same = (c) => [...c.scopes].some((s) => card.scopes.has(s));
  const others = shuffle(cards.filter((c) => c.key !== card.key && norm(c.meaning)));
  const picked = [];
  for (const c of [...others.filter(same), ...others.filter((c) => !same(c))]) {
    if (picked.length === 3) break;
    if (seen.has(norm(c.meaning))) continue;
    seen.add(norm(c.meaning));
    picked.push(c.meaning);
  }
  return picked.length ? shuffle([card.meaning, ...picked]) : [];
}

const canAutoPlay = () => navigator.userActivation?.hasBeenActive !== false;

export default function Flashcards({ lang }) {
  const data = DECK_HOOKS[lang]();
  const settings = useSettings();
  const s = settings.deck[lang];
  const byKey = useMemo(() => new Map(data.cards.map((c) => [c.key, c])), [data.cards]);
  const cardsRef = useRef(data.cards);
  cardsRef.current = data.cards;

  const [deck, setDeck] = useState({ run: 0, step: 0, extra: false, queue: [], total: 0, done: 0, results: new Map() });
  const [face, setFace] = useState({ flipped: false, checked: false, choices: [], mode: s.mode, result: null, typed: '' });
  const cardRef = useRef(null);
  const swipe = useRef(null);
  const [drag, setDrag] = useState(0);
  const [burst, setBurst] = useState(0);
  const swallowClick = useRef(false);

  const source = !data.hasNew && s.source === 'new' ? 'due' : s.source;
  const settingsKey = JSON.stringify([source, s.mode, s.scope, s.states, s.order, s.newCount]);

  const begin = (keys, extra) =>
    setDeck((d) => ({ run: d.run + 1, step: 0, extra, queue: keys, total: keys.length, done: 0, results: new Map() }));

  // Bắt đầu lượt mới khi dữ liệu sẵn sàng hoặc đổi lựa chọn (không phải mỗi lần chấm thẻ)
  useEffect(() => {
    if (!data.ready) return;
    begin(selectCards(cardsRef.current, { ...s, source }).map((c) => c.key), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ready, settingsKey]);

  const queue = deck.queue.filter((k) => byKey.has(k));
  const card = byKey.get(queue[0]);

  // Thẻ mới hiện ra: chuẩn bị mặt trước, tự phát âm nếu kiểu ôn không làm lộ đáp án
  const cardKey = card?.key;
  useEffect(() => {
    if (!card) return;
    const choices = s.mode === 'choice' ? choiceOptions(card, cardsRef.current) : [];
    const mode = s.mode === 'choice' && !choices.length ? 'front' : s.mode;
    setFace({ flipped: false, checked: false, choices, mode, result: null, typed: '' });
    cardRef.current?.focus({ preventScroll: true });
    if (canAutoPlay() && (mode === 'listen' || ((mode === 'front' || mode === 'choice') && settings.autoPlay))) card.speak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, deck.step, deck.run]);

  const flip = () => {
    if ((face.mode === 'type' || face.mode === 'choice') && !face.checked) return;
    setFace((f) => {
      const flipped = !f.flipped;
      if (flipped && (f.mode === 'back' || f.mode === 'listen' || f.mode === 'type') && settings.autoPlay) card?.speak();
      return { ...f, flipped };
    });
  };

  const showResult = (correct, html) =>
    setFace((f) => ({ ...f, checked: true, flipped: true, result: { correct, html } }));

  const submitTyped = (e) => {
    e.preventDefault();
    if (!card || face.checked) return;
    const typed = face.typed.trim();
    const answer = normalizeAnswer(lang, typed);
    const correct = !!answer && card.answers.includes(answer);
    const expected = lang === 'zh' ? `${card.raw.py} (${card.word})` : card.word;
    showResult(correct, correct ? ['✓ Chính xác', typed] : ['✗ Bạn gõ', typed || '(trống)', expected]);
    if (settings.autoPlay) card.speak();
  };

  const pickChoice = (i) => {
    if (!card || face.checked || face.choices[i] === undefined) return;
    const correct = face.choices[i] === card.meaning;
    setFace((f) => ({ ...f, picked: i }));
    showResult(correct, correct ? ['✓ Chính xác', card.meaning] : ['✗ Bạn chọn', face.choices[i], card.meaning]);
  };

  const grade = (mark) => {
    if (!card) return;
    const [key, ...rest] = queue;
    const results = new Map(deck.results);
    if (!results.has(key)) results.set(key, mark);
    const nextQueue = mark === 0 ? [...rest.slice(0, 3), key, ...rest.slice(3)] : rest;
    setDeck((d) => ({ ...d, step: d.step + 1, queue: nextQueue, done: d.done + (mark === 0 ? 0 : 1), results }));
    // Lượt ôn thêm: nhớ thì chỉ ghi nhận đã ôn (không đẩy lịch xa hơn); quên thì vẫn ghi để ôn lại sớm
    if (deck.extra && mark !== 0) practiceCard(card.table, key);
    else gradeCard(card.table, key, mark);
    if (mark === 2) setBurst((b) => b + 1); // pháo giấy khi "Đã thuộc"
    if (mark !== 1) emitFx(mark === 2 ? 'happy' : 'sad'); // chú vẹt mừng / gãi đầu
  };

  // Phím tắt
  useEffect(() => {
    const onKey = (e) => {
      if (!card || e.target.matches?.('input, select, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        flip();
      } else if (face.mode === 'choice' && !face.checked) {
        if (['1', '2', '3', '4'].includes(e.key)) pickChoice(Number(e.key) - 1);
      } else if (['1', '2', '3'].includes(e.key) && (face.flipped || face.mode === 'front' || face.mode === 'back' || face.mode === 'listen')) {
        grade(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Điện thoại: thẻ đã lật thì vuốt trái = Chưa thuộc, vuốt phải = Đã thuộc
  const onPointerDown = (e) => {
    swallowClick.current = false;
    swipe.current = e.pointerType === 'touch' && e.isPrimary ? { x: e.clientX, dx: 0 } : null;
  };
  const onPointerMove = (e) => {
    if (!swipe.current || !face.flipped) return;
    swipe.current.dx = e.clientX - swipe.current.x;
    setDrag(swipe.current.dx);
  };
  const onPointerUp = () => {
    const dx = swipe.current?.dx || 0;
    swipe.current = null;
    setDrag(0);
    if (!face.flipped || Math.abs(dx) < SWIPE_MIN) return;
    swallowClick.current = true;
    setTimeout(() => (swallowClick.current = false), 400);
    grade(dx < 0 ? 0 : 2);
  };

  if (data.error) return <p className="error">Không tải được dữ liệu: {data.error}</p>;
  if (!data.ready) return <p className="loading">Đang tải…</p>;

  const modes = MODES[lang];
  const sources = SOURCES.filter(([id]) => id !== 'new' || data.hasNew);
  const counts = { all: data.cards.length };
  const studied = data.cards.filter((c) => c.entry).length;

  const doneMessage = () => {
    const summary = deck.results.size ? <Summary results={deck.results} byKey={byKey} onRedo={(keys) => begin(shuffle(keys), true)} /> : null;
    const pool = data.cards.filter((c) => c.entry && inScope(c, s.scope)).length;
    const extraBtn = pool > 0 && (
      <button type="button" className="btn primary" onClick={() => begin(extraPick(data.cards, s.scope), true)}>
        🎲 Ôn thêm {Math.min(EXTRA_SIZE, pool)} từ (ưu tiên từ yếu)
      </button>
    );
    const newBtn = data.hasNew && source !== 'new' && (
      <button type="button" className="btn" onClick={() => updateDeck(lang, { source: 'new' })}>
        ✨ Học {s.newCount} từ mới
      </button>
    );
    let text;
    if (deck.extra) text = `🎉 Bạn đã ôn thêm ${deck.total} từ!`;
    else if (source === 'due') {
      const next = data.cards
        .filter((c) => c.entry)
        .map((c) => dueAt(c.entry))
        .filter((t) => t >= startOfDay(Date.now()) + DAY)
        .sort((a, b) => a - b)[0];
      text = deck.total ? `Bạn đã ôn xong ${deck.total} thẻ cần ôn hôm nay 🎉` : 'Hôm nay không còn thẻ nào cần ôn 🎉';
      if (next) text += ` Lượt ôn tiếp theo: ${new Date(next).toLocaleDateString('vi-VN')}.`;
      if (!studied && data.hasNew) text = 'Bạn chưa học từ nào ở ngôn ngữ này – bắt đầu với vài từ mới nhé.';
    } else if (source === 'new') text = deck.total ? `🎉 Bạn đã học ${deck.total} từ mới!` : 'Không còn từ mới trong phạm vi này.';
    else if (source === 'marks' && !s.states.length) text = 'Hãy chọn ít nhất một mức để ôn.';
    else if (deck.total) text = `🎉 Bạn đã ôn xong ${deck.total} thẻ!`;
    else if (source === 'lapses') text = 'Chưa có từ nào bị quên 👍';
    else text = 'Không có thẻ nào khớp lựa chọn.';
    return (
      <div className="deck-done">
        {summary || <EmptyParrot kind={!studied && data.hasNew ? 'book' : 'hammock'} />}
        <p>{text}</p>
        <div className="deck-done-actions">
          {source === 'new' && deck.total > 0 && (
            <button type="button" className="btn primary" onClick={() => begin(selectCards(data.cards, { ...s, source }).map((c) => c.key), false)}>
              ✨ Học tiếp {s.newCount} từ
            </button>
          )}
          {source !== 'new' && newBtn}
          {(source === 'due' || deck.extra) && extraBtn}
          {!deck.extra && source !== 'due' && source !== 'new' && deck.total > 0 && (
            <button type="button" className="btn" onClick={() => begin(selectCards(data.cards, { ...s, source }).map((c) => c.key), false)}>
              Ôn lại
            </button>
          )}
        </div>
      </div>
    );
  };

  const markNow = card ? markOf(card.entry) : 0;
  const Prompt = card?.Prompt;
  const Back = card?.Back;

  return (
    <div className="review">
      <GoalBar />

      <div className="deck-controls">
        <label>
          <span>Nguồn</span>
          <select value={source} onChange={(e) => updateDeck(lang, { source: e.target.value })}>
            {sources.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Kiểu ôn</span>
          <select value={s.mode} onChange={(e) => updateDeck(lang, { mode: e.target.value })}>
            {modes.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Phạm vi</span>
          <select value={s.scope} onChange={(e) => updateDeck(lang, { scope: e.target.value })}>
            <option value="all">
              {data.scopeLabel} ({counts.all})
            </option>
            {data.scopes.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label} ({sc.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Thứ tự</span>
          <select value={s.order} onChange={(e) => updateDeck(lang, { order: e.target.value })}>
            <option value="random">Xáo trộn</option>
            <option value="list">{lang === 'en' ? 'Mới lưu trước' : 'Theo danh sách'}</option>
          </select>
        </label>
        {source === 'new' && (
          <label>
            <span>Số từ mới</span>
            <select value={s.newCount} onChange={(e) => updateDeck(lang, { newCount: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} từ
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {source === 'marks' && (
        <div className="mark-filter deck-states">
          {STATES.map((st) => {
            const on = s.states.includes(st.value);
            return (
              <button
                key={st.value}
                type="button"
                className={`chip ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  updateDeck(lang, { states: on ? s.states.filter((v) => v !== st.value) : [...s.states, st.value].sort() })
                }
              >
                <MarkGlyph value={st.value} size={14} />
                <span className="chip-label">{st.label.toLowerCase()}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="deck-progress">
        {deck.total > 0 &&
          (deck.extra
            ? `🎲 Ôn thêm ${deck.done}/${deck.total}`
            : `Đã ôn ${deck.done}/${deck.total}`)}
      </p>

      {!card ? (
        doneMessage()
      ) : (
        <>
          <div key={`${deck.run}-${deck.step}`} className={`fc-hug ${face.flipped ? 'is-open' : ''} ${drag ? 'is-dragging' : ''}`}>
            <HugParrot open={face.flipped} onClick={flip} />
            <div
              ref={cardRef}
              tabIndex={-1}
              className={`flashcard ${face.flipped ? 'is-flipped' : ''} ${drag <= -SWIPE_MIN ? 'swipe-0' : drag >= SWIPE_MIN ? 'swipe-2' : ''}`}
              style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 40}deg)`, transition: 'none' } : undefined}
              onClick={(e) => {
                if (swallowClick.current || e.target.closest('button, a, input, form, select')) return;
                flip();
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => ((swipe.current = null), setDrag(0))}
            >
              <div className="fc-top">
                <span className="fc-mark">
                  <MarkGlyph value={markNow} size={14} /> {card.entry ? STATES[markNow].label : 'Từ mới'}
                </span>
                <LevelPet level={card.level} />
                <button type="button" className="icon-btn" onClick={() => card.speak()} aria-label="Nghe" title="Nghe">
                  <SpeakerIcon size={18} />
                </button>
              </div>

              {!face.flipped ? (
                <div className="fc-front">
                  {face.mode === 'front' && <Prompt card={card} />}
                  {face.mode === 'choice' && (
                    <>
                      <Prompt card={card} />
                      <div className="choices">
                        {face.choices.map((t, i) => (
                          <button key={i} type="button" className="choice" onClick={() => pickChoice(i)}>
                            <kbd>{i + 1}</kbd>
                            <span>{t}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {face.mode === 'listen' && (
                    <button type="button" className="listen-btn" onClick={() => card.speak()} aria-label="Nghe lại">
                      <SpeakerIcon size={40} />
                    </button>
                  )}
                  {face.mode === 'back' && <div className="fc-meaning">{card.meaning}</div>}
                  {face.mode === 'type' && (
                    <>
                      {lang === 'zh' ? <Prompt card={card} /> : <div className="fc-meaning">{card.meaning}</div>}
                      <form className="fc-type" onSubmit={submitTyped}>
                        <input
                          autoFocus
                          value={face.typed}
                          onChange={(e) => setFace((f) => ({ ...f, typed: e.target.value }))}
                          placeholder={lang === 'zh' ? 'pinyin, vd. nihao' : lang === 'ko' ? '한국어' : 'English'}
                          lang={lang === 'ko' ? 'ko' : 'en'}
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck="false"
                        />
                        <button type="submit" className="btn primary">
                          Kiểm tra
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <div className="fc-back">
                  {face.result && (
                    <p className={`fc-result ${face.result.correct ? 'is-correct' : 'is-wrong'}`}>
                      {face.result.html[0]}: {face.result.html.length > 2 ? <s>{face.result.html[1]}</s> : <b>{face.result.html[1]}</b>}
                      {face.result.html.length > 2 && (
                        <>
                          {' '}
                          → đáp án: <b>{face.result.html[2]}</b>
                        </>
                      )}
                    </p>
                  )}
                  <Back card={card} />
                </div>
              )}
            </div>
          </div>

          <div className="grades" role="group" aria-label="Chấm điểm thẻ">
            {burst > 0 && <Confetti key={burst} />}
            {STATES.map((st) => (
              <button
                key={st.value}
                type="button"
                className={`grade g-${st.value} ${face.result && (face.result.correct ? 2 : 0) === st.value ? 'suggest' : ''}`}
                onClick={() => grade(st.value)}
                disabled={(face.mode === 'type' || face.mode === 'choice') && !face.checked}
                aria-label={`${st.label} (phím ${st.value + 1})`}
                title={`${st.label} – phím ${st.value + 1}`}
              >
                <span className="grade-emoji" aria-hidden="true">
                  {MARK_EMOJI[st.value]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Pháo giấy nhỏ bắn lên từ nút "Đã thuộc"
const CONFETTI_COLORS = ['#ff9f88', '#8fa0f5', '#5fcbae', '#ffd36b', '#f6a5c0'];
function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i
          key={i}
          style={{
            '--a': `${-170 + (i * 160) / 15}deg`,
            '--d': `${70 + (i % 4) * 22}px`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 3) * 30}ms`,
          }}
        />
      ))}
    </span>
  );
}

// Đếm tăng dần từ 0 tới n
function CountUp({ n, ms = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!n) return setV(0);
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(n * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}

// Tổng kết cuối lượt: chú vẹt giơ bảng, số đếm tăng dần, thanh 3 mức mọc lên
function Summary({ results, byKey, onRedo }) {
  const counts = [0, 0, 0];
  results.forEach((m) => counts[m]++);
  const total = results.size || 1;
  const forgotten = [...results].filter(([k, m]) => m === 0 && byKey.has(k)).map(([k]) => k);
  const headline = counts[2] ? `+${counts[2]} từ đã thuộc` : counts[1] ? `+${counts[1]} từ hơi nhớ` : 'Cố lên nhé!';
  return (
    <div className="deck-summary">
      <div className="summary-hero">
        <Logo size={64} />
        <span className="sign">{headline}</span>
      </div>
      <div className="summary-bars">
        {[2, 1, 0].map((m) => (
          <div key={m} className={`summary-bar m${m}`} title={STATES[m].label}>
            <span aria-hidden="true">{MARK_EMOJI[m]}</span>
            <span className="track">
              <span style={{ width: `${(counts[m] / total) * 100}%`, animationDelay: `${(2 - m) * 150}ms` }} />
            </span>
            <b>
              <CountUp n={counts[m]} />
            </b>
          </div>
        ))}
      </div>
      {forgotten.length > 0 && (
        <>
          <p className="summary-forgot">
            Vừa quên:{' '}
            {forgotten.map((k, i) => (
              <span key={k}>
                {i > 0 && ', '}
                <b lang={byKey.get(k).wordLang}>{byKey.get(k).word}</b>
              </span>
            ))}
          </p>
          <button type="button" className="btn" onClick={() => onRedo(forgotten)}>
            🔁 Ôn lại {forgotten.length} từ vừa quên
          </button>
        </>
      )}
    </div>
  );
}
