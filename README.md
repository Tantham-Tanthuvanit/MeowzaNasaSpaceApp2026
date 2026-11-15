# 🪐 SkyFlip — NASA SPHEREx Sky Viewer
### *Multi-Epoch Infrared Transient & Celestial Discovery Tool*

[![NASA Space Apps Challenge](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com/)

A public web application built for the **NASA Space Apps Challenge (SPHEREx Challenge)** to explore, blink, and discover moving celestial objects (brown dwarfs, high proper-motion stars, asteroids, comets) and variable transients using real multi-epoch infrared spectral observations from NASA's **SPHEREx** mission (*Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer*).

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Prerequisites](#-prerequisites)
- [Installation & Setup Guide](#-installation--setup-guide)
  - [1. Clone Repository](#1-clone-the-repository)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Automated One-Click Setup](#3-automated-one-click-setup)
  - [4. Launch Application](#4-launch-the-application)
  - [5. Manual Setup (Alternative)](#5-manual-setup-alternative)
- [Benchmark Targets & Testing](#-benchmark-targets--testing)
- [Running Test Suites](#-running-test-suites)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Data Credits](#-data-credits)

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
   - The Home sky map supports both **Visible light** (default, full-color optical **DSS2 Color** from NASA/STScI via IRSA HiPS tiles) and **Infrared** (**NASA SPHEREx DR1** all-sky data cube first layer at 0.75 µm) via a 1-click **Sky light** toggle (`Visible light` / `Infrared (SPHEREx)`), persisted in `localStorage` (`skyflip_sky_survey`). Progressive HEALPix tiles stream straight from `irsa.ipac.caltech.edu` under the coordinate grid and markers as the user zooms up to 20,000% (native sharp 512×512 tiles through `Norder5`, ~13 arcseconds/pixel at 5,000%), with `"Loading a sharper picture…"` feedback and `"Try again"` error recovery if IRSA is unreachable.
   - Projects (the markers on the Home sky map) can be found with the "Find a project" search above the map (by name or description; picking one centres the map on it and opens its card). A "Random patch" button drops a pin on a randomly chosen celestial position so anyone can explore uncharted sky. A new project is started by clicking a spot on the map (or choosing a random patch) and saving the pin. Projects, candidates and votes are stored in Supabase and shared by everyone (there is no login yet). Each browser can vote once per candidate and can take the vote back (`vote_type: "unvote"`). The MPC-style export is at `/api/candidates/export-mpc`.
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

## 🌌 Overview

**SkyFlip** connects citizen scientists, students, and astronomers directly to real NASA infrared observations. Rather than serving static presets or mock data, the platform queries NASA's **IPAC Infrared Science Archive (IRSA)** in real time, downloads calibrated multi-epoch cutouts across 6 SPHEREx detector arrays, subtracts the zodiacal foreground light, and reprojects them onto a common celestial grid.

Users can blink frames across observation epochs, perform difference imaging, analyze 102-channel chemical absorption/emission spectra, measure proper motions with an astronomical ruler, and flag potential candidates for community review.

---

## ✨ Key Features

### 1. 🎞️ Real SPHEREx Multi-Epoch Flipbook
- **True Scientific Data**: Direct ingestion from NASA/IPAC IRSA SPHEREx DR1/QR3 data products.
- **Epoch Alignment**: Groups observations into distinct survey visits (e.g. May 2025, Oct/Nov 2025, Dec 2025, Apr/May 2026).
- **Astrometric Calibration**: Zodiacal light background subtracted and reprojected onto a shared north-up WCS grid for seamless blinking.
- **Spectral Bands**: Toggle between Individual Detector Arrays (`array_1` to `array_6`), All Bands Combined (`stacked`), False-Color Infrared RGB, or specific narrow-band filters/indices (e.g., Methane absorption `filter_ch4_deep`, `ratio_ch4`).

### 2. 🌗 Difference Imaging & Shift-and-Add Co-addition
- **Bipolar Difference Maps**: Subtracts reference visits from comparison visits ($B - A$) using a bipolar colormap. Stationary stars cancel out, while moving objects cleanly display a positive/negative dipole.
- **Shift-and-Add Search**: Co-adds frames along trial proper motion vectors to uncover faint sub-threshold moving targets.

### 3. 🌈 102-Channel Absorption & Emission Spectra Graph
- **Spectroscopic Breakdown**: Plots center-pixel brightness across all 102 SPHEREx spectral channels ($0.75\,\mu\text{m} - 5.00\,\mu\text{m}$).
- **Cosmic Fingerprints**:
  - **Absorption Dips**: Identifies cool molecular atmospheres and ice grains ($\text{H}_2\text{O}$ ice at $3.05\,\mu\text{m}$, $\text{CH}_4$ methane at $1.66$ & $3.30\,\mu\text{m}$, $\text{CO}_2$ ice at $4.27\,\mu\text{m}$, atmospheric vapor at $1.40$ & $1.90\,\mu\text{m}$, $\text{CO}$ at $4.67\,\mu\text{m}$).
  - **Emission Peaks**: Highlights shock fronts, ionized gases, and hot dust (Brackett-$\alpha$ at $4.05\,\mu\text{m}$, Paschen-$\alpha$ at $1.875\,\mu\text{m}$, Brackett-$\gamma$ at $2.166\,\mu\text{m}$, PAH dust at $3.30$ & $3.40\,\mu\text{m}$, shocked $\text{H}_2$ at $2.12\,\mu\text{m}$).
- **Kirchhoff Spectral Bars**: Dual visual reference bars depicting continuous rainbow absorption slits and glowing emission lines.

### 4. 🔭 Deep Catalog Overlay (Gaia DR3 & AllWISE)
- **Automated Cross-matching**: Real-time TAP queries against Gaia DR3 (`parallax`, `ruwe`) and AllWISE (`cc_flags`, `ext_flg`, `ph_qual`).
- **Brown Dwarf Detection**: Highlights objects with infrared excess ($\text{W1} - \text{W2} \ge 1$) lacking optical Gaia counterparts.
- **Artifact Flagging**: Flags diffraction spikes ($D$), persistence ($P$), halos ($H$), optical ghosts ($O$), and high astrometric noise ($\text{RUWE} \ge 1.4$) with one-click filtering.

### 5. 🗺️ HiPS Sky Map & Citizen Science
- **Multi-Wavelength Sky Map**: Seamlessly switch between Optical (**DSS2 Color** via NASA/STScI) and Infrared (**NASA SPHEREx DR1** $0.75\,\mu\text{m}$) progressive HEALPix tiles up to $20,000\%$ zoom.
- **Community Discoveries**: Save new points of interest, flag moving candidates, and participate in community voting.
- **MPC Export**: Export verified discoveries in Minor Planet Center (MPC) report format.

### 6. 📐 Astronomical Ruler & Coordinate Grid
- **Celestial Coordinates**: Interactive Right Ascension & Declination coordinate grid with orientation arrows ($\text{N} \uparrow, \text{E} \leftarrow$).
- **Two-Point Measuring Tool**: Measure angular separations (arcseconds/arcminutes), position angles (East of North), pixel distances, and multi-epoch proper motion velocities.

### 7. 🎨 Theming, Field Guide & Guided Demo
- **Monkeytype-Style Themes**: Includes dark/light palettes (Deep Spruce, Retro Sunset, Ocean Coral, Midnight SPHEREx, Cyberpunk Neon).
- **Interactive Guided Tour**: 5-step automated walkthrough demonstrating the discovery of cold brown dwarf **WISE 0855**.
- **Field Guide**: Integrated newcomer tutorial explaining infrared bands, blinking strategies, and dipole signatures.

---

## 🏗️ System Architecture

```
MeowzaNasaSpaceApp2026/
├── backend/
│   ├── main.py                 # FastAPI application & REST endpoints
│   ├── data_loader.py          # NASA IRSA TAP queries & cutout downloader
│   ├── catalog_service.py      # Gaia DR3 & AllWISE cross-matching
│   ├── image_processor.py      # WCS reprojection, contrast stretch, difference imaging
│   ├── coordinates.py          # Astropy celestial coordinate conversion
│   ├── database.py             # Supabase data operations (candidates, votes, projects)
│   ├── supabase_client.py      # Authenticated Supabase client
│   ├── test_suite.py           # Backend unit and live test suite
│   ├── requirements.txt        # Python backend dependencies
│   └── .env.example            # Environment configuration template
├── frontend/
│   ├── src/
│   │   ├── pages/              # Home (All-Sky Map) and Viewer (Flipbook)
│   │   ├── components/         # SkyMap, FlipPlayer, SpectrumChart, RulerOverlay, etc.
│   │   ├── core/               # Celestial projections, spectral lines, theme manager
│   │   └── services/           # Backend polling API client & HiPS tile fetcher
│   ├── package.json            # Frontend dependencies & scripts
│   └── vite.config.js          # Vite build configuration
├── supabase/migrations/        # PostgreSQL schema definitions & RLS policies
├── docs/                       # Detailed API documentation (API.md)
├── setup.sh, setup.bat         # Cross-platform installation scripts
└── start.sh, start.bat         # Single-command dev server launch scripts
```

### Database & Storage (Supabase)

| Table / Bucket | Description |
|---|---|
| `sky_cutouts` + bucket `sky-cutouts` | Cached raw FITS cutouts (`.npy`), wavelength metadata, and IRSA URIs |
| `sky_results` | Pre-rendered composite flipbook frames and difference maps |
| `sky_positions` | Ingestion status and metadata per celestial coordinate |
| `projects` | User-saved sky regions and official benchmark targets |
| `candidates` & `candidate_votes` | Community discovery flags, coordinates, and upvotes |

---

## 📋 Prerequisites

Before installing, ensure your system has the following installed:

1. **Python**: Version `3.9` or higher ([python.org](https://www.python.org/downloads/))
2. **Node.js**: Version `18.0` or higher with `npm` ([nodejs.org](https://nodejs.org/))
3. **Git**: Installed and in your system `PATH` ([git-scm.com](https://git-scm.com/))
4. **Supabase Project**: A valid Supabase instance (requires project URL & secret service key)

---

## 🚀 Installation & Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Tantham-Tanthuvanit/MeowzaNasaSpaceApp2026.git
cd MeowzaNasaSpaceApp2026
```

### 2. Configure Environment Variables

Create your backend configuration file from the template:

**Windows (PowerShell):**
```powershell
Copy-Item backend\.env.example backend\.env
```

**macOS / Linux / Git Bash:**
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in your editor and provide your Supabase credentials:
```env
# Supabase project URL
SUPABASE_URL=https://your-project-id.supabase.co

# Supabase secret service key (bypasses RLS for backend operations)
SUPABASE_SECRET_KEY=sb_secret_your_secret_key_here
```

> [!CAUTION]
> **Never commit or share `backend/.env`**. The secret key has elevated permissions and must remain server-side only.

---

### 3. Automated One-Click Setup

The project includes automated setup scripts that verify Python and Node environments, install all backend packages in a local virtual environment (`backend/venv`), and install frontend npm dependencies.

**Windows (Command Prompt / PowerShell):**
```cmd
.\setup.bat
```
*(or run `powershell -ExecutionPolicy Bypass -File .\setup.ps1`)*

**macOS / Linux / Windows (Git Bash):**
```bash
chmod +x setup.sh start.sh
./setup.sh
```

---

### 4. Launch the Application

Start both the FastAPI backend and React + Vite frontend concurrently with one command:

**Windows:**
```cmd
.\start.bat
```
*(or `powershell -ExecutionPolicy Bypass -File .\start.ps1`)*

**macOS / Linux / Git Bash:**
```bash
./start.sh
```

Once running, access the services:
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

Press `Ctrl + C` in the terminal to cleanly terminate both processes.

---

### 5. Manual Setup (Alternative)

If you prefer running services in separate terminals:

#### Terminal 1 — Backend (FastAPI):
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt pytest pytest-asyncio

# Run backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2 — Frontend (React + Vite):
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## 🔭 Benchmark Targets & Testing

To test the application immediately without waiting for IRSA background downloads, use pre-cached celestial benchmarks:

| Target | Right Ascension | Declination | Characteristics |
|---|---|---|---|
| **WISE 0855** | `133.795129` (`08h55m10.83s`) | `-7.245147` (`-07°14′42.5″`) | Sub-zero brown dwarf with high proper motion. Fully pre-cached (flipbook, difference images, 102-channel spectrum, catalog overlay). |
| **Proxima Centauri** | `217.429167` (`14h29m43.00s`) | `-62.679444` (`-62°40′46.0″`) | Closest stellar neighbor to Sol. High proper motion flipbook available. |

#### Direct URL Deep Linking
You can jump directly into any celestial coordinate via URL hash parameters:
```text
http://localhost:5173/#/viewer?ra=08h55m10.831s&dec=-07d14m42.53s&fov=10
```

---

## 🧪 Running Test Suites

### Backend Unit & Integration Tests

```bash
# Offline unit tests
cd backend
python -m pytest test_suite.py

# Live integration tests (verifies active IRSA & Supabase connectivity)
LIVE_TESTS=1 python -m pytest test_suite.py
```

### Frontend Tests & Production Build

```bash
cd frontend

# Run frontend unit tests
npx vitest run

# Test production production build
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause flipbook animation |
| `←` / `→` | Step backward / forward one epoch visit |
| `1` – `6` | Quick-switch SPHEREx detector array (`Band 1` to `Band 6`) |
| `D` | Toggle Difference Image view ($B - A$) |
| `S` | Toggle Side-by-Side Split view |
| `C` | Toggle Shift-and-Add Combined view |
| `G` | Toggle RA & Dec Coordinate Grid overlay |
| `M` | Activate Astronomical Ruler & Measuring Tool |
| `Esc` | Close active modal, tool, or viewer overlay |

---

## 📜 Data Credits

- **SPHEREx Mission**: "This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration." Data served by the [NASA/IPAC Infrared Science Archive (IRSA)](https://irsa.ipac.caltech.edu/).
- **Gaia DR3**: European Space Agency (ESA) Gaia mission, DPAC ([CC BY-NC 3.0 IGO](https://www.cosmos.esa.int/web/gaia-users/license)).
- **AllWISE**: Wide-field Infrared Survey Explorer, a joint project of UCLA and JPL/Caltech, funded by NASA.
- **Digitized Sky Survey (DSS2)**: Based on photographic data obtained using the UK Schmidt Telescope and the Oschin Schmidt Telescope on Palomar Mountain, funded by NASA and STScI.
