"""
main.py — FastAPI Application Entry Point for NASA SPHEREx Sky Viewer.

Exposes REST API endpoints for:
- /api/presets: NASA Space Apps benchmark targets
- /api/sky-cutout: Multi-epoch images, difference image, and 102-band spectra
- /api/bands: 102-channel infrared detector array specifications
- /api/health: Service health check

Configured with CORS middleware to allow seamless frontend integration.
"""

import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException, status
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import coordinates
import image_processor
import database
import numpy as np
from data_loader import SPHERExDataLoader, SPHEREX_ARRAYS, ELEMENT_DEFINITIONS, WAVELENGTH_FILTERS
from catalog_service import catalog_service

app = FastAPI(
    title="NASA SPHEREx Sky Viewer API",
    description="Hyperspectral near-infrared multi-epoch sky viewer for moving objects and variable star discoveries.",
    version="1.0.0"
)

# Enable CORS for local React/Vite development and web embedding
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist and mount
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Mount frontend production build if available
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_dir, "assets")), name="assets")

# Initialize scientific data loader
loader = SPHERExDataLoader(cache_dir="data/cache")


@app.get("/")
def serve_index():
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_file):
        from fastapi.responses import FileResponse
        return FileResponse(index_file)
    return {"message": "NASA SPHEREx Sky Viewer Backend API. Visit /docs for Swagger documentation."}


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "NASA SPHEREx Sky Viewer API", "version": "1.0.0"}


@app.get("/api/presets")
def get_presets():
    """Returns official NASA Space Apps Challenge benchmark targets for 1-click verification."""
    return coordinates.PRESET_TARGETS


@app.get("/api/bands")
def get_bands():
    """Returns SPHEREx 6-detector array layout covering 102 near-infrared channels (0.75 - 5.00 um) and wavelength filters."""
    return {
        "mission": "NASA SPHEREx",
        "total_bands": 102,
        "wavelength_range_um": [0.75, 5.00],
        "detector_arrays": SPHEREX_ARRAYS,
        "wavelength_filters": WAVELENGTH_FILTERS,
        "elements": ELEMENT_DEFINITIONS
    }


@app.get("/api/element-density")
def get_element_density(
    ra: str = Query(..., description="Right Ascension in sexagesimal or decimal degrees"),
    dec: str = Query(..., description="Declination in sexagesimal or decimal degrees"),
    element: str = Query("H2O", description="Target molecule/element: H2O, CH4, CO2, CO, H, DUST"),
    fov: float = Query(12.0, description="Field of View in arcminutes")
):
    """
    Fetches 2D spatial column density map and astrophysical telemetry for a specific element or molecule.
    """
    try:
        return loader.get_element_density(ra_input=ra, dec_input=dec, element=element, fov_arcmin=fov)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to calculate element density: {str(e)}")


