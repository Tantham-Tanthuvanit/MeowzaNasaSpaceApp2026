# NASA SPHEREx Sky Viewer — Multi-Epoch Infrared Transient Discovery Tool

A public-facing web platform built for the **NASA Space Apps Challenge** to explore and discover moving celestial objects (brown dwarfs, asteroids, comets, high proper-motion stars) and variable stars using multi-epoch observations from NASA's **SPHEREx** mission (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer).

---

## 🌟 Key Features Implemented

0. **Welcome Page (`#/`)**
   - The first page a visitor sees tells the story: how comparing pictures over time found Pluto (1930), WISE 0855 (2014) and the brown dwarfs of Backyard Worlds, what SPHEREx sees (102 colours, the whole sky every six months), why team Meowza built SkyFlip for the NASA Space Apps 2026 "Planet X and SPHEREx" challenge, four steps to hunt, and links to the challenge's test targets (from the official projects in Supabase).
   - The hero flips through the real, cached SPHEREx Band 6 pictures of WISE 0855 (pause button; with reduced motion it shows one visit at a time with buttons instead of blinking). If the backend can't be reached it says so and offers "Try again"; there are no stand-in pictures.
   - The page scrolls. The sky map lives at `#/map`; the first-visit tutorial waits until the visitor reaches the map or the viewer.

1. **Real SPHEREx Pictures, One per Survey Visit**
   - For any RA/Dec, the backend asks the NASA/IPAC Infrared Science Archive (IRSA) which SPHEREx DR1/QR3 spectral images cover it, then downloads cutouts in the background.
   - Images are grouped into survey visits (for WISE 0855: May 2025, Oct/Nov 2025, Dec 2025, Apr/May 2026). Each flipbook frame is one visit.
   - Every cutout has the zodiacal light model subtracted and is reprojected onto one north-up grid, so frames line up when blinked.
   - **Band groups**: `stacked` (all 6 detectors), `array_1`..`array_6`, `false_color_rgb`, plus narrow-band filters and indices (`filter_ch4_deep`, `ratio_ch4`, ...) built from the images whose wavelength at that spot matches. See `/api/bands`.

2. **Caching in Supabase (download once)**
   - A cutout takes about 10–15 s (in theory) to download from IRSA. Each is downloaded once (4 at a time, as a courtesy to IRSA), then stored in Supabase Storage with a row in `sky_cutouts`. Finished responses are stored in `sky_results`.
   - While images download, `/api/sky-cutout` and `/api/spectrum` answer **202** with `{cached_images, total_images}`. The viewer shows "N of M pictures are here" with one slot per picture, and polls.
   - The viewer opens a spot in one band (Band 1, `array_1`), which needs one picture per visit (up to 4) and is ready in under a minute. "All bands combined" (`stacked`, `?band=all`) needs up to 24 and takes a few minutes the first time. The full 102-channel spectrum (about 260 images) takes about 10–15 minutes the first time. Later requests are instant.

3. **Difference Imaging and Shift-and-Add**
   - The difference image (user-selectable visits, e.g. visit $B$ − visit $A$) uses a bipolar colormap, so moving objects show a dipole. All visit pairs are pre-computed and selectable via dropdowns and quick presets.
   - `/api/shift-and-add` co-adds the real visits along a trial motion, to bring out faint moving objects.

4. **102-Channel Absorption & Emission Spectra Graph**
   - Positioned directly below the flipbook controls in the viewer.
   - `/api/spectrum` bins the centre-pixel brightness of every SPHEREx image of a spot into the 102 SPHEREx channels (0.75 – 5.00 µm). Channel wavelengths come from IRSA's DR1 all-sky cube.
   - The interactive graph identifies and visualizes key cosmic signatures:
     - **Absorption lines / bands (dips)**: Cooler molecules and ice mantles swallowing background light (H₂O ice at 3.05 µm, CH₄ methane at 1.66 & 3.30 µm, CO₂ ice at 4.27 µm, atmospheric water vapor at 1.40 & 1.90 µm, CO gas at 4.67 µm).
     - **Emission lines (peaks)**: Hot ionized gas, shocks, and dust radiating brightly (Hydrogen Brackett-α at 4.05 µm, Paschen-α at 1.875 µm, Brackett-γ at 2.166 µm, PAH dust at 3.30 & 3.40 µm, shock-excited H₂ at 2.12 µm).
     - **Kirchhoff's Dual Visual Spectra Bars**: An absorption spectrum bar (continuous rainbow infrared gradient with dark absorption slits) and an emission spectrum bar (dark background with bright glowing emission lines).
     - Feature filter controls (`All features`, `Absorption only`, `Emission only`, `Clean plot`), continuum baseline tracking, live hover & keyboard inspector, automated dip/peak detection summary, and benchmark sky patch shortcuts (WISE 0855 brown dwarf, Proxima Centauri).

