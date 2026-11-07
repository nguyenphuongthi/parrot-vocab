import { useState } from 'react';

// Một mục có thể mở/thu: tiêu đề (tiếng Trung / Hàn…) + phụ đề tiếng Việt.
export default function Disclosure({ zh, title = zh, lang, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const titleLang = lang || (/[가-힣]/.test(title) ? 'ko' : 'zh-CN');
  return (
    <section className={`panel ${open ? 'is-open' : ''}`}>
      <button type="button" className="panel-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span lang={titleLang}>{title}</span>
        <span className="panel-sub">{sub}</span>
        <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}
