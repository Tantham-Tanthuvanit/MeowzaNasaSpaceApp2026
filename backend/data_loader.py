"""
data_loader.py — Real SPHEREx data from NASA/IPAC IRSA, cached in Supabase.

For a sky position the loader:
1. Asks IRSA's TAP service which SPHEREx spectral images (DR1/QR3) cover it.
2. Downloads, in the background (a few at a time), only the images a request needs:
   one per detector per visit for the flipbook (always first), or every image for a
   spectrum or narrow-band filter. Each cutout has the zodiacal light model subtracted,
   is reprojected onto one north-up grid centred on the position, and is stored in
   Supabase Storage with a row in sky_cutouts. Positions within half a pixel share a cache.
3. Builds flipbook frames (one per survey visit), difference images, narrow-band
   filter frames and a 102-channel spectrum from the cached images, and caches the
   finished responses in sky_results.

Until the images a request needs are cached, the loader raises NotReady with progress.
"""

import base64
import hashlib
import io
import itertools
import logging
import queue
import threading
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import astropy.units as u
import numpy as np
import requests
import scipy.ndimage as ndi
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from astroquery.ipac.irsa import Irsa
from reproject import reproject_interp

import coordinates
import image_processor
from supabase_client import BUCKET, get_client

log = logging.getLogger(__name__)
# SPHEREx headers carry SIP terms without a "-SIP" CTYPE; astropy logs that at INFO for every file.
logging.getLogger("astropy").setLevel(logging.WARNING)

IRSA_URL = "https://irsa.ipac.caltech.edu/"
HIPS_PROPERTIES_URL = "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/properties"
PIXEL_ARCSEC = 6.15          # SPHEREx pixel scale
DISPLAY_DIM = 256            # frames are shown at 256 x 256, so pixel coordinates stay 0-256
VISIT_GAP_DAYS = 10.0        # images further apart than this belong to different survey visits
DOWNLOAD_WORKERS = 4         # parallel IRSA downloads, kept low as a courtesy to IRSA
FILTER_HALF_WIDTH = 0.02     # a narrow-band filter takes images within +/-2% of its wavelength
SIGNED_URL_SECONDS = 6 * 3600
ALL_DETECTORS = [1, 2, 3, 4, 5, 6]


# SPHEREx Detector Array Layout (102 Near-IR Spectral Channels, 17 per detector)
SPHEREX_ARRAYS = {
    "array_1": {"name": "Array 1 (Near-IR 1)", "range_um": (0.75, 1.11), "bands": 17, "index": 1},
    "array_2": {"name": "Array 2 (Near-IR 2)", "range_um": (1.11, 1.64), "bands": 17, "index": 2},
    "array_3": {"name": "Array 3 (Near-IR 3)", "range_um": (1.64, 2.42), "bands": 17, "index": 3},
    "array_4": {"name": "Array 4 (Mid-IR 1)",  "range_um": (2.42, 3.82), "bands": 17, "index": 4},
    "array_5": {"name": "Array 5 (Mid-IR 2)",  "range_um": (3.82, 4.42), "bands": 17, "index": 5},
    "array_6": {"name": "Array 6 (Mid-IR 3)",  "range_um": (4.42, 5.00), "bands": 17, "index": 6},
}

