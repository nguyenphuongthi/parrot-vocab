-- Languages – bổ sung vào project Supabase đang dùng cho Vocab English Lens.
-- Chạy file này MỘT LẦN trong Supabase Dashboard → SQL Editor (chạy lại nhiều lần cũng không sao).
--
-- KHÔNG đụng tới bảng public.words (tiếng Anh) – extension cũ và app mới cùng đọc/ghi bảng đó.
-- Bảng mới public.items lưu tiến độ học tiếng Trung / tiếng Hàn, cùng cách đồng bộ với words:
--   key  = "<ngôn ngữ>:<id>", vd. "zh:1-爱" (từ HSK 1), "zh:g4-1-2" (ngữ pháp HSK 4, bài 1, điểm 2),
--          "ko:w:학교" (từ vựng tiếng Hàn), "ko:p:감사합니다" (câu giao tiếp)
--   data = { mark, srs, markLog, reviewLog, addedAt, updatedAt }
-- Nội dung bài học (nghĩa, ví dụ…) nằm trong file JSON của app, không lưu ở đây.

create table if not exists public.items (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  key        text    not null check (key ~ '^(zh|ko):' and char_length(key) <= 200),
  lang       text    generated always as (split_part(key, ':', 1)) stored,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint  not null,                                  -- thời điểm sửa trên máy (ms) – bản mới hơn thắng
  synced_at  timestamptz not null default clock_timestamp(),    -- thời điểm server nhận – dùng để kéo thay đổi
  primary key (user_id, key)
);

create index if not exists items_user_synced_idx on public.items (user_id, synced_at);

alter table public.items enable row level security;

drop policy if exists "items: own rows" on public.items;
create policy "items: own rows" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Đẩy nhiều thay đổi một lần; chỉ ghi đè khi bản gửi lên mới hơn bản đang có (giống push_words).
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
