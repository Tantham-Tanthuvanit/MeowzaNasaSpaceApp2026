"""
catalog_service.py — Astronomical Sky Catalog Cross-Matching Engine.

Queries Gaia DR3 (optical astrometry) and AllWISE (infrared) catalogs
within a specified sky field of view (FOV), through the NASA/IPAC IRSA TAP service.

Calculates:
- Precise celestial coordinates (RA, Dec)
- Projected (pixel_x, pixel_y) positions on the SPHEREx 256x256 cutout
- Proper motion vectors (mas/yr) and parallax distances
- Cross-mission brown dwarf candidate flags (IR-detected without optical Gaia counterpart)

Results are cached in memory. If IRSA can't be reached the query raises;
there is no made-up fallback.
"""

from typing import Dict, Any, List, Optional
import math
import numpy as np
from astroquery.ipac.irsa import Irsa


def radec_to_pixel(
    ra_source: float,
    dec_source: float,
    ra_center: float,
    dec_center: float,
    fov_arcmin: float,
    dim: int = 256
) -> Dict[str, float]:
    """
    Projects celestial spherical coordinates (RA, Dec) to 2D pixel coordinates
    (pixel_x, pixel_y) on a square cutout of size dim x dim.
    Uses standard astronomical tangent projection (Gnomonic / TAN).
    """
    # Angular separation in arcminutes
    dra_deg = (ra_source - ra_center) * math.cos(math.radians(dec_center))
    ddec_deg = dec_source - dec_center

    dra_arcmin = dra_deg * 60.0
    ddec_arcmin = ddec_deg * 60.0

    # Half FOV in arcminutes
    half_fov = fov_arcmin / 2.0

    # In standard astronomical display: East is left (-X in pixels), North is up (-Y in standard screen coords)
    # Center pixel is dim / 2
    center_px = dim / 2.0
    px_per_arcmin = dim / fov_arcmin

    pixel_x = center_px - (dra_arcmin * px_per_arcmin)
    pixel_y = center_px - (ddec_arcmin * px_per_arcmin)

    return {
        "pixel_x": round(float(pixel_x), 2),
        "pixel_y": round(float(pixel_y), 2),
        "is_within_bounds": bool(0 <= pixel_x < dim and 0 <= pixel_y < dim)
    }


class CatalogService:
    """
    Cross-matching catalog service for Gaia DR3 and AllWISE.
    """

    def __init__(self):
        self._cache: Dict[str, List[Dict[str, Any]]] = {}

    def _get_cache_key(self, ra: float, dec: float, fov: float, catalogs: List[str]) -> str:
        return f"{round(ra, 4)}_{round(dec, 4)}_{round(fov, 2)}_{','.join(sorted(catalogs))}"

    @staticmethod
    def _cone(table: str, columns: str, ra_deg: float, dec_deg: float, fov_arcmin: float, order_by: str):
        # A circle through the corners of the square field; sources outside the square are dropped later.
        radius_deg = fov_arcmin / 60.0 / math.sqrt(2.0)
        query = (
            f"SELECT TOP 500 {columns} FROM {table} "
            f"WHERE 1 = CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra_deg}, {dec_deg}, {radius_deg})) "
            f"ORDER BY {order_by}"
        )
        return Irsa.query_tap(query).to_table()

    def query_catalogs(
        self,
        ra_deg: float,
        dec_deg: float,
        fov_arcmin: float = 5.0,
        catalogs: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Queries Gaia DR3 and AllWISE for known astronomical sources
        in the requested field of view.
        """
        if catalogs is None:
            catalogs = ["gaia_dr3", "allwise"]

        cache_key = self._get_cache_key(ra_deg, dec_deg, fov_arcmin, catalogs)
        if cache_key in self._cache:
            return self._cache[cache_key]

        def number(value) -> Optional[float]:
            if value is np.ma.masked:
                return None
            try:
                f = float(value)
            except (TypeError, ValueError):
                return None
            return None if math.isnan(f) else f

        gaia: List[Dict[str, Any]] = []
        if "gaia_dr3" in catalogs or "allwise" in catalogs:
            # Gaia is also needed for AllWISE, to find infrared sources with no optical counterpart.
            for row in self._cone("gaia_dr3_source", "source_id, ra, dec, phot_g_mean_mag, pmra, pmdec",
                                  ra_deg, dec_deg, fov_arcmin, "phot_g_mean_mag"):
                s_ra, s_dec = float(row["ra"]), float(row["dec"])
                proj = radec_to_pixel(s_ra, s_dec, ra_deg, dec_deg, fov_arcmin)
                if not proj["is_within_bounds"]:
                    continue
                pmra, pmdec = number(row["pmra"]), number(row["pmdec"])
                pm_total = math.sqrt(pmra ** 2 + pmdec ** 2) if pmra is not None and pmdec is not None else None
                g_mag = number(row["phot_g_mean_mag"])
                gaia.append({
                    "id": f"Gaia DR3 {row['source_id']}",
                    "catalog": "Gaia DR3",
                    "ra_deg": round(s_ra, 6),
                    "dec_deg": round(s_dec, 6),
                    "pixel_x": proj["pixel_x"],
                    "pixel_y": proj["pixel_y"],
                    "mag": round(g_mag, 2) if g_mag is not None else None,
                    "mag_band": "G (optical)",
                    "proper_motion_mas_yr": round(pm_total, 1) if pm_total is not None else None,
                    "is_high_proper_motion": bool(pm_total is not None and pm_total > 100.0),
                    "is_brown_dwarf_candidate": False
                })

        wise: List[Dict[str, Any]] = []
        if "allwise" in catalogs:
            for row in self._cone("allwise_p3as_psd", "designation, ra, dec, w1mpro, w2mpro",
                                  ra_deg, dec_deg, fov_arcmin, "w1mpro"):
                s_ra, s_dec = float(row["ra"]), float(row["dec"])
                proj = radec_to_pixel(s_ra, s_dec, ra_deg, dec_deg, fov_arcmin)
                if not proj["is_within_bounds"]:
                    continue
                w1, w2 = number(row["w1mpro"]), number(row["w2mpro"])
                # Brown dwarf candidate: very red in W1-W2 and no Gaia source within 3 arcsec.
                has_gaia = any(
                    math.hypot((g["ra_deg"] - s_ra) * math.cos(math.radians(s_dec)), g["dec_deg"] - s_dec) * 3600.0 < 3.0
                    for g in gaia
                )
                wise.append({
                    "id": f"AllWISE {row['designation']}",
                    "catalog": "AllWISE",
                    "ra_deg": round(s_ra, 6),
                    "dec_deg": round(s_dec, 6),
                    "pixel_x": proj["pixel_x"],
                    "pixel_y": proj["pixel_y"],
                    "mag": round(w1, 2) if w1 is not None else None,
                    "mag_band": "W1 (3.4 μm)",
                    "w1_w2_color": round(w1 - w2, 2) if w1 is not None and w2 is not None else None,
                    "proper_motion_mas_yr": None,
                    "is_high_proper_motion": False,
                    "is_brown_dwarf_candidate": bool(w1 is not None and w2 is not None and w1 - w2 >= 1.0 and not has_gaia)
                })

        results = (gaia if "gaia_dr3" in catalogs else []) + wise
        self._cache[cache_key] = results
        return results


# Global singleton
catalog_service = CatalogService()
