# SkyFlip (NASA Space Apps 2026, SPHEREx challenge)

A public web tool that shows real SPHEREx pictures of any sky position as a flipbook, so anyone can spot things that move or change. React 18 + Vite + Tailwind frontend (`frontend/`, HashRouter), FastAPI backend (`backend/`), all stored data in the Supabase project MeowZa. `README.md` has the features, file map and table list.

## Before starting work

- Run `git branch --show-current` and `gh pr list`. The work lives on stacked branches that merge in a fixed order, and `master` has diverged from them. Do not resolve merge conflicts with `master` or rebase onto it unless asked: what to keep is a team decision (issues #1 and #4, `docs/decisions/`).
- Read the newest file in `logs/` for what was done last, and `gh issue list` for what is open.

## Rules

- **Real data only.** No presets, mock data, seed rows or made-up fallbacks. When NASA's archive (IRSA) or Supabase fails, show an error or a loading state.
- **Log every code change.** Add `logs/YYYY-MM-DD_HH-MM-SS.md` in the format of `logs/2026-11-14_00-20-00.md` (summary, files, verification), in the same commit.
- **Keep `README.md` and this file up to date.** When a change makes either one wrong or incomplete (a feature, endpoint, file, table, command, rule or test position), fix it in the same commit. Check both before finishing any change.
- **Ask before pushing, opening pull requests, or closing issues.** Close an issue only when its fix reaches `master`.
- **Never print or commit `backend/.env`.** It holds `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; the secret key bypasses row-level security.
- **Leave `frontend/dist/` out of commits.** It is a build output that is still tracked (issue #12), so it shows as modified after every build.
- **There is no login** (issue #6). Do not build UI that assumes accounts, ownership or delete rights without asking. Voting uses a random per-browser id, nothing more.
- **Migrations go to the live database.** There is one Supabase project and no staging copy. Save the SQL in `supabase/migrations/` and check the existing rows first: real flags and votes are in there.
- **Write for the public.** UI text is plain language for people who are not astronomers ("the light here, split into 102 colours", not "SED").
- Delete any test flags, votes or projects you create. Leave rows you did not create.

## Run and test

```bash
./start.sh                                   # backend :8000, frontend :5173
curl -s localhost:8000/api/health            # expect "version":"2.0.0"
cd backend && PYTHONPATH=. ./venv/bin/python -m pytest test_suite.py              # offline
cd backend && LIVE_TESTS=1 PYTHONPATH=. ./venv/bin/python -m pytest test_suite.py # + IRSA and Supabase
cd frontend && npx vitest run && npm run build
```

- `./start.sh` runs the backend **without auto-reload**. After a backend change, ask the user to restart it, then check `/api/health`; an old process on port 8000 has caused wrong test results before.
- Check UI changes in a real browser, not only with unit tests.

## Positions to test with

- **WISE 0855** (RA 133.795129, Dec −7.245147): everything is cached (flipbook, spectrum, filters, catalogue), so it loads in under a second. Use this one.
- **Proxima Centauri** (RA 217.429167, Dec −62.679444): flipbook only.
- A new position takes 1–2 minutes for the flipbook and 15 minutes or more for the spectrum or a filter, because every picture is downloaded from IRSA once. The backend answers 202 with progress meanwhile; `poll()` in `frontend/src/services/api.js` handles it.
- The catalogue lookup ("Mark known stars") takes about 30 seconds every time.

## Out-of-date files

`logs/CHANGELOG.md`, `promps/` and `frontend/FIGMA_PREP_GUIDE.md` describe the first version (simulated data, Flask, presets, a dashboard UI). Do not treat them as the current design.