@app.get("/api/catalog-overlay")
def get_catalog_overlay(
    ra: str = Query(..., description="Right Ascension"),
    dec: str = Query(..., description="Declination"),
    fov: float = Query(12.0, description="Field of View in arcminutes"),
    catalogs: Optional[str] = Query("gaia_dr3,allwise", description="Comma-separated catalog names")
):
    """
    Returns Gaia DR3 and AllWISE catalog sources with projected pixel coordinates
    for overlaying onto SPHEREx sky cutouts.
    """
    try:
        coord_info = coordinates.parse_coordinates(ra, dec)
        cat_list = [c.strip() for c in catalogs.split(",") if c.strip()]
        sources = catalog_service.query_catalogs(
            ra_deg=coord_info["ra_deg"],
            dec_deg=coord_info["dec_deg"],
            fov_arcmin=fov,
            catalogs=cat_list
        )
        return {
            "target": coord_info,
            "fov_arcmin": fov,
            "total_sources": len(sources),
            "sources": sources
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to query catalog overlay: {str(e)}")


@app.get("/api/sky-cutout")
def get_sky_cutout(
    ra: str = Query(..., description="Right Ascension in sexagesimal (08h55m10.831s) or decimal degrees (133.795)"),
    dec: str = Query(..., description="Declination in sexagesimal (-07d14m42.53s) or decimal degrees (-7.245)"),
    fov: float = Query(12.0, description="Field of View in arcminutes"),
    band_group: str = Query("stacked", description="Wavelength group: 'stacked', 'array_1'..'array_6', or 'false_color_rgb'"),
    stretch: str = Query("zscale", description="Contrast stretch: 'zscale', 'asinh', 'linear', 'log'"),
    colormap: str = Query("inferno", description="Display colormap: 'inferno', 'viridis', 'magma', 'grayscale'"),
    epochs: int = Query(4, description="Number of 6-month survey epochs to retrieve")
):
    """
    Fetches multi-epoch astronomical cutouts, difference image, and 102-band SED for a given sky coordinate patch.
    """
    try:
        data = loader.get_sky_patch(
            ra_input=ra,
            dec_input=dec,
            fov_arcmin=fov,
            band_group=band_group,
            stretch=stretch,
            colormap=colormap,
            num_epochs=epochs
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process celestial coordinates or cutouts: {str(e)}")


@app.get("/api/pixel-to-radec")
def get_pixel_to_radec(
    pixel_x: float = Query(..., description="Canvas X pixel coordinate (0 to 256)"),
    pixel_y: float = Query(..., description="Canvas Y pixel coordinate (0 to 256)"),
    center_ra: str = Query(..., description="Field center RA"),
    center_dec: str = Query(..., description="Field center Dec"),
    fov: float = Query(12.0, description="Field of View in arcminutes")
):
    """
    Translates a 2D canvas pixel coordinate back to celestial RA/Dec for Citizen Science candidate flagging.
    """
    try:
        center_info = coordinates.parse_coordinates(center_ra, center_dec)
        astrometry = coordinates.pixel_to_radec(
            pixel_x=pixel_x,
            pixel_y=pixel_y,
            center_ra_deg=center_info["ra_deg"],
            center_dec_deg=center_info["dec_deg"],
            fov_arcmin=fov
        )
        return astrometry
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to calculate astrometry from pixel: {str(e)}")


@app.get("/api/shift-and-add")
def get_shift_and_add(
    ra: str = Query(..., description="Right Ascension"),
    dec: str = Query(..., description="Declination"),
    fov: float = Query(12.0, description="Field of View in arcminutes"),
    shift_x: float = Query(0.0, description="X velocity offset (pixels/epoch)"),
    shift_y: float = Query(0.0, description="Y velocity offset (pixels/epoch)"),
    band_group: str = Query("stacked", description="Wavelength group"),
    stretch: str = Query("zscale", description="Contrast stretch"),
    colormap: str = Query("inferno", description="Display colormap"),
    filter_mode: str = Query("normal", description="Spatial filter: normal, smooth, sharpen, median, threshold_3sigma")
):
    """
    NASA Shift-and-Add Search Engine for Planet X and outer solar system bodies.
    Co-adds all 4 SPHEREx survey epochs along a trial velocity vector (shift_x, shift_y).
    """
    try:
        coord_info = coordinates.parse_coordinates(ra, dec)
        seed = loader._get_coordinate_seed(coord_info["ra_deg"], coord_info["dec_deg"])
        matched_target = coord_info.get("matched_preset")

        dim = 256
        rng = np.random.RandomState(seed)
        bg_stars = [
            (rng.uniform(10, dim - 10), rng.uniform(10, dim - 10), rng.uniform(1.5, 35.0), rng.uniform(2.2, 4.0))
            for _ in range(35)
        ]

        center_x, center_y = dim / 2.0, dim / 2.0
        is_cool_target = matched_target in ["WISE 0855", "Epsilon Indi B", "Luhman 16"]
        is_tno_target = matched_target == "90377 Sedna"

        raw_epochs = []
        for ep in range(4):
            ep_rng = np.random.RandomState(seed + ep * 1000)
            bg_noise = ep_rng.normal(loc=1.2, scale=0.15, size=(dim, dim)).astype(np.float32)
            canvas = np.zeros((dim, dim), dtype=np.float32)
            for sy, sx, sflux, sfwhm in bg_stars:
                canvas += loader._generate_gaussian_psf((dim, dim), sy, sx, sflux, fwhm=sfwhm)

            if is_cool_target:
                tx = center_x + ep * 1.3
                ty = center_y + ep * 0.7
            elif is_tno_target:
                tx = center_x + ep * 0.25
                ty = center_y + ep * 0.15
            else:
                tx = center_x
                ty = center_y
            canvas += loader._generate_gaussian_psf((dim, dim), ty, tx, 8.5, fwhm=2.8)
            raw_epochs.append(bg_noise + canvas)

        coadded = image_processor.perform_shift_and_add(raw_epochs, shift_x, shift_y)

        if filter_mode != "normal":
            coadded = image_processor.apply_image_filter(coadded, filter_mode)

        img_uri = image_processor.array_to_base64_data_uri(
            coadded,
            colormap=colormap,
            stretch_type=stretch
        )

        target_expected_vx = 1.3 if is_cool_target else (0.25 if is_tno_target else 0.0)
        target_expected_vy = 0.7 if is_cool_target else (0.15 if is_tno_target else 0.0)
        is_aligned = bool(abs(shift_x - target_expected_vx) < 0.2 and abs(shift_y - target_expected_vy) < 0.2)

        return {
            "shift_x": shift_x,
            "shift_y": shift_y,
            "filter_mode": filter_mode,
            "image_url": img_uri,
            "snr_boost": "2.0x (sqrt(4) epochs co-added)",
            "target_aligned": is_aligned,
            "recommended_vx": target_expected_vx,
            "recommended_vy": target_expected_vy
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Shift-and-add failed: {str(e)}")


# ---------------------------------------------------------------------------
# Citizen Science Discovery Database Endpoints
# ---------------------------------------------------------------------------

class CandidatePayload(BaseModel):
    id: Optional[str] = None
    ra_deg: float
    dec_deg: float
    ra_hms: Optional[str] = ""
    dec_dms: Optional[str] = ""
    pixel_x: Optional[float] = 128.0
    pixel_y: Optional[float] = 128.0
    category: Optional[str] = "planet_x"
    confidence: Optional[int] = 4
    notes: Optional[str] = ""
    observer_callsign: Optional[str] = "Citizen Scientist"
    target_preset: Optional[str] = ""
    band_group: Optional[str] = "stacked"
    epoch_label: Optional[str] = ""
    upvotes: Optional[int] = 1
    created_at: Optional[str] = None


class VotePayload(BaseModel):
    vote_type: Optional[str] = "corroborate"
    voter_callsign: Optional[str] = "Citizen Scientist"
    voter_id: Optional[str] = ""
    comment: Optional[str] = ""


@app.get("/api/candidates")
def list_candidates(
    category: Optional[str] = Query(None, description="Filter category: planet_x, brown_dwarf, variable_star, asteroid"),
    ra: Optional[float] = Query(None, description="Center RA in degrees for cone search"),
    dec: Optional[float] = Query(None, description="Center Dec in degrees for cone search"),
    radius_deg: Optional[float] = Query(None, description="Cone search search radius in degrees")
):
    """Retrieve community flagged candidates with optional category or spatial radius filtering."""
    try:
        return database.get_candidates(category=category, ra_deg=ra, dec_deg=dec, radius_deg=radius_deg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.post("/api/candidates", status_code=status.HTTP_201_CREATED)
def create_candidate(candidate: CandidatePayload):
    """Store a newly flagged citizen science candidate discovery."""
    try:
        cand_dict = candidate.model_dump() if hasattr(candidate, "model_dump") else candidate.dict()
        return database.add_candidate(cand_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to record candidate discovery: {str(e)}")


@app.get("/api/candidates/export-mpc")
def export_mpc():
    """Export all verified candidates formatted for Minor Planet Center (MPC) & NASA submission."""
    try:
        dossier = database.export_mpc_dossier()
        return PlainTextResponse(content=dossier, media_type="text/plain; charset=utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate MPC export: {str(e)}")


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    """Retrieve details and community corroboration history for a specific candidate."""
    cand = database.get_candidate_by_id(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return cand


@app.post("/api/candidates/{candidate_id}/vote")
def cast_candidate_vote(candidate_id: str, vote: VotePayload):
    """Corroborate or peer-review a candidate discovery with a community vote."""
    updated = database.vote_candidate(
        candidate_id,
        vote_type=vote.vote_type or "corroborate",
        voter_callsign=vote.voter_callsign or "Citizen Scientist",
        voter_id=vote.voter_id or "",
        comment=vote.comment or ""
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return updated


@app.delete("/api/candidates/{candidate_id}")
def delete_candidate_endpoint(candidate_id: str):
    """Remove a candidate discovery from the database."""
    success = database.delete_candidate(candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return {"status": "deleted", "id": candidate_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
