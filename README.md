# NASA SPHEREx Sky Viewer — Multi-Epoch Infrared Transient Discovery Tool

A public-facing web platform built for the **NASA Space Apps Challenge** to explore and discover moving celestial objects (brown dwarfs, asteroids, comets, high proper-motion stars) and variable stars using multi-epoch observations from NASA's **SPHEREx** mission (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer).

---

## 🌟 Key Features Implemented

1. **Real SPHEREx Pictures, One per Survey Visit**
   - For any RA/Dec, the backend asks the NASA/IPAC Infrared Science Archive (IRSA) which SPHEREx DR1/QR3 spectral images cover it, then downloads cutouts in the background.
   - Images are grouped into survey visits (for WISE 0855: May 2025, Oct/Nov 2025, Dec 2025, Apr/May 2026). Each flipbook frame is one visit.
   - Every cutout has the zodiacal light model subtracted and is reprojected onto one north-up grid, so frames line up when blinked.
   - **Band groups**: `stacked` (all 6 detectors), `array_1`..`array_6`, `false_color_rgb`, plus narrow-band filters and indices (`filter_ch4_deep`, `ratio_ch4`, ...) built from the images whose wavelength at that spot matches. See `/api/bands`.

2. **Caching in Supabase (download once)**
   - A cutout takes about 10–15 s to download from IRSA. Each is downloaded once (4 at a time, as a courtesy to IRSA), then stored in Supabase Storage with a row in `sky_cutouts`. Finished responses are stored in `sky_results`.
   - While images download, `/api/sky-cutout` and `/api/spectrum` answer **202** with `{cached_images, total_images}`. The viewer shows "N of M pictures are here" with one slot per picture, and polls.
   - The viewer opens a spot in one band (Band 1, `array_1`), which needs one picture per visit (up to 4) and is ready in under a minute. "All bands combined" (`stacked`, `?band=all`) needs up to 24 and takes a few minutes the first time. The full 102-channel spectrum (about 260 images) takes about 10–15 minutes the first time. Later requests are instant.

3. **Difference Imaging and Shift-and-Add**
   - The difference image (user-selectable visits, e.g. visit $B$ − visit $A$) uses a bipolar colormap, so moving objects show a dipole. All visit pairs are pre-computed and selectable via dropdowns and quick presets.
   - `/api/shift-and-add` co-adds the real visits along a trial motion, to bring out faint moving objects.

4. **102-Channel Spectrum**
   - `/api/spectrum` bins the centre-pixel brightness of every SPHEREx image of a spot into the 102 SPHEREx channels. Channel wavelengths come from IRSA's DR1 all-sky cube. This is a quick-look spectrum, not calibrated photometry.

5. **Gaia DR3 and AllWISE Overlay**
   - `/api/catalog-overlay` queries Gaia DR3 and AllWISE through IRSA's TAP service. An AllWISE source with W1−W2 ≥ 1 and no Gaia star within 3″ is flagged as a brown dwarf candidate (WISE 0855 is).
   - If IRSA can't be reached the API returns an error; there is no made-up fallback.

6. **Saved Projects and Citizen-Science Candidates**
   - The Home sky map shows the real SPHEREx sky: the browser loads IRSA's "SPHEREx DR1 all-sky data cube" picture tiles (first layer, 0.75 µm) straight from `irsa.ipac.caltech.edu` and draws them under the grid and markers. The map zooms to 20,000%, loading sharper tiles and drawing finer grid lines as it goes. The tiles run out of detail at 5,000% (about 13 arcseconds per pixel); past that the same pixels are magnified. If IRSA does not answer, the map shows an error with "Try again" and no drawn stand-in.
   - Projects (the markers on the Home sky map) can be found with the "Find a project" search above the map (by name or description; picking one centres the map on it and opens its card). A "Random patch" button drops a pin on a randomly chosen celestial position so anyone can explore uncharted sky. A new project is started by clicking a spot on the map (or choosing a random patch) and saving the pin. Projects, candidates and votes are stored in Supabase and shared by everyone (there is no login yet). Each browser can vote once per candidate and can take the vote back (`vote_type: "unvote"`). The MPC-style export is at `/api/candidates/export-mpc`.

   - In the viewer, "Flag something here" marks a point on the picture and saves it as a candidate; "I see it too" votes for one.

7. **All of It in the Viewer**
   - The viewer page shows every feature above: the flipbook, a side-by-side **Split view** (comparing any two survey visits with quick swapping), a customizable **"What changed" view** (difference image subtracting any reference visit from any comparison visit with a bullet-point visual guide), a "Combined" view (shift-and-add with two drift sliders), a user-adjustable Field of View (FOV) selector (presets 3′, 5′, 8′, 12′, 15′ and smooth slider 1.0′–30.0′), a "More kinds of light…" list (filters and indices), a "Mark known stars" switch (Gaia and AllWISE marks), the spectrum chart, the flags panel, and a "Random patch" button to quickly explore new sky coordinates.

8. **Newcomer Tutorial & Field Guide (`How to use`)**
   - First-time visitors automatically see an interactive 3-tab quick-start guide (`1. What is SkyFlip?`, `2. How to Hunt (4 Steps)`, `3. Field Guide & Shortcuts`) explaining SPHEREx infrared bands, how to spot blue+red moving dipoles vs. variable stars in "What changed", keyboard shortcuts (`Space`, `←` / `→`), and citizen-science flagging.
   - Accessible anytime via **How to use** in the header or **New here? How to use SkyFlip** on the Sky Map page.

