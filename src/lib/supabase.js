import { createClient } from '@supabase/supabase-js';
import { ACCESS_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../supabase.config.js';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'languages-auth' },
});

// Access token cũng được đặt vào cookie để middleware.js cho phép tải /data/* (nội dung bài học).
// Token tự làm mới mỗi giờ (TOKEN_REFRESHED) nên cookie luôn được cập nhật theo.
export function setAccessCookie(session) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  if (session?.access_token) {
    const maxAge = Math.max(60, (session.expires_at || 0) - Math.floor(Date.now() / 1000));
    document.cookie = `${ACCESS_COOKIE}=${session.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

supabase.auth.onAuthStateChange((_event, session) => setAccessCookie(session));

export const UNAUTHORIZED = 'unauthorized';

// Tải file nội dung (đi qua middleware). 401: thử làm mới phiên một lần rồi tải lại.
export async function getJson(path) {
  const load = () => fetch(path, { credentials: 'same-origin' });
  let r = await load();
  if (r.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    setAccessCookie(data?.session);
    if (data?.session) r = await load();
  }
  if (r.status === 401) throw new Error(UNAUTHORIZED);
  if (!r.ok) {
    const body = await r.json().catch(() => null); // API trả { error: "…" } – hiện đúng lý do cho người dùng
    throw new Error(body?.error || r.statusText || `HTTP ${r.status}`);
  }
  return r.json();
}
