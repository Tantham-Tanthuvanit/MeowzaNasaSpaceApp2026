"""
image_processor.py — Scientific Astronomical Image Processing Engine.

Performs contrast stretching (ZScale, Asinh, Linear, Log), multi-epoch
image subtraction (difference imaging for transient & proper-motion detection),
detector band stacking across SPHEREx's 102 near-infrared channels, false-color
RGB synthesis, and export to web-ready PNG / Base64.
"""

from typing import Tuple, Optional, Union, List
import io
import base64
import numpy as np
from PIL import Image
import matplotlib as mpl
from astropy.visualization import ZScaleInterval, AsinhStretch, LinearStretch, LogStretch


def apply_contrast_stretch(
    data: np.ndarray,
    stretch_type: str = "zscale",
    vmin: Optional[float] = None,
    vmax: Optional[float] = None
) -> np.ndarray:
    """
    Applies astronomical contrast stretching to a 2D floating point array,
    scaling pixel intensities into the normalized range [0.0, 1.0].

    Parameters:
      data: 2D numpy array of raw astronomical flux values.
      stretch_type: "zscale", "asinh", "linear", or "log".
      vmin, vmax: Optional manual cutoff thresholds.

    Returns:
      Normalized 2D float array in [0.0, 1.0].
    """
    arr = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    if stretch_type.lower() == "zscale":
        # Professional standard (IRAF/DS9) for sky background & faint sources
        interval = ZScaleInterval(contrast=0.25)
        scale_min, scale_max = interval.get_limits(arr)
        if scale_max <= scale_min:
            scale_min, scale_max = float(np.min(arr)), float(np.max(arr) + 1e-6)
    else:
        scale_min = vmin if vmin is not None else float(np.percentile(arr, 1.0))
        scale_max = vmax if vmax is not None else float(np.percentile(arr, 99.8))
        if scale_max <= scale_min:
            scale_max = scale_min + 1e-6

    # Clip to limits
    clipped = np.clip(arr, scale_min, scale_max)
    norm = (clipped - scale_min) / (scale_max - scale_min)

    if stretch_type.lower() == "asinh":
        stretch = AsinhStretch(a=0.1)
        norm = stretch(norm)
    elif stretch_type.lower() == "log":
        stretch = LogStretch(a=1000)
        norm = stretch(norm)
    # Default is linear after ZScale or MinMax clipping

    return np.clip(norm, 0.0, 1.0)


def compute_difference_image(
    epoch_early: np.ndarray,
    epoch_late: np.ndarray,
    mode: str = "signed"
) -> np.ndarray:
    """
    Computes scientific difference imaging between two observation epochs
    to detect moving objects (proper motion dipoles) and variable stars.

    Parameters:
      epoch_early: Array from the earlier epoch (Epoch 1).
      epoch_late: Array from the later epoch (Epoch 2).
      mode: "signed" (late - early, shows dipoles/transients),
            or "absolute" (|late - early|).

    Returns:
      2D numpy array representing the difference signal.
    """
    diff = epoch_late.astype(np.float64) - epoch_early.astype(np.float64)
    if mode == "absolute":
        return np.abs(diff)
    return diff


def stack_infrared_bands(
    band_cubes: List[np.ndarray],
    weights: Optional[List[float]] = None
) -> np.ndarray:
    """
    Combines multiple infrared band images (e.g. across detector arrays)
    to maximize signal-to-noise ratio (SNR) for detecting ultra-faint brown dwarfs.

    Parameters:
      band_cubes: List of 2D numpy arrays corresponding to SPHEREx bands.
      weights: Optional weighting factors for each band.

    Returns:
      Co-added 2D array.
    """
    if not band_cubes:
        raise ValueError("No band arrays provided for stacking.")

    if weights is None:
        return np.mean(band_cubes, axis=0)
    else:
        norm_weights = np.array(weights) / np.sum(weights)
        stacked = np.zeros_like(band_cubes[0], dtype=np.float64)
        for w, b in zip(norm_weights, band_cubes):
            stacked += w * b
        return stacked


def create_false_color_composite(
    short_band: np.ndarray,
    mid_band: np.ndarray,
    long_band: np.ndarray,
    stretch_type: str = "asinh"
) -> np.ndarray:
    """
    Combines three infrared bands into a 3-channel RGB image:
      - Blue: Short infrared (0.75 - 1.5 μm)
      - Green: Mid infrared (1.5 - 3.0 μm)
      - Red: Long infrared (3.0 - 5.0 μm)
    """
    b = apply_contrast_stretch(short_band, stretch_type=stretch_type)
    g = apply_contrast_stretch(mid_band, stretch_type=stretch_type)
    r = apply_contrast_stretch(long_band, stretch_type=stretch_type)

    rgb = np.stack([r, g, b], axis=-1)  # Shape (H, W, 3)
    return (rgb * 255).astype(np.uint8)


def array_to_png_bytes(
    arr: np.ndarray,
    is_difference: bool = False,
    colormap: str = "inferno",
    stretch_type: str = "zscale"
) -> bytes:
    """
    Converts a 2D or 3D numpy array into high-quality PNG image bytes.
    If is_difference is True, renders with a balanced bipolar color scale
    where zero flux is neutral and positive/negative residuals are colored.
    """
    if arr.ndim == 3 and arr.shape[2] == 3:
        # Already an RGB array
        img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    elif is_difference:
        # Difference image: center at 0
        diff_max = float(np.percentile(np.abs(arr), 99.5))
        if diff_max <= 0:
            diff_max = 1e-4
        norm = np.clip((arr + diff_max) / (2.0 * diff_max), 0.0, 1.0)
        # Apply coolwarm colormap (blue = faded/disappeared, red = appeared/brightened)
        cmap = mpl.colormaps.get("coolwarm", mpl.colormaps["viridis"])
        colored = (cmap(norm)[:, :, :3] * 255).astype(np.uint8)
        img = Image.fromarray(colored, mode="RGB")
    else:
        # Standard astronomical sky view
        norm = apply_contrast_stretch(arr, stretch_type=stretch_type)
        if colormap == "grayscale":
            scaled = (norm * 255).astype(np.uint8)
            img = Image.fromarray(scaled, mode="L")
        else:
            cmap = mpl.colormaps.get(colormap, mpl.colormaps["inferno"])
            colored = (cmap(norm)[:, :, :3] * 255).astype(np.uint8)
            img = Image.fromarray(colored, mode="RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def array_to_base64_data_uri(
    arr: np.ndarray,
    is_difference: bool = False,
    colormap: str = "inferno",
    stretch_type: str = "zscale"
) -> str:
    """
    Encodes an astronomical array directly into a Base64 Data URI string
    (e.g., 'data:image/png;base64,...') for zero-latency client embedding.
    """
    png_bytes = array_to_png_bytes(
        arr,
        is_difference=is_difference,
        colormap=colormap,
        stretch_type=stretch_type
    )
    b64_str = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64_str}"
