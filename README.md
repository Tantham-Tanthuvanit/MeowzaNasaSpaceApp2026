# NASA SPHEREx Sky Viewer — Multi-Epoch Infrared Transient Discovery Tool

A public-facing web platform built for the **NASA Space Apps Challenge** to explore and discover moving celestial objects (brown dwarfs, asteroids, comets, high proper-motion stars) and variable stars using multi-epoch observations from NASA's **SPHEREx** mission (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer).

---

## 🌟 Key Features Implemented

1. **Infrared Light Layering (102 Spectral Channels)**
   - **All 102 Bands Stacked**: Co-adds across all SPHEREx near-infrared bands (0.75 μm to 5.00 μm) to boost the Signal-to-Noise Ratio (SNR) by $\sim \sqrt{102} \approx 10\times$ for detecting ultra-faint brown dwarfs.
   - **Detector Arrays 1 to 6**: Toggle individual detector arrays to inspect spectral behavior:
     - *Array 1 (0.75 - 1.11 μm)*: Short near-IR
     - *Array 2 (1.11 - 1.64 μm)*: J-band region
     - *Array 3 (1.64 - 2.42 μm)*: H & K region
     - *Array 4 (2.42 - 3.82 μm)*: Methane ($CH_4$) and water ($H_2O$) absorption
     - *Array 5 (3.82 - 4.42 μm)*: Carbon monoxide ($CO$) and carbon dioxide ($CO_2$)
     - *Array 6 (4.42 - 5.00 μm)*: Thermal infrared edge
   - **False-Color Infrared Composite (RGB)**: Synthesizes short, mid, and long near-infrared bands into 3-color RGB imagery.

2. **Query Sky Patches via URL**
   - Direct coordinate linking and web embedding: `http://localhost:5173/?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0`
   - Accepts both sexagesimal strings (`08h55m10.831s -07d14m42.53s`) and decimal degrees (`133.795, -7.245`).
   - Browser URL automatically syncs when coordinates change, allowing 1-click sharing of celestial discoveries.

3. **Multi-Frame Epoch Snippet & Time-Lapse Player**
   - Video-like playback advancing through consecutive 6-month survey epochs (`2025-06-15`, `2025-12-15`, `2026-06-15`, `2026-12-15`).
   - Variable playback cadence controls (0.5x, 1x, 2x, 3x fps), frame scrubber, and step buttons.

4. **Scientific Image Subtraction (Difference Imaging)**
   - Computes $\Delta E = \text{Epoch}_2 - \text{Epoch}_1$ with a bipolar divergence colormap.
   - Moving objects display an unmistakable **dipole signature** (negative dark hole alongside positive bright peak).
   - Variable stars display large non-dipole flux residuals.
   - Side-by-side comparison mode for detailed dual-epoch inspection.

5. **1-Click Official Challenge Benchmark Targets**
   - **WISE 0855**: Fast-moving sub-brown dwarf 7.4 light-years away exhibiting high proper motion.
   - **Barnard's Star**: Second closest stellar system exhibiting the highest known proper motion (10.3 arcsec/yr).
   - **Epsilon Indi B**: Binary brown dwarf pair co-moving through near-IR bands.
   - **RW Aurigae**: Classical T Tauri variable star undergoing dramatic dust occultations.
   - **R Draconis**: Mira pulsating red giant exhibiting massive brightness variations.

6. **Interactive 102-Band Spectrum Generator**
   - Real-time spectral energy distribution (SED) preview from 0.75 μm to 5.00 μm.
   - Highlights molecular absorption bands: Water ($H_2O$), Methane ($CH_4$), Carbon Monoxide ($CO$), and Silicates.
   - Interactive hover inspection for individual wavelength channels and flux densities.

7. **Dual-Backend Support**
   - **FastAPI** (`main.py`): High performance, asynchronous endpoints, auto-generated Swagger UI at `/docs`.
   - **Flask** (`flask_app.py`): Lightweight alternative runner adhering to the identical REST API contract.

---

## 🏗️ Project Architecture

```
NASAspaceApp/
├── backend/
│   ├── venv/                      # Python virtual environment
│   ├── coordinates.py             # Astropy coordinate parser & challenge preset targets
│   ├── image_processor.py         # ZScale/Asinh contrast stretch, difference imaging, band stacking
│   ├── data_loader.py             # SPHEREx multi-epoch generator, 102-band SED engine, FITS cache
│   ├── main.py                    # FastAPI entrypoint, CORS & static mounts
│   ├── flask_app.py               # Alternative Flask entrypoint
│   ├── test_suite.py              # Backend unit test suite (FastAPI, coordinates, image processor)
│   ├── test_flask.py              # Flask endpoint verification suite
│   ├── static/                    # Cached cutout cutouts
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx      # Coordinates form & 1-click challenge target buttons
│   │   │   ├── SkyViewer.jsx      # Canvas, blink player, difference image & crosshairs
│   │   │   ├── TimelineSlider.jsx # Multi-frame time-lapse playback scrubber
│   │   │   └── SpectrumChart.jsx  # 102-band near-infrared spectrum visualizer
│   │   ├── App.jsx                # Main dashboard & URL state synchronization
│   │   ├── main.jsx               # React entry point
│   │   └── index.css              # NASA deep-space aesthetic stylesheet
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/
│   └── cache/                     # Local FITS and cutout cache
├── promps/
│   ├── task.md                    # Original challenge instructions
│   └── project_architecture_and_execution_plan.md
├── start.sh                       # One-command startup script
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. One-Time Setup (or automatic on first launch)

Run the automated OS environment setup script to create a clean virtual environment and install dependencies suited for your platform (Linux / macOS / WSL):

```bash
./setup.sh
```

### 2. Launch Both Backend & Frontend with One Command

```bash
./start.sh
```
*(If `setup.sh` has not been run yet or the venv was created on a different OS, `start.sh` will automatically run `setup.sh` first).*

* Or to run with the Flask backend instead of FastAPI:
```bash
./start.sh flask
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (FastAPI)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Manual Startup (Separate Terminals)

#### Terminal 1 — Backend:
```bash
cd backend
PYTHONPATH=. ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Or with Flask:
# PYTHONPATH=. ./venv/bin/python flask_app.py
```

#### Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
```

---

## 🧪 Running the Verification Test Suites

```bash
# Test full backend pipeline & FastAPI endpoints (12 tests)
PYTHONPATH=backend backend/venv/bin/python backend/test_suite.py

# Test Flask endpoints (4 tests)
PYTHONPATH=backend backend/venv/bin/python backend/test_flask.py

# Verify frontend build
cd frontend && npm run build
```
