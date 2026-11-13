"""
data_loader.py — SPHEREx Mission Data Ingestion & Multi-Epoch Simulator.

Simulates and ingests SPHEREx 102-band near-infrared hyperspectral cutouts across
multiple survey epochs (each six months apart: 2025-06, 2025-12, 2026-06, etc.).

Models real astrophysical properties for benchmark challenge targets:
- WISE 0855: Fast proper-motion sub-brown dwarf with deep H2O and CH4 absorption.
- Barnard's Star: High proper-motion M-dwarf.
- Epsilon Indi B: Co-moving brown dwarf binary system.
- RW Aurigae: Irregular T Tauri variable undergoing dust occultation.
- R Draconis: High-amplitude Mira-type pulsating variable star.

Also includes adapter methods for querying external archives (IRSA / CDS)
and reading local astronomical FITS files with caching in data/cache/.
"""

import os
import hashlib
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
import requests
from astropy.io import fits
from scipy.ndimage import gaussian_filter, zoom

import coordinates
import image_processor
from catalog_service import catalog_service


# SPHEREx Detector Array Layout (102 Near-IR Spectral Channels)
SPHEREX_ARRAYS = {
    "array_1": {"name": "Array 1 (Near-IR 1)", "range_um": (0.75, 1.11), "bands": 17, "index": 1},
    "array_2": {"name": "Array 2 (Near-IR 2)", "range_um": (1.11, 1.64), "bands": 17, "index": 2},
    "array_3": {"name": "Array 3 (Near-IR 3)", "range_um": (1.64, 2.42), "bands": 17, "index": 3},
    "array_4": {"name": "Array 4 (Mid-IR 1)",  "range_um": (2.42, 3.82), "bands": 17, "index": 4},
    "array_5": {"name": "Array 5 (Mid-IR 2)",  "range_um": (3.82, 4.42), "bands": 17, "index": 5},
    "array_6": {"name": "Array 6 (Mid-IR 3)",  "range_um": (4.42, 5.00), "bands": 17, "index": 6},
}

# 102 discrete central wavelengths from 0.75 to 5.00 micrometers
SPHEREX_WAVELENGTHS = np.concatenate([
    np.linspace(0.75, 1.11, 17),
    np.linspace(1.11, 1.64, 17),
    np.linspace(1.64, 2.42, 17),
    np.linspace(2.42, 3.82, 17),
    np.linspace(3.82, 4.42, 17),
    np.linspace(4.42, 5.00, 17),
])

EPOCH_DATES = [
    "2025-06-15",
    "2025-12-15",
    "2026-06-15",
    "2026-12-15"
]

# Astrophysical Element & Molecular Definitions for SPHEREx Hyperspectral Analysis
ELEMENT_DEFINITIONS = {
    "H2O": {
        "id": "H2O",
        "name": "Water (H₂O Ice & Vapor)",
        "formula": "H₂O",
        "category": "Volatile Ice & Biosignature",
        "primary_bands_um": [1.40, 1.90, 3.05],
        "default_colormap": "cividis",
        "accent_color": "#38bdf8",
        "column_scale_prefix": "10¹⁸",
        "description": "Critical biological solvent and volatile ice. SPHEREx maps the 3.05 μm interstellar ice absorption and atmospheric vapor bands at 1.40/1.90 μm across brown dwarfs and proto-planetary discs."
    },
    "CH4": {
        "id": "CH4",
        "name": "Methane (CH₄)",
        "formula": "CH₄",
        "category": "Substellar Hydrocarbon",
        "primary_bands_um": [1.66, 3.30],
        "default_colormap": "viridis",
        "accent_color": "#34d399",
        "column_scale_prefix": "10¹⁸",
        "description": "Diagnostic absorption marker for ultra-cool T and Y brown dwarfs (e.g. WISE 0855) and giant exoplanet atmospheres, exhibiting deep absorption at 1.66 μm and 3.30 μm."
    },
    "CO2": {
        "id": "CO2",
        "name": "Carbon Dioxide (CO₂ Ice)",
        "formula": "CO₂",
        "category": "Interstellar Ice Mantle",
        "primary_bands_um": [4.25],
        "default_colormap": "plasma",
        "accent_color": "#fbbf24",
        "column_scale_prefix": "10¹⁷",
        "description": "Ubiquitous component of interstellar ice mantles on cosmic dust grains; prominent 4.25 μm stretching resonance observed in protostellar envelopes."
    },
    "CO": {
        "id": "CO",
        "name": "Carbon Monoxide (CO)",
        "formula": "CO",
        "category": "Molecular Gas Tracer",
        "primary_bands_um": [2.35, 4.60],
        "default_colormap": "inferno",
        "accent_color": "#fb923c",
        "column_scale_prefix": "10¹⁷",
        "description": "Second most abundant molecule in the cosmos after H₂; primary kinematic tracer of molecular clouds, stellar winds, and protoplanetary accretion."
    },
    "H": {
        "id": "H",
        "name": "Hydrogen (Atomic & Molecular H/H₂)",
        "formula": "H / H₂",
        "category": "Primordial Gas & Recombination",
        "primary_bands_um": [2.12, 4.05],
        "default_colormap": "magma",
        "accent_color": "#a855f7",
        "column_scale_prefix": "10¹⁹",
        "description": "Primary cosmic building block; Brackett-α (4.05 μm) and molecular H₂ (2.12 μm) highlight photoionized HII regions, stellar accretion, and shocked gas."
    },
    "DUST": {
        "id": "DUST",
        "name": "Silicates & PAH Dust Grains",
        "formula": "Silicate / PAH",
        "category": "Refractory Dust & Carbonaceous PAHs",
        "primary_bands_um": [3.10, 3.40, 4.20],
        "default_colormap": "copper",
        "accent_color": "#f43f5e",
        "column_scale_prefix": "10¹⁶",
        "description": "Refractory silicate mineral dust and polycyclic aromatic hydrocarbon (PAH) infrared emission bands tracing circumstellar discs and star formation."
    }
}

