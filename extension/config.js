// Cấu hình Supabase cho bản web (và điền sẵn ô đồng bộ trong extension).
// URL + key phải giống supabase.config.js ở thư mục gốc (app dùng chung project – có test kiểm tra).
// Lấy ở Supabase Dashboard → Project Settings → API Keys.
// Anon / publishable key được phép công khai: dữ liệu được bảo vệ bằng Row Level Security,
// và đã tắt đăng ký tài khoản mới nên chỉ tài khoản của bạn đăng nhập được.
globalThis.VEL_CONFIG = {
  supabaseUrl: 'https://fnxfcpnbpzkjwhlzjpud.supabase.co',     // vd. 'https://abcdxyz.supabase.co'
  supabaseAnonKey: 'sb_publishable_vEV2jOb9guB_D7mQ7kYNaw_4HE5qzED', // vd. 'sb_publishable_…' hoặc 'eyJhbGciOi…'
  // Link web app Languages (Anh · Trung · Hàn) sau khi deploy, vd. 'https://languages-xxx.vercel.app'.
  // Điền vào thì Sổ từ vựng có nút “Mở app Languages”. Để trống = ẩn nút.
  appUrl: ''
};
