"""
main.py — FastAPI Application Entry Point for NASA SPHEREx Sky Viewer.

Exposes REST API endpoints for:
- /api/sky-cutout: real SPHEREx multi-visit images and difference image (NASA/IPAC IRSA)
- /api/spectrum: 102-channel spectrum from every SPHEREx image of a position
- /api/shift-and-add: co-add the real visits along a trial motion
- /api/catalog-overlay: Gaia DR3 and AllWISE sources (via IRSA)
- /api/bands: SPHEREx detector arrays and the available band groups
- /api/candidates, /api/projects: citizen-science data stored in Supabase
- /api/health: Service health check

SPHEREx data is downloaded once per position in the background and cached in Supabase.
While that is happening the sky endpoints answer 202 with download progress.
"""

import logging
import os
from typing import Any, Callable, List, Optional

from fastapi import FastAPI, Query, HTTPException, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import coordinates
import database
from data_loader import SPHERExDataLoader, SPHEREX_ARRAYS, WAVELENGTH_FILTERS, NotReady, NoData
from catalog_service import catalog_service

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(
    title="NASA SPHEREx Sky Viewer API",
    description="Hyperspectral near-infrared multi-epoch sky viewer for moving objects and variable star discoveries.",
    version="2.0.0"
)

# Enable CORS for local React/Vite development and web embedding
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend production build if available
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
frontend_assets_dir = os.path.join(frontend_dist_dir, "assets")
if os.path.isdir(frontend_assets_dir):
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="assets")

loader = SPHERExDataLoader()


def sky_call(fn: Callable[[], Any]) -> Any:
    """Run a SPHEREx request, mapping download progress and missing data to HTTP responses."""
    try:
        return fn()
    except NotReady as e:
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={
            "status": "downloading",
            "cached_images": e.cached_images,
            "total_images": e.total_images,
            "message": f"Downloading SPHEREx images from NASA/IPAC IRSA: {e.cached_images} of {e.total_images} ready.",
        })
    except NoData as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("SPHEREx request failed")
        raise HTTPException(status_code=502, detail=f"Could not get SPHEREx data from NASA/IPAC IRSA: {e}")


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
    return {"status": "ok", "service": "NASA SPHEREx Sky Viewer API", "version": "2.0.0"}


@app.get("/api/bands")
def get_bands():
    """Returns the SPHEREx 6-detector array layout (102 channels, 0.75 - 5.00 um) and the band groups the API accepts."""
    return {
        "mission": "NASA SPHEREx",
        "total_bands": 102,
        "wavelength_range_um": [0.75, 5.00],
        "detector_arrays": SPHEREX_ARRAYS,
        "wavelength_filters": WAVELENGTH_FILTERS,
    }


