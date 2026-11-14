"""
coordinates.py — Celestial Coordinate Engine for SPHEREx Sky Viewer.

Handles parsing, validation, and transformations of celestial coordinates
(Right Ascension and Declination) using Astropy's SkyCoord system.
Supports both sexagesimal strings (e.g., "08h55m10.831s", "-07d14m42.53s")
and decimal degrees (e.g., 133.795129, -7.245147).
"""

from typing import Dict, Any
import re
import math
from astropy.coordinates import SkyCoord
import astropy.units as u


def clean_coordinate_string(val: str) -> str:
    """
    Clean up spaces, colon delimiters, or common typographical discrepancies
    in coordinate strings.
    """
    val = val.strip()
    # Normalize colons "08:55:10.83" to space or standard h/m/s representation if needed
    return val


def parse_coordinates(ra_input: str, dec_input: str) -> Dict[str, Any]:
    """
    Parses celestial Right Ascension and Declination strings or numbers into
    a normalized Astropy SkyCoord object in the ICRS frame.

    Supports:
      - Sexagesimal strings: "08h55m10.831s", "-07d14m42.53s" or "08:55:10.8 -07:14:42.5"
      - Decimal degrees: "133.795129", "-7.245147"
      - Mixed formats

    Returns:
      Dictionary containing:
        - ra_deg: Right Ascension in decimal degrees [0, 360)
        - dec_deg: Declination in decimal degrees [-90, +90]
        - ra_hms: Standard sexagesimal format (hh:mm:ss.sss)
        - dec_dms: Standard sexagesimal format (dd:mm:ss.sss)
        - frame: "icrs"
    """
    ra_str = clean_coordinate_string(str(ra_input))
    dec_str = clean_coordinate_string(str(dec_input))

    # Attempt parsing as decimal degrees first
    try:
        ra_float = float(ra_str)
        dec_float = float(dec_str)
        coord = SkyCoord(ra=ra_float * u.deg, dec=dec_float * u.deg, frame="icrs")
    except ValueError:
        # Not pure floats, parse sexagesimal / string format
        # If units like 'h', 'd', 'm', 's' are present
        has_units = bool(re.search(r'[hdms]', ra_str, re.IGNORECASE))
        if has_units:
            coord = SkyCoord(f"{ra_str} {dec_str}", frame="icrs")
        else:
            # Assume RA is in hourangle (hh:mm:ss or hh mm ss) and Dec in degrees (dd:mm:ss or dd mm ss)
            coord = SkyCoord(f"{ra_str} {dec_str}", unit=(u.hourangle, u.deg), frame="icrs")

    # Format into standardized sexagesimal strings
    ra_hms = str(coord.ra.to_string(unit=u.hour, sep="hms", precision=3, pad=True))
    dec_dms = str(coord.dec.to_string(unit=u.deg, sep="dms", precision=2, pad=True, alwayssign=True))

    return {
        "ra_deg": float(coord.ra.deg),
        "dec_deg": float(coord.dec.deg),
        "ra_hms": ra_hms,
        "dec_dms": dec_dms,
        "frame": "icrs"
    }


def pixel_to_radec(
    pixel_x: float,
    pixel_y: float,
    center_ra_deg: float,
    center_dec_deg: float,
    fov_arcmin: float = 5.0,
    dim: int = 256
) -> Dict[str, Any]:
    """
    Translates 2D canvas pixel coordinates back into celestial Right Ascension and Declination.
    Used for citizen science click-to-flag candidate identification and Minor Planet Center dossiers.
    """
    center_px = dim / 2.0
    deg_per_px = (float(fov_arcmin) / 60.0) / float(dim)
    dx = float(pixel_x) - center_px
    dy = float(pixel_y) - center_px

    dec_rad = math.radians(center_dec_deg)
    cos_dec = max(math.cos(dec_rad), 1e-4)

    delta_ra = -(dx * deg_per_px) / cos_dec
    delta_dec = -(dy * deg_per_px)

    ra_deg = (center_ra_deg + delta_ra) % 360.0
    dec_deg = max(-90.0, min(90.0, center_dec_deg + delta_dec))

    return parse_coordinates(str(ra_deg), str(dec_deg))