9. **Guided Demo Mode (5-Step Interactive Walkthrough)**
   - Clicking **Guided demo** in the header (or **Start guided demo (WISE 0855)** in the viewer) launches an interactive 5-step tour on the cached WISE 0855 brown dwarf target (`RA 08h55m10.831s, Dec -07°14′42.53″`).
   - Steps automatically walk through: (1) Infrared Flipbook in Band 6 (`4.42 µm`), (2) Side-by-Side Split View (`V1` vs `V4`), (3) Difference Imaging ("What changed" dipole signature), (4) Shift-and-Add Co-addition ("Combined"), and (5) Gaia/AllWISE Catalogue Overlay + SPHEREx 102-channel Spectrum.

10. **Query Sky Patches via URL**
   - `http://localhost:5173/#/viewer?ra=08h55m10.831s&dec=-07d14m42.53s&fov=10` opens the viewer on that spot. Sexagesimal and decimal degrees both work, and `fov` sets the angular field of view in arcminutes (default 5.0′).

---

## 🏗️ Project Architecture

```
MeowzaNasaSpaceApp2026/
├── backend/
│   ├── main.py                    # FastAPI endpoints
│   ├── data_loader.py             # IRSA queries, background cutout downloads, frames, spectrum
│   ├── catalog_service.py         # Gaia DR3 + AllWISE via IRSA TAP
│   ├── database.py                # Candidates, votes and projects in Supabase
│   ├── supabase_client.py         # The one Supabase client (reads backend/.env)
│   ├── coordinates.py             # Astropy coordinate parsing and pixel <-> RA/Dec
│   ├── image_processor.py         # Contrast stretch, difference imaging, stacking, PNG export
│   ├── test_suite.py              # Backend tests (offline; LIVE_TESTS=1 adds IRSA + Supabase)
│   ├── .env.example               # SUPABASE_URL and SUPABASE_SECRET_KEY
│   └── requirements.txt
├── supabase/migrations/           # Database schema (tables, RLS, storage bucket)
├── frontend/
│   └── src/
│       ├── pages/                 # Home (sky map) and Viewer (flipbook)
│       ├── components/            # SkyMap, SkyCanvas, FlipPlayer, SplitPlayer, DemoTour, TutorialModal, SpectrumChart, Flags, MapCards, ProjectDialog
│       ├── core/                  # Sky projection, sky picture drawing, bands, projects store
│       └── services/              # api.js: backend calls (polls while pictures download); skyTiles.js: the Home map's sky picture from IRSA
├── logs/                          # One entry per code change
├── docs/decisions/                # Open team decisions (SPHEREx vs WISE data)
├── setup.sh, start.sh             # Environment setup and one-command startup (macOS / Linux / Git Bash)
├── setup.bat, start.bat           # Windows Command Prompt / PowerShell setup and startup
├── setup.ps1, start.ps1           # Windows PowerShell setup and startup scripts
├── CLAUDE.md                      # Working rules for AI coding sessions
└── README.md
```

### Supabase

All persistent data lives in the Supabase project **MeowZa**. Only the backend talks to it, with the secret key; every table has RLS enabled and no access for `anon`/`authenticated`.

| Table / bucket | What it holds |
|---|---|
| `candidates`, `candidate_votes` | Citizen-science discoveries and votes |
| `projects` | Saved sky positions |
| `sky_positions` | Per position: the IRSA image list and download status |
| `sky_cutouts` + bucket `sky-cutouts` | Every downloaded cutout (pixels as `.npy`, wavelength, centre flux, IRSA URI, pipeline version) |
| `sky_results` | Finished API responses (rendered PNGs live in the bucket under `results/`) |

---

## 🚀 Quickstart Guide

### 1. One-Time Setup

**macOS / Linux / Windows (Git Bash):**
```bash
./setup.sh
cp backend/.env.example backend/.env
# then put a secret key (sb_secret_...) from Supabase > Project Settings > API Keys into backend/.env
```

**Windows (PowerShell or Command Prompt):**
```powershell
.\setup.bat
copy backend\.env.example backend\.env
# then put a secret key (sb_secret_...) from Supabase > Project Settings > API Keys into backend\.env
```

### 2. Launch Both Backend & Frontend with One Command

**macOS / Linux / Windows (Git Bash):**
```bash
./start.sh
```

**Windows (PowerShell or Command Prompt):**
```powershell
.\start.bat
```
*(If `setup` has not been run yet or the venv was created on a different OS, `start.sh` / `start.bat` will automatically run `setup` first).*

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (FastAPI)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Manual Startup (Separate Terminals)

#### Terminal 1 — Backend:
```bash
cd backend
PYTHONPATH=. ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

---

## 🧪 Running the Verification Test Suites

```bash
# Backend, offline
cd backend && PYTHONPATH=. ./venv/bin/python -m pytest test_suite.py

# Backend, plus live IRSA and Supabase checks
cd backend && LIVE_TESTS=1 PYTHONPATH=. ./venv/bin/python -m pytest test_suite.py

# Frontend unit tests and build
cd frontend && npx vitest run && npm run build
```

---

## 📜 Data Credits

- **SPHEREx**: "This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration." Data from the NASA/IPAC Infrared Science Archive ([terms of use](https://irsa.ipac.caltech.edu/data_use_terms.html): public data, no usage restrictions).
- **Gaia DR3**: ESA/Gaia/DPAC, licensed [CC BY-NC 3.0 IGO](https://www.cosmos.esa.int/web/gaia-users/license) (attribution, non-commercial). Served through IRSA. Gaia results are cached in memory only.
- **AllWISE**: Wide-field Infrared Survey Explorer, a joint project of UCLA and JPL/Caltech, funded by NASA. Served through IRSA.
