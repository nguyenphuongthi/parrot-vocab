// Tra từ mới ngay trong Kho từ (không cần extension): gọi /api/lookup, hiện nghĩa, phiên âm, định nghĩa,
// cho nghe và lưu vào kho (bảng words – cùng định dạng với từ lưu bằng extension, nên đồng bộ sang extension).
import { useEffect, useState } from 'react';
import { getJson, UNAUTHORIZED } from '../../lib/supabase.js';
import { importWords, useTable } from '../../lib/store.js';
import { wordKey } from '../../lib/srs.js';
import { useSettings } from '../../lib/settings.js';
import { CloseIcon } from '../../components/ui/Icons.jsx';
import { AccentButtons, CefrBadge, Details, Meanings, playEnglish } from './parts.jsx';
import { cefrOf } from './cefr.js';

const cache = new Map();

export default function WordLookup({ text, cefrIndex, onLookup, onClose, onUnauthorized }) {
  const word = wordKey(text);
  const words = useTable('words');
  const settings = useSettings();
  const [state, setState] = useState(() => (cache.has(word) ? { data: cache.get(word) } : { loading: true }));
  const [context, setContext] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const saved = words[word];

  useEffect(() => {
    let live = true;
    setJustSaved(false);
    setContext('');
    const done = (data) => {
      if (!live) return;
      setState({ data });
      if (settings.autoPlay) playEnglish(data, settings.accent);
    };
    if (cache.has(word)) done(cache.get(word));
    else {
      setState({ loading: true });
      getJson(`/api/lookup?q=${encodeURIComponent(word)}`).then(
        (data) => {
          cache.set(word, data);
          done(data);
        },
        (e) => {
          if (!live) return;
          if (e.message === UNAUTHORIZED) onUnauthorized?.();
          else setState({ error: e.message || 'Không tra được từ này.' });
        },
      );
    }
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const d = state.data;
  const save = () => {
    const ctx = context.trim();
    importWords([
      {
        word: d.word,
        isWord: d.isWord,
        phonetics: d.phonetics,
        translation: d.translation,
        meanings: d.meanings,
        senses: d.senses,
        baseForm: d.baseForm || '',
        forms: [],
        contexts: ctx ? [{ text: ctx, url: '', title: 'Ghi trong app', at: Date.now() }] : [],
        details: d.details,
      },
    ]);
    setJustSaved(true);
  };
  const entryForView = d && { ...d, key: d.word };
  const otherForm = d?.baseForm && wordKey(d.baseForm) !== word ? wordKey(d.baseForm) : '';

  return (
    <section className="card lookup-card" aria-live="polite" aria-label={`Tra từ ${word}`}>
      <div className="lookup-head">
        <span className="lookup-label">Từ điển</span>
        <span className="en-word lookup-word">{word}</span>
        {d && <CefrBadge cefr={cefrOf(cefrIndex, entryForView)} />}
        <button type="button" className="icon-btn lookup-close" onClick={onClose} aria-label="Đóng kết quả tra" title="Đóng">
          <CloseIcon size={18} />
        </button>
      </div>

      {state.loading && <p className="loading">Đang tra…</p>}
      {state.error && <p className="error">{state.error}</p>}
      {d && (
        <>
          <AccentButtons entry={d} />
          <div className="translation-main">{d.translation || '—'}</div>
          <Meanings entry={d} limit={6} />
          {otherForm && (
            <p className="muted small lookup-base">
              Dạng gốc:{' '}
              <button type="button" className="link-btn" onClick={() => onLookup(otherForm)}>
                {otherForm}
              </button>
            </p>
          )}
          {d.details?.senses?.length > 0 && (
            <details className="en-details">
              <summary>Định nghĩa & ví dụ</summary>
              <Details d={d.details} word={word} />
            </details>
          )}

          <div className="lookup-save">
            {saved && !justSaved ? (
              <p className="lookup-saved">✓ Từ này đã có trong kho. Lưu lại để thêm câu ví dụ.</p>
            ) : null}
            {justSaved ? (
              <p className="lookup-saved">✓ Đã lưu vào kho – từ sẽ đồng bộ sang extension và có trong Flashcard.</p>
            ) : (
              <>
                <input
                  type="text"
                  className="lookup-context"
                  placeholder="Câu ví dụ / ngữ cảnh của bạn (tuỳ chọn)"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={300}
                />
                <button type="button" className="btn primary" onClick={save}>
                  {saved ? 'Lưu thêm ngữ cảnh' : '☆ Lưu vào kho'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
