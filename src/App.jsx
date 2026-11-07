import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Login from './Login.jsx';
import { supabase, setAccessCookie } from './lib/supabase.js';
import { clearLocal, loadLocal, startSync, syncNow, useSyncStatus, useTable } from './lib/store.js';
import { isDue } from './lib/srs.js';
import { LANGS } from './lib/langs.js';
import { useSettings } from './lib/settings.js';
import { Loader } from './components/Logo.jsx';
import Scenery from './components/Scenery.jsx';
import HeaderScene, { useScene } from './components/HeaderScene.jsx';
import { ChartIcon, CloudIcon, GearIcon } from './components/Icons.jsx';
import FxLayer from './components/FxLayer.jsx';
import { useBadgeWatcher } from './lib/achievements.js';

const EnglishWords = lazy(() => import('./en/EnglishWords.jsx'));
const ZhVocab = lazy(() => import('./zh/ZhVocab.jsx'));
const GrammarView = lazy(() => import('./zh/GrammarView.jsx'));
const KoAlphabet = lazy(() => import('./ko/KoAlphabet.jsx'));
const KoWords = lazy(() => import('./ko/KoWords.jsx'));
const KoPhrases = lazy(() => import('./ko/KoPhrases.jsx'));
const Flashcards = lazy(() => import('./review/Flashcards.jsx'));
const StatsView = lazy(() => import('./stats/StatsView.jsx'));
const SettingsView = lazy(() => import('./settings/SettingsView.jsx'));

const LAST_ROUTE = 'languages.route';

