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
  SplitSquareVertical
} from 'lucide-react';

export default function SkyViewer({
  epochs,
  differenceImageUrl,
  targetInfo,
  currentEpochIndex,
  viewMode, // 'single', 'diff', or 'split'
  onViewModeChange
}) {
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

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

        {/* Viewport Utilities: Crosshairs, Zoom, Fullscreen */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

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
        <div className="absolute bottom-3 left-3 z-30 bg-slate-950/80 border border-cyan-500/30 rounded-lg p-2.5 text-xs text-slate-300 mono backdrop-blur-md pointer-events-none">
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

        {/* Center Crosshairs Overlay */}
        {showCrosshairs && (
          <div className="crosshair-reticle z-20 pointer-events-none">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Outer reticle ring */}
              <div className="w-10 h-10 border border-cyan-400/60 rounded-full border-dashed animate-spin-slow"></div>
              {/* Target dot */}
              <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full shadow-[0_0_8px_#38bdf8]"></div>
              {/* Cross lines */}
              <div className="absolute w-16 h-[1px] bg-cyan-400/40"></div>
              <div className="absolute h-16 w-[1px] bg-cyan-400/40"></div>
            </div>
          </div>
        )}

        {/* Main Sky Imagery */}
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
        ) : isDiffMode ? (
          /* Difference Image View (Epoch 2 - Epoch 1) */
          <div className="flex flex-col items-center justify-center p-4">
            <img
              src={differenceImageUrl}
              alt="SPHEREx Epoch Difference Subtraction"
              style={{ transform: `scale(${zoomLevel})` }}
              className="max-h-[420px] object-contain rounded-lg shadow-2xl transition-transform duration-200"
            />
            <div className="mt-2 text-xs text-slate-400 text-center mono">
              <span className="text-blue-400">Blue</span>: Negative residual (faded/shifted away) &bull;{' '}
              <span className="text-red-400">Red</span>: Positive residual (appeared/brightened)
            </div>
          </div>
        ) : (
          /* Single Epoch / Blink View */
          <div className="flex items-center justify-center p-4">
            <img
              src={currentEpoch?.image_url}
              alt={`SPHEREx Cutout - Epoch ${currentEpochIndex + 1}`}
              style={{ transform: `scale(${zoomLevel})` }}
              className="max-h-[420px] object-contain rounded-lg shadow-2xl transition-transform duration-200"
            />
          </div>
        )}
      </div>
    </div>
  );
}
