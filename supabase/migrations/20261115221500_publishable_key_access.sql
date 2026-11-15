-- Let the app run with the public publishable key (sb_publishable_...) instead of the secret key.
--
-- Anyone who clones the repo can run the backend against this database. Each install signs in
-- as a Supabase anonymous user (no login screen), so every request carries a real auth.uid().
-- Because the key is public, these policies are the only protection: anyone can call the Data
-- API directly with the same rights.
--
-- - candidates, candidate_votes, projects: everyone signed in can read; you can add rows,
--   and only change or delete the rows you added (owner_id = auth.uid()).
--   Rows from before this migration have no owner, so through the public key they are read-only.
-- - sky_positions, sky_cutouts, sky_results and the sky-cutouts bucket are a shared cache that
--   every install fills, so signed-in users can read, insert and update them, never delete.
-- - The anon role (no sign-in) still gets nothing. The secret key still bypasses all of this.

-- Owners ----------------------------------------------------------------------

alter table public.candidates
  add column owner_id uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.candidate_votes
  add column owner_id uuid default auth.uid() references auth.users (id) on delete set null;
alter table public.projects
  add column owner_id uuid default auth.uid() references auth.users (id) on delete set null;

create index candidates_owner_id_idx on public.candidates (owner_id);
create index candidate_votes_owner_id_idx on public.candidate_votes (owner_id);
create index projects_owner_id_idx on public.projects (owner_id);

-- Table privileges (RLS below decides which rows) -----------------------------

grant select, insert, delete on public.candidates to authenticated;
grant select, insert, delete on public.candidate_votes to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update on public.sky_positions, public.sky_cutouts, public.sky_results to authenticated;

-- Citizen-science rows: read all, write your own --------------------------------

create policy "candidates: signed-in users read all" on public.candidates
  for select to authenticated using (true);
create policy "candidates: add your own" on public.candidates
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "candidates: delete your own" on public.candidates
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "votes: signed-in users read all" on public.candidate_votes
  for select to authenticated using (true);
create policy "votes: add your own" on public.candidate_votes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "votes: delete your own" on public.candidate_votes
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "projects: signed-in users read all" on public.projects
  for select to authenticated using (true);
create policy "projects: add your own" on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "projects: edit your own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "projects: delete your own" on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Shared cache of IRSA data: every install reads and fills it ------------------

create policy "sky_positions: signed-in users read" on public.sky_positions
  for select to authenticated using (true);
create policy "sky_positions: signed-in users add" on public.sky_positions
  for insert to authenticated with check (true);
create policy "sky_positions: signed-in users update" on public.sky_positions
  for update to authenticated using (true) with check (true);

create policy "sky_cutouts: signed-in users read" on public.sky_cutouts
  for select to authenticated using (true);
create policy "sky_cutouts: signed-in users add" on public.sky_cutouts
  for insert to authenticated with check (true);
create policy "sky_cutouts: signed-in users update" on public.sky_cutouts
  for update to authenticated using (true) with check (true);

create policy "sky_results: signed-in users read" on public.sky_results
  for select to authenticated using (true);
create policy "sky_results: signed-in users add" on public.sky_results
  for insert to authenticated with check (true);
create policy "sky_results: signed-in users update" on public.sky_results
  for update to authenticated using (true) with check (true);

-- Storage: the private sky-cutouts bucket -------------------------------------
-- Upload with upsert needs select + insert + update. Signed URLs and downloads need select.
-- Files today are at most ~350 KB (.npy cutouts and PNG frames), so cap uploads at 5 MB and
-- allow only those two types.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/octet-stream', 'image/png']
where id = 'sky-cutouts';

create policy "sky-cutouts: signed-in users read" on storage.objects
  for select to authenticated using (bucket_id = 'sky-cutouts');
create policy "sky-cutouts: signed-in users upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'sky-cutouts');
create policy "sky-cutouts: signed-in users replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'sky-cutouts')
  with check (bucket_id = 'sky-cutouts');
