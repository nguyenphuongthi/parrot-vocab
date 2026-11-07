// Phát âm: file audio (tiếng Anh, lấy lúc tra từ trong extension) hoặc giọng đọc có sẵn của trình duyệt.
import { useEffect, useState } from 'react';
import { getSettings } from './settings.js';

export const VOICE_LANG = { en: 'en-US', 'en-uk': 'en-GB', zh: 'zh-CN', ko: 'ko-KR' };

function pickVoice(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split('-')[0];
  const norm = (v) => v.lang.replace('_', '-');
  return (
    voices.find((v) => norm(v) === lang) ||
    voices.find((v) => norm(v).startsWith(base + '-') && !(base === 'zh' && /HK|TW/i.test(v.lang))) ||
    voices.find((v) => norm(v).startsWith(base)) ||
    null
  );
}

// Tiếng Anh luôn phát được (đa số máy có giọng Anh); tiếng Trung / Hàn chỉ hiện nút nghe khi máy có giọng.
export function useCanSpeak(lang) {
  const [ok, setOk] = useState(() => !!pickVoice(lang));
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setOk(!!pickVoice(lang));
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, [lang]);
  return ok;
}

let player = null;

export function speak(text, lang, { audio = '', rate = 0.95 } = {}) {
  if (!text) return;
  if (audio) {
    player ||= new Audio();
    player.pause();
    player.src = audio;
    player.play().catch(() => speak(text, lang, { rate }));
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(lang.startsWith('zh') ? text.replace(/……/g, '，') : text);
  const voice = pickVoice(lang);
  u.voice = voice;
  u.lang = voice?.lang || lang;
  u.rate = rate;
  synth.speak(u);
}

// Mở một thẻ (khung chi tiết, câu giao tiếp…) thì tự đọc – theo tuỳ chọn "Tự phát âm" trong Cài đặt.
export function useSpeakOnOpen(text, lang, active = true) {
  useEffect(() => {
    if (active && text && getSettings().autoPlay) speak(text, lang);
  }, [text, lang, active]);
}

// ---------- Karaoke: chữ sáng lên lần lượt theo giọng đọc ----------
// Dùng sự kiện "boundary" của giọng đọc nếu có; không có thì ước lượng theo tốc độ đọc.
const PER_CHAR_MS = { zh: 300, ko: 230, en: 70 };

export function useKaraoke() {
  const [index, setIndex] = useState(-1);
  const timerRef = useState(() => ({ timer: null, reset: null }))[0];
  useEffect(
    () => () => {
      clearInterval(timerRef.timer);
      clearTimeout(timerRef.reset);
    },
    [timerRef],
  );
  const play = (text, lang, { rate = 0.9 } = {}) => {
    const synth = typeof window !== 'undefined' && window.speechSynthesis;
    clearInterval(timerRef.timer);
    clearTimeout(timerRef.reset);
    const chars = [...text];
    const per = (PER_CHAR_MS[lang.slice(0, 2)] || 120) / rate;
    let i = 0;
    let usingBoundary = false;
    setIndex(0);
    const finish = () => {
      clearInterval(timerRef.timer);
      setIndex(chars.length);
      timerRef.reset = setTimeout(() => setIndex(-1), 700);
    };
    // Ước lượng (dừng ngay khi giọng đọc báo vị trí thật)
    timerRef.timer = setInterval(() => {
      if (usingBoundary) return;
      i += 1;
      if (i >= chars.length) finish();
      else setIndex(i);
    }, per);
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(lang.startsWith('zh') ? text.replace(/……/g, '，') : text);
    const voice = pickVoice(lang);
    u.voice = voice;
    u.lang = voice?.lang || lang;
    u.rate = rate;
    u.onboundary = (e) => {
      if (typeof e.charIndex !== 'number') return;
      usingBoundary = true;
      clearInterval(timerRef.timer);
      // charIndex tính theo UTF-16 – đổi sang vị trí ký tự
      setIndex([...text.slice(0, e.charIndex + (e.charLength || 1))].length - 1);
    };
    u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  };
  return [index, play];
}