# Expanded Wavelength & Narrow-Band Filters
WAVELENGTH_FILTERS = {
    # 1. Multi-Band Stacking & Composites
    "stacked": {
        "name": "All 102 Bands Stacked (High SNR)",
        "category": "composite",
        "wavelength_um": "0.75 - 5.00",
        "description": "Co-adds all 102 channels to boost signal-to-noise by sqrt(102) ~ 10x for ultra-faint sources."
    },
    "false_color_rgb": {
        "name": "False-Color Composite (Short+Mid+Long IR)",
        "category": "composite",
        "wavelength_um": "0.75 - 5.00",
        "description": "Three-color composite: Blue = 0.75-1.5 um, Green = 1.5-3.0 um, Red = 3.0-5.0 um."
    },
    # 2. Detector Arrays
    "array_1": {"name": "Array 1: 0.75 - 1.11 μm", "category": "detector", "wavelength_um": "0.75 - 1.11", "description": "Near-IR 1: Stellar photospheres and foreground field stars."},
    "array_2": {"name": "Array 2: 1.11 - 1.64 μm", "category": "detector", "wavelength_um": "1.11 - 1.64", "description": "Near-IR 2: 2MASS J & H band overlap, 1.4 um water absorption."},
    "array_3": {"name": "Array 3: 1.64 - 2.42 μm", "category": "detector", "wavelength_um": "1.64 - 2.42", "description": "Near-IR 3: 1.66 um methane overtone, 1.9 um water vapor, 2.15 um Ks continuum."},
    "array_4": {"name": "Array 4: 2.42 - 3.82 μm", "category": "detector", "wavelength_um": "2.42 - 3.82", "description": "Mid-IR 1: Deep 3.05 um water ice, 3.30 um fundamental methane dip."},
    "array_5": {"name": "Array 5: 3.82 - 4.42 μm", "category": "detector", "wavelength_um": "3.82 - 4.42", "description": "Mid-IR 2: 4.05 um Brackett-alpha hydrogen line, 4.25 um CO2 ice."},
    "array_6": {"name": "Array 6: 4.42 - 5.00 μm", "category": "detector", "wavelength_um": "4.42 - 5.00", "description": "Mid-IR 3: 4.60 um CO fundamental bandhead, peak cool brown dwarf thermal flux."},
    # 3. Elemental / Molecular Diagnostics
    "filter_h2o_ice": {"name": "💧 H₂O Ice Filter (3.05 μm)", "category": "diagnostic", "wavelength_um": 3.032, "band_index": 59, "element": "H2O", "description": "Targets deep 3.05 μm water ice absorption mantle on interstellar dust grains."},
    "filter_h2o_vapor": {"name": "💧 H₂O Vapor Filter (1.90 μm)", "category": "diagnostic", "wavelength_um": 1.884, "band_index": 40, "element": "H2O", "description": "Captures 1.90 μm atmospheric water vapor in cool stellar and brown dwarf atmospheres."},
    "filter_ch4_deep": {"name": "🪐 CH₄ Methane Filter (3.30 μm)", "category": "diagnostic", "wavelength_um": 3.295, "band_index": 62, "element": "CH4", "description": "Crucial marker for brown dwarf classification: cold T/Y dwarfs drop dramatically in flux at 3.30 μm."},
    "filter_ch4_overtone": {"name": "🪐 CH₄ Overtone Filter (1.66 μm)", "category": "diagnostic", "wavelength_um": 1.640, "band_index": 34, "element": "CH4", "description": "Detects 1.66 μm overtone absorption in substellar methane atmospheres."},
    "filter_co2_ice": {"name": "💨 CO₂ Ice Filter (4.25 μm)", "category": "diagnostic", "wavelength_um": 4.232, "band_index": 80, "element": "CO2", "description": "Isolates the 4.25 μm bending/stretching mode of solid carbon dioxide ice."},
    "filter_co": {"name": "☁️ CO Carbon Monoxide (4.60 μm)", "category": "diagnostic", "wavelength_um": 4.601, "band_index": 91, "element": "CO", "description": "Observes 4.60 μm fundamental carbon monoxide bandhead in interstellar gas clouds."},
    "filter_h_bra": {"name": "⚡ H Brackett-α (4.05 μm)", "category": "diagnostic", "wavelength_um": 4.045, "band_index": 75, "element": "H", "description": "Hydrogen recombination emission tracing accretion shocks and ionized nebulae."},
    "filter_pah_dust": {"name": "✨ Silicate & PAH Dust (3.40 μm)", "category": "diagnostic", "wavelength_um": 3.382, "band_index": 63, "element": "DUST", "description": "Traces 3.4 μm polycyclic aromatic hydrocarbon emission from protoplanetary disks."},
    # 4. Standard Photometric Bands
    "filter_j": {"name": "2MASS J-Band (1.25 μm)", "category": "photometric", "wavelength_um": 1.243, "band_index": 22, "description": "Standard astronomical near-infrared J-band equivalent."},
    "filter_h": {"name": "2MASS H-Band (1.65 μm)", "category": "photometric", "wavelength_um": 1.640, "band_index": 34, "description": "Standard astronomical near-infrared H-band equivalent."},
    "filter_ks": {"name": "2MASS Ks-Band (2.15 μm)", "category": "photometric", "wavelength_um": 2.127, "band_index": 45, "description": "Standard astronomical Ks-band continuum reference."},
    "filter_wise_w1": {"name": "WISE W1 (3.40 μm)", "category": "photometric", "wavelength_um": 3.382, "band_index": 63, "description": "NASA WISE mission Channel 1 filter equivalent."},
    "filter_wise_w2": {"name": "WISE W2 (4.60 μm)", "category": "photometric", "wavelength_um": 4.601, "band_index": 91, "description": "NASA WISE mission Channel 2 filter equivalent (cool brown dwarf discovery band)."},
    # 5. Spectral Indices / Ratio
    "ratio_ch4": {"name": "CH₄ Absorption Index (F3.30 / F2.15)", "category": "index", "wavelength_um": "3.30 / 2.15", "description": "Flux ratio highlighting methane absorption in cold brown dwarfs relative to Ks continuum."},
    "ratio_h2o": {"name": "H₂O Absorption Index (F3.05 / F2.15)", "category": "index", "wavelength_um": "3.05 / 2.15", "description": "Flux ratio highlighting water ice features relative to reference continuum."},
    "diff_hydrogen": {"name": "H Brackett-α Excess (Line - Continuum)", "category": "index", "wavelength_um": "4.05 - 3.82", "description": "Continuum-subtracted pure hydrogen accretion line emission."}
}



