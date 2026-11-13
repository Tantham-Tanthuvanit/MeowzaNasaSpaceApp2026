"""
coordinates.py — Celestial Coordinate Engine for SPHEREx Sky Viewer.

Handles parsing, validation, and transformations of celestial coordinates
(Right Ascension and Declination) using Astropy's SkyCoord system.
Supports both sexagesimal strings (e.g., "08h55m10.831s", "-07d14m42.53s")
and decimal degrees (e.g., 133.795129, -7.245147).

Also provides pre-configured test targets specified by the NASA Space Apps Challenge:
- WISE 0855 (Fast-moving brown dwarf)
- Barnard's Star (High proper-motion red dwarf)
- Epsilon Indi B (Binary brown dwarf system)
- RW Aurigae (T Tauri variable star)
- R Draconis (Mira-type pulsating variable)
"""

from typing import Dict, Any, List, Optional
import re
import math
import numpy as np
from astropy.coordinates import SkyCoord
import astropy.units as u

# Pre-defined NASA Space Apps Challenge Benchmark Targets
PRESET_TARGETS: List[Dict[str, Any]] = [
    {
        "id": "wise_0855",
        "name": "WISE 0855",
        "category": "Fast-Moving Brown Dwarf",
        "ra": "08h55m10.831s",
        "dec": "-07d14m42.53s",
        "ra_deg": 133.795129,
        "dec_deg": -7.245147,
        "description": "Sub-brown dwarf just 7.4 light-years away exhibiting exceptional proper motion across SPHEREx epochs.",
        "expected_phenomenon": "Rapid spatial shift between epochs (proper motion dipole in difference imaging)."
    },
    {
        "id": "barnards_star",
        "name": "Barnard's Star",
        "category": "High Proper-Motion Star",
        "ra": "17h57m48.498s",
        "dec": "+04d41m36.20s",
        "ra_deg": 269.452075,
        "dec_deg": 4.693389,
        "description": "Red dwarf star with the highest known proper motion of any star relative to our Solar System (10.3 arcsec/yr).",
        "expected_phenomenon": "Noticeable position drift across six-month mission epochs."
    },
    {
        "id": "epsilon_indi_b",
        "name": "Epsilon Indi B",
        "category": "Brown Dwarf Binary Pair",
        "ra": "22h04m10.50s",
        "dec": "-56d46m58.0s",
        "ra_deg": 331.043750,
        "dec_deg": -56.782778,
        "description": "Nearby binary system consisting of two methane-rich brown dwarfs orbiting Epsilon Indi A.",
        "expected_phenomenon": "Co-moving brown dwarf signatures with distinct methane absorption in near-IR bands."
    },
    {
        "id": "rw_aurigae",
        "name": "RW Aurigae",
        "category": "Variable Star",
        "ra": "05h07m49.57s",
        "dec": "+30d24m05.10s",
        "ra_deg": 76.956542,
        "dec_deg": 30.401417,
        "description": "Classical T Tauri binary variable system undergoing dramatic, multi-epoch dimming events caused by circumstellar dust disks.",
        "expected_phenomenon": "Large flux variation and strong residual in difference images without spatial shift."
    },
    {
        "id": "r_draconis",
        "name": "R Draconis",
        "category": "Mira Variable Star",
        "ra": "16h32m40.23s",
        "dec": "+66d45m17.90s",
        "ra_deg": 248.167625,
        "dec_deg": 66.754972,
        "description": "Pulsating red giant star with strong cyclical variations in brightness and heavy infrared excess.",
        "expected_phenomenon": "Periodic brightness change highlighting variability over 6-month SPHEREx cadences."
    },
    {
        "id": "sedna_90377",
        "name": "90377 Sedna",
        "category": "Planet X / Extreme TNO",
        "ra": "03h48m15.00s",
        "dec": "+07d47m20.00s",
        "ra_deg": 57.062500,
        "dec_deg": 7.788889,
        "description": "Extreme detached Trans-Neptunian Object with an 11,400-year orbit whose orbital clustering inspired the Planet Nine / Planet X hypothesis.",
        "expected_phenomenon": "Slow outer solar system orbital drift with water & methane ice absorption bands."
    },
    {
        "id": "luhman_16",
        "name": "Luhman 16",
        "category": "Nearby Brown Dwarf Binary",
        "ra": "10h49m18.72s",
        "dec": "-53d19m10.10s",
        "ra_deg": 162.328000,
        "dec_deg": -53.319472,
        "description": "Closest known brown dwarf system to Earth (6.5 light-years away) consisting of an L-dwarf and T-dwarf binary pair with dynamic atmospheric weather.",
        "expected_phenomenon": "High proper motion binary pair with deep near-infrared methane absorption."
    },
    {
        "id": "north_ecliptic_pole",
        "name": "North Ecliptic Pole",
        "category": "SPHEREx Deep Field",
        "ra": "18h00m00.00s",
        "dec": "+66d33m38.50s",
        "ra_deg": 270.000000,
        "dec_deg": 66.560694,
        "description": "SPHEREx mission northern deep calibration field with maximum survey overlap, highest sensitivity, and ultra-high observation redundancy.",
        "expected_phenomenon": "Ultra-deep stack with dense background sources and minimum background noise."
    },
    {
        "id": "south_ecliptic_pole",
        "name": "South Ecliptic Pole",
        "category": "SPHEREx Deep Field",
        "ra": "06h00m00.00s",
        "dec": "-66d33m38.50s",
        "ra_deg": 90.000000,
        "dec_deg": -66.560694,
        "description": "SPHEREx southern celestial deep survey field utilized for temporal stability and photometric calibration.",
        "expected_phenomenon": "Deep calibration stack with continuous survey coverage."
    }
]


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

    # First, test if input matches one of our known presets by name or id
    lower_query = f"{ra_str} {dec_str}".lower()
    for preset in PRESET_TARGETS:
        if preset["id"] in lower_query or preset["name"].lower() in lower_query:
            return {
                "ra_deg": preset["ra_deg"],
                "dec_deg": preset["dec_deg"],
                "ra_hms": preset["ra"],
                "dec_dms": preset["dec"],
                "frame": "icrs",
                "matched_preset": preset["name"]
            }

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

    # Check coordinate proximity to known NASA Space Apps presets (< 0.05 deg ~ 3 arcmin)
    matched_preset = None
    for preset in PRESET_TARGETS:
        # Euclidean spherical separation approximation for nearby points
        dra = (float(coord.ra.deg) - preset["ra_deg"]) * np.cos(np.radians(preset["dec_deg"]))
        ddec = float(coord.dec.deg) - preset["dec_deg"]
        sep_deg = np.sqrt(dra**2 + ddec**2)
        if sep_deg < 0.05:
            matched_preset = preset["name"]
            break

    return {
        "ra_deg": float(coord.ra.deg),
        "dec_deg": float(coord.dec.deg),
        "ra_hms": ra_hms,
        "dec_dms": dec_dms,
        "frame": "icrs",
        "matched_preset": matched_preset
    }


def get_preset_by_id(preset_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a benchmark preset target by identifier."""
    for preset in PRESET_TARGETS:
        if preset["id"] == preset_id:
            return preset
    return None


def pixel_to_radec(
    pixel_x: float,
    pixel_y: float,
    center_ra_deg: float,
    center_dec_deg: float,
    fov_arcmin: float = 12.0,
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

