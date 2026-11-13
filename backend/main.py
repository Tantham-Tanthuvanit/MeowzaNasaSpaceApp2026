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
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import coordinates
from data_loader import SPHERExDataLoader, SPHEREX_ARRAYS

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
    """Returns SPHEREx 6-detector array layout covering 102 near-infrared channels (0.75 - 5.00 um)."""
    return {
        "mission": "NASA SPHEREx",
        "total_bands": 102,
        "wavelength_range_um": [0.75, 5.00],
        "detector_arrays": SPHEREX_ARRAYS
    }


@app.get("/api/sky-cutout")
def get_sky_cutout(
    ra: str = Query(..., description="Right Ascension in sexagesimal (08h55m10.831s) or decimal degrees (133.795)"),
    dec: str = Query(..., description="Declination in sexagesimal (-07d14m42.53s) or decimal degrees (-7.245)"),
    fov: float = Query(5.0, description="Field of View in arcminutes"),
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
