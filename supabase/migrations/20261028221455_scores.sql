create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games (id),
  name       text not null check (char_length(name) between 1 and 10),
  score      integer not null check (score between 0 and 1000000),
  user_id    uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);

alter table public.scores enable row level security;

create policy scores_read on public.scores
  for select to anon, authenticated using (true);

create policy scores_insert on public.scores
  for insert to anon, authenticated with check (user_id is null);

grant select, insert on public.scores to anon, authenticated;

create view public.game_stats with (security_invoker = true) as
  select game_id, count(*)::int as plays, max(score) as best
  from public.scores
  group by game_id;

grant select on public.game_stats to anon, authenticated;

create function public.top_scores(p_game_id text default null, p_limit int default 10)
returns table (game_id text, rank int, name text, score int, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.game_id, r.rank, r.name, r.score, r.created_at
  from (
    select s.game_id,
           (row_number() over (
             partition by s.game_id
             order by s.score desc, s.created_at asc
           ))::int as rank,
           s.name, s.score, s.created_at
    from public.scores s
    where p_game_id is null or s.game_id = p_game_id
  ) r
  where r.rank <= p_limit
  order by r.game_id, r.rank;
$$;

grant execute on function public.top_scores(text, int) to anon, authenticated;
