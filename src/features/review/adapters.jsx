// Mỗi ngôn ngữ biến dữ liệu của mình thành "thẻ" chung cho Flashcard:
//   { key, table, id, word, wordLang, meaning, scope, order, answers, entry, speak(), Back }
import { useEffect, useMemo, useState } from 'react';
import { useLangItems, useTable } from '../../lib/store.js';
import { speak } from '../../lib/speech.js';
import { useSettings } from '../../lib/settings.js';
import { CEFR_LEVELS, POS_INFO, POS_ORDER, categoriesOf, categoryName, cefrOf, useCefr } from '../en/cefr.js';
import { AccentButtons, CefrBadge, Contexts, Details, Meanings, playEnglish, synonymsOf } from '../en/parts.jsx';
import { loadAllWords, loadIndex } from '../zh/data.js';
import { fold } from '../../lib/text.js';
import { loadKo } from '../ko/data.js';
import { loadJa } from '../ja/data.js';
import { Romaji, Ruby, sayJa } from '../ja/JaText.jsx';
import { Forms } from '../ja/JaWords.jsx';
import { TYPE_LABEL } from '../ja/conjugate.js';
import { splitKun } from '../ja/entries.js';
import { answerKey, romajiKey, toHiragana } from '../ja/text.js';
import { wordKey } from '../../lib/srs.js';

export const MODES = {
  en: [
    ['front', 'Anh → Việt'],
    ['back', 'Việt → Anh'],
    ['listen', 'Nghe đoán từ'],
    ['type', 'Gõ chính tả'],
    ['choice', 'Trắc nghiệm'],
  ],
  zh: [
    ['front', 'Chữ Hán → nghĩa'],
    ['back', 'Nghĩa → chữ Hán'],
    ['listen', 'Nghe đoán từ'],
    ['type', 'Gõ pinyin'],
    ['choice', 'Trắc nghiệm'],
  ],
  ko: [
    ['front', 'Hàn → Việt'],
    ['back', 'Việt → Hàn'],
    ['listen', 'Nghe đoán từ'],
    ['type', 'Gõ chữ Hàn'],
    ['choice', 'Trắc nghiệm'],
  ],
  ja: [
    ['front', 'Nhật → Việt'],
    ['back', 'Việt → Nhật'],
    ['listen', 'Nghe đoán từ'],
    ['type', 'Gõ cách đọc'],
    ['choice', 'Trắc nghiệm'],
  ],
};

// ---------- Tiếng Anh ----------

function EnBack({ card }) {
  const w = card.raw;
  const [more, setMore] = useState(false);
  const firstDef = w.senses?.[0]?.definitions?.[0];
  const synonyms = synonymsOf(w);
  return (
    <>
      <div className="fc-title">
        {w.word} <CefrBadge cefr={card.cefr} />
      </div>
      <AccentButtons entry={w} />
      <div className="fc-meaning-main">{w.translation}</div>
      <Meanings entry={w} limit={6} />
      {synonyms.length > 0 && (
        <p className="fc-synonyms">
          <span className="muted">Đồng nghĩa:</span> {synonyms.join(', ')}
        </p>
      )}
      <button type="button" className="btn ghost small" aria-expanded={more} onClick={(e) => (e.stopPropagation(), setMore((m) => !m))}>
        {more ? 'Ẩn chi tiết ▴' : 'Xem chi tiết ▾'}
      </button>
      {more && (
        <div className="fc-details">
          <Contexts entry={w} limit={2} />
          {w.details ? <Details d={w.details} word={w.word} /> : firstDef && <p className="definition">{firstDef.gloss}</p>}
        </div>
      )}
    </>
  );
}

// Cấp độ của thẻ cho chú vẹt trên flashcard: rank 0 (A1 / HSK 1) → 5 (C2 / HSK 6)
function levelOf(cefr) {
  const rank = CEFR_LEVELS.indexOf(cefr);
  return rank < 0 ? null : { label: cefr, rank };
}

