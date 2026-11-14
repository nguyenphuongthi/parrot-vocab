// Trang Kho từ: danh sách từ, flashcard (ôn tập ngắt quãng), cài đặt và đồng bộ.
// Chỉ đọc chrome.storage; mọi thay đổi kho từ gửi qua wordOp (shared.js) để nơi ghi xử lý tuần tự.

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICON_SPEAKER =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

let words = {};
let settings = { ...DEFAULT_SETTINGS };
let listFilter = null; // null = tất cả; 0/1/2 = chỉ mức đó
let posFilter = 'all'; // 'all' | tên từ loại | 'phrase' | 'other'
let levelFilter = 'all'; // 'all' | 'A1'…'C2' | 'none' (chưa xếp cấp)
let cefrIndex = null; // dữ liệu cấp độ CEFR (data/), nạp lúc mở trang

const levelOf = (w) => cefrOf(cefrIndex, w.key, { baseForm: w.baseForm, classes: wordClasses(w) });

const detailsSheet = new CSSStyleSheet();
detailsSheet.replaceSync(DETAILS_STYLES);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, detailsSheet];

// ---------- Tabs ----------

const TABS = ['list', 'cards', 'stats', 'settings'];

function showTab(name) {
  if (!TABS.includes(name)) name = 'list';
  for (const tab of TABS) {
    $(`#tab-${tab}`).hidden = tab !== name;
    $(`[data-tab="${tab}"]`).setAttribute('aria-selected', String(tab === name));
  }
  if (name === 'cards' && !deck.started) startDeck();
  if (name === 'stats') renderStats();
}

document.querySelectorAll('[data-tab]').forEach((btn) =>
  btn.addEventListener('click', () => (location.hash = btn.dataset.tab))
);
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));

// ---------- Dùng chung ----------

function play(entry, accent) {
  const audio = entry.phonetics?.[accent]?.audio || '';
  callBackground({ type: 'speak', text: entry.word, accent, audio }).catch(() => {});
}

function accentButtons(entry) {
  return ['us', 'uk']
    .map((a) => {
      const ipa = entry.phonetics?.[a]?.ipa || '';
      return `<button type="button" class="accent" data-play="${a}" data-key="${esc(entry.key)}" title="Nghe giọng ${a.toUpperCase()}">
          ${ICON_SPEAKER}<b>${a.toUpperCase()}</b>${ipa ? `<span>${esc(ipa)}</span>` : ''}
        </button>`;
    })
    .join('');
}

function meaningsList(entry, limit = 4) {
  const items = (entry.meanings || [])
    .slice(0, limit)
    .map((m) => `<li><span class="pos">${esc(m.pos)}</span> ${esc(m.terms.join(', '))}</li>`)
    .join('');
  return items ? `<ul class="meanings">${items}</ul>` : '';
}

const highlight = (text, word) => highlightWord(esc(text), word, esc);
const formsOf = (w) => [w.word, ...(w.forms || [])];

