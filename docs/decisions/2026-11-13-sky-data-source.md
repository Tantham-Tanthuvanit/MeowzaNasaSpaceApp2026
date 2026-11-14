# Decision: which real sky data the viewer is built on (SPHEREx, WISE, or both)

**Date**: 2026-11-13
**Status**: Proposed. Needs a team decision before merging into `master`.
**Branches involved**: `supabase-real-spherex` (Wut), `real-data-test` (Alpha), `master`

## Why this needs deciding

Two different "use real data" efforts landed on the same day:

| Branch | Approach |
|---|---|
| `supabase-real-spherex` | **SPHEREx** spectral images (DR1/QR3) from IRSA, one flipbook frame per survey visit, cached in Supabase. All presets, seeds and simulated fallbacks removed. |
| `real-data-test` | **WISE** W1–W4 cutouts from IRSA FinderChart, 16 FITS files committed for preset targets. Keeps presets and falls back to the simulator when IRSA is slow (4.5 s timeout). |

They rewrite the same file (`backend/data_loader.py`) in incompatible ways, so we have to pick a direction.

## SPHEREx vs WISE

| | SPHEREx | WISE |
|---|---|---|
| Launched / observing | March 2025, still observing | Dec 2009. Full 4-band survey in 2010; 2 bands (NEOWISE) until 2024 |
| Wavelengths | 0.75–5 µm (near-infrared) | 3.4, 4.6, 12, 22 µm (W1–W4) |
| Colours | **102** narrow channels, so each spot gets a spectrum | **4** broad bands |
| Sharpness | 6.2″ pixels | 2.75″ pixels (~6″ resolution in W1) |
| Time coverage | Whole sky every ~6 months; ~1.5 years so far | ~14 years in W1/W2 |
| Best at | Composition: water ice, methane, CO₂, cold brown-dwarf spectra | Finding motion and very red objects (brown dwarfs, asteroids) |

What that means for us:
- **SPHEREx** gives real *time* steps. For WISE 0855: 258 images in 4 visits (May 2025, Oct/Nov 2025, Dec 2025, Apr/May 2026). It also gives a real 102-band spectrum. Its weakness is coarse pixels: WISE 0855 moves only about 1 SPHEREx pixel a year, so motion is subtle.
- **WISE** is sharper and spans 10+ years, so nearby brown dwarfs move many pixels. That's why Backyard Worlds' WiseView (named in the challenge resources as "a model or inspiration") uses it.
- The challenge is **"Planet X and SPHEREx"**, so SPHEREx should be the core data.

## Issues found in `real-data-test` (to fix whichever way we go)

1. **Colour bands are shown as dates.** For `stacked`, the flipbook plays W1, W2, W3, W4 as four "epochs" with hard-coded dates `2010-01-14`, `2010-03-22`, `2010-05-18`, `2010-07-09` (`backend/data_loader.py`, around line 588). These are four wavelengths of one coadded image, not four observation times, so any "motion" between frames is not real, and the dates are invented. The W2 − W1 "difference image" is a real *colour* test (red = brown-dwarf-like), not a motion test.
2. **Simulated fallback is still there.** When the live query takes longer than 4.5 s (common: IRSA cutouts take 7–15 s), the user silently gets synthetic data.
3. **16 FITS files (~1.1 MB each) are committed** in `backend/data/cache/irsa/`, and only for preset targets.
4. **Presets are still required** for the cached path.

## Options

### A. SPHEREx only (`supabase-real-spherex`)
- Real time series and a real 102-band spectrum, from the challenge's own mission.
- No fake data anywhere. Errors are shown instead of invented data.
- First look at a new spot takes ~1 min (flipbook) or ~15 min (full spectrum), then it's instant from the Supabase cache.
- Motion is subtle at 6.2″ pixels.

### B. WISE only (`real-data-test`)
- Sharper images; long time span available.
- Needs a rework before it shows real motion: it would have to use multi-epoch unWISE/NEOWISE data, not the 4 FinderChart bands.
- Not the challenge's mission, and keeps the simulator fallback.

### C. Both: SPHEREx as the core, WISE as a comparison (recommended)
- Keep `supabase-real-spherex` as the base: SPHEREx flipbook, spectrum and filters.
- Add WISE as an extra layer: "this spot in 2010 (WISE W1/W2) vs 2025–26 (SPHEREx)". A 15-year baseline makes nearby brown dwarfs jump clearly. That's a strong, honest demo of motion.
- Show W2 − W1 as a **colour** check ("is this object very red?"), labelled as colour, not time.
- Fetch WISE through the same cache (Supabase), not committed FITS files, and drop the simulator fallback.

## Recommendation

**Option C.** Merge `skyflip-ui` → `supabase-real-spherex` first, then port the useful parts of `real-data-test` (WISE fetching, W2 − W1 colour check) on top, labelled correctly. Also keep `master`'s anti-spam voting (`fixing_spam_likes`), ported to the Supabase tables.

## Open questions for the team

1. Agree on Option C, or prefer A or B?
2. Who ports the anti-spam voting from `master` (SQLite) to Supabase (`candidate_votes`)?
3. Should WISE frames use NEOWISE multi-epoch data (real motion over ~10 years), or only the 2010 AllWISE images as one "then" frame?
4. Which UI do we keep: SkyFlip (`skyflip-ui`), or the dashboard on `master` with drag-to-pan? SkyFlip doesn't show the spectrum, filters or difference image yet.

## Merge notes

- `skyflip-ui` and `supabase-real-spherex` branch off `master` at `3d213da4`. `master` has since moved 8 commits ahead (SQLite DB, anti-spam votes, drag-to-pan, FOV changes).
- Expected conflicts: `backend/data_loader.py`, `backend/main.py`, `backend/database.py`, `backend/coordinates.py`, `backend/flask_app.py` (deleted on our branch), and most of `frontend/src` (SkyFlip replaced the dashboard).
- Secrets: `backend/.env` (Supabase secret key) is git-ignored; copy `backend/.env.example`.

Sources: [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html), [IRSA SPHEREx tutorials](https://caltech-ipac.github.io/irsa-tutorials/spherex/), [WiseView](http://byw.tools/wiseview), [Space Apps challenge resources](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=resources).
