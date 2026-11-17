// Khung chi tiết một điểm ngữ pháp (tiếng Anh / Hàn / Nhật): công thức, cách dùng + ví dụ, lưu ý,
// lỗi thường gặp, luyện tập (gõ đáp án để kiểm tra) và các điểm liên quan.
import { useRef, useState } from 'react';
import { itemKey, setMark, useLangItems } from '../../lib/store.js';
import { markOf } from '../../lib/srs.js';
import { speak, useCanSpeak } from '../../lib/speech.js';
import { MarkPicker } from '../../components/ui/Mark.jsx';
import { SpeakerIcon } from '../../components/ui/Icons.jsx';
import DetailNav, { DetailPager, useDetailCard } from '../../components/ui/DetailNav.jsx';
import { romanize } from '../ko/romanize.js';
import { Romaji, Ruby } from '../ja/JaText.jsx';
import { JAPANESE, answerKey, hasKanji, jaPlain, romajiKey, toHiragana, toRomaji } from '../ja/text.js';
import { LevelBadge } from './levels.jsx';

// Chuỗi có đoạn 【…】 (phần ngữ pháp cần chú ý) → tô đậm đoạn đó.
export function Marked({ text }) {
  const parts = text.split(/【|】/);
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

// Bỏ dấu 【】 và phần cách đọc {漢字|かな} → 漢字 (tiếng Nhật)
export const plain = (s) => s.replace(/【|】/g, '').replace(/\{([^|{}]+)\|[^|{}]+\}/g, '$1');

// Chữ có đánh dấu theo ngôn ngữ: tiếng Nhật có furigana; sentence = câu tiếng Nhật (bỏ dấu cách tách từ)
export function GText({ text, lang, sentence = false }) {
  if (lang === 'ja') return <Ruby text={text} keepSpaces={!sentence} lang={sentence ? 'ja' : null} />;
  return <Marked text={text} />;
}

const VOICE = { en: ['en-US', 0.95], ko: ['ko-KR', 0.85], ja: ['ja-JP', 0.85] };

function SpeakButton({ text, lang }) {
  const [voice, rate] = VOICE[lang];
  const can = useCanSpeak(voice);
  if (!can) return null;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        speak(lang === 'ja' ? jaPlain(text) : plain(text), voice, { rate });
      }}
      aria-label="Nghe câu"
      title="Nghe câu"
    >
      <SpeakerIcon size={16} />
    </button>
  );
}

function Example({ ex: [target, vi], lang }) {
  return (
    <li className="gb-ex">
      <div className="gb-ex-line">
        <span className="gb-ex-target" lang={lang}>
          <GText text={target} lang={lang} sentence />
        </span>
        <SpeakButton text={target} lang={lang} />
      </div>
      {lang === 'ko' && <div className="gb-ex-rr">{romanize(plain(target))}</div>}
      {lang === 'ja' && <Romaji text={target} className="gb-ex-rr" />}
      <div className="gb-ex-vi">{vi}</div>
    </li>
  );
}

// So khớp đáp án: không phân biệt hoa thường, khoảng trắng, dấu câu cuối, kiểu dấu nháy.
const norm = (s) =>
  plain(s)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Tiếng Nhật: gõ bằng kana hoặc romaji đều được (trợ từ は／へ／を chấp nhận cả wa／e／o lẫn ha／he／wo)
function jaMatch(input, answer) {
  const typed = answerKey(input);
  if (!typed) return false;
  if (typed === answerKey(answer)) return true;
  if (JAPANESE.test(input) || hasKanji(answer)) return false;
  const kana = toHiragana(jaPlain(answer));
  return typed === romajiKey(kana) || typed === toRomaji(kana).replace(/[^a-z]/g, '');
}

