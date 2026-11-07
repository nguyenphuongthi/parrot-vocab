// Gửi một truy vấn nhẹ tới Supabase để project gói free không bị tạm dừng (bị dừng nếu ~1 tuần không hoạt động).
// Không đăng nhập nên Row Level Security trả về danh sách rỗng – không đọc được dữ liệu nào.
// Đọc URL + anon key từ supabase.config.js (hoặc biến môi trường SUPABASE_URL / SUPABASE_ANON_KEY).
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase.config.js';

const url = (process.env.SUPABASE_URL || SUPABASE_URL).replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

let failed = false;
for (const table of ['words', 'items']) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=key&limit=1`, { headers: { apikey: key } });
    const body = await res.text();
    console.log(`${table}: HTTP ${res.status} ${body.slice(0, 120)}`);
    if (!res.ok) failed = true;
  } catch (err) {
    console.log(`::error::${table}: ${err.message}`);
    failed = true;
  }
}
if (failed) {
  console.log('::error::Không truy vấn được Supabase – kiểm tra project có đang bị tạm dừng, đã chạy supabase/schema.sql chưa.');
  process.exitCode = 1;
}
