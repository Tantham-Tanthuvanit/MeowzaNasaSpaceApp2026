import React, { useState, useRef } from 'react';
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
  Radio
} from 'lucide-react';

export default function SkyViewer({
  epochs,
  differenceImageUrl,
  targetInfo,
  fov,
  catalogOverlay = [],
  currentEpochIndex,
  viewMode, // 'single', 'diff', or 'split'
  onViewModeChange
}) {
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [showCatalogOverlay, setShowCatalogOverlay] = useState(true);
  const [hoveredSource, setHoveredSource] = useState(null);
  const [catalogFilter, setCatalogFilter] = useState('all'); // 'all', 'gaia_dr3', 'allwise'
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Active FOV value in arcmin (from prop or targetInfo, fallback to 5.0)
  const currentFov = typeof fov === 'number' ? fov : (targetInfo?.fov_arcmin || 5.0);

  const currentEpoch = epochs[currentEpochIndex] || epochs[0] || {};
  const isDiffMode = viewMode === 'diff';
  const isSplitMode = viewMode === 'split';

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

  // Filter sources according to active catalog filter
  const visibleSources = catalogOverlay.filter((s) => {
    if (catalogFilter === 'all') return true;
    if (catalogFilter === 'gaia_dr3') return s.catalog === 'Gaia DR3';
    if (catalogFilter === 'allwise') return s.catalog === 'AllWISE';
    return true;
  });

  // Generate Aladin Lite external URL for active coordinates
  const aladinUrl = targetInfo?.ra_deg && targetInfo?.dec_deg
    ? `https://aladin.cds.unistra.fr/AladinLite/?target=${targetInfo.ra_deg}%20${targetInfo.dec_deg}&fov=${(targetInfo.fov_arcmin || 5.0) / 60.0}&survey=P%2FallWISE%2Fcolor`
    : 'https://aladin.cds.unistra.fr/AladinLite/';

  return (
    <div ref={containerRef} className="glass-panel p-5 mb-6 flex flex-col relative overflow-hidden">
      {/* Viewer Header: Mode Toggles & Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          {/* View Mode Buttons */}
          <div className="bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 flex items-center gap-1">
            <button
              onClick={() => onViewModeChange('single')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                !isDiffMode && !isSplitMode
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
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
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>
        </div>

        {/* Viewport Utilities: Gaia/WISE Toggle, Crosshairs, Zoom, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
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
            <span>Gaia / WISE</span>
            {catalogOverlay.length > 0 && (
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono text-emerald-300">
                {catalogOverlay.length}
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
            <span className="hidden sm:inline">Crosshairs</span>
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

      {/* Interactive Astronomical Display Canvas */}
      <div className="relative my-4 flex items-center justify-center min-h-[380px] md:min-h-[460px] bg-slate-950/90 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
        {/* Contamination Alert Badge */}
        {currentEpoch?.contamination_flag && !isDiffMode && (
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
            {isDiffMode ? 'Mode: Difference (Epoch 2 - Epoch 1)' : `Epoch: ${currentEpoch?.timestamp || '2025-06-15'}`}
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
                  BD Candidate
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
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[360px] object-contain rounded-lg border border-slate-800 transition-transform duration-200"
              />
            </div>
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xs font-semibold text-amber-400 mb-2 mono">
                Epoch 2: {epochs[1]?.timestamp || '2025-12-15'}
              </span>
              <img
                src={epochs[1]?.image_url}
                alt="Epoch 2 Sky Cutout"
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[360px] object-contain rounded-lg border border-slate-800 transition-transform duration-200"
              />
            </div>
          </div>
        ) : (
          /* Single Continuous Unified Sky View or Difference Subtraction */
          <div className="relative flex items-center justify-center p-4">
            {/* Image Canvas Container (256x256 coordinate frame) */}
            <div 
              className="relative rounded-lg overflow-hidden shadow-2xl transition-transform duration-200 border border-slate-800"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={isDiffMode ? differenceImageUrl : currentEpoch?.image_url}
                alt={isDiffMode ? 'Difference Image' : `SPHEREx Epoch ${currentEpochIndex + 1}`}
                className="max-h-[440px] aspect-square object-contain block select-none pointer-events-none"
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
                        <div className="w-7 h-7 rounded-full border-2 border-rose-400/90 bg-rose-500/10 flex items-center justify-center animate-pulse shadow-[0_0_12px_#f43f5e]">
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

      {/* Viewport Bottom Toolbar: Difference Info & Catalog Legend */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Difference Color Guide */}
        {isDiffMode ? (
          <div className="text-slate-400 mono">
            <span className="text-blue-400 font-semibold">Blue (-Δ)</span>: Shifted away / faded &bull;{' '}
            <span className="text-red-400 font-semibold">Red (+Δ)</span>: Appeared / brightened &bull;{' '}
            <span className="text-amber-400">Moving Dipole Signature</span>
          </div>
        ) : (
          <div className="text-slate-400 mono">
            Survey Epoch: <span className="text-cyan-300 font-medium">{currentEpoch?.timestamp || '2025-06-15'}</span> (Cadence: 6 Months)
          </div>
        )}

        {/* Multi-Mission Catalog Legend & Filter Buttons */}
        {catalogOverlay.length > 0 && showCatalogOverlay && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 text-[11px]">Overlay Legend:</span>
            
            <button
              onClick={() => setCatalogFilter(catalogFilter === 'gaia_dr3' ? 'all' : 'gaia_dr3')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'gaia_dr3' 
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full border border-cyan-400 bg-cyan-400/30"></span>
              <span>Gaia DR3 (Optical)</span>
            </button>

            <button
              onClick={() => setCatalogFilter(catalogFilter === 'allwise' ? 'all' : 'allwise')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] mono transition-all border ${
                catalogFilter === 'allwise' 
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-400/30"></span>
              <span>AllWISE (Infrared)</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] mono text-rose-300 bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 rounded">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span>Brown Dwarf Candidate</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
