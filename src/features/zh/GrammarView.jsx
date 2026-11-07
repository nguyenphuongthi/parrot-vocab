import { useEffect, useState } from 'react';
import GrammarDetail from './GrammarDetail.jsx';
import { useDetailKeys } from '../../components/ui/DetailNav.jsx';
import Collocations from './Collocations.jsx';
import Disclosure from '../../components/ui/Disclosure.jsx';
import Exercise from './Exercise.jsx';
import LessonText from './LessonText.jsx';
import { MarkFilter, MarkGlyph } from '../../components/ui/Mark.jsx';
import { useLangItems } from '../../lib/store.js';
import { STATES, markOf } from '../../lib/srs.js';
import { Examples } from './GrammarDetail.jsx';
import { UNAUTHORIZED, getJson } from '../../lib/supabase.js';
import { usePresence, useSelection } from '../../lib/motion.js';

// Các bài đang mở, nhớ riêng cho từng cấp (HSK 4 giữ khoá cũ để không mất trạng thái đã lưu).
const openKey = (level) => (level === 4 ? 'hsk.grammar.openLessons' : `hsk.grammar${level}.openLessons`);

// Giáo trình nguồn của từng cấp, ghi ở chân trang.
const SOURCES = {
  4: 'Chuẩn HSK 4 (上, 下)',
  5: 'Chuẩn HSK 5 (上, 下)',
};

function loadOpen(level) {
  try {
    const v = JSON.parse(localStorage.getItem(openKey(level)));
    if (Array.isArray(v)) return v;
  } catch {
    /* bộ nhớ trình duyệt không khả dụng */
  }
  return [1];
}

function saveOpen(level, lessons) {
  try {
    localStorage.setItem(openKey(level), JSON.stringify(lessons));
  } catch {
    /* bỏ qua */
  }
}

// Các bài khóa của một bài (HSK 4 có 5 bài khóa ngắn) và câu hỏi đọc hiểu.
function Texts({ texts, questions }) {
  let start = 1;
  return (
    <>
      {texts.map((t, i) => {
        const first = start;
        start += t.words?.length ?? 0;
        return (
          <div className="text-block" key={i}>
            <LessonText text={t} label={texts.length > 1 ? `课文 ${i + 1}` : null} start={first} />
          </div>
        );
      })}
      {questions && <Exercise ex={questions} />}
    </>
  );
}

