// Khung cảnh thanh đầu trang: bầu trời, mây, cái cây bên trái, mặt đất cỏ hoa – và chú vẹt.
//  - Chú vẹt đậu trên cây, thỉnh thoảng bay xuống đất đi lại / chào / ăn / ngủ / nhảy rồi bay về cây.
//  - Phản ứng theo việc học (src/lib/events.js): mừng khi "Đã thuộc", gãi đầu khi "Chưa thuộc",
//    bay một vòng khi đạt mục tiêu ngày.
//  - Bấm vào chú vẹt: nó nói to một từ bạn đang học (kèm phát âm).
//  - Cây lớn dần theo tổng số từ "đã thuộc": thêm tán lá, hoa (mỗi 20 từ), quả (mỗi 50 từ).
//  - Cảnh: day · sunset · night · rain · snow; bạn bè của vẹt: bướm (ngày), mèo ngủ (đêm),
//    ếch (mưa), người tuyết (tuyết).
import { memo, useEffect, useRef, useState } from 'react';
import { useSettings } from '../../lib/settings.js';
import { onFx } from '../../lib/events.js';
import { speak } from '../../lib/speech.js';
import { useMotionLevel } from '../../lib/motion.js';

const GREETINGS = { en: 'Hi!', zh: '你好!', ko: '안녕!', all: 'Xin chào!' };
const SIZE = 32;
const SPEED = 55; // px/giây khi đi
const FLY_MS = 1400;

// ---------- Cảnh ----------
// Tự động: xoay vòng các cảnh, mỗi cảnh 2 phút
export const SCENES = ['day', 'sunset', 'night', 'rain', 'snow'];
export const SCENE_LABELS = { day: 'Ban ngày', sunset: 'Hoàng hôn', night: 'Ban đêm', rain: 'Trời mưa', snow: 'Tuyết rơi' };
export const SCENE_MS = 2 * 60_000;
export function sceneFor(setting, date = new Date()) {
  if (setting && setting !== 'auto' && SCENES.includes(setting)) return setting;
  return SCENES[Math.floor(date.getTime() / SCENE_MS) % SCENES.length];
}

export function useScene() {
  const { scene } = useSettings();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  return sceneFor(scene, now);
}

