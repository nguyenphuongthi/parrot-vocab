// Vercel Function: GET /api/lookup?q=<từ tiếng Anh> → nghĩa tiếng Việt, từ loại, định nghĩa, phiên âm.
// Tra phía server vì trình duyệt không gọi thẳng được Google Translate / Wiktionary (CORS, CSP connect-src 'self').
// Chỉ người đã đăng nhập mới gọi được: middleware.js kiểm tra phiên Supabase cho cả /api/* lẫn /data/*.
// Khi chạy `npm run dev`, vite.config.js gắn cùng hàm này vào dev server.
import { isLookupText, lookupWord } from '../src/lib/dictionary.js';

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q') || '';
  if (!isLookupText(q)) return json({ error: 'Chỉ tra được từ / cụm từ tiếng Anh (tối đa 5 từ).' }, 400);
  try {
    // Kết quả tra của cùng một từ ít thay đổi – cho trình duyệt giữ 1 ngày (riêng từng người dùng)
    return json(await lookupWord(q), 200, { 'cache-control': 'private, max-age=86400' });
  } catch (err) {
    return json({ error: err.message || 'Không tra được từ này.' }, 502, { 'cache-control': 'no-store' });
  }
}
