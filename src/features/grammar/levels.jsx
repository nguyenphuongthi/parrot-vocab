// Mức độ của điểm ngữ pháp. Tiếng Anh theo CEFR, gom thành 3 mức: Cơ bản (A1–A2) · Trung cấp (B1–B2) · Nâng cao (C1).
// Tiếng Hàn theo cấp TOPIK (mỗi cấp là một tab riêng).
export const TIERS = [
  { id: 'basic', label: 'Cơ bản', levels: ['A1', 'A2'] },
  { id: 'mid', label: 'Trung cấp', levels: ['B1', 'B2'] },
  { id: 'adv', label: 'Nâng cao', levels: ['C1'] },
];

export const tierOf = (level) => TIERS.findIndex((t) => t.levels.includes(level));

export function LevelBadge({ lang, level, long = false }) {
  if (lang !== 'en') return long ? <span className="cefr cefr-b">TOPIK {level}</span> : null;
  const tier = TIERS[tierOf(level)];
  return (
    <span className={`cefr cefr-${level[0].toLowerCase()}`} title={`Mức ${tier.label.toLowerCase()} · CEFR ${level}`}>
      {long ? `${tier.label} · ${level}` : level}
    </span>
  );
}
