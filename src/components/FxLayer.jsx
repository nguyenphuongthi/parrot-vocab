// Hiệu ứng toàn trang: pháo giấy lớn (đạt mục tiêu ngày), thông báo huy hiệu, làn sóng chữ khi đổi
// ngôn ngữ, kéo để tải lại trên điện thoại, kính lúp lắc khi gõ tìm kiếm.
import { useEffect, useRef, useState } from 'react';
import { onFx } from '../lib/events.js';
import { syncNow } from '../lib/store.js';
import Logo from './Logo.jsx';

const COLORS = ['#ff9f88', '#8fa0f5', '#5fcbae', '#ffd36b', '#f6a5c0', '#b6a3ff'];

function BigConfetti() {
  return (
    <div className="big-confetti" aria-hidden="true">
      {Array.from({ length: 70 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 10) * 70}ms`,
            animationDuration: `${2 + (i % 5) * 0.3}s`,
            '--dx': `${((i % 7) - 3) * 30}px`,
            '--rot': `${(i % 2 ? 1 : -1) * (360 + (i % 4) * 180)}deg`,
          }}
        />
      ))}
    </div>
  );
}

const WAVE_GLYPHS = {
  en: ['A', 'b', 'Hi', 'Yes', 'c', 'Q', 'ok', 'w'],
  zh: ['你', '好', '学', '中', '文', '爱', '书', '月'],
  ko: ['가', '나', '한', '글', '봄', '꿈', '별', '말'],
};

function LangWave({ lang }) {
  const glyphs = WAVE_GLYPHS[lang] || WAVE_GLYPHS.en;
  return (
    <div className="lang-wave" aria-hidden="true">
      {glyphs.map((g, i) => (
        <i
          key={i}
          lang={lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko' : undefined}
          style={{ top: `${10 + i * 11}%`, left: `${(i * 13) % 40}%`, fontSize: 28 + (i % 3) * 14, animationDelay: `${i * 45}ms` }}
        >
          {g}
        </i>
      ))}
    </div>
  );
}

// Kéo trang xuống khi đang ở đầu trang (điện thoại): chú vẹt rơi xuống, thả ra để đồng bộ
const PULL_MAX = 110;
const PULL_READY = 70;

function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | pulling | ready | syncing | done
  const start = useRef(null);
  const phaseRef = useRef('idle');
  const go = (ph) => {
    phaseRef.current = ph;
    setPhase(ph);
  };

  useEffect(() => {
    const onStart = (e) => {
      if (window.scrollY > 0 || e.touches.length !== 1 || e.target.closest?.('.flashcard, input, textarea, select')) return;
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    };
    const onMove = (e) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        if (dy < 0) {
          start.current = null;
          setPull(0);
          go('idle');
        }
        return;
      }
      const d = Math.min(PULL_MAX, dy * 0.55);
      setPull(d);
      go(d >= PULL_READY ? 'ready' : 'pulling');
    };
    const onEnd = async () => {
      if (!start.current) return;
      start.current = null;
      if (phaseRef.current !== 'ready') {
        setPull(0);
        go('idle');
        return;
      }
      setPull(PULL_READY);
      go('syncing');
      await syncNow().catch(() => {});
      go('done');
      setTimeout(() => {
        setPull(0);
        go('idle');
      }, 700);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (phase === 'idle' && !pull) return null;
  const label = phase === 'ready' ? 'Thả ra để đồng bộ' : phase === 'syncing' ? 'Đang đồng bộ…' : phase === 'done' ? 'Xong!' : 'Kéo xuống để đồng bộ';
  return (
    <div className={`ptr is-${phase} ${phase === 'pulling' || phase === 'ready' ? 'is-pulling' : ''}`} style={{ '--pull': `${pull}px` }} role="status">
      <span className="ptr-bubble">
        <Logo size={38} animated={false} />
      </span>
      <span className="ptr-label">{label}</span>
    </div>
  );
}

export default function FxLayer({ lang }) {
  const [confetti, setConfetti] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [wave, setWave] = useState(null);
  const prevLang = useRef(lang);

  useEffect(
    () =>
      onFx((e) => {
        if (e.kind === 'goal') {
          setConfetti((n) => n + 1);
          setToasts((t) => [...t, { id: Date.now(), icon: '🎯', title: 'Đạt mục tiêu hôm nay!' }]);
        }
        if (e.kind === 'badge') setToasts((t) => [...t, { id: Date.now() + Math.random(), icon: e.icon, title: `Huy hiệu mới: ${e.title}` }]);
      }),
    [],
  );

  // Tự ẩn thông báo, pháo giấy
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((list) => list.slice(1)), 3600);
    return () => clearTimeout(t);
  }, [toasts]);
  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(0), 3200);
    return () => clearTimeout(t);
  }, [confetti]);

  // Đổi ngôn ngữ → làn sóng chữ của ngôn ngữ mới
  useEffect(() => {
    if (!lang || lang === prevLang.current) return;
    prevLang.current = lang;
    setWave({ lang, id: Date.now() });
    const t = setTimeout(() => setWave(null), 1200);
    return () => clearTimeout(t);
  }, [lang]);

  // Gõ vào ô tìm kiếm → kính lúp lắc nhẹ
  useEffect(() => {
    const onInput = (e) => {
      const svg = e.target.closest?.('.search')?.querySelector('svg');
      if (!svg) return;
      svg.classList.remove('is-typing');
      void svg.getBoundingClientRect(); // khởi động lại hiệu ứng
      svg.classList.add('is-typing');
    };
    document.addEventListener('input', onInput);
    return () => document.removeEventListener('input', onInput);
  }, []);

  return (
    <>
      {confetti > 0 && <BigConfetti key={confetti} />}
      {wave && <LangWave key={wave.id} lang={wave.lang} />}
      <PullToRefresh />
      {toasts.length > 0 && (
        <div className="toasts" role="status" aria-live="polite">
          {toasts.slice(0, 3).map((t) => (
            <div key={t.id} className="toast">
              <span className="toast-icon" aria-hidden="true">
                {t.icon}
              </span>
              <b>{t.title}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
