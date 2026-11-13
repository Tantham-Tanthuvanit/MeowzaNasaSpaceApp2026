"""
test_flask.py — Verify Flask Application Implementation.
"""

import unittest
from flask_app import app


class TestFlaskEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_flask_health(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["status"], "ok")

    def test_flask_presets(self):
        resp = self.client.get("/api/presets")
        self.assertEqual(resp.status_code, 200)
        presets = resp.get_json()
        self.assertEqual(len(presets), 5)

    def test_flask_bands(self):
        resp = self.client.get("/api/bands")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["total_bands"], 102)
        self.assertIn("wavelength_filters", data)
        self.assertIn("elements", data)

    def test_flask_sky_cutout(self):
        resp = self.client.get("/api/sky-cutout?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("target_info", data)
        self.assertIn("epochs", data)
        self.assertEqual(len(data["epochs"]), 4)
<<<<<<< HEAD
        self.assertIn("element_densities", data)
        self.assertIn("available_filters", data)

    def test_flask_element_density(self):
        resp = self.client.get("/api/element-density?ra=08h55m10.831s&dec=-07d14m42.53s&element=H2O")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("element", data)
        self.assertEqual(data["element"]["id"], "H2O")
        self.assertTrue(data["element"]["density_map_url"].startswith("data:image/png;base64,"))

=======
        self.assertIn("catalog_overlay", data)

    def test_flask_catalog_overlay(self):
        resp = self.client.get("/api/catalog-overlay?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("sources", data)
        self.assertIn("total_sources", data)
>>>>>>> test2


if __name__ == "__main__":
    unittest.main()
