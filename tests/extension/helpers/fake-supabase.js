// Supabase giả: Auth (email/mật khẩu, refresh token) + bảng words với RLS và hàm push_words,
// xử lý giống supabase/schema.sql (chỉ ghi khi bản gửi lên mới hơn; synced_at tăng dần).
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*'
};

function createFakeSupabase({ url = 'https://demo.supabase.co', anonKey = 'anon-key', users = { 'me@x.com': 'pw' } } = {}) {
  const rows = new Map(); // `${email}|${key}` -> row
  let seq = 0;
  const nextSyncedAt = () => new Date(Date.UTC(2026, 0, 1) + ++seq * 1000).toISOString();

  // Trả về { status, headers, body } – dùng được cho fetch giả lẫn chặn request trong trình duyệt
  function handle(requestUrl, { method = 'GET', headers = {}, body } = {}) {
    const u = new URL(requestUrl);
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const reply = (status, data) => ({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: data === undefined ? '' : JSON.stringify(data)
    });

    if (method === 'OPTIONS') return { status: 204, headers: CORS, body: '' };
    if (h.apikey !== anonKey) return reply(401, { message: 'Invalid API key' });

    if (u.pathname === '/auth/v1/token') {
      const b = JSON.parse(body);
      if (u.searchParams.get('grant_type') === 'password') {
        if (users[b.email] !== b.password) return reply(400, { error_description: 'Invalid login credentials' });
        return reply(200, { access_token: 'tok:' + b.email, refresh_token: 'ref:' + b.email, expires_in: 3600, user: { email: b.email } });
      }
      const email = b.refresh_token.slice(4);
      return reply(200, { access_token: 'tok:' + email, refresh_token: b.refresh_token, expires_in: 3600, user: { email } });
    }

    const user = (h.authorization || '').replace('Bearer tok:', '');
    if (!users[user]) return reply(401, { message: 'JWT invalid' });

    if (u.pathname === '/rest/v1/rpc/push_words') {
      for (const item of JSON.parse(body).items) {
        const id = user + '|' + item.key;
        const current = rows.get(id);
        if (current && !(current.updated_at < item.updated_at)) continue;
        rows.set(id, { ...item, deleted: !!item.deleted, user, synced_at: nextSyncedAt() });
      }
      return { status: 204, headers: CORS, body: '' };
    }

    if (u.pathname === '/rest/v1/words') {
      const gt = (u.searchParams.get('synced_at') || '').replace('gt.', '');
      const limit = Number(u.searchParams.get('limit') || 1000);
      const offset = Number(u.searchParams.get('offset') || 0);
      const list = [...rows.values()]
        .filter((r) => r.user === user && (!gt || r.synced_at > gt))
        .sort((a, b) => a.synced_at.localeCompare(b.synced_at))
        .slice(offset, offset + limit)
        .map(({ user: _u, ...r }) => r);
      return reply(200, list);
    }

    return reply(404, { code: 'PGRST202' });
  }

  // Ghi sẵn một từ lên "server" (dùng cho test web)
  function seed(email, key, data, updatedAt = Date.now() - 100000) {
    rows.set(email + '|' + key, {
      key,
      data: { ...data, key, updatedAt },
      deleted: false,
      updated_at: updatedAt,
      synced_at: nextSyncedAt(),
      user: email
    });
  }

  const fetch = async (requestUrl, init = {}) => {
    const r = handle(requestUrl, init);
    return new Response(r.status === 204 ? null : r.body || null, { status: r.status, headers: r.headers });
  };

  return { url, anonKey, rows, handle, seed, fetch, row: (email, key) => rows.get(email + '|' + key) };
}

module.exports = { createFakeSupabase };
