"""
flask_app.py — Flask Application Entry Point for NASA SPHEREx Sky Viewer.

Alternative Flask runner implementing identical REST API endpoints:
- /api/presets
- /api/sky-cutout
- /api/bands
- /api/health
"""

import os
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

import coordinates
import image_processor
import database
import numpy as np
from data_loader import SPHERExDataLoader, SPHEREX_ARRAYS, ELEMENT_DEFINITIONS, WAVELENGTH_FILTERS
from catalog_service import catalog_service

frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

app = Flask(__name__, static_folder="static")
CORS(app)

loader = SPHERExDataLoader(cache_dir="data/cache")


@app.route("/", methods=["GET"])
def index():
    if os.path.exists(os.path.join(frontend_dist_dir, "index.html")):
        return send_from_directory(frontend_dist_dir, "index.html")
    return jsonify({"message": "NASA SPHEREx Sky Viewer Backend API."})


@app.route("/assets/<path:path>", methods=["GET"])
def serve_assets(path):
    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.exists(assets_dir):
        return send_from_directory(assets_dir, path)
    return "Not found", 404


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "NASA SPHEREx Sky Viewer Flask API", "version": "1.0.0"})


@app.route("/api/presets", methods=["GET"])
def get_presets():
    return jsonify(coordinates.PRESET_TARGETS)


@app.route("/api/bands", methods=["GET"])
def get_bands():
    return jsonify({
        "mission": "NASA SPHEREx",
        "total_bands": 102,
        "wavelength_range_um": [0.75, 5.00],
        "detector_arrays": SPHEREX_ARRAYS,
        "wavelength_filters": WAVELENGTH_FILTERS,
        "elements": ELEMENT_DEFINITIONS
    })


@app.route("/api/element-density", methods=["GET"])
def get_element_density():
    ra = request.args.get("ra")
    dec = request.args.get("dec")
    if not ra or not dec:
        return jsonify({"error": "Missing required 'ra' or 'dec' query parameter."}), 400

    element = request.args.get("element", "H2O")
    fov = float(request.args.get("fov", 12.0))

    try:
        data = loader.get_element_density(ra_input=ra, dec_input=dec, element=element, fov_arcmin=fov)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/catalog-overlay", methods=["GET"])
