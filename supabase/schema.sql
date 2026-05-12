-- ============================================================
-- TIPOVAČKA O PLZNIČKU — Supabase databázové schéma
-- Zkopíruj celý tento text a vlož do Supabase → SQL Editor → Run
-- ============================================================

-- Tabulka sezón (ročníků)
create table if not exists seasons (
  id serial primary key,
  year integer unique not null,
  app_name text default 'Tipovačka o Plzničku',
  wa_group text default 'Hokej rodina 🏒',
  admin_password text default 'hokej',
  api_key text default '',
  created_at timestamptz default now()
);

-- Tabulka hráčů
create table if not exists members (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  name text not null,
  photo_url text,
  created_at timestamptz default now(),
  unique(season_id, name)
);

-- Tabulka zápasů
create table if not exists matches (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  opponent text not null,
  match_date date,
  match_time text default '16:20',
  phase text default 'Skupina',
  status text default 'upcoming',
  result_home integer,
  result_away integer,
  created_at timestamptz default now()
);

-- Tabulka tipů
create table if not exists tips (
  id serial primary key,
  match_id integer references matches(id) on delete cascade,
  member_name text not null,
  home integer,
  away integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(match_id, member_name)
);

-- Povolit přístup bez přihlášení (Row Level Security - pro jednoduchost)
alter table seasons enable row level security;
alter table members enable row level security;
alter table matches enable row level security;
alter table tips enable row level security;

create policy "public read seasons" on seasons for select using (true);
create policy "public write seasons" on seasons for all using (true);
create policy "public read members" on members for select using (true);
create policy "public write members" on members for all using (true);
create policy "public read matches" on matches for select using (true);
create policy "public write matches" on matches for all using (true);
create policy "public read tips" on tips for select using (true);
create policy "public write tips" on tips for all using (true);

-- Vložit výchozí sezónu 2026
insert into seasons (year, app_name) values (2026, 'Tipovačka o Plzničku')
on conflict (year) do nothing;

-- Vložit výchozí hráče pro 2026
insert into members (season_id, name)
select id, unnest(array['Táta','Máma','Petr','Jana','Tomáš','Lucie'])
from seasons where year = 2026
on conflict (season_id, name) do nothing;
