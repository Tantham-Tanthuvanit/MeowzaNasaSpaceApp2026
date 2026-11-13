-- One vote per voter per candidate (issue #5).
-- There is no login yet, so voter_id is a random id the browser makes and keeps.
-- Votes cast before this change have no voter; they are kept and each counts as its own voter.

alter table public.candidate_votes add column voter_id text;
update public.candidate_votes set voter_id = 'legacy-' || id where voter_id is null;
alter table public.candidate_votes
  alter column voter_id set not null,
  add constraint candidate_votes_voter_id_check check (length(voter_id) between 1 and 100);

create unique index candidate_votes_one_per_voter_idx on public.candidate_votes (candidate_id, voter_id);
