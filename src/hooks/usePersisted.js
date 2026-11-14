// useState được nhớ trong localStorage (trạng thái giao diện: mục đang mở, tab đang chọn…).
import { useState } from 'react';

export function usePersisted(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('languages.ui.' + key));
      if (v !== null && v !== undefined && typeof v === typeof initial) return v;
    } catch {
      /* bộ nhớ trình duyệt không khả dụng */
    }
    return initial;
  });
  const set = (next) =>
    setValue((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem('languages.ui.' + key, JSON.stringify(v));
      } catch {
        /* bỏ qua */
      }
      return v;
    });
  return [value, set];
}
