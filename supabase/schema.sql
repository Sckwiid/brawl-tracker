create extension if not exists pgcrypto;

create table if not exists public.players (
  tag text primary key,
  name text not null,
  trophies integer not null default 0,
  highest_trophies integer not null default 0,
  exp_level integer,
  victories_3v3 integer not null default 0,
  solo_victories integer not null default 0,
  duo_victories integer not null default 0,
  club_tag text,
  club_name text,
  icon_id integer,
  estimated_playtime_minutes numeric(10,2) not null default 0,
  last_battlelog_winrate numeric(5,2) not null default 0,
  last_snapshot_hash text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.history (
  id bigserial primary key,
  player_tag text not null references public.players(tag) on delete cascade,
  snapshot_date date not null default (now() at time zone 'utc')::date,
  trophies integer not null,
  highest_trophies integer not null,
  club_tag text,
  club_name text,
  estimated_playtime_minutes numeric(10,2) not null default 0,
  winrate_25 numeric(5,2) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (player_tag, snapshot_date)
);

create table if not exists public.pro_players (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null unique references public.players(tag) on delete cascade,
  display_name text not null,
  team text not null,
  mercato_status text not null default 'signed',
  matcherino_url text,
  matcherino_earnings_usd numeric(12,2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_tierlist (
  id bigserial primary key,
  brawler_name text not null,
  tier text not null check (tier in ('S', 'A', 'B', 'C')),
  mode text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_snapshots (
  id bigserial primary key,
  type text not null check (type in ('world', 'ranked', 'esport')),
  player_tag text not null,
  last_position integer not null,
  last_value numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, player_tag)
);

create table if not exists public.player_analytics_snapshots (
  id bigserial primary key,
  player_tag text not null references public.players(tag) on delete cascade,
  snapshot_date date not null default (now() at time zone 'utc')::date,
  ranked_winrate_25 numeric(5,2) not null default 0,
  trophy_winrate_25 numeric(5,2) not null default 0,
  ranked_matches_sample integer not null default 0,
  trophy_matches_sample integer not null default 0,
  maps_ranked jsonb not null default '[]'::jsonb,
  maps_trophies jsonb not null default '[]'::jsonb,
  top_brawlers_ranked jsonb not null default '[]'::jsonb,
  top_brawlers_trophies jsonb not null default '[]'::jsonb,
  ranked_bans jsonb not null default '[]'::jsonb,
  battlelog_sample jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_tag, snapshot_date)
);

create table if not exists public.search_history (
  id bigserial primary key,
  session_id text not null,
  player_tag text not null,
  player_name text,
  searched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_tag)
);

create index if not exists idx_history_player_tag_created_at
  on public.history(player_tag, created_at desc);

create index if not exists idx_players_trophies
  on public.players(trophies desc);

create index if not exists idx_leaderboard_snapshots_type_position
  on public.leaderboard_snapshots(type, last_position);

create index if not exists idx_player_analytics_tag_date
  on public.player_analytics_snapshots(player_tag, snapshot_date desc);

create index if not exists idx_search_history_session_updated
  on public.search_history(session_id, updated_at desc);

alter table public.players enable row level security;
alter table public.history enable row level security;
alter table public.pro_players enable row level security;
alter table public.meta_tierlist enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.player_analytics_snapshots enable row level security;
alter table public.search_history enable row level security;

drop policy if exists "players read all" on public.players;
create policy "players read all"
  on public.players for select
  using (true);

drop policy if exists "history read all" on public.history;
create policy "history read all"
  on public.history for select
  using (true);

drop policy if exists "pro players read all" on public.pro_players;
create policy "pro players read all"
  on public.pro_players for select
  using (true);

drop policy if exists "meta tierlist read all" on public.meta_tierlist;
create policy "meta tierlist read all"
  on public.meta_tierlist for select
  using (true);

drop policy if exists "leaderboard snapshots read all" on public.leaderboard_snapshots;
create policy "leaderboard snapshots read all"
  on public.leaderboard_snapshots for select
  using (true);

drop policy if exists "player analytics read all" on public.player_analytics_snapshots;
create policy "player analytics read all"
  on public.player_analytics_snapshots for select
  using (true);

drop policy if exists "search history read all" on public.search_history;
create policy "search history read all"
  on public.search_history for select
  using (true);
