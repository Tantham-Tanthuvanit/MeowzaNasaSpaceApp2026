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
  Zap,
  Flag,
  MapPin,
  Trash2,
  ArrowRight,
  MoveHorizontal,
  X,
  Check
} from 'lucide-react';
import { fetchShiftAndAdd } from '../services/api';
import { pixelToRaDec } from '../services/astrometry';
import { FlagCandidateModal } from './FlaggedDiscoveries';

export default function SkyViewer({
  epochs = [],
  differenceImageUrl,
  differenceImages = {},
  shiftAndAddData = null,
  targetInfo,
  fov,
  catalogOverlay = [],
  candidates = [],
  onFlagCandidate,
  onDeleteCandidate,
  currentEpochIndex,
  viewMode, // 'single', 'diff', 'split', or 'shift'
  onViewModeChange
}) {
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [showCatalogOverlay, setShowCatalogOverlay] = useState(true);
  const [hoveredSource, setHoveredSource] = useState(null);
  
  // Citizen Science Click-to-Flag Candidate State
  const [isFlaggingActive, setIsFlaggingActive] = useState(false);
  const [pendingFlag, setPendingFlag] = useState(null);
  const [hoveredFlag, setHoveredFlag] = useState(null);

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

  // Side-by-Side Dual Epoch Comparison & Difference Highlighter State
  const [splitLeftEpoch, setSplitLeftEpoch] = useState(0); // Epoch 1
  const [splitRightEpoch, setSplitRightEpoch] = useState(3); // Epoch 4
  const [highlightDifferences, setHighlightDifferences] = useState(true);
  const [splitSubView, setSplitSubView] = useState('dual'); // 'dual', 'trio', 'wipe'
  const [wipePercent, setWipePercent] = useState(50);

  // Scientific Data Provenance & Simulation Badge State
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);

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
        fov: currentFov,
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

  // Handle direct click on astronomical canvas to flag a discovery candidate
  const handleCanvasClick = (e) => {
    if (!isFlaggingActive) return;
    // If clicking on an existing source or flag reticle, let the element handle it
    if (e.target.closest('button[data-flag-pin="true"]') || e.target.closest('button[data-catalog-source="true"]')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Normalize to 0-256 pixel grid
    const pixelX = Math.max(0, Math.min(256, (clickX / rect.width) * 256.0));
    const pixelY = Math.max(0, Math.min(256, (clickY / rect.height) * 256.0));

    const centerRa = targetInfo?.ra_deg || 133.795129;
    const centerDec = targetInfo?.dec_deg || -7.245147;
    const fovVal = currentFov || 5.0;

    const astrometry = pixelToRaDec(pixelX, pixelY, centerRa, centerDec, fovVal, 256);

    const activeViewLabel = isShiftMode 
      ? `Shift & Add (Vx=${shiftVx.toFixed(2)}, Vy=${shiftVy.toFixed(2)})`
      : isDiffMode 
      ? `Difference (${diffPair.replace(/_/g, ' ')})`
      : `Epoch ${currentEpochIndex + 1} (${currentEpoch?.timestamp || '2025-06-15'})`;

    setPendingFlag({
      pixelX,
      pixelY,
      raDeg: astrometry.raDeg,
      decDeg: astrometry.decDeg,
      raHms: astrometry.raHms,
      decDms: astrometry.decDms,
      epochLabel: activeViewLabel,
      bandGroup: targetInfo?.band_group || 'stacked'
    });
  };

  // Filter sources according to active catalog & candidate screening filter
  const visibleSources = catalogOverlay.filter((s) => {
    if (catalogFilter === 'all') return true;
    if (catalogFilter === 'gaia_dr3') return s.catalog === 'Gaia DR3';
    if (catalogFilter === 'allwise') return s.catalog === 'AllWISE';
    if (catalogFilter === 'optical_dropout') {
      return s.catalog !== 'Gaia DR3' || s.is_brown_dwarf_candidate;
    }
    if (catalogFilter === 'high_pm') {
      return (s.proper_motion_mas_yr || 0) >= 100.0;
    }
    return true;
  });

  // Calculate difference pair and astrometric motion vectors for Split Comparison Mode
  const leftEpoch = epochs[splitLeftEpoch] || epochs[0] || {};
  const rightEpoch = epochs[splitRightEpoch] || epochs[Math.min(1, epochs.length - 1)] || {};
  const coordsA = leftEpoch.target_pixel_coords || [128.0, 128.0];
  const coordsB = rightEpoch.target_pixel_coords || [135.5, 123.8];
  const deltaX = coordsB[0] - coordsA[0];
  const deltaY = coordsB[1] - coordsA[1];
  const driftDistPx = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const baselineMonths = Math.abs(splitRightEpoch - splitLeftEpoch) * 6;
  const pixelScaleArcsec = (Number(currentFov) * 60.0) / 256.0;
  const driftArcsec = driftDistPx * pixelScaleArcsec;
  const properMotionMasYr = baselineMonths > 0 ? (driftArcsec / (baselineMonths / 12.0)) * 1000.0 : 0;

  // Determine matching subtraction difference image for chosen Left and Right epochs
  const getDiffKey = (l, r) => {
    const minEp = Math.min(l, r) + 1;
    const maxEp = Math.max(l, r) + 1;
    if (minEp === maxEp) return 'e2_minus_e1';
    const key = `e${maxEp}_minus_e${minEp}`;
    if (differenceImages && differenceImages[key]) return key;
    return 'e2_minus_e1';
  };
  const splitDiffImage = differenceImages[getDiffKey(splitLeftEpoch, splitRightEpoch)] || activeDifferenceUrl;

  const handleCanvasClickWithEpoch = (e, epochIdx, customLabel) => {
    if (!isFlaggingActive) return;
    if (e.target.closest('button[data-flag-pin="true"]') || e.target.closest('button[data-catalog-source="true"]')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const pixelX = Math.max(0, Math.min(256, (clickX / rect.width) * 256.0));
    const pixelY = Math.max(0, Math.min(256, (clickY / rect.height) * 256.0));

    const centerRa = targetInfo?.ra_deg || 133.795129;
    const centerDec = targetInfo?.dec_deg || -7.245147;
    const fovVal = currentFov || 5.0;

    const astrometry = pixelToRaDec(pixelX, pixelY, centerRa, centerDec, fovVal, 256);

    setPendingFlag({
      pixelX,
      pixelY,
      raDeg: astrometry.raDeg,
      decDeg: astrometry.decDeg,
      raHms: astrometry.raHms,
      decDms: astrometry.decDms,
      epochLabel: customLabel || `Epoch ${epochIdx + 1}`,
      bandGroup: targetInfo?.band_group || 'stacked'
    });
  };

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

          {/* Citizen Science: Click-to-Flag Candidate Button */}
          <button
            onClick={() => setIsFlaggingActive(!isFlaggingActive)}
            className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
              isFlaggingActive
                ? 'bg-rose-500 text-white border-rose-400 font-semibold shadow-md shadow-rose-500/30 animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-rose-400/50'
            }`}
            title="Click to Flag: Activate targeting crosshair and click anywhere on the canvas to log a new discovery"
          >
            <Flag className={`w-3.5 h-3.5 ${isFlaggingActive ? 'text-white' : 'text-rose-400'}`} />
            <span>{isFlaggingActive ? 'Click Image to Pin...' : 'Flag Candidate'}</span>
            {candidates.length > 0 && (
              <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-500/50 px-1.5 py-0.2 rounded-full font-mono font-bold">
                {candidates.length}
              </span>
            )}
          </button>

          {/* WiseView Inverted Contrast Toggle */}
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
              { id: 'smooth', label: 'Smooth' },
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
            <span>Overlays</span>
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

          {/* Scientific Data Provenance & SPHEREx Mission Archive Badge */}
          <button
            onClick={() => setShowProvenanceModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/50 hover:border-indigo-400 text-indigo-200 text-xs flex items-center gap-1.5 transition-all shadow-sm"
            title="Click to view SPHEREx Mission Status & IRSA Data Architecture"
          >
            <Satellite className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Data Archive:</span>
            <span className="font-semibold text-cyan-300 font-mono">SPHEREx (DR1/QR3)</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar: Epoch Difference Pair Selector */}
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

      {/* 3. Sub-Toolbar: Shift-and-Add Search Engine Controls */}
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

      {/* 3.5 Sub-Toolbar: Side-by-Side Dual Epoch Comparison & Difference Highlighter */}
      {isSplitMode && (
        <div className="mt-3 p-3 bg-slate-900/90 border border-indigo-500/30 rounded-xl space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left & Right Epoch Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-semibold mono">Left Pane:</span>
                <div className="flex items-center gap-1">
                  {epochs.map((ep, idx) => (
                    <button
                      key={ep.epoch_id || idx}
                      onClick={() => setSplitLeftEpoch(idx)}
                      className={`px-2 py-0.5 rounded text-xs mono transition-all ${
                        splitLeftEpoch === idx
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      E{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-amber-400 font-semibold mono">Right Pane:</span>
                <div className="flex items-center gap-1">
                  {epochs.map((ep, idx) => (
                    <button
                      key={ep.epoch_id || idx}
                      onClick={() => setSplitRightEpoch(idx)}
                      className={`px-2 py-0.5 rounded text-xs mono transition-all ${
                        splitRightEpoch === idx
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      E{idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difference Highlighting Toggle Button */}
              <button
                onClick={() => setHighlightDifferences(!highlightDifferences)}
                className={`px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  highlightDifferences
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Highlight moving objects and flux variations between selected epochs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${highlightDifferences ? 'text-amber-300 animate-spin-slow' : 'text-slate-500'}`} />
                <span>Highlight Differences: {highlightDifferences ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Layout Views: Dual vs Trio (with Difference Map) vs Curtain Wipe */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 mono text-[11px]">
              <button
                onClick={() => setSplitSubView('dual')}
                className={`px-2.5 py-1 rounded transition-all ${
                  splitSubView === 'dual'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Side-by-side Dual Epoch Comparison"
              >
                Dual View
              </button>
              <button
                onClick={() => setSplitSubView('trio')}
                className={`px-2.5 py-1 rounded transition-all ${
                  splitSubView === 'trio'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Triple Panel: Left Epoch | Subtraction Difference Map | Right Epoch"
              >
                Trio + Diff Map
              </button>
              <button
                onClick={() => setSplitSubView('wipe')}
                className={`px-2.5 py-1 rounded transition-all ${
                  splitSubView === 'wipe'
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Interactive Curtain Wipe Slider"
              >
                Curtain Wipe
              </button>
            </div>
          </div>

          {/* Astrometric Motion Telemetry Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400">
                Baseline: <strong className="text-white">{baselineMonths} months</strong> ({leftEpoch.timestamp || '2025-06-15'} &rarr; {rightEpoch.timestamp || '2025-12-15'})
              </span>
              {driftDistPx > 0.05 ? (
                <>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span>Target Drift:</span>
                    <strong className="text-white">{driftDistPx.toFixed(1)} px</strong>
                    <span>({driftArcsec.toFixed(2)}" arcsec)</span>
                  </span>
                  {properMotionMasYr > 0 && (
                    <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                      Proper Motion: ~{Math.round(properMotionMasYr)} mas/yr
                    </span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 italic">No significant proper motion detected across selected epochs</span>
              )}
            </div>
            <div className="text-slate-400 text-[11px]">
              <span className="text-cyan-400">Cyan Reticle</span>: Epoch {splitLeftEpoch + 1} &bull; <span className="text-amber-400">Amber Reticle</span>: Epoch {splitRightEpoch + 1}
            </div>
          </div>
        </div>
      )}

      {/* 4. Interactive Astronomical Display Canvas */}
      <div className="relative my-4 flex items-center justify-center min-h-[380px] md:min-h-[460px] bg-slate-950/90 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
        {/* Click-to-Flag Mode Floating Instruction Banner */}
        {isFlaggingActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-950/90 border border-rose-400 text-rose-200 px-4 py-1.5 rounded-full text-xs flex items-center gap-2 backdrop-blur-md shadow-2xl animate-bounce">
            <Flag className="w-4 h-4 text-rose-400" />
            <span className="font-semibold">Targeting Mode Active:</span>
            <span>Click on any moving speck or dipole to pin a discovery</span>
          </div>
        )}

        {/* Contamination Alert Badge */}
        {currentEpoch?.contamination_flag && !isDiffMode && !isShiftMode && !isFlaggingActive && (
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
          <div>FOV: <span className="text-white">{Number(currentFov).toFixed(1)}' arcmin</span></div>
          <div className="text-amber-400 font-medium mt-0.5">
            {isShiftMode 
              ? `Shift-and-Add Search: Vx=${shiftVx.toFixed(2)}, Vy=${shiftVy.toFixed(2)}`
              : isDiffMode 
              ? `Mode: Difference (${diffPair.replace(/_/g, ' ')})` 
              : `Epoch: ${currentEpoch?.timestamp || '2025-06-15'}`}
          </div>
          <div className="text-[10px] text-cyan-300/80 border-t border-slate-800/80 pt-1 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Archive: SPHEREx On-Orbit Survey (E1-E3 Observed, E4 Dec 2026)</span>
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

        {/* Hovered Candidate Flag Popover */}
        {hoveredFlag && (
          <div
            className="absolute z-40 bg-slate-950/95 border border-rose-400/80 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md max-w-[280px] pointer-events-auto animate-fadeIn"
            style={{
              left: `${Math.min(Math.max((hoveredFlag.pixelX / 256) * 100, 15), 85)}%`,
              top: `${Math.max((hoveredFlag.pixelY / 256) * 100 - 15, 10)}%`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-slate-800 pb-1">
              <span className="font-semibold text-rose-400 flex items-center gap-1 font-mono">
                <Flag className="w-3.5 h-3.5" />
                <span>Candidate Discovery</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCandidate?.(hoveredFlag.id);
                  setHoveredFlag(null);
                }}
                className="text-slate-400 hover:text-rose-400 p-0.5"
                title="Remove candidate pin"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-200 mb-1">
              {hoveredFlag.id} &bull; <strong className="text-cyan-300">{hoveredFlag.category}</strong>
            </div>
            <div className="text-slate-400 space-y-0.5 font-mono text-[11px]">
              <div>RA: <span className="text-white">{hoveredFlag.raHms}</span></div>
              <div>Dec: <span className="text-white">{hoveredFlag.decDms}</span></div>
              <div>Confidence: <span className="text-amber-400">{'★'.repeat(hoveredFlag.confidence || 4)}</span></div>
            </div>
            {hoveredFlag.notes && (
              <p className="mt-1.5 text-[10px] text-slate-300 italic border-t border-slate-800 pt-1">
                "{hoveredFlag.notes}"
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
          /* Side-by-Side Dual / Trio / Curtain Wipe Epoch Comparison View */
          <div className="w-full h-full p-4 flex flex-col items-center justify-center">
            {splitSubView === 'dual' && (
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                {/* Left Epoch Panel */}
                <div className="flex flex-col items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between w-full mb-2 px-1 text-xs mono">
                    <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>Epoch {splitLeftEpoch + 1}: {leftEpoch.timestamp || '2025-06-15'}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Reference Epoch</span>
                  </div>

                  <div
                    onClick={(e) => handleCanvasClickWithEpoch(e, splitLeftEpoch, `Epoch ${splitLeftEpoch + 1}`)}
                    className={`relative rounded-lg overflow-hidden border border-slate-800 shadow-xl transition-all ${
                      isFlaggingActive ? 'cursor-crosshair ring-2 ring-rose-400' : ''
                    }`}
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={leftEpoch.image_url}
                      alt={`Epoch ${splitLeftEpoch + 1}`}
                      style={{ filter: getFilterStyle() }}
                      className="max-h-[360px] aspect-square object-contain block select-none pointer-events-none"
                    />

                    {/* Difference Highlight: Epoch A Reticle */}
                    {highlightDifferences && (
                      <div
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                        style={{
                          left: `${(coordsA[0] / 256) * 100}%`,
                          top: `${(coordsA[1] / 256) * 100}%`
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full border-2 border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_12px_#38bdf8]"></div>
                          <div className="w-2 h-2 rounded-full bg-cyan-300"></div>
                          <div className="absolute -top-4 whitespace-nowrap bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-[9px] font-mono px-1.5 py-0.2 rounded shadow">
                            Pos A (E{splitLeftEpoch + 1})
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Candidate Flag Pins */}
                    {candidates.map((cand, idx) => (
                      <button
                        key={cand.id || idx}
                        data-flag-pin="true"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredFlag(hoveredFlag?.id === cand.id ? null : cand);
                        }}
                        onMouseEnter={() => setHoveredFlag(cand)}
                        onMouseLeave={() => setHoveredFlag(null)}
                        className="absolute z-30 -translate-x-1/2 -translate-y-1/2 group focus:outline-none cursor-pointer"
                        style={{
                          left: `${(cand.pixelX / 256) * 100}%`,
                          top: `${(cand.pixelY / 256) * 100}%`
                        }}
                        title={`Flag #${idx + 1}: ${cand.category}`}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full border-2 border-rose-400 bg-rose-500/20 flex items-center justify-center animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                          </div>
                          <div className="absolute -top-3 -right-3 px-1 py-0.2 rounded bg-rose-600 border border-white text-white font-mono text-[8px] font-bold">
                            🚩#{idx + 1}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Epoch Panel */}
                <div className="flex flex-col items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between w-full mb-2 px-1 text-xs mono">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>Epoch {splitRightEpoch + 1}: {rightEpoch.timestamp || '2025-12-15'}</span>
                    </span>
                    <span className="text-[11px] text-amber-300/80 font-bold">
                      {driftDistPx > 0.05 ? `Δ +${driftDistPx.toFixed(1)}px drift` : 'Shift Target'}
                    </span>
                  </div>

                  <div
                    onClick={(e) => handleCanvasClickWithEpoch(e, splitRightEpoch, `Epoch ${splitRightEpoch + 1}`)}
                    className={`relative rounded-lg overflow-hidden border border-slate-800 shadow-xl transition-all ${
                      isFlaggingActive ? 'cursor-crosshair ring-2 ring-rose-400' : ''
                    }`}
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={rightEpoch.image_url}
                      alt={`Epoch ${splitRightEpoch + 1}`}
                      style={{ filter: getFilterStyle() }}
                      className="max-h-[360px] aspect-square object-contain block select-none pointer-events-none"
                    />

                    {/* Difference Highlight: Motion Vector Arrow & Shifted Reticle */}
                    {highlightDifferences && (
                      <>
                        {/* SVG Motion Vector Arrow */}
                        {driftDistPx > 0.05 && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                            <defs>
                              <marker id="motionArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                              </marker>
                            </defs>
                            <line
                              x1={`${(coordsA[0] / 256) * 100}%`}
                              y1={`${(coordsA[1] / 256) * 100}%`}
                              x2={`${(coordsB[0] / 256) * 100}%`}
                              y2={`${(coordsB[1] / 256) * 100}%`}
                              stroke="#f59e0b"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                              markerEnd="url(#motionArrow)"
                            />
                          </svg>
                        )}

                        {/* Ghost Previous Position Reticle (from Epoch A) */}
                        <div
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                          style={{
                            left: `${(coordsA[0] / 256) * 100}%`,
                            top: `${(coordsA[1] / 256) * 100}%`
                          }}
                        >
                          <div className="w-8 h-8 rounded-full border-2 border-dashed border-cyan-400"></div>
                        </div>

                        {/* Current Position Reticle (Epoch B) */}
                        <div
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                          style={{
                            left: `${(coordsB[0] / 256) * 100}%`,
                            top: `${(coordsB[1] / 256) * 100}%`
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full border-2 border-amber-400 bg-amber-500/10 shadow-[0_0_12px_#f59e0b]"></div>
                            <div className="w-2 h-2 rounded-full bg-amber-300"></div>
                            <div className="absolute -top-4 whitespace-nowrap bg-amber-950/90 border border-amber-400 text-amber-200 text-[9px] font-mono px-1.5 py-0.2 rounded shadow">
                              Pos B (E{splitRightEpoch + 1})
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Candidate Flag Pins */}
                    {candidates.map((cand, idx) => (
                      <button
                        key={cand.id || idx}
                        data-flag-pin="true"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredFlag(hoveredFlag?.id === cand.id ? null : cand);
                        }}
                        onMouseEnter={() => setHoveredFlag(cand)}
                        onMouseLeave={() => setHoveredFlag(null)}
                        className="absolute z-30 -translate-x-1/2 -translate-y-1/2 group focus:outline-none cursor-pointer"
                        style={{
                          left: `${(cand.pixelX / 256) * 100}%`,
                          top: `${(cand.pixelY / 256) * 100}%`
                        }}
                        title={`Flag #${idx + 1}: ${cand.category}`}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full border-2 border-rose-400 bg-rose-500/20 flex items-center justify-center animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                          </div>
                          <div className="absolute -top-3 -right-3 px-1 py-0.2 rounded bg-rose-600 border border-white text-white font-mono text-[8px] font-bold">
                            🚩#{idx + 1}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {splitSubView === 'trio' && (
              <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-3 max-w-6xl">
                {/* Panel 1: Epoch A */}
                <div className="flex flex-col items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-semibold text-cyan-400 mb-1.5 mono">
                    Epoch {splitLeftEpoch + 1}: {leftEpoch.timestamp || '2025-06-15'}
                  </span>
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 shadow-md">
                    <img
                      src={leftEpoch.image_url}
                      alt={`Epoch ${splitLeftEpoch + 1}`}
                      style={{ filter: getFilterStyle() }}
                      className="max-h-[300px] aspect-square object-contain block pointer-events-none"
                    />
                    {highlightDifferences && (
                      <div
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                        style={{
                          left: `${(coordsA[0] / 256) * 100}%`,
                          top: `${(coordsA[1] / 256) * 100}%`
                        }}
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-500/20"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Subtraction Difference Map (B - A) */}
                <div className="flex flex-col items-center bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/30">
                  <div className="flex items-center justify-between w-full mb-1.5 px-1 text-xs mono">
                    <span className="font-semibold text-amber-400">
                      Difference Map (E{splitRightEpoch + 1} - E{splitLeftEpoch + 1})
                    </span>
                    <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 rounded">
                      Dipole Signature
                    </span>
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 shadow-md">
                    <img
                      src={splitDiffImage}
                      alt="Difference Subtraction Map"
                      style={{ filter: getFilterStyle() }}
                      className="max-h-[300px] aspect-square object-contain block pointer-events-none"
                    />
                    {highlightDifferences && (
                      <>
                        {/* Negative Dipole Trough (Blue) */}
                        <div
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                          style={{
                            left: `${(coordsA[0] / 256) * 100}%`,
                            top: `${(coordsA[1] / 256) * 100}%`
                          }}
                        >
                          <div className="w-8 h-8 rounded-full border-2 border-blue-400 bg-blue-500/20 flex items-center justify-center">
                            <span className="text-[9px] text-blue-300 font-bold mono">-Δ</span>
                          </div>
                        </div>

                        {/* Positive Dipole Peak (Red/Amber) */}
                        <div
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                          style={{
                            left: `${(coordsB[0] / 256) * 100}%`,
                            top: `${(coordsB[1] / 256) * 100}%`
                          }}
                        >
                          <div className="w-8 h-8 rounded-full border-2 border-rose-400 bg-rose-500/20 flex items-center justify-center">
                            <span className="text-[9px] text-rose-300 font-bold mono">+Δ</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Panel 3: Epoch B */}
                <div className="flex flex-col items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-semibold text-amber-400 mb-1.5 mono">
                    Epoch {splitRightEpoch + 1}: {rightEpoch.timestamp || '2025-12-15'}
                  </span>
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 shadow-md">
                    <img
                      src={rightEpoch.image_url}
                      alt={`Epoch ${splitRightEpoch + 1}`}
                      style={{ filter: getFilterStyle() }}
                      className="max-h-[300px] aspect-square object-contain block pointer-events-none"
                    />
                    {highlightDifferences && (
                      <div
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                        style={{
                          left: `${(coordsB[0] / 256) * 100}%`,
                          top: `${(coordsB[1] / 256) * 100}%`
                        }}
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-amber-400 bg-amber-500/20"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {splitSubView === 'wipe' && (
              <div className="flex flex-col items-center w-full max-w-lg">
                <div className="flex items-center justify-between w-full mb-2 text-xs mono text-slate-300">
                  <span className="text-cyan-400 font-semibold">◀ Epoch {splitLeftEpoch + 1} ({wipePercent}%)</span>
                  <span className="text-amber-400 font-semibold">Epoch {splitRightEpoch + 1} ({100 - wipePercent}%) ▶</span>
                </div>

                <div 
                  className="relative rounded-lg overflow-hidden border border-slate-800 shadow-2xl w-[360px] h-[360px]"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {/* Base Image: Epoch B */}
                  <img
                    src={rightEpoch.image_url}
                    alt={`Epoch ${splitRightEpoch + 1}`}
                    style={{ filter: getFilterStyle() }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />

                  {/* Overlaid Clipped Image: Epoch A */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${wipePercent}%` }}
                  >
                    <img
                      src={leftEpoch.image_url}
                      alt={`Epoch ${splitLeftEpoch + 1}`}
                      style={{ 
                        filter: getFilterStyle(),
                        width: '360px',
                        maxWidth: 'none',
                        height: '360px'
                      }}
                      className="object-contain pointer-events-none"
                    />
                  </div>

                  {/* Vertical Divider Slider Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_#38bdf8] pointer-events-none"
                    style={{ left: `${wipePercent}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-lg">
                      <MoveHorizontal className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Difference Reticles */}
                  {highlightDifferences && (
                    <>
                      <div
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: `${(coordsA[0] / 256) * 100}%`,
                          top: `${(coordsA[1] / 256) * 100}%`
                        }}
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_8px_#38bdf8]"></div>
                      </div>
                      <div
                        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse"
                        style={{
                          left: `${(coordsB[0] / 256) * 100}%`,
                          top: `${(coordsB[1] / 256) * 100}%`
                        }}
                      >
                        <div className="w-8 h-8 rounded-full border-2 border-amber-400/80 bg-amber-500/10 shadow-[0_0_8px_#f59e0b]"></div>
                      </div>
                    </>
                  )}
                </div>

                {/* Range Slider Control */}
                <div className="w-full mt-3 flex items-center gap-3">
                  <span className="text-[11px] mono text-slate-400">Slide:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={wipePercent}
                    onChange={(e) => setWipePercent(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] mono text-cyan-300 w-8">{wipePercent}%</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single Continuous Sky View OR Difference Subtraction OR Shift-and-Add Stack */
          <div className="relative flex items-center justify-center p-4">
            <div 
              onClick={handleCanvasClick}
              className={`relative rounded-lg overflow-hidden shadow-2xl transition-all duration-200 border border-slate-800 ${
                isFlaggingActive ? 'cursor-crosshair ring-2 ring-rose-400 shadow-rose-500/20' : ''
              }`}
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

              {/* Citizen Science Flagged Candidate Pins */}
              {candidates.map((cand, idx) => (
                <button
                  key={cand.id || idx}
                  data-flag-pin="true"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredFlag(hoveredFlag?.id === cand.id ? null : cand);
                  }}
                  onMouseEnter={() => setHoveredFlag(cand)}
                  onMouseLeave={() => setHoveredFlag(null)}
                  className="absolute z-30 -translate-x-1/2 -translate-y-1/2 group focus:outline-none cursor-pointer"
                  style={{
                    left: `${(cand.pixelX / 256) * 100}%`,
                    top: `${(cand.pixelY / 256) * 100}%`
                  }}
                  title={`Flag #${idx + 1}: ${cand.category} (${cand.raHms}, ${cand.decDms})`}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-rose-400 bg-rose-500/20 flex items-center justify-center animate-pulse shadow-[0_0_12px_#f43f5e]">
                      <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                    </div>
                    <div className="absolute -top-3.5 -right-3.5 px-1.5 py-0.2 rounded bg-rose-600 border border-white text-white font-mono text-[9px] font-bold shadow-md">
                      🚩#{idx + 1}
                    </div>
                  </div>
                </button>
              ))}

              {/* Gaia DR3 & AllWISE Catalog Overlays */}
              {showCatalogOverlay && visibleSources.map((source, idx) => {
                const isGaia = source.catalog === 'Gaia DR3';
                const isBD = source.is_brown_dwarf_candidate;
                const isHPM = source.is_high_proper_motion;

                return (
                  <button
                    key={source.id || idx}
                    type="button"
                    data-catalog-source="true"
                    onMouseEnter={() => setHoveredSource(source)}
                    onMouseLeave={() => setHoveredSource(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoveredSource(source);
                    }}
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

            {/* Optical Dropout Filter */}
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

      {/* 6. Click-to-Flag Candidate Confirmation Modal */}
      {pendingFlag && (
        <FlagCandidateModal
          pendingFlag={pendingFlag}
          onSave={(newCand) => {
            onFlagCandidate?.(newCand);
            setPendingFlag(null);
            setIsFlaggingActive(false);
          }}
          onCancel={() => setPendingFlag(null)}
        />
      )}

      {/* 7. Scientific Data Provenance & SPHEREx Mission Archive Modal */}
      {showProvenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 max-w-xl w-full shadow-2xl relative text-slate-200 text-xs max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProvenanceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Satellite className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-base text-white">NASA SPHEREx Mission Status & Data Provenance</h3>
                <p className="text-[11px] text-slate-400">On-Orbit Survey Archive • Caltech/IPAC & NASA IRSA</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Mission Active Orbit Status */}
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-300">Active On-Orbit Mission (Launched March 11, 2025)</div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    NASA’s <strong>SPHEREx</strong> spacecraft launched on March 11, 2025 aboard a SpaceX Falcon 9 into a sun-synchronous low Earth orbit. As of <strong>November 2026</strong>, SPHEREx is in Month 20 of its primary 2-year survey, mapping the entire sky every 6 months across 102 infrared spectral bands (0.75 – 5.0 µm).
                  </p>
                </div>
              </div>

              {/* Epoch Breakdown Card */}
              <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                <div className="font-semibold text-cyan-300 font-mono text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>4-Epoch Survey Cadence Status:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/30">
                    <span className="font-bold text-emerald-400">Epoch 1 (June 2025):</span>
                    <p className="text-slate-300 mt-0.5">✅ <strong>REAL / Observed</strong> — Survey 1 complete. Ingested via NASA IRSA Quick Release 1 (QR1).</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/30">
                    <span className="font-bold text-emerald-400">Epoch 2 (Dec 2025):</span>
                    <p className="text-slate-300 mt-0.5">✅ <strong>REAL / Observed</strong> — Survey 2 complete (6-month parallax baseline, QR2).</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-emerald-500/30">
                    <span className="font-bold text-emerald-400">Epoch 3 (June 2026):</span>
                    <p className="text-slate-300 mt-0.5">✅ <strong>REAL / Observed</strong> — Survey 3 complete (12-month proper motion baseline, QR3 / DR1 candidate).</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-amber-500/30">
                    <span className="font-bold text-amber-400">Epoch 4 (Dec 2026):</span>
                    <p className="text-slate-300 mt-0.5">⏳ <strong>Scheduled / In-Flight</strong> — Final survey cadence concluding in December 2026.</p>
                  </div>
                </div>
              </div>

              {/* Real Astronomical Ground Truth Sources */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-white font-mono text-[11px] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Official Astronomical Archives & Source Links:</span>
                </div>
                <ul className="text-[11px] text-slate-300 space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <div>
                      <a
                        href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
                      >
                        NASA IRSA SPHEREx Archive
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <span className="text-slate-400 ml-1">— Caltech/IPAC master repository for calibrated SPHEREx spectral cubes and mosaics.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <div>
                      <a
                        href="https://spherex.caltech.edu/data/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
                      >
                        SPHEREx Science Data Center (SSDC)
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <span className="text-slate-400 ml-1">— Science instrument specifications, 102 LVF channels, and Quick Release pipelines.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <div>
                      <a
                        href="https://irsa.ipac.caltech.edu/Missions/wise.html"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
                      >
                        NASA AllWISE & CatWISE2020 Catalogs
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <span className="text-slate-400 ml-1">— Real mid-infrared photometry (W1, W2, W3, W4) providing stellar flux calibrations.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <div>
                      <a
                        href="https://www.cosmos.esa.int/web/gaia/dr3"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
                      >
                        ESA Gaia Data Release 3 (Gaia DR3)
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <span className="text-slate-400 ml-1">— Sub-milliarcsecond astrometry, parallax, and proper motion reference grid.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <div>
                      <a
                        href="https://registry.opendata.aws/spherex/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline font-medium inline-flex items-center gap-1"
                      >
                        AWS Open Data Registry: SPHEREx
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                      <span className="text-slate-400 ml-1">— Cloud-hosted public data products for large-scale citizen science and spectral query.</span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Citizen Science Verification Note */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                <strong className="text-white">Citizen Science Workflow:</strong> Real target positions (Sedna, WISE 0855-0714, Luhman 16) use peer-reviewed astrometry and 6.2&quot;/px instrument resolution matching official SPHEREx flight focal plane arrays. Differences between epochs highlight true astrometric proper motion and parallax across the 18-month baseline.
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowProvenanceModal(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-xs transition-all font-medium"
              >
                Close Mission Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