// Các câu ngữ cảnh đã lưu; câu từ YouTube có link mở lại đúng thời điểm
function contextsHtml(w, limit = 3) {
  const items = contextsOf(w)
    .slice(0, limit)
    .map((c) => {
      const title = cleanSourceTitle(c.title, 60);
      const label = c.time != null ? `▶ ${formatTime(c.time)}${title ? ` · ${title}` : ''}` : title || 'nguồn';
      const link = c.url ? ` <a class="ctx-source" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
      return `<li>${highlight(c.text, formsOf(w))}${link}</li>`;
    })
    .join('');
  return items ? `<ul class="contexts">${items}</ul>` : '';
}

function countMarks(list = Object.values(words)) {
  const counts = [0, 0, 0];
  for (const w of list) counts[markOf(w)]++;
  return counts;
}

const dueWords = () => Object.values(words).filter((w) => isDue(w));

// Các nút "● 12 chưa thuộc" – dùng cho bộ lọc danh sách và chọn mức ôn flashcard
function statChips(counts, isActive, attr) {
  return STATES.map(
    (st) => `
      <button type="button" class="stat st-${st.value} ${isActive(st.value) ? 'is-active' : ''}"
        aria-pressed="${isActive(st.value)}" ${attr}="${st.value}">
        <b>${counts[st.value]}</b><span>${st.label.toLowerCase()}</span>
      </button>`
  ).join('');
}

// Thanh trượt 3 nấc: đỏ (chưa thuộc) – vàng (hơi nhớ) – xanh (đã thuộc)
function statusSlider(entry) {
  const mark = markOf(entry);
  const stops = STATES.map(
    (st) => `<button type="button" class="status-stop" tabindex="-1" data-mark="${st.value}" aria-label="${st.label}"><span></span></button>`
  ).join('');
  return `
    <div class="status" data-key="${esc(entry.key)}">
      <div class="status-track st-${mark}" role="slider" tabindex="0" aria-label="Mức độ thuộc từ"
        aria-valuemin="0" aria-valuemax="2" aria-valuenow="${mark}" aria-valuetext="${STATES[mark].label}">
        ${stops}<span class="status-knob" aria-hidden="true"></span>
      </div>
      <span class="status-label st-${mark}">${STATES[mark].label}</span>
    </div>`;
}

document.addEventListener('click', (e) => {
  const playBtn = e.target.closest('[data-play]');
  if (playBtn) {
    e.stopPropagation();
    const entry = words[playBtn.dataset.key];
    if (entry) play(entry, playBtn.dataset.play);
    return;
  }
  const stop = e.target.closest('.status-stop');
  if (stop) setMark(stop.closest('.status').dataset.key, Number(stop.dataset.mark));
});

document.addEventListener('keydown', (e) => {
  const track = e.target.closest?.('.status-track');
  if (!track) return;
  const key = track.closest('.status').dataset.key;
  const value = markOf(words[key]);
  const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
  if (e.key === 'Home') setMark(key, 0);
  else if (e.key === 'End') setMark(key, 2);
  else if (step) setMark(key, Math.min(2, Math.max(0, value + step)));
  else return;
  e.preventDefault();
});

// ---------- Phân loại theo từ loại ----------

const POS_ORDER = Object.keys(POS_INFO);

function wordClasses(w) {
  const classes = new Set();
  for (const m of [...(w.meanings || []), ...(w.senses || [])]) if (m.pos) classes.add(normalizePos(m.pos));
  return classes;
}

// Một từ có thể thuộc nhiều nhóm (running: adj. + n.); mục nhiều chữ còn thuộc nhóm "Cụm từ"
function categoriesOf(w) {
  const cats = wordClasses(w);
  if (w.key.includes(' ')) cats.add('phrase');
  if (!cats.size) cats.add('other');
  return cats;
}

function categoryName(cat) {
  if (cat === 'phrase') return 'Cụm từ';
  if (cat === 'other') return 'Khác';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function categoryLabel(cat) {
  return POS_INFO[cat] ? `<b>${POS_INFO[cat].abbr}</b> ${esc(categoryName(cat))}` : esc(categoryName(cat));
}

// Các nhóm từ loại đang có, theo thứ tự cố định, kèm số từ
function categoryCounts() {
  const counts = new Map();
  for (const w of Object.values(words)) for (const c of categoriesOf(w)) counts.set(c, (counts.get(c) || 0) + 1);
  const extra = [...counts.keys()].filter((c) => !POS_ORDER.includes(c) && c !== 'phrase' && c !== 'other').sort();
  const order = [...POS_ORDER, ...extra, 'phrase', 'other'].filter((c) => counts.has(c));
  return { counts, order };
}

function renderPosTabs() {
  const { counts, order } = categoryCounts();
  if (posFilter !== 'all' && !counts.has(posFilter)) posFilter = 'all';
  const tab = (cat, label, count) => `
    <button type="button" class="pos-tab ${posFilter === cat ? 'is-active' : ''}" data-pos="${esc(cat)}"
      aria-pressed="${posFilter === cat}">${label}<span class="pos-count">${count}</span></button>`;
  $('#pos-tabs').hidden = !counts.size;
  $('#pos-tabs').innerHTML =
    tab('all', 'Tất cả', Object.keys(words).length) + order.map((c) => tab(c, categoryLabel(c), counts.get(c))).join('');
}

$('#pos-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pos]');
  if (!btn) return;
  posFilter = btn.dataset.pos;
  renderList();
});

// ---------- Danh sách ----------

function sortedEntries(order) {
  const list = Object.values(words);
  if (order === 'az') return list.sort((a, b) => a.key.localeCompare(b.key));
  return list.sort((a, b) => b.addedAt - a.addedAt);
}

function renderCounts() {
  $('#count').textContent = Object.keys(words).length;
  const due = dueWords().length;
  $('#due-count').hidden = !due;
  $('#due-count').textContent = due;
}

function renderList() {
  const total = Object.keys(words).length;
  renderPosTabs();
  renderCounts();
  $('#empty').hidden = total > 0;
  $('#stats').hidden = total === 0;
  // Bộ đếm mức thuộc tính theo tab từ loại đang chọn
  const inTab = Object.values(words).filter((w) => posFilter === 'all' || categoriesOf(w).has(posFilter));
  $('#stats').innerHTML =
    statChips(countMarks(inTab), (v) => listFilter === v, 'data-filter') +
    (listFilter !== null ? '<button type="button" class="link-btn" data-filter="clear">Bỏ lọc</button>' : '');
  renderLevelFilter(inTab);

  const query = $('#search').value.trim().toLowerCase();
  const entries = sortedEntries($('#sort').value).filter(
    (w) =>
      (listFilter === null || markOf(w) === listFilter) &&
      (posFilter === 'all' || categoriesOf(w).has(posFilter)) &&
      (levelFilter === 'all' || (levelOf(w)?.level || 'none') === levelFilter) &&
      (!query ||
        w.key.includes(query) ||
        (w.forms || []).some((f) => f.includes(query)) ||
        (w.translation || '').toLowerCase().includes(query) ||
        (w.meanings || []).some((m) => m.terms.some((t) => t.toLowerCase().includes(query))))
  );
  $('#list').innerHTML =
    total && !entries.length
      ? '<p class="empty">Không có từ nào khớp bộ lọc.</p>'
      : entries.map(itemHtml).join('');
  // Giữ focus trên thanh trượt khi danh sách vẽ lại sau lúc bấm phím mũi tên
  if (focusKey) document.querySelector(`.status[data-key="${CSS.escape(focusKey)}"] .status-track`)?.focus();
}

// Ô lọc cấp độ CEFR, số từ mỗi cấp tính theo tab từ loại đang chọn
function renderLevelFilter(list) {
  const counts = new Map();
  for (const w of list) {
    const level = levelOf(w)?.level || 'none';
    counts.set(level, (counts.get(level) || 0) + 1);
  }
  const options = [['all', 'Mọi cấp độ', list.length], ...CEFR_LEVELS.map((lv) => [lv, lv, counts.get(lv) || 0]), ['none', 'Chưa xếp cấp', counts.get('none') || 0]];
  $('#level').innerHTML = options.map(([v, label, n]) => `<option value="${v}">${label} (${n})</option>`).join('');
  $('#level').value = levelFilter;
}

$('#level').addEventListener('change', (e) => {
  levelFilter = e.target.value;
  renderList();
});

let focusKey = null;
document.addEventListener('focusin', (e) => {
  focusKey = e.target.matches('.status-track') ? e.target.closest('.status').dataset.key : null;
});

// Thẻ từ gọn: chỉ từ, loại từ, phiên âm; bấm vào mới mở nghĩa, ngữ cảnh và giải thích chi tiết.
// Nhớ các thẻ đang mở để danh sách vẽ lại (vd. khi đổi mức) không đóng mất.
const openItems = new Set();

function itemHtml(w) {
  const date = new Date(w.addedAt).toLocaleDateString('vi-VN');
  const abbrs = [...wordClasses(w)].map((c) => POS_INFO[c]?.abbr).filter(Boolean);
  const forms = (w.forms || []).length ? `<div class="forms">Dạng đã gặp: ${esc(w.forms.join(', '))}</div>` : '';
  const open = openItems.has(w.key);
  return `
    <article class="item st-${markOf(w)} ${open ? 'is-open' : ''}">
      <div class="item-head" data-toggle="${esc(w.key)}">
        <button type="button" class="item-toggle" aria-expanded="${open}" aria-label="Xem nghĩa của ${esc(w.word)}">
          <span class="item-word">${esc(w.word)}</span>
          ${abbrs.length ? `<span class="item-pos">${abbrs.join(' · ')}</span>` : ''}
          ${cefrBadge(levelOf(w), esc)}
        </button>
        <span class="accents">${accentButtons(w)}</span>
        <span class="spacer"></span>
        ${statusSlider(w)}
        <button class="icon-btn" data-delete="${esc(w.key)}" title="Xoá từ này">🗑</button>
      </div>
      <div class="item-body" ${open ? '' : 'hidden'}>
        <div class="translation">${esc(w.translation)}</div>
        ${meaningsList(w)}
        ${forms}
        ${contextsHtml(w)}
        ${w.details ? `<div class="item-details"><div class="item-details-title">Giải thích chi tiết</div>${detailsHtml(w.details, w.word, esc)}</div>` : ''}
        <div class="item-meta">Lưu ngày ${date} · Ôn tiếp: ${dueLabel(w)}</div>
      </div>
    </article>`;
}

$('#search').addEventListener('input', renderList);
$('#sort').addEventListener('change', renderList);

$('#stats').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  const value = btn.dataset.filter === 'clear' ? null : Number(btn.dataset.filter);
  listFilter = listFilter === value ? null : value;
  renderList();
});

$('#list').addEventListener('click', async (e) => {
  // Bấm vào phần đầu thẻ (trừ nút nghe, thanh mức, nút xoá) để mở / đóng
  const head = e.target.closest('[data-toggle]');
  if (head && !e.target.closest('.accent, .status, [data-delete]')) {
    const key = head.dataset.toggle;
    const open = !openItems.delete(key);
    if (open) openItems.add(key);
    const item = head.closest('.item');
    item.classList.toggle('is-open', open);
    item.querySelector('.item-body').hidden = !open;
    item.querySelector('.item-toggle').setAttribute('aria-expanded', String(open));
    // Mở thẻ thì tự đọc từ bằng giọng ưu tiên (mặc định US), như khi popup hiện ra
    if (open && settings.autoPlay && words[key]) play(words[key], settings.accent);
    return;
  }
  const btn = e.target.closest('[data-delete]');
  if (!btn) return;
  const entry = words[btn.dataset.delete];
  if (entry && confirm(`Xoá "${entry.word}" khỏi sổ từ?`)) await removeWord(entry.word);
});

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vocab-english-lens-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Object.values(data).filter((w) => w && typeof w.word === 'string');
    for (let i = 0; i < incoming.length; i += 200) await importWords(incoming.slice(i, i + 200));
    alert(`Đã nhập ${incoming.length} từ.`);
  } catch {
    alert('File không hợp lệ. Hãy chọn file JSON được xuất từ Vocab English Lens.');
  }
});

// ---------- Flashcard ----------

// extra: lượt ôn thêm (ngẫu nhiên trong kho / ôn lại từ vừa quên) – không đổi lịch ôn, trừ khi chọn "Chưa thuộc"
// mode: kiểu ôn của thẻ đang hiện · results: mức chấm lần đầu của mỗi từ trong lượt (tổng kết cuối lượt)
const deck = { started: false, extra: false, mode: 'en-vi', queue: [], total: 0, done: 0, flipped: false, checked: false, results: new Map(), choices: [] };
const EXTRA_SIZE = 20;
const RECENT_DAYS = 7;

const MODE_HINTS = {
  'en-vi': 'Nhớ nghĩa của từ, rồi bấm vào thẻ<span class="kbd-hint"> hoặc nhấn <kbd>Space</kbd></span> để xem đáp án',
  'vi-en': 'Nhớ từ tiếng Anh, rồi bấm vào thẻ<span class="kbd-hint"> hoặc nhấn <kbd>Space</kbd></span> để xem đáp án',
  listen: 'Nghe rồi đoán từ – bấm vào thẻ<span class="kbd-hint"> hoặc nhấn <kbd>Space</kbd></span> để xem đáp án',
  type: 'Gõ từ tiếng Anh rồi nhấn Enter',
  choice: 'Chọn nghĩa đúng<span class="kbd-hint"> – phím <kbd>1</kbd>–<kbd>4</kbd></span>'
};

// Nguồn từ để ôn (ô chọn đầu tiên)
const DECK_SOURCES = {
  due: { label: 'Cần ôn hôm nay', test: (w) => isDue(w) },
  recent: { label: `Từ mới ${RECENT_DAYS} ngày qua`, test: (w) => (w.addedAt || 0) >= Date.now() - RECENT_DAYS * DAY },
  lapses: { label: 'Từ hay quên', test: (w) => (w.srs?.lapses || 0) > 0 },
  marks: { label: 'Theo mức thuộc', test: (w) => settings.deckStates.includes(markOf(w)) }
};
const deckSource = () => DECK_SOURCES[settings.deckSource] || DECK_SOURCES.due;

function renderDeckControls() {
  $('#deck-source').value = DECK_SOURCES[settings.deckSource] ? settings.deckSource : 'due';
  $('#deck-mode').value = settings.deckMode;
  $('#deck-states').hidden = settings.deckSource !== 'marks';
  $('#deck-states').innerHTML = statChips(countMarks(), (v) => settings.deckStates.includes(v), 'data-deck');
  for (const option of $('#deck-source').options) {
    const source = DECK_SOURCES[option.value];
    option.textContent = `${source.label} (${Object.values(words).filter(source.test).length})`;
  }

  const { counts, order } = categoryCounts();
  const options = [['all', 'Mọi từ loại', Object.keys(words).length], ...order.map((c) => [c, `${POS_INFO[c]?.abbr || ''} ${categoryName(c)}`.trim(), counts.get(c)])];
  $('#deck-pos').innerHTML = options.map(([v, label, n]) => `<option value="${esc(v)}">${esc(label)} (${n})</option>`).join('');
  $('#deck-pos').value = counts.has(settings.deckPos) ? settings.deckPos : 'all';
  renderGoal();
}

// Mục tiêu ngày + chuỗi ngày học – hiện ở tab Flashcard và Thống kê
function renderGoal() {
  const { today, goal, reached, streak } = reviewStats(Object.values(words), settings.dailyGoal);
  const html = `
    <div class="goal ${reached ? 'is-reached' : ''}">
      <span class="goal-text">🎯 Hôm nay <b>${today}/${goal}</b> thẻ${reached ? ' · ✓ đạt mục tiêu' : ''}</span>
      <progress class="goal-bar" max="${goal}" value="${Math.min(today, goal)}" aria-label="Tiến độ mục tiêu hôm nay"></progress>
      <span class="goal-streak" title="Số ngày liên tiếp ôn đủ mục tiêu">🔥 <b>${streak}</b> ngày liên tiếp</span>
    </div>`;
  document.querySelectorAll('.goal-slot').forEach((el) => (el.innerHTML = html));
}

function matchesDeckPos(w) {
  const pos = $('#deck-pos').value || 'all';
  return pos === 'all' || categoriesOf(w).has(pos);
}

function deckEntries() {
  const list = sortedEntries('new').filter((w) => deckSource().test(w) && matchesDeckPos(w));
  // Từ hay quên: quên nhiều nhất lên trước (khi không xáo trộn)
  if (settings.deckSource === 'lapses') list.sort((a, b) => (b.srs?.lapses || 0) - (a.srs?.lapses || 0));
  return list;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function beginDeck(keys, extra) {
  Object.assign(deck, { started: true, extra, queue: keys, total: keys.length, done: 0, results: new Map() });
  showCard();
}

function startDeck() {
  renderDeckControls();
  const keys = deckEntries().map((w) => w.key);
  if ($('#deck-order').value === 'random') shuffle(keys);
  beginDeck(keys, false);
}

// Đã ôn hết từ cần ôn hôm nay → ôn thêm một lượt trong kho (vẫn theo bộ lọc từ loại). Bốc ngẫu nhiên
// nhưng ưu tiên từ yếu: mức thấp và hay quên thì dễ được chọn hơn.
const extraPool = () => Object.values(words).filter(matchesDeckPos);
const extraWeight = (w) => 3 - markOf(w) + Math.min(w.srs?.lapses || 0, 5);

function startExtraDeck() {
  // Bốc có trọng số, không lặp (Efraimidis–Spirakis): khoá = random^(1/trọng số), lấy các khoá lớn nhất
  const keys = extraPool()
    .map((w) => ({ key: w.key, rank: Math.random() ** (1 / extraWeight(w)) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, EXTRA_SIZE)
    .map((x) => x.key);
  beginDeck(keys, true);
}

$('#deck-states').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-deck]');
  if (!btn) return;
  const value = Number(btn.dataset.deck);
  const chosen = settings.deckStates.includes(value)
    ? settings.deckStates.filter((v) => v !== value)
    : [...settings.deckStates, value].sort();
  settings = await updateSettings({ deckStates: chosen });
  startDeck();
});

for (const [id, key] of [['#deck-source', 'deckSource'], ['#deck-mode', 'deckMode'], ['#deck-pos', 'deckPos']]) {
  $(id).addEventListener('change', async (e) => {
    settings = await updateSettings({ [key]: e.target.value });
    startDeck();
  });
}

// Từ chấm "Chưa thuộc" ở lần gặp đầu tiên trong lượt
const forgottenKeys = () => [...deck.results].filter(([key, mark]) => mark === 0 && words[key]).map(([key]) => key);

// Tổng kết cuối lượt: số từ theo mức chấm lần đầu, các từ vừa quên + nút ôn lại ngay
function summaryHtml() {
  if (!deck.results.size) return '';
  const counts = [0, 0, 0];
  deck.results.forEach((mark) => counts[mark]++);
  const chips = STATES.map((st) => `<span class="stat st-${st.value}"><b>${counts[st.value]}</b>${st.label.toLowerCase()}</span>`).join('');
  const forgotten = forgottenKeys();
  const redo = forgotten.length
    ? `<p class="summary-forgot">Vừa quên: ${forgotten.map((k) => `<b>${esc(words[k].word)}</b>`).join(', ')}</p>
       <button class="btn" id="redo-forgotten">🔁 Ôn lại ${forgotten.length} từ vừa quên</button>`
    : '';
  return `<div class="deck-summary"><div class="stats">${chips}</div>${redo}</div>`;
}

function emptyDeckMessage() {
  if (settings.deckSource === 'marks' && !settings.deckStates.length) return 'Hãy chọn ít nhất một mức để ôn.';
  const pool = extraPool().length;
  const extraBtn = (label) =>
    pool ? `<br><br><button class="btn primary" id="extra-deck">🎲 ${label} ${Math.min(EXTRA_SIZE, pool)} từ trong kho (ưu tiên từ yếu)</button>` : '';
  if (deck.extra) return `🎉 Bạn đã ôn thêm ${deck.total} từ!${extraBtn('Ôn tiếp')}`;
  if (settings.deckSource === 'due' && !deckEntries().length) {
    const next = Object.values(words).map(dueAt).filter((t) => t >= startOfDay(Date.now()) + DAY).sort((a, b) => a - b)[0];
    const done = deck.total ? `Bạn đã ôn xong ${deck.total} từ cần ôn hôm nay 🎉` : 'Hôm nay không còn từ nào cần ôn 🎉';
    const nextLine = next ? `<br>Lượt ôn tiếp theo: ${esc(new Date(next).toLocaleDateString('vi-VN'))}.` : '';
    return done + nextLine + extraBtn('Ôn thêm');
  }
  if (deck.total) return `🎉 Bạn đã ôn xong ${deck.total} từ! <br><br><button class="btn primary" id="again-all">Ôn lại</button>`;
  if (settings.deckSource === 'lapses') return 'Chưa có từ nào bị quên 👍';
  if (settings.deckSource === 'recent') return `Chưa lưu từ mới nào trong ${RECENT_DAYS} ngày qua.`;
  return 'Không có từ nào khớp lựa chọn.';
}

function synonymsOf(entry) {
  const senses = entry.details?.senses?.length ? entry.details.senses : entry.senses || [];
  return [...new Set(senses.flatMap((s) => s.synonyms || []))].slice(0, 8);
}

// Mặt sau (mọi kiểu ôn): từ, phiên âm, nghĩa chính + nghĩa theo từ loại, đồng nghĩa. Ngữ cảnh, định nghĩa,
// ví dụ và giải thích chi tiết chỉ hiện khi bấm "Xem chi tiết".
function cardBack(entry) {
  const firstDef = entry.senses?.[0]?.definitions?.[0];
  const synonyms = synonymsOf(entry);
  const more = entry.details
    ? detailsHtml(entry.details, entry.word, esc)
    : `${firstDef ? `<p class="definition">${esc(firstDef.gloss)}</p>` : ''}
       ${firstDef?.example ? `<p class="example">“${highlight(firstDef.example, entry.word)}”</p>` : ''}`;
  const details = (contextsHtml(entry, 2) + more).trim();
  return `
    <div class="fc-title">${esc(entry.word)} ${cefrBadge(levelOf(entry), esc)}</div>
    <div class="accents">${accentButtons(entry)}</div>
    <div class="translation">${esc(entry.translation)}</div>
    ${meaningsList(entry, 6)}
    ${synonyms.length ? `<p class="fc-synonyms"><span class="muted">Đồng nghĩa:</span> ${esc(synonyms.join(', '))}</p>` : ''}
    ${details ? `<button type="button" class="btn ghost fc-more" aria-expanded="false">Xem chi tiết ▾</button>
      <div class="fc-details" hidden>${details}</div>` : ''}`;
}

function toggleCardDetails(btn) {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  btn.textContent = open ? 'Ẩn chi tiết ▴' : 'Xem chi tiết ▾';
  btn.nextElementSibling.hidden = !open;
}

// Trắc nghiệm: nghĩa đúng + tối đa 3 nghĩa của từ khác trong kho, ưu tiên cùng từ loại cho khó đoán hơn
function choiceOptions(entry) {
  const norm = (s) => (s || '').trim().toLowerCase();
  const seen = new Set([norm(entry.translation)]);
  const classes = categoriesOf(entry);
  const sameClass = (w) => [...categoriesOf(w)].some((c) => classes.has(c));
  const others = shuffle(Object.values(words).filter((w) => w.key !== entry.key && norm(w.translation)));
  const picked = [];
  for (const w of [...others.filter(sameClass), ...others.filter((w) => !sameClass(w))]) {
    if (picked.length === 3) break;
    if (seen.has(norm(w.translation))) continue;
    seen.add(norm(w.translation));
    picked.push(w.translation);
  }
  return picked.length ? shuffle([entry.translation, ...picked]) : [];
}

function cardPrompt(entry, mode) {
  const accent = settings.accent;
  const word = `<div class="fc-word">${esc(entry.word)}</div><div class="accents">${accentButtons(entry)}</div>`;
  if (mode === 'en-vi') return word;
  if (mode === 'choice') {
    const options = deck.choices
      .map((t, i) => `<button type="button" class="choice" data-choice="${i}"><kbd>${i + 1}</kbd><span>${esc(t)}</span></button>`)
      .join('');
    return `${word}<div class="choices">${options}</div>`;
  }
  if (mode === 'listen') {
    return `<button type="button" class="listen-btn" data-play="${accent}" data-key="${esc(entry.key)}" aria-label="Nghe lại">${ICON_SPEAKER}</button>`;
  }
  const listen =
    mode === 'type'
      ? `<button type="button" class="accent" data-play="${accent}" data-key="${esc(entry.key)}">${ICON_SPEAKER}<b>Nghe gợi ý</b></button>`
      : '';
  return `<div class="fc-meaning">${esc(entry.translation)}</div>${meaningsList(entry, 3)}${listen}`;
}

function showCard() {
  deck.queue = deck.queue.filter((k) => words[k]); // bỏ những từ vừa bị xoá
  const entry = words[deck.queue[0]];
  $('#card-area').hidden = !entry;
  $('#deck-done').hidden = !!entry;
  $('#progress').textContent = !deck.total
    ? ''
    : deck.extra
      ? `🎲 Ôn thêm: ${deck.done}/${deck.total} · không đổi lịch ôn, trừ khi chọn “${STATES[0].label}”`
      : `Đã ôn ${deck.done}/${deck.total}`;

  if (!entry) {
    $('#deck-done').innerHTML = summaryHtml() + emptyDeckMessage();
    $('#again-all')?.addEventListener('click', startDeck);
    $('#extra-deck')?.addEventListener('click', startExtraDeck);
    $('#redo-forgotten')?.addEventListener('click', () => beginDeck(shuffle(forgottenKeys()), true));
    return;
  }

  // Trắc nghiệm cần ít nhất một nghĩa khác trong kho làm đáp án nhiễu – không có thì ôn kiểu Anh → Việt
  deck.choices = settings.deckMode === 'choice' ? choiceOptions(entry) : [];
  const mode = settings.deckMode === 'choice' && !deck.choices.length ? 'en-vi' : settings.deckMode;
  const mark = markOf(entry);
  Object.assign(deck, { mode, flipped: false, checked: false });
  $('#fc-mark').innerHTML = `<span class="stat st-${mark}">${STATES[mark].label}</span> ${cefrBadge(levelOf(entry), esc)}`;
  $('#fc-prompt').innerHTML = cardPrompt(entry, mode);
  $('#fc-hint').innerHTML = MODE_HINTS[mode];
  $('#fc-back').innerHTML = cardBack(entry);
  $('#fc-type').hidden = mode !== 'type';
  $('#fc-answer').value = '';
  $('#fc-answer').className = '';
  $('#fc-result').hidden = true;
  document.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('suggest'));
  $('.front').hidden = false;
  $('.back').hidden = true;

  if (mode === 'type') $('#fc-answer').focus();
  else $('#flashcard').focus(); // tránh Space kích hoạt lại nút vừa bấm
  // Thẻ mới: tự đọc từ bằng giọng ưu tiên – trừ kiểu ôn mà mặt trước không được lộ từ (Việt → Anh, gõ chính tả)
  if (mode === 'listen' || ((mode === 'en-vi' || mode === 'choice') && settings.autoPlay)) playCard(entry.key);
}

// Phát âm chạy ở background (chrome.tts / offscreen) nên không bị trình duyệt chặn khi trang chưa có thao tác.
function playCard(key) {
  play(words[key], settings.accent);
}

function flip() {
  if ((deck.mode === 'type' || deck.mode === 'choice') && !deck.checked) return; // phải trả lời trước khi xem đáp án
  deck.flipped = !deck.flipped;
  $('.front').hidden = deck.flipped;
  $('.back').hidden = !deck.flipped;
  if (deck.flipped && deck.mode !== 'en-vi' && deck.mode !== 'choice' && settings.autoPlay) play(words[deck.queue[0]], settings.accent);
}

// Gõ chính tả / trắc nghiệm xong: báo đúng sai ở mặt sau, gợi ý nút chấm điểm rồi lật thẻ
function showResult(correct, html) {
  deck.checked = true;
  $('#fc-result').className = `fc-result ${correct ? 'is-correct' : 'is-wrong'}`;
  $('#fc-result').innerHTML = html;
  $('#fc-result').hidden = false;
  $(`.grade-btn[data-grade="${correct ? 2 : 0}"]`).classList.add('suggest');
  flip();
  $('#flashcard').focus();
}

const normalizeAnswer = (s) => wordKey(s || '').replace(/[^a-z' -]/g, '');

$('#fc-type').addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = words[deck.queue[0]];
  if (!entry || deck.checked) return;
  const typed = $('#fc-answer').value.trim();
  const answer = normalizeAnswer(typed);
  const accepted = [entry.key, ...(entry.forms || [])].map(normalizeAnswer);
  const correct = !!answer && accepted.includes(answer);
  $('#fc-answer').className = correct ? 'is-correct' : 'is-wrong';
  $('#fc-hint').innerHTML = correct ? '✓ Chính xác!' : `✗ Đáp án: <b>${esc(entry.word)}</b>`;
  showResult(
    correct,
    correct
      ? `✓ Chính xác: <b>${esc(typed)}</b>`
      : `✗ Bạn gõ: <s>${esc(typed || '(trống)')}</s> → đáp án: <b>${esc(entry.word)}</b>`
  );
});

function pickChoice(i) {
  const entry = words[deck.queue[0]];
  if (!entry || deck.checked || deck.choices[i] === undefined) return;
  const correct = deck.choices[i] === entry.translation;
  document.querySelectorAll('.choice').forEach((btn, j) => {
    btn.disabled = true;
    btn.classList.toggle('is-correct', deck.choices[j] === entry.translation);
    btn.classList.toggle('is-wrong', j === i && !correct);
  });
  showResult(
    correct,
    correct
      ? `✓ Chính xác: <b>${esc(entry.translation)}</b>`
      : `✗ Bạn chọn: <s>${esc(deck.choices[i])}</s> → đáp án: <b>${esc(entry.translation)}</b>`
  );
}

// Chấm điểm = đặt mức thuộc + hẹn ngày ôn lại. "Chưa thuộc" thì gặp lại sau vài thẻ trong lượt này.
// Lượt ôn thêm: từ chưa tới hạn mà chấm "nhớ" thì không đẩy lịch ôn đi xa hơn – chỉ ghi nhận đã ôn
// (mục tiêu ngày); quên ("Chưa thuộc") thì vẫn ghi để ôn lại sớm.
async function grade(mark) {
  const key = deck.queue.shift();
  const entry = words[key];
  if (!entry) return showCard();
  if (!deck.results.has(key)) deck.results.set(key, mark);
  if (mark === 0) deck.queue.splice(Math.min(3, deck.queue.length), 0, key);
  else deck.done++;
  // Cập nhật ngay trên trang (tiến độ mục tiêu, mức thuộc); nơi ghi kho làm y hệt
  const reviewLog = [...(entry.reviewLog || []), Date.now()].slice(-MAX_REVIEW_LOG);
  const practice = deck.extra && mark !== 0;
  words[key] = practice ? { ...entry, reviewLog } : { ...entry, ...gradeWord(entry, mark), reviewLog };
  showCard();
  renderGoal();
  await (practice ? practiceCard(key) : gradeCard(key, mark));
}

$('#flashcard').addEventListener('click', (e) => {
  if (swallowCardClick) return;
  const more = e.target.closest('.fc-more');
  if (more) return toggleCardDetails(more);
  const choice = e.target.closest('[data-choice]');
  if (choice) return pickChoice(Number(choice.dataset.choice));
  if (!e.target.closest('[data-play], form, input, button')) flip();
});
document.querySelectorAll('[data-grade]').forEach((btn) =>
  btn.addEventListener('click', () => grade(Number(btn.dataset.grade)))
);
$('#restart').addEventListener('click', startDeck);
$('#deck-order').addEventListener('change', startDeck);

document.addEventListener('keydown', (e) => {
  if ($('#tab-cards').hidden || $('#card-area').hidden || e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    flip();
  } else if (deck.mode === 'choice' && !deck.checked) {
    if (['1', '2', '3', '4'].includes(e.key)) pickChoice(Number(e.key) - 1);
  } else if (['1', '2', '3'].includes(e.key)) grade(Number(e.key) - 1);
});

// Điện thoại: thẻ đã lật thì vuốt sang trái = Chưa thuộc, sang phải = Đã thuộc ("Hơi nhớ" dùng nút).
// Chỉ bắt vuốt ngang – vuốt dọc vẫn để cuộn trang (mặt sau thẻ có thể dài).
const SWIPE_MIN = 80;
let swipe = null;
let swallowCardClick = false;

function resetSwipe() {
  const card = $('#flashcard');
  card.classList.remove('swiping', 'swipe-0', 'swipe-2');
  card.style.transform = '';
  swipe = null;
}

$('#flashcard').addEventListener('pointerdown', (e) => {
  swallowCardClick = false; // chạm mới là thao tác thật, không phải click sinh ra sau lần vuốt trước
  swipe = e.pointerType === 'touch' && e.isPrimary ? { x: e.clientX, dx: 0 } : null;
});
$('#flashcard').addEventListener('pointermove', (e) => {
  if (!swipe || !deck.flipped) return;
  const card = $('#flashcard');
  swipe.dx = e.clientX - swipe.x;
  card.classList.add('swiping');
  card.classList.toggle('swipe-0', swipe.dx <= -SWIPE_MIN);
  card.classList.toggle('swipe-2', swipe.dx >= SWIPE_MIN);
  card.style.transform = `translateX(${swipe.dx}px) rotate(${swipe.dx / 40}deg)`;
});
$('#flashcard').addEventListener('pointerup', () => {
  const dx = swipe?.dx || 0;
  resetSwipe();
  if (!deck.flipped || Math.abs(dx) < SWIPE_MIN) return;
  // Thả tay sau khi vuốt có thể sinh thêm một click – đừng để nó lật thẻ mới
  swallowCardClick = true;
  setTimeout(() => (swallowCardClick = false), 400);
  grade(dx < 0 ? 0 : 2);
});
$('#flashcard').addEventListener('pointercancel', resetSwipe); // trình duyệt chuyển sang cuộn dọc

// ---------- Thống kê ----------

// Mỗi đường là một mức thuộc, cùng tên và màu với thẻ từ: số từ được đánh dấu vào mức đó trong ngày.
// Màu: class .c-m<mức> trong review.css (không dùng style nội tuyến)
const SERIES = STATES.map((s) => ({ id: 'm' + s.value, mark: s.value, label: s.label }));
const today = new Date();
let statsMonth = { year: today.getFullYear(), month: today.getMonth() };
let statsData = null;

const isCurrentMonth = ({ year, month }, now = new Date()) => year === now.getFullYear() && month === now.getMonth();

// Trục tung: số nguyên, khoảng chia gọn (1, 2, 5, 10…), khoảng 4 vạch
function niceTicks(max) {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw));
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

function renderStats() {
  if ($('#tab-stats').hidden) return;
  const { year, month } = statsMonth;
  const data = marksByDay(Object.values(words), year, month);
  // Tháng hiện tại: chỉ vẽ tới hôm nay, các ngày chưa tới không phải là "0 từ"
  data.shown = isCurrentMonth(statsMonth) ? new Date().getDate() : data.days;
  statsData = data;
  $('#month-label').textContent = `Tháng ${month + 1}/${year}`;
  $('#month-next').disabled = isCurrentMonth(statsMonth);

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  $('#chart-legend').innerHTML = SERIES.map(
    (s) => `<span class="c-${s.id}"><i></i>${s.label} <b>${sum(data.counts[s.mark])}</b></span>`
  ).join('');

  const rows = [];
  for (let d = 0; d < data.shown; d++) {
    const values = SERIES.map((s) => data.counts[s.mark][d]);
    if (values.some(Boolean)) rows.push(`<tr><td>${d + 1}/${month + 1}</td>${values.map((v) => `<td>${v}</td>`).join('')}</tr>`);
  }
  $('#chart-table').innerHTML = rows.length
    ? `<table><thead><tr><th>Ngày</th>${SERIES.map((s) => `<th>${s.label}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
    : '<p class="muted">Không có số liệu trong tháng này.</p>';

  drawChart();
}

function drawChart() {
  const data = statsData;
  const box = $('#chart');
  if (!data || !box.clientWidth) return;
  // Màn hình hẹp: mỗi ngày tối thiểu 22px để nhãn số không đè nhau, biểu đồ cuộn ngang
  const height = 260;
  const axisW = 26; // = margin-left âm của .plot trong review.css
  const pad = { top: 30, right: 14, bottom: 26, left: axisW + 14 };
  const width = Math.max(box.clientWidth, pad.left + pad.right + data.days * 22);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0, ...SERIES.flatMap((s) => data.counts[s.mark].slice(0, data.shown)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (d) => pad.left + (data.days === 1 ? plotW / 2 : (d * plotW) / (data.days - 1));
  const y = (v) => pad.top + plotH - (v / top) * plotH;

  let svg = ticks.map((t) => `<line class="grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"></line>`).join('');
  // Trục tung là một svg riêng dính bên trái, không trôi mất khi cuộn ngang
  const axis = ticks
    .map((t) => `<text class="axis-text" x="${axisW - 4}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${t}</text>`)
    .join('');
  const every = Math.max(1, Math.ceil((data.days * 24) / plotW)); // nhãn ngày không chồng lên nhau
  for (let d = 0; d < data.days; d += every)
    svg += `<text class="axis-text" x="${x(d)}" y="${height - 6}" text-anchor="middle">${d + 1}</text>`;

  for (const s of SERIES) {
    const pts = data.counts[s.mark].slice(0, data.shown).map((v, d) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`);
    svg += `<polyline class="series c-${s.id}" points="${pts.join(' ')}"></polyline>`;
  }
  // Nhãn số lượng: chỉ ở ngày khác 0. Các điểm sát nhau trong một ngày gom thành một cột nhãn
  // phía trên điểm cao nhất, xếp theo đúng thứ tự trên-dưới của các điểm.
  for (let d = 0; d < data.shown; d++) {
    const points = SERIES.map((s) => ({ s, v: data.counts[s.mark][d] })).filter((p) => p.v).sort((a, b) => b.v - a.v);
    const groups = [];
    for (const p of points) {
      const last = groups.at(-1);
      if (last && y(p.v) - y(last.at(-1).v) < 16) last.push(p);
      else groups.push([p]);
    }
    for (const group of groups) {
      const base = y(group[0].v) - 8;
      group.forEach(({ s, v }, i) => {
        svg += `<circle class="dot c-${s.id}" cx="${x(d)}" cy="${y(v)}" r="4"></circle>
          <text class="value-text" x="${x(d)}" y="${base - (group.length - 1 - i) * 12}" text-anchor="middle">${v}</text>`;
      });
    }
  }
  svg += `<line class="crosshair" y1="${pad.top}" y2="${pad.top + plotH}" visibility="hidden"></line>`;

  const scrollLeft = box.scrollLeft; // thay nội dung làm thanh cuộn nhảy về đầu
  box.innerHTML = `<svg class="y-axis" width="${axisW}" height="${height}" aria-hidden="true">${axis}</svg>
    <svg class="plot" width="${width}" height="${height}" role="img"
    aria-label="Biểu đồ số từ được đánh dấu theo mức thuộc mỗi ngày, tháng ${statsMonth.month + 1}/${statsMonth.year}">${svg}</svg>
    <div class="chart-tip" hidden></div>`;

  const svgEl = box.querySelector('.plot');
  const tip = box.querySelector('.chart-tip');
  const cross = box.querySelector('.crosshair');
  const hide = () => ((tip.hidden = true), cross.setAttribute('visibility', 'hidden'));
  const show = (e) => {
    const rect = svgEl.getBoundingClientRect();
    const day = Math.round(((e.clientX - rect.left - pad.left) / plotW) * (data.days - 1));
    if (day < 0 || day >= data.shown) return hide();
    cross.setAttribute('x1', x(day));
    cross.setAttribute('x2', x(day));
    cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<strong>${day + 1}/${statsMonth.month + 1}/${statsMonth.year}</strong>` +
      SERIES.map((s) => `<div class="c-${s.id}"><i></i>${s.label}<b>${data.counts[s.mark][day]}</b></div>`).join('');
    tip.hidden = false;
    // Tooltip nằm trong phần đang nhìn thấy của biểu đồ (có thể đang cuộn ngang)
    const viewRight = box.scrollLeft + box.clientWidth;
    const left = x(day) + 12 + tip.offsetWidth > viewRight ? x(day) - 12 - tip.offsetWidth : x(day) + 12;
    tip.style.left = Math.max(box.scrollLeft, left) + 'px';
  };
  svgEl.addEventListener('pointermove', show);
  svgEl.addEventListener('pointerdown', show); // chạm trên điện thoại
  svgEl.addEventListener('pointerleave', hide);
  box.onscroll = hide;

  // Lần đầu xem một tháng: cuộn tới ngày cuối có số liệu (hôm nay với tháng hiện tại)
  const monthKey = `${statsMonth.year}-${statsMonth.month}`;
  if (box.dataset.month !== monthKey) {
    box.dataset.month = monthKey;
    box.scrollLeft = x(data.shown - 1) - box.clientWidth + pad.right + 24;
  } else {
    box.scrollLeft = scrollLeft;
  }
}

function shiftMonth(delta) {
  const d = new Date(statsMonth.year, statsMonth.month + delta, 1);
  statsMonth = { year: d.getFullYear(), month: d.getMonth() };
  renderStats();
}
$('#month-prev').addEventListener('click', () => shiftMonth(-1));
$('#month-next').addEventListener('click', () => shiftMonth(1));
new ResizeObserver(() => drawChart()).observe($('#chart'));

// ---------- Cài đặt chung ----------

const form = $('#settings-form');
const fields = form.elements;
const CHECKBOXES = ['enabled', 'autoPlay', 'highlight', 'youtube', 'ytTranslate'];

function fillSettingsForm() {
  for (const name of CHECKBOXES) fields[name].checked = settings[name];
  fields.accent.value = settings.accent;
  fields.dailyGoal.value = settings.dailyGoal;
  fields.msKey.value = settings.msKey;
  fields.msRegion.value = settings.msRegion;
}

const formSettings = () => ({
  ...Object.fromEntries(CHECKBOXES.map((name) => [name, fields[name].checked])),
  accent: fields.accent.value,
  dailyGoal: Math.min(500, Math.max(1, Math.round(Number(fields.dailyGoal.value)) || DEFAULT_SETTINGS.dailyGoal)),
  msKey: fields.msKey.value.trim(),
  msRegion: fields.msRegion.value.trim()
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  settings = await updateSettings(formSettings());
  const msg = $('#saved-msg');
  msg.hidden = false;
  setTimeout(() => (msg.hidden = true), 2000);
});

$('#ms-test').addEventListener('click', async () => {
  const result = $('#ms-result');
  settings = await updateSettings(formSettings());
  result.textContent = 'Đang kiểm tra…';
  try {
    result.textContent = `✓ Hoạt động: “${await callBackground({ type: 'testMicrosoft' })}”`;
  } catch (err) {
    result.textContent = `✗ ${err.message}`;
  }
});

// ---------- Đồng bộ Supabase ----------

const syncForm = $('#sync-form');

function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  return new Date(ms).toLocaleString('vi-VN');
}

async function renderSync() {
  const { syncConfig, syncSession, syncState = {} } = await chrome.storage.local.get([
    'syncConfig',
    'syncSession',
    'syncState'
  ]);
  const signedIn = !!syncSession;

  syncForm.hidden = signedIn;
  $('#sync-account').hidden = !signedIn;
  if (!syncForm.elements.url.value) {
    syncForm.elements.url.value = syncConfig?.url || VEL_CONFIG?.supabaseUrl || '';
    syncForm.elements.anonKey.value = syncConfig?.anonKey || VEL_CONFIG?.supabaseAnonKey || '';
  }
  $('#sync-email').textContent = syncSession?.email || '';

  const text =
    syncState.status === 'syncing' ? 'Đang đồng bộ…'
    : syncState.status === 'ok' ? `Đã đồng bộ ${timeAgo(syncState.lastSync)}`
    : syncState.status === 'error' ? 'Lỗi đồng bộ'
    : '';
  $('#sync-status').textContent = signedIn ? text : '';
  $('#sync-error').hidden = syncState.status !== 'error';
  $('#sync-error').textContent = syncState.message || '';

  const badge = $('#sync-badge');
  badge.hidden = !signedIn && syncState.status !== 'error';
  badge.className = `sync-badge is-${syncState.status || 'off'}`;
  badge.textContent = syncState.status === 'error' ? '⚠ Lỗi đồng bộ' : syncState.status === 'syncing' ? '⟳ Đang đồng bộ' : '☁ Đã đồng bộ';
  badge.title = syncState.message || text;
}

syncForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = syncForm.elements;
  const button = syncForm.querySelector('button[type="submit"]');
  button.disabled = true;
  $('#sync-error').hidden = true;
  try {
    await callBackground({
      type: 'syncSignIn',
      url: f.url.value,
      anonKey: f.anonKey.value,
      email: f.email.value.trim(),
      password: f.password.value
    });
    f.password.value = '';
  } catch (err) {
    $('#sync-error').textContent = err.message;
    $('#sync-error').hidden = false;
  }
  button.disabled = false;
});

$('#sync-now').addEventListener('click', () => callBackground({ type: 'syncNow' }).catch(() => {}));
$('#sync-out').addEventListener('click', async () => {
  if (confirm('Đăng xuất? Sổ từ trên máy này vẫn được giữ nguyên.')) await callBackground({ type: 'syncSignOut' });
});

$('#sync-badge').addEventListener('click', () => (location.hash = 'settings'));

// ---------- Khởi động ----------

// Nút mở web app Languages (Anh · Trung · Hàn) – chỉ hiện khi đã điền appUrl trong config.js
if (/^https:\/\//.test(VEL_CONFIG?.appUrl || '')) {
  $('#open-app').href = VEL_CONFIG.appUrl.replace(/\/+$/, '') + '/#/en/words';
  $('#open-app').hidden = false;
}

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderList();
    renderDeckControls();
    renderStats();
  }, 50);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let wordsChanged = false;
  for (const [k, change] of Object.entries(changes)) {
    if (!k.startsWith(WORD_PREFIX)) continue;
    const key = k.slice(WORD_PREFIX.length);
    if (change.newValue === undefined) delete words[key];
    else words[key] = change.newValue;
    wordsChanged = true;
  }
  if (changes.words) getWords().then((all) => ((words = all), scheduleRender())); // dữ liệu dạng cũ vừa được tách
  if (wordsChanged) scheduleRender();
  if (changes.settings) {
    settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    renderGoal();
  }
  if (changes.syncState || changes.syncSession || changes.syncConfig) renderSync();
});

(async () => {
  [words, settings, cefrIndex] = await Promise.all([getWords(), getSettings(), loadCefrIndex()]);
  fillSettingsForm();
  renderList();
  renderDeckControls();
  renderSync();
  showTab(location.hash.slice(1));
  callBackground({ type: 'syncNow' }).catch(() => {}); // lấy thay đổi từ máy khác khi mở sổ từ
})();
