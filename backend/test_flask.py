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
        self.assertEqual(len(presets), 9)

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
        self.assertIn("element_densities", data)
        self.assertIn("available_filters", data)
        self.assertIn("catalog_overlay", data)

    def test_flask_element_density(self):
        resp = self.client.get("/api/element-density?ra=08h55m10.831s&dec=-07d14m42.53s&element=H2O")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("element", data)
        self.assertEqual(data["element"]["id"], "H2O")
        self.assertTrue(data["element"]["density_map_url"].startswith("data:image/png;base64,"))

    def test_flask_catalog_overlay(self):
        resp = self.client.get("/api/catalog-overlay?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("sources", data)
        self.assertIn("total_sources", data)

    def test_flask_shift_and_add(self):
        resp = self.client.get("/api/shift-and-add?ra=08h55m10.831s&dec=-07d14m42.53s&shift_x=1.3&shift_y=0.7&filter_mode=sharpen")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("image_url", data)
        self.assertTrue(data["target_aligned"])
        self.assertEqual(data["filter_mode"], "sharpen")

    def test_flask_pixel_to_radec(self):
        resp = self.client.get("/api/pixel-to-radec?pixel_x=128&pixel_y=128&center_ra=133.795&center_dec=-7.245&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertAlmostEqual(data["ra_deg"], 133.795, places=2)
        self.assertAlmostEqual(data["dec_deg"], -7.245, places=2)

    def test_flask_candidates_crud_flow(self):
        # 1. List
        resp = self.client.get("/api/candidates")
        self.assertEqual(resp.status_code, 200)
        initial_list = resp.get_json()
        self.assertGreaterEqual(len(initial_list), 3)

        # 2. Create
        payload = {
            "id": "SPX-FLASK-001",
            "ra_deg": 162.328,
            "dec_deg": -53.319,
            "ra_hms": "10h49m18.720s",
            "dec_dms": "-53d19m10.10s",
            "pixel_x": 133.0,
            "pixel_y": 131.0,
            "category": "brown_dwarf",
            "confidence": 5,
            "notes": "Flask test suite candidate.",
            "observer_callsign": "Flask Tester"
        }
        resp = self.client.post("/api/candidates", json=payload)
        self.assertEqual(resp.status_code, 201)
        created = resp.get_json()
        self.assertEqual(created["id"], "SPX-FLASK-001")

        # 3. Retrieve
        resp = self.client.get("/api/candidates/SPX-FLASK-001")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["id"], "SPX-FLASK-001")

        # 4. Vote
        resp = self.client.post("/api/candidates/SPX-FLASK-001/vote", json={
            "vote_type": "corroborate",
            "voter_callsign": "Flask Peer",
            "comment": "Corroborated in test suite"
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["upvotes"], created["upvotes"] + 1)

        # 5. Export MPC
        resp = self.client.get("/api/candidates/export-mpc")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("COD SPX", resp.get_data(as_text=True))
        self.assertIn("SPX-FLASK-001", resp.get_data(as_text=True))

        # 6. Delete
        resp = self.client.delete("/api/candidates/SPX-FLASK-001")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["status"], "deleted")


if __name__ == "__main__":
    unittest.main()
