// Bảng chữ cái kana: Hiragana / Katakana (bảng 50 âm, âm đục, âm ghép, âm mở rộng), quy tắc phát âm
// và ô thử chuyển romaji ↔ kana. Bấm một chữ để nghe và xem viết từng nét (KanjiVG).
import { useState } from 'react';
import { DAKUON, EXAMPLES, EXTENDED, GOJUON, HINTS, INTRO, KATA_EXAMPLES, RULES, YOON } from './kana.js';
import { romajiToKana, toHiragana, toKatakana, toRomaji, JAPANESE } from './text.js';
import { JaSpeak, JaStrokes, RomajiSwitch, sayJa, useRomaji } from './JaText.jsx';
import Disclosure from '../../components/ui/Disclosure.jsx';
import { usePersisted } from '../../hooks/usePersisted.js';

const VOWELS = ['a', 'i', 'u', 'e', 'o'];

// Ô chi tiết của chữ đang chọn: nét viết (có số thứ tự nét), romaji, gợi ý, từ ví dụ
function KanaDetail({ char, script, play }) {
  const hira = toHiragana(char);
  const example = script === 'kata' ? KATA_EXAMPLES[char] : EXAMPLES[hira];
  const hint = HINTS[hira];
  const single = [...char].length === 1;
  return (
    <div className="kana-detail" aria-live="polite">
      <span className="kana-big has-strokes">{single ? <JaStrokes char={char} size={96} playKey={play} numbers /> : <span lang="ja">{char}</span>}</span>
      <div className="kana-info">
        <div className="kana-rm">
          {toRomaji(char, { particles: false })} <JaSpeak text={char} />
        </div>
        {hint && <div className="kana-hint">{hint}</div>}
        {example && (
          <button type="button" className="word-chip" onClick={() => sayJa(example[0].replace(/ /g, ''))}>
            <span lang="ja">{example[0].replace(/ /g, '')}</span> <small>{toRomaji(example[0])}</small> · {example[1]}
          </button>
        )}
        <span className="muted small">{script === 'kata' ? `Hiragana: ${hira}` : `Katakana: ${toKatakana(char)}`}</span>
      </div>
    </div>
  );
}

