# Planet X and SPHEREx — Project Architecture & Hackathon Execution Plan

## 1. System Architecture Overview

This project uses a decoupled **Client-Server Architecture** designed to process heavy astronomical datasets (FITS files, multi-band arrays, and celestial coordinate transformations) in Python while delivering a responsive, interactive crowdsourced discovery interface in React.

```
+-----------------------------------------------------------------------+
|                           FRONTEND (Client)                           |
|                     React + Vite + Tailwind CSS                       |
|                                                                       |
|  +-------------------+  +--------------------+  +------------------+  |
|  | Coordinate Search |  | Multi-Epoch Viewer |  | 102-Band Spectra |  |
|  | & Preset Buttons  |  | (Blink / Subtract) |  | & Aladin Overlay |  |
|  +---------+---------+  +---------+----------+  +--------+---------+  |
|            |                      |                      |            |
+------------+----------------------+----------------------+------------+
                                    |
                        REST API (JSON / Base64 PNG)
                         URL State Sync (?ra=&dec=)
                                    |
+-----------------------------------+-----------------------------------+
|                           BACKEND (Server)                            |
|                        Python + FastAPI + Uvicorn                     |
|                                                                       |
|  +-------------------+  +--------------------+  +------------------+  |
|  |  coordinates.py   |  | image_processor.py |  |  data_loader.py  |  |
|  |  (Astropy ICRS    |  | (NumPy Diffing,    |  | (FITS Parser,    |  |
|  |   Parser & Presets|  |  ZScale & Band     |  |  IRSA/NASA API   |  |
|  |   Lookup)         |  |  Stacking)         |  |  & Local Cache)  |  |
|  +-------------------+  +--------------------+  +------------------+  |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------+-----------------------------------+
|                        DATA & EXTERNAL SERVICES                       |
|  - Local Pre-Cached Test Targets (WISE 0855, Barnard's Star, etc.)    |
|  - SPHEREx Mission Archive / FITS Cutouts                             |
|  - External Sky Catalogs (Gaia / WISE via Astroquery or Aladin Lite)  |
+-----------------------------------------------------------------------+
```

---

## 2. Directory Structure

```text
space-apps-spherex/
├── backend/
│   ├── venv/                      # Python virtual environment
│   ├── main.py                    # FastAPI entry point, routes, and CORS setup
│   ├── coordinates.py             # Astropy RA/Dec parser and preset targets
│   ├── image_processor.py         # NumPy array subtraction, ZScale normalization, PNG export
│   ├── data_loader.py             # Mock generator (Phase 1) -> SPHEREx FITS loader (Phase 2)
│   ├── static/                    # Generated/cached epoch and difference PNG cutouts
│   └── requirements.txt           # astropy, numpy, matplotlib, fastapi, uvicorn, pillow, requests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx      # Coordinate input & 1-click Test Target buttons
│   │   │   ├── SkyViewer.jsx      # Canvas for epoch blinking and difference image overlay
│   │   │   ├── TimelineSlider.jsx # Chronological epoch scrubber
│   │   │   └── SpectrumChart.jsx  # 102 near-infrared band visualizer
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── data/
    └── cache/                     # Local FITS cache for instant demo loading
```

---

## 3. Master 48-Hour Hackathon Schedule