class SPHERExDataLoader:
    """
    Data Loader & Scientific Cutout Generator for SPHEREx mission data.
    """

    def __init__(self, cache_dir: str = "data/cache"):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if not os.path.isabs(cache_dir):
            self.cache_dir = os.path.join(base_dir, cache_dir)
        else:
            self.cache_dir = cache_dir
        self.irsa_dir = os.path.join(self.cache_dir, "irsa")
        os.makedirs(self.irsa_dir, exist_ok=True)

    def _load_real_irsa_cutout(
        self,
        ra_deg: float,
        dec_deg: float,
        matched_preset: Optional[str] = None
    ) -> Optional[List[np.ndarray]]:
        """
        Attempts to load genuine NASA WISE FITS images for 4 survey bands/epochs.
        Returns a list of 4 float32 256x256 numpy arrays [w1, w2, w3, w4], or None if unavailable.
        """
        preset_map = {
            "WISE 0855": "wise_0855",
            "90377 Sedna": "sedna",
            "Luhman 16": "luhman_16",
            "Barnard's Star": "barnards_star"
        }
        target_slug = preset_map.get(matched_preset) if matched_preset else None

        raw_bands = []
        for band_num, band_name in [(1, "w1"), (2, "w2"), (3, "w3"), (4, "w4")]:
            fpath = None
            if target_slug:
                fpath = os.path.join(self.irsa_dir, f"{target_slug}_{band_name}.fits")
            else:
                fpath = os.path.join(self.irsa_dir, f"irsa_{round(ra_deg, 4)}_{round(dec_deg, 4)}_{band_name}.fits")

            # If not cached on disk, attempt a short-timeout live query to NASA IRSA FinderChart
            if not os.path.exists(fpath):
                try:
                    url = (
                        f"https://irsa.ipac.caltech.edu/applications/finderchart/servlet/api"
                        f"?mode=getImage&RA={ra_deg}&DEC={dec_deg}&subsetsize=3.0"
                        f"&thumbnail_size=medium&survey=wise&wise_bands={band_num}&type=fitsurl"
                    )
                    r = requests.get(url, timeout=3.5)
                    if r.status_code == 200 and len(r.content) > 1000:
                        with open(fpath, "wb") as f:
                            f.write(r.content)
                except Exception:
                    pass

            if os.path.exists(fpath):
                try:
                    with fits.open(fpath) as hdul:
                        data = hdul[0].data.astype(np.float32)
                        data = np.nan_to_num(data, nan=float(np.nanmedian(data)))
                        if data.shape != (256, 256):
                            sy = 256.0 / data.shape[0]
                            sx = 256.0 / data.shape[1]
                            data = zoom(data, (sy, sx), order=1)
                        raw_bands.append(data)
                except Exception:
                    pass

        if len(raw_bands) == 4:
            return raw_bands
        return None

    def _get_coordinate_seed(self, ra_deg: float, dec_deg: float) -> int:
        """Derive a reproducible deterministic integer seed from coordinates."""
        key = f"{round(ra_deg, 4)}_{round(dec_deg, 4)}"
        return int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16)

    def _generate_gaussian_psf(
        self,
        grid_shape: Tuple[int, int],
        center_y: float,
        center_x: float,
        amplitude: float,
        fwhm: float = 3.5
    ) -> np.ndarray:
        """Creates a 2D Gaussian point spread function (PSF) representing a star."""
        sigma = fwhm / 2.3548
        y = np.arange(grid_shape[0], dtype=np.float32)
        x = np.arange(grid_shape[1], dtype=np.float32)
        yy, xx = np.meshgrid(y, x, indexing="ij")
        kernel = amplitude * np.exp(-((xx - center_x)**2 + (yy - center_y)**2) / (2.0 * sigma**2))
        return kernel

    def _generate_102_band_spectrum(
        self,
        target_name: Optional[str],
        seed: int
    ) -> List[Dict[str, float]]:
        """
        Generates realistic 102-band near-infrared spectral energy distribution (SED).
        Models molecular absorption bands for Brown Dwarfs (CH4, H2O, CO) or
        blackbody continua for variable and main-sequence stars.
        """
        rng = np.random.RandomState(seed)
        waves = SPHEREX_WAVELENGTHS
        spectrum = []

        is_brown_dwarf = target_name in ["WISE 0855", "Epsilon Indi B", "Luhman 16"]
        is_variable = target_name in ["RW Aurigae", "R Draconis"]
        is_tno = target_name in ["90377 Sedna"]

        for i, w in enumerate(waves):
            if is_brown_dwarf:
                # Ultra-cool brown dwarf continuum peaking in 4-5 um
                base_flux = 0.5 * (w / 3.0)**2.5
                # Water absorption at 1.4 um and 1.9 um
                h2o_abs = 0.65 * np.exp(-((w - 1.4)**2) / 0.04) + 0.75 * np.exp(-((w - 1.9)**2) / 0.05)
                # Methane (CH4) absorption at 1.66 um and deep 3.3 um
                ch4_abs = 0.55 * np.exp(-((w - 1.66)**2) / 0.03) + 0.85 * np.exp(-((w - 3.3)**2) / 0.12)
                # CO absorption at 4.6 um
                co_abs = 0.40 * np.exp(-((w - 4.6)**2) / 0.08)
                flux = max(0.08, base_flux * (1.0 - h2o_abs - ch4_abs - co_abs) + rng.normal(0, 0.03))
            elif is_tno:
                # Solar reflectance spectrum with water and methane ice absorption (outer solar system body / Planet X analog)
                base_flux = 1.8 * (w / 1.5)**(-0.8)
                ice_abs = 0.50 * np.exp(-((w - 1.5)**2) / 0.06) + 0.60 * np.exp(-((w - 2.0)**2) / 0.08) + 0.70 * np.exp(-((w - 3.05)**2) / 0.15)
                flux = max(0.05, base_flux * (1.0 - ice_abs) + rng.normal(0, 0.02))
            elif is_variable:
                # Young or pulsating star with infrared excess from circumstellar dust
                base_flux = 3.5 * (2.0 / w)**1.2
                silicate_excess = 1.2 * np.exp(-((w - 4.2)**2) / 0.3)
                flux = max(0.1, base_flux + silicate_excess + rng.normal(0, 0.05))
            else:
                # Standard stellar blackbody
                t_eff = 4500  # Kelvin
                # Planck function approximation
                planck = (1.0 / (w**5)) / (np.exp(14387.7 / (w * t_eff)) - 1.0) * 1e5
                flux = float(planck) + rng.normal(0, 0.04)

            # Assign detector array group
            if w <= 1.11:
                array_id = 1
            elif w <= 1.64:
                array_id = 2
            elif w <= 2.42:
                array_id = 3
            elif w <= 3.82:
                array_id = 4
            elif w <= 4.42:
                array_id = 5
            else:
                array_id = 6

            spectrum.append({
                "band_index": i + 1,
                "wavelength_um": round(float(w), 3),
                "flux": round(float(flux), 3),
                "detector_array": array_id
            })

        return spectrum

    def generate_element_densities(
        self,
        coord_info: Dict[str, Any],
        seed: int,
        target_pos: Tuple[float, float] = (128.0, 128.0),
        dim: int = 256,
        bg_stars: Optional[List[Tuple[float, float, float, float]]] = None
    ) -> Dict[str, Any]:
        """
        Generates 2D spatial elemental & molecular column density maps across the sky patch.
        Simulates astrophysical abundances for Water (H2O), Methane (CH4), Carbon Dioxide (CO2),
        Carbon Monoxide (CO), Hydrogen (H/H2), and Silicate/PAH Dust grains.

        Returns high-contrast standalone Base64 maps and translucent RGBA overlay maps.
        """
        matched_target = coord_info.get("matched_preset")
        tx, ty = target_pos

        # 1. Base diffuse ISM gas & dust column density field (fractal multi-scale clouds)
        ism_rng = np.random.RandomState(seed + 888)
        raw_field = ism_rng.uniform(0.0, 1.0, size=(dim, dim)).astype(np.float32)
        cloud_large = gaussian_filter(raw_field, sigma=15.0)
        cloud_small = gaussian_filter(raw_field, sigma=5.0)
        ism_cloud = 0.7 * cloud_large + 0.3 * cloud_small
        ism_cloud = (ism_cloud - ism_cloud.min()) / max(ism_cloud.max() - ism_cloud.min(), 1e-6)

        # 2. Define target-specific elemental abundance profiles
        # [amp, sigma_px, column_density_str, abundance_pct, snr]
        if matched_target == "WISE 0855":
            profiles = {
                "CH4":  (0.96, 4.2, "2.15 × 10¹⁸ cm⁻²", 38.5, 26.4),
                "H2O":  (0.88, 4.2, "1.95 × 10¹⁸ cm⁻²", 34.2, 22.8),
                "H":    (0.32, 4.2, "5.40 × 10¹⁸ cm⁻²", 15.1, 14.0),
                "CO":   (0.08, 4.2, "4.20 × 10¹⁶ cm⁻²", 3.4, 4.5),
                "CO2":  (0.06, 4.2, "2.80 × 10¹⁶ cm⁻²", 2.6, 3.8),
                "DUST": (0.10, 4.2, "3.10 × 10¹⁵ cm⁻²", 6.2, 6.1)
            }
        elif matched_target == "Barnard's Star":
            profiles = {
                "H":    (0.96, 3.8, "4.80 × 10¹⁹ cm⁻²", 68.5, 34.2),
                "H2O":  (0.52, 3.8, "9.10 × 10¹⁷ cm⁻²", 15.2, 18.5),
                "CO":   (0.45, 3.8, "6.40 × 10¹⁷ cm⁻²", 10.1, 15.2),
                "DUST": (0.12, 3.8, "2.20 × 10¹⁵ cm⁻²", 3.1, 5.5),
                "CH4":  (0.04, 3.8, "1.20 × 10¹⁶ cm⁻²", 1.5, 2.8),
                "CO2":  (0.05, 3.8, "1.80 × 10¹⁶ cm⁻²", 1.6, 3.1)
            }
        elif matched_target == "Epsilon Indi B":
            profiles = {
                "CH4":  (0.92, 4.0, "1.85 × 10¹⁸ cm⁻²", 36.0, 24.5),
                "H2O":  (0.85, 4.0, "1.60 × 10¹⁸ cm⁻²", 33.5, 21.0),
                "H":    (0.38, 4.0, "7.20 × 10¹⁸ cm⁻²", 17.2, 16.0),
                "CO":   (0.12, 4.0, "6.50 × 10¹⁶ cm⁻²", 4.8, 6.2),
                "CO2":  (0.07, 4.0, "3.20 × 10¹⁶ cm⁻²", 3.1, 4.1),
                "DUST": (0.11, 4.0, "3.80 × 10¹⁵ cm⁻²", 5.4, 6.8)
            }
        elif matched_target == "RW Aurigae":
            profiles = {
                "DUST": (0.96, 7.5, "9.60 × 10¹⁶ cm⁻²", 36.2, 27.5),
                "H":    (0.92, 3.5, "3.40 × 10¹⁹ cm⁻²", 35.0, 31.2),
                "CO":   (0.76, 6.0, "1.50 × 10¹⁸ cm⁻²", 18.5, 21.0),
                "H2O":  (0.32, 4.0, "3.60 × 10¹⁷ cm⁻²", 6.5, 11.2),
                "CO2":  (0.09, 4.0, "4.50 × 10¹⁶ cm⁻²", 2.1, 4.8),
                "CH4":  (0.06, 4.0, "2.10 × 10¹⁶ cm⁻²", 1.7, 3.5)
            }
        elif matched_target == "R Draconis":
            profiles = {
                "H2O":  (0.92, 5.0, "3.10 × 10¹⁸ cm⁻²", 35.4, 28.0),
                "CO":   (0.86, 5.0, "2.30 × 10¹⁸ cm⁻²", 27.6, 24.5),
                "H":    (0.78, 4.0, "2.60 × 10¹⁹ cm⁻²", 23.5, 25.2),
                "DUST": (0.64, 6.5, "4.80 × 10¹⁶ cm⁻²", 9.5, 17.0),
                "CO2":  (0.12, 4.0, "5.80 × 10¹⁶ cm⁻²", 2.2, 5.5),
                "CH4":  (0.08, 4.0, "2.50 × 10¹⁶ cm⁻²", 1.8, 4.2)
            }
        else:
            # Deterministic profile for arbitrary coordinates
            has_substellar = (seed % 3 == 0)
            if has_substellar:
                profiles = {
                    "CH4":  (0.85, 4.0, "1.45 × 10¹⁸ cm⁻²", 32.5, 20.4),
                    "H2O":  (0.82, 4.0, "1.55 × 10¹⁸ cm⁻²", 31.2, 19.8),
                    "H":    (0.42, 4.0, "8.10 × 10¹⁸ cm⁻²", 19.5, 15.5),
                    "CO":   (0.14, 4.0, "7.80 × 10¹⁶ cm⁻²", 6.4, 7.2),
                    "DUST": (0.16, 4.0, "4.50 × 10¹⁵ cm⁻²", 7.1, 7.8),
                    "CO2":  (0.08, 4.0, "3.90 × 10¹⁶ cm⁻²", 3.3, 4.6)
                }
            else:
                profiles = {
                    "H":    (0.90, 3.5, "3.60 × 10¹⁹ cm⁻²", 62.0, 30.0),
                    "H2O":  (0.40, 3.5, "7.20 × 10¹⁷ cm⁻²", 14.5, 16.2),
                    "CO":   (0.38, 3.5, "5.10 × 10¹⁷ cm⁻²", 11.2, 13.5),
                    "DUST": (0.18, 4.5, "3.20 × 10¹⁵ cm⁻²", 6.8, 8.4),
                    "CO2":  (0.06, 3.5, "2.10 × 10¹⁶ cm⁻²", 3.2, 4.8),
                    "CH4":  (0.05, 3.5, "1.50 × 10¹⁶ cm⁻²", 2.3, 3.9)
                }

        elements_result = {}
        composition_breakdown = []

        y_grid, x_grid = np.ogrid[:dim, :dim]

        for elem_key, elem_def in ELEMENT_DEFINITIONS.items():
            amp, sigma, col_density_str, abundance_pct, snr = profiles[elem_key]

            # Interstellar cloud baseline fraction for this element
            ism_weights = {"H": 0.35, "H2O": 0.20, "CO": 0.22, "DUST": 0.25, "CO2": 0.12, "CH4": 0.08}
            elem_ism = ism_cloud * ism_weights.get(elem_key, 0.15)

            # Localized target peak
            target_peak = amp * np.exp(-((x_grid - tx)**2 + (y_grid - ty)**2) / (2.0 * sigma**2))

            # Companion peak for Epsilon Indi B
            if matched_target == "Epsilon Indi B" and elem_key in ["CH4", "H2O"]:
                comp_x, comp_y = tx + 8.5, ty - 6.0
                comp_peak = (amp * 0.7) * np.exp(-((x_grid - comp_x)**2 + (y_grid - comp_y)**2) / (2.0 * (sigma * 0.9)**2))
                target_peak += comp_peak

            # Stellar atmosphere contributions from background stars
            bg_star_contrib = np.zeros((dim, dim), dtype=np.float32)
            if bg_stars:
                star_weights = {"H": 0.7, "H2O": 0.25, "CO": 0.20, "DUST": 0.08, "CO2": 0.05, "CH4": 0.03}
                w = star_weights.get(elem_key, 0.1)
                for bx, by, b_amp, b_fwhm in bg_stars[:15]:
                    b_sig = b_fwhm / 2.3548
                    bg_star_contrib += (b_amp * 0.02 * w) * np.exp(-((x_grid - bx)**2 + (y_grid - by)**2) / (2.0 * b_sig**2))

            # Composite 2D density
            total_density = elem_ism + target_peak + bg_star_contrib
            total_density = np.clip(total_density, 0.0, 1.0)

            # Generate high-contrast standalone map & translucent overlay
            cmap_name = elem_def["default_colormap"]
            density_map_url = image_processor.density_array_to_base64(total_density, colormap=cmap_name)
            overlay_map_url = image_processor.density_array_to_base64(total_density, colormap=cmap_name, is_overlay=True)

            elements_result[elem_key] = {
                "id": elem_key,
                "name": elem_def["name"],
                "formula": elem_def["formula"],
                "category": elem_def["category"],
                "primary_bands_um": elem_def["primary_bands_um"],
                "density_map_url": density_map_url,
                "overlay_map_url": overlay_map_url,
                "peak_column_density": col_density_str,
                "peak_density_normalized": round(float(np.max(total_density)), 3),
                "mean_density_normalized": round(float(np.mean(total_density)), 3),
                "abundance_pct": round(float(abundance_pct), 1),
                "snr": round(float(snr), 1),
                "colormap": cmap_name,
                "accent_color": elem_def["accent_color"],
                "description": elem_def["description"]
            }

            composition_breakdown.append({
                "element": elem_key,
                "name": elem_def["name"],
                "formula": elem_def["formula"],
                "abundance_pct": round(float(abundance_pct), 1),
                "color": elem_def["accent_color"]
            })

        # Sort composition breakdown by abundance descending
        composition_breakdown.sort(key=lambda x: x["abundance_pct"], reverse=True)

        return {
            "elements": elements_result,
            "composition_breakdown": composition_breakdown
        }

    def get_sky_patch(
        self,
        ra_input: str,
        dec_input: str,
        fov_arcmin: float = 5.0,
        band_group: str = "stacked",
        stretch: str = "zscale",
        colormap: str = "inferno",
        num_epochs: int = 4
    ) -> Dict[str, Any]:
        """
        Primary interface to fetch multi-epoch images, difference image, and
        spectral data for a sky patch.

        Parameters:
          ra_input: Right Ascension sexagesimal or decimal string.
          dec_input: Declination sexagesimal or decimal string.
          fov_arcmin: Field of view in arcminutes (default: 5.0).
          band_group: "stacked", "array_1".."array_6", or "false_color_rgb".
          stretch: Contrast stretch ("zscale", "asinh", "linear", "log").
          colormap: Colormap ("inferno", "viridis", "magma", "grayscale").
          num_epochs: Number of 6-month survey epochs to return (1 to 4).

        Returns:
          Structured dictionary conforming to the frontend API contract.
        """
        coord_info = coordinates.parse_coordinates(ra_input, dec_input)
        ra_deg = coord_info["ra_deg"]
        dec_deg = coord_info["dec_deg"]
        matched_target = coord_info.get("matched_preset")

        # Derive simulation parameters based on coordinates / preset match
        seed = self._get_coordinate_seed(ra_deg, dec_deg)
        rng = np.random.RandomState(seed)

        # Cutout dimensions (256x256 pixels default)
        dim = 256
        center_x, center_y = dim / 2.0, dim / 2.0

        # Scale star count and spatial distribution with FOV
        # Base FOV reference is 5.0 arcmin. As FOV widens, area scales with (fov / 5)^2
        fov_scale = max(float(fov_arcmin) / 5.0, 0.2)
        base_density = 75 if matched_target in ["North Ecliptic Pole", "South Ecliptic Pole"] else 35
        # Scale number of stars with square root to prevent excessive crowding while scaling area
        n_background_stars = int(base_density * min(max(fov_scale ** 0.85, 0.4), 6.0))

        bg_stars = []
        for _ in range(n_background_stars):
            bx = rng.uniform(4, dim - 4)
            by = rng.uniform(4, dim - 4)
            b_amp = rng.exponential(scale=15.0) + 2.0
            # Source apparent size shrinks slightly in wider field of view
            b_fwhm = max(rng.uniform(2.4, 3.4) / (fov_scale ** 0.25), 1.6)
            bg_stars.append((bx, by, b_amp, b_fwhm))

        epochs_data = []
        epoch_raw_arrays = []

        # Target motion / variability profile (scales inverse to FOV in pixels)
        # In larger FOV, same physical proper motion in arcsec spans fewer pixels: motion_px = base_motion * (5.0 / fov)
        motion_scale = 1.0 / fov_scale
        target_fwhm = max(3.2 / (fov_scale ** 0.25), 1.8)
        target_proper_motion = (0.0, 0.0)
        target_flux_series = [15.0, 15.0, 15.0, 15.0]

        # Target astrophysical categorization
        is_cool_target = matched_target in ["WISE 0855", "Epsilon Indi B", "Luhman 16"]
        is_young_star = matched_target == "RW Aurigae"
        is_pulsator = matched_target == "R Draconis"
        is_tno_target = matched_target == "90377 Sedna"

        # Attempt to load genuine NASA WISE FITS cutouts from IRSA
        real_nasa_bands = None
        if band_group in ["stacked", "false_color_rgb", "filter_wise_w1", "filter_wise_w2", ""]:
            real_nasa_bands = self._load_real_irsa_cutout(ra_deg, dec_deg, matched_preset=matched_target)

        if real_nasa_bands is not None:
            wise_labels = [
                "WISE W1 (3.4 µm)",
                "WISE W2 (4.6 µm)",
                "WISE W3 (12.0 µm)",
                "WISE W4 (22.0 µm)"
            ]
            wise_timestamps = [
                "2010-01-14 (WISE W1 3.4µm)",
                "2010-03-22 (WISE W2 4.6µm)",
                "2010-05-18 (WISE W3 12.0µm)",
                "2010-07-09 (WISE W4 22.0µm)"
            ]
            for ep_idx in range(min(num_epochs, 4)):
                if band_group == "false_color_rgb":
                    raw_epoch = (real_nasa_bands[0], real_nasa_bands[1], real_nasa_bands[2])
                    rgb_arr = image_processor.create_false_color_composite(
                        raw_epoch[0], raw_epoch[1], raw_epoch[2], stretch_type=stretch
                    )
                    image_uri = image_processor.array_to_base64_data_uri(rgb_arr, stretch_type=stretch)
                elif band_group == "filter_wise_w1":
                    raw_epoch = real_nasa_bands[0]
                    image_uri = image_processor.array_to_base64_data_uri(raw_epoch, colormap=colormap, stretch_type=stretch)
                elif band_group == "filter_wise_w2":
                    raw_epoch = real_nasa_bands[1]
                    image_uri = image_processor.array_to_base64_data_uri(raw_epoch, colormap=colormap, stretch_type=stretch)
                else:
                    raw_epoch = real_nasa_bands[ep_idx]
                    image_uri = image_processor.array_to_base64_data_uri(raw_epoch, colormap=colormap, stretch_type=stretch)

                epoch_raw_arrays.append(raw_epoch)
                epochs_data.append({
                    "epoch_id": f"epoch_{ep_idx + 1}",
                    "band_name": wise_labels[ep_idx],
                    "timestamp": wise_timestamps[ep_idx],
                    "image_url": image_uri,
                    "contamination_flag": False,
                    "is_real_data": True,
                    "target_pixel_coords": [128.0, 128.0]
                })
        else:
            if matched_target == "WISE 0855":
                target_proper_motion = (7.5, -4.2)
                target_flux_series = [12.0, 12.5, 11.8, 12.2]
            elif matched_target == "Barnard's Star":
                target_proper_motion = (1.5, 6.0)
                target_flux_series = [45.0, 44.8, 45.2, 45.0]
            elif matched_target == "Epsilon Indi B":
                target_proper_motion = (3.8, 4.0)
                target_flux_series = [18.0, 18.2, 17.9, 18.1]
            elif matched_target == "RW Aurigae":
                target_proper_motion = (0.0, 0.0)
                target_flux_series = [35.0, 6.0, 28.0, 9.0]  # Dramatic dust occultations
            elif matched_target == "R Draconis":
                target_proper_motion = (0.0, 0.0)
                target_flux_series = [40.0, 8.0, 42.0, 7.5]  # Mira pulsations
            elif matched_target == "90377 Sedna":
                target_proper_motion = (1.8, 1.0)  # Slow outer Solar System drift across 6-month survey cadences
                target_flux_series = [10.5, 10.8, 10.2, 10.6]  # Faint TNO Planet X analog
            elif matched_target == "Luhman 16":
                target_proper_motion = (-4.8, 1.5)  # Nearby high proper motion brown dwarf binary
                target_flux_series = [32.0, 30.5, 33.2, 31.0]  # Atmospheric cloud patchiness
            elif matched_target in ["North Ecliptic Pole", "South Ecliptic Pole"]:
                target_proper_motion = (0.0, 0.0)
                target_flux_series = [18.0, 18.0, 18.0, 18.0]
            else:
                # Deterministic small drift for serendipitous asteroid discovery
                has_fast_mover = (seed % 3 == 0)
                if has_fast_mover:
                    target_proper_motion = ((seed % 7) - 3.5, ((seed >> 3) % 7) - 3.5)
                target_flux_series = [14.0, 14.2, 13.9, 14.1]

            # Generate each epoch image
            for ep_idx in range(min(num_epochs, 4)):
                epoch_rng = np.random.RandomState(seed + 100 * (ep_idx + 1))
                date_str = EPOCH_DATES[ep_idx]

                # 1. Base detector background noise (Gaussian + Zodiacal infrared background)
                bg_noise = epoch_rng.normal(loc=1.2, scale=0.4, size=(dim, dim)).astype(np.float32)

                # 2. Add static background stars
                star_canvas = np.zeros((dim, dim), dtype=np.float32)
                for bx, by, b_amp, b_fwhm in bg_stars:
                    star_canvas += self._generate_gaussian_psf((dim, dim), by, bx, b_amp, b_fwhm)

                # 3. Add target source
                tx = center_x + ep_idx * target_proper_motion[0] * motion_scale
                ty = center_y + ep_idx * target_proper_motion[1] * motion_scale
                t_flux = target_flux_series[ep_idx]
                star_canvas += self._generate_gaussian_psf((dim, dim), ty, tx, t_flux, fwhm=target_fwhm)

                # Special case for Epsilon Indi B binary companion
                if matched_target == "Epsilon Indi B":
                    comp_x = tx + 8.5 * motion_scale
                    comp_y = ty - 6.0 * motion_scale
                    comp_flux = t_flux * 0.7
                    star_canvas += self._generate_gaussian_psf((dim, dim), comp_y, comp_x, comp_flux, fwhm=target_fwhm * 0.95)

                # Special case for Luhman 16 binary companion
                if matched_target == "Luhman 16":
                    comp_x = tx + 5.2 * motion_scale
                    comp_y = ty + 3.8 * motion_scale
                    comp_flux = t_flux * 0.85
                    star_canvas += self._generate_gaussian_psf((dim, dim), comp_y, comp_x, comp_flux, fwhm=target_fwhm * 0.92)

                # Multi-band / Detector Array / Narrow-band Filter simulation
                is_cool_target = matched_target in ["WISE 0855", "Epsilon Indi B", "Luhman 16"]
                is_young_star = matched_target == "RW Aurigae"
                is_pulsator = matched_target == "R Draconis"
                is_tno_target = matched_target == "90377 Sedna"

                if band_group.startswith("array_"):
                    array_num = int(band_group.split("_")[1])
                    # Near-IR brown dwarfs look brighter in Array 4-6, fainter in Array 1
                    if is_cool_target:
                        band_multiplier = 0.3 + 0.25 * array_num
                    else:
                        band_multiplier = 1.4 - 0.12 * array_num
                    raw_epoch = (bg_noise + star_canvas * band_multiplier).astype(np.float32)
                elif band_group == "false_color_rgb":
                    # Create short, mid, and long band planes
                    short_plane = bg_noise + star_canvas * 0.5
                    mid_plane = bg_noise + star_canvas * 1.0
                    long_plane = bg_noise + star_canvas * 1.5
                    raw_epoch = (short_plane, mid_plane, long_plane)
                elif band_group == "filter_ch4_deep":  # 3.30 μm fundamental methane absorption
                    mult = 0.20 if is_tno_target else (0.15 if is_cool_target else 1.0)
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_ch4_overtone":  # 1.66 μm overtone
                    mult = 0.40 if is_cool_target else 1.0
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_h2o_ice":  # 3.05 μm water ice
                    mult = 0.25 if is_tno_target else (0.30 if is_cool_target else (0.70 if is_pulsator else 0.95))
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_h2o_vapor":  # 1.90 μm water vapor
                    mult = 0.45 if is_cool_target else (0.75 if is_pulsator else 0.95)
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_co2_ice":  # 4.25 μm CO2 ice
                    mult = 0.85
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_co":  # 4.60 μm CO bandhead
                    mult = 1.70 if is_cool_target else (1.45 if is_pulsator else 1.20)
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_h_bra":  # 4.05 μm Hydrogen Brackett-alpha
                    mult = 2.50 if is_young_star else 1.05
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_pah_dust":  # 3.40 μm PAH dust emission
                    mult = 2.40 if is_young_star else 1.10
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_j":  # 1.25 μm
                    mult = 0.45 if is_cool_target else 1.20
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_h":  # 1.65 μm
                    mult = 0.65 if is_cool_target else 1.15
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_ks":  # 2.15 μm
                    mult = 0.85 if is_cool_target else 1.05
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_wise_w1":  # 3.40 μm
                    mult = 0.90 if is_cool_target else 1.00
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "filter_wise_w2":  # 4.60 μm
                    mult = 1.85 if is_cool_target else 0.90
                    raw_epoch = (bg_noise + star_canvas * mult).astype(np.float32)
                elif band_group == "ratio_ch4":  # F(3.30) / F(2.15)
                    plane_num = bg_noise + star_canvas * (0.15 if is_cool_target else 1.0)
                    plane_den = bg_noise + star_canvas * (0.85 if is_cool_target else 1.05)
                    raw_epoch = image_processor.compute_spectral_ratio(plane_num, plane_den)
                elif band_group == "ratio_h2o":  # F(3.05) / F(2.15)
                    plane_num = bg_noise + star_canvas * (0.25 if is_tno_target else (0.30 if is_cool_target else 0.95))
                    plane_den = bg_noise + star_canvas * (0.85 if is_cool_target else 1.05)
                    raw_epoch = image_processor.compute_spectral_ratio(plane_num, plane_den)
                elif band_group == "diff_hydrogen":  # F(4.05) - F(3.82)
                    plane_line = bg_noise + star_canvas * (2.50 if is_young_star else 1.05)
                    plane_cont = bg_noise + star_canvas * 1.0
                    raw_epoch = image_processor.compute_line_minus_continuum(plane_line, plane_cont)
                elif band_group.startswith("band_"):
                    # Individual SPHEREx channel 1 to 102
                    try:
                        b_num = int(band_group.split("_")[1])
                        b_idx = max(0, min(101, b_num - 1))
                        w = SPHEREX_WAVELENGTHS[b_idx]
                        if is_cool_target:
                            t_mult = float(0.35 * (w / 3.0)**2.5)
                            if 3.1 <= w <= 3.5:
                                t_mult *= 0.15
                            elif 1.35 <= w <= 1.45 or 1.85 <= w <= 1.95:
                                t_mult *= 0.35
                        elif is_young_star:
                            t_mult = float(1.2 + 0.9 * np.exp(-((w - 4.05)**2) / 0.05))
                        else:
                            t_mult = float(1.4 - 0.12 * w)
                        t_mult = max(0.08, t_mult)
                        raw_epoch = (bg_noise + star_canvas * t_mult).astype(np.float32)
                    except Exception:
                        raw_epoch = (bg_noise + star_canvas).astype(np.float32)
                else:
                    # "stacked" across all 102 channels (SNR boosted by sqrt(102) ~ 10x)
                    stacked_noise = epoch_rng.normal(loc=1.2, scale=0.15, size=(dim, dim)).astype(np.float32)
                    raw_epoch = (stacked_noise + star_canvas).astype(np.float32)

                epoch_raw_arrays.append(raw_epoch)

                # Render epoch to PNG / Data URI
                if band_group == "false_color_rgb":
                    rgb_arr = image_processor.create_false_color_composite(
                        raw_epoch[0], raw_epoch[1], raw_epoch[2], stretch_type=stretch
                    )
                    image_uri = image_processor.array_to_base64_data_uri(rgb_arr, stretch_type=stretch)
                else:
                    image_uri = image_processor.array_to_base64_data_uri(
                        raw_epoch,
                        colormap=colormap,
                        stretch_type=stretch
                    )

                # Contamination check (e.g. proximity to edges or synthetic artifact)
                contamination_flag = False
                if ep_idx == 2 and seed % 7 == 0:
                    contamination_flag = True  # Occasional cosmic ray strike flag

                epochs_data.append({
                    "epoch_id": f"epoch_{ep_idx + 1}",
                    "timestamp": date_str,
                    "image_url": image_uri,
                    "contamination_flag": contamination_flag,
                    "target_pixel_coords": [round(float(tx), 1), round(float(ty), 1)],
                })

        # Compute scientific difference images across multiple epoch pairs
        diff_images_dict = {}
        pair_definitions = [
            ("e2_minus_e1", 0, 1),
            ("e3_minus_e1", 0, 2),
            ("e4_minus_e1", 0, 3),
            ("e3_minus_e2", 1, 2),
            ("e4_minus_e3", 2, 3),
        ]

        for pair_key, idx_early, idx_late in pair_definitions:
            if idx_late < len(epoch_raw_arrays) and idx_early < len(epoch_raw_arrays):
                if band_group == "false_color_rgb":
                    slice_late = epoch_raw_arrays[idx_late][1]
                    slice_early = epoch_raw_arrays[idx_early][1]
                else:
                    slice_late = epoch_raw_arrays[idx_late]
                    slice_early = epoch_raw_arrays[idx_early]
                d_arr = image_processor.compute_difference_image(slice_early, slice_late)
                diff_images_dict[pair_key] = image_processor.array_to_base64_data_uri(d_arr, is_difference=True)

        # Primary difference image URL for backward compatibility
        diff_uri = diff_images_dict.get("e2_minus_e1")
        if not diff_uri and diff_images_dict:
            diff_uri = list(diff_images_dict.values())[0]
        elif not diff_uri:
            diff_uri = image_processor.array_to_base64_data_uri(
                np.zeros_like(epoch_raw_arrays[0]), is_difference=True
            )

        # Shift-and-Add composite search stack (NASA Step 2 engine)
        if band_group == "false_color_rgb":
            planes_for_stack = [ep[1] for ep in epoch_raw_arrays]
        else:
            planes_for_stack = epoch_raw_arrays

        coadded_stationary = image_processor.perform_shift_and_add(planes_for_stack, 0.0, 0.0)
        coadded_stat_uri = image_processor.array_to_base64_data_uri(
            coadded_stationary, colormap=colormap, stretch_type=stretch
        )

        target_shift_x = 0.0
        target_shift_y = 0.0
        if is_cool_target:
            target_shift_x = 1.3
            target_shift_y = 0.7
        elif is_tno_target:
            target_shift_x = 0.25
            target_shift_y = 0.15

        coadded_target = image_processor.perform_shift_and_add(planes_for_stack, target_shift_x, target_shift_y)
        coadded_target_uri = image_processor.array_to_base64_data_uri(
            coadded_target, colormap=colormap, stretch_type=stretch
        )

        shift_and_add_data = {
            "stationary_stack_url": coadded_stat_uri,
            "target_stack_url": coadded_target_uri,
            "recommended_vx": target_shift_x,
            "recommended_vy": target_shift_y,
            "total_epochs_stacked": len(epoch_raw_arrays)
        }

        # 102-band spectral energy distribution preview
        spectrum = self._generate_102_band_spectrum(matched_target, seed)

        # Generate 2D spatial elemental & molecular density maps
        element_densities = self.generate_element_densities(
            coord_info=coord_info,
            seed=seed,
            target_pos=(center_x, center_y),
            dim=dim,
            bg_stars=bg_stars
        )

        # Filter metadata
        filter_meta = WAVELENGTH_FILTERS.get(band_group, {
            "name": f"SPHEREx Band #{band_group.split('_')[1]}" if band_group.startswith("band_") else band_group,
            "category": "single" if band_group.startswith("band_") else "custom",
            "wavelength_um": SPHEREX_WAVELENGTHS[int(band_group.split('_')[1]) - 1] if band_group.startswith("band_") else "custom"
        })

        # Cross-matched Gaia DR3 & AllWISE catalog overlay sources
        catalog_stars = catalog_service.query_catalogs(
            ra_deg=coord_info["ra_deg"],
            dec_deg=coord_info["dec_deg"],
            fov_arcmin=float(fov_arcmin)
        )

        return {
            "target_info": {
                "ra_deg": coord_info["ra_deg"],
                "dec_deg": coord_info["dec_deg"],
                "ra_hms": coord_info["ra_hms"],
                "dec_dms": coord_info["dec_dms"],
                "fov_arcmin": float(fov_arcmin),
                "matched_preset": matched_target,
                "band_group": band_group,
                "active_filter_meta": filter_meta,
                "stretch": stretch,
                "colormap": colormap,
                "is_real_data": real_nasa_bands is not None,
                "archive_source": "NASA IRSA (WISE Mission Archive)" if real_nasa_bands is not None else "SPHEREx Synthetic Pipeline (Calibrated)",
                "archive_telescope": "NASA Wide-field Infrared Survey Explorer (WISE)" if real_nasa_bands is not None else "NASA SPHEREx Mission Simulation",
                "archive_bands": ["W1 (3.4 µm)", "W2 (4.6 µm)", "W3 (12.0 µm)", "W4 (22.0 µm)"] if real_nasa_bands is not None else None,
            },
            "epochs": epochs_data,
            "difference_image_url": diff_uri,
            "difference_images": diff_images_dict,
            "shift_and_add": shift_and_add_data,
            "spectrum_preview": spectrum,
            "spherex_detector_arrays": SPHEREX_ARRAYS,
            "catalog_overlay": catalog_stars,
            "element_densities": element_densities,
            "available_filters": WAVELENGTH_FILTERS
        }

    def get_element_density(
        self,
        ra_input: str,
        dec_input: str,
        element: str = "H2O",
        fov_arcmin: float = 5.0
    ) -> Dict[str, Any]:
        """
        Retrieves dedicated elemental column density map and astrophysical telemetry
        for a specific molecule/element (H2O, CH4, CO2, CO, H, DUST).
        """
        coord_info = coordinates.parse_coordinates(ra_input, dec_input)
        seed = self._get_coordinate_seed(coord_info["ra_deg"], coord_info["dec_deg"])
        all_densities = self.generate_element_densities(
            coord_info=coord_info,
            seed=seed,
            target_pos=(128.0, 128.0),
            dim=256
        )

        elem_key = element.upper() if element.upper() in ELEMENT_DEFINITIONS else "H2O"
        elem_data = all_densities["elements"].get(elem_key, all_densities["elements"]["H2O"])

        return {
            "target_info": {
                "ra_deg": coord_info["ra_deg"],
                "dec_deg": coord_info["dec_deg"],
                "ra_hms": coord_info["ra_hms"],
                "dec_dms": coord_info["dec_dms"],
                "fov_arcmin": float(fov_arcmin),
                "matched_preset": coord_info.get("matched_preset")
            },
            "element": elem_data,
            "all_elements": all_densities["elements"],
            "composition_breakdown": all_densities["composition_breakdown"]
        }
