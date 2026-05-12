-- ================================================================
-- TIPOVAČKA O PLZNIČKU — Supabase databázové schéma
-- Spusť celý tento soubor v Supabase SQL Editoru
-- ================================================================

-- Sezóny (ročníky MS)
create table seasons (
  id serial primary key,
  year integer not null unique,
  name text not null default 'MS Hokej',
  created_at timestamptz default now()
);

-- Členové rodiny
create table members (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  name text not null,
  photo_url text,
  created_at timestamptz default now(),
  unique(season_id, name)
);

-- Zápasy
create table matches (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  opponent text not null,
  match_date date not null,
  match_time text default '16:20',
  phase text default 'Skupina',
  status text default 'upcoming', -- 'upcoming' | 'finished'
  result_home integer,
  result_away integer,
  created_at timestamptz default now()
);

-- Tipy (jeden tip na člena na zápas, výsledek musí být unikátní v rámci zápasu)
create table tips (
  id serial primary key,
  match_id integer references matches(id) on delete cascade,
  member_name text not null,
  home_score integer not null,
  away_score integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(match_id, member_name),
  unique(match_id, home_score, away_score)  -- unikátní výsledek v zápase
);

-- Nastavení aplikace (1 řádek)
create table app_settings (
  id integer primary key default 1,
  app_name text default 'Tipovačka o Plzničku',
  wa_group_name text default 'Hokej rodina 🏒',
  admin_password text default 'hokej',
  api_key text default '',
  active_season_id integer references seasons(id),
  constraint single_row check (id = 1)
);

-- Vložit výchozí nastavení
insert into app_settings (id, app_name) values (1, 'Tipovačka o Plzničku')
  on conflict (id) do nothing;

-- Vložit první sezónu 2026
insert into seasons (year, name) values (2026, 'MS Hokej 2026')
  on conflict (year) do nothing;

-- Aktualizovat active_season_id
update app_settings set active_season_id = (select id from seasons where year = 2026) where id = 1;

-- ================================================================
-- Row Level Security — VYPNUTO pro jednoduchost (rodinná appka)
-- Pokud chceš více bezpečnosti, zapni RLS a přidej politiky
-- ================================================================
alter table seasons enable row level security;
alter table members enable row level security;
alter table matches enable row level security;
alter table tips enable row level security;
alter table app_settings enable row level security;

-- Povolit vše pro anon (veřejný přístup — OK pro rodinnou appku)
create policy "allow all seasons" on seasons for all using (true) with check (true);
create policy "allow all members" on members for all using (true) with check (true);
create policy "allow all matches" on matches for all using (true) with check (true);
create policy "allow all tips" on tips for all using (true) with check (true);
create policy "allow all settings" on app_settings for all using (true) with check (true);
