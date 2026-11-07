// Bảng chữ cái Hangul: nguyên âm, phụ âm, patchim, quy tắc biến âm, ô ghép chữ và ô thử phiên âm.
import { useState } from 'react';
import {
  BASIC_CONSONANTS, BASIC_VOWELS, BATCHIM, BATCHIM_NOTE, COMPOUND_VOWELS, INTRO, RULES,
  TENSE_CONSONANTS, THREE_WAY, THREE_WAY_NOTE, VOWEL_NOTES,
} from './data/alphabet.js';
import { compose, pronounce, romanize } from './romanize.js';
import { speak, useCanSpeak } from '../../lib/speech.js';
import { SpeakerIcon } from '../../components/ui/Icons.jsx';
import Disclosure from '../../components/ui/Disclosure.jsx';
import Strokes from './Strokes.jsx';
import { markJamoHeard } from '../../lib/achievements.js';

const say = (text) => speak(text, 'ko-KR', { rate: 0.8 });

function Listen({ text, label }) {
  const can = useCanSpeak('ko-KR');
  if (!can) return null;
  return (
    <button type="button" className="icon-btn" onClick={(e) => (e.stopPropagation(), say(text))} aria-label={label || `Nghe ${text}`} title="Nghe">
      <SpeakerIcon size={16} />
    </button>
  );
}

// Thẻ một chữ cái: bấm để nghe (nguyên âm đọc với ㅇ câm, phụ âm đọc tên chữ) và xem viết từng nét
function JamoCard({ jamo, rr, hint, example, meaning, name, sound, index = 0 }) {
  const [play, setPlay] = useState(0);
  const onClick = () => {
    say(sound);
    markJamoHeard(jamo);
    setPlay((n) => n + 1);
  };
  return (
    <button type="button" className="jamo" style={{ '--i': index }} onClick={onClick} aria-label={`Nghe và xem cách viết ${jamo}`}>
      <span className="jamo-char has-strokes" lang="ko">
        <Strokes char={jamo} size={52} animate={play > 0} playKey={play} label={jamo} />
      </span>
      <span className="jamo-rr">{rr}</span>
      {name && <span className="jamo-name" lang="ko">{name}</span>}
      <span className="jamo-hint">{hint}</span>
      <span className="jamo-ex">
        <span lang="ko">{example}</span> <span className="muted">{romanize(example)}</span> · {meaning}
      </span>
    </button>
  );
}

const vowelSound = (v) => compose({ i: 'ㅇ', v });

