// Chuyển MỘT LẦN mức thuộc tiếng Trung từ Upstash Redis (web HSK-Vocab cũ) sang bảng items trên Supabase.
//
//   1. Lấy biến môi trường của project Vercel HSK cũ (Vercel → Settings → Environment Variables,
//      hoặc `vercel env pull` trong thư mục web/ của repo HSK):
//        KV_REST_API_URL, KV_REST_API_TOKEN   (hoặc UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
//        AUTH_USERNAME                         (tài khoản đăng nhập của web HSK cũ)
//   2. Tài khoản Supabase (giống khi đăng nhập app):  SUPABASE_EMAIL, SUPABASE_PASSWORD
//   3. Chạy thử (không ghi gì):      npm run migrate:hsk
//      Ghi thật lên Supabase:        npm run migrate:hsk -- --apply
//
// Chi tiết:
//   - Redis hash "hsk:marks:<AUTH_USERNAME>": field = id ("1-爱" từ vựng, "g4-1-2" ngữ pháp), value = 1 | 2.
//   - Mỗi mục thành dòng items: key "zh:<id>", data { mark, srs? }. Từ vựng được xếp lịch ôn (hơi nhớ: trong
//     3 ngày, đã thuộc: trong 7 ngày, rải đều để không dồn vào một ngày). Không ghi lịch sử (markLog / addedAt)
//     nên biểu đồ thống kê không bị dồn cả nghìn mục vào ngày chuyển.
//   - Server chỉ nhận bản mới hơn bản đang có, nên chạy lại nhiều lần cũng không đè thay đổi đã làm trong app.
//   - Bản sao dữ liệu Redis được lưu ở scripts/.migrate-hsk-backup.json (không đưa lên git).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabase.config.js';

const DAY = 86_400_000;
const apply = process.argv.includes('--apply');
const env = process.env;

function need(name, ...alts) {
  const v = [name, ...alts].map((n) => env[n]).find(Boolean);
  if (!v) {
    console.error(`Thiếu biến môi trường ${[name, ...alts].join(' / ')} – xem hướng dẫn ở đầu file scripts/migrate-hsk-marks.mjs`);
    process.exit(1);
  }
  return v;
}

const redisUrl = need('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL').replace(/\/$/, '');
const redisToken = need('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
const username = need('AUTH_USERNAME', 'HSK_USERNAME');

async function redis(command) {
  const r = await fetch(redisUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${redisToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || data?.error) throw new Error(`Redis: ${data?.error || r.status}`);
  return data.result;
}

const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const flat = (await redis(['HGETALL', `hsk:marks:${username}`])) || [];
const marks = {};
for (let i = 0; i < flat.length; i += 2) marks[flat[i]] = Number(flat[i + 1]);
const ids = Object.keys(marks).filter((id) => marks[id] === 1 || marks[id] === 2);

const backup = join(dirname(fileURLToPath(import.meta.url)), '.migrate-hsk-backup.json');
writeFileSync(backup, JSON.stringify(marks, null, 2));

const now = Date.now();
const items = ids.map((id, i) => {
  const mark = marks[id];
  const data = { mark, key: `zh:${id}`, updatedAt: now };
  if (!id.startsWith('g')) {
    const interval = mark === 2 ? 7 : 3;
    data.srs = { interval, due: startOfDay(now) + (1 + (i % interval)) * DAY, reviews: 0, lapses: 0, last: now };
  }
  return { key: `zh:${id}`, data, deleted: false, updated_at: now };
});

const count = (pred) => ids.filter(pred).length;
console.log(`Redis: ${flat.length / 2} mục đã đánh dấu (bản sao: ${backup})`);
console.log(`  Từ vựng:  ${count((id) => !id.startsWith('g') && marks[id] === 1)} hơi nhớ · ${count((id) => !id.startsWith('g') && marks[id] === 2)} đã thuộc`);
console.log(`  Ngữ pháp: ${count((id) => id.startsWith('g') && marks[id] === 1)} hơi nhớ · ${count((id) => id.startsWith('g') && marks[id] === 2)} đã thuộc`);

if (!apply) {
  console.log('\nChạy thử – chưa ghi gì. Thêm --apply để ghi lên Supabase: npm run migrate:hsk -- --apply');
  process.exit(0);
}

const email = need('SUPABASE_EMAIL');
const password = need('SUPABASE_PASSWORD');
const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());
if (!auth.access_token) {
  console.error('Đăng nhập Supabase thất bại:', auth.error_description || auth.msg || auth.message || auth);
  process.exit(1);
}

for (let i = 0; i < items.length; i += 500) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_items`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.slice(i, i + 500) }),
  });
  if (!r.ok) {
    const text = await r.text();
    console.error(`Lỗi khi ghi (HTTP ${r.status}): ${text}`);
    if (/push_items|items/.test(text)) console.error('→ Hãy chạy supabase/schema.sql trong Supabase SQL Editor trước.');
    process.exit(1);
  }
  console.log(`Đã ghi ${Math.min(i + 500, items.length)}/${items.length}`);
}
console.log('Xong. Mở app → Tiếng Trung để kiểm tra.');
