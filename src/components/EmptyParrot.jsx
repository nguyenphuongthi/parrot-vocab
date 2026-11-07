// Minh hoạ chú vẹt cho trạng thái trống:
//   hammock – nằm võng ngủ (đã ôn hết) · book – đọc sách (chưa có từ) · search – cầm kính lúp (không tìm thấy)
import { MASCOT_SVG } from './mascot.js';

const Mascot = ({ x, y, s = 1, flip = false }) => (
  <g
    transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}
    dangerouslySetInnerHTML={{ __html: MASCOT_SVG.replace('class="m-bubble"', 'class="m-bubble" style="display:none"') }}
  />
);

export default function EmptyParrot({ kind = 'hammock', children }) {
  return (
    <div className="empty-parrot">
      <svg width="140" height="100" viewBox="0 0 120 90" aria-hidden="true">
        {kind === 'hammock' && (
          <>
            <path d="M8 86V18M112 86V18" stroke="#c99a5b" strokeWidth="4" strokeLinecap="round" />
            <g className="hammock">
              <path d="M10 22C30 60 90 60 110 22" stroke="#f3a3b5" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M14 26C34 58 86 58 106 26" stroke="#ffd36b" strokeWidth="3" fill="none" strokeDasharray="4 5" />
              <g transform="rotate(-70 60 40)">
                <Mascot x={34} y={14} s={0.62} />
              </g>
            </g>
            <text x="76" y="18" className="empty-zzz" fontSize="12">
              z Z
            </text>
          </>
        )}
        {kind === 'book' && (
          <>
            <Mascot x={30} y={10} s={0.9} />
            <g transform="translate(48 50)">
              <path d="M0 6l14-4l14 4v22l-14-4l-14 4z" fill="#fff" stroke="#9aa8f7" strokeWidth="2" strokeLinejoin="round" />
              <path className="book-page" d="M14 2v22l14 4V6z" fill="#e6ebff" stroke="#9aa8f7" strokeWidth="2" strokeLinejoin="round" style={{ transformOrigin: '14px 14px' }} />
              <path d="M4 12h7M4 16h7M17 12h7" stroke="#c9d0f5" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </>
        )}
        {kind === 'search' && (
          <>
            <Mascot x={24} y={14} s={0.85} />
            <g className="glass" style={{ transformOrigin: '86px 46px' }}>
              <circle cx="86" cy="40" r="11" fill="rgb(255 255 255 / 60%)" stroke="#8a6a44" strokeWidth="3.5" />
              <path d="M94 48l10 10" stroke="#8a6a44" strokeWidth="4.5" strokeLinecap="round" />
            </g>
          </>
        )}
      </svg>
      {children}
    </div>
  );
}
