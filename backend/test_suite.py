"""
test_suite.py — Automated Verification Suite for SPHEREx Sky Viewer.

Offline tests (always run):
1. Coordinate parsing across sexagesimal and decimal formats.
2. Image processor contrast stretching and difference imaging.
3. SPHEREx image bookkeeping: DR1/QR3 dedupe, visit grouping, frame selection,
   102-channel spectrum binning and display orientation.
4. API mapping of download progress (202) and missing data (404).

Live tests (set LIVE_TESTS=1; need network, and backend/.env for Supabase):
5. Real IRSA TAP queries for SPHEREx images and Gaia DR3 / AllWISE.
6. Candidate and project round trips through Supabase.
"""

import os
import unittest
from unittest import mock

import numpy as np
from fastapi.testclient import TestClient

import coordinates
import data_loader
import image_processor
import main

LIVE = os.environ.get("LIVE_TESTS") == "1"
WISE_0855 = (133.795129, -7.245147)


class TestCoordinatesEngine(unittest.TestCase):
    """Test celestial coordinate parsing."""

    def test_sexagesimal_parsing(self):
        res = coordinates.parse_coordinates("08h55m10.831s", "-07d14m42.53s")
        self.assertAlmostEqual(res["ra_deg"], 133.795, places=2)
        self.assertAlmostEqual(res["dec_deg"], -7.245, places=2)
        self.assertNotIn("matched_preset", res)

    def test_decimal_degrees_parsing(self):
        res = coordinates.parse_coordinates("269.452", "4.693")
        self.assertAlmostEqual(res["ra_deg"], 269.452, places=2)
        self.assertAlmostEqual(res["dec_deg"], 4.693, places=2)

    def test_pixel_to_radec_center(self):
        res = coordinates.pixel_to_radec(128, 128, *WISE_0855, fov_arcmin=5.0)
        self.assertAlmostEqual(res["ra_deg"], WISE_0855[0], places=5)
        self.assertAlmostEqual(res["dec_deg"], WISE_0855[1], places=5)


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
        arr = np.arange(64 * 64, dtype=np.float32).reshape(64, 64)
        uri = image_processor.array_to_base64_data_uri(arr)
        self.assertTrue(uri.startswith("data:image/png;base64,"))


def img(uri, detector, mjd):
    return {"uri": uri, "detector": detector, "mjd": mjd}


