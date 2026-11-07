-- Vocab English Lens – bảng lưu từ vựng trên Supabase.
-- Chạy toàn bộ file này một lần trong Supabase Dashboard → SQL Editor.

create table if not exists public.words (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  key        text    not null,                 -- từ viết thường, vd. "take off"
  data       jsonb,                            -- toàn bộ dữ liệu của từ (nghĩa, phiên âm, mức thuộc…)
  deleted    boolean not null default false,   -- xoá mềm để máy khác biết mà xoá theo
  updated_at bigint  not null,                 -- thời điểm sửa trên máy (ms) – bản mới hơn thắng
  synced_at  timestamptz not null default clock_timestamp(), -- thời điểm server nhận – dùng để kéo thay đổi
  primary key (user_id, key)
);

create index if not exists words_user_synced_idx on public.words (user_id, synced_at);

-- Mỗi tài khoản chỉ thấy và sửa được từ của chính mình
alter table public.words enable row level security;

drop policy if exists "words: own rows" on public.words;
create policy "words: own rows" on public.words
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Đẩy nhiều thay đổi một lần; chỉ ghi đè khi bản gửi lên mới hơn bản đang có.
create or replace function public.push_words(items jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.words (user_id, key, data, deleted, updated_at, synced_at)
  select auth.uid(),
         i ->> 'key',
         i -> 'data',
         coalesce((i ->> 'deleted')::boolean, false),
         (i ->> 'updated_at')::bigint,
         clock_timestamp()
  from jsonb_array_elements(items) as i
  on conflict (user_id, key) do update
    set data       = excluded.data,
        deleted    = excluded.deleted,
        updated_at = excluded.updated_at,
        synced_at  = clock_timestamp()
    where public.words.updated_at < excluded.updated_at;
$$;

revoke execute on function public.push_words(jsonb) from public, anon;
grant execute on function public.push_words(jsonb) to authenticated;