@app.get("/api/catalog-overlay")
def get_catalog_overlay(
    ra: str = Query(..., description="Right Ascension"),
    dec: str = Query(..., description="Declination"),
    fov: float = Query(5.0, description="Field of View in arcminutes"),
    catalogs: Optional[str] = Query("gaia_dr3,allwise", description="Comma-separated catalog names")
):
    """
    Returns Gaia DR3 and AllWISE catalog sources with projected pixel coordinates
    for overlaying onto SPHEREx sky cutouts.
    """
    try:
        coord_info = coordinates.parse_coordinates(ra, dec)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid coordinates: {e}")
    cat_list = [c.strip() for c in catalogs.split(",") if c.strip()]
    try:
        sources = catalog_service.query_catalogs(
            ra_deg=coord_info["ra_deg"],
            dec_deg=coord_info["dec_deg"],
            fov_arcmin=fov,
            catalogs=cat_list
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach the Gaia/AllWISE catalogs at IRSA: {e}")
    return {
        "target": coord_info,
        "fov_arcmin": fov,
        "total_sources": len(sources),
        "sources": sources
    }


@app.get("/api/sky-cutout")
def get_sky_cutout(
    ra: str = Query(..., description="Right Ascension in sexagesimal (08h55m10.831s) or decimal degrees (133.795)"),
    dec: str = Query(..., description="Declination in sexagesimal (-07d14m42.53s) or decimal degrees (-7.245)"),
    fov: float = Query(5.0, description="Field of View in arcminutes"),
    band_group: str = Query("stacked", description="'stacked', 'array_1'..'array_6', 'false_color_rgb', or a filter id from /api/bands"),
    stretch: str = Query("zscale", description="Contrast stretch: 'zscale', 'asinh', 'linear', 'log'"),
    colormap: str = Query("inferno", description="Display colormap: 'inferno', 'viridis', 'magma', 'grayscale'"),
    epochs: int = Query(4, description="Number of most recent survey visits to return")
):
    """
    Real SPHEREx pictures of a sky position, one per survey visit, plus the difference image.
    Answers 202 with progress while the images are first downloaded from IRSA.
    """
    return sky_call(lambda: loader.get_sky_patch(
        ra_input=ra, dec_input=dec, fov_arcmin=fov, band_group=band_group,
        stretch=stretch, colormap=colormap, num_epochs=epochs,
    ))


@app.get("/api/difference-image")
def get_difference_image(
    ra: str = Query(..., description="Right Ascension"),
    dec: str = Query(..., description="Declination"),
    fov: float = Query(5.0, description="Field of View in arcminutes"),
    band_group: str = Query("stacked", description="'stacked', 'array_1'..'array_6', or filter id"),
    early_idx: int = Query(0, description="Reference early epoch index"),
    late_idx: int = Query(1, description="Comparison late epoch index"),
    stretch: str = Query("zscale", description="Contrast stretch: 'zscale', 'asinh', 'linear', 'log'"),
    colormap: str = Query("inferno", description="Display colormap: 'inferno', 'viridis', 'magma', 'grayscale'")
):
    """
    Computes scientific difference imaging between two specified survey visits
    (late_idx minus early_idx) to detect moving objects and transient brightness changes.
    """
    return sky_call(lambda: loader.get_difference_image(
        ra_input=ra, dec_input=dec, fov_arcmin=fov, band_group=band_group,
        early_idx=early_idx, late_idx=late_idx, stretch=stretch, colormap=colormap
    ))


@app.get("/api/spectrum")
def get_spectrum(
    ra: str = Query(..., description="Right Ascension"),
    dec: str = Query(..., description="Declination"),
    fov: float = Query(5.0, description="Field of View in arcminutes (shares the image cache with /api/sky-cutout)"),
):
    """
    102-channel SPHEREx spectrum of a position, built from every SPHEREx image of it.
    Answers 202 with progress until all images are downloaded (this can take 10-15 minutes the first time).
    """
    return sky_call(lambda: loader.get_spectrum(ra_input=ra, dec_input=dec, fov_arcmin=fov))


@app.get("/api/pixel-to-radec")
def get_pixel_to_radec(
    pixel_x: float = Query(..., description="Canvas X pixel coordinate (0 to 256)"),
    pixel_y: float = Query(..., description="Canvas Y pixel coordinate (0 to 256)"),
    center_ra: str = Query(..., description="Field center RA"),
    center_dec: str = Query(..., description="Field center Dec"),
    fov: float = Query(5.0, description="Field of View in arcminutes")
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
    fov: float = Query(5.0, description="Field of View in arcminutes"),
    shift_x: float = Query(0.0, description="X motion (display pixels per survey visit)"),
    shift_y: float = Query(0.0, description="Y motion (display pixels per survey visit)"),
    band_group: str = Query("stacked", description="Wavelength group"),
    stretch: str = Query("zscale", description="Contrast stretch"),
    colormap: str = Query("inferno", description="Display colormap"),
    filter_mode: str = Query("normal", description="Spatial filter: normal, smooth, sharpen, median, threshold_3sigma")
):
    """
    Shift-and-add search for faint moving objects: co-adds the real SPHEREx visits
    along a trial motion vector (shift_x, shift_y). Stars smear out; an object moving
    at that rate lines up and gets brighter.
    """
    return sky_call(lambda: loader.shift_and_add(
        ra_input=ra, dec_input=dec, fov_arcmin=fov, shift_x=shift_x, shift_y=shift_y,
        band_group=band_group, stretch=stretch, colormap=colormap, filter_mode=filter_mode,
    ))


# ---------------------------------------------------------------------------
# Citizen Science Discovery Database Endpoints
# ---------------------------------------------------------------------------

class CandidatePayload(BaseModel):
    ra_deg: float
    dec_deg: float
    ra_hms: Optional[str] = ""
    dec_dms: Optional[str] = ""
    pixel_x: Optional[float] = None
    pixel_y: Optional[float] = None
    category: Optional[str] = "planet_x"
    confidence: Optional[int] = 4
    notes: Optional[str] = ""
    observer_callsign: Optional[str] = "Citizen Scientist"
    band_group: Optional[str] = "stacked"
    epoch_label: Optional[str] = ""


class VotePayload(BaseModel):
    voter_id: str = Field(min_length=1, max_length=100, description="Random id the voter's browser keeps; one vote per id per candidate")
    vote_type: Optional[str] = Field("corroborate", description="'corroborate' to vote, 'unvote' to take the vote back")
    voter_callsign: Optional[str] = "Citizen Scientist"
    comment: Optional[str] = ""


@app.get("/api/candidates")
def list_candidates(
    category: Optional[str] = Query(None, description="Filter category: planet_x, brown_dwarf, variable_star, asteroid"),
    ra: Optional[float] = Query(None, description="Center RA in degrees for cone search"),
    dec: Optional[float] = Query(None, description="Center Dec in degrees for cone search"),
    radius_deg: Optional[float] = Query(None, description="Cone search search radius in degrees"),
    voter_id: Optional[str] = Query(None, description="Adds user_voted to each candidate for this voter")
):
    """Retrieve community flagged candidates with optional category or spatial radius filtering."""
    try:
        return database.get_candidates(category=category, ra_deg=ra, dec_deg=dec, radius_deg=radius_deg, voter_id=voter_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.post("/api/candidates", status_code=status.HTTP_201_CREATED)
def create_candidate(candidate: CandidatePayload):
    """Store a newly flagged citizen science candidate discovery."""
    try:
        return database.add_candidate(candidate.model_dump())
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
def get_candidate(candidate_id: int):
    """Retrieve details and community corroboration history for a specific candidate."""
    cand = database.get_candidate_by_id(candidate_id)
    if not cand:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return cand


@app.post("/api/candidates/{candidate_id}/vote")
def cast_candidate_vote(candidate_id: int, vote: VotePayload):
    """Vote for a candidate, or take the vote back. Each voter_id counts once per candidate."""
    updated = database.vote_candidate(
        candidate_id,
        voter_id=vote.voter_id,
        vote_type=vote.vote_type or "corroborate",
        voter_callsign=vote.voter_callsign or "Citizen Scientist",
        comment=vote.comment or ""
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return updated


@app.delete("/api/candidates/{candidate_id}")
def delete_candidate_endpoint(candidate_id: int):
    """Remove a candidate discovery from the database."""
    success = database.delete_candidate(candidate_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return {"status": "deleted", "id": candidate_id}


# ---------------------------------------------------------------------------
# Saved sky projects
# ---------------------------------------------------------------------------

class ProjectPayload(BaseModel):
    name: str
    description: Optional[str] = ""
    color: str
    ra_deg: float
    dec_deg: float
    bands: Optional[List[int]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    ra_deg: Optional[float] = None
    dec_deg: Optional[float] = None
    bands: Optional[List[int]] = None


@app.get("/api/projects")
def list_projects():
    """All saved projects, oldest first."""
    try:
        return database.list_projects()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectPayload):
    try:
        return database.add_project(project.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save project: {str(e)}")


@app.patch("/api/projects/{project_id}")
def update_project(project_id: int, changes: ProjectUpdate):
    try:
        updated = database.update_project(project_id, changes.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update project: {str(e)}")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return updated


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int):
    if not database.delete_project(project_id):
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return {"status": "deleted", "id": project_id}


@app.get("/{filename:path}")
def serve_frontend_dist(filename: str):
    """Serves frontend root static assets (like skymap images) and handles SPA fallback."""
    if filename.startswith("api/") or filename == "api":
        raise HTTPException(status_code=404, detail="Not Found")
    file_path = os.path.join(frontend_dist_dir, filename)
    if os.path.isfile(file_path):
        from fastapi.responses import FileResponse
        return FileResponse(file_path)
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_file):
        from fastapi.responses import FileResponse
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