# Every band_group the API accepts. Detector groups need one image per detector per visit;
# wavelength groups ("wavelength_um", "ratio", "difference") need every image at the position.
WAVELENGTH_FILTERS = {
    # 1. Multi-Band Stacking & Composites
    "stacked": {"name": "All 6 Detectors Stacked (High SNR)", "category": "composite", "wavelength_um": "0.75 - 5.00",
                "description": "Combines one image from each of the 6 detector arrays per visit for a higher signal-to-noise picture."},
    "false_color_rgb": {"name": "False-Color Composite (Short+Mid+Long IR)", "category": "composite", "wavelength_um": "0.75 - 5.00",
                        "description": "Three-color composite: Blue = Arrays 1-2 (0.75-1.64 um), Green = Arrays 3-4 (1.64-3.82 um), Red = Arrays 5-6 (3.82-5.00 um)."},
    # 2. Detector Arrays
    "array_1": {"name": "Array 1: 0.75 - 1.11 μm", "category": "detector", "wavelength_um": "0.75 - 1.11", "description": "Near-IR 1: Stellar photospheres and foreground field stars."},
    "array_2": {"name": "Array 2: 1.11 - 1.64 μm", "category": "detector", "wavelength_um": "1.11 - 1.64", "description": "Near-IR 2: 2MASS J & H band overlap, 1.4 um water absorption."},
    "array_3": {"name": "Array 3: 1.64 - 2.42 μm", "category": "detector", "wavelength_um": "1.64 - 2.42", "description": "Near-IR 3: 1.66 um methane overtone, 1.9 um water vapor, 2.15 um Ks continuum."},
    "array_4": {"name": "Array 4: 2.42 - 3.82 μm", "category": "detector", "wavelength_um": "2.42 - 3.82", "description": "Mid-IR 1: Deep 3.05 um water ice, 3.30 um fundamental methane dip."},
    "array_5": {"name": "Array 5: 3.82 - 4.42 μm", "category": "detector", "wavelength_um": "3.82 - 4.42", "description": "Mid-IR 2: 4.05 um Brackett-alpha hydrogen line, 4.25 um CO2 ice."},
    "array_6": {"name": "Array 6: 4.42 - 5.00 μm", "category": "detector", "wavelength_um": "4.42 - 5.00", "description": "Mid-IR 3: 4.60 um CO fundamental bandhead, peak cool brown dwarf thermal flux."},
    # 3. Elemental / Molecular Diagnostics
    "filter_h2o_ice": {"name": "💧 H₂O Ice Filter (3.05 μm)", "category": "diagnostic", "wavelength_um": 3.05, "element": "H2O", "description": "Targets deep 3.05 μm water ice absorption mantle on interstellar dust grains."},
    "filter_h2o_vapor": {"name": "💧 H₂O Vapor Filter (1.90 μm)", "category": "diagnostic", "wavelength_um": 1.90, "element": "H2O", "description": "Captures 1.90 μm atmospheric water vapor in cool stellar and brown dwarf atmospheres."},
    "filter_ch4_deep": {"name": "🪐 CH₄ Methane Filter (3.30 μm)", "category": "diagnostic", "wavelength_um": 3.30, "element": "CH4", "description": "Crucial marker for brown dwarf classification: cold T/Y dwarfs drop dramatically in flux at 3.30 μm."},
    "filter_ch4_overtone": {"name": "🪐 CH₄ Overtone Filter (1.66 μm)", "category": "diagnostic", "wavelength_um": 1.66, "element": "CH4", "description": "Detects 1.66 μm overtone absorption in substellar methane atmospheres."},
    "filter_co2_ice": {"name": "💨 CO₂ Ice Filter (4.25 μm)", "category": "diagnostic", "wavelength_um": 4.25, "element": "CO2", "description": "Isolates the 4.25 μm bending/stretching mode of solid carbon dioxide ice."},
    "filter_co": {"name": "☁️ CO Carbon Monoxide (4.60 μm)", "category": "diagnostic", "wavelength_um": 4.60, "element": "CO", "description": "Observes 4.60 μm fundamental carbon monoxide bandhead in interstellar gas clouds."},
    "filter_h_bra": {"name": "⚡ H Brackett-α (4.05 μm)", "category": "diagnostic", "wavelength_um": 4.05, "element": "H", "description": "Hydrogen recombination emission tracing accretion shocks and ionized nebulae."},
    "filter_pah_dust": {"name": "✨ Silicate & PAH Dust (3.40 μm)", "category": "diagnostic", "wavelength_um": 3.40, "element": "DUST", "description": "Traces 3.4 μm polycyclic aromatic hydrocarbon emission from protoplanetary disks."},
    # 4. Standard Photometric Bands
    "filter_j": {"name": "2MASS J-Band (1.25 μm)", "category": "photometric", "wavelength_um": 1.25, "description": "Standard astronomical near-infrared J-band equivalent."},
    "filter_h": {"name": "2MASS H-Band (1.65 μm)", "category": "photometric", "wavelength_um": 1.65, "description": "Standard astronomical near-infrared H-band equivalent."},
    "filter_ks": {"name": "2MASS Ks-Band (2.15 μm)", "category": "photometric", "wavelength_um": 2.15, "description": "Standard astronomical Ks-band continuum reference."},
    "filter_wise_w1": {"name": "WISE W1 (3.40 μm)", "category": "photometric", "wavelength_um": 3.40, "description": "NASA WISE mission Channel 1 filter equivalent."},
    "filter_wise_w2": {"name": "WISE W2 (4.60 μm)", "category": "photometric", "wavelength_um": 4.60, "description": "NASA WISE mission Channel 2 filter equivalent (cool brown dwarf discovery band)."},
    # 5. Spectral Indices / Ratio
    "ratio_ch4": {"name": "CH₄ Absorption Index (F3.30 / F2.15)", "category": "index", "ratio": [3.30, 2.15], "description": "Flux ratio highlighting methane absorption in cold brown dwarfs relative to Ks continuum."},
    "ratio_h2o": {"name": "H₂O Absorption Index (F3.05 / F2.15)", "category": "index", "ratio": [3.05, 2.15], "description": "Flux ratio highlighting water ice features relative to reference continuum."},
    "diff_hydrogen": {"name": "H Brackett-α Excess (Line - Continuum)", "category": "index", "difference": [4.05, 3.82], "description": "Continuum-subtracted hydrogen line emission."},
}