5. **Gaia DR3 and AllWISE Overlay + Contamination & Observation Metadata**
   - `/api/catalog-overlay` queries Gaia DR3 (`parallax`, `ruwe`) and AllWISE (`cc_flags`, `ext_flg`, `ph_qual`) through IRSA's TAP service. An AllWISE source with W1−W2 ≥ 1 and no Gaia star within 3″ is flagged as a brown dwarf candidate (WISE 0855 is).
   - Contamination flags (`cc_flags` decoding diffraction spikes `D`, persistence `P`, halos `H`, and optical ghosts `O`, plus Gaia `RUWE ≥ 1.4`) are shown per source with a **Hide flagged artifacts** filter toggle in the viewer.
   - Each SPHEREx visit frame in the Flipbook also displays live observation metadata (`Release: DR1/QR3`, `MJD`, `Exposures stacked`, and `Calibration: Zodiacal light removed`).
   - If IRSA can't be reached the API returns an error; there is no made-up fallback.

6. **Saved Projects and Citizen-Science Candidates**
   - The sky map (`#/map`) supports both **Visible light** (default, full-color optical **DSS2 Color** from NASA/STScI via IRSA HiPS tiles) and **Infrared** (**NASA SPHEREx DR1** all-sky data cube first layer at 0.75 µm) via a 1-click **Sky light** toggle (`Visible light` / `Infrared (SPHEREx)`), persisted in `localStorage` (`skyflip_sky_survey`). Progressive HEALPix tiles stream straight from `irsa.ipac.caltech.edu` under the coordinate grid and markers as the user zooms up to 20,000% (native sharp 512×512 tiles through `Norder5`, ~13 arcseconds/pixel at 5,000%), with `"Loading a sharper picture…"` feedback and `"Try again"` error recovery if IRSA is unreachable.
   - Projects (the markers on the sky map) can be found with the "Find a project" search above the map (by name or description; picking one centres the map on it and opens its card). A "Random patch" button drops a pin on a randomly chosen celestial position so anyone can explore uncharted sky. A new project is started by clicking a spot on the map (or choosing a random patch) and saving the pin. Projects, candidates and votes are stored in Supabase and shared by everyone (there is no login yet). Each browser can vote once per candidate and can take the vote back (`vote_type: "unvote"`). The MPC-style export is at `/api/candidates/export-mpc`.
   - **Map Layers & Project Visibility Toggles**: The sky map features an interactive toggle control (`User projects` and `Official targets`) located both in the header search panel and as a floating chip on the map canvas. Users can easily hide or show community/user-created projects independently from official benchmark targets (Barnard's Star, WISE 0855, Epsilon Indi B, RW Aurigae, R Draconis), with live counts and preference persistence in `localStorage` (`skyflip_show_user_projects`). Search results and project detail cards clearly distinguish between official and user-created targets.

   - In the viewer, "Flag something here" marks a point on the picture and saves it as a candidate (recording your browser's `skyflip_voter_id` as the owner without exposing it publicly); "I see it too" votes for one, and flag owners see a **"Your flag"** badge and **"Delete"** action (backed by owner-only `403` enforcement on `DELETE /api/candidates/{id}`).

7. **Monkeytype-Style UI Theme Settings & Palettes**
   - The top navigation bar includes a **Theme Settings modal** (`🎨 Themes`) modeled after Monkeytype's popular theme system, complete with:
     - **Live theme search** and category filter chips (`All`, `Dark`, `Light`).
     - **Five-color palette swatches** (`[Background] [Surface] [Text] [Subtext] [Accent]`) on every theme card for instant visual reference.
     - **Miniature UI previews** inside each card depicting a simulated flipbook layout.
     - **Random Theme shuffle** button (`ShuffleIcon`) to quickly cycle through palettes.
     - **Curated community & astronomical palettes**, including:
       1. **Deep Spruce** (Coolors [#01161e-#124559-#598392-#aec3b0-#eff6e0](https://coolors.co/palette/01161e-124559-598392-aec3b0-eff6e0)) — Rich boreal teal dark mode with ~17:1 text contrast.
       2. **Retro Sunset** (Coolors [#0081a7-#00afb9-#fdfcdc-#fed9b7-#f07167](https://coolors.co/palette/0081a7-00afb9-fdfcdc-fed9b7-f07167)) — Warm cream and coral vintage light mode.
       3. **Ocean Coral** (Coolors #2 Dark Variant) — Deep cerulean dark mode with coral accents.
       4. **Midnight SPHEREx**, **SkyFlip Light**, **Nordic Frost**, **Cyberpunk Neon**, **Solarized Light**, and **Monokai Infrared**.
     - Instant CSS custom property updates (`--color-page`, `--color-surface`, `--color-ink`, `--color-accent`, etc.) with persistence in `localStorage` (`skyflip_theme_id`).
   - A dedicated **Keyboard & Controls** tab inside the modal outlines all flipbook shortcuts (`Space`, `←`/`→`, `1`-`6`, `D`, `S`, `G`, `C`, `Esc`).

8. **All of It in the Viewer (+ RA & Dec Grid and Astronomical Ruler)**
   - The viewer page brings all capabilities together: the flipbook (with release/MJD/exposure metadata and `Space` / `←` / `→` shortcuts), a side-by-side **Split view** (comparing any two survey visits with quick swapping), a customizable **Difference image view** (subtracting any reference visit from any comparison visit with a bullet-point visual guide), a "Combined" view (shift-and-add with two drift sliders), a user-adjustable Field of View (FOV) selector (presets 3′, 5′, 8′, 12′, 15′ and smooth slider 1.0′–30.0′), an interactive **Right Ascension and Declination (RA & Dec) coordinate grid** with edge ticks and astronomical orientation indicator (`N ↑`, `E ←`, shortcut `G`), an interactive **Astronomical Ruler & Measurement Tool** (two-point click/drag measurement computing angular separation in arcseconds/arcminutes/mas, detector pixels, Position Angle East of North, endpoint celestial coordinates, coordinate offsets, and multi-epoch proper motion velocity, shortcut `M`), an on-screen **Corner Scale Bar** dynamically calibrated to FOV, a "More kinds of light…" list (filters and indices), an **Overlay Gaia & WISE stars (Mark known stars)** switch with contamination/quality flag badges and artifact filtering, the absorption & emission spectrum chart, the flags panel, and a "Random patch" button to quickly explore new sky coordinates.

9. **Newcomer Tutorial & Field Guide (`How to use`)**
   - First-time visitors automatically see an interactive 3-tab quick-start guide (`1. What is SkyFlip?`, `2. How to Hunt (4 Steps)`, `3. Field Guide & Shortcuts`) explaining SPHEREx infrared bands, how to spot blue+red moving dipoles vs. variable stars in "Difference image", keyboard shortcuts (`Space`, `←` / `→`, `G`, `C`), and citizen-science flagging.
   - Accessible anytime via **How to use** in the header or **New here? How to use SkyFlip** on the Sky Map page.

10. **Guided Demo Mode (5-Step Interactive Walkthrough)**
   - Clicking **Guided demo** in the header (or **Start guided demo (WISE 0855)** in the viewer) launches an interactive 5-step tour on the cached WISE 0855 brown dwarf target (`RA 08h55m10.831s, Dec -07°14′42.53″`).
   - Steps automatically walk through: (1) Infrared Flipbook in Band 6 (`4.42 µm`), (2) Side-by-Side Split View (`V1` vs `V4`), (3) Difference Imaging ("Difference image" dipole signature), (4) Shift-and-Add Co-addition ("Combined"), and (5) Gaia/AllWISE Catalogue Overlay + SPHEREx 102-channel Spectrum.

11. **Query Sky Patches via URL**
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
│       ├── pages/                 # Intro (welcome page at /), Home (sky map at /map) and Viewer (flipbook)
│       ├── components/            # SkyMap, SkyImage, FlipPlayer, SplitPlayer, DemoTour, TutorialModal, SettingsModal, SpectrumChart, RulerOverlay, RulerPanel, Flags, MapCards, ProjectDialog
│       ├── core/                  # Sky projection, sky picture drawing, bands, spectral features, astronomical ruler, projects store
│       └── services/              # api.js: backend calls (polls while pictures download); skyTiles.js: the Home map's sky picture from IRSA
├── logs/                          # One entry per code change
├── docs/API.md                    # Backend API reference
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
- **Backend API Guide**: [`docs/API.md`](docs/API.md) (every endpoint, parameters, responses, the 202 polling pattern, examples)

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
