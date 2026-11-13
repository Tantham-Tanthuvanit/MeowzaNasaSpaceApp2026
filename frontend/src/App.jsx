import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import SkyViewer from './components/SkyViewer';
import TimelineSlider from './components/TimelineSlider';
import SpectrumChart from './components/SpectrumChart';
import { FlaggedDiscoveriesPanel } from './components/FlaggedDiscoveries';
import { 
  fetchPresets, 
  fetchSkyCutout, 
  syncUrlWithQuery, 
  readInitialUrlParams,
  fetchCandidatesApi,
  createCandidateApi,
  voteCandidateApi,
  deleteCandidateApi
} from './services/api';
import { Telescope, Satellite, Radio, Info, Compass, Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  const initialParams = readInitialUrlParams();

  // Celestial & Query States
  const [ra, setRa] = useState(initialParams.ra);
  const [dec, setDec] = useState(initialParams.dec);
  const [fov, setFov] = useState(initialParams.fov);
  const [bandGroup, setBandGroup] = useState(initialParams.band);
  const [stretch, setStretch] = useState('zscale');
  const [colormap, setColormap] = useState('inferno');

  // Cutout Data State
  const [skyData, setSkyData] = useState(null);
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Citizen Science Flagged Candidates State (with LocalStorage & SQLite database synchronization)
  const [flaggedCandidates, setFlaggedCandidates] = useState(() => {
    try {
      const saved = localStorage.getItem('spherex_flagged_candidates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleFlagCandidate = async (newCandidate) => {
    // 1. Persist to SQLite Database
    const saved = await createCandidateApi(newCandidate);
    // 2. Update React State & LocalStorage
    setFlaggedCandidates((prev) => {
      const filtered = prev.filter((c) => c.id !== saved.id);
      const updated = [saved, ...filtered];
      try {
        localStorage.setItem('spherex_flagged_candidates', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to persist flagged candidate:', err);
      }
      return updated;
    });
  };

  const handleDeleteCandidate = async (candidateId) => {
    // 1. Remove from SQLite Database
    await deleteCandidateApi(candidateId);
    // 2. Update React State & LocalStorage
    setFlaggedCandidates((prev) => {
      const updated = prev.filter((c) => c.id !== candidateId);
      try {
        localStorage.setItem('spherex_flagged_candidates', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update persisted candidates:', err);
      }
      return updated;
    });
  };

  const handleVoteCandidate = async (candidateId, voteData = {}) => {
    // 1. Cast corroboration vote in SQLite Database
    const updated = await voteCandidateApi(candidateId, voteData);
    if (updated) {
      setFlaggedCandidates((prev) => {
        const list = prev.map((c) => (c.id === candidateId ? { ...c, ...updated } : c));
        try {
          localStorage.setItem('spherex_flagged_candidates', JSON.stringify(list));
        } catch (err) {
          console.error('Failed to update persisted candidates:', err);
        }
        return list;
      });
    }
  };

  const handleClearAllCandidates = () => {
    setFlaggedCandidates([]);
    try {
      localStorage.removeItem('spherex_flagged_candidates');
    } catch (err) {
      console.error('Failed to clear persisted candidates:', err);
    }
  };

  // Playback & Viewport States
  const [currentEpochIndex, setCurrentEpochIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.5);
  const [viewMode, setViewMode] = useState('single'); // 'single', 'diff', 'split'

  // Fetch Cutout Pipeline
  const loadSkyData = useCallback(
    async (targetRa, targetDec, targetFov, targetBand, targetStretch, targetCmap) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchSkyCutout({
          ra: targetRa,
          dec: targetDec,
          fov: targetFov,
          bandGroup: targetBand,
          stretch: targetStretch,
          colormap: targetCmap,
          epochs: 4
        });
        setSkyData(data);
        setCurrentEpochIndex(0);
        syncUrlWithQuery(targetRa, targetDec, targetFov, targetBand);
      } catch (err) {
        console.error('Failed to load sky data:', err);
        setErrorMessage(err.message || 'Error querying coordinates from SPHEREx archive.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 1. Initial Load: Presets, Database Candidates & Initial Cutout
  useEffect(() => {
    // Fetch benchmark test targets
    fetchPresets().then((data) => {
      if (Array.isArray(data)) setPresets(data);
    });

    // Fetch existing discovery candidates from SQLite database
    fetchCandidatesApi().then((dbCandidates) => {
      if (Array.isArray(dbCandidates) && dbCandidates.length > 0) {
        setFlaggedCandidates(dbCandidates);
        try {
          localStorage.setItem('spherex_flagged_candidates', JSON.stringify(dbCandidates));
        } catch (e) {
          console.warn('Failed to cache db candidates to local storage:', e);
        }
      }
    });

    // Load initial sky patch (from URL params or default WISE 0855)
    loadSkyData(
      initialParams.ra,
      initialParams.dec,
      initialParams.fov,
      initialParams.band,
      'zscale',
      'inferno'
    );
  }, [loadSkyData]);

  const handleSearch = (newRa, newDec, newFov) => {
    setRa(newRa);
    setDec(newDec);
    setFov(newFov);
    loadSkyData(newRa, newDec, newFov, bandGroup, stretch, colormap);
  };

  const handleSelectPreset = (preset) => {
    setRa(preset.ra);
    setDec(preset.dec);
    loadSkyData(preset.ra, preset.dec, fov, bandGroup, stretch, colormap);
  };

  const handleBandGroupChange = (newBand) => {
    setBandGroup(newBand);
    loadSkyData(ra, dec, fov, newBand, stretch, colormap);
  };

  const handleStretchChange = (newStretch) => {
    setStretch(newStretch);
    loadSkyData(ra, dec, fov, bandGroup, newStretch, colormap);
  };

  const handleColormapChange = (newColormap) => {
    setColormap(newColormap);
    loadSkyData(ra, dec, fov, bandGroup, stretch, newColormap);
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
          onFovChange={(newFov) => {
            setFov(newFov);
            if (skyData) {
              setSkyData((prev) => prev ? {
                ...prev,
                target_info: {
                  ...prev.target_info,
                  fov_arcmin: newFov
                }
              } : prev);
            }
          }}
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
              differenceImages={skyData.difference_images || {}}
              shiftAndAddData={skyData.shift_and_add || null}
              targetInfo={skyData.target_info}
              fov={fov}
              catalogOverlay={skyData.catalog_overlay || []}
              candidates={flaggedCandidates}
              onFlagCandidate={handleFlagCandidate}
              onDeleteCandidate={handleDeleteCandidate}
              currentEpochIndex={currentEpochIndex}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* 2.5 Citizen Science Flagged Discoveries Log & NASA Dossier Export */}
            <FlaggedDiscoveriesPanel
              candidates={flaggedCandidates}
              onDeleteCandidate={handleDeleteCandidate}
              onClearAll={handleClearAllCandidates}
              onVoteCandidate={handleVoteCandidate}
              targetInfo={skyData.target_info}
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