function useEnglishDeck() {
  const words = useTable('words');
  const cefr = useCefr();
  const { accent } = useSettings();
  return useMemo(() => {
    const cards = Object.values(words).map((w, i) => ({
      key: w.key,
      table: 'words',
      id: w.key,
      word: w.word,
      wordLang: 'en',
      meaning: w.translation || '',
      scopes: categoriesOf(w),
      order: -(w.addedAt || i),
      answers: [w.key, ...(w.forms || [])].map(normalizeEn),
      entry: w,
      raw: w,
      cefr: cefrOf(cefr, w),
      level: levelOf(cefrOf(cefr, w)?.level),
      speak: () => playEnglish(w, accent),
      Back: EnBack,
      Prompt: ({ card }) => (
        <>
          <div className="fc-word">{card.word}</div>
          <AccentButtons entry={card.raw} />
        </>
      ),
    }));
    const counts = new Map();
    for (const c of cards) for (const s of c.scopes) counts.set(s, (counts.get(s) || 0) + 1);
    const order = [...POS_ORDER, ...[...counts.keys()].filter((c) => !POS_ORDER.includes(c) && c !== 'phrase' && c !== 'other'), 'phrase', 'other'];
    const scopes = order
      .filter((c) => counts.has(c))
      .map((c) => ({ id: c, label: `${POS_INFO[c]?.abbr ? POS_INFO[c].abbr + ' ' : ''}${categoryName(c)}`, count: counts.get(c) }));
    return { ready: true, cards, scopes, hasNew: false, scopeLabel: 'Mọi từ loại' };
  }, [words, cefr, accent]);
}

const normalizeEn = (s) => wordKey(s || '').replace(/[^a-z' -]/g, '');

// ---------- Tiếng Trung ----------

function ZhBack({ card }) {
  const x = card.raw;
  const [reveal, setReveal] = useState(false);
  const sentence = x.ex?.ruby?.map((r) => r[0]).join('') || '';
  return (
    <>
      <div className="fc-title">
        <span lang="zh-CN">{x.w}</span>{' '}
        {x.level > 0 && (
          // Cùng kiểu huy hiệu CEFR: HSK 1–2 xanh lá · 3–4 xanh dương · 5–6 tím
          <span className={`cefr cefr-${'abc'[Math.min(2, Math.floor((x.level - 1) / 2))]}`} title={`Cấp độ HSK ${x.level}`}>
            HSK {x.level}
          </span>
        )}
      </div>
      <div className="fc-reading">
        <span className="pinyin">{x.py}</span>
        {x.hv && <span className="hanviet">{x.hv}</span>}
      </div>
      <div className="fc-meaning-main">{x.vi}</div>
      {x.en && <p className="muted">{x.en}</p>}
      {sentence && (
        <button type="button" className="fc-example" onClick={(e) => (e.stopPropagation(), setReveal((r) => !r))}>
          <span lang="zh-CN" className="fc-example-zh">
            {sentence}
          </span>
          {reveal ? (
            <>
              <span className="pinyin small">{x.ex.ruby.map((r) => r[1]).filter(Boolean).join(' ')}</span>
              <span>{x.ex.vi}</span>
              {x.ex.en && <span className="muted">{x.ex.en}</span>}
            </>
          ) : null}
        </button>
      )}
    </>
  );
}

const pinyinKey = (s) => fold(s || '').replace(/[^a-z]/g, '');

function useChineseDeck() {
  const progress = useLangItems('zh');
  const [words, setWords] = useState(null);
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadIndex()
      .then((i) => setLevels(i.levels))
      .catch(() => {});
    loadAllWords()
      .then(setWords)
      .catch((e) => setError(e.message));
  }, []);
  return useMemo(() => {
    if (!words) return { ready: false, error, cards: [], scopes: [] };
    const cards = words.map((x, i) => ({
      key: `zh:${x.id}`,
      table: 'items',
      id: x.id,
      word: x.w,
      wordLang: 'zh-CN',
      meaning: x.vi,
      scopes: new Set([`hsk${x.level}`]),
      level: x.level ? { label: `HSK ${x.level}`, rank: x.level - 1 } : null,
      order: i,
      answers: [pinyinKey(x.py), x.w],
      entry: progress[x.id],
      raw: x,
      speak: () => speak(x.w, 'zh-CN'),
      Back: ZhBack,
      Prompt: ({ card }) => (
        <div className="fc-word" lang="zh-CN">
          {card.word}
        </div>
      ),
    }));
    const scopes = levels.map((l) => ({ id: `hsk${l.level}`, label: `HSK ${l.level}`, count: l.total }));
    return { ready: true, cards, scopes, hasNew: true, scopeLabel: 'HSK 1–6' };
  }, [words, levels, progress, error]);
}

