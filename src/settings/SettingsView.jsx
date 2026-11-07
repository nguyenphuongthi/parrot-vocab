import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { importWords, syncNow, usePending, useSyncStatus, useTable } from '../lib/store.js';
import { updateSettings, useSettings } from '../lib/settings.js';

function timeAgo(ms) {
  if (!ms) return '';
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  return new Date(ms).toLocaleString('vi-VN');
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SettingsView({ onLogout }) {
  const settings = useSettings();
  const sync = useSyncStatus();
  const pending = usePending();
  const words = useTable('words');
  const items = useTable('items');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
  }, []);

  const importFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Object.values(data).filter((w) => w && typeof w.word === 'string');
      if (!incoming.length) throw new Error();
      for (let i = 0; i < incoming.length; i += 200) await importWords(incoming.slice(i, i + 200));
      setMsg(`Đã nhập ${incoming.length} từ tiếng Anh.`);
    } catch {
      setMsg('File không hợp lệ. Hãy chọn file JSON xuất từ Vocab English Lens hoặc từ nút "Xuất kho từ tiếng Anh".');
    }
  };

  const status =
    sync.state === 'syncing' ? 'Đang đồng bộ…'
    : sync.state === 'ok' ? `Đã đồng bộ ${timeAgo(sync.lastSync)}`
    : sync.state === 'offline' ? 'Đang mất mạng – thay đổi được giữ trên máy và sẽ tự gửi lại'
    : sync.state === 'error' ? 'Lỗi đồng bộ'
    : '';

  return (
    <div className="settings">
      <section className="card">
        <h3 className="card-title">Tài khoản & đồng bộ</h3>
        <p>
          Đăng nhập: <b>{email || '…'}</b>
        </p>
        <p className="muted">
          {status}
          {pending > 0 && ` · ${pending} thay đổi chờ gửi`}
        </p>
        {sync.state === 'error' && <p className="error">{sync.message}</p>}
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => syncNow()}>
            Đồng bộ ngay
          </button>
          <button type="button" className="btn danger" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Học tập</h3>
        <label className="row">
          <span>Mục tiêu mỗi ngày (số thẻ flashcard, cộng cả 3 ngôn ngữ)</span>
          <input
            type="number"
            min="1"
            max="500"
            inputMode="numeric"
            value={settings.dailyGoal}
            onChange={(e) => updateSettings({ dailyGoal: Math.min(500, Math.max(1, Math.round(Number(e.target.value)) || 20)) })}
          />
        </label>
        <label className="row">
          <span>Tự phát âm khi mở thẻ / lật flashcard</span>
          <input type="checkbox" checked={settings.autoPlay} onChange={(e) => updateSettings({ autoPlay: e.target.checked })} />
        </label>
        <label className="row">
          <span>Giọng tiếng Anh ưu tiên</span>
          <select value={settings.accent} onChange={(e) => updateSettings({ accent: e.target.value })}>
            <option value="us">US (Mỹ)</option>
            <option value="uk">UK (Anh)</option>
          </select>
        </label>
        <label className="row">
          <span>Cảnh thanh trên</span>
          <select value={settings.scene} onChange={(e) => updateSettings({ scene: e.target.value })}>
            <option value="auto">Tự động (đổi cảnh mỗi 2 phút)</option>
            <option value="day">Ban ngày</option>
            <option value="sunset">Hoàng hôn</option>
            <option value="night">Ban đêm</option>
            <option value="rain">Trời mưa</option>
            <option value="snow">Tuyết rơi</option>
          </select>
        </label>
        <label className="row">
          <span>Giao diện</span>
          <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value })}>
            <option value="auto">Theo hệ thống</option>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h3 className="card-title">Sao lưu</h3>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => download(`english-words-${today}.json`, words)}>
            Xuất kho từ tiếng Anh
          </button>
          <label className="btn">
            Nhập kho từ tiếng Anh
            <input type="file" accept="application/json,.json" hidden onChange={importFile} />
          </label>
          <button type="button" className="btn" onClick={() => download(`languages-backup-${today}.json`, { words, items })}>
            Tải bản sao lưu toàn bộ
          </button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </section>
    </div>
  );
}
