"""
test_suite.py — Automated Verification Suite for SPHEREx Sky Viewer.

Tests:
1. Coordinate parsing across sexagesimal and decimal formats.
2. Preset target resolution for all 5 NASA challenge benchmarks:
   - WISE 0855
   - Barnard's Star
   - Epsilon Indi B
   - RW Aurigae
   - R Draconis
3. Image processor contrast stretching and difference imaging.
4. 102-band infrared layering and spectrum generation.
5. End-to-end API endpoints test with FastAPI test client.
"""

import sys
import unittest
import numpy as np

import coordinates
import image_processor
import data_loader
from fastapi.testclient import TestClient
from main import app


class TestCoordinatesEngine(unittest.TestCase):
    """Test celestial coordinate parsing and benchmark target identification."""

    def test_sexagesimal_parsing(self):
        res = coordinates.parse_coordinates("08h55m10.831s", "-07d14m42.53s")
        self.assertAlmostEqual(res["ra_deg"], 133.795, places=2)
        self.assertAlmostEqual(res["dec_deg"], -7.245, places=2)
        self.assertEqual(res["matched_preset"], "WISE 0855")

    def test_decimal_degrees_parsing(self):
        res = coordinates.parse_coordinates("269.452", "4.693")
        self.assertAlmostEqual(res["ra_deg"], 269.452, places=2)
        self.assertAlmostEqual(res["dec_deg"], 4.693, places=2)
        self.assertEqual(res["matched_preset"], "Barnard's Star")

    def test_all_five_presets_exist(self):
        preset_names = [p["name"] for p in coordinates.PRESET_TARGETS]
        expected = ["WISE 0855", "Barnard's Star", "Epsilon Indi B", "RW Aurigae", "R Draconis"]
        for exp in expected:
            self.assertIn(exp, preset_names)


class TestImageProcessorEngine(unittest.TestCase):
    """Test scientific contrast stretching and difference imaging."""

    def test_zscale_stretch(self):
        arr = np.linspace(0, 1000, 256 * 256).reshape((256, 256)).astype(np.float32)
        scaled = image_processor.apply_contrast_stretch(arr, stretch_type="zscale")
        self.assertEqual(scaled.shape, (256, 256))
        self.assertGreaterEqual(float(np.min(scaled)), 0.0)
        self.assertLessEqual(float(np.max(scaled)), 1.0)

    def test_difference_imaging(self):
        e1 = np.ones((50, 50), dtype=np.float32) * 10.0
        e2 = np.ones((50, 50), dtype=np.float32) * 10.0
        e2[25, 25] = 50.0  # Transient/proper motion peak
        diff = image_processor.compute_difference_image(e1, e2)
        self.assertEqual(diff[25, 25], 40.0)
        self.assertEqual(diff[0, 0], 0.0)

    def test_base64_export(self):
        arr = np.random.rand(64, 64).astype(np.float32)
        uri = image_processor.array_to_base64_data_uri(arr)
        self.assertTrue(uri.startswith("data:image/png;base64,"))


class TestDataLoaderAndSimulator(unittest.TestCase):
    """Test multi-epoch cutouts and 102-band spectra generation."""

    def setUp(self):
        self.loader = data_loader.SPHERExDataLoader()

    def test_multi_epoch_generation(self):
        data = self.loader.get_sky_patch("08h55m10.831s", "-07d14m42.53s", num_epochs=4)
        self.assertEqual(len(data["epochs"]), 4)
        self.assertTrue(data["difference_image_url"].startswith("data:image/png;base64,"))
        self.assertEqual(len(data["spectrum_preview"]), 102)

    def test_infrared_detector_layering(self):
        # Test stacking across array 4 (methane/water absorption)
        data = self.loader.get_sky_patch("08h55m10.831s", "-07d14m42.53s", band_group="array_4")
        self.assertEqual(len(data["epochs"]), 4)

        # Test false color composite
        data_rgb = self.loader.get_sky_patch("08h55m10.831s", "-07d14m42.53s", band_group="false_color_rgb")
        self.assertEqual(len(data_rgb["epochs"]), 4)


class TestAPIEndpoints(unittest.TestCase):
    """Test FastAPI REST endpoints."""

    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    def test_presets_endpoint(self):
        resp = self.client.get("/api/presets")
        self.assertEqual(resp.status_code, 200)
        presets = resp.json()
        self.assertEqual(len(presets), 5)

    def test_bands_endpoint(self):
        resp = self.client.get("/api/bands")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["total_bands"], 102)

    def test_sky_cutout_endpoint(self):
        resp = self.client.get("/api/sky-cutout?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("target_info", data)
        self.assertIn("epochs", data)
        self.assertIn("difference_image_url", data)
        self.assertIn("spectrum_preview", data)


if __name__ == "__main__":
    unittest.main()