// Mục 扩展: từ theo chủ đề (kèm pinyin, nghĩa) và bài tập đi kèm.
function Extension({ ext }) {
  return (
    <>
      <p className="ext-topic">
        <span lang="zh-CN">{ext.topic}</span> · {ext.vi}
      </p>
      {ext.examples && <Examples list={ext.examples} />}
      <ul className="ext-words">
        {ext.words.map((w) => (
          <li key={w.zh}>
            <span className="w-zh" lang="zh-CN">
              {w.zh}
            </span>
            <span className="w-py">{w.py}</span>
            {w.vi && (
              <span className="w-mean">
                {w.vi}
                {w.en && <span className="en">{w.en}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {ext.practice && <Exercise ex={ext.practice} lead="做一做" />}
    </>
  );
}

// Giữ dữ liệu đã tải khi chuyển qua lại giữa các tab.
const cache = {};

function LessonSection({ lesson, open, onToggle }) {
  const [selectedId, setSelectedId, close, closing] = useSelection();
  const [filter, setFilter] = useState(null); // null = tất cả; 0/1/2 = chỉ trạng thái đó
  const progress = useLangItems('zh');
  const markIdOf = (id) => markOf(progress[id]);
  const points = lesson.points.map((p, i) => ({ ...p, num: i + 1 }));
  const counts = [0, 0, 0];
  for (const p of points) counts[markIdOf(p.id)]++;
  // Điểm đang mở vẫn được giữ lại dù đổi trạng thái khi đang lọc (đến khi đóng).
  const shown =
    filter === null ? points : points.filter((p) => markIdOf(p.id) === filter || p.id === selectedId);

  const selected = shown.findIndex((p) => p.id === selectedId);
  const goPrev = selected > 0 ? () => setSelectedId(shown[selected - 1].id) : null;
  const goNext = selected >= 0 && selected < shown.length - 1 ? () => setSelectedId(shown[selected + 1].id) : null;
  useDetailKeys(selectedId, { onPrev: goPrev, onNext: goNext, onClose: close });
  const body = usePresence(open);

  const pickFilter = (value) => {
    setFilter((f) => (f === value ? null : value));
    setSelectedId(null);
    if (!open) onToggle();
  };

  return (
    <section className={`level lesson tone-${(lesson.n - 1) % 8} ${open ? 'is-open' : ''}`}>
      <div className="level-head" onClick={onToggle}>
        <button
          className="level-title"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
        >
          <span className="level-name">Bài {lesson.n}</span>
          <span className="lesson-name">
            <span className="lesson-zh" lang="zh-CN">
              {lesson.zh}
            </span>
            <span className="level-count">{lesson.vi}</span>
          </span>
        </button>
        <MarkFilter counts={counts} active={filter} onPick={pickFilter} compact />
        <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {body.mounted && (
        <div className={`level-body ${body.closing ? 'is-closing' : ''}`}>
          {filter !== null && (
            <p className="filter-note">
              <MarkGlyph value={filter} size={14} /> Đang lọc: {STATES[filter].label.toLowerCase()}
              <button className="link-btn" onClick={() => pickFilter(filter)}>
                Bỏ lọc
              </button>
            </p>
          )}
          {lesson.texts && filter === null && (
            <Disclosure zh="课文" sub="Bài khóa và từ mới">
              <Texts texts={lesson.texts} questions={lesson.questions} />
            </Disclosure>
          )}
          {lesson.texts && (
            <h3 className="sub-head points-head">
              <span lang="zh-CN">注释</span> Chú thích ngữ pháp
            </h3>
          )}
          {shown.length === 0 && <p className="muted">Không có điểm ngữ pháp nào ở trạng thái này.</p>}
          <ul className="points">
            {shown.map((p, i) => {
              const isSel = i === selected;
              return (
                <li key={p.id}>
                  <button
                    style={{ '--i': i }}
                    className={`point ${isSel ? 'is-selected' : ''}`}
                    onClick={() => (isSel ? close() : setSelectedId(p.id))}
                    aria-expanded={isSel}
                  >
                    <MarkGlyph value={markIdOf(p.id)} size={16} />
                    <span className="g-num">{p.num}</span>
                    <span className="point-title" lang="zh-CN">
                      {p.title}
                    </span>
                    {(p.cmp || p.compare) && <span className="point-tag">So sánh</span>}
                  </button>
                  {isSel && (
                    <GrammarDetail
                      key={p.id}
                      point={p}
                      num={p.num}
                      nav={{ pos: i + 1, total: shown.length, onPrev: goPrev, onNext: goNext, onClose: close, closing }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {filter === null && (
            <>
              {lesson.colloc && (
                <Disclosure zh="词语搭配" sub="Cụm từ thường đi với nhau">
                  <Collocations groups={lesson.colloc} />
                </Disclosure>
              )}
              {lesson.exercises && (
                <Disclosure zh="练习" sub="Bài tập">
                  {lesson.exercises.map((ex, i) => (
                    <Exercise key={i} ex={ex} lead={String(i + 1)} />
                  ))}
                </Disclosure>
              )}
              {lesson.ext && (
                <Disclosure zh="扩展" sub={`Mở rộng: ${lesson.ext.vi}`}>
                  <Extension ext={lesson.ext} />
                </Disclosure>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function GrammarView({ level, onUnauthorized }) {
  const [data, setData] = useState(cache[level] ?? null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(() => loadOpen(level));

  useEffect(() => {
    if (cache[level]) return;
    getJson(`/data/zh/grammar${level}.json`)
      .then((d) => {
        cache[level] = d;
        setData(d);
      })
      .catch((e) =>
        e.message === UNAUTHORIZED ? onUnauthorized() : setError('Không tải được dữ liệu ngữ pháp.'),
      );
  }, [level, onUnauthorized]);

  const toggle = (n) => {
    setOpen((prev) => {
      const next = prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b);
      saveOpen(level, next);
      return next;
    });
  };

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="loading">Đang tải…</p>}
      <main>
        {data?.lessons.map((lesson) => (
          <LessonSection
            key={lesson.n}
            lesson={lesson}
            open={open.includes(lesson.n)}
            onToggle={() => toggle(lesson.n)}
          />
        ))}
      </main>
      <footer className="foot">
        {data && (
          <>
            Ngữ pháp theo giáo trình {SOURCES[level]}, bài {data.lessons[0].n}–{data.lessons.at(-1).n}.{' '}
          </>
        )}
        Bản dịch tiếng Anh và bản dịch câu ví dụ được soạn thêm.
      </footer>
    </>
  );
}
