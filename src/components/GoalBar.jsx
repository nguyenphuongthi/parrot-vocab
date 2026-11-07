// Mục tiêu ngày + chuỗi ngày học. Mặc định cộng cả 3 ngôn ngữ; truyền `list` để tính riêng.
//  - Ngọn lửa to dần theo số ngày liên tiếp; mốc 7 / 30 ngày có huy hiệu.
//  - Bản dùng chung (không truyền list): vừa đạt mục tiêu → chú vẹt bay vòng + pháo giấy lớn.
import { useEffect, useMemo, useRef } from 'react';
import { useTable } from '../lib/store.js';
import { reviewStats } from '../lib/srs.js';
import { useSettings } from '../lib/settings.js';
import { emitFx } from '../lib/events.js';
import { FlameIcon } from './Icons.jsx';

export function useAllEntries() {
  const words = useTable('words');
  const items = useTable('items');
  return useMemo(() => [...Object.values(words), ...Object.values(items)], [words, items]);
}

export default function GoalBar({ list, label = 'Hôm nay' }) {
  const all = useAllEntries();
  const { dailyGoal } = useSettings();
  const { today, goal, reached, streak } = reviewStats(list || all, dailyGoal);

  // Vừa đạt mục tiêu trong lúc đang mở trang (không báo khi mở trang lúc đã đạt sẵn)
  const wasReached = useRef(reached);
  useEffect(() => {
    if (!list && reached && !wasReached.current) emitFx('goal');
    wasReached.current = reached;
  }, [reached, list]);

  const flameScale = 1 + Math.min(streak, 30) / 30;
  const milestone = streak >= 30 ? '💎 30 ngày' : streak >= 7 ? '🏅 7 ngày' : null;

  return (
    <div className={`goal ${reached ? 'is-reached' : ''}`}>
      <span className="goal-text">
        {label} <b>{today}</b>/{goal} thẻ{reached && ' · ✓ đạt mục tiêu'}
      </span>
      <span className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(today, goal)} aria-label="Tiến độ mục tiêu hôm nay">
        <span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
      </span>
      <span className="goal-streak" title="Số ngày liên tiếp ôn đủ mục tiêu">
        <span className="flame" style={{ fontSize: `${flameScale}em` }}>
          <FlameIcon size={16 * flameScale} />
        </span>
        <b>{streak}</b> ngày liên tiếp
        {milestone && <span className="streak-badge">{milestone}</span>}
      </span>
    </div>
  );
}
