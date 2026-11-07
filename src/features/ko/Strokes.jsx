// Vẽ chữ Hangul theo từng nét (đúng thứ tự viết). animate = false: hiện sẵn cả chữ.
// Đổi `playKey` để vẽ lại từ đầu.
import { useMemo } from 'react';
import { strokesOf } from './strokes.js';

export default function Strokes({ char, size = 52, animate = true, playKey = 0, step = 0.42, label }) {
  const strokes = useMemo(() => strokesOf(char), [char]);
  if (!strokes.length) return <span lang="ko">{char}</span>;
  return (
    <svg key={`${char}-${playKey}`} className="stroke-svg" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label || char}>
      {strokes.map((d, i) => (
        <path key={`g${i}`} d={d} className="stroke-guide" />
      ))}
      {strokes.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength="1"
          className={`stroke-draw ${animate ? '' : 'is-static'}`}
          style={{ animationDelay: `${i * step}s`, '--d': `${step * 0.95}s` }}
        />
      ))}
    </svg>
  );
}