// ---------- Hình vẽ ----------
function Parrot({ umbrella }) {
  return (
    <svg className="p-svg" width={SIZE} height={SIZE} viewBox="0 0 40 40">
      {umbrella && (
        <g className="p-umbrella">
          <path d="M6 7c4-7 20-8 26 0c-3-1-5 0-6 1c-2-2-5-2-7 0c-2-2-5-2-7 0c-1-1-3-2-6-1z" fill="#6cc46f" />
          <path d="M19 3.5c-1 4-1 7 0 10" stroke="#3f9a4a" strokeWidth="1" fill="none" />
          <path d="M19 7v12" stroke="#8a6a44" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      <g className="p-leg p-l1">
        <path d="M17 33v5" stroke="#f5a23c" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g className="p-leg p-l2">
        <path d="M22.5 33v5" stroke="#f5a23c" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g className="p-body">
        <g className="p-crest">
          <ellipse cx="14.5" cy="9.5" rx="1.9" ry="4.2" transform="rotate(-28 14.5 9.5)" fill="#9aa8f7" />
          <ellipse cx="18" cy="8" rx="2" ry="4.5" fill="#ff9f88" />
          <ellipse cx="21.5" cy="9.5" rx="1.9" ry="4.2" transform="rotate(28 21.5 9.5)" fill="#7ed6bd" />
        </g>
        <ellipse cx="19" cy="23.5" rx="12" ry="12.5" fill="#86d9c2" />
        <ellipse cx="20.5" cy="28" rx="7" ry="7.4" fill="#fff3dc" />
        <path className="p-wing" d="M8 20c-3 6-0.5 12 6 13.5c1-6-1-10.5-6-13.5z" fill="#5ec3a7" />
        <ellipse cx="23.6" cy="25" rx="2.1" ry="1.4" fill="#ffa6b6" />
        <g className="p-eye">
          <circle cx="22" cy="19" r="3.2" fill="#24213a" />
          <circle cx="23.1" cy="17.9" r="1.15" fill="#fff" />
        </g>
        <path className="p-eye-closed" d="M19.2 19.4q2.8 2.2 5.6 0" fill="none" stroke="#24213a" strokeWidth="1.5" strokeLinecap="round" />
        <path className="p-eye-happy" d="M19.4 20q2.6-3 5.2 0" fill="none" stroke="#24213a" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M26.5 17.8c4.6-.6 7 2 6.7 5.3c-.2 1.8-1.6 2.8-3.1 2.6c.9-2-.2-3.9-3.6-4.2z" fill="#ffb347" />
        <path d="M26.5 21.8c2.1.2 3.4 1.1 3.7 2.6c-1.4.7-3 .4-3.7-.9z" fill="#e8891f" />
      </g>
    </svg>
  );
}

// Quả / hoa trên tán cây (toạ độ trong viewBox 64×100)
const FRUIT_SPOTS = [[40, 22], [18, 38], [47, 40], [28, 12], [33, 34], [12, 30], [52, 30], [24, 26], [44, 14], [36, 44], [16, 22], [50, 22]];
const BLOSSOM_SPOTS = [[22, 14], [42, 30], [30, 40], [14, 36], [48, 18], [36, 10], [26, 32], [54, 36]];

function Tree({ scene, mastered }) {
  // Lớn dần: 0 → 500 từ đã thuộc thì tán to thêm 25%, có thêm cụm lá ở mốc 100 / 250 từ
  const grow = 0.85 + Math.min(mastered, 500) / 500 * 0.25;
  const fruits = Math.min(FRUIT_SPOTS.length, Math.floor(mastered / 50));
  const blossoms = Math.min(BLOSSOM_SPOTS.length, Math.floor(mastered / 20));
  return (
    <svg className="tree" viewBox="0 0 64 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <path d="M29 100V58c-6-4-10-8-12-14l4-1c2 5 5 8 8 10V40h6v22c3-3 6-6 8-11l4 2c-3 7-7 11-12 14v33z" className="tree-trunk" />
      <g className="tree-crown" style={{ transform: `scale(${grow})` }}>
        {mastered >= 250 && <circle cx="8" cy="22" r="10" className="tree-leaf l2" />}
        {mastered >= 100 && <circle cx="56" cy="22" r="11" className="tree-leaf l2" />}
        <circle cx="20" cy="36" r="16" className="tree-leaf l2" />
        <circle cx="46" cy="34" r="15" className="tree-leaf l2" />
        <circle cx="32" cy="24" r="20" className="tree-leaf" />
        <circle cx="25" cy="18" r="5" className="tree-shine" />
        {scene !== 'snow' &&
          BLOSSOM_SPOTS.slice(0, blossoms).map(([x, y], i) => (
            <g key={`b${i}`} className="tree-blossom" style={{ animationDelay: `${i * 0.08}s` }}>
              <circle cx={x} cy={y} r="2.2" />
              <circle cx={x} cy={y} r="0.8" className="tree-blossom-c" />
            </g>
          ))}
        {FRUIT_SPOTS.slice(0, fruits).map(([x, y], i) => (
          <circle key={`f${i}`} cx={x} cy={y} r="2.6" className="tree-fruit" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
        {scene === 'snow' && (
          <g className="tree-snow">
            <path d="M14 15c5-9 30-10 36 0c-4-2-8-1-11 1c-3-3-8-3-12 0c-4-2-8-2-13-1z" />
            <path d="M5 30c3-6 13-7 17-2c-3 0-5 1-7 2c-3-1-6-1-10 0z" />
            <path d="M35 26c4-5 15-5 18 2c-3-1-6 0-8 1c-3-2-6-2-10-3z" />
          </g>
        )}
      </g>
    </svg>
  );
}

// ---------- Bạn bè của chú vẹt ----------
function Butterfly() {
  return (
    <span className="butterfly">
      <svg width="18" height="16" viewBox="0 0 18 16">
        <g className="bf-wing bf-l">
          <path d="M9 8C6 1 0 1 1 6c1 4 5 4 8 2z" fill="#ffb3c6" />
          <path d="M9 9c-3 0-6 2-5 5c2 2 4 0 5-5z" fill="#ffd36b" />
        </g>
        <g className="bf-wing bf-r">
          <path d="M9 8c3-7 9-7 8-2c-1 4-5 4-8 2z" fill="#ffb3c6" />
          <path d="M9 9c3 0 6 2 5 5c-2 2-4 0-5-5z" fill="#ffd36b" />
        </g>
        <path d="M9 5v8" stroke="#5a4637" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Cat() {
  return (
    <span className="friend cat">
      <svg width="34" height="20" viewBox="0 0 34 20">
        <path className="cat-tail" d="M27 15c5 0 7-3 5-6" stroke="#5c5470" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="17" cy="14" rx="11" ry="6" fill="#5c5470" />
        <circle cx="8" cy="11" r="5" fill="#5c5470" />
        <path d="M4.5 7.5l.5-4l3 3zM9 6.5l2.5-3l.5 4z" fill="#5c5470" />
        <path d="M6 11.5q1 .8 2 0M9 11.5q1 .8 2 0" stroke="#d9d4ff" strokeWidth=".8" fill="none" strokeLinecap="round" />
      </svg>
      <span className="cat-zzz">z</span>
    </span>
  );
}

function Snowman() {
  return (
    <span className="friend snowman">
      <svg width="24" height="32" viewBox="0 0 24 32">
        <circle cx="12" cy="23" r="8" fill="#fff" stroke="#dbe5f1" />
        <circle cx="12" cy="11" r="6" fill="#fff" stroke="#dbe5f1" />
        <path d="M7 6.5h10l-1.5-5h-7z" fill="#3c3f58" />
        <circle cx="10" cy="10" r=".9" fill="#2b2b3a" />
        <circle cx="14" cy="10" r=".9" fill="#2b2b3a" />
        <path d="M12 12l4 1l-4 .8z" fill="#ff9a4a" />
        <path d="M7 16h10" stroke="#ff6f7d" strokeWidth="2.2" strokeLinecap="round" />
        <path className="sm-arm" d="M4 20l-4-4" stroke="#8a6a44" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M20 20l4-4" stroke="#8a6a44" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Frog() {
  return (
    <span className="friend frog">
      <svg width="22" height="16" viewBox="0 0 22 16">
        <ellipse cx="11" cy="11" rx="9" ry="5" fill="#6cc46f" />
        <circle cx="6.5" cy="5.5" r="3.2" fill="#6cc46f" />
        <circle cx="15.5" cy="5.5" r="3.2" fill="#6cc46f" />
        <circle cx="6.5" cy="5.5" r="1.5" fill="#fff" />
        <circle cx="15.5" cy="5.5" r="1.5" fill="#fff" />
        <circle cx="6.8" cy="5.7" r=".8" fill="#24213a" />
        <circle cx="15.2" cy="5.7" r=".8" fill="#24213a" />
        <path d="M7 11q4 2.5 8 0" stroke="#2f7a3a" strokeWidth="1" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const FLOWERS = [4, 11, 19, 27, 34, 43, 51, 58, 66, 73, 81, 88, 95];
const SNOW = Array.from({ length: 30 }, (_, i) => [(i * 37) % 100, 5 + (i % 5) * 1.3, -((i * 0.73) % 6), 3 + (i % 3)]);
const RAIN = Array.from({ length: 36 }, (_, i) => [(i * 29) % 100, 0.7 + (i % 4) * 0.12, -((i * 0.37) % 2)]);
const STARS = [[8, 18], [16, 52], [27, 12], [38, 40], [49, 20], [61, 48], [70, 14], [79, 36], [88, 22], [94, 50], [55, 8], [33, 60]];
const FIREFLIES = [12, 30, 47, 63, 77, 90];
const PUDDLES = [22, 48, 71, 90];

const Sky = memo(function Sky({ scene }) {
  const cloudy = scene !== 'night';
  return (
    <div className="sky" aria-hidden="true">
      {scene === 'day' && <span className="sun" />}
      {scene === 'sunset' && <span className="sun sun-set" />}
      {scene === 'night' && <span className="moon" />}
      {(scene === 'night' || scene === 'sunset') &&
        STARS.slice(0, scene === 'night' ? STARS.length : 5).map(([l, t], i) => (
          <span key={i} className="star" style={{ left: `${l}%`, top: `${t * 0.6}%`, animationDelay: `${-i * 0.6}s` }} />
        ))}
      {cloudy && (
        <>
          <span className="cloud c1" />
          <span className="cloud c2" />
          <span className="cloud c3" />
        </>
      )}
      {(scene === 'day' || scene === 'sunset') && <Butterfly />}
      {scene === 'snow' &&
        SNOW.map(([l, dur, delay, size], i) => (
          <span key={i} className="flake" style={{ left: `${l}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
        ))}
      {scene === 'rain' &&
        RAIN.map(([l, dur, delay], i) => <span key={i} className="drop" style={{ left: `${l}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />)}
      <div className={`ground g-${scene}`}>
        <svg viewBox="0 0 1000 18" preserveAspectRatio="none">
          <path d="M0 8C60 2 120 2 190 6s150 6 230 1s170-4 250 2s160 4 210 0s70-3 120 0V18H0z" />
        </svg>
        {(scene === 'day' || scene === 'sunset') &&
          FLOWERS.map((l, i) => (
            <span key={i} className={`flower f${i % 4}`} style={{ left: `${l}%`, animationDelay: `${-i * 0.4}s` }}>
              <i />
            </span>
          ))}
        {scene === 'night' && FIREFLIES.map((l, i) => <span key={i} className="firefly" style={{ left: `${l}%`, animationDelay: `${-i * 1.1}s` }} />)}
        {scene === 'rain' && PUDDLES.map((l, i) => <span key={i} className="puddle" style={{ left: `${l}%`, animationDelay: `${-i * 0.5}s` }} />)}
      </div>
    </div>
  );
});

// ---------- Chú vẹt ----------
const GROUND_ACTIONS = [
  ['walk', 5, 0],
  ['wave', 2, 2600],
  ['eat', 2, 3800],
  ['sleep', 1.2, 6000],
  ['hop', 1.5, 1300],
  ['idle', 1, 2000],
  ['home', 1.4, 0],
];
const TREE_ACTIONS = [
  ['wave', 2, 2600],
  ['idle', 2, 2600],
  ['sleep', 1, 7000],
  ['down', 3, 0],
];

function pick(list, prev, night) {
  const items = list
    .filter(([a]) => a !== prev || a === 'walk')
    .map(([a, w, ms]) => [a, a === 'sleep' && night ? w * 3 : w, ms]);
  let r = Math.random() * items.reduce((s, [, w]) => s + w, 0);
  for (const it of items) if ((r -= it[1]) <= 0) return it;
  return items[0];
}

const LANG_VOICE = { en: 'en-US', zh: 'zh-CN', ko: 'ko-KR' };

// pickWord(): { text, lang } – một từ bạn đang học (App cung cấp); null = chưa học từ nào
export default function HeaderScene({ lang = 'all', scene, mastered = 0, pickWord }) {
  const lane = useRef(null);
  const tree = useRef(null);
  // Chỉ đi dạo ở mức hiệu ứng "Đầy đủ"; mức khác thì đậu yên trên cây (vẫn bấm được).
  const reduced = useMotionLevel() !== 'full';
  const [p, setP] = useState({ x: 0, y: 0, dir: 1, action: 'idle', where: 'tree', dur: 0, ready: false });
  const [react, setReact] = useState(null); // happy | sad | loop | say
  const [said, setSaid] = useState(null); // { text, lang }
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const reactTimer = useRef(null);

  // Phản ứng theo việc học
  useEffect(
    () =>
      onFx(({ kind }) => {
        if (!['happy', 'sad', 'goal'].includes(kind)) return;
        clearTimeout(reactTimer.current);
        setSaid(null);
        setReact(kind === 'goal' ? 'loop' : kind);
        reactTimer.current = setTimeout(() => setReact(null), kind === 'goal' ? 2600 : 1500);
      }),
    [],
  );
  useEffect(() => () => clearTimeout(reactTimer.current), []);

  const onParrotClick = () => {
    const word = pickWord?.();
    clearTimeout(reactTimer.current);
    if (word) {
      setSaid(word);
      speak(word.text, LANG_VOICE[word.lang] || 'en-US', { rate: 0.85 });
    } else {
      setSaid({ text: GREETINGS[lang] || GREETINGS.all, lang });
    }
    setReact('say');
    reactTimer.current = setTimeout(() => {
      setReact(null);
      setSaid(null);
    }, 2600);
  };

  useEffect(() => {
    let alive = true;
    let timer = null;
    let where = 'tree';
    let x = 0;
    let last = 'idle';

    const geo = () => {
      const l = lane.current.getBoundingClientRect();
      const t = tree.current.getBoundingClientRect();
      return {
        perch: { x: t.left - l.left + t.width * 0.5 - SIZE / 2, y: Math.max(0, t.top - l.top + t.height * 0.12 - SIZE * 0.72) },
        groundY: l.height - SIZE - 5,
        minX: t.right - l.left + 4,
        maxX: l.width - SIZE - 6,
      };
    };

    const land = (fn) => {
      timer = setTimeout(fn, FLY_MS + 80);
    };

    const next = () => {
      if (!alive || !lane.current || !tree.current) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(next, 3000);
        return;
      }
      const g = geo();
      const night = sceneRef.current === 'night';
      if (where === 'tree') {
        const [action, , ms] = pick(TREE_ACTIONS, last, night);
        last = action;
        if (action === 'down') {
          x = Math.round(g.minX + Math.random() * Math.max(0, Math.min(g.maxX, g.minX + 360) - g.minX));
          setP({ x, y: g.groundY, dir: 1, action: 'fly', rise: 'down', where: 'ground', dur: FLY_MS / 1000, ready: true });
          where = 'ground';
          return land(() => {
            setP((s) => ({ ...s, action: 'idle', dur: 0 }));
            timer = setTimeout(next, 500);
          });
        }
        setP({ ...g.perch, dir: 1, action, where: 'tree', dur: 0, ready: true });
        timer = setTimeout(next, ms);
        return;
      }
      const [action, , ms] = pick(GROUND_ACTIONS, last, night);
      last = action;
      if (action === 'home') {
        setP({ ...g.perch, dir: g.perch.x >= x ? 1 : -1, action: 'fly', rise: 'up', where: 'tree', dur: FLY_MS / 1000, ready: true });
        where = 'tree';
        x = g.perch.x;
        return land(() => {
          setP((s) => ({ ...s, dir: 1, action: 'idle', dur: 0 }));
          timer = setTimeout(next, 1500);
        });
      }
      if (action === 'walk') {
        let target = Math.round(g.minX + Math.random() * Math.max(0, g.maxX - g.minX));
        if (Math.abs(target - x) < 80) target = Math.min(g.maxX, Math.max(g.minX, x + (x > (g.minX + g.maxX) / 2 ? -170 : 170)));
        const dur = Math.abs(target - x) / SPEED;
        setP({ x: target, y: g.groundY, dir: target >= x ? 1 : -1, action: 'walk', where: 'ground', dur, ready: true });
        x = target;
        timer = setTimeout(next, dur * 1000 + 150);
        return;
      }
      setP((s) => ({ ...s, y: g.groundY, action, dur: 0 }));
      timer = setTimeout(next, ms);
    };

    const start = requestAnimationFrame(() => {
      if (!lane.current || !tree.current) return;
      const g = geo();
      x = g.perch.x;
      setP({ ...g.perch, dir: 1, action: 'idle', where: 'tree', dur: 0, ready: true });
      if (!reduced) timer = setTimeout(next, 2500);
    });
    const onResize = () => {
      if (!lane.current || !tree.current) return;
      clearTimeout(timer);
      const g = geo();
      where = 'tree';
      x = g.perch.x;
      setP({ ...g.perch, dir: 1, action: 'idle', where: 'tree', dur: 0, ready: true });
      if (!reduced) timer = setTimeout(next, 2500);
    };
    window.addEventListener('resize', onResize);
    return () => {
      alive = false;
      cancelAnimationFrame(start);
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [reduced]);

  const { x, y, dir, action, rise, where, dur, ready } = p;
  const flyEase = action === 'fly' ? 'cubic-bezier(0.45, 0, 0.3, 1)' : 'linear';
  const bubble = said ? said.text : action === 'wave' && !react ? GREETINGS[lang] || GREETINGS.all : null;
  const bubbleLang = (said?.lang || lang) === 'zh' ? 'zh-CN' : (said?.lang || lang) === 'ko' ? 'ko' : undefined;
  return (
    <>
      <Sky scene={scene} />
      <div className="scene-lane" ref={lane}>
        <span ref={tree} className="tree-wrap" aria-hidden="true">
          <Tree scene={scene} mastered={mastered} />
        </span>
        {scene === 'night' && <Cat />}
        {scene === 'snow' && <Snowman />}
        {scene === 'rain' && <Frog />}
        <div
          className={`stroller is-${action} ${action === 'fly' ? `fly-${rise}` : ''} at-${where} ${react ? `react-${react}` : ''} ${ready ? '' : 'is-hidden'}`}
          style={{ '--dir': dir, transform: `translate(${x}px, ${y}px)`, transitionDuration: `${dur}s`, transitionTimingFunction: flyEase }}
        >
          <button type="button" className="stroller-hit" onClick={onParrotClick} aria-label="Chú vẹt – bấm để nghe một từ bạn đang học" title="Bấm để nghe một từ bạn đang học">
            <span className="stroller-loop">
              <span className="stroller-flip" style={{ transform: `scaleX(${dir})` }}>
                <Parrot umbrella={scene === 'rain'} />
                {action === 'eat' && !react && (
                  <span className="seeds">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </span>
            </span>
          </button>
          {bubble && (
            <span key={bubble} className={`stroller-say ${said ? 'is-word' : ''}`} lang={bubbleLang}>
              {bubble}
            </span>
          )}
          {react === 'happy' && (
            <span className="stroller-hearts" aria-hidden="true">
              <i>♥</i>
              <i>♥</i>
              <i>✦</i>
            </span>
          )}
          {react === 'sad' && (
            <span className="stroller-q" aria-hidden="true">
              ?
            </span>
          )}
          {action === 'sleep' && !react && (
            <span className="stroller-zzz" aria-hidden="true">
              <i>z</i>
              <i>z</i>
              <i>Z</i>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
