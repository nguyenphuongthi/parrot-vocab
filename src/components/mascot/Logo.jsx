// Logo = linh vật chú vẹt (xem mascot.js). Không kèm chữ. animated: nhún nhẹ, chớp mắt, chấm thoại nhấp nháy.
import { MASCOT_SVG, MASCOT_VIEWBOX } from './mascot.js';

export default function Logo({ size = 38, animated = true }) {
  return (
    <svg
      className={`logo ${animated ? 'is-animated' : ''}`}
      width={size}
      height={size}
      viewBox={MASCOT_VIEWBOX}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: MASCOT_SVG }}
    />
  );
}

// Màn hình chờ: chú vẹt nhún nhảy
export function Loader({ label = 'Đang tải…' }) {
  return (
    <div className="loader" role="status" aria-label={label}>
      <Logo size={56} />
      <span className="loader-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
