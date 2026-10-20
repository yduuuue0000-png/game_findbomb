-- 지뢰찾기 DB 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- 로그인이 없으므로 anon(비로그인) 사용자가 "조회"와 "추가"만 할 수 있고, 수정/삭제는 불가능합니다.

-- ───────── 게임 점수 ─────────
create table if not exists public.scores (
  id             uuid primary key default gen_random_uuid(),
  nickname       text        not null check (char_length(nickname) between 1 and 20),
  difficulty     text        not null check (difficulty in ('easy', 'medium', 'hard')),
  won            boolean     not null,
  time_seconds   integer     not null check (time_seconds between 0 and 999),
  revealed_cells integer     not null check (revealed_cells >= 0),
  score          integer     not null check (score >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists scores_rank_idx
  on public.scores (difficulty, score desc, time_seconds asc);

alter table public.scores enable row level security;

drop policy if exists "scores are readable by everyone" on public.scores;
create policy "scores are readable by everyone"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.scores to anon, authenticated;

-- ───────── 게임 리뷰 ─────────
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  nickname   text        not null check (char_length(nickname) between 1 and 20),
  rating     smallint    not null check (rating between 1 and 5),
  content    text        not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists reviews_created_idx
  on public.reviews (created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "reviews are readable by everyone" on public.reviews;
create policy "reviews are readable by everyone"
  on public.reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can write a review" on public.reviews;
create policy "anyone can write a review"
  on public.reviews for insert
  to anon, authenticated
  with check (true);

grant select, insert on public.reviews to anon, authenticated;
