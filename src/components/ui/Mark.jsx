// Mức thuộc hiển thị bằng icon tối giản: ○ chưa thuộc · ◐ hơi nhớ · ● đã thuộc.
// Thẻ luôn trung tính (không tô viền theo mức) – chỉ icon mang màu nhẹ.
import { STATES } from '../../lib/srs.js';

// Emoji của 3 mức – dùng ở bộ chọn mức (khung chi tiết) và nút chấm điểm flashcard
export const MARK_EMOJI = ['😣', '🤔', '😎'];

export function MarkGlyph({ value, size = 18 }) {
  return (
    <svg className={`mark-glyph m-${value}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" className="mark-ring" />
      {value === 1 && <path d="M10 2.75a7.25 7.25 0 0 0 0 14.5z" className="mark-fill" />}
      {value === 2 && <circle cx="10" cy="10" r="7.25" className="mark-fill" />}
      {value === 2 && <path d="m6.6 10.2 2.2 2.2 4.6-4.7" className="mark-check" />}
    </svg>
  );
}

// Bấm để chuyển vòng: chưa thuộc → hơi nhớ → đã thuộc → chưa thuộc.
export function MarkButton({ value, onChange, label = '', size = 18, className = '' }) {
  const next = (value + 1) % 3;
  return (
    <button
      type="button"
      className={`mark-btn ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(next);
      }}
      aria-label={`${label ? label + ': ' : ''}${STATES[value].label}. Bấm để chuyển sang ${STATES[next].label.toLowerCase()}`}
      title={STATES[value].label}
    >
      <MarkGlyph key={value} value={value} size={size} />
    </button>
  );
}

// Chọn trực tiếp một trong ba mức (trong khung chi tiết).
export function MarkPicker({ value, onChange, label = 'Mức độ thuộc' }) {
  const onKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    onChange(Math.min(2, Math.max(0, value + step)));
  };
  return (
    <div className="mark-picker" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {STATES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          tabIndex={value === s.value ? 0 : -1}
          className={value === s.value ? 'is-on' : ''}
          onClick={(e) => {
            e.stopPropagation();
            onChange(s.value);
          }}
        >
          <span className="mark-emoji" aria-hidden="true">
            {MARK_EMOJI[s.value]}
          </span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

// Bộ lọc theo mức kèm số lượng; bấm lại để bỏ lọc. active: null | 0 | 1 | 2 (hoặc mảng khi multi).
export function MarkFilter({ counts, active, onPick, multi = false, compact = false }) {
  const isOn = (v) => (multi ? active.includes(v) : active === v);
  return (
    <div className={`mark-filter ${compact ? 'is-compact' : ''}`}>
      {STATES.map((s) => (
        <button
          key={s.value}
          type="button"
          className={`chip ${isOn(s.value) ? 'is-on' : ''}`}
          aria-pressed={isOn(s.value)}
          title={isOn(s.value) && !multi ? 'Bỏ lọc' : `${multi ? 'Chọn' : 'Chỉ hiện'} mục ${s.label.toLowerCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick(s.value);
          }}
        >
          <MarkGlyph value={s.value} size={14} />
          <b>{(counts[s.value] ?? 0).toLocaleString('vi-VN')}</b>
          <span className="chip-label">{s.label.toLowerCase()}</span>
        </button>
      ))}
    </div>
  );
}
