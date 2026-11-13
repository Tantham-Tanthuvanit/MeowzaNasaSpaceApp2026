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
        expected = [
            "WISE 0855",
            "Barnard's Star",
            "Epsilon Indi B",
            "RW Aurigae",
            "R Draconis",
            "90377 Sedna",
            "Luhman 16",
            "North Ecliptic Pole",
            "South Ecliptic Pole"
        ]
        for exp in expected:
            self.assertIn(exp, preset_names)
        self.assertEqual(len(coordinates.PRESET_TARGETS), 9)


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


    def test_element_density_maps_generation(self):
        # Verify 6 element density maps generated with high-contrast and translucent overlay URIs
        data = self.loader.get_sky_patch("08h55m10.831s", "-07d14m42.53s")
        self.assertIn("element_densities", data)
        densities = data["element_densities"]["elements"]
        expected_elements = ["H2O", "CH4", "CO2", "CO", "H", "DUST"]
        for elem in expected_elements:
            self.assertIn(elem, densities)
            self.assertTrue(densities[elem]["density_map_url"].startswith("data:image/png;base64,"))
            self.assertTrue(densities[elem]["overlay_map_url"].startswith("data:image/png;base64,"))
            self.assertIn("cm⁻²", densities[elem]["peak_column_density"])
            self.assertGreater(densities[elem]["abundance_pct"], 0)

        # WISE 0855 should have Methane and Water as the dominant components
        self.assertGreater(densities["CH4"]["abundance_pct"], 25.0)
        self.assertGreater(densities["H2O"]["abundance_pct"], 25.0)

    def test_diagnostic_and_narrowband_wavelength_filters(self):
        # Test molecular diagnostics, photometric bands, spectral ratios, and single band
        filters_to_test = [
            "filter_ch4_deep",
            "filter_h2o_ice",
            "filter_h_bra",
            "filter_j",
            "ratio_ch4",
            "diff_hydrogen",
            "band_62"
        ]
        for f in filters_to_test:
            res = self.loader.get_sky_patch("08h55m10.831s", "-07d14m42.53s", band_group=f, num_epochs=2)
            self.assertEqual(len(res["epochs"]), 2)
            self.assertTrue(res["epochs"][0]["image_url"].startswith("data:image/png;base64,"))
            self.assertIn("difference_images", res)
            self.assertIn("shift_and_add", res)

    def test_shift_and_add_and_image_filters(self):
        # Test shift-and-add algorithm and spatial post-processing
        e1 = np.ones((64, 64), dtype=np.float32)
        e2 = np.ones((64, 64), dtype=np.float32)
        coadded = image_processor.perform_shift_and_add([e1, e2], shift_x_per_epoch=1.0, shift_y_per_epoch=0.5)
        self.assertEqual(coadded.shape, (64, 64))

        for mode in ["smooth", "sharpen", "median", "threshold_3sigma"]:
            filtered = image_processor.apply_image_filter(coadded, filter_mode=mode)
            self.assertEqual(filtered.shape, (64, 64))


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
        self.assertEqual(len(presets), 9)

    def test_bands_endpoint(self):
        resp = self.client.get("/api/bands")
        self.assertEqual(resp.status_code, 200)
        json_data = resp.json()
        self.assertEqual(json_data["total_bands"], 102)
        self.assertIn("wavelength_filters", json_data)
        self.assertIn("elements", json_data)

    def test_sky_cutout_endpoint(self):
        resp = self.client.get("/api/sky-cutout?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("target_info", data)
        self.assertIn("epochs", data)
        self.assertIn("difference_image_url", data)
        self.assertIn("spectrum_preview", data)
        self.assertIn("element_densities", data)
        self.assertIn("available_filters", data)
        self.assertIn("catalog_overlay", data)
        self.assertGreater(len(data["catalog_overlay"]), 0)

    def test_element_density_endpoint(self):
        resp = self.client.get("/api/element-density?ra=08h55m10.831s&dec=-07d14m42.53s&element=CH4")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("element", data)
        self.assertEqual(data["element"]["id"], "CH4")
        self.assertTrue(data["element"]["density_map_url"].startswith("data:image/png;base64,"))
        self.assertIn("composition_breakdown", data)

    def test_catalog_overlay_endpoint(self):
        resp = self.client.get("/api/catalog-overlay?ra=08h55m10.831s&dec=-07d14m42.53s&fov=5.0")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("sources", data)
        self.assertIn("total_sources", data)
        self.assertGreater(data["total_sources"], 0)

    def test_shift_and_add_endpoint(self):
        resp = self.client.get("/api/shift-and-add?ra=08h55m10.831s&dec=-07d14m42.53s&shift_x=1.3&shift_y=0.7&filter_mode=smooth")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("image_url", data)
        self.assertTrue(data["target_aligned"])
        self.assertEqual(data["filter_mode"], "smooth")


class TestCatalogService(unittest.TestCase):
    """Test Gaia DR3 and AllWISE catalog cross-matching logic."""

    def test_radec_to_pixel_center(self):
        from catalog_service import radec_to_pixel
        proj = radec_to_pixel(133.795, -7.245, 133.795, -7.245, fov_arcmin=5.0, dim=256)
        self.assertEqual(proj["pixel_x"], 128.0)
        self.assertEqual(proj["pixel_y"], 128.0)
        self.assertTrue(proj["is_within_bounds"])

    def test_brown_dwarf_cross_matching(self):
        from catalog_service import catalog_service
        sources = catalog_service.query_catalogs(133.795129, -7.245147, fov_arcmin=5.0)
        # WISE 0855 should be flagged as brown dwarf candidate
        bd_candidates = [s for s in sources if s.get("is_brown_dwarf_candidate")]
        self.assertGreater(len(bd_candidates), 0)
        self.assertEqual(bd_candidates[0]["catalog"], "AllWISE")


if __name__ == "__main__":
    unittest.main()
