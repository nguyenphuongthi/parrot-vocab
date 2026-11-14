-- Languages – toàn bộ CSDL trên Supabase (extension Vocab English Lens và web app dùng chung một project).
-- Chạy cả file trong Supabase Dashboard → SQL Editor. Chạy lại nhiều lần cũng không sao (không mất dữ liệu),
-- nên khi file này được cập nhật thì chỉ cần chạy lại toàn bộ.
--
-- public.words – kho từ tiếng Anh (extension lưu, app đọc/ghi). key = từ viết thường, vd. "take off";
--                data = toàn bộ dữ liệu của từ (nghĩa, phiên âm, ngữ cảnh, mức thuộc, lịch ôn…).
-- public.items – tiến độ các mục học có sẵn trong app, key = "<ngôn ngữ>:<id>":
--                "zh:1-爱" (từ HSK 1) · "zh:g4-1-2" (ngữ pháp HSK 4, bài 1, điểm 2)
--                "ko:w:학교" (từ vựng) · "ko:p:감사합니다" (câu giao tiếp) · "ko:g:ieyo" (ngữ pháp TOPIK)
--                "en:g:present-simple" (ngữ pháp tiếng Anh)
--                data = { mark, srs, markLog, reviewLog, addedAt, updatedAt }. Nội dung bài học nằm trong app.
-- Cả hai bảng đồng bộ cùng một cách: xoá mềm (deleted), bản sửa mới hơn (updated_at) thắng,
-- máy khác kéo thay đổi theo synced_at.

-- ---------- words ----------

create table if not exists public.words (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  key        text    not null,
  data       jsonb,
  deleted    boolean not null default false,                      -- xoá mềm để máy khác biết mà xoá theo
  updated_at bigint  not null,                                    -- thời điểm sửa trên máy (ms) – bản mới hơn thắng
  synced_at  timestamptz not null default clock_timestamp(),      -- thời điểm server nhận – dùng để kéo thay đổi
  primary key (user_id, key)
);

create index if not exists words_user_synced_idx on public.words (user_id, synced_at);

-- Mỗi tài khoản chỉ thấy và sửa được dữ liệu của chính mình
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

-- ---------- items ----------

create table if not exists public.items (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  key        text    not null,
  lang       text    generated always as (split_part(key, ':', 1)) stored,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint  not null,
  synced_at  timestamptz not null default clock_timestamp(),
  primary key (user_id, key)
);

-- Ràng buộc khoá: đặt lại mỗi lần chạy để thêm được ngôn ngữ mới (bản đầu chỉ cho phép zh, ko).
alter table public.items drop constraint if exists items_key_check;
alter table public.items add constraint items_key_check check (key ~ '^(en|zh|ko):' and char_length(key) <= 200);

create index if not exists items_user_synced_idx on public.items (user_id, synced_at);

alter table public.items enable row level security;

drop policy if exists "items: own rows" on public.items;
create policy "items: own rows" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.push_items(items jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.items (user_id, key, data, deleted, updated_at, synced_at)
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
    where public.items.updated_at < excluded.updated_at;
$$;

revoke execute on function public.push_items(jsonb) from public, anon;
grant execute on function public.push_items(jsonb) to authenticated;