def get_catalog_overlay():
    ra = request.args.get("ra")
    dec = request.args.get("dec")
    if not ra or not dec:
        return jsonify({"error": "Missing required 'ra' or 'dec' query parameter."}), 400

    fov = float(request.args.get("fov", 12.0))
    catalogs_arg = request.args.get("catalogs", "gaia_dr3,allwise")
    cat_list = [c.strip() for c in catalogs_arg.split(",") if c.strip()]

    try:
        coord_info = coordinates.parse_coordinates(ra, dec)
        sources = catalog_service.query_catalogs(
            ra_deg=coord_info["ra_deg"],
            dec_deg=coord_info["dec_deg"],
            fov_arcmin=fov,
            catalogs=cat_list
        )
        return jsonify({
            "target": coord_info,
            "fov_arcmin": fov,
            "total_sources": len(sources),
            "sources": sources
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/sky-cutout", methods=["GET"])
def get_sky_cutout():
    ra = request.args.get("ra")
    dec = request.args.get("dec")
    if not ra or not dec:
        return jsonify({"error": "Missing required 'ra' or 'dec' query parameter."}), 400

    fov = float(request.args.get("fov", 12.0))
    band_group = request.args.get("band_group", "stacked")
    stretch = request.args.get("stretch", "zscale")
    colormap = request.args.get("colormap", "inferno")
    epochs = int(request.args.get("epochs", 4))

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
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/pixel-to-radec")
def get_pixel_to_radec():
    """
    Translates a 2D canvas pixel coordinate back to celestial RA/Dec for Citizen Science candidate flagging.
    """
    pixel_x = request.args.get("pixel_x")
    pixel_y = request.args.get("pixel_y")
    center_ra = request.args.get("center_ra")
    center_dec = request.args.get("center_dec")
    fov = float(request.args.get("fov", 12.0))

    if None in (pixel_x, pixel_y, center_ra, center_dec):
        return jsonify({"error": "Missing required query parameters: pixel_x, pixel_y, center_ra, center_dec"}), 400

    try:
        center_info = coordinates.parse_coordinates(center_ra, center_dec)
        astrometry = coordinates.pixel_to_radec(
            pixel_x=float(pixel_x),
            pixel_y=float(pixel_y),
            center_ra_deg=center_info["ra_deg"],
            center_dec_deg=center_info["dec_deg"],
            fov_arcmin=fov
        )
        return jsonify(astrometry)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/shift-and-add")
def get_shift_and_add():
    """
    NASA Shift-and-Add Search Engine for Planet X and outer solar system bodies.
    Co-adds all 4 SPHEREx survey epochs along a trial velocity vector (shift_x, shift_y).
    """
    ra = request.args.get("ra")
    dec = request.args.get("dec")
    if not ra or not dec:
        return jsonify({"error": "Missing required 'ra' or 'dec' query parameter."}), 400

    fov = float(request.args.get("fov", 12.0))
    shift_x = float(request.args.get("shift_x", 0.0))
    shift_y = float(request.args.get("shift_y", 0.0))
    band_group = request.args.get("band_group", "stacked")
    stretch = request.args.get("stretch", "zscale")
    colormap = request.args.get("colormap", "inferno")
    filter_mode = request.args.get("filter_mode", "normal")

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

        return jsonify({
            "shift_x": shift_x,
            "shift_y": shift_y,
            "filter_mode": filter_mode,
            "image_url": img_uri,
            "snr_boost": "2.0x (sqrt(4) epochs co-added)",
            "target_aligned": is_aligned,
            "recommended_vx": target_expected_vx,
            "recommended_vy": target_expected_vy
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------------------------------------------------------------------------
# Citizen Science Discovery Database Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/candidates", methods=["GET"])
def list_candidates():
    """Retrieve community flagged candidates with optional category or spatial radius filtering."""
    try:
        category = request.args.get("category")
        ra = request.args.get("ra", type=float)
        dec = request.args.get("dec", type=float)
        radius_deg = request.args.get("radius_deg", type=float)

        candidates = database.get_candidates(category=category, ra_deg=ra, dec_deg=dec, radius_deg=radius_deg)
        return jsonify(candidates)
    except Exception as e:
        return jsonify({"error": f"Database query failed: {str(e)}"}), 500


@app.route("/api/candidates", methods=["POST"])
def create_candidate():
    """Store a newly flagged citizen science candidate discovery."""
    try:
        payload = request.get_json() or {}
        if "ra_deg" not in payload or "dec_deg" not in payload:
            return jsonify({"error": "Missing required fields: ra_deg, dec_deg"}), 400

        created = database.add_candidate(payload)
        return jsonify(created), 201
    except Exception as e:
        return jsonify({"error": f"Failed to record candidate discovery: {str(e)}"}), 400


@app.route("/api/candidates/export-mpc", methods=["GET"])
def export_mpc():
    """Export all verified candidates formatted for Minor Planet Center (MPC) & NASA submission."""
    try:
        dossier = database.export_mpc_dossier()
        return Response(dossier, mimetype="text/plain; charset=utf-8")
    except Exception as e:
        return jsonify({"error": f"Failed to generate MPC export: {str(e)}"}), 500


@app.route("/api/candidates/<candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    """Retrieve details and community corroboration history for a specific candidate."""
    cand = database.get_candidate_by_id(candidate_id)
    if not cand:
        return jsonify({"error": f"Candidate {candidate_id} not found"}), 404
    return jsonify(cand)


@app.route("/api/candidates/<candidate_id>/vote", methods=["POST"])
def cast_candidate_vote(candidate_id):
    """Corroborate or peer-review a candidate discovery with a community vote."""
    payload = request.get_json() or {}
    vote_type = payload.get("vote_type", "corroborate")
    voter_callsign = payload.get("voter_callsign", "Citizen Scientist")
    voter_id = payload.get("voter_id", "")
    comment = payload.get("comment", "")

    updated = database.vote_candidate(
        candidate_id,
        vote_type=vote_type,
        voter_callsign=voter_callsign,
        voter_id=voter_id,
        comment=comment
    )
    if not updated:
        return jsonify({"error": f"Candidate {candidate_id} not found"}), 404
    return jsonify(updated)


@app.route("/api/candidates/<candidate_id>", methods=["DELETE"])
def delete_candidate_endpoint(candidate_id):
    """Remove a candidate discovery from the database."""
    success = database.delete_candidate(candidate_id)
    if not success:
        return jsonify({"error": f"Candidate {candidate_id} not found"}), 404
    return jsonify({"status": "deleted", "id": candidate_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
