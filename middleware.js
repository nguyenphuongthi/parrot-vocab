// Vercel Routing Middleware: chỉ cho tải nội dung bài học (/data/*) và gọi API tra từ (/api/*) khi đã đăng nhập.
// Trình duyệt gửi access token của phiên Supabase trong cookie (src/lib/supabase.js đặt cookie này);
// middleware hỏi Supabase Auth xem token còn hợp lệ không. Giao diện (index.html, assets/) vẫn tải được
// để hiện trang đăng nhập, nhưng không chứa dữ liệu bài học.
import { next } from '@vercel/functions';
import { ACCESS_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase.config.js';

export const config = { matcher: ['/data/:path*', '/api/:path*'] };

const verified = new Map(); // token -> hết hạn lúc (ms); giữ trong bộ nhớ của instance để đỡ gọi lại
const CACHE_MS = 5 * 60_000;

function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}

async function isValid(token) {
  if (!token || token.length > 4096) return false;
  const until = verified.get(token);
  if (until && until > Date.now()) return true;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!r?.ok) return false;
  if (verified.size > 500) verified.clear();
  verified.set(token, Date.now() + CACHE_MS);
  return true;
}

export default async function middleware(request) {
  if (await isValid(readCookie(request, ACCESS_COOKIE))) return next();
  return new Response(JSON.stringify({ error: 'Chưa đăng nhập.' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
