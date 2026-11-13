import React, { useState, useRef, useEffect } from 'react';
import { 
  Eye, 
  Layers, 
  Crosshair, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  AlertTriangle, 
  ExternalLink, 
  Maximize2, 
  Minimize2,
  SplitSquareVertical,
  Compass,
  Satellite,
  Sparkles,
  Info,
  Radio,
  Contrast,
  Sliders,
  Target,
  Zap
} from 'lucide-react';
import { fetchShiftAndAdd } from '../services/api';

export default function SkyViewer({
  epochs = [],
  differenceImageUrl,
  differenceImages = {},
  shiftAndAddData = null,
  targetInfo,
  fov,
  catalogOverlay = [],
  currentEpochIndex,
  viewMode, // 'single', 'diff', 'split', or 'shift'
  onViewModeChange
}) {
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [showCatalogOverlay, setShowCatalogOverlay] = useState(true);
  const [hoveredSource, setHoveredSource] = useState(null);
  
  // Catalog / Candidate Screening Filter: 'all', 'gaia_dr3', 'allwise', 'optical_dropout', 'high_pm'
  const [catalogFilter, setCatalogFilter] = useState('all');
  
  // Visual & Image Enhancement Filters
  const [isInverted, setIsInverted] = useState(false); // WiseView Inverted Negative Mode
  const [imageFilter, setImageFilter] = useState('normal'); // 'normal', 'smooth', 'sharpen', 'high_contrast'
  
  // Epoch Difference Pair Selector Filter: 'e2_minus_e1', 'e3_minus_e1', 'e4_minus_e1', 'e3_minus_e2', 'e4_minus_e3'
  const [diffPair, setDiffPair] = useState('e2_minus_e1');

  // Shift-and-Add Search Engine State (NASA Step 2 Engine)
  const [shiftVx, setShiftVx] = useState(shiftAndAddData?.recommended_vx || 0.0);
  const [shiftVy, setShiftVy] = useState(shiftAndAddData?.recommended_vy || 0.0);
  const [shiftImage, setShiftImage] = useState(shiftAndAddData?.target_stack_url || null);
  const [isShiftAligned, setIsShiftAligned] = useState(Boolean(shiftAndAddData?.recommended_vx));
  const [isShiftLoading, setIsShiftLoading] = useState(false);

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Active FOV value in arcmin (from prop or targetInfo, fallback to 5.0)
  const currentFov = typeof fov === 'number' ? fov : (targetInfo?.fov_arcmin || 5.0);

  const currentEpoch = epochs[currentEpochIndex] || epochs[0] || {};
  const isDiffMode = viewMode === 'diff';
  const isSplitMode = viewMode === 'split';
  const isShiftMode = viewMode === 'shift';

  // Synchronize default shift image when shiftAndAddData updates
  useEffect(() => {
    if (shiftAndAddData?.target_stack_url) {
      setShiftImage(shiftAndAddData.target_stack_url);
      setShiftVx(shiftAndAddData.recommended_vx || 0.0);
      setShiftVy(shiftAndAddData.recommended_vy || 0.0);
    }
  }, [shiftAndAddData]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.75));
  const handleResetZoom = () => setZoomLevel(1.0);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  // Trigger live Shift-and-Add calculation along trial velocity
  const handleRunShiftAndAdd = async (vx, vy) => {
    setShiftVx(vx);
    setShiftVy(vy);
    if (!targetInfo?.ra_hms && !targetInfo?.ra_deg) return;

    setIsShiftLoading(true);
    try {
      const res = await fetchShiftAndAdd({
        ra: (targetInfo.ra_hms || targetInfo.ra_deg).toString(),
        dec: (targetInfo.dec_dms || targetInfo.dec_deg).toString(),
        fov: targetInfo.fov_arcmin || 5.0,
        shiftX: vx,
        shiftY: vy,
        bandGroup: targetInfo.band_group || 'stacked',
        stretch: targetInfo.stretch || 'zscale',
        colormap: targetInfo.colormap || 'inferno',
        filterMode: imageFilter
      });

      if (res?.image_url) {
        setShiftImage(res.image_url);
        setIsShiftAligned(Boolean(res.target_aligned));
      }
    } catch (err) {
      console.error('Shift-and-add calculation error:', err);
    } finally {
      setIsShiftLoading(false);
    }
  };

  // Filter sources according to active catalog & candidate screening filter
  const visibleSources = catalogOverlay.filter((s) => {
    if (catalogFilter === 'all') return true;
    if (catalogFilter === 'gaia_dr3') return s.catalog === 'Gaia DR3';
    if (catalogFilter === 'allwise') return s.catalog === 'AllWISE';
    if (catalogFilter === 'optical_dropout') {
      // Planet X / Cold Brown Dwarf Test: Exclude optical Gaia stars, show only infrared / BD candidates
      return s.catalog !== 'Gaia DR3' || s.is_brown_dwarf_candidate;
    }
    if (catalogFilter === 'high_pm') {
      return (s.proper_motion_mas_yr || 0) >= 100.0;
    }
    return true;
  });

  // Active difference image according to selected epoch pair
  const activeDifferenceUrl = differenceImages[diffPair] || differenceImageUrl;

  // Generate Aladin Lite external URL for active coordinates
  const aladinUrl = targetInfo?.ra_deg && targetInfo?.dec_deg
    ? `https://aladin.cds.unistra.fr/AladinLite/?target=${targetInfo.ra_deg}%20${targetInfo.dec_deg}&fov=${(targetInfo.fov_arcmin || 5.0) / 60.0}&survey=P%2FallWISE%2Fcolor`
    : 'https://aladin.cds.unistra.fr/AladinLite/';

  // CSS Filter string combining Inversion (WiseView) and spatial enhancement
  const getFilterStyle = () => {
    const filters = [];
    if (isInverted) {
      filters.push('invert(1) hue-rotate(180deg)');
    }
    if (imageFilter === 'smooth') {
      filters.push('blur(1.1px) contrast(1.15)');
    } else if (imageFilter === 'sharpen') {
      filters.push('contrast(1.4) brightness(1.05)');
    } else if (imageFilter === 'high_contrast') {
      filters.push('contrast(1.75) saturate(1.25)');
    }
    return filters.join(' ') || undefined;
  };

  return (
    <div ref={containerRef} className="glass-panel p-5 mb-6 flex flex-col relative overflow-hidden">
      {/* 1. Viewer Header: Mode Toggles, WiseView Invert, Tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <div className="bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 flex items-center gap-1">
            <button
              onClick={() => onViewModeChange('single')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                !isDiffMode && !isSplitMode && !isShiftMode
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Step or blink through multi-epoch survey observations"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Multi-Epoch Blink</span>
            </button>

            <button
              onClick={() => onViewModeChange('diff')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                isDiffMode
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Image Subtraction (ΔE) to isolate moving dipoles and variable stars"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Difference Image (ΔE)</span>
            </button>

            <button
              onClick={() => onViewModeChange('split')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                isSplitMode
                  ? 'bg-indigo-500 text-slate-100 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Side-by-side inspection of early vs late survey epochs"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>

            <button
              onClick={() => onViewModeChange('shift')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                isShiftMode
                  ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="NASA Shift-and-Add Search Engine for Planet X and outer solar system bodies"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Shift & Add (Planet X)</span>
            </button>
          </div>

          {/* WiseView Inverted Contrast Toggle (Black stars on white background) */}
          <button
            onClick={() => setIsInverted(!isInverted)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              isInverted
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold shadow-sm shadow-amber-400/20'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="WiseView Inverted Mode: Black stars on white background (standard tool for discovering faint moving dipoles)"
          >
            <Contrast className="w-3.5 h-3.5" />
            <span>Invert (WiseView)</span>
          </button>
        </div>

        {/* Viewport Utilities: Image Filters, Catalog Overlays, Zoom, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Image Post-Processing Enhancement Filter Pills */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700 rounded-lg p-0.5 text-[11px] mono">
            <span className="text-slate-400 px-1.5 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span className="hidden xl:inline">Filter:</span>
            </span>
            {[
              { id: 'normal', label: 'Raw' },
              { id: 'smooth', label: 'Smooth (Gaussian)' },
              { id: 'sharpen', label: 'Sharpen' },
              { id: 'high_contrast', label: 'Hi-Contrast' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setImageFilter(f.id)}
                className={`px-2 py-0.5 rounded transition-all ${
                  imageFilter === f.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Gaia & AllWISE Catalog Overlay Toggle */}
          <button
            onClick={() => setShowCatalogOverlay(!showCatalogOverlay)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              showCatalogOverlay
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Gaia DR3 and AllWISE catalog overlay reticles"
          >
            <Satellite className="w-3.5 h-3.5 text-emerald-400" />
            <span>Catalog Overlays</span>
            {catalogOverlay.length > 0 && (
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono text-emerald-300">
                {visibleSources.length}/{catalogOverlay.length}
              </span>
            )}
          </button>

          {/* Crosshair Button */}
          <button
            onClick={() => setShowCrosshairs(!showCrosshairs)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              showCrosshairs
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Target Crosshairs"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            <button onClick={handleZoomOut} className="p-1 hover:text-cyan-400 text-slate-400" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] mono px-1.5 text-slate-300">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={handleZoomIn} className="p-1 hover:text-cyan-400 text-slate-400" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={handleResetZoom} className="p-1 hover:text-cyan-400 text-slate-400 border-l border-slate-800" title="Reset Zoom">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* CDS Aladin Lite Link */}
          <a
            href={aladinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1 hover:border-cyan-500/40"
            title="Open Coordinates in CDS Aladin Lite / AllWISE"
          >
            <span>Aladin Lite</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 2. Sub-Toolbar: Epoch Difference Pair Selector (Visible in Diff Mode) */}
      {isDiffMode && (
        <div className="mt-3 pt-2 pb-1 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-medium mono">Subtraction Pair:</span>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'e2_minus_e1', label: 'E2 - E1 (6 mo)' },
                { id: 'e3_minus_e1', label: 'E3 - E1 (12 mo)' },
                { id: 'e4_minus_e1', label: 'E4 - E1 (18 mo Full Baseline)' },
                { id: 'e3_minus_e2', label: 'E3 - E2 (6 mo)' },
                { id: 'e4_minus_e3', label: 'E4 - E3 (6 mo)' }
              ].map((pair) => (
                <button
                  key={pair.id}
                  onClick={() => setDiffPair(pair.id)}
                  className={`px-2.5 py-1 rounded text-xs mono transition-all border ${
                    diffPair === pair.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {pair.label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mono">
            <span className="text-blue-400 font-semibold">Blue (-Δ)</span>: Shifted away &bull;{' '}
            <span className="text-red-400 font-semibold">Red (+Δ)</span>: Appeared
          </div>
        </div>
      )}

      {/* 3. Sub-Toolbar: Shift-and-Add Search Engine Controls (Visible in Shift Mode) */}
      {isShiftMode && (
        <div className="mt-3 p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-semibold mono">Trial Velocity:</span>
              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-700 mono">
                <span>Vx:</span>
                <input
                  type="range"
                  min="-3.0"
                  max="3.0"
                  step="0.05"
                  value={shiftVx}
                  onChange={(e) => handleRunShiftAndAdd(parseFloat(e.target.value), shiftVy)}
                  className="w-20 accent-emerald-400"
                />
                <span className="text-emerald-300 w-10 text-right">{shiftVx.toFixed(2)}</span>
                <span className="text-slate-500 text-[10px]">px/ep</span>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded border border-slate-700 mono">
                <span>Vy:</span>
                <input
                  type="range"
                  min="-3.0"
                  max="3.0"
                  step="0.05"
                  value={shiftVy}
                  onChange={(e) => handleRunShiftAndAdd(shiftVx, parseFloat(e.target.value))}
                  className="w-20 accent-emerald-400"
                />
                <span className="text-emerald-300 w-10 text-right">{shiftVy.toFixed(2)}</span>
                <span className="text-slate-500 text-[10px]">px/ep</span>
              </div>
            </div>

            {/* Quick Velocity Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Presets:</span>
              <button
                onClick={() => handleRunShiftAndAdd(0.0, 0.0)}
                className={`px-2 py-0.5 rounded text-[11px] mono border ${
                  shiftVx === 0.0 && shiftVy === 0.0
                    ? 'bg-slate-700 border-slate-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Stationary (0, 0)
              </button>

              <button
                onClick={() => handleRunShiftAndAdd(0.25, 0.15)}
                className={`px-2 py-0.5 rounded text-[11px] mono border ${
                  Math.abs(shiftVx - 0.25) < 0.05 && Math.abs(shiftVy - 0.15) < 0.05
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Orbital velocity typical of Sedna and distant Kuiper Belt Objects"
              >
                🪐 Planet X / TNO (0.25, 0.15)
              </button>

              <button
                onClick={() => handleRunShiftAndAdd(1.30, 0.70)}
                className={`px-2 py-0.5 rounded text-[11px] mono border ${
                  Math.abs(shiftVx - 1.30) < 0.05 && Math.abs(shiftVy - 0.70) < 0.05
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Proper motion velocity for fast-moving nearby brown dwarf"
              >
                ⚡ Fast Brown Dwarf (1.30, 0.70)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isShiftAligned && (
              <span className="bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-[11px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Target Co-Added & Aligned!</span>
              </span>
            )}
            <span className="text-slate-400 mono text-[11px]">
              Co-Added: <strong className="text-white">4 Survey Epochs</strong> &bull; SNR Boost: <strong className="text-emerald-400">~2.0x</strong>
            </span>
          </div>
        </div>
      )}

      {/* 4. Interactive Astronomical Display Canvas */}
      <div className="relative my-4 flex items-center justify-center min-h-[380px] md:min-h-[460px] bg-slate-950/90 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
        {/* Contamination Alert Badge */}
        {currentEpoch?.contamination_flag && !isDiffMode && !isShiftMode && (
          <div className="absolute top-3 right-3 z-30 bg-rose-950/80 border border-rose-500/60 text-rose-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 backdrop-blur-md shadow-lg animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Contamination Flag: Detector artifact or cosmic ray noted</span>
          </div>
        )}

        {/* Telemetry HUD (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-30 bg-slate-950/85 border border-cyan-500/30 rounded-lg p-2.5 text-xs text-slate-300 mono backdrop-blur-md pointer-events-none">
          <div className="text-cyan-400 font-semibold mb-0.5">
            {targetInfo?.matched_preset || 'Custom Celestial Field'}
          </div>
          <div>RA: <span className="text-white">{targetInfo?.ra_hms || targetInfo?.ra_deg}</span></div>
          <div>Dec: <span className="text-white">{targetInfo?.dec_dms || targetInfo?.dec_deg}</span></div>
          <div>FOV: <span className="text-white">{targetInfo?.fov_arcmin}' arcmin</span></div>
          <div className="text-amber-400 font-medium mt-0.5">
            {isShiftMode 
              ? `Shift-and-Add Search: Vx=${shiftVx.toFixed(2)}, Vy=${shiftVy.toFixed(2)}`
              : isDiffMode 
              ? `Mode: Difference (${diffPair.replace(/_/g, ' ')})` 
              : `Epoch: ${currentEpoch?.timestamp || '2025-06-15'}`}
          </div>
        </div>

        {/* Hovered Catalog Source Tooltip Popover */}
        {hoveredSource && (
          <div
            className="absolute z-40 bg-slate-950/95 border border-cyan-400/60 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md max-w-[260px] pointer-events-none animate-fadeIn"
            style={{
              left: `${Math.min(Math.max((hoveredSource.pixel_x / 256) * 100, 15), 85)}%`,
              top: `${Math.max((hoveredSource.pixel_y / 256) * 100 - 15, 10)}%`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-800 pb-1">
              <span className={`font-semibold ${hoveredSource.catalog === 'Gaia DR3' ? 'text-cyan-400' : 'text-amber-400'}`}>
                {hoveredSource.catalog}
              </span>
              {hoveredSource.is_brown_dwarf_candidate && (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-400/40 px-1.5 py-0.2 rounded font-mono">
                  BD / Planet X Candidate
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-slate-200 truncate mb-1">
              {hoveredSource.id}
            </div>
            <div className="text-slate-400 space-y-0.5 font-mono text-[11px]">
              <div>Mag: <span className="text-white font-medium">{hoveredSource.mag} ({hoveredSource.mag_band})</span></div>
              {hoveredSource.proper_motion_mas_yr > 0 && (
                <div>Proper Motion: <span className="text-emerald-400 font-semibold">{hoveredSource.proper_motion_mas_yr} mas/yr</span></div>
              )}
              <div>RA/Dec: <span className="text-slate-300">{hoveredSource.ra_deg.toFixed(4)}, {hoveredSource.dec_deg.toFixed(4)}</span></div>
            </div>
            {hoveredSource.notes && (
              <p className="mt-1.5 text-[10px] text-amber-300/90 italic leading-snug border-t border-slate-800/80 pt-1">
                {hoveredSource.notes}
              </p>
            )}
          </div>
        )}

        {/* Center Crosshairs Overlay */}
        {showCrosshairs && (
          <div className="crosshair-reticle z-20 pointer-events-none">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="w-10 h-10 border border-cyan-400/60 rounded-full border-dashed animate-spin-slow"></div>
              <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-[0_0_8px_#38bdf8]"></div>
              <div className="absolute w-16 h-[1px] bg-cyan-400/40"></div>
              <div className="absolute h-16 w-[1px] bg-cyan-400/40"></div>
            </div>
          </div>
        )}

        {/* Main Sky Imagery & Overlay Surface */}
        {isSplitMode ? (
          /* Side-by-Side Dual Epoch View */
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-4 p-4">
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xs font-semibold text-cyan-400 mb-2 mono">
                Epoch 1: {epochs[0]?.timestamp || '2025-06-15'}
              </span>
              <img
                src={epochs[0]?.image_url}
                alt="Epoch 1 Sky Cutout"
                style={{ 
                  transform: `scale(${zoomLevel})`,
                  filter: getFilterStyle()
                }}
                className="max-h-[360px] object-contain rounded-lg border border-slate-800 transition-all duration-200"
              />
            </div>
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xs font-semibold text-amber-400 mb-2 mono">
                Epoch 2: {epochs[1]?.timestamp || '2025-12-15'}
              </span>
              <img
                src={epochs[1]?.image_url}
                alt="Epoch 2 Sky Cutout"
                style={{ 
                  transform: `scale(${zoomLevel})`,
                  filter: getFilterStyle()
                }}
                className="max-h-[360px] object-contain rounded-lg border border-slate-800 transition-all duration-200"
              />
            </div>
          </div>
        ) : (
          /* Single Continuous Unified Sky View or Difference Subtraction or Shift-and-Add Stack */
          <div className="relative flex items-center justify-center p-4">
            <div 
              className="relative rounded-lg overflow-hidden shadow-2xl transition-all duration-200 border border-slate-800"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={
                  isShiftMode 
                    ? (shiftImage || shiftAndAddData?.target_stack_url || currentEpoch?.image_url)
                    : isDiffMode 
                    ? activeDifferenceUrl 
                    : currentEpoch?.image_url
                }
                alt={
                  isShiftMode 
                    ? 'Shift and Add Co-added Stack' 
                    : isDiffMode 
                    ? 'Difference Image' 
                    : `SPHEREx Epoch ${currentEpochIndex + 1}`
                }
                style={{ filter: getFilterStyle() }}
                className="max-h-[440px] aspect-square object-contain block select-none pointer-events-none transition-all duration-150"
              />

              {/* Gaia DR3 & AllWISE Catalog Overlays */}
              {showCatalogOverlay && visibleSources.map((source, idx) => {
                const isGaia = source.catalog === 'Gaia DR3';
                const isBD = source.is_brown_dwarf_candidate;
                const isHPM = source.is_high_proper_motion;

                return (
                  <button
                    key={source.id || idx}
                    type="button"
                    onMouseEnter={() => setHoveredSource(source)}
                    onMouseLeave={() => setHoveredSource(null)}
                    onClick={() => setHoveredSource(source)}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2 group focus:outline-none cursor-pointer"
                    style={{
                      left: `${(source.pixel_x / 256) * 100}%`,
                      top: `${(source.pixel_y / 256) * 100}%`
                    }}
                    title={`${source.catalog}: ${source.id} (${source.mag} mag)`}
                  >
                    {/* Visual Reticle Marker */}
                    <div className="relative flex items-center justify-center">
                      {isBD ? (
                        /* Brown Dwarf / Planet X Candidate Pulsing Reticle */
                        <div className="w-7 h-7 rounded-full border-2 border-rose-400/90 bg-rose-500/20 flex items-center justify-center animate-pulse shadow-[0_0_12px_#f43f5e]">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-300"></div>
                        </div>
                      ) : isHPM ? (
                        <div className="w-6 h-6 rounded-full border border-amber-400/80 bg-amber-500/10 flex items-center justify-center shadow-[0_0_8px_#f59e0b]">
                          <div className="w-1 h-1 rounded-full bg-amber-300"></div>
                        </div>
                      ) : (
                        <div className={`w-5 h-5 rounded-full border transition-transform duration-150 group-hover:scale-125 flex items-center justify-center ${
                          isGaia 
                            ? 'border-cyan-400/70 bg-cyan-500/10 group-hover:border-cyan-300' 
                            : 'border-amber-400/70 bg-amber-500/10 group-hover:border-amber-300'
                        }`}>
                          <div className={`w-1 h-1 rounded-full ${isGaia ? 'bg-cyan-300' : 'bg-amber-300'}`}></div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Viewport Bottom Toolbar: Candidate Screening & Catalog Filters */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-slate-400 mono">
          {isShiftMode ? (
            <span>NASA Shift-and-Add Velocity Search Engine &bull; Co-Adds all 4 epochs along trial vectors</span>
          ) : isDiffMode ? (
            <span>Difference Imaging &bull; Active Pair: <strong className="text-amber-400">{diffPair.replace(/_/g, ' ')}</strong></span>
          ) : (
            <span>Survey Epoch: <strong className="text-cyan-300">{currentEpoch?.timestamp || '2025-06-15'}</strong> (Cadence: 6 Months)</span>
          )}
        </div>

        {/* Multi-Mission Catalog Legend & Candidate Screening Filter Pills */}
        {catalogOverlay.length > 0 && showCatalogOverlay && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px] mono font-medium">Candidate Filter:</span>

            <button
              onClick={() => setCatalogFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] mono border transition-all ${
                catalogFilter === 'all'
                  ? 'bg-slate-700 border-slate-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({catalogOverlay.length})
            </button>
            
            <button
              onClick={() => setCatalogFilter('gaia_dr3')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'gaia_dr3' 
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-semibold' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Show only optical sources from Gaia DR3"
            >
              <span className="w-2 h-2 rounded-full border border-cyan-400 bg-cyan-400/30"></span>
              <span>Gaia DR3 (Optical)</span>
            </button>

            <button
              onClick={() => setCatalogFilter('allwise')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'allwise' 
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Show only infrared sources from AllWISE"
            >
              <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-400/30"></span>
              <span>AllWISE (Infrared)</span>
            </button>

            {/* Optical Dropout Filter: The Planet X / Cold Brown Dwarf Test */}
            <button
              onClick={() => setCatalogFilter(catalogFilter === 'optical_dropout' ? 'all' : 'optical_dropout')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'optical_dropout' 
                  ? 'bg-rose-500/25 border-rose-400 text-rose-300 font-semibold shadow-sm shadow-rose-500/20' 
                  : 'bg-slate-900 border-slate-800 text-rose-300/80 hover:text-rose-200'
              }`}
              title="Planet X & Cold Brown Dwarf Test: Hides optical Gaia stars to isolate pure infrared detections with no optical counterpart"
            >
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>Optical Dropout (Planet X Test)</span>
            </button>

            {/* High Proper Motion Cut Filter */}
            <button
              onClick={() => setCatalogFilter(catalogFilter === 'high_pm' ? 'all' : 'high_pm')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'high_pm' 
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 font-semibold' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Filter out stationary background stars; show only sources with μ > 100 mas/yr"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Fast Movers (&gt;100 mas/yr)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
