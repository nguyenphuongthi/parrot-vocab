// Supabase dùng chung với extension Vocab English Lens (cùng project, cùng tài khoản).
// URL và anon / publishable key được phép công khai: dữ liệu được bảo vệ bằng Row Level Security
// và đã tắt đăng ký tài khoản mới. Dùng ở cả trình duyệt (src/) lẫn middleware.js và scripts/.
// Muốn trỏ sang project khác khi chạy thử: đặt VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env.local.
export const SUPABASE_URL = 'https://fnxfcpnbpzkjwhlzjpud.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_vEV2jOb9guB_D7mQ7kYNaw_4HE5qzED';

// Cookie chứa access token của phiên Supabase – middleware.js đọc để chặn /data/* khi chưa đăng nhập.
export const ACCESS_COOKIE = 'lang_at';