function Builder() {
  const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const FINALS = ['', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㅆ'];
  const [i, setI] = useState('ㅎ');
  const [v, setV] = useState('ㅏ');
  const [f, setF] = useState('ㄴ');
  const syllable = compose({ i, v, f });
  const row = (list, value, set, label) => (
    <div className="builder-row" role="radiogroup" aria-label={label}>
      <span className="builder-label">{label}</span>
      {list.map((x) => (
        <button key={x || 'none'} type="button" role="radio" aria-checked={x === value} className={`chip-key ${x === value ? 'is-on' : ''}`} onClick={() => set(x)}>
          {x || '∅'}
        </button>
      ))}
    </div>
  );
  return (
    <div className="builder">
      <div className="builder-out">
        <span className="builder-syllable has-strokes" lang="ko">
          <Strokes char={syllable} size={84} step={0.3} label={syllable} />
        </span>
        <span className="builder-rr">{romanize(syllable)}</span>
        <Listen text={syllable} />
      </div>
      {row(INITIALS, i, setI, 'Phụ âm đầu')}
      {row(VOWELS, v, setV, 'Nguyên âm')}
      {row(FINALS, f, setF, 'Patchim')}
    </div>
  );
}

function Tryout() {
  const [text, setText] = useState('감사합니다');
  const p = pronounce(text);
  return (
    <div className="tryout">
      <label className="field">
        <span>Cách đọc &amp; phiên âm</span>
        <input value={text} onChange={(e) => setText(e.target.value)} lang="ko" placeholder="vd. 한국어" />
      </label>
      <p className="tryout-out">
        <span lang="ko">[{p}]</span> <b>{romanize(text)}</b> <Listen text={text} />
      </p>
    </div>
  );
}

export default function KoAlphabet() {
  return (
    <div className="alphabet">
      <section className="card prose">
        <h2>Hangul là gì?</h2>
        {INTRO.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <Disclosure zh="모음" sub="Nguyên âm cơ bản (10)" defaultOpen>
        <div className="jamo-grid">
          {BASIC_VOWELS.map(([j, rr, hint, ex, m], i) => (
            <JamoCard key={j} index={i} jamo={j} rr={rr} hint={hint} example={ex} meaning={m} sound={vowelSound(j)} />
          ))}
        </div>
      </Disclosure>

      <Disclosure zh="이중 모음" sub="Nguyên âm ghép (11)">
        <div className="jamo-grid">
          {COMPOUND_VOWELS.map(([j, rr, hint, ex, m], i) => (
            <JamoCard key={j} index={i} jamo={j} rr={rr} hint={hint} example={ex} meaning={m} sound={vowelSound(j)} />
          ))}
        </div>
        <ul className="notes">
          {VOWEL_NOTES.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Disclosure>

      <Disclosure zh="자음" sub="Phụ âm cơ bản (14)">
        <div className="jamo-grid">
          {BASIC_CONSONANTS.map(([j, name, rr, hint, ex, m], i) => (
            <JamoCard key={j} index={i} jamo={j} name={name} rr={rr} hint={hint} example={ex} meaning={m} sound={name} />
          ))}
        </div>
      </Disclosure>

      <Disclosure zh="된소리" sub="Phụ âm căng (5) & ba dãy phụ âm">
        <div className="jamo-grid">
          {TENSE_CONSONANTS.map(([j, name, rr, hint, ex, m], i) => (
            <JamoCard key={j} index={i} jamo={j} name={name} rr={rr} hint={hint} example={ex} meaning={m} sound={name} />
          ))}
        </div>
        <table className="three-way">
          <thead>
            <tr>
              <th>Thường</th>
              <th>Bật hơi</th>
              <th>Căng</th>
            </tr>
          </thead>
          <tbody>
            {THREE_WAY.map((r) => (
              <tr key={r[0]}>
                {r.map((s, i) => (
                  <td key={i}>
                    {s && (
                      <button type="button" className="three-cell" onClick={() => say(s)}>
                        <span lang="ko">{s}</span> <small>{romanize(s)}</small>
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="notes">{THREE_WAY_NOTE}</p>
      </Disclosure>

      <Disclosure zh="받침" sub="Patchim – phụ âm cuối (7 âm)">
        <div className="batchim">
          {BATCHIM.map(([rep, rr, group, examples, hint]) => (
            <div className="batchim-row" key={rep}>
              <span className="batchim-rep" lang="ko">
                [{rep}]
              </span>
              <span className="batchim-rr">{rr}</span>
              <span className="batchim-group" lang="ko">{group}</span>
              <span className="batchim-ex">
                {examples.map((e) => (
                  <button key={e} type="button" className="word-chip" onClick={() => say(e)}>
                    <span lang="ko">{e}</span> <small>[{pronounce(e)}]</small>
                  </button>
                ))}
              </span>
              <span className="muted small">{hint}</span>
            </div>
          ))}
        </div>
        <p className="notes">{BATCHIM_NOTE}</p>
      </Disclosure>

      <Disclosure zh="발음 규칙" sub="Quy tắc biến âm">
        <div className="rules">
          {RULES.map(([name, ko, desc, examples]) => (
            <div className="rule" key={name}>
              <h3>
                {name} <span lang="ko">{ko}</span>
              </h3>
              <p>{desc}</p>
              <div className="rule-ex">
                {examples.map((e) => (
                  <button key={e} type="button" className="word-chip" onClick={() => say(e)}>
                    <span lang="ko">{e}</span> → <span lang="ko">[{pronounce(e)}]</span> <small>{romanize(e)}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Disclosure>

      <Disclosure zh="글자 만들기" sub="Thử ghép chữ & tra phiên âm">
        <Builder />
        <Tryout />
      </Disclosure>

      <footer className="foot">
        Tham khảo: 표준 발음법 và 국어의 로마자 표기법 (Viện Quốc ngữ Quốc gia Hàn Quốc – 국립국어원), giáo trình 세종한국어
        (King Sejong Institute). Cách gần đúng bằng tiếng Việt chỉ là gợi ý – hãy nghe và bắt chước giọng đọc mẫu.
      </footer>
    </div>
  );
}
