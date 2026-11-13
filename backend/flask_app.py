"""
flask_app.py — Flask Application Entry Point for NASA SPHEREx Sky Viewer.

Alternative Flask runner implementing identical REST API endpoints:
- /api/presets
- /api/sky-cutout
- /api/bands
- /api/health
"""

import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import coordinates
from data_loader import SPHERExDataLoader, SPHEREX_ARRAYS

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
        "detector_arrays": SPHEREX_ARRAYS
    })


@app.route("/api/sky-cutout", methods=["GET"])
def get_sky_cutout():
    ra = request.args.get("ra")
    dec = request.args.get("dec")
    if not ra or not dec:
        return jsonify({"error": "Missing required 'ra' or 'dec' query parameter."}), 400

    fov = float(request.args.get("fov", 5.0))
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