// Bảng chữ: mỗi hàng là một dòng; ô trống giữ chỗ để thẳng cột a-i-u-e-o
function Chart({ rows, script, cols = 5, head = VOWELS, label }) {
  const showRm = useRomaji();
  const conv = script === 'kata' ? toKatakana : (c) => c;
  const first = conv(rows[0].find(Boolean));
  const [sel, setSel] = useState(first);
  const [play, setPlay] = useState(0);
  const pick = (c) => {
    setSel(c);
    setPlay((n) => n + 1);
    sayJa(c, 0.8);
  };
  return (
    <div className="kana-block">
      <KanaDetail char={sel} script={script} play={play} />
      <div className="kana-chart" style={{ '--cols': cols }} role="grid" aria-label={label}>
        {head && (
          <div className="kana-row kana-head" role="row">
            {head.map((v) => (
              <span key={v} role="columnheader">
                {v}
              </span>
            ))}
          </div>
        )}
        {rows.map((row, r) => (
          <div className="kana-row" role="row" key={r}>
            {row.map((c0, i) => {
              if (!c0) return <span key={i} className="kana-cell is-empty" role="gridcell" />;
              const c = conv(c0);
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  className={`kana-cell ${sel === c ? 'is-on' : ''}`}
                  style={{ '--i': r * cols + i }}
                  onClick={() => pick(c)}
                  aria-label={`${c} – ${toRomaji(c, { particles: false })}`}
                >
                  <span className="kana-char" lang="ja">
                    {c}
                  </span>
                  {showRm && <span className="kana-cell-rm">{toRomaji(c, { particles: false })}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tryout() {
  const [text, setText] = useState('arigatou');
  const isJa = JAPANESE.test(text);
  const kana = isJa ? text : romajiToKana(text);
  return (
    <div className="tryout">
      <label className="field">
        <span>Gõ romaji (vd. sakura) hoặc kana</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="vd. konnichiwa" autoCapitalize="off" spellCheck="false" />
      </label>
      {text.trim() && (
        <p className="tryout-out">
          {isJa ? (
            <b>{toRomaji(text)}</b>
          ) : (
            <>
              <span lang="ja">{toHiragana(kana)}</span>
              <span lang="ja">{toKatakana(kana)}</span>
            </>
          )}
          <JaSpeak text={kana} />
        </p>
      )}
    </div>
  );
}

export default function JaKana() {
  const [script, setScript] = usePersisted('ja.kana.script', 'hira');
  const isKata = script === 'kata';
  const title = (h, k) => (isKata ? k : h);
  return (
    <div className="alphabet ja-kana">
      <section className="card prose">
        <h2>Ba bộ chữ của tiếng Nhật</h2>
        {INTRO.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </section>

      <div className="filter-row">
        <div className="seg" role="tablist" aria-label="Bộ chữ">
          <button type="button" role="tab" aria-selected={!isKata} className={!isKata ? 'is-on' : ''} onClick={() => setScript('hira')}>
            <span lang="ja">ひらがな</span> Hiragana
          </button>
          <button type="button" role="tab" aria-selected={isKata} className={isKata ? 'is-on' : ''} onClick={() => setScript('kata')}>
            <span lang="ja">カタカナ</span> Katakana
          </button>
        </div>
        <RomajiSwitch />
      </div>

      <Disclosure title={title('ごじゅうおん', 'ゴジュウオン')} lang="ja" sub="Bảng chữ cơ bản (46 chữ)" defaultOpen>
        <Chart key={script} rows={GOJUON} script={script} label="Bảng chữ cơ bản" />
        <ul className="notes">
          <li>Tắt “Romaji” để tự kiểm tra: nhìn chữ, đọc to rồi bấm để nghe lại.</li>
          <li>{isKata ? 'Chữ dễ nhầm: シ (shi) – ツ (tsu), ソ (so) – ン (n), ク (ku) – ケ (ke), ワ (wa) – ウ (u).' : 'Chữ dễ nhầm: ぬ – め, ね – れ – わ, る – ろ, さ – ち, は – ほ.'}</li>
        </ul>
      </Disclosure>

      <Disclosure title={title('だくおん', 'ダクオン')} lang="ja" sub="Âm đục ゛ và bán đục ゜ (25 chữ)">
        <Chart key={script} rows={DAKUON} script={script} label="Âm đục và bán đục" />
      </Disclosure>

      <Disclosure title={title('ようおん', 'ヨウオン')} lang="ja" sub="Âm ghép với ゃ ゅ ょ (33 âm)">
        <Chart key={script} rows={YOON} script={script} cols={3} head={['ya', 'yu', 'yo']} label="Âm ghép" />
      </Disclosure>

      {isKata && (
        <Disclosure title="とくしゅおん" lang="ja" sub="Âm mở rộng của Katakana (từ mượn)">
          <div className="rule-ex">
            {EXTENDED.map(([k, ex, vi]) => (
              <button key={k} type="button" className="word-chip" onClick={() => sayJa(ex)}>
                <b lang="ja">{k}</b> <small>{toRomaji(k)}</small> · <span lang="ja">{ex}</span> <small>{toRomaji(ex)}</small> · {vi}
              </button>
            ))}
          </div>
        </Disclosure>
      )}

      <Disclosure title="はつおん" lang="ja" sub="Quy tắc phát âm">
        <div className="rules">
          {RULES.map(([name, desc, examples]) => (
            <div className="rule" key={name}>
              <h3>{name}</h3>
              <p>{desc}</p>
              <div className="rule-ex">
                {examples.map(([w, vi], i) => (
                  <button key={w + i} type="button" className="word-chip" onClick={() => sayJa(w.replace(/ /g, ''))}>
                    <span lang="ja">{w.replace(/ /g, '')}</span> <small>{toRomaji(w)}</small> · {vi}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Disclosure>

      <Disclosure title="れんしゅう" lang="ja" sub="Thử chuyển romaji ↔ kana">
        <Tryout />
      </Disclosure>

      <footer className="foot">
        Thứ tự nét viết: KanjiVG © Ulrich Apel (CC BY-SA 3.0). Phiên âm theo Hepburn, trường âm viết đôi nguyên âm (ou, ii, ee).
        Tham khảo: bảng chữ và phần phát âm của みんなの日本語 初級 I, まるごと 入門 A1 (Japan Foundation). Gợi ý tiếng Việt chỉ là
        gần đúng – hãy nghe và bắt chước giọng đọc mẫu.
      </footer>
    </div>
  );
}
