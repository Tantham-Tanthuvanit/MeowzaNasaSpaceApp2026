import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import SkyViewer from './components/SkyViewer';
import TimelineSlider from './components/TimelineSlider';
import SpectrumChart from './components/SpectrumChart';
import { Telescope, Satellite, Radio, Info, Compass, Sparkles, AlertCircle } from 'lucide-react';

const API_BASE = '';

export default function App() {
  // Celestial & Query States
  const [ra, setRa] = useState('08h55m10.831s');
  const [dec, setDec] = useState('-07d14m42.53s');
  const [fov, setFov] = useState(5.0);
  const [bandGroup, setBandGroup] = useState('stacked');
  const [stretch, setStretch] = useState('zscale');
  const [colormap, setColormap] = useState('inferno');

  // Cutout Data State
  const [skyData, setSkyData] = useState(null);
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Playback & Viewport States
  const [currentEpochIndex, setCurrentEpochIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.5);
  const [viewMode, setViewMode] = useState('single'); // 'single', 'diff', 'split'

  // 1. Load Presets & Read Initial URL Parameters
  useEffect(() => {
    // Fetch benchmark test targets
    fetch(`${API_BASE}/api/presets`)
      .then((res) => res.json())
      .then((data) => {
        setPresets(data);
      })
      .catch((err) => {
        console.warn('API presets unavailable, falling back to local defaults:', err);
      });

    // Check URL parameters (?ra=...&dec=...&fov=...)
    const params = new URLSearchParams(window.location.search);
    const urlRa = params.get('ra');
    const urlDec = params.get('dec');
    const urlFov = params.get('fov');
    const urlBand = params.get('band');

    if (urlRa && urlDec) {
      setRa(urlRa);
      setDec(urlDec);
      if (urlFov) setFov(parseFloat(urlFov));
      if (urlBand) setBandGroup(urlBand);
      fetchCutout(urlRa, urlDec, urlFov ? parseFloat(urlFov) : 5.0, urlBand || 'stacked', stretch, colormap);
    } else {
      // Default to NASA challenge target: WISE 0855
      fetchCutout('08h55m10.831s', '-07d14m42.53s', 5.0, 'stacked', 'zscale', 'inferno');
    }
  }, []);

  // Update browser URL query params without reloading for easy link sharing and embedding
  const updateUrlParams = (newRa, newDec, newFov, newBand) => {
    const params = new URLSearchParams(window.location.search);
    params.set('ra', newRa);
    params.set('dec', newDec);
    params.set('fov', newFov.toString());
    params.set('band', newBand);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // Fetch Sky Cutout Pipeline
  const fetchCutout = useCallback(
    async (targetRa, targetDec, targetFov, targetBand, targetStretch, targetCmap) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const query = new URLSearchParams({
          ra: targetRa,
          dec: targetDec,
          fov: targetFov.toString(),
          band_group: targetBand,
          stretch: targetStretch,
          colormap: targetCmap,
          epochs: '4'
        });

        const res = await fetch(`${API_BASE}/api/sky-cutout?${query.toString()}`);
        if (!res.ok) {
          const errorJson = await res.json().catch(() => ({}));
          throw new Error(errorJson.detail || errorJson.error || `HTTP error ${res.status}`);
        }
        const data = await res.json();
        setSkyData(data);
        setCurrentEpochIndex(0);
        updateUrlParams(targetRa, targetDec, targetFov, targetBand);
      } catch (err) {
        console.error('Failed to fetch sky cutout:', err);
        setErrorMessage(err.message || 'Error querying coordinates from SPHEREx archive.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSearch = (newRa, newDec, newFov) => {
    setRa(newRa);
    setDec(newDec);
    setFov(newFov);
    fetchCutout(newRa, newDec, newFov, bandGroup, stretch, colormap);
  };

  const handleSelectPreset = (preset) => {
    setRa(preset.ra);
    setDec(preset.dec);
    fetchCutout(preset.ra, preset.dec, fov, bandGroup, stretch, colormap);
  };

  const handleBandGroupChange = (newBand) => {
    setBandGroup(newBand);
    fetchCutout(ra, dec, fov, newBand, stretch, colormap);
  };

  const handleStretchChange = (newStretch) => {
    setStretch(newStretch);
    fetchCutout(ra, dec, fov, bandGroup, newStretch, colormap);
  };

  const handleColormapChange = (newColormap) => {
    setColormap(newColormap);
    fetchCutout(ra, dec, fov, bandGroup, stretch, newColormap);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Header Navigation */}
      <header className="border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Telescope className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  <span>NASA SPHEREx</span>
                  <span className="text-cyan-400">Sky Viewer</span>
                </h1>
                <span className="bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  v1.0 Space Apps
                </span>
              </div>
              <p className="text-xs text-slate-400">
                102-Band Near-Infrared Multi-Epoch Transient & Proper-Motion Discovery Engine
              </p>
            </div>
          </div>

          {/* Mission Telemetry Status */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300">Survey Cadence:</span>
              <span className="text-emerald-400 font-semibold">6 Months</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg mono">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Channels:</span>
              <span className="text-cyan-400 font-semibold">102 Near-IR</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-sm">{errorMessage}</div>
          </div>
        )}

        {/* 1. Coordinate Search & NASA Presets Bar */}
        <SearchBar
          ra={ra}
          dec={dec}
          fov={fov}
          bandGroup={bandGroup}
          stretch={stretch}
          colormap={colormap}
          presets={presets}
          onSearch={handleSearch}
          onSelectPreset={handleSelectPreset}
          onBandGroupChange={handleBandGroupChange}
          onStretchChange={handleStretchChange}
          onColormapChange={handleColormapChange}
          isLoading={isLoading}
        />

        {skyData && (
          <>
            {/* 2. Interactive Sky Viewer Canvas & Difference Comparator */}
            <SkyViewer
              epochs={skyData.epochs}
              differenceImageUrl={skyData.difference_image_url}
              targetInfo={skyData.target_info}
              currentEpochIndex={currentEpochIndex}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* 3. Multi-Frame Epoch Timeline Slider & Video Player */}
            <TimelineSlider
              epochs={skyData.epochs}
              currentEpochIndex={currentEpochIndex}
              onEpochChange={setCurrentEpochIndex}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
            />

            {/* 4. 102-Band Near-Infrared Spectrum Preview */}
            <SpectrumChart
              spectrum={skyData.spectrum_preview}
              targetInfo={skyData.target_info}
            />
          </>
        )}

        {/* Scientific Discovery Educational Card */}
        <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-800 pr-3 pb-3 md:pb-0">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>How to Spot Moving Objects</span>
            </div>
            <p className="text-slate-400">
              In the <strong className="text-slate-200">Blink Viewer</strong>, watch for point sources that shift relative to background stars. In the <strong className="text-amber-400">Difference Image</strong>, moving brown dwarfs leave a distinctive dipole: a dark negative hole next to a bright positive peak.
            </p>
          </div>

          <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-800 pr-3 pb-3 md:pb-0">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Infrared Light Layering</span>
            </div>
            <p className="text-slate-400">
              Stacking all 102 bands provides a <strong className="text-slate-200">~10x signal-to-noise boost</strong> ($\sqrt{102}$). Selecting individual detector arrays reveals molecular gas absorption (e.g. methane absorption in Array 4 vs Array 3).
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
              <Satellite className="w-4 h-4 text-emerald-400" />
              <span>Embeddable URL Queries</span>
            </div>
            <p className="text-slate-400">
              Every coordinate query updates the browser address bar with <code className="mono text-cyan-300">?ra=...&dec=...&fov=...</code>. Click "Share URL" to send exact celestial coordinates to collaborators or embed them in external web portals.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-8 bg-slate-950/60 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Built for the <strong className="text-slate-300">NASA Space Apps Challenge</strong> &bull; SPHEREx Mission Data Exploration
          </div>
          <div className="mono text-[11px] text-slate-400">
            Powered by Astropy &bull; FastAPI / Flask &bull; React
          </div>
        </div>
      </footer>
    </div>
  );
}
