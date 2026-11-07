// Content script:
//   - bôi đen một từ / cụm từ tiếng Anh (≤ 5 từ) → popup dịch;
//   - YouTube: bấm vào từ trong phụ đề → video tự dừng, popup hiện, đóng popup thì phát tiếp;
//     phụ đề không phải tiếng Anh thì hiện thêm dòng dịch tiếng Anh, bấm vào từ được như phụ đề;
//   - gạch chân các từ đã có trong kho (CSS Custom Highlight API – không sửa DOM của trang).
(() => {
  const MAX_WORDS = 5;
  const ENGLISH = /^[A-Za-z][A-Za-z'’\- ]*[A-Za-z]$/;
  const SINGLE_WORD = /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/;
  const WORD_RE = /[A-Za-z][A-Za-z'’-]*[A-Za-z]/g;
  const IS_YOUTUBE = /(^|\.)youtube\.com$/.test(location.hostname);

  // Mỗi trang chỉ một bản content script hoạt động: bản khác nhận trang thì bản này tự gỡ.
  const INSTANCE = Math.random().toString(36).slice(2);
  document.documentElement.dataset.vocabLens = INSTANCE;
  const alive = () => document.documentElement.dataset.vocabLens === INSTANCE;
  // Extension vừa được tải lại / cập nhật: chrome.* trên tab đang mở đã vô hiệu ("Extension context
  // invalidated") và không nạp lại được – popup sẽ mời người dùng tải lại trang thay vì im lặng.
  const connected = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  const cleanups = [];

  function on(target, type, handler, options) {
    const wrapped = (e) => (alive() ? handler(e) : teardown());
    target.addEventListener(type, wrapped, options);
    cleanups.push(() => target.removeEventListener(type, wrapped, options));
  }

  function teardown() {
    cleanups.splice(0).forEach((fn) => fn());
    observer.disconnect();
    clearHighlights();
    host.remove();
  }

  let settings = { ...DEFAULT_SETTINGS };
  let wordIndex = {};

  // ---------- Popup trong Shadow DOM để không bị CSS của trang ảnh hưởng ----------

  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;display:none;';
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(STYLES());
  root.adoptedStyleSheets = [sheet];
  const card = document.createElement('div');
  card.className = 'card';
  root.appendChild(card);

  // { text, context, rect, source, data, details, saved, base, fromForm, resumeVideo }
  let current = null;
  let requestId = 0;

  // ---------- Bắt sự kiện ----------

  on(document, 'mouseup', (e) => {
    if (e.button !== 0 || e.composedPath().includes(host)) return;
    setTimeout(onSelection, 10); // đợi selection cập nhật xong (double-click, kéo chuột)
  });

  on(document, 'keyup', (e) => {
    if (e.key === 'Escape') return hide();
    if (e.shiftKey && e.key.startsWith('Arrow')) onSelection();
  });

  on(document, 'mousedown', (e) => {
    if (e.composedPath().includes(host) || captionAt(e.target)) return; // bấm phụ đề: xử lý ở pointerup
    // Bấm vào trình phát YouTube để đóng popup: không tự phát lại, vì YouTube sẽ tự bật/tắt video
    hide({ resume: !(IS_YOUTUBE && e.target.closest?.('#movie_player, .html5-video-player')) });
  });

  // Phụ đề YouTube: bắt pointerdown/pointerup ở window (sớm nhất, trước trình phát – phụ đề còn kéo được
  // nên click có thể bị nuốt), rồi chặn click ngay sau đó để YouTube không bật/tắt video.
  let captionDown = null;
  let swallowClick = false;
  on(window, 'pointerdown', (e) => {
    captionDown = e.button === 0 && settings.enabled && captionAt(e.target) ? { x: e.clientX, y: e.clientY, target: e.target } : null;
  }, true);
  on(window, 'pointerup', (e) => {
    const down = captionDown;
    captionDown = null;
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // đang kéo phụ đề
    if (onCaptionClick(e, captionAt(down.target))) {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 400);
    }
  }, true);

  on(window, 'click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!settings.enabled || e.button !== 0 || e.composedPath().includes(host) || captionAt(e.target)) return;
    if (settings.highlight) onHighlightClick(e);
  }, true);

  on(document, 'fullscreenchange', () => hide({ resume: false }));

  function onSelection() {
    if (!settings.enabled) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || inEditable(sel.anchorNode)) return;

    // Bỏ dấu câu, ngoặc kép… dính ở hai đầu ("perform," → perform)
    const text = sel.toString().replace(/\s+/g, ' ').trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    const words = text.split(' ').length;
    if (text.length < 2 || text.length > 60 || words > MAX_WORDS || !ENGLISH.test(text)) return;
    if (current && host.style.display !== 'none' && wordKey(current.text) === wordKey(text)) return;

    const range = sel.getRangeAt(0);
    show(text, extractContext(range.commonAncestorContainer, text), range.getBoundingClientRect());
  }

  // Chỉ bỏ qua khi vùng bôi đen nằm trong ô nhập liệu (không dựa vào ô nào đang được focus)
  function inEditable(node) {
    const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !!el && (el.isContentEditable || !!el.closest('input, textarea, select'));
  }

  // Lấy câu chứa từ được chọn để lưu kèm và để dịch theo ngữ cảnh
  function extractContext(node, text) {
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    const block = node?.closest('p, li, td, h1, h2, h3, h4, blockquote, dd, figcaption, div') || node;
    const full = (block?.textContent || '').replace(/\s+/g, ' ').trim();
    const idx = full.toLowerCase().indexOf(text.toLowerCase());
    if (idx < 0) return '';
    const start = Math.max(full.lastIndexOf('. ', idx), full.lastIndexOf('? ', idx), full.lastIndexOf('! ', idx));
    const endMatch = full.slice(idx + text.length).search(/[.!?](\s|$)/);
    const end = endMatch < 0 ? full.length : idx + text.length + endMatch + 1;
    const sentence = full.slice(start < 0 ? 0 : start + 2, end).trim();
    return sentence.length > 300 ? full.slice(Math.max(0, idx - 140), idx + text.length + 140).trim() : sentence;
  }

  // Từ tiếng Anh nằm dưới con trỏ chuột. scope: phần tử để dò theo hình học khi API caret
  // không dùng được (vd. phụ đề YouTube đặt user-select: none).
  function wordAtPoint(x, y, scope) {
    return wordFromCaret(x, y) || (scope ? wordFromLayout(scope, x, y) : null);
  }

  function wordFromLayout(root, x, y) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    while (walker.nextNode() && count++ < 300) {
      const node = walker.currentNode;
      for (const m of node.data.matchAll(WORD_RE)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        for (const r of range.getClientRects()) {
          if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) return { word: m[0], rect: r, node };
        }
      }
    }
    return null;
  }

  function wordFromCaret(x, y) {
    let node;
    let offset;
    const pos = document.caretPositionFromPoint?.(x, y);
    if (pos) ({ offsetNode: node, offset } = pos);
    else {
      const r = document.caretRangeFromPoint?.(x, y);
      if (!r) return null;
      ({ startContainer: node, startOffset: offset } = r);
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.data;
    const isWordChar = (c) => /[A-Za-z'’-]/.test(c || '');
    let start = offset;
    let end = offset;
    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < text.length && isWordChar(text[end])) end++;
    const raw = text.slice(start, end);
    const word = raw.replace(/^['’-]+|['’-]+$/g, '');
    if (word.length < 2) return null;
    start += raw.indexOf(word);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + word.length);
    const rect = range.getBoundingClientRect();
    // caretPositionFromPoint vẫn trả về vị trí gần nhất khi bấm vào khoảng trắng
    if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
    return { word, rect, node };
  }

  // ---------- YouTube ----------

  const youtubeVideo = () => (IS_YOUTUBE ? document.querySelector('video.html5-main-video') || document.querySelector('video') : null);
  const CAPTION_EN = 'vel-caption-en'; // dòng phụ đề dịch sang tiếng Anh do extension thêm vào
  const CAPTION_SELECTOR = `.ytp-caption-segment, .caption-visual-line, .captions-text, .caption-window, .${CAPTION_EN}`;
  const captionAt = (el) => (IS_YOUTUBE && settings.youtube && el?.closest?.(CAPTION_SELECTOR)) || null;

  // Trả về true nếu đã mở popup (để chặn click tiếp theo khỏi tới trình phát)
  function onCaptionClick(e, caption) {
    if (!caption) return false;
    const box = caption.closest('.caption-window') || caption;
    const hit = wordAtPoint(e.clientX, e.clientY, box);
    if (!hit) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    const video = youtubeVideo();
    const wasPlaying = !!video && !video.paused;
    video?.pause();
    const line = box.textContent.replace(/\s+/g, ' ').trim();
    // Đang mở popup từ một từ phụ đề khác thì giữ nguyên ý định phát lại video
    show(hit.word, line, hit.rect, { resumeVideo: wasPlaying || !!current?.resumeVideo });
    return true;
  }

  // Nguồn của câu ngữ cảnh; trên YouTube kèm thời điểm để mở lại đúng đoạn video
  function sourceInfo() {
    const info = { url: location.href, title: cleanSourceTitle(document.title, 120) };
    const video = youtubeVideo();
    const id = IS_YOUTUBE && new URL(location.href).searchParams.get('v');
    if (video && id) {
      info.time = Math.max(0, Math.floor(video.currentTime) - 2);
      info.url = `https://www.youtube.com/watch?v=${id}&t=${info.time}s`;
    }
    return info;
  }

  // ---------- YouTube: thêm dòng phụ đề tiếng Anh ----------
  // Phụ đề không phải tiếng Anh → hiện thêm một dòng dịch sang tiếng Anh sát phụ đề gốc; bấm vào từ
  // trong dòng này để tra / lưu như phụ đề thường (câu ngữ cảnh là câu đã dịch).
  // Dò phụ đề định kỳ thay vì theo dõi DOM: trình phát đổi liên tục, còn phụ đề chỉ vài phần tử.

  let captionEn = null;    // phần tử dòng tiếng Anh – gắn vào trình phát để vẫn hiện khi toàn màn hình
  let captionLine = '';    // câu phụ đề gốc đang hiện
  let captionEnText = '';  // bản dịch của captionLine ('' = chưa có / phụ đề đã là tiếng Anh)
  let captionTimer = null;
  let captionReq = 0;

  const captionText = (win) => {
    const segments = [...win.querySelectorAll('.ytp-caption-segment')];
    const text = segments.length ? segments.map((s) => s.textContent).join(' ') : win.textContent;
    return text.replace(/\s+/g, ' ').trim();
  };

  function pollCaption() {
    if (!alive()) return teardown();
    const windows = settings.ytTranslate && !document.hidden
      ? [...document.querySelectorAll('.caption-window')].filter((w) => captionText(w))
      : [];
    const line = windows.map(captionText).join(' ');
    if (line !== captionLine) {
      // Phụ đề tự động hiện dần từng chữ: câu đang dài thêm thì giữ bản dịch cũ, đợi ổn định rồi mới dịch
      const growing = !!captionLine && line.startsWith(captionLine);
      if (!growing) captionEnText = '';
      captionLine = line;
      clearTimeout(captionTimer);
      if (line) captionTimer = setTimeout(() => translateCaption(line), growing ? 600 : 0);
    }
    renderCaptionEn(windows[0]);
  }

  async function translateCaption(line) {
    if (!connected()) return;
    const id = ++captionReq;
    const result = await callBackground({ type: 'captionEn', text: line }).catch(() => null);
    if (id !== captionReq || line !== captionLine) return; // phụ đề đã sang câu khác
    captionEnText = result?.en || '';
    renderCaptionEn([...document.querySelectorAll('.caption-window')].find((w) => captionText(w)));
  }

  function renderCaptionEn(win) {
    const player = win?.closest('#movie_player, .html5-video-player');
    if (!captionEnText || !player) {
      if (captionEn) captionEn.style.display = 'none';
      return;
    }
    if (!captionEn) {
      captionEn = document.createElement('div');
      captionEn.className = CAPTION_EN;
      captionEn.lang = 'en';
    }
    if (captionEn.parentNode !== player) player.appendChild(captionEn);
    if (captionEn.textContent !== captionEnText) captionEn.textContent = captionEnText;
    captionEn.style.display = 'block';

    const p = player.getBoundingClientRect();
    const c = win.getBoundingClientRect();
    const segment = win.querySelector('.ytp-caption-segment');
    captionEn.style.fontSize = segment ? getComputedStyle(segment).fontSize : '';
    captionEn.style.left = `${c.left + c.width / 2 - p.left}px`;
    // Phụ đề ở nửa dưới khung hình → dòng tiếng Anh nằm trên phụ đề; ở nửa trên → nằm dưới
    const lowerHalf = c.top + c.height / 2 > p.top + p.height / 2;
    captionEn.style.top = lowerHalf ? '' : `${c.bottom - p.top + 4}px`;
    captionEn.style.bottom = lowerHalf ? `${p.bottom - c.top + 4}px` : '';
  }

  if (IS_YOUTUBE) {
    const timer = setInterval(pollCaption, 300);
    cleanups.push(() => (clearInterval(timer), clearTimeout(captionTimer), captionEn?.remove()));
  }

  // ---------- Hiển thị ----------

  async function show(text, context, rect, opts = {}) {
    text = text.toLowerCase(); // "SETTLE" / "Settle" → tra và lưu "settle"
    if (!connected()) return showDisconnected(text, rect, opts);
    const id = ++requestId;
    const single = SINGLE_WORD.test(text);
    current = {
      text,
      context,
      rect,
      source: opts.source || sourceInfo(),
      fromForm: opts.fromForm || null,
      resumeVideo: !!opts.resumeVideo,
      data: null,
      phonetics: single ? undefined : null, // undefined = đang tải; cụm từ thì đọc bằng giọng máy
      details: null,
      saved: null,
      base: null
    };
    renderLoading();
    place(rect);

    // Phiên âm chạy song song với phần nghĩa – từ điển chậm hơn Google nhiều nên hiện sau
    const phoneticsP = single ? callBackground({ type: 'phonetics', text }).catch(() => null) : Promise.resolve(null);

    const [data, saved] = await Promise.all([
      callBackground({ type: 'lookup', text }).catch((err) => ({ error: err.message })),
      getWord(text)
    ]);
    if (id !== requestId) return; // người dùng đã chọn từ khác

    if (data.error) return renderError(data.error);
    current.data = data;
    current.saved = saved;
    current.details = saved?.details || null;
    if (hasIpa(saved?.phonetics)) current.phonetics = saved.phonetics; // từ đã lưu: có sẵn phiên âm

    // Từ này là một dạng của từ đã có trong kho (vd. "exaggerating" → "exaggerate")?
    if (!saved) {
      const baseKey = savedKeyFor(text) || (data.baseForm && wordIndex[wordKey(data.baseForm)] ? wordKey(data.baseForm) : null);
      if (baseKey && baseKey !== wordKey(text)) current.base = { key: baseKey, entry: await getWord(baseKey) };
      if (id !== requestId) return;
    }

    render();
    place(rect);

    const target = current;
    const ph = await phoneticsP;
    if (id !== requestId) return;
    if (ph || target.phonetics === undefined) target.phonetics = ph;
    render();
    if (settings.autoPlay) play(settings.accent);
    // Lưu từ trước khi phiên âm về tới → bổ sung vào kho
    if (target.saved && hasIpa(ph) && !hasIpa(target.saved.phonetics)) {
      target.saved = await patchWord(target.text, { phonetics: ph });
    }
  }

  const hasIpa = (ph) => !!(ph?.us?.ipa || ph?.uk?.ipa);

  function showDisconnected(text, rect, opts) {
    requestId++;
    current = { text, rect, resumeVideo: !!opts.resumeVideo };
    host.style.display = 'block';
    card.innerHTML = `${header()}
      <div class="note">⚠ Vocab English Lens vừa được cập nhật nên trang này cần tải lại để tra từ tiếp.</div>
      <button class="btn" data-act="reload">⟳ Tải lại trang</button>`;
    place(rect);
  }

  function place(rect) {
    const container = document.fullscreenElement || document.body || document.documentElement;
    if (host.parentNode !== container) container.appendChild(host);
    const fixed = !!document.fullscreenElement; // toàn màn hình (YouTube): không có cuộn trang
    host.style.position = fixed ? 'fixed' : 'absolute';
    host.style.display = 'block';
    if (current?.dragged) return; // người dùng đã kéo popup đi chỗ khác – giữ nguyên

    const margin = 8;
    const scrollX = fixed ? 0 : window.scrollX;
    const scrollY = fixed ? 0 : window.scrollY;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = rect.left + scrollX;
    left = Math.min(left, scrollX + document.documentElement.clientWidth - width - margin);
    left = Math.max(scrollX + margin, left);
    const below = rect.bottom + margin;
    const fitsBelow = below + height < window.innerHeight || rect.top < height + margin;
    const top = (fitsBelow ? below : rect.top - height - margin) + scrollY;
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function hide({ resume = true } = {}) {
    if (current?.resumeVideo && resume) youtubeVideo()?.play().catch(() => {});
    requestId++;
    host.style.display = 'none';
    current = null;
  }

  function play(accent) {
    const { data, text } = current || {};
    if (!data) return;
    const audio = current.phonetics?.[accent]?.audio || '';
    callBackground({ type: 'speak', text, accent, audio }).catch(() => {});
  }

  // ---------- Render ----------

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const ICON_SPEAKER =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

  const hasContext = (entry, text) =>
    !text || contextsOf(entry).some((c) => c.text.trim().toLowerCase() === text.trim().toLowerCase());

  function contextObject() {
    return current.context ? { text: current.context, ...current.source, at: Date.now() } : null;
  }

  function header() {
    const saved = !!current.saved;
    return `
      <div class="head" title="Kéo để di chuyển">
        <span class="grip" aria-hidden="true">⠿</span>
        <span class="word">${esc(current.text)}</span>
        ${current.data ? cefrBadge(current.data.cefr, esc, { showUnknown: !!current.data.isWord }) : ''}
        <span class="spacer"></span>
        ${current.data ? `<button class="icon save ${saved ? 'on' : ''}" data-act="save" title="${saved ? 'Bỏ lưu' : 'Lưu từ để ôn lại'}">${saved ? '★' : '☆'}</button>` : ''}
        <button class="icon" data-act="close" title="Đóng (Esc)">×</button>
      </div>`;
  }

  function renderLoading() {
    host.style.display = 'block';
    card.innerHTML = header() + '<div class="muted">Đang dịch…</div>';
  }

  function renderError(message) {
    card.innerHTML = header() + `<div class="error">${esc(message)}</div>`;
  }

  // Dòng gợi ý: đã có ở dạng gốc / tra dạng gốc / lưu thêm câu ngữ cảnh
  function notesHtml() {
    const d = current.data;
    if (current.base) {
      const { key, entry } = current.base;
      const action = hasContext(entry, current.context)
        ? '<span class="muted">✓ đã có câu này</span>'
        : `<button class="link" data-act="addctx-base">+ Lưu câu này vào “${esc(key)}”</button>`;
      return `<div class="note">★ Đã có trong kho: <b>${esc(key)}</b> ${action}</div>`;
    }
    const notes = [];
    if (current.saved && !hasContext(current.saved, current.context)) {
      notes.push('<div class="note"><button class="link" data-act="addctx">+ Lưu thêm câu đang đọc</button></div>');
    }
    if (!current.saved && d.isWord && d.baseForm && wordKey(d.baseForm) !== wordKey(current.text)) {
      notes.push(`<div class="note">Dạng gốc: <b>${esc(d.baseForm)}</b> <button class="link" data-act="base">Tra dạng gốc</button></div>`);
    }
    return notes.join('');
  }

  function render() {
    const d = current.data;
    const loadingIpa = current.phonetics === undefined;
    const accents = ['us', 'uk']
      .map((a) => {
        const ipa = current.phonetics?.[a]?.ipa || '';
        const active = settings.accent === a ? 'active' : '';
        const label = ipa ? `<span class="ipa">${esc(ipa)}</span>` : loadingIpa ? '<span class="ipa muted">…</span>' : '';
        return `<button class="accent ${active}" data-act="play" data-accent="${a}" title="Nghe giọng ${a.toUpperCase()}">
            ${ICON_SPEAKER}<b>${a.toUpperCase()}</b>${label}
          </button>`;
      })
      .join('');

    // Cấp độ theo từng loại từ chỉ hiện khi khác nhau (book: danh từ A1, động từ B1)
    const byPos = d.cefr?.byPos || {};
    const perPos = new Set(Object.values(byPos)).size > 1;
    const meanings = (d.meanings || [])
      .slice(0, 4)
      .map((m) => {
        const lv = perPos && byPos[normalizePos(m.pos)];
        return `<li><span class="pos">${esc(m.pos)}</span>${lv ? ` ${cefrBadge({ level: lv, byPos: {} }, esc)}` : ''} ${esc(m.terms.join(', '))}</li>`;
      })
      .join('');

    card.innerHTML = `
      ${header()}
      <div class="accents">${accents}</div>
      <div class="translation">${esc(d.translation)}</div>
      ${meanings ? `<ul class="meanings">${meanings}</ul>` : ''}
      ${notesHtml()}
      <div class="explain">${renderDetails()}</div>`;
  }

  function renderDetails() {
    if (current.loadingDetails) return '<div class="muted">Đang tải giải thích…</div>';
    if (current.detailsError) {
      return `<div class="error">${esc(current.detailsError)}</div><button class="btn" data-act="details">Thử lại</button>`;
    }
    if (!current.details) return '<button class="btn" data-act="details">📖 Giải thích chi tiết</button>';
    return detailsHtml(current.details, current.text, esc);
  }

  // ---------- Hành động ----------

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !current) return;
    e.preventDefault();
    const act = btn.dataset.act;
    const target = current;

    if (act === 'close') return hide();
    if (act === 'reload') return location.reload();

    if (act === 'play') {
      const accent = btn.dataset.accent;
      play(accent);
      if (settings.accent !== accent) {
        settings = await updateSettings({ accent }); // nhớ giọng người dùng chọn
        if (current === target) render();
      }
      return;
    }

    if (act === 'base') {
      return show(target.data.baseForm, target.context, target.rect, {
        fromForm: target.text,
        source: target.source,
        resumeVideo: target.resumeVideo
      });
    }

    if (act === 'save') {
      if (target.saved) {
        await removeWord(target.text);
        target.saved = null;
      } else {
        target.saved = await saveWord(buildEntry());
        // Lưu luôn phần giải thích chi tiết dù người dùng chưa bấm xem: tải về rồi bổ sung vào kho
        if (target.details && !target.saved?.details) target.saved = await patchWord(target.text, { details: target.details });
        else if (!target.details && !target.loadingDetails) loadDetails(target);
      }
    }

    if (act === 'addctx') target.saved = await addContext(target.text, contextObject());
    if (act === 'addctx-base') target.base.entry = await addContext(target.base.key, contextObject());

    if (act === 'details') await loadDetails(target);

    if (current === target) render();
  });

  // Tải phần giải thích chi tiết; từ đã lưu (kể cả lưu trong lúc đang tải) thì ghi luôn vào kho
  async function loadDetails(target) {
    target.loadingDetails = true;
    target.detailsError = null;
    if (current === target) render();
    try {
      const details = await callBackground({ type: 'details', text: target.text, context: target.context });
      target.details = details;
      if (target.saved && details) target.saved = await patchWord(target.text, { details });
    } catch (err) {
      target.detailsError = err.message;
    }
    target.loadingDetails = false;
    if (current === target) render();
  }

  // ---------- Kéo popup bằng thanh tiêu đề (khi popup che phụ đề / nội dung) ----------

  let drag = null;

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.target.closest('.head') || e.target.closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, left: parseFloat(host.style.left) || 0, top: parseFloat(host.style.top) || 0 };
    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
    e.preventDefault(); // không bôi đen chữ, không sinh mousedown/mouseup cho trang
  });

  card.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const fixed = host.style.position === 'fixed';
    const scrollX = fixed ? 0 : window.scrollX;
    const scrollY = fixed ? 0 : window.scrollY;
    // Luôn chừa lại một phần popup trong màn hình để còn kéo về được
    const minLeft = scrollX - card.offsetWidth + 80;
    const maxLeft = scrollX + document.documentElement.clientWidth - 80;
    const maxTop = scrollY + window.innerHeight - 40;
    host.style.left = `${Math.min(Math.max(drag.left + e.clientX - drag.x, minLeft), maxLeft)}px`;
    host.style.top = `${Math.min(Math.max(drag.top + e.clientY - drag.y, scrollY), maxTop)}px`;
    if (current) current.dragged = true;
  });

  const endDrag = () => {
    drag = null;
    card.classList.remove('dragging');
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);

  function buildEntry() {
    const d = current.data;
    const ctx = contextObject();
    return {
      word: current.text,
      isWord: d.isWord,
      phonetics: current.phonetics || { us: { ipa: '', audio: '' }, uk: { ipa: '', audio: '' } },
      translation: d.translation,
      meanings: d.meanings,
      senses: d.senses,
      baseForm: d.baseForm || '',
      forms: current.fromForm ? [wordKey(current.fromForm)] : [],
      contexts: ctx ? [ctx] : [],
      details: current.details
    };
  }

  // ---------- Gạch chân từ đã có trong kho ----------

  const HIGHLIGHT_OK = typeof Highlight === 'function' && !!globalThis.CSS?.highlights;
  const highlights = HIGHLIGHT_OK ? STATES.map(() => new Highlight()) : [];
  highlights.forEach((h, i) => CSS.highlights.set(`vel-${i}`, h));

  let forms = new Map(); // dạng viết thường -> { key, mark }
  let phraseRe = null;   // cụm nhiều chữ

  function rebuildForms() {
    forms = new Map();
    const phrases = [];
    for (const [key, [mark, , ...others]] of Object.entries(wordIndex)) {
      for (const f of [key, ...others]) {
        if (f.includes(' ')) phrases.push(f);
        forms.set(f, { key, mark });
      }
    }
    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    phraseRe = phrases.length ? new RegExp(`\\b(?:${phrases.map(escRe).join('|')})\\b`, 'gi') : null;
  }

  const savedKeyFor = (text) => forms.get(wordKey(text))?.key || null;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG']);
  const TOKEN = /[A-Za-z][A-Za-z'’-]*[A-Za-z]/g;
  const MAX_SCAN_NODES = 20000;

  function skipNode(textNode) {
    const el = textNode.parentElement;
    if (!el || SKIP_TAGS.has(el.tagName) || el.isContentEditable) return true;
    return el === host || host.contains(el);
  }

  function addRange(node, start, end, mark) {
    const range = new Range();
    range.setStart(node, start);
    range.setEnd(node, end);
    highlights[mark]?.add(range);
  }

  function scanTextNode(node) {
    const text = node.data;
    if (text.length < 2 || skipNode(node)) return;
    for (const m of text.matchAll(TOKEN)) {
      const hit = forms.get(wordKey(m[0]));
      if (hit && !hit.key.includes(' ')) addRange(node, m.index, m.index + m[0].length, hit.mark);
    }
    if (phraseRe) {
      for (const m of text.matchAll(phraseRe)) {
        const hit = forms.get(wordKey(m[0]));
        if (hit) addRange(node, m.index, m.index + m[0].length, hit.mark);
      }
    }
  }

  function scan(rootNode) {
    if (!HIGHLIGHT_OK || !forms.size || !rootNode) return;
    if (rootNode.nodeType === Node.TEXT_NODE) return scanTextNode(rootNode);
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let count = 0;
    while (walker.nextNode() && count++ < MAX_SCAN_NODES) scanTextNode(walker.currentNode);
  }

  function clearHighlights() {
    highlights.forEach((h) => h.clear());
  }

  function rescanAll() {
    clearHighlights();
    if (settings.highlight && document.body) scan(document.body);
  }

  // Trang thay đổi (vd. phụ đề YouTube, cuộn vô hạn): bỏ vùng đã mất, quét phần mới – gom lại 500 ms
  let pending = new Set();
  let mutationTimer = null;
  const observer = new MutationObserver((mutations) => {
    if (!alive()) return teardown();
    for (const m of mutations) {
      if (m.type === 'characterData') pending.add(m.target);
      else m.addedNodes.forEach((n) => n !== host && pending.add(n));
    }
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(flushMutations, 500);
  });

  function flushMutations() {
    const changed = pending;
    pending = new Set();
    for (const h of highlights) {
      for (const range of h) {
        if (!range.startContainer.isConnected || changed.has(range.startContainer)) h.delete(range);
      }
    }
    changed.forEach((n) => n.isConnected && scan(n));
  }

  function updateHighlighting() {
    if (!HIGHLIGHT_OK) return;
    observer.disconnect();
    rescanAll();
    if (settings.highlight && forms.size && document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  // Bấm (không bôi đen) vào từ đang được gạch chân → mở popup của từ đó
  function onHighlightClick(e) {
    if (!forms.size || !window.getSelection()?.isCollapsed || inEditable(e.target)) return;
    if (e.target.closest?.('a, button, input, textarea, select, label, summary, [role="button"], [contenteditable]')) return;
    const hit = wordAtPoint(e.clientX, e.clientY, e.target);
    const key = hit && savedKeyFor(hit.word);
    if (!key || key.includes(' ')) return;
    show(key, extractContext(hit.node, hit.word), hit.rect);
  }

  // Kiểu cho phần gạch chân và phụ đề YouTube bấm được – thêm vào trang một lần
  function addPageStyles() {
    const css = `
      ::highlight(vel-0) { text-decoration: underline dotted 2px rgba(216, 69, 59, .85); }
      ::highlight(vel-1) { text-decoration: underline dotted 2px rgba(227, 160, 8, .9); }
      ::highlight(vel-2) { text-decoration: underline dotted 2px rgba(47, 158, 92, .85); }
      ${IS_YOUTUBE ? `.ytp-caption-segment { cursor: pointer !important; } .ytp-caption-segment:hover { text-decoration: underline; }
        .${CAPTION_EN} { position: absolute; z-index: 41; transform: translateX(-50%); width: max-content; max-width: 90%;
          box-sizing: border-box; padding: 2px 8px; border-radius: 4px; background: rgba(8, 8, 8, .75); color: #ffe58a;
          font: 18px/1.35 "YouTube Noto", Roboto, Arial, sans-serif; text-align: center; cursor: pointer; }
        .${CAPTION_EN}:hover { text-decoration: underline; }` : ''}`;
    try {
      const pageSheet = new CSSStyleSheet();
      pageSheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, pageSheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  // ---------- Khởi động ----------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !alive()) return;
    if (changes.settings) {
      const before = settings.highlight;
      settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
      if (before !== settings.highlight) updateHighlighting();
    }
    if (changes.wordIndex) {
      wordIndex = changes.wordIndex.newValue || {};
      rebuildForms();
      updateHighlighting();
    }
  });

  (document.body || document.documentElement).appendChild(host);
  addPageStyles();

  Promise.all([getSettings(), chrome.storage.local.get('wordIndex')]).then(([s, items]) => {
    settings = s;
    wordIndex = items.wordIndex || {};
    rebuildForms();
    const start = () => updateHighlighting();
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 500);
  });

  function STYLES() {
    return `
      :host { all: initial; }
      .card {
        --bg: #ffffff; --fg: #18181b; --muted: #696970; --line: #e3e5f2; --chip: #eef0fb;
        --accent: #3a49a8; --accent-bg: #e3e7ff; --error: #c4372b; --star: #f5a623;
        box-sizing: border-box; width: 360px; max-width: calc(100vw - 16px); max-height: 70vh; overflow-y: auto;
        padding: 14px 16px; border: 0; border-radius: 22px;
        background: linear-gradient(160deg, var(--accent-bg) 0, var(--bg) 120px); color: var(--fg);
        box-shadow: 0 2px 4px rgb(20 20 30 / 6%), 0 18px 40px rgb(20 20 30 / 16%);
        font: 14px/1.45 "Inter", "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
        text-align: left;
      }
      @media (prefers-color-scheme: dark) {
        .card { --bg: #1c1c1f; --fg: #ececf0; --muted: #9d9da7; --line: #2f2f35; --chip: #25252a;
                --accent: #b4c0ff; --accent-bg: #262b4a; --error: #f07368; }
      }
      .head { display: flex; align-items: center; gap: 4px; margin: -4px -6px 8px; padding: 4px 6px;
              border-radius: 12px; cursor: grab; user-select: none; touch-action: none; }
      .head:hover { background: var(--chip); }
      .dragging .head { cursor: grabbing; }
      .card.dragging { box-shadow: 0 16px 40px rgba(0,0,0,.28); }
      .grip { color: var(--muted); font-size: 14px; line-height: 1; opacity: .6; margin-right: 2px; }
      .word { font-size: 18px; font-weight: 700; color: var(--accent); word-break: break-word; }
      .head .cefr { margin-left: 4px; }
      .spacer { flex: 1; }
      button { font: inherit; color: inherit; cursor: pointer; }
      .icon { border: 0; background: none; font-size: 20px; line-height: 1; padding: 2px 6px; border-radius: 6px; color: var(--muted); }
      .icon:hover { background: var(--chip); }
      .save.on { color: var(--star); }
      .accents { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
      .accent { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
                border: 1px solid transparent; border-radius: 999px; background: var(--bg); }
      .accent:hover { border-color: var(--accent); }
      .accent.active { border-color: transparent; background: var(--accent-bg); color: var(--accent); }
      .accent b { font-size: 12px; }
      .ipa { font-family: "Segoe UI", "Lucida Sans Unicode", "Noto Sans", sans-serif; color: var(--fg); }
      .translation { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
      .meanings { margin: 0 0 8px; padding: 0; list-style: none; }
      .meanings li { margin: 2px 0; }
      .pos { display: inline-block; font-size: 11px; padding: 0 8px; border-radius: 999px; background: var(--chip); color: var(--muted); }
      .note { margin: 0 0 8px; padding: 6px 10px; border-radius: 12px; background: var(--chip); font-size: 13px; }
      .link { border: 0; padding: 0; background: none; color: var(--accent); font-weight: 600; }
      .link:hover { text-decoration: underline; }
      .explain { border-top: 1px solid var(--line); padding-top: 8px; margin-top: 4px; }
      .btn { width: 100%; padding: 8px 10px; border: 0; border-radius: 12px;
             background: #7c8ff0; color: #161a33; font-weight: 600; }
      .btn:hover { filter: brightness(1.06); }
      .muted { color: var(--muted); }
      .error { color: var(--error); margin-bottom: 6px; }
      ${DETAILS_STYLES}
    `;
  }
})();
