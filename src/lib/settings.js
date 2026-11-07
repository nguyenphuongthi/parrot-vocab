// Cài đặt lưu trên từng thiết bị (localStorage), không đồng bộ.
import { useSyncExternalStore } from 'react';

const KEY = 'languages.settings';

export const DEFAULT_DECK = {
  source: 'due', // due | new | marks | recent | lapses
  mode: 'front', // front (từ → nghĩa) | back (nghĩa → từ) | listen | type | choice
  states: [0, 1], // nguồn "theo mức thuộc"
  scope: 'all', // phạm vi: từ loại (Anh), cấp HSK (Trung), chủ đề (Hàn)
  order: 'random', // random | list
  newCount: 10, // số từ mới mỗi lượt (Trung / Hàn)
};

export const DEFAULTS = {
  accent: 'us', // giọng tiếng Anh: us | uk
  autoPlay: true, // tự phát âm khi mở thẻ
  dailyGoal: 20, // số thẻ flashcard mỗi ngày (cộng cả 3 ngôn ngữ)
  theme: 'auto', // auto | light | dark
  motion: 'auto', // hiệu ứng: auto (theo "giảm chuyển động" của máy) | full | lite | off – xem lib/motion.js
  scene: 'auto', // cảnh thanh trên: auto (xoay vòng các cảnh mỗi 2 phút) | day | sunset | night | rain | snow
  deck: { en: { ...DEFAULT_DECK }, zh: { ...DEFAULT_DECK }, ko: { ...DEFAULT_DECK } },
};

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') {
      return {
        ...DEFAULTS,
        ...v,
        deck: Object.fromEntries(
          Object.entries(DEFAULTS.deck).map(([lang, d]) => [lang, { ...d, ...(v.deck?.[lang] || {}) }]),
        ),
      };
    }
  } catch {
    /* bộ nhớ trình duyệt không khả dụng */
  }
  return DEFAULTS;
}

let settings = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((l) => l());
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  save();
}

export function updateDeck(lang, patch) {
  settings = { ...settings, deck: { ...settings.deck, [lang]: { ...settings.deck[lang], ...patch } } };
  save();
}

export const getSettings = () => settings;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    settings = load();
    listeners.forEach((l) => l());
  });
}

export function useSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}
