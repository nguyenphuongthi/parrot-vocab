// Các mảnh giao diện dùng chung cho Kho từ và Flashcard tiếng Anh.
import { contextsOf, wordKey } from '../lib/srs.js';
import { speak } from '../lib/speech.js';
import { useSettings } from '../lib/settings.js';
import { SpeakerIcon } from '../components/Icons.jsx';

export function playEnglish(entry, accent) {
  const audio = entry.phonetics?.[accent]?.audio || '';
  speak(entry.word, accent === 'uk' ? 'en-GB' : 'en-US', { audio, rate: 0.9 });
}

export function AccentButtons({ entry }) {
  return (
    <span className="accents">
      {['us', 'uk'].map((a) => {
        const ipa = entry.phonetics?.[a]?.ipa || '';
        return (
          <button
            key={a}
            type="button"
            className="accent"
            title={`Nghe giọng ${a.toUpperCase()}`}
            onClick={(e) => {
              e.stopPropagation();
              playEnglish(entry, a);
            }}
          >
            <SpeakerIcon />
            <b>{a.toUpperCase()}</b>
            {ipa && <span>{ipa}</span>}
          </button>
        );
      })}
    </span>
  );
}

export function useEnglishPlayer() {
  const { accent } = useSettings();
  return (entry) => playEnglish(entry, accent);
}

export function CefrBadge({ cefr }) {
  if (!cefr) return null;
  const detail = Object.entries(cefr.byPos).map(([pos, lv]) => `${pos} ${lv}`).join(' · ');
  const title = `Cấp độ CEFR ${cefr.level}${detail ? ` (${detail})` : ''}${cefr.lemma ? ` – theo “${cefr.lemma}”` : ''}`;
  return (
    <span className={`cefr cefr-${cefr.level[0].toLowerCase()}`} title={title}>
      {cefr.level}
    </span>
  );
}

// Tô từ (và các dạng của nó) trong câu – chỉ khớp nguyên từ
export function Highlight({ text, words }) {
  const list = [].concat(words).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length || !text) return text || null;
  const pattern = list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|');
  const re = new RegExp(`(?<![A-Za-z])(${pattern})(?![A-Za-z])`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export function Meanings({ entry, limit = 4 }) {
  const list = (entry.meanings || []).slice(0, limit);
  if (!list.length) return null;
  return (
    <ul className="meanings">
      {list.map((m, i) => (
        <li key={i}>
          <span className="pos">{m.pos}</span> {m.terms.join(', ')}
        </li>
      ))}
    </ul>
  );
}

const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

const cleanTitle = (title, max = 60) => {
  const clean = (title || '')
    .replace(/^(?:\(\d+\)\s*|\d{1,2}:\d{2}(?::\d{2})?\s+)+/, '')
    .replace(/\s*[-–]\s*YouTube$/, '')
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
};

const safeUrl = (url) => (/^https?:\/\//i.test(url || '') ? url : '');

export function Contexts({ entry, limit = 3 }) {
  const list = contextsOf(entry).slice(0, limit);
  if (!list.length) return null;
  const forms = [entry.word, ...(entry.forms || [])];
  return (
    <ul className="contexts">
      {list.map((c, i) => {
        const title = cleanTitle(c.title);
        const label = c.time != null ? `▶ ${formatTime(c.time)}${title ? ` · ${title}` : ''}` : title || 'nguồn';
        const url = safeUrl(c.url);
        return (
          <li key={i}>
            <Highlight text={c.text} words={forms} />
            {url && (
              <>
                {' '}
                <a className="ctx-source" href={url} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Phần "Giải thích chi tiết" (lấy lúc tra từ trong extension)
export function Details({ d, word }) {
  if (!d) return null;
  return (
    <div className="dt">
      {d.context && (
        <div className="dt-context">
          <div className="dt-caption">Trong câu bạn đang đọc</div>
          <div className="dt-en">
            <Highlight text={d.context} words={word} />
          </div>
          {d.contextVi && <div className="dt-vi">{d.contextVi}</div>}
        </div>
      )}
      {(d.senses || []).map((s, i) => {
        const otherForm = s.baseForm && wordKey(s.baseForm) !== wordKey(word) ? s.baseForm : '';
        return (
          <div className="dt-sense" key={i}>
            <div className="dt-pos">
              <span className="pos">
                {s.pos}
                {s.posEn ? ` · ${s.posEn}` : ''}
              </span>
              {otherForm && <span className="dt-form">(theo từ “{otherForm}”)</span>}
              {s.terms?.length > 0 && <span className="dt-terms">{s.terms.join(', ')}</span>}
            </div>
            {s.definitions?.length > 0 && (
              <ol className="dt-defs">
                {s.definitions.map((def, j) => (
                  <li key={j}>
                    <div className="dt-gloss">{def.gloss}</div>
                    {def.glossVi && <div className="dt-vi">{def.glossVi}</div>}
                    {def.example && (
                      <div className="dt-example">
                        “<Highlight text={def.example} words={word} />”
                      </div>
                    )}
                    {def.exampleVi && <div className="dt-vi">{def.exampleVi}</div>}
                  </li>
                ))}
              </ol>
            )}
            {s.synonyms?.length > 0 && (
              <div className="dt-syn">
                <b>Đồng nghĩa:</b> {s.synonyms.join(', ')}
              </div>
            )}
          </div>
        );
      })}
      {!d.senses?.length && !d.context && <div className="muted">Từ điển chưa có định nghĩa chi tiết cho mục này.</div>}
    </div>
  );
}

export function synonymsOf(entry) {
  const senses = entry.details?.senses?.length ? entry.details.senses : entry.senses || [];
  return [...new Set(senses.flatMap((s) => s.synonyms || []))].slice(0, 8);
}