// ---------- Tiếng Hàn ----------

function KoBack({ card }) {
  const e = card.raw;
  return (
    <>
      <div className="fc-title" lang="ko">
        {e.ko}
      </div>
      <div className="fc-reading">
        <span className="pinyin">{e.rr}</span>
        {e.pron && (
          <span className="hanviet" lang="ko">
            [{e.pron}]
          </span>
        )}
        {e.hv && <span className="hanviet">{e.hv}</span>}
      </div>
      <div className="fc-meaning-main">{e.vi}</div>
      {e.note && <p className="muted">{e.note}</p>}
    </>
  );
}

const hangulKey = (s) => (s || '').replace(/[^가-힣]/g, '');

function useKoreanDeck() {
  const progress = useLangItems('ko');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadKo()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return useMemo(() => {
    if (!data) return { ready: false, error, cards: [], scopes: [] };
    const all = [...data.words, ...data.phrases];
    const cards = all.map((e, i) => ({
      key: `ko:${e.id}`,
      table: 'items',
      id: e.id,
      word: e.ko,
      wordLang: 'ko',
      meaning: e.vi,
      scopes: new Set(e.kind === 'p' ? ['phrases'] : [e.group, 'words', `topik${e.level}`]),
      level: e.level ? { label: `TOPIK ${e.level}`, rank: e.level - 1 } : null,
      order: i,
      answers: [hangulKey(e.ko)],
      entry: progress[e.id],
      raw: e,
      speak: () => speak(e.ko, 'ko-KR', { rate: 0.85 }),
      Back: KoBack,
      Prompt: ({ card }) => (
        <div className={`fc-word ${card.raw.kind === 'p' ? 'is-phrase' : ''}`} lang="ko">
          {card.word}
        </div>
      ),
    }));
    const scopes = [
      { id: 'words', label: 'Tất cả từ vựng', count: data.words.length },
      ...[1, 2].map((l) => ({ id: `topik${l}`, label: `Từ vựng TOPIK ${l}`, count: data.words.filter((e) => e.level === l).length })),
      ...data.topics.map((t) => ({ id: t.id, label: `· ${t.name}`, count: t.items.length })),
      { id: 'phrases', label: 'Câu giao tiếp', count: data.phrases.length },
    ];
    return { ready: true, cards, scopes, hasNew: true, scopeLabel: 'Từ vựng + câu giao tiếp' };
  }, [data, progress, error]);
}

// ---------- Tiếng Nhật ----------

