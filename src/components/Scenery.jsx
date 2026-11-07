// Nền hoạt hình nhẹ phía sau nội dung: mảng màu pastel trôi chậm + chữ của ngôn ngữ đang học bay lơ lửng
// (rất mờ) + vài đốm lấp lánh. Chỉ dùng transform / opacity (nhẹ máy); tắt khi máy bật "giảm chuyển động".
import { memo } from 'react';

const GLYPHS = {
  en: ['A', 'b', 'c', 'Hi', '?', 'Aa', 'z', '!', 'ok', 'é', 'Q', 'w', 'Yes', 'g'],
  zh: ['你', '好', '学', '中', '文', '爱', '书', '山', '水', '月', '人', '大', '心', '天'],
  ko: ['가', '나', '다', '한', '글', 'ㅎ', 'ㅏ', '봄', '꿈', '별', '말', 'ㅇ', '눈', '해'],
  all: ['A', '你', '가', 'b', '学', '한', '?', '文', 'ㅎ', 'Hi', '月', '봄', 'z', '心'],
};

// Vị trí / cỡ / tốc độ cố định (không ngẫu nhiên) để nền không nhảy lung tung mỗi lần vẽ lại
const SLOTS = [
  [6, 18, 30, 26, -2], [18, 34, 46, 32, -14], [30, 22, 28, 24, -8], [44, 40, 52, 36, -20], [57, 20, 34, 28, -5],
  [70, 30, 44, 31, -16], [83, 24, 30, 25, -10], [93, 38, 48, 35, -24], [12, 26, 38, 29, -18], [37, 30, 24, 27, -26],
  [64, 26, 40, 33, -3], [78, 20, 26, 23, -12], [50, 28, 36, 30, -29], [24, 20, 30, 34, -7],
];
const SPARKS = [
  [12, 22, -1], [28, 64, -3], [46, 14, -5], [66, 72, -2], [82, 30, -4], [92, 58, -6], [8, 80, -7], [56, 46, -8],
];

function Scenery({ lang = 'all' }) {
  const glyphs = GLYPHS[lang] || GLYPHS.all;
  return (
    <div className="scenery" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      {SLOTS.map(([left, size, dur, drift, delay], i) => (
        <span
          key={i}
          className="glyph"
          lang={lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko' : undefined}
          style={{ left: `${left}%`, fontSize: size, '--dur': `${dur}s`, '--drift': `${drift}px`, animationDelay: `${delay}s` }}
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
      {SPARKS.map(([left, top, delay], i) => (
        <span key={`s${i}`} className="spark" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

export default memo(Scenery);
