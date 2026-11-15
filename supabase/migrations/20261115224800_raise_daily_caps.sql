-- Raise the per-user daily cap on new flags and projects from 50 to 300 (see harden_public_access).

drop trigger candidates_stamp_and_cap on public.candidates;
create trigger candidates_stamp_and_cap before insert on public.candidates
  for each row execute function private.stamp_and_cap('300');

drop trigger projects_stamp_and_cap on public.projects;
create trigger projects_stamp_and_cap before insert on public.projects
  for each row execute function private.stamp_and_cap('300');