DETECTOR_GROUPS = {"stacked": ALL_DETECTORS, "false_color_rgb": ALL_DETECTORS,
                   **{f"array_{d}": [d] for d in ALL_DETECTORS}}


class NotReady(Exception):
    """The images a request needs are still downloading from IRSA."""

    def __init__(self, status: str, cached_images: int, total_images: int):
        super().__init__(f"{cached_images} of {total_images} images downloaded")
        self.status = status
        self.cached_images = cached_images
        self.total_images = total_images


class NoData(Exception):
    """SPHEREx has no usable images for this request."""


# ---------------------------------------------------------------------------
# Pure helpers (no network)
# ---------------------------------------------------------------------------

def position_key(ra_deg: float, dec_deg: float, fov_arcmin: float) -> str:
    """Positions within ~0.4 arcsec share a cache entry."""
    return f"{ra_deg:.4f}{dec_deg:+.4f}_{fov_arcmin:g}"


def result_key(*parts: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:32]


def grid_size(fov_arcmin: float) -> int:
    """Odd number of native SPHEREx pixels across the field, so the target sits on the centre pixel."""
    n = max(3, int(round(fov_arcmin * 60.0 / PIXEL_ARCSEC)))
    return n if n % 2 else n + 1


def target_wcs(ra_deg: float, dec_deg: float, n: int) -> WCS:
    """North-up, east-left TAN grid centred on the position at the native pixel scale."""
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra_deg, dec_deg]
    w.wcs.crpix = [(n + 1) / 2.0, (n + 1) / 2.0]
    w.wcs.cdelt = [-PIXEL_ARCSEC / 3600.0, PIXEL_ARCSEC / 3600.0]
    return w


