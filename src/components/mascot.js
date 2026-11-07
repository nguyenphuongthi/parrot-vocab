// Linh vật: chú vẹt pastel (vẹt "học nói" – hợp với app học ngôn ngữ). Ba lông mào mang ba màu của
// Anh (lavender) · Trung (san hô) · Hàn (bạc hà). Một nguồn duy nhất cho Logo.jsx và icon app (scripts/build-icons.mjs).
export const MASCOT_VIEWBOX = '0 0 64 64';
export const MASCOT_SVG = `
  <g class="m-crest">
    <ellipse cx="25" cy="13.5" rx="3.2" ry="7" transform="rotate(-28 25 13.5)" fill="#9aa8f7"/>
    <ellipse cx="30.5" cy="11" rx="3.4" ry="7.5" fill="#ff9f88"/>
    <ellipse cx="36" cy="13.5" rx="3.2" ry="7" transform="rotate(28 36 13.5)" fill="#7ed6bd"/>
  </g>
  <path d="M24 57.5v4.5M34 57.5v4.5" stroke="#f5a23c" stroke-width="3.2" stroke-linecap="round"/>
  <ellipse cx="30" cy="38" rx="20" ry="21" fill="#86d9c2"/>
  <ellipse cx="32.5" cy="45" rx="12" ry="12.5" fill="#fff3dc"/>
  <path d="M12.5 33c-4 9 0 19 9 21c2-9-2-17-9-21z" fill="#5ec3a7"/>
  <ellipse cx="38.6" cy="37.6" rx="3.4" ry="2.2" fill="#ffa6b6" opacity="0.9"/>
  <g class="m-eye">
    <circle cx="35.5" cy="29.5" r="5.2" fill="#24213a"/>
    <circle cx="37.3" cy="27.7" r="1.9" fill="#fff"/>
    <circle cx="34.2" cy="31.3" r="0.9" fill="#fff"/>
  </g>
  <path d="M42 28.5c7.5-1 11.5 3.2 11 8.6c-.3 3-2.6 4.6-5 4.4c1.4-3.4-.4-6.4-6-6.8z" fill="#ffb347"/>
  <path d="M42 35.2c3.4.3 5.6 1.8 6 4.2c-2.2 1.2-4.8.6-6-1.4z" fill="#e8891f"/>
  <g class="m-bubble">
    <path d="M47.5 15.5l-2.5 5.5l6.5-4z" fill="#fff" stroke="#24213a" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="44" y="3" width="18" height="13.5" rx="6.5" fill="#fff" stroke="#24213a" stroke-width="1.6"/>
    <path d="M47.5 16.2l3.6-.2" stroke="#fff" stroke-width="2"/>
    <circle class="m-dot" cx="49" cy="9.8" r="1.4" fill="#24213a"/>
    <circle class="m-dot" cx="53" cy="9.8" r="1.4" fill="#24213a"/>
    <circle class="m-dot" cx="57" cy="9.8" r="1.4" fill="#24213a"/>
  </g>
`;