function Practice({ item: [q, a], n, lang }) {
  const answers = a.split('/').map((x) => x.trim());
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null); // null | 'ok' | 'wrong' | 'shown'
  const [before, after] = q.split('___');
  const check = (e) => {
    e.preventDefault();
    if (!value.trim()) return setResult('shown');
    const ok = lang === 'ja' ? answers.some((x) => jaMatch(value, x)) : answers.some((x) => norm(x) === norm(value));
    setResult(ok ? 'ok' : 'wrong');
  };
  return (
    <li className={`gb-practice is-${result || 'new'}`}>
      <span className="ex-num">{n}</span>
      <form className="gb-practice-body" onSubmit={check}>
        <span lang={lang} className="gb-practice-q">
          {lang === 'ja' ? <GText text={before} lang={lang} sentence /> : before}
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (result && result !== 'shown') setResult(null);
            }}
            aria-label={`Câu ${n}: điền vào chỗ trống`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            lang={lang}
            size={Math.max(6, Math.min(24, answers[0].length + 2))}
          />
          {lang === 'ja' ? <GText text={after} lang={lang} sentence /> : after}
        </span>
        <span className="gb-practice-actions">
          <button type="submit" className="btn small">
            {value.trim() ? 'Kiểm tra' : 'Xem đáp án'}
          </button>
          {result === 'ok' && <span className="gb-ok">✓ Chính xác</span>}
          {(result === 'wrong' || result === 'shown') && (
            <span className="gb-answer">
              {result === 'wrong' && <span className="gb-bad">✗ Chưa đúng · </span>}
              Đáp án: <b lang={lang}>{answers.join(' / ')}</b>
            </span>
          )}
        </span>
      </form>
    </li>
  );
}

export default function GrammarPoint({ point, num, lang, nav, onJump, titleOf }) {
  const ref = useRef(null);
  const enter = useDetailCard(ref, nav);
  const mark = markOf(useLangItems(lang)[`g:${point.id}`]);
  return (
    <div className={`detail g-detail gb-detail ${enter}`} ref={ref}>
      <div className="detail-head">
        <span className="g-num">{num}</span>
        <span className="g-title gb-title" lang={lang}>
          {point.title}
        </span>
        <DetailNav noun="Điểm ngữ pháp" {...nav} />
      </div>
      <div className="gb-sub">
        <LevelBadge lang={lang} level={point.level} long />
        <span>{point.sub}</span>
      </div>
      <div className="reading g-tools">
        <MarkPicker
          value={mark}
          onChange={(v) => setMark('items', itemKey(lang, `g:${point.id}`), v)}
          label="Mức độ thuộc điểm ngữ pháp"
        />
      </div>

      {point.form?.length > 0 && (
        <section className="gb-block">
          <h4>Cấu trúc</h4>
          {/* Tiếng Nhật: công thức có xen tiếng Việt – phần chữ Nhật tự gắn lang="ja" */}
          <ul className="gb-form" lang={lang === 'ja' ? undefined : lang}>
            {point.form.map((f, i) => (
              <li key={i}>
                <GText text={f} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {point.uses.map((u, i) => (
        <section className="use gb-block" key={i}>
          {point.uses.length > 1 && <div className="use-label">Cách dùng {i + 1}</div>}
          <p className="gb-explain">
            <GText text={u.vi} lang={lang} />
          </p>
          <ul className="gb-examples">
            {u.ex.map((ex, j) => (
              <Example key={j} ex={ex} lang={lang} />
            ))}
          </ul>
        </section>
      ))}

      {point.notes?.length > 0 && (
        <section className="gb-block gb-notes">
          <h4>Lưu ý</h4>
          <ul>
            {point.notes.map((t, i) => (
              <li key={i}>
                <GText text={t} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {point.mistakes?.length > 0 && (
        <section className="gb-block">
          <h4>Lỗi thường gặp</h4>
          <ul className="gb-mistakes">
            {point.mistakes.map(([wrong, right, why], i) => (
              <li key={i}>
                <div className="gb-wrong" lang={lang}>
                  <span aria-label="Sai">✗</span> {lang === 'ja' ? <GText text={wrong} lang={lang} sentence /> : wrong}
                </div>
                <div className="gb-right" lang={lang}>
                  <span aria-label="Đúng">✓</span> {lang === 'ja' ? <GText text={right} lang={lang} sentence /> : right}
                </div>
                <div className="gb-why">{why}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {point.practice?.length > 0 && (
        <section className="gb-block">
          <h4>Luyện tập</h4>
          <p className="muted small">Điền vào chỗ trống rồi bấm Kiểm tra (để trống thì xem đáp án).</p>
          <ol className="gb-practices">
            {point.practice.map((item, i) => (
              <Practice key={i} item={item} n={i + 1} lang={lang} />
            ))}
          </ol>
        </section>
      )}

      {point.see?.length > 0 && (
        <section className="gb-block gb-see">
          <h4>Xem thêm</h4>
          {point.see.map((id) => (
            <button key={id} type="button" className="chip" onClick={() => onJump(id)} lang={lang}>
              {titleOf(id)}
            </button>
          ))}
        </section>
      )}
      <DetailPager noun="Điểm ngữ pháp" {...nav} />
    </div>
  );
}
