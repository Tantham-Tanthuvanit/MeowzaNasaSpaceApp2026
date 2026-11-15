# 🪐 SkyFlip — NASA SPHEREx Sky Viewer
### *Spot things that move or change in real NASA infrared pictures*

[![NASA Space Apps Challenge](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com/)

SkyFlip was built by team Meowza for the **NASA Space Apps Challenge 2026** ("Planet X and SPHEREx"). Pick any spot in the sky and SkyFlip shows you the real pictures NASA's **SPHEREx** telescope took of it on each of its visits, as a flipbook. Flip between them to find things that move (brown dwarfs, fast stars, asteroids, comets) or change brightness, then flag what you find so others can check it.

Everything comes from real data: NASA/IPAC's Infrared Science Archive (IRSA), Gaia DR3 and AllWISE. There are no sample pictures or made-up results.

---

## 📑 Contents

- [What you can do](#-what-you-can-do)
- [Install and run](#-install-and-run)
- [Try it](#-try-it)
- [Keyboard shortcuts](#%EF%B8%8F-keyboard-shortcuts)
- [For developers](#%EF%B8%8F-for-developers)
- [Data credits](#-data-credits)

---

## ✨ What you can do

- **Welcome page** — the story of how comparing pictures over time found Pluto and the coldest brown dwarf (WISE 0855), with a live flipbook of WISE 0855.
- **Sky map** — pan and zoom the whole sky in visible light (DSS2 colour) or infrared (SPHEREx). Search saved projects, click a spot to start a new one, or press **Random patch** to explore somewhere new. The layer toggles show or hide user-made projects and the official targets separately.
- **Flipbook viewer** — one picture per SPHEREx visit, lined up so stars stay still and moving things jump:
  - **Split view** to put two visits side by side.
  - **Difference image** to subtract one visit from another: still stars cancel out, a moving object shows as a dark/bright pair.
  - **Combined** view (shift-and-add) with two drift sliders, to bring out faint moving objects.
  - Detector bands 1–6, all bands combined, false colour, and narrow filters (e.g. methane) under **More kinds of light…**
  - Field of view from 1′ to 30′, an RA/Dec grid, a scale bar, and a **ruler** that measures distance, direction and speed between visits.
  - **Mark known stars** to overlay Gaia DR3 and AllWISE stars (brown dwarf candidates and known artefacts such as diffraction spikes are labelled, and can be hidden).
  - **Spectrum chart** — the light at the centre spot split into SPHEREx's 102 colours (0.75–5.0 µm), with common absorption and emission lines marked.
- **Flag and vote** — **Flag something here** marks a point and saves it for everyone. Others can press **I see it too**. You can delete your own flags.
- **Guided demo** (2 minutes) — the **Guided demo** button walks beginners through spotting a real streak in the WISE 0855 pictures. **How to use** opens the field guide at any time.
- **Themes** — 🎨 **Themes** in the header has dark and light colour themes.

---

## 🚀 Install and run

### You need

- **Python 3.11 or newer** — [python.org](https://www.python.org/downloads/)
- **Node.js 18 or newer** (with npm) — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)
- An internet connection (pictures and star catalogues are fetched from NASA's archive)

No accounts or keys are needed: the app connects to the team's shared database by itself.

### 1. Download

```bash
git clone https://github.com/Tantham-Tanthuvanit/MeowzaNasaSpaceApp2026.git
cd MeowzaNasaSpaceApp2026
```

### 2. Set up (once)

**macOS / Linux / Git Bash:**
```bash
./setup.sh
```

**Windows (Command Prompt or PowerShell):**
```cmd
.\setup.bat
```

This installs everything the app needs inside the project folder. It takes a few minutes the first time.

### 3. Start

**macOS / Linux / Git Bash:**
```bash
./start.sh
```

**Windows:**
```cmd
.\start.bat
```

Then open **[http://localhost:5173](http://localhost:5173)** in your browser. Press `Ctrl + C` in the terminal to stop.

> [!NOTE]
> On first start the app creates `backend/.supabase-session.json`. Keep it: it is how SkyFlip knows which flags and projects are yours. If you delete it you start over as a new user.

---

## 🔭 Try it

| Target | RA | Dec | What's ready |
|---|---|---|---|
| **WISE 0855** (cold brown dwarf, moves fast) | `133.795129` | `-7.245147` | Everything is saved already, so it opens in about a second. |
| **Proxima Centauri** (nearest star to the Sun) | `217.429167` | `-62.679444` | The flipbook is saved; the spectrum still has to download. |

Open any spot straight from a link (decimal degrees or `08h55m10.8s` style both work; `fov` is the width in arcminutes, default 5):

```text
http://localhost:5173/#/viewer?ra=08h55m10.831s&dec=-07d14m42.53s&fov=10
```

**A new spot takes a while the first time**, because every picture is downloaded from NASA once and then saved for everyone. The viewer shows "N of M pictures are here" while it waits:

| What you open | First time | After that |
|---|---|---|
| Flipbook, one band (the default) | under a minute | instant |
| All bands combined | a few minutes | instant |
| Spectrum or a narrow filter | 10–15 minutes or more | instant |
| Mark known stars | about 30 seconds | about 30 seconds |

---

## ⌨️ Keyboard shortcuts

In the viewer:

| Key | Action |
|---|---|
| `Space` | Play / pause the flipbook |
| `←` / `→` | Previous / next visit |
| `G` | Show / hide the RA & Dec grid |
| `M` | Turn the ruler on / off |
| `C` | Switch colours between Inferno and grayscale |
| `Esc` | Close the open window or menu |

---

## 🛠️ For developers

Working rules for the team (and AI assistants) are in [`CLAUDE.md`](CLAUDE.md): real data only, a `logs/` entry for every code change, and keeping this README up to date. The backend API is documented in [`docs/API.md`](docs/API.md) and at [http://localhost:8000/docs](http://localhost:8000/docs) while running.

### Manual setup (two terminals)

```bash
# Terminal 1 — backend (FastAPI, http://localhost:8000)
cd backend
python3 -m venv venv               # Windows: python -m venv venv
source venv/bin/activate            # Windows: .\venv\Scripts\activate
pip install -r requirements.txt pytest pytest-asyncio
uvicorn main:app --port 8000 --reload

# Terminal 2 — frontend (Vite, http://localhost:5173)
cd frontend
npm install
npm run dev
```

`./start.sh` runs the backend **without** auto-reload: restart it after a backend change and check `curl localhost:8000/api/health` (expect `"version":"2.0.0"`). An old process left on port 8000 has caused wrong test results before.

### Tests

```bash
cd backend && ./venv/bin/python -m pytest test_suite.py     # offline unit tests (Windows: .\venv\Scripts\python.exe)
cd frontend && npx vitest run && npm run build              # needs Node 22.12+ (Vitest 5)
```

Live tests against IRSA and Supabase: `LIVE_TESTS=1 ./venv/bin/python -m pytest test_suite.py`. They need an owner's `SUPABASE_SECRET_KEY` in `backend/.env`, because with the public key one install is one voter. Delete any test flags, votes or projects you create.

### Project layout

```
backend/
  main.py               FastAPI app and endpoints
  data_loader.py        IRSA queries, cutout download, caching, spectrum
  image_processor.py    reprojection, stretch, difference images, shift-and-add
  catalog_service.py    Gaia DR3 + AllWISE overlay (IRSA TAP)
  coordinates.py        RA/Dec parsing (sexagesimal or decimal)
  database.py           candidates, votes, projects
  supabase_client.py    publishable key + anonymous sign-in
  public.env            shared Supabase URL + publishable key (read directly)
  test_suite.py
frontend/src/
  pages/                Intro (#/), Home sky map (#/map), Viewer (#/viewer)
  components/           FlipPlayer, SplitPlayer, SkyMap, DemoTour, SpectrumChart, Ruler*, ...
  core/                 sky projection, bands, spectral features, ruler maths, projects store
  services/api.js       backend calls; poll() handles the 202 "still downloading" answers
supabase/migrations/    SQL for tables and row-level security
docs/                   API reference and open team decisions
logs/                   one entry per code change
```

### How the data flows

- `/api/sky-cutout`, `/api/spectrum` and the filters ask IRSA which SPHEREx DR1/QR3 images cover a position, download cutouts in the background (4 at a time), subtract the zodiacal light and reproject them to one north-up grid. Images are grouped into survey visits; each flipbook frame is one visit.
- While downloading, these endpoints answer **202** with `{cached_images, total_images}`; the frontend polls.
- Cutouts are cached in Supabase Storage (bucket `sky-cutouts`, table `sky_cutouts`); finished responses in `sky_results`. If IRSA or Supabase fails, the API returns an error — there is no fallback data.
- `/api/difference-image?diff_scale=noise` scales to the noise instead of the strongest change (the guided demo uses it). `/api/candidates/export-mpc` exports flags in MPC format.

### Database and access (Supabase)

| Table / bucket | Holds |
|---|---|
| `sky_cutouts` + bucket `sky-cutouts` | cached cutouts (`.npy`), wavelengths, IRSA URIs |
| `sky_results` | finished flipbook frames and difference images |
| `sky_positions` | download status per position |
| `projects` | saved sky spots and official targets |
| `candidates`, `candidate_votes` | flags and votes |

The app uses the **public publishable key**, so row-level security is the only protection. Each install signs in as an anonymous Supabase user. Anyone can read everything and add flags, votes and projects, but only change or delete their own (`owner_id`); rows from before 2026-11-15 have no owner and are read-only. The cache is write-once (5 MB per file, `.npy` and PNG only): backend writes must insert-and-ignore-duplicates. Limits: one vote per user per flag, 300 flags and 300 projects per user a day, size limits on text and JSON columns. See `supabase/migrations/20261115221500_publishable_key_access.sql` and `20261115224500_harden_public_access.sql`. Any new table, column or storage use needs matching policies. There is one live database and no staging copy.

> [!CAUTION]
> Owners can put `SUPABASE_SECRET_KEY=sb_secret_...` in `backend/.env` (git-ignored; it overrides `public.env`). The secret key bypasses row-level security. **Never put it in `public.env` or commit it**, and never commit `backend/.supabase-session.json`.

### Known issues

- `frontend/node_modules/` and `frontend/dist/` are tracked in git (see issue #12), so they show as modified after `npm install` or a build. Leave them out of commits.
- `setup.sh` / `setup.ps1` accept Python 3.9+, but `reproject==0.21.0` and recent `astropy` need **3.11+**, so setup fails at `pip install` on 3.9–3.10.
- The in-app shortcut list (🎨 Themes → Keyboard & Controls) also lists `1`–`6` and `Shift + Click`; neither is implemented.
- To make the guided demo show an asteroid instead of the satellite streak, fill in `DEMO_ASTEROID` in `frontend/src/components/DemoTour.jsx`. The advanced tour is at `#/viewer?demo=a1`.
- `logs/CHANGELOG.md`, `promps/` and `frontend/FIGMA_PREP_GUIDE.md` describe the first prototype (simulated data, Flask) and are out of date.

---

## 📜 Data credits

- **SPHEREx**: "This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration." Data served by the [NASA/IPAC Infrared Science Archive (IRSA)](https://irsa.ipac.caltech.edu/).
- **Gaia DR3**: European Space Agency (ESA) Gaia mission, DPAC ([CC BY-NC 3.0 IGO](https://www.cosmos.esa.int/web/gaia-users/license)).
- **AllWISE**: Wide-field Infrared Survey Explorer, a joint project of UCLA and JPL/Caltech, funded by NASA.
- **Digitized Sky Survey (DSS2)**: Based on photographic data obtained using the UK Schmidt Telescope and the Oschin Schmidt Telescope on Palomar Mountain, funded by NASA and STScI.
