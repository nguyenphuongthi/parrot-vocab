// Chuyển động: mức hiệu ứng (Cài đặt + "giảm chuyển động" của máy), hướng chuyển trang,
// giữ phần tử lại một nhịp khi đóng, thẻ flashcard bay ra, rung nhẹ trên điện thoại.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSettings } from './settings.js';

const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

const subscribeReduce = (fn) => {
  reduceQuery?.addEventListener('change', fn);
  return () => reduceQuery?.removeEventListener('change', fn);
};
const osReduces = () => !!reduceQuery?.matches;

// Cài đặt `motion`: auto | full | lite | off. "auto" = đầy đủ, hoặc "reduced" nếu máy bật giảm chuyển động.
export function resolveMotion(pref, reduce) {
  if (pref === 'full' || pref === 'lite' || pref === 'off') return pref;
  return reduce ? 'reduced' : 'full';
}

// Mức hiện tại (đọc từ <html data-motion>, do useApplyMotion đặt).
export function motionLevel() {
  return (typeof document !== 'undefined' && document.documentElement.dataset.motion) || 'full';
}

// Có chạy hiệu ứng chuyển động (dịch chuyển, phóng to) không – "reduced" chỉ còn mờ dần.
export const moves = () => {
  const m = motionLevel();
  return m === 'full' || m === 'lite';
};
// Có hiệu ứng gì không (kể cả mờ dần).
export const animates = () => motionLevel() !== 'off';

export function useMotionLevel() {
  const { motion } = useSettings();
  const reduce = useSyncExternalStore(subscribeReduce, osReduces, () => false);
  return resolveMotion(motion, reduce);
}

// Gắn mức hiệu ứng lên <html> để CSS chọn theo (gọi một lần ở App).
export function useApplyMotion() {
  const level = useMotionLevel();
  useEffect(() => {
    document.documentElement.dataset.motion = level;
  }, [level]);
  return level;
}

// ---------- Chuyển trang ----------
// Trang mới trượt vào từ phía của nó: 1 = trang ở bên phải (tab sau) → trượt từ phải, -1 → từ trái, 0 → chỉ hiện mờ dần.
// Không dùng View Transitions: trong lúc chuyển, Chrome dồn mọi cú bấm về <html> nên bấm nhanh sẽ bị mất.
export const pageEnterClass = (dir) => (dir > 0 ? 'from-right' : dir < 0 ? 'from-left' : '');

// ---------- Giữ phần tử lại khi đóng ----------
export const CLOSE_MS = 200;

// Khối mở / thu: trả về { mounted, closing } – vẫn hiển thị thêm CLOSE_MS sau khi đóng để chạy hiệu ứng thu lại.
export function usePresence(open, ms = CLOSE_MS) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!animates()) {
      setMounted(false);
      return;
    }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
}

// Mục đang chọn của một lưới / danh sách có khung chi tiết: close() cho khung thu lại rồi mới bỏ chọn.
export function useSelection() {
  const [id, setId] = useState(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const select = useCallback((next) => {
    clearTimeout(timer.current);
    setClosing(false);
    setId(next);
  }, []);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    if (!animates()) {
      setId(null);
      return;
    }
    setClosing(true);
    timer.current = setTimeout(() => {
      setClosing(false);
      setId(null);
    }, CLOSE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [id, select, close, closing];
}

// Vị trí ngang (%) của cột chứa mục đang chọn – khung chi tiết "mọc" ra từ đó.
export const originOf = (index, cols) => (index < 0 ? undefined : `${(((index % cols) + 0.5) / cols) * 100}%`);

// ---------- Flashcard ----------
// Thẻ vừa chấm bay ra theo hướng: -1 trái (chưa thuộc), 0 lên (hơi nhớ), 1 phải (đã thuộc).
// Dùng bản sao của thẻ nên không chặn thẻ tiếp theo hiện ra (chấm nhanh bằng phím vẫn mượt).
export function flyOut(el, dir) {
  if (!el || !animates() || typeof el.animate !== 'function') return;
  const host = el.closest('.app') || document.body;
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true);
  ghost.classList.add('fc-ghost');
  ghost.removeAttribute('tabindex');
  ghost.setAttribute('aria-hidden', 'true');
  // Bỏ phần xoay / dịch do vuốt để đặt đúng chỗ, rồi bay tiếp từ vị trí đang kéo.
  const from = el.style.transform || 'none';
  const box = { w: el.offsetWidth, h: el.offsetHeight };
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left + (rect.width - box.w) / 2}px`,
    top: `${rect.top + (rect.height - box.h) / 2}px`,
    width: `${box.w}px`,
    height: `${box.h}px`,
    margin: '0',
    transform: from,
    transition: 'none',
    pointerEvents: 'none',
    zIndex: '40',
  });
  host.appendChild(ghost);
  const to = !moves()
    ? from
    : dir < 0
      ? 'translateX(-70vw) rotate(-14deg)'
      : dir > 0
        ? 'translateX(70vw) rotate(14deg)'
        : 'translateY(-60px) scale(0.92)';
  const anim = ghost.animate(
    [
      { transform: from, opacity: 1 },
      { transform: to, opacity: 0 },
    ],
    { duration: moves() ? 380 : 200, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
  );
  const done = () => ghost.remove();
  anim.onfinish = done;
  anim.oncancel = done;
}

// Rung nhẹ (điện thoại Android). Không rung khi đã tắt hiệu ứng.
export function haptic(pattern = 10) {
  if (!animates()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* trình duyệt chặn rung */
  }
}