function JaBack({ card }) {
  const e = card.raw;
  if (e.kind === 'k') {
    return (
      <>
        <div className="fc-title" lang="ja">
          {e.ja} <span className="hanviet">{e.hv}</span>
        </div>
        <div className="fc-meaning-main">{e.vi}</div>
        <div className="fc-reading">
          {e.on.length > 0 && (
            <span className="pinyin" lang="ja" title="Âm On">
              {e.on.join('・')}
            </span>
          )}
          {e.kun.length > 0 && (
            <span className="hanviet" lang="ja" title="Âm Kun">
              {e.kun.map((r) => splitKun(r).kana).join('・')}
            </span>
          )}
        </div>
        <ul className="fc-ja-ex">
          {e.ex.slice(0, 3).map((x) => (
            <li key={x.ja + x.kana}>
              <Ruby text={x.ruby} /> <Romaji rm={x.rm} className="small" /> · {x.vi}
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <div className="fc-title">
        <Ruby text={e.kind === 'p' ? e.text : e.ruby} />
      </div>
      <div className="fc-reading">
        <Romaji rm={e.rm} className="pinyin" />
        {e.kind === 'w' && e.kana !== e.ja && (
          <span className="hanviet" lang="ja">
            {e.kana}
          </span>
        )}
        {e.hv && <span className="hanviet">{e.hv}</span>}
        {e.t && <span className="cefr cefr-a">{TYPE_LABEL[e.t]}</span>}
      </div>
      <div className="fc-meaning-main">{e.vi}</div>
      {e.note && <p className="muted">{e.note}</p>}
      {e.kind === 'w' && <Forms entry={e} />}
    </>
  );
}

// Đáp án chấp nhận khi gõ: kana (hiragana / katakana), chữ viết, romaji
const jaAnswers = (...kanas) => kanas.flatMap((k) => [answerKey(k), romajiKey(k)]);

function useJapaneseDeck() {
  const progress = useLangItems('ja');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadJa()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return useMemo(() => {
    if (!data) return { ready: false, error, cards: [], scopes: [] };
    const base = (e, i) => ({
      key: `ja:${e.id}`,
      table: 'items',
      id: e.id,
      word: e.ja,
      wordLang: 'ja',
      meaning: e.kind === 'k' ? `${e.hv} – ${e.vi}` : e.vi,
      level: { label: 'N5', rank: 0 },
      order: i,
      entry: progress[e.id],
      raw: e,
      Back: JaBack,
    });
    const words = data.words.map((e, i) => ({
      ...base(e, i),
      scopes: new Set([e.group, 'words']),
      answers: [answerKey(e.ja), ...jaAnswers(e.kana)],
      speak: () => sayJa(e.kana),
      Prompt: ({ card }) => (
        <div className="fc-word" lang="ja">
          {card.word}
        </div>
      ),
    }));
    const kanji = data.kanji.map((e, i) => {
      // Đọc theo âm Kun (nếu có) – chữ đứng một mình thường đọc như vậy
      const readings = [...e.kun.map((r) => splitKun(r).kana), ...e.on.map(toHiragana)];
      return {
        ...base(e, words.length + i),
        scopes: new Set(['kanji', `kanji-${e.group}`]),
        answers: [e.ja, ...jaAnswers(...readings)],
        speak: () => sayJa(readings[0] || e.ja),
        Prompt: ({ card }) => (
          <div className="fc-word fc-kanji" lang="ja">
            {card.word}
          </div>
        ),
      };
    });
    const phrases = data.phrases.map((e, i) => ({
      ...base(e, words.length + kanji.length + i),
      scopes: new Set(['phrases']),
      answers: [answerKey(e.ja), ...jaAnswers(e.kana)],
      speak: () => sayJa(e.ja),
      Prompt: ({ card }) => (
        <div className="fc-word is-phrase" lang="ja">
          {card.word}
        </div>
      ),
    }));
    const scopes = [
      { id: 'words', label: 'Tất cả từ vựng', count: data.words.length },
      ...data.topics.map((t) => ({ id: t.id, label: `· ${t.name}`, count: t.items.length })),
      { id: 'kanji', label: 'Kanji N5', count: data.kanji.length },
      ...data.kanjiGroups.map((g) => ({ id: `kanji-${g.id}`, label: `· Kanji: ${g.name}`, count: g.items.length })),
      { id: 'phrases', label: 'Câu giao tiếp', count: data.phrases.length },
    ];
    return { ready: true, cards: [...words, ...kanji, ...phrases], scopes, hasNew: true, scopeLabel: 'Từ vựng + Kanji + câu giao tiếp' };
  }, [data, progress, error]);
}

// Hook dữ liệu thẻ theo ngôn ngữ. Nơi gọi phải gắn key={lang} để mỗi ngôn ngữ là một component riêng
// (thứ tự hook không đổi trong suốt vòng đời component).
export const DECK_HOOKS = { en: useEnglishDeck, zh: useChineseDeck, ko: useKoreanDeck, ja: useJapaneseDeck };

export function normalizeAnswer(lang, s) {
  if (lang === 'en') return normalizeEn(s);
  if (lang === 'zh') return /[一-鿿]/.test(s) ? s.trim() : pinyinKey(s);
  if (lang === 'ja') return answerKey(s);
  return hangulKey(s);
}