| Phase | Timeframe | Primary Focus | Backend Deliverable | Frontend Deliverable |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Pre-Flight & Mock Architecture** | **Friday, Nov 13** *(Pre-Resource Drop)* | Scaffolding, API Contract, & Coordinate Logic | FastAPI server (`main.py`), Astropy RA/Dec parser, synthetic image diff engine, and mock JSON endpoints | React + Vite setup, UI layout, coordinate search bar, and dummy timeline slider |
| **Phase 2: Data Ingestion & Core Pipeline** | **Saturday, Nov 14** *(Morning — 09:00 to 13:00)* | Connecting real SPHEREx data & rendering sky views | Parse actual SPHEREx FITS/archive files, extract image cutouts, serve base64/PNGs | Connect search inputs to backend API, render multi-epoch images on canvas |
| **Phase 3: "Winning" Feature Sprint** | **Saturday, Nov 14** *(Afternoon/Night — 13:00 to 23:00)* | High-impact scientific tools | **Image Subtraction engine** (NumPy array diffing), detector band stacking, & dynamic spectra | "Blink" comparator toggle, difference-image view, URL query syncing (`?ra=...&dec=...`), and Aladin Lite / Gaia overlay |
| **Phase 4: Target Testing & Polish** | **Sunday, Nov 15** *(Morning — 09:00 to 12:00)* | Verification, bug fixing, & cloud deployment | Verify preset targets (**WISE 0855**, **Barnard's Star**), cache responses for instant loading, deploy backend | Add 1-click "Quick Target" buttons, polish UI/UX, deploy frontend (Vercel/Netlify) |
| **Phase 5: Pitch, Video & Submission** | **Sunday, Nov 15** *(Afternoon — 12:00 to 23:59)* | Storytelling, demo video, & project page | Write technical architecture summary & data pipeline docs for the submission page | Record crisp screen-capture demo, finalize slide deck |

---

## 4. Frontend-Backend API Contract

Locking in this JSON structure during Phase 1 allows the backend and frontend to be built simultaneously without blocking each other.

### Endpoint 1: `GET /api/sky-cutout`
* **Query Parameters:**
  * `ra` (string): Right Ascension in sexagesimal (`08h55m10.831s`) or decimal degrees (`133.795`).
  * `dec` (string): Declination in sexagesimal (`-07d14m42.53s`) or decimal degrees (`-7.245`).
  * `fov` (float, optional): Field of view in arcminutes (default: `5.0`).
  * `band_group` (string, optional): Wavelength band selection or `"stacked"` for combined signal-to-noise.

* **Response Payload (`200 OK`):**
```json
{
  "target_info": {
    "ra_deg": 133.795129,
    "dec_deg": -7.245147,
    "ra_hms": "08h55m10.831s",
    "dec_dms": "-07d14m42.53s",
    "fov_arcmin": 5.0
  },
  "epochs": [
    {
      "epoch_id": "epoch_1",
      "timestamp": "2025-06-15",
      "image_url": "http://localhost:8000/static/cutout_e1.png",
      "contamination_flag": false
    },
    {
      "epoch_id": "epoch_2",
      "timestamp": "2025-12-15",
      "image_url": "http://localhost:8000/static/cutout_e2.png",
      "contamination_flag": false
    }
  ],
  "difference_image_url": "http://localhost:8000/static/cutout_diff.png",
  "spectrum_preview": [
    {"wavelength_um": 0.75, "flux": 1.24},
    {"wavelength_um": 1.10, "flux": 2.15},
    {"wavelength_um": 1.50, "flux": 3.42}
  ]
}
```

### Endpoint 2: `GET /api/presets`
Returns the official NASA Space Apps test targets for 1-click verification by the judges.
* **Response Payload (`200 OK`):**
```json
[
  {
    "id": "wise_0855",
    "name": "WISE 0855",
    "category": "Fast-Moving Brown Dwarf",
    "ra": "08h55m10.831s",
    "dec": "-07d14m42.53s",
    "description": "Sub-brown dwarf 7.4 light-years from Earth exhibiting high proper motion."
  },
  {
    "id": "barnards_star",
    "name": "Barnard's Star",
    "category": "High Proper-Motion Star",
    "ra": "17h57m48.498s",
    "dec": "+04d41m36.20s",
    "description": "Red dwarf with the highest known proper motion of any star relative to the Sun."
  },
  {
    "id": "epsilon_indi_b",
    "name": "Epsilon Indi B",
    "category": "Brown Dwarf Binary Pair",
    "ra": "22h04m10.5s",
    "dec": "-56d46m58s",
    "description": "Binary brown dwarf system orbiting Epsilon Indi A."
  },
  {
    "id": "rw_aurigae",
    "name": "RW Aurigae",
    "category": "Variable Star",
    "ra": "05h07m49.57s",
    "dec": "+30d24m05.1s",
    "description": "T Tauri variable star system showing significant brightness fluctuations over time."
  },
  {
    "id": "r_draconis",
    "name": "R Draconis",
    "category": "Mira Variable Star",
    "ra": "16h32m40.23s",
    "dec": "+66d45m17.9s",
    "description": "Pulsating red giant variable star with strong infrared variability."
  }
]
```

---

## 5. Backend Module Breakdown & Implementation Guide

### Module A: `coordinates.py` (Astropy Engine)
* **Purpose:** Accept flexible coordinate inputs from citizen scientists and astronomers and normalize them into decimal degrees (`ICRS` frame).
* **Key Logic:**
  * Use `astropy.coordinates.SkyCoord` with automatic unit inference (`u.hourangle, u.deg` for sexagesimal strings or `u.deg, u.deg` for floats).
  * Provide fallback name resolution via `SkyCoord.from_name()` so users can type object names directly.

### Module B: `image_processor.py` (Scientific Image Processing)
* **Purpose:** Convert raw 2D floating-point FITS arrays into high-contrast web-ready PNGs and highlight moving/variable targets.
* **Key Logic:**
  * **Contrast Scaling:** Apply `astropy.visualization.ZScaleInterval` or `AsinhStretch` so faint brown dwarfs are visible alongside bright background stars.
  * **Image Subtraction:** Compute `diff = epoch_2 - epoch_1` (and `np.abs(epoch_2 - epoch_1)`) to cancel out static background stars and leave only moving dipoles or brightening variable stars.
  * **Band Stacking:** Average/sum across selected SPHEREx detector arrays to boost the Signal-to-Noise Ratio (SNR) for faint targets.

### Module C: `data_loader.py` (Adapter Pattern)
* **Phase 1 (Before Resource Drop):** Generates two synthetic 256x256 NumPy arrays containing static Gaussian stars plus one moving target that shifts by $(\Delta x, \Delta y)$ pixels between Epoch 1 and Epoch 2.
* **Phase 2 (After Resource Drop):** Swaps the synthetic generator for `astropy.io.fits` / `astroquery` to read official SPHEREx cutouts while keeping the exact same function return signature so `main.py` and the frontend require zero structural rewrites.