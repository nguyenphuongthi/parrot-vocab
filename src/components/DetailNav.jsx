import { useEffect, useRef, useState } from 'react';

// Khu vực đang được chọn gần nhất: phím ← → chỉ điều khiển khung chi tiết của khu vực này
// (có thể mở nhiều cấp/bài cùng lúc, mỗi nơi một khung chi tiết).
let owner = null;

// Hướng của lần chuyển gần nhất (-1 trước, 1 tiếp, 0 bấm trực tiếp) để khung mới trượt vào đúng phía.
let pendingDir = 0;

function go(dir, fn) {
  if (!fn) return;
  pendingDir = dir;
  fn();
}

// Phím tắt cho khung chi tiết: Esc đóng, ← → sang mục trước/sau.
export function useDetailKeys(selectedId, { onPrev, onNext, onClose }) {
  const token = useRef(null);
  if (!token.current) token.current = {};
  const handlers = useRef();
  handlers.current = { onPrev, onNext, onClose };

  useEffect(() => {
    if (selectedId === null) return;
    const me = token.current;
    owner = me;
    const onKey = (e) => {
      const h = handlers.current;
      if (e.key === 'Escape') {
        h.onClose();
        return;
      }
      if (owner !== me || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest?.('input, textarea, select, [role="slider"], [contenteditable="true"]')) return;
      const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const fn = dir < 0 ? h.onPrev : dir > 0 ? h.onNext : null;
      if (!fn) return;
      e.preventDefault();
      go(dir, fn);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);
}

// Gắn vào khung chi tiết: vuốt trái/phải để chuyển, cuộn tới khung khi mở,
// trả về lớp CSS cho hiệu ứng trượt vào.
export function useDetailCard(ref, { onPrev, onNext }) {
  const [dir] = useState(() => {
    const d = pendingDir;
    pendingDir = 0;
    return d;
  });
  const handlers = useRef();
  handlers.current = { onPrev, onNext };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!dir) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    // Chuyển bằng nút/vuốt: đưa đầu khung vào tầm nhìn nếu đang bị khuất.
    const r = el.getBoundingClientRect();
    if (r.top < 64 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [ref, dir]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = null;
    const reset = () => {
      el.style.transition = '';
      el.style.transform = '';
    };
    const start = (e) => {
      s = null;
      if (e.touches.length !== 1 || e.target.closest('[role="slider"], input, textarea')) return;
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY, lock: null, dx: 0 };
    };
    const move = (e) => {
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (s.lock === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        s.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      }
      if (s.lock !== 'x') return;
      s.dx = dx;
      // Hết mục ở phía đó thì chỉ nhích nhẹ để báo không chuyển được.
      const can = dx < 0 ? handlers.current.onNext : handlers.current.onPrev;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx * (can ? 0.5 : 0.12)}px)`;
    };
    const end = () => {
      if (!s) return;
      const { lock, dx } = s;
      s = null;
      reset();
      if (lock !== 'x' || Math.abs(dx) < 60) return;
      if (dx < 0) go(1, handlers.current.onNext);
      else go(-1, handlers.current.onPrev);
    };
    const cancel = () => {
      s = null;
      reset();
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', cancel);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [ref]);

  return dir < 0 ? 'enter-prev' : dir > 0 ? 'enter-next' : '';
}

const Chevron = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);
const LEFT = 'm15 6-6 6 6 6';
const RIGHT = 'm9 6 6 6-6 6';

// Góc phải đầu khung: vị trí hiện tại và nút đóng.
export default function DetailNav({ pos, total, noun, onClose }) {
  return (
    <div className="detail-nav">
      <span className="nav-pos" aria-label={`${noun} ${pos} trên ${total}`}>
        {pos}/{total}
      </span>
      <button type="button" className="icon-btn close" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

// Nút chuyển lớn: hai bên mép khung trên máy tính, thanh dưới đáy khung trên điện thoại.
export function DetailPager({ pos, total, noun, onPrev, onNext }) {
  const prev = { onClick: () => go(-1, onPrev), disabled: !onPrev, 'aria-label': `${noun} trước` };
  const next = { onClick: () => go(1, onNext), disabled: !onNext, 'aria-label': `${noun} tiếp theo` };
  return (
    <>
      <div className="pager-rail prev">
        <button type="button" className="pager-btn" title={`${noun} trước (←)`} {...prev}>
          <Chevron d={LEFT} />
        </button>
      </div>
      <div className="pager-rail next">
        <button type="button" className="pager-btn" title={`${noun} tiếp theo (→)`} {...next}>
          <Chevron d={RIGHT} />
        </button>
      </div>
      <div className="pager-bar">
        <button type="button" className="pager-btn" {...prev}>
          <Chevron d={LEFT} />
          Trước
        </button>
        <span className="nav-pos">
          {pos}/{total}
        </span>
        <button type="button" className="pager-btn" {...next}>
          Tiếp
          <Chevron d={RIGHT} />
        </button>
      </div>
    </>
  );
}
