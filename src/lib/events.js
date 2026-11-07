// Kênh sự kiện nhỏ giữa các màn hình và chú vẹt / hiệu ứng toàn trang.
//   'happy'  – vừa chấm "Đã thuộc"        → vẹt vỗ cánh mừng
//   'sad'    – vừa chấm "Chưa thuộc"       → vẹt gãi đầu
//   'goal'   – vừa đạt mục tiêu ngày       → vẹt bay một vòng + pháo giấy lớn
//   'badge'  – mở khoá huy hiệu (detail: { title, icon })
const NAME = 'languages:fx';

export function emitFx(kind, detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NAME, { detail: { kind, ...detail } }));
}

export function onFx(fn) {
  const handler = (e) => fn(e.detail);
  window.addEventListener(NAME, handler);
  return () => window.removeEventListener(NAME, handler);
}
