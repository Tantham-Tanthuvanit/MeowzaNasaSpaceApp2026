-- Hardening for the public publishable key (follows publishable_key_access).
-- Anyone can sign in anonymously and call the Data API directly, so the database itself has to
-- stop: overwriting the shared cache, vote stuffing, oversized rows and row floods.

-- 1. The cache is write-once ----------------------------------------------------
-- Existing cached pictures, cutout rows and results can no longer be replaced through the public
-- key (someone could swap in other pictures for everyone). The backend inserts and ignores
-- duplicates. sky_positions keeps updates for its download status only.

drop policy "sky_cutouts: signed-in users update" on public.sky_cutouts;
drop policy "sky_results: signed-in users update" on public.sky_results;
revoke update on public.sky_cutouts, public.sky_results, public.sky_positions from authenticated;
grant update (status, error, updated_at) on public.sky_positions to authenticated;

drop policy "sky-cutouts: signed-in users replace" on storage.objects;

-- 2. One vote per signed-in user per flag ------------------------------------------
-- The backend now uses the signed-in user's id as voter_id, so the existing unique index on
-- (candidate_id, voter_id) means one vote per user. Votes from before have no owner and stay.

alter table public.candidate_votes
  add constraint candidate_votes_voter_is_owner check (owner_id is null or voter_id = owner_id::text);

-- 3. Size limits (today's largest: notes 33 chars, payload 48 KB, image list 396 KB) ----------

alter table public.candidates add constraint candidates_text_sizes check (
  length(notes) <= 2000 and length(observer_callsign) <= 100 and length(epoch_label) <= 300
  and length(ra_hms) <= 40 and length(dec_dms) <= 40 and length(band_group) <= 60);
alter table public.candidate_votes add constraint candidate_votes_text_sizes check (
  length(comment) <= 1000 and length(voter_callsign) <= 100 and length(vote_type) <= 30);
alter table public.projects add constraint projects_text_sizes check (
  length(description) <= 2000 and length(color) <= 30 and cardinality(bands) <= 12);
alter table public.sky_positions add constraint sky_positions_sizes check (
  length(position_key) <= 100 and length(images::text) <= 2000000 and length(coalesce(error, '')) <= 1000);
alter table public.sky_cutouts add constraint sky_cutouts_sizes check (
  length(irsa_uri) <= 500 and length(storage_path) <= 300 and length(coalesce(processing_version, '')) <= 50);
alter table public.sky_results add constraint sky_results_sizes check (
  length(result_key) <= 100 and length(payload::text) <= 1000000);

-- 4. Real timestamps and a daily cap per user (today's busiest day: 7 projects, 3 flags) -------
-- created_at is set by the server, so it can't be faked to dodge the cap.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.stamp_and_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  daily_cap int := tg_argv[0]::int;
  recent int;
begin
  new.created_at := now();
  if new.owner_id is not null and daily_cap > 0 then
    execute format('select count(*) from %I.%I where owner_id = $1 and created_at > now() - interval ''1 day''',
                   tg_table_schema, tg_table_name)
      into recent using new.owner_id;
    if recent >= daily_cap then
      raise exception 'Daily limit reached: at most % new rows a day in %', daily_cap, tg_table_name
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.stamp_and_cap() to authenticated;

create trigger candidates_stamp_and_cap before insert on public.candidates
  for each row execute function private.stamp_and_cap('50');
create trigger projects_stamp_and_cap before insert on public.projects
  for each row execute function private.stamp_and_cap('50');
create trigger candidate_votes_stamp before insert on public.candidate_votes
  for each row execute function private.stamp_and_cap('0');
