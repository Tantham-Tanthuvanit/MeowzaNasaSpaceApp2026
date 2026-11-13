# Frontend & Figma Implementation Guide
## NASA Space Apps Challenge: SPHEREx Sky Viewer

This guide helps you translate **Wut's Figma design** directly into our React + Tailwind codebase quickly and smoothly.

---

## 1. Component Map & Architecture

When Wut shares the Figma screens, map each visual section to its corresponding React component:

| Figma Section / Frame | React Component File | Primary Responsibilities |
| :--- | :--- | :--- |
| **Top Navigation & Telemetry** | [`src/App.jsx`](src/App.jsx) (header section) | Mission title, branding, cadence badge ("6 Months"), channel count ("102 Near-IR"). |
| **1-Click Presets & Search Bar** | [`src/components/SearchBar.jsx`](src/components/SearchBar.jsx) | Preset buttons (WISE 0855, etc.), RA/Dec/FOV inputs, stretch/colormap dropdowns, "Share URL". |
| **Sky Viewer (Blink / Difference Canvas)** | [`src/components/SkyViewer.jsx`](src/components/SkyViewer.jsx) | Astronomical canvas, Blink mode, Difference Image ($\Delta E$) mode, Split view, crosshair overlay, zoom controls. |
| **Timeline & Video Player** | [`src/components/TimelineSlider.jsx`](src/components/TimelineSlider.jsx) | Chronological 6-month epoch scrubber, Play/Pause button, cadence speed selector (0.5x, 1x, 2x, 3x). |
| **102-Band Spectrum** | [`src/components/SpectrumChart.jsx`](src/components/SpectrumChart.jsx) | Interactive near-infrared SED curve (0.75 - 5.00 μm), molecular lines ($H_2O, CH_4, CO, CO_2$), detector array colored segments. |
| **Educational Cards / Footer** | [`src/App.jsx`](src/App.jsx) (bottom section) | Explanations for dipoles, infrared stacking, and challenge citations. |

---

## 2. Design Tokens & Tailwind Theme

Tailwind CSS is already active and pre-configured in [`index.html`](index.html). You can immediately use all standard Tailwind utilities plus these custom astronomy tokens:

### Palette
* **Deep Space Backgrounds:**
  * Base: `bg-[#070a13]` (or `bg-space-950`)
  * Surface Panel: `bg-slate-900/90` or `.glass-panel`
  * Card / Input: `bg-slate-950/80` or `.glass-card`
* **Accents & Telemetry:**
  * Primary Cyan: `text-cyan-400`, `border-cyan-500/30`, `bg-cyan-500`
  * Difference / Alert Amber: `text-amber-400`, `border-amber-500/40`, `bg-amber-500`
  * Success / Cadence Emerald: `text-emerald-400`, `bg-emerald-500/20`
  * Error / Contamination Rose: `text-rose-400`, `bg-rose-950/60`
* **SPHEREx Detector Arrays (Spectrum Chart):**
  * Array 1 (0.75 - 1.11 μm): `#818cf8` (`text-indigo-400`)
  * Array 2 (1.11 - 1.64 μm): `#38bdf8` (`text-cyan-400`)
  * Array 3 (1.64 - 2.42 μm): `#34d399` (`text-emerald-400`)
  * Array 4 (2.42 - 3.82 μm): `#fbbf24` (`text-amber-400`)
  * Array 5 (3.82 - 4.42 μm): `#fb923c` (`text-orange-400`)
  * Array 6 (4.42 - 5.00 μm): `#f87171` (`text-red-400`)

### Typography
* **UI & Headings**: `'Plus Jakarta Sans', sans-serif` (`font-sans`)
* **Coordinates & Telemetry**: `'JetBrains Mono', monospace` (`font-mono` or `.mono`)

---

## 3. Slicing Wut's Figma Elements

### A. Icons
We use **Lucide React** (`lucide-react`). If Wut uses standard icons in Figma, you can replace them with one line:
```jsx
import { Telescope, Search, Play, Pause, Compass, Layers, Crosshair, Sparkles } from 'lucide-react';
```
If Wut creates custom SVG icons or logos:
1. In Figma, right-click the vector -> **Copy as SVG**.
2. Paste it directly as an inline `<svg ...>` or save in `src/assets/`.

### B. Glassmorphism Panels
If Figma features frosted glass panels with subtle cyan glow:
* Use the built-in helper class: `className="glass-panel p-5"`
* Or Tailwind: `className="bg-slate-900/80 backdrop-blur-md border border-cyan-500/20 rounded-xl shadow-2xl"`

### C. Live Testing Without Backend
The API layer in [`src/services/api.js`](src/services/api.js) automatically supplies realistic mock cutouts and spectrum data if the backend is not running. You can edit JSX and tweak CSS without waiting for backend requests!

---

## 4. Running the Dev Server
From the project root:
```bash
./start.sh
# or frontend alone:
cd frontend && npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** to see your updates in real time with Hot Module Replacement (HMR).
