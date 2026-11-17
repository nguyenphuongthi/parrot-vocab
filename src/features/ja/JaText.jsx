// Hiển thị chữ Nhật: furigana (ruby) trên chữ Hán, romaji (bật/tắt trong Cài đặt), nút nghe.
import { useEffect, useMemo, useState } from 'react';
import { useSettings, updateSettings } from '../../lib/settings.js';
import { speak, useCanSpeak } from '../../lib/speech.js';
import { SpeakerIcon } from '../../components/ui/Icons.jsx';
import { jaPlain, jaRomaji, jaSegments } from './text.js';
import { loadStrokes } from './data.js';

export const JA_VOICE = 'ja-JP';
export const sayJa = (text, rate = 0.85) => speak(text, JA_VOICE, { rate });

// Câu / từ có đánh dấu {漢字|かな} → <ruby>. keepSpaces: giữ dấu cách (cho công thức, lời giải thích tiếng Việt).
// lang = null: đoạn chữ tiếng Việt có xen tiếng Nhật – chỉ gắn lang="ja" cho phần có furigana.
export function Ruby({ text, keepSpaces = false, className, furigana = true, lang = 'ja' }) {
  const segs = useMemo(() => jaSegments(text, { keepSpaces }), [text, keepSpaces]);
  const body = segs.map((s, i) => {
    const inner =
      s.rt && furigana ? (
        <ruby lang={lang ? undefined : 'ja'}>
          {s.text}
          <rp>(</rp>
          <rt>{s.rt}</rt>
          <rp>)</rp>
        </ruby>
      ) : (
        s.text
      );
    return s.mark ? <mark key={i}>{inner}</mark> : <span key={i}>{inner}</span>;
  });
  return (
    <span className={`ja-ruby ${className || ''}`} lang={lang || undefined}>
      {body}
    </span>
  );
}

export function useRomaji() {
  return useSettings().jaRomaji;
}

// Dòng romaji – ẩn khi người dùng tắt romaji
export function Romaji({ text, rm, className = '' }) {
  const on = useRomaji();
  if (!on) return null;
  return <span className={`ja-rm ${className}`}>{rm ?? jaRomaji(text)}</span>;
}

// Công tắc romaji đặt trên thanh công cụ các trang tiếng Nhật
export function RomajiSwitch() {
  const on = useRomaji();
  return (
    <label className="switch">
      <input type="checkbox" checked={on} onChange={(e) => updateSettings({ jaRomaji: e.target.checked })} />
      <span>Romaji</span>
    </label>
  );
}

export function JaSpeak({ text, label = 'Nghe phát âm', size = 18, onPlay, rate }) {
  const can = useCanSpeak(JA_VOICE);
  if (!can) return null;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        if (onPlay) onPlay();
        else sayJa(jaPlain(text), rate);
      }}
      aria-label={label}
      title={label}
    >
      <SpeakerIcon size={size} />
    </button>
  );
}

// Vẽ chữ theo từng nét (KanjiVG, khung 109×109). Đổi playKey để vẽ lại; animate = false: hiện sẵn cả chữ.
export function JaStrokes({ char, size = 52, animate = true, playKey = 0, step = 0.42, numbers = false }) {
  const [all, setAll] = useState(null);
  useEffect(() => {
    let live = true;
    loadStrokes().then(
      (d) => live && setAll(d),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const strokes = all?.[char];
  if (!strokes) return <span lang="ja">{char}</span>;
  // Bước vẽ ngắn hơn với chữ nhiều nét để cả chữ không quá lâu
  const per = strokes.length > 8 ? Math.max(0.2, (step * 8) / strokes.length) : step;
  return (
    <svg
      key={`${char}-${playKey}`}
      className="stroke-svg is-kvg"
      width={size}
      height={size}
      viewBox="0 0 109 109"
      role="img"
      aria-label={`${char} – ${strokes.length} nét`}
    >
      {strokes.map((d, i) => (
        <path key={`g${i}`} d={d} className="stroke-guide" />
      ))}
      {strokes.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength="1"
          className={`stroke-draw ${animate ? '' : 'is-static'}`}
          style={{ animationDelay: `${i * per}s`, '--d': `${per * 0.95}s` }}
        />
      ))}
      {numbers &&
        strokes.map((d, i) => {
          const [x, y] = d.match(/^M\s*([\d.]+)[ ,]([\d.]+)/)?.slice(1).map(Number) || [0, 0];
          return (
            <text key={`n${i}`} x={x - 6} y={y - 2} className="stroke-num">
              {i + 1}
            </text>
          );
        })}
    </svg>
  );
}

export function useStrokeCount(char) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    loadStrokes().then(
      (d) => live && setN(d[char]?.length || 0),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [char]);
  return n;
}
