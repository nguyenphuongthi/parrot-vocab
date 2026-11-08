// Chú vẹt ôm thẻ: đầu ló trên mép thẻ, hai chân bám mép trên, hai cánh ôm hai cạnh bên (nằm trong phần đệm của thẻ nên không che chữ).
// Lật thẻ (open) thì dang cánh ra.
function Wing({ side }) {
  return (
    <span className={`hug-wing hug-wing-${side}`} aria-hidden="true">
      <svg viewBox="0 0 40 110" width="100%" height="100%">
        <path d="M36 3C16 6 3 30 5 63c2 25 14 40 30 45c-5-11-5-22 1-33c-6-9-5-20 1-29c-6-11-5-27-1-43z" fill="#5ec3a7" />
        <path d="M33 12C20 18 12 36 13 58" stroke="#86d9c2" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M30 70c-6 6-9 17-6 28c3-1 6-3 9-6c-3-7-4-14-3-22z" fill="#9aa8f7" />
        <path d="M33 45c-7 4-11 12-11 21c4-1 8-3 11-6c-2-5-2-10 0-15z" fill="#7ed6bd" />
      </svg>
    </span>
  );
}

export default function HugParrot({ open, onClick }) {
  return (
    <>
      <button type="button" className="hug-head" onClick={onClick} aria-label={open ? 'Lật lại mặt trước' : 'Lật thẻ'} title={open ? 'Lật lại' : 'Lật thẻ'}>
        <svg viewBox="0 0 60 52" width="60" height="52" aria-hidden="true">
          <g className="hug-crest">
            <ellipse cx="24" cy="10" rx="2.6" ry="6" transform="rotate(-25 24 10)" fill="#9aa8f7" />
            <ellipse cx="30" cy="8" rx="2.8" ry="6.6" fill="#ff9f88" />
            <ellipse cx="36" cy="10" rx="2.6" ry="6" transform="rotate(25 36 10)" fill="#7ed6bd" />
          </g>
          <ellipse cx="30" cy="32" rx="20" ry="18" fill="#86d9c2" />
          <ellipse cx="30" cy="38" rx="12" ry="9" fill="#fff3dc" />
          <ellipse cx="17.5" cy="36" rx="3.2" ry="2" fill="#ffa6b6" />
          <ellipse cx="42.5" cy="36" rx="3.2" ry="2" fill="#ffa6b6" />
          <g className="hug-eyes">
            <circle cx="22.5" cy="29" r="3.2" fill="#24213a" />
            <circle cx="37.5" cy="29" r="3.2" fill="#24213a" />
            <circle cx="23.6" cy="27.9" r="1.1" fill="#fff" />
            <circle cx="38.6" cy="27.9" r="1.1" fill="#fff" />
          </g>
          <g className="hug-eyes-happy" fill="none" stroke="#24213a" strokeWidth="1.8" strokeLinecap="round">
            <path d="M19.5 30q3-3.4 6 0" />
            <path d="M34.5 30q3-3.4 6 0" />
          </g>
          <path d="M26 33.5q4-3 8 0q-1 5.5-4 7.5q-3-2-4-7.5z" fill="#ffb347" />
          <path d="M27.5 37.5q2.5 1.4 5 0q-1 2.6-2.5 3.5q-1.5-.9-2.5-3.5z" fill="#e8891f" />
        </svg>
      </button>
      <span className="hug-toes" aria-hidden="true">
        <i />
        <i />
      </span>
      <Wing side="l" />
      <Wing side="r" />
    </>
  );
}
