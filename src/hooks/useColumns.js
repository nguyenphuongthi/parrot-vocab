// Số cột thực tế của lưới (để chèn khung chi tiết ngay sau hàng chứa mục được chọn).
// Dùng chung cho lưới từ HSK và lưới từ tiếng Hàn.
import { useLayoutEffect, useState } from 'react';

export function useColumns(ref, active) {
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const measure = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
      setCols(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
  return cols;
}
