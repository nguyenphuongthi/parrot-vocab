// Chú vẹt "tiến hoá" theo cấp độ của thẻ flashcard, to dần qua từng cấp:
//   0 A1 / HSK 1 – quả trứng      1 A2 / HSK 2 – trứng nứt, vẹt ló đầu
//   2 B1 / HSK 3 – vẹt non        3 B2 / HSK 4 – vẹt nhỏ
//   4 C1 / HSK 5 – vẹt biết nói   5 C2 / HSK 6 – vẹt thông thái (đội mũ tốt nghiệp)
import { MASCOT_SVG, MASCOT_VIEWBOX } from './mascot.js';

const hide = (svg, cls) => svg.replace(`class="${cls}"`, `class="${cls}" style="display:none"`);

const CHICK_HEAD = `
  <ellipse cx="32" cy="17" rx="2" ry="4.2" fill="#ff9f88"/>
  <ellipse cx="28.5" cy="18.5" rx="1.6" ry="3.4" transform="rotate(-28 28.5 18.5)" fill="#9aa8f7"/>
  <circle cx="32" cy="30" r="11" fill="#a6e6d4"/>
  <circle cx="35.5" cy="28" r="2.8" fill="#24213a"/>
  <circle cx="36.4" cy="27.1" r="1" fill="#fff"/>
  <path d="M41.5 29l6 2.2l-6 2.6z" fill="#ffb347"/>
  <ellipse cx="37" cy="33.5" rx="2.2" ry="1.3" fill="#ffa6b6" opacity="0.9"/>
`;

const STAGE_SVG = [
  // Trứng
  `<ellipse cx="32" cy="60" rx="13" ry="2.5" fill="#24213a" opacity="0.12"/>
   <g class="pet-wobble">
     <ellipse cx="32" cy="39" rx="15" ry="19.5" fill="#fff3dc" stroke="#ecd2a6" stroke-width="2"/>
     <circle cx="25" cy="33" r="3" fill="#9aa8f7"/>
     <circle cx="37" cy="27" r="2.3" fill="#ff9f88"/>
     <circle cx="38" cy="45" r="3.4" fill="#7ed6bd"/>
     <circle cx="27" cy="49" r="1.8" fill="#ff9f88"/>
     <ellipse cx="26" cy="27" rx="3" ry="5" fill="#fff" opacity="0.7" transform="rotate(25 26 27)"/>
   </g>`,
  // Trứng nứt, vẹt ló đầu
  `<ellipse cx="32" cy="60" rx="13" ry="2.5" fill="#24213a" opacity="0.12"/>
   <g class="pet-peek">${CHICK_HEAD}</g>
   <path d="M17 38l5-5l5 5l5-5l5 5l5-5l5 5c0 12-6 20-15 20s-15-8-15-20z" fill="#fff3dc" stroke="#ecd2a6" stroke-width="2" stroke-linejoin="round"/>
   <circle cx="25" cy="47" r="2.6" fill="#9aa8f7"/>
   <circle cx="39" cy="50" r="2.4" fill="#7ed6bd"/>`,
  // Vẹt non: tròn xoe, lông tơ
  `<ellipse cx="32" cy="61" rx="12" ry="2.2" fill="#24213a" opacity="0.12"/>
   <path d="M28 55v5M36 55v5" stroke="#f5a23c" stroke-width="3" stroke-linecap="round"/>
   <g class="pet-bounce">
     <ellipse cx="32" cy="24" rx="2.2" ry="4.6" fill="#ff9f88"/>
     <ellipse cx="28" cy="25.5" rx="1.8" ry="3.8" transform="rotate(-28 28 25.5)" fill="#9aa8f7"/>
     <ellipse cx="36" cy="25.5" rx="1.8" ry="3.8" transform="rotate(28 36 25.5)" fill="#7ed6bd"/>
     <circle cx="32" cy="42" r="15" fill="#a6e6d4"/>
     <ellipse cx="33.5" cy="47" rx="8.5" ry="7.5" fill="#fff3dc"/>
     <path class="pet-wing" d="M19 39c-3.5 5-1 10.5 5 11.5c1-5-1-8.5-5-11.5z" fill="#86d9c2"/>
     <circle cx="37" cy="37" r="3.3" fill="#24213a"/>
     <circle cx="38" cy="36" r="1.2" fill="#fff"/>
     <path d="M43 38l6.5 2.4l-6.5 2.8z" fill="#ffb347"/>
     <ellipse cx="39" cy="43" rx="2.4" ry="1.4" fill="#ffa6b6" opacity="0.9"/>
   </g>`,
  // Vẹt nhỏ: linh vật, chưa biết nói
  hide(MASCOT_SVG, 'm-bubble'),
  // Vẹt biết nói: linh vật kèm bong bóng thoại
  MASCOT_SVG,
  // Vẹt thông thái: đội mũ tốt nghiệp
  `${hide(MASCOT_SVG, 'm-crest')}
   <g class="pet-cap">
     <path d="M22 13.5v5.5c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-5.5z" fill="#3b3658"/>
     <path d="M15 11l16-6.5l16 6.5l-16 6.5z" fill="#24213a"/>
     <path d="M31 11l12 3v7" stroke="#ffd36b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
     <circle cx="43" cy="22.5" r="1.9" fill="#ffd36b"/>
     <circle cx="31" cy="11" r="1.3" fill="#ffd36b"/>
   </g>`,
];

// level: { label, rank } – rank 0..5; không có cấp độ (vd. tiếng Hàn) thì không hiện gì
export default function LevelPet({ level }) {
  if (!level || level.rank < 0) return null;
  const rank = Math.min(level.rank, STAGE_SVG.length - 1);
  const size = 30 + rank * 7; // 30px (trứng) → 65px (vẹt thông thái)
  // Chỉ có hình, không chữ / tooltip – cấp độ xem ở mặt sau thẻ
  return (
    <span className={`level-pet stage-${rank}`} aria-hidden="true">
      <svg width={size} height={size} viewBox={MASCOT_VIEWBOX} dangerouslySetInnerHTML={{ __html: STAGE_SVG[rank] }} />
    </span>
  );
}