class TestSpherexBookkeeping(unittest.TestCase):
    """Pure helpers in data_loader, with fixed rows (no network)."""

    def test_dedupe_prefers_dr1(self):
        rows = [img("ibe/data/spherex/qr3/a.fits", 3, 60800.1), img("ibe/data/spherex/dr1/a.fits", 3, 60800.1),
                img("ibe/data/spherex/dr1/b.fits", 4, 60800.1)]
        out = data_loader.dedupe_images(rows)
        self.assertEqual(len(out), 2)
        self.assertIn("ibe/data/spherex/dr1/a.fits", [i["uri"] for i in out])

    def test_group_visits_splits_on_gaps(self):
        rows = [img("c", 1, 60989.0), img("a", 1, 60800.0), img("b", 1, 60800.5), img("d", 1, 60993.0), img("e", 1, 61021.0)]
        visits = data_loader.group_visits(rows, gap_days=10)
        self.assertEqual([[i["uri"] for i in v] for v in visits], [["a", "b"], ["c", "d"], ["e"]])

    def test_select_for_frames_picks_closest_to_median(self):
        visit = [img("d1-early", 1, 100.0), img("d1-mid", 1, 102.0), img("d1-late", 1, 104.5), img("d2", 2, 101.0)]
        chosen = data_loader.select_for_frames([visit], [1, 2, 3])
        self.assertEqual([i["uri"] for i in chosen[0]], ["d1-mid", "d2"])

    def test_build_spectrum_bins_into_102_channels(self):
        centers = [0.75 + 0.04 * i for i in range(102)]
        cutouts = [
            {"detector": 1, "wavelength_um": centers[3] + 0.001, "center_flux": 2.0, "obs_mjd": 60800.0},
            {"detector": 1, "wavelength_um": centers[3] - 0.001, "center_flux": 4.0, "obs_mjd": 60990.0},
            {"detector": 2, "wavelength_um": centers[20], "center_flux": None, "obs_mjd": 60990.0},
        ]
        spec = data_loader.build_spectrum(cutouts, centers)
        self.assertEqual(len(spec["channels"]), 102)
        self.assertEqual(spec["channels"][3]["flux_mjy_sr"], 3.0)
        self.assertEqual(spec["channels"][3]["n_measurements"], 2)
        self.assertIsNone(spec["channels"][20]["flux_mjy_sr"])
        self.assertEqual(len(spec["measurements"]), 2)

    def test_grid_is_odd_and_centered(self):
        n = data_loader.grid_size(5.0)
        self.assertEqual(n % 2, 1)
        w = data_loader.target_wcs(*WISE_0855, n)
        x, y = w.world_to_pixel_values(*WISE_0855)
        self.assertAlmostEqual(float(x), n // 2, places=6)
        self.assertAlmostEqual(float(y), n // 2, places=6)

    def test_crop_to_fov_preserves_center(self):
        n15 = data_loader.grid_size(15.0)
        arr = np.zeros((n15, n15), dtype=np.float32)
        arr[n15 // 2, n15 // 2] = 42.0
        for fov in (3.0, 5.0, 8.0, 12.0, 15.0):
            cropped = data_loader.crop_to_fov(arr, fov)
            nf = data_loader.grid_size(fov)
            self.assertEqual(cropped.shape, (nf, nf))
            self.assertEqual(float(cropped[nf // 2, nf // 2]), 42.0)

    def test_render_puts_north_up(self):
        arr = np.zeros((49, 49), dtype=np.float32)
        arr[-1, :] = 100.0  # last FITS row is the north edge
        from PIL import Image
        import io
        png = Image.open(io.BytesIO(data_loader.render_png(arr, "linear", "grayscale")))
        self.assertEqual(png.size, (256, 256))
        px = np.asarray(png)
        self.assertGreater(int(px[0, 128]), int(px[-1, 128]))


class TestIrsaRetry(unittest.TestCase):
    """IRSA's occasional 503s are retried; real client errors are not."""

    def _responses(self, *codes):
        out = []
        for code in codes:
            r = mock.Mock(status_code=code)
            r.raise_for_status.side_effect = None if code < 400 else data_loader.requests.HTTPError(str(code))
            out.append(r)
        return out

    def test_503_then_ok(self):
        with mock.patch.object(data_loader.requests, "get", side_effect=self._responses(503, 200)) as get, \
                mock.patch.object(data_loader.time, "sleep") as sleep:
            self.assertEqual(data_loader._get_with_retry("u").status_code, 200)
        self.assertEqual(get.call_count, 2)
        sleep.assert_called_once_with(10)

    def test_gives_up_after_retries(self):
        with mock.patch.object(data_loader.requests, "get", side_effect=self._responses(503, 503, 503, 503)), \
                mock.patch.object(data_loader.time, "sleep"):
            with self.assertRaises(data_loader.requests.HTTPError):
                data_loader._get_with_retry("u")

    def test_404_is_not_retried(self):
        with mock.patch.object(data_loader.requests, "get", side_effect=self._responses(404)) as get:
            with self.assertRaises(data_loader.requests.HTTPError):
                data_loader._get_with_retry("u")
        self.assertEqual(get.call_count, 1)


class TestDownloadQueue(unittest.TestCase):
    """Flipbook images jump ahead of a big spectrum download from another spot."""

    def setUp(self):
        with mock.patch.object(data_loader.threading, "Thread"):  # no worker threads in this test
            self.loader = data_loader.SPHERExDataLoader()
        patcher = mock.patch.object(data_loader, "get_client")
        patcher.start()
        self.addCleanup(patcher.stop)

    def _order(self):
        out = []
        while not self.loader._queue.empty():
            priority, _, pos, image = self.loader._queue.get()
            if self.loader._queued.get((pos["position_key"], image["uri"])) == priority:
                out.append(image["uri"])
        return out

    def test_flipbook_goes_first(self):
        spectrum_spot = {"position_key": "A"}
        flipbook_spot = {"position_key": "B"}
        self.loader._enqueue(spectrum_spot, [img(f"a{i}", 1, i) for i in range(5)], priority=1)
        self.loader._enqueue(flipbook_spot, [img("b0", 1, 0), img("b1", 2, 0)], priority=0)
        self.assertEqual(self._order(), ["b0", "b1", "a0", "a1", "a2", "a3", "a4"])

    def test_requeue_at_higher_priority_counts_once(self):
        spot = {"position_key": "A"}
        self.loader._enqueue(spot, [img("a0", 1, 0), img("a1", 1, 0)], priority=1)
        self.loader._enqueue(spot, [img("a1", 1, 0)], priority=0)
        self.assertEqual(self.loader._pending["A"], 2)
        self.assertEqual(self._order(), ["a1", "a0"])

    def test_failed_images_do_not_block(self):
        spot = {"position_key": "A"}
        self.loader._failed.add(("A", "bad"))
        with mock.patch.object(self.loader, "_cached", return_value={"good": {"irsa_uri": "good"}}):
            cached = self.loader._require(spot, [img("good", 1, 0), img("bad", 1, 0)], priority=0)
        self.assertIn("good", cached)


class TestApiMapping(unittest.TestCase):
    """The API answers 202 while downloading and 404 when SPHEREx has nothing."""

    def setUp(self):
        self.client = TestClient(main.app)

    def test_not_ready_is_202_with_progress(self):
        with mock.patch.object(main.loader, "get_sky_patch", side_effect=data_loader.NotReady("downloading", 5, 24)):
            res = self.client.get("/api/sky-cutout", params={"ra": "133.795", "dec": "-7.245"})
        self.assertEqual(res.status_code, 202)
        self.assertEqual(res.json()["cached_images"], 5)
        self.assertEqual(res.json()["total_images"], 24)

    def test_no_data_is_404(self):
        with mock.patch.object(main.loader, "get_spectrum", side_effect=data_loader.NoData("nothing here")):
            res = self.client.get("/api/spectrum", params={"ra": "1", "dec": "1"})
        self.assertEqual(res.status_code, 404)

    def test_presets_and_element_density_are_gone(self):
        self.assertEqual(self.client.get("/api/presets").status_code, 404)
        self.assertEqual(self.client.get("/api/element-density", params={"ra": "1", "dec": "1"}).status_code, 404)

    def test_bands_lists_detectors_only(self):
        body = self.client.get("/api/bands").json()
        self.assertEqual(len(body["detector_arrays"]), 6)
        self.assertNotIn("elements", body)


@unittest.skipUnless(LIVE, "set LIVE_TESTS=1 to query IRSA and Supabase")
class TestLive(unittest.TestCase):

    def test_irsa_has_spherex_images_of_wise_0855(self):
        images = data_loader.query_images(*WISE_0855)
        self.assertGreater(len(images), 100)
        self.assertEqual({i["detector"] for i in images}, {1, 2, 3, 4, 5, 6})
        self.assertGreaterEqual(len(data_loader.group_visits(images)), 2)

    def test_wise_0855_is_a_brown_dwarf_candidate(self):
        from catalog_service import catalog_service
        sources = catalog_service.query_catalogs(*WISE_0855, fov_arcmin=5.0)
        central = [s for s in sources if s["is_brown_dwarf_candidate"] and abs(s["pixel_x"] - 128) < 6 and abs(s["pixel_y"] - 128) < 6]
        self.assertTrue(central, "WISE 0855 should be red in W1-W2 with no Gaia counterpart")

    def test_candidate_and_project_round_trip(self):
        client = TestClient(main.app)
        cand = client.post("/api/candidates", json={"ra_deg": 10.0, "dec_deg": 20.0, "category": "asteroid", "notes": "test"}).json()
        try:
            vote_url = f"/api/candidates/{cand['id']}/vote"
            self.assertEqual(client.post(vote_url, json={"comment": "no voter id"}).status_code, 422)
            voted = client.post(vote_url, json={"voter_id": "test-a", "comment": "test"}).json()
            self.assertEqual((voted["upvotes"], voted["user_voted"]), (1, True))
            self.assertNotIn("voter_id", voted["votes"][0])
            # The same voter again changes nothing; a second voter counts.
            self.assertEqual(client.post(vote_url, json={"voter_id": "test-a"}).json()["upvotes"], 1)
            self.assertEqual(client.post(vote_url, json={"voter_id": "test-b"}).json()["upvotes"], 2)
            listed = {c["id"]: c for c in client.get("/api/candidates", params={"voter_id": "test-a"}).json()}
            self.assertTrue(listed[cand["id"]]["user_voted"])
            unvoted = client.post(vote_url, json={"voter_id": "test-a", "vote_type": "unvote"}).json()
            self.assertEqual((unvoted["upvotes"], unvoted["user_voted"]), (1, False))
            self.assertIn(f"SPX-{cand['id']:06d}", client.get("/api/candidates/export-mpc").text)
        finally:
            self.assertEqual(client.delete(f"/api/candidates/{cand['id']}").status_code, 200)

        proj = client.post("/api/projects", json={"name": "test", "color": "#FF8A3D", "ra_deg": 10.0, "dec_deg": 20.0}).json()
        try:
            self.assertEqual(proj["bands"], [1, 2, 3, 4, 5, 6])
            moved = client.patch(f"/api/projects/{proj['id']}", json={"ra_deg": 11.0}).json()
            self.assertEqual(moved["ra_deg"], 11.0)
        finally:
            self.assertEqual(client.delete(f"/api/projects/{proj['id']}").status_code, 200)


if __name__ == "__main__":
    unittest.main()