def dedupe_images(images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Drop QR3 copies of exposures that also exist in DR1 (same time and detector)."""
    best: Dict[Tuple[float, int], Dict[str, Any]] = {}
    for img in images:
        key = (round(img["mjd"], 5), img["detector"])
        if key not in best or ("/dr1/" in img["uri"] and "/dr1/" not in best[key]["uri"]):
            best[key] = img
    return sorted(best.values(), key=lambda i: i["mjd"])


def group_visits(images: List[Dict[str, Any]], gap_days: float = VISIT_GAP_DAYS) -> List[List[Dict[str, Any]]]:
    """Split images (any order) into survey visits, oldest first."""
    visits: List[List[Dict[str, Any]]] = []
    for img in sorted(images, key=lambda i: i["mjd"]):
        if visits and img["mjd"] - visits[-1][-1]["mjd"] <= gap_days:
            visits[-1].append(img)
        else:
            visits.append([img])
    return visits


def select_for_frames(visits: List[List[Dict[str, Any]]], detectors: List[int]) -> List[List[Dict[str, Any]]]:
    """For each visit, the image of each detector taken closest to the visit's median time."""
    chosen = []
    for visit in visits:
        mid = float(np.median([i["mjd"] for i in visit]))
        picks = []
        for d in detectors:
            of_det = [i for i in visit if i["detector"] == d]
            if of_det:
                picks.append(min(of_det, key=lambda i: abs(i["mjd"] - mid)))
        if picks:
            chosen.append(picks)
    return chosen


def mjd_to_date(mjd: float) -> str:
    return Time(mjd, format="mjd").to_value("iso", subfmt="date")


def normalize(arr: np.ndarray) -> np.ndarray:
    """Background-subtract and scale by a robust sigma so different detectors can be averaged."""
    med = np.nanmedian(arr)
    sigma = 1.4826 * np.nanmedian(np.abs(arr - med))
    return (arr - med) / (sigma if sigma > 0 else 1.0)


def build_spectrum(cutouts: List[Dict[str, Any]], centers: List[float]) -> Dict[str, Any]:
    """Bin centre-pixel measurements into the 102 SPHEREx channels (17 per detector)."""
    per_channel: Dict[int, List[float]] = {}
    for c in cutouts:
        if c.get("wavelength_um") is None or c.get("center_flux") is None:
            continue
        first = 17 * (c["detector"] - 1)
        idx = min(range(first, first + 17), key=lambda i: abs(centers[i] - c["wavelength_um"]))
        per_channel.setdefault(idx, []).append(float(c["center_flux"]))

    channels = []
    for i, wl in enumerate(centers):
        values = per_channel.get(i, [])
        channels.append({
            "channel": i + 1,
            "detector": i // 17 + 1,
            "wavelength_um": wl,
            "flux_mjy_sr": round(float(np.median(values)), 6) if values else None,
            "n_measurements": len(values),
        })
    return {
        "unit": "MJy/sr",
        "method": "Centre-pixel surface brightness (zodiacal light removed) of every SPHEREx image of this position, "
                  "median per channel. A quick-look spectrum, not calibrated photometry.",
        "channels": channels,
        "measurements": [
            {"wavelength_um": c["wavelength_um"], "flux_mjy_sr": c["center_flux"], "detector": c["detector"],
             "date": mjd_to_date(c["obs_mjd"])}
            for c in sorted(cutouts, key=lambda c: c.get("wavelength_um") or 0)
            if c.get("wavelength_um") is not None and c.get("center_flux") is not None
        ],
    }


def render_png(arr: np.ndarray, stretch: str, colormap: str, is_difference: bool = False) -> bytes:
    """Flip to north-up screen orientation, upscale to the display size, and encode."""
    if arr.ndim == 2:
        fill = np.nanmedian(arr) if np.isfinite(arr).any() else 0.0
        arr = np.where(np.isfinite(arr), arr, fill)
    arr = np.flipud(arr)  # FITS row 0 is south; PNG row 0 is the top (north)
    f = DISPLAY_DIM / arr.shape[0]
    arr = ndi.zoom(arr, (f, f) if arr.ndim == 2 else (f, f, 1), order=0)
    return image_processor.array_to_png_bytes(arr, is_difference=is_difference, colormap=colormap, stretch_type=stretch)


# ---------------------------------------------------------------------------
# Network helpers
# ---------------------------------------------------------------------------

def query_images(ra_deg: float, dec_deg: float) -> List[Dict[str, Any]]:
    """All SPHEREx spectral images that cover the position, from IRSA TAP (no SIA ingestion lag)."""
    query = f"""
        SELECT a.uri, p.time_bounds_lower, p.energy_bandpassname
        FROM spherex.artifact a
        JOIN spherex.plane p ON a.planeid = p.planeid
        WHERE 1 = CONTAINS(POINT('ICRS', {ra_deg}, {dec_deg}), p.poly)
        ORDER BY p.time_bounds_lower
    """
    table = Irsa.query_tap(query).to_table()
    images = [
        {"uri": str(r["uri"]), "detector": int(str(r["energy_bandpassname"])[-1]), "mjd": float(r["time_bounds_lower"])}
        for r in table
    ]
    return dedupe_images(images)


RETRY_WAITS_SECONDS = (10, 30, 90)  # IRSA answers 503 now and then under load


def _get_with_retry(url: str) -> requests.Response:
    """GET from IRSA, waiting and retrying on 429/5xx answers and dropped connections."""
    for wait in RETRY_WAITS_SECONDS + (None,):  # None = last attempt: give up on failure
        try:
            resp = requests.get(url, timeout=300)
        except (requests.ConnectionError, requests.Timeout):
            if wait is None:
                raise
        else:
            if wait is None or (resp.status_code != 429 and resp.status_code < 500):
                resp.raise_for_status()
                return resp
        time.sleep(wait)


def fetch_cutout(image: Dict[str, Any], ra_deg: float, dec_deg: float, fov_arcmin: float) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Download one cutout and return its pixels on the position's common grid, plus metadata."""
    # 1.5x the field (> sqrt(2)), so the north-up square is covered however the exposure is rotated.
    url = f"{IRSA_URL}{image['uri']}?center={ra_deg},{dec_deg}d&size={1.5 * fov_arcmin / 60.0}"
    resp = _get_with_retry(url)
    with fits.open(io.BytesIO(resp.content)) as hdul:
        header = hdul["IMAGE"].header
        pixels = hdul["IMAGE"].data.astype(np.float32) - hdul["ZODI"].data.astype(np.float32)
        sky_wcs = WCS(header)
        x, y = sky_wcs.world_to_pixel(SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs"))
        spectral_wcs = WCS(header, fobj=hdul, key="W")
        spectral_wcs.sip = None
        wavelength, _ = spectral_wcs.pixel_to_world(x, y)
        version = hdul[0].header.get("VERSION")

    n = grid_size(fov_arcmin)
    grid, _ = reproject_interp((pixels, sky_wcs), target_wcs(ra_deg, dec_deg, n), shape_out=(n, n))
    grid = grid.astype(np.float32)
    centre = float(grid[n // 2, n // 2])
    return grid, {
        "wavelength_um": float(wavelength.to_value(u.um)),
        "center_flux": centre if np.isfinite(centre) else None,
        "processing_version": str(version) if version is not None else None,
    }


@lru_cache(maxsize=1)
def channel_wavelengths() -> List[float]:
    """Centre wavelengths of the 102 SPHEREx channels, from IRSA's DR1 all-sky cube."""
    resp = requests.get(HIPS_PROPERTIES_URL, timeout=60)
    resp.raise_for_status()
    for line in resp.text.splitlines():
        if line.startswith("data_cube_crval3_arr"):
            values = [float(v) for v in line.split("=", 1)[1].split()]
            if len(values) == 102:
                return values
    raise RuntimeError("Could not read the 102 SPHEREx channel wavelengths from IRSA")


@lru_cache(maxsize=4096)
def load_array(storage_path: str) -> np.ndarray:
    """Cached pixels from Supabase Storage (about 10 KB each, kept in memory once read)."""
    data = get_client().storage.from_(BUCKET).download(storage_path)
    return np.load(io.BytesIO(data), allow_pickle=False)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class SPHERExDataLoader:
    def __init__(self):
        # One priority queue feeds a few download threads. Flipbook images (priority 0) always go
        # before the full image set a spectrum or filter needs (priority 1), whichever spot asked first.
        self._queue: "queue.PriorityQueue" = queue.PriorityQueue()
        self._seq = itertools.count()
        self._queued: Dict[Tuple[str, str], int] = {}  # (position_key, uri) -> priority, waiting or downloading
        self._failed: set = set()                      # (position_key, uri) that failed after all retries
        self._pending: Dict[str, int] = {}             # position_key -> images still queued
        self._lock = threading.Lock()
        for i in range(DOWNLOAD_WORKERS):
            threading.Thread(target=self._worker, name=f"irsa-{i}", daemon=True).start()

    # -- positions and background downloads ---------------------------------

    def _position(self, ra_deg: float, dec_deg: float, fov_arcmin: float) -> Dict[str, Any]:
        """The cached position within half a SPHEREx pixel, or a new one (asks IRSA for its image list)."""
        db = get_client()
        tol = PIXEL_ARCSEC / 2.0 / 3600.0
        rows = (db.table("sky_positions").select("*").eq("fov_arcmin", fov_arcmin)
                .gte("dec_deg", dec_deg - tol).lte("dec_deg", dec_deg + tol).order("created_at").execute().data)
        for row in rows:
            dra = ((row["ra_deg"] - ra_deg + 180.0) % 360.0 - 180.0) * np.cos(np.radians(dec_deg))
            if np.hypot(dra, row["dec_deg"] - dec_deg) <= tol:
                return row
        images = query_images(ra_deg, dec_deg)
        row = {
            "position_key": position_key(ra_deg, dec_deg, fov_arcmin), "ra_deg": ra_deg, "dec_deg": dec_deg,
            "fov_arcmin": fov_arcmin, "images": images, "total_images": len(images), "status": "done" if not images else "queued",
        }
        db.table("sky_positions").upsert(row).execute()
        return row

    def _cached(self, key: str) -> Dict[str, Dict[str, Any]]:
        rows = get_client().table("sky_cutouts").select("*").eq("position_key", key).execute().data
        return {r["irsa_uri"]: r for r in rows}

    def _enqueue(self, pos: Dict[str, Any], images: List[Dict[str, Any]], priority: int) -> None:
        key = pos["position_key"]
        added = False
        with self._lock:
            for img in images:
                k = (key, img["uri"])
                if k in self._queued and self._queued[k] <= priority:
                    continue  # already waiting at this priority or better
                if k not in self._queued:
                    self._pending[key] = self._pending.get(key, 0) + 1
                    added = True
                self._queued[k] = priority  # a lower-priority entry left in the queue is skipped later
                self._queue.put((priority, next(self._seq), pos, img))
        if added:
            get_client().table("sky_positions").update({"status": "downloading", "updated_at": _now()}).eq("position_key", key).execute()

    def _worker(self) -> None:
        while True:
            priority, _, pos, img = self._queue.get()
            k = (pos["position_key"], img["uri"])
            with self._lock:
                if self._queued.get(k) != priority:
                    continue  # stale entry: already done, or re-queued at a higher priority
            try:
                self._download_one(pos, img)
            except Exception as e:  # one bad image shouldn't stop the rest
                log.warning("SPHEREx cutout failed for %s: %s", k[0], e)
                with self._lock:
                    self._failed.add(k)
            with self._lock:
                del self._queued[k]
                self._pending[k[0]] -= 1
                finished = self._pending[k[0]] == 0
                failures = sum(1 for f in self._failed if f[0] == k[0])
            if finished:
                try:
                    get_client().table("sky_positions").update({
                        "status": "done",
                        "error": f"{failures} images could not be downloaded from IRSA" if failures else None,
                        "updated_at": _now(),
                    }).eq("position_key", k[0]).execute()
                except Exception as e:
                    log.warning("Could not update download status for %s: %s", k[0], e)

    def _download_one(self, pos: Dict[str, Any], image: Dict[str, Any]) -> None:
        grid, meta = fetch_cutout(image, pos["ra_deg"], pos["dec_deg"], pos["fov_arcmin"])
        path = f"cutouts/{pos['position_key']}/{hashlib.sha1(image['uri'].encode()).hexdigest()[:20]}.npy"
        buf = io.BytesIO()
        np.save(buf, grid)
        db = get_client()
        db.storage.from_(BUCKET).upload(path, buf.getvalue(), {"content-type": "application/octet-stream", "upsert": "true"})
        db.table("sky_cutouts").upsert({
            "position_key": pos["position_key"], "irsa_uri": image["uri"], "detector": image["detector"],
            "obs_mjd": image["mjd"], "storage_path": path, **meta,
        }).execute()

    def _require(self, pos: Dict[str, Any], needed: List[Dict[str, Any]], priority: int) -> Dict[str, Dict[str, Any]]:
        """Cached cutouts, or queue the missing ones and raise NotReady with progress.
        Images that already failed in this process are skipped, so one bad image can't block a request."""
        cached = self._cached(pos["position_key"])
        missing = [img for img in needed if img["uri"] not in cached]
        with self._lock:
            retry = [img for img in missing if (pos["position_key"], img["uri"]) not in self._failed]
        if retry:
            self._enqueue(pos, retry, priority)
            raise NotReady("downloading", len(needed) - len(missing), len(needed))
        return cached

    # -- cached results -------------------------------------------------------

    def _result(self, key: str) -> Optional[Dict[str, Any]]:
        rows = get_client().table("sky_results").select("payload").eq("result_key", key).execute().data
        return rows[0]["payload"] if rows else None

    def _save_result(self, key: str, pos_key: str, payload: Dict[str, Any]) -> None:
        get_client().table("sky_results").upsert({"result_key": key, "position_key": pos_key, "payload": payload}).execute()

    def _upload_png(self, path: str, png: bytes) -> str:
        get_client().storage.from_(BUCKET).upload(path, png, {"content-type": "image/png", "upsert": "true"})
        return path

    def _signed_urls(self, paths: List[str]) -> Dict[str, str]:
        if not paths:
            return {}
        signed = get_client().storage.from_(BUCKET).create_signed_urls(paths, SIGNED_URL_SECONDS)
        return {s["path"]: s["signedURL"] for s in signed}

    # -- frames ---------------------------------------------------------------

    def _frames(self, pos: Dict[str, Any], band_group: str, num_epochs: int) -> List[Dict[str, Any]]:
        """One combined picture per visit: {date, mjd, uris, array | rgb}."""
        visits = group_visits(pos["images"])[-max(1, num_epochs):]
        spec = WAVELENGTH_FILTERS[band_group]

        if band_group in DETECTOR_GROUPS:
            chosen = select_for_frames(visits, DETECTOR_GROUPS[band_group])
            cached = self._require(pos, [img for visit in chosen for img in visit], priority=0)
            frames = []
            for visit in chosen:
                have = [img for img in visit if img["uri"] in cached]
                if not have:
                    continue
                arrays = {img["detector"]: load_array(cached[img["uri"]]["storage_path"]) for img in have}
                frame = {"date": mjd_to_date(have[0]["mjd"]), "mjd": have[0]["mjd"], "uris": [img["uri"] for img in have]}
                if band_group == "false_color_rgb":
                    frame["rgb"] = [self._mean([arrays.get(d) for d in pair]) for pair in ((1, 2), (3, 4), (5, 6))]
                elif band_group == "stacked":
                    frame["array"] = self._mean(list(arrays.values()))
                else:
                    frame["array"] = next(iter(arrays.values()))
                frames.append(frame)
            return frames

        # Wavelength groups need every image, because each image sees this spot at its own wavelength.
        cached = self._require(pos, [img for visit in visits for img in visit], priority=1)
        targets = spec.get("ratio") or spec.get("difference") or [spec["wavelength_um"]]
        frames = []
        for visit in visits:
            rows = [cached[img["uri"]] for img in visit if img["uri"] in cached]
            parts, uris = [], []
            for wl in targets:
                hits = [r for r in rows if r.get("wavelength_um") and abs(r["wavelength_um"] - wl) <= FILTER_HALF_WIDTH * wl]
                parts.append(self._mean([load_array(r["storage_path"]) for r in hits], scale=False))
                uris += [r["irsa_uri"] for r in hits]
            if any(p is None for p in parts):
                continue
            if "ratio" in spec:
                arr = image_processor.compute_spectral_ratio(parts[0], parts[1])
            elif "difference" in spec:
                arr = image_processor.compute_line_minus_continuum(parts[0], parts[1])
            else:
                arr = parts[0]
            frames.append({"date": mjd_to_date(visit[0]["mjd"]), "mjd": visit[0]["mjd"], "uris": uris, "array": arr})
        return frames

    @staticmethod
    def _mean(arrays: List[Optional[np.ndarray]], scale: bool = True) -> Optional[np.ndarray]:
        arrays = [a for a in arrays if a is not None]
        if not arrays:
            return None
        if scale and len(arrays) > 1:
            arrays = [normalize(a) for a in arrays]
        return np.nanmean(np.stack(arrays), axis=0)

    # -- public API -----------------------------------------------------------

    def _locate(self, ra_input: str, dec_input: str, fov_arcmin: float) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        coord = coordinates.parse_coordinates(ra_input, dec_input)
        pos = self._position(coord["ra_deg"], coord["dec_deg"], float(fov_arcmin))
        if not pos["total_images"]:
            raise NoData("SPHEREx has no images of this spot yet.")
        return coord, pos

    def get_sky_patch(self, ra_input: str, dec_input: str, fov_arcmin: float = 5.0, band_group: str = "stacked",
                      stretch: str = "zscale", colormap: str = "inferno", num_epochs: int = 4) -> Dict[str, Any]:
        """Flipbook frames (one per visit) and the difference image for a position (catalogue: /api/catalog-overlay)."""
        if band_group not in WAVELENGTH_FILTERS:
            raise ValueError(f"Unknown band_group '{band_group}'")
        coord, pos = self._locate(ra_input, dec_input, fov_arcmin)
        key = result_key(pos["position_key"], "sky", band_group, stretch, colormap, num_epochs)
        payload = self._result(key)
        if payload is None:
            frames = self._frames(pos, band_group, num_epochs)
            if not frames:
                raise NoData(f"No SPHEREx images of this spot cover {WAVELENGTH_FILTERS[band_group]['name']}.")
            epochs = []
            for i, f in enumerate(frames):
                if "rgb" in f:
                    shape = next(c for c in f["rgb"] if c is not None).shape
                    short, mid, long = [c if c is not None else np.zeros(shape, np.float32) for c in f["rgb"]]
                    png = render_png(image_processor.create_false_color_composite(short, mid, long, stretch_type=stretch), stretch, colormap)
                else:
                    png = render_png(f["array"], stretch, colormap)
                epochs.append({
                    "epoch_index": i, "timestamp": f["date"], "mjd": f["mjd"],
                    "image_path": self._upload_png(f"results/{key}/{i}.png", png),
                    "images_used": len(f["uris"]), "irsa_uris": f["uris"],
                })
            diff_path = None
            if len(frames) > 1 and "array" in frames[0]:
                diff = image_processor.compute_difference_image(frames[0]["array"], frames[-1]["array"])
                diff_path = self._upload_png(f"results/{key}/difference.png", render_png(diff, stretch, colormap, is_difference=True))
            payload = {
                "epochs": epochs,
                "difference_image_path": diff_path,
                "source": {"mission": "SPHEREx", "archive": "NASA/IPAC IRSA", "total_images_at_position": pos["total_images"]},
            }
            self._save_result(key, pos["position_key"], payload)

        urls = self._signed_urls([e["image_path"] for e in payload["epochs"]] + ([payload["difference_image_path"]] if payload["difference_image_path"] else []))
        return {
            "target_info": {
                "ra_deg": coord["ra_deg"], "dec_deg": coord["dec_deg"], "ra_hms": coord["ra_hms"], "dec_dms": coord["dec_dms"],
                "fov_arcmin": float(fov_arcmin), "band_group": band_group, "active_filter_meta": WAVELENGTH_FILTERS[band_group],
                "stretch": stretch, "colormap": colormap,
            },
            "epochs": [{**{k: v for k, v in e.items() if k != "image_path"}, "image_url": urls[e["image_path"]]} for e in payload["epochs"]],
            "difference_image_url": urls.get(payload["difference_image_path"]) if payload["difference_image_path"] else None,
            "source": payload["source"],
            "spherex_detector_arrays": SPHEREX_ARRAYS,
            "available_filters": WAVELENGTH_FILTERS,
        }

    def get_spectrum(self, ra_input: str, dec_input: str, fov_arcmin: float = 5.0) -> Dict[str, Any]:
        """The 102-channel spectrum from every SPHEREx image of the position."""
        coord, pos = self._locate(ra_input, dec_input, fov_arcmin)
        key = result_key(pos["position_key"], "spectrum")
        payload = self._result(key)
        if payload is None:
            cached = self._require(pos, pos["images"], priority=1)
            payload = build_spectrum(list(cached.values()), channel_wavelengths())
            self._save_result(key, pos["position_key"], payload)
        return {"target_info": {k: coord[k] for k in ("ra_deg", "dec_deg", "ra_hms", "dec_dms")}, **payload}

    def shift_and_add(self, ra_input: str, dec_input: str, fov_arcmin: float, shift_x: float, shift_y: float,
                      band_group: str = "stacked", stretch: str = "zscale", colormap: str = "inferno",
                      filter_mode: str = "normal") -> Dict[str, Any]:
        """Co-add the real visit frames along a trial motion (display pixels per visit)."""
        if band_group not in WAVELENGTH_FILTERS or band_group == "false_color_rgb":
            raise ValueError(f"Shift-and-add needs a single-image band_group, not '{band_group}'")
        _, pos = self._locate(ra_input, dec_input, fov_arcmin)
        frames = self._frames(pos, band_group, num_epochs=len(group_visits(pos["images"])))
        if not frames:
            raise NoData("No SPHEREx images of this spot for that band.")
        per_px = DISPLAY_DIM / grid_size(float(fov_arcmin))
        # Display y grows downward (south); the native grid's y grows north.
        coadded = image_processor.perform_shift_and_add([f["array"] for f in frames], shift_x / per_px, -shift_y / per_px)
        if filter_mode != "normal":
            coadded = image_processor.apply_image_filter(coadded, filter_mode)
        png = render_png(coadded, stretch, colormap)
        return {
            "shift_x": shift_x, "shift_y": shift_y, "filter_mode": filter_mode,
            "image_url": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
            "epochs_stacked": len(frames),
            "snr_boost": f"{np.sqrt(len(frames)):.1f}x (sqrt({len(frames)}) visits co-added)",
            "visit_dates": [f["date"] for f in frames],
        }