// Đường dẫn: #/en/words, #/zh/grammar4, #/ko/alphabet, #/stats, #/settings …
function parseRoute(hash) {
  const [a, b] = hash.replace(/^#\/?/, '').split('/');
  if (a === 'stats' || a === 'settings') return { page: a, lang: null, tab: null };
  if (LANGS[a]) {
    const tabs = LANGS[a].tabs.map(([id]) => id);
    return { page: 'lang', lang: a, tab: tabs.includes(b) ? b : tabs[0] };
  }
  return null;
}

function useRoute() {
  const initial = () => {
    const fromHash = parseRoute(location.hash);
    if (fromHash) return fromHash;
    try {
      return parseRoute(localStorage.getItem(LAST_ROUTE) || '') || parseRoute('#/en/words');
    } catch {
      return parseRoute('#/en/words');
    }
  };
  const [route, setRoute] = useState(initial);
  useEffect(() => {
    const on = () => {
      const r = parseRoute(location.hash);
      if (r) setRoute(r);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    const hash = route.page === 'lang' ? `#/${route.lang}/${route.tab}` : `#/${route.page}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    try {
      if (route.page === 'lang') localStorage.setItem(LAST_ROUTE, hash);
    } catch {
      /* bỏ qua */
    }
  }, [route]);
  return route;
}

const go = (hash) => {
  location.hash = hash;
  window.scrollTo({ top: 0 });
};

// Số thẻ cần ôn hôm nay của từng ngôn ngữ (huy hiệu trên tab Flashcard)
// Tiến độ cho khung cảnh: số từ đã thuộc (cây lớn dần) và hàm chọn một từ đang học (chú vẹt nói)
function wordOfItem(key) {
  if (key.startsWith('zh:')) {
    const id = key.slice(3);
    return id.startsWith('g') ? null : { text: id.slice(id.indexOf('-') + 1), lang: 'zh' };
  }
  // "ko:w:일(1)" → "일" (bỏ phần phân biệt từ đồng âm)
  if (key.startsWith('ko:')) return { text: key.slice(5).replace(/\(.*\)$/, ''), lang: 'ko' };
  return null;
}

function useLearning(currentLang) {
  const words = useTable('words');
  const items = useTable('items');
  const mastered = useMemo(() => {
    let n = 0;
    for (const w of Object.values(words)) if (w.mark === 2) n++;
    for (const [k, v] of Object.entries(items)) if (v?.mark === 2 && !k.startsWith('zh:g')) n++;
    return n;
  }, [words, items]);
  const pickWord = useCallback(() => {
    const pool = [];
    for (const w of Object.values(words)) pool.push({ text: w.word, lang: 'en', at: w.updatedAt || 0, mark: w.mark || 0 });
    for (const [k, v] of Object.entries(items)) {
      const word = wordOfItem(k);
      if (word) pool.push({ ...word, at: v.updatedAt || 0, mark: v.mark || 0 });
    }
    if (!pool.length) return null;
    const mine = pool.filter((w) => w.lang === currentLang);
    const list = (mine.length ? mine : pool).sort((a, b) => (b.mark > 0) - (a.mark > 0) || b.at - a.at).slice(0, 40);
    return list[Math.floor(Math.random() * list.length)];
  }, [words, items, currentLang]);
  return { mastered, pickWord };
}

function useDueCounts() {
  const words = useTable('words');
  const items = useTable('items');
  return useMemo(() => {
    const out = { en: 0, zh: 0, ko: 0 };
    for (const w of Object.values(words)) if (isDue(w)) out.en++;
    for (const [k, v] of Object.entries(items)) {
      if (k.startsWith('zh:g')) continue; // điểm ngữ pháp không có trong flashcard
      if (isDue(v)) out[k.slice(0, 2)]++;
    }
    return out;
  }, [words, items]);
}

function SyncBadge() {
  const s = useSyncStatus();
  if (s.state === 'idle') return null;
  const label =
    s.state === 'syncing' ? 'Đang đồng bộ' : s.state === 'ok' ? 'Đã đồng bộ' : s.state === 'offline' ? 'Mất mạng' : 'Lỗi đồng bộ';
  return (
    <a href="#/settings" className={`sync-badge is-${s.state}`} title={s.message || label} aria-label={label}>
      <CloudIcon size={16} />
      <span className="sync-label">{label}</span>
    </a>
  );
}

function Shell({ onLogout, onUnauthorized }) {
  const route = useRoute();
  const due = useDueCounts();
  const scene = useScene();
  const lang = route.lang;
  const learning = useLearning(lang);
  const syncState = useSyncStatus();
  useBadgeWatcher(syncState.lastSync > 0);

  useEffect(() => {
    document.title =
      route.page === 'stats' ? 'Thống kê · Languages'
      : route.page === 'settings' ? 'Cài đặt · Languages'
      : `${LANGS[lang].tabs.find(([id]) => id === route.tab)[1]} · ${LANGS[lang].name}`;
  }, [route, lang]);

  const lastLang = (() => {
    try {
      return (localStorage.getItem(LAST_ROUTE) || '').split('/')[1] || 'en';
    } catch {
      return 'en';
    }
  })();
  const activeLang = lang || (LANGS[lastLang] ? lastLang : 'en');

  let page;
  if (route.page === 'stats') page = <StatsView />;
  else if (route.page === 'settings') page = <SettingsView onLogout={onLogout} />;
  else if (route.tab === 'review') page = <Flashcards key={lang} lang={lang} />;
  else if (lang === 'en') page = <EnglishWords />;
  else if (lang === 'zh') {
    page =
      route.tab === 'vocab' ? <ZhVocab onUnauthorized={onUnauthorized} />
      : <GrammarView key={route.tab} level={route.tab === 'grammar4' ? 4 : 5} onUnauthorized={onUnauthorized} />;
  } else {
    page = route.tab === 'alphabet' ? <KoAlphabet /> : route.tab === 'words' ? <KoWords /> : <KoPhrases />;
  }

  return (
    <div className="app" data-lang={activeLang} data-page={route.page}>
      <Scenery lang={route.page === 'lang' ? lang : 'all'} />
      <FxLayer lang={lang} />
      <header className="topbar" data-scene={scene}>
        <HeaderScene lang={route.page === 'lang' ? lang : 'all'} scene={scene} mastered={learning.mastered} pickWord={learning.pickWord} />
        <div className="topbar-inner">
          <a href={`#/${activeLang}`} className="brand" aria-label="Trang chính" title="Trang chính">
            <span className="brand-spot" />
          </a>

          <nav className="lang-switch" aria-label="Chọn ngôn ngữ">
            {Object.entries(LANGS).map(([id, l]) => (
              <a
                key={id}
                href={`#/${id}`}
                className={`lang-btn ${lang === id ? 'is-on' : ''}`}
                aria-current={lang === id ? 'page' : undefined}
                data-lang={id}
                title={l.name}
              >
                <span className="lang-name" lang={id === 'zh' ? 'zh-CN' : id}>
                  {l.native}
                </span>
                {due[id] > 0 && <span className="dot-badge" aria-label={`${due[id]} thẻ cần ôn`} />}
              </a>
            ))}
          </nav>

          <div className="topbar-tools">
            <SyncBadge />
            <a href="#/stats" className={`icon-link ${route.page === 'stats' ? 'is-on' : ''}`} title="Thống kê" aria-label="Thống kê">
              <ChartIcon size={20} />
            </a>
            <a href="#/settings" className={`icon-link ${route.page === 'settings' ? 'is-on' : ''}`} title="Cài đặt" aria-label="Cài đặt">
              <GearIcon size={20} />
            </a>
          </div>
        </div>

        {lang && (
          <nav className="subtabs" role="tablist" aria-label={`Nội dung ${LANGS[lang].name}`}>
            {LANGS[lang].tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={route.tab === id} className="subtab" onClick={() => go(`#/${lang}/${id}`)}>
                {label}
                {id === 'review' && due[lang] > 0 && <span className="count-badge">{due[lang]}</span>}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="page" key={route.page === 'lang' ? `${lang}/${route.tab}` : route.page}>
        {route.page !== 'lang' && <h1 className="page-title">{route.page === 'stats' ? 'Thống kê' : 'Cài đặt'}</h1>}
        <Suspense fallback={<Loader />}>{page}</Suspense>
      </main>
    </div>
  );
}

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
}

export default function App() {
  const [status, setStatus] = useState('checking'); // checking | out | in
  useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessCookie(data.session);
      setStatus(data.session ? 'in' : 'out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') setStatus('in');
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) setStatus('out');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (status !== 'in') return;
    loadLocal();
    return startSync();
  }, [status]);

  const logout = useCallback(async () => {
    if (!confirm('Đăng xuất? Dữ liệu trên thiết bị này sẽ được xoá (vẫn còn trên Supabase).')) return;
    await syncNow();
    await clearLocal();
    try {
      for (const k of await caches.keys()) if (k.startsWith('languages-data')) await caches.delete(k);
    } catch {
      /* trình duyệt không có Cache Storage */
    }
    await supabase.auth.signOut();
    setStatus('out');
  }, []);

  const expire = useCallback(() => setStatus('out'), []);

  if (status === 'checking') {
    return (
      <div className="login-page">
        <Loader />
      </div>
    );
  }
  if (status === 'out') return <Login />;
  return <Shell onLogout={logout} onUnauthorized={expire} />;
}
