-- Initial schema for the SPHEREx Sky Viewer backend.
-- The FastAPI backend is the only client: it uses the secret key (service_role),
-- which bypasses RLS. RLS is on with no policies and anon/authenticated get no
-- privileges, so nothing here is reachable with a publishable key.

-- Citizen-science candidates and their community votes ---------------------

create table public.candidates (
  id bigint generated always as identity primary key,
  ra_deg double precision not null check (ra_deg >= 0 and ra_deg < 360),
  dec_deg double precision not null check (dec_deg between -90 and 90),
  ra_hms text not null default '',
  dec_dms text not null default '',
  pixel_x real,
  pixel_y real,
  category text not null check (category in ('planet_x', 'brown_dwarf', 'variable_star', 'asteroid')),
  confidence smallint not null default 4 check (confidence between 1 and 5),
  notes text not null default '',
  observer_callsign text not null default 'Citizen Scientist',
  band_group text not null default 'stacked',
  epoch_label text not null default '',
  created_at timestamptz not null default now()
);
create index candidates_category_idx on public.candidates (category);

create table public.candidate_votes (
  id bigint generated always as identity primary key,
  candidate_id bigint not null references public.candidates (id) on delete cascade,
  vote_type text not null default 'corroborate',
  voter_callsign text not null default 'Citizen Scientist',
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index candidate_votes_candidate_id_idx on public.candidate_votes (candidate_id);

-- Saved sky projects (shared; there is no login yet) ------------------------

create table public.projects (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 200),
  description text not null default '',
  color text not null,
  ra_deg double precision not null check (ra_deg >= 0 and ra_deg < 360),
  dec_deg double precision not null check (dec_deg between -90 and 90),
  bands smallint[] not null default '{1,2,3,4,5,6}',
  created_at timestamptz not null default now()
);

-- Cache of real SPHEREx data from NASA/IPAC IRSA ----------------------------

-- One row per sky position: the list of IRSA images that cover it and the
-- state of the background download.
create table public.sky_positions (
  position_key text primary key,
  ra_deg double precision not null,
  dec_deg double precision not null,
  fov_arcmin real not null,
  images jsonb not null default '[]'::jsonb,
  total_images integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'downloading', 'done', 'error')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per downloaded cutout. The pixels (reprojected onto the position's
-- common grid) live in the private storage bucket at storage_path.
create table public.sky_cutouts (
  position_key text not null references public.sky_positions (position_key) on delete cascade,
  irsa_uri text not null,
  processing_version text,
  detector smallint not null check (detector between 1 and 6),
  obs_mjd double precision not null,
  wavelength_um real,
  center_flux real,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (position_key, irsa_uri)
);

-- Finished API responses, so repeat requests skip all work.
create table public.sky_results (
  result_key text primary key,
  position_key text not null references public.sky_positions (position_key) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index sky_results_position_key_idx on public.sky_results (position_key);

-- Lock everything down to the backend -----------------------------------------

alter table public.candidates enable row level security;
alter table public.candidate_votes enable row level security;
alter table public.projects enable row level security;
alter table public.sky_positions enable row level security;
alter table public.sky_cutouts enable row level security;
alter table public.sky_results enable row level security;

revoke all on public.candidates, public.candidate_votes, public.projects,
  public.sky_positions, public.sky_cutouts, public.sky_results
  from anon, authenticated;

-- Private bucket for cutout pixels and rendered frames.
insert into storage.buckets (id, name, public)
values ('sky-cutouts', 'sky-cutouts', false)
on conflict (id) do nothing;
