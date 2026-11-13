import React, { useState } from 'react';
import { Search, Compass, Layers, Sliders, Share2, Check, Sparkles, Orbit } from 'lucide-react';

export default function SearchBar({
  ra,
  dec,
  fov,
  bandGroup,
  stretch,
  colormap,
  presets,
  onSearch,
  onSelectPreset,
  onBandGroupChange,
  onStretchChange,
  onColormapChange,
  isLoading
}) {
  const [raInput, setRaInput] = useState(ra);
  const [decInput, setDecInput] = useState(dec);
  const [fovInput, setFovInput] = useState(fov);
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Sync inputs when props change (e.g. clicking a preset)
  React.useEffect(() => {
    setRaInput(ra);
    setDecInput(dec);
    setFovInput(fov);
  }, [ra, dec, fov]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (raInput && decInput) {
      onSearch(raInput.trim(), decInput.trim(), parseFloat(fovInput) || 5.0);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredPresets = presets.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'planet_x') return p.category.includes('Planet X') || p.category.includes('TNO');
    if (selectedCategory === 'brown_dwarf') return p.category.includes('Brown Dwarf');
    if (selectedCategory === 'deep_field') return p.category.includes('Deep Field');
    if (selectedCategory === 'motion') return p.category.includes('Proper-Motion') || p.category.includes('Star');
    return true;
  });

  return (
    <div className="glass-panel p-5 mb-6">
      {/* Top Bar: Title & 1-Click NASA Benchmark Presets */}
      <div className="flex flex-col gap-3 pb-4 border-b border-cyan-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Orbit className="w-5 h-5 text-cyan-400 animate-spin-slow" />
              <h2 className="text-sm font-semibold tracking-wider uppercase text-cyan-400">
                NASA Challenge Benchmark Targets (1-Click Verification)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Official NASA SPHEREx test targets including Planet X analog Sedna, brown dwarfs, and deep survey fields:
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedCategory === 'all' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({presets.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('planet_x')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedCategory === 'planet_x' ? 'bg-rose-500 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Planet X / TNO
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('brown_dwarf')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedCategory === 'brown_dwarf' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Brown Dwarfs
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('deep_field')}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedCategory === 'deep_field' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Deep Fields
            </button>
          </div>
        </div>

        {/* Preset Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {filteredPresets.map((p) => {
            const isSelected = ra.includes(p.ra.slice(0, 5)) || p.name === p.matched_preset;
            const isPlanetX = p.category.includes('Planet X') || p.id === 'sedna_90377';
            const isDeepField = p.category.includes('Deep Field');
            const isBrownDwarf = p.category.includes('Brown Dwarf');

            return (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p)}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/30'
                    : isPlanetX
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:border-rose-400 hover:text-white'
                    : isDeepField
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:text-white'
                    : isBrownDwarf
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-white'
                    : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${
                  isPlanetX ? 'text-rose-400' : isDeepField ? 'text-emerald-400' : 'text-amber-400'
                }`} />
                <span>{p.name}</span>
                <span className="text-[10px] text-slate-400 ml-1 bg-slate-950/80 px-1.5 py-0.5 rounded font-mono">
                  {p.category.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Coordinate Input Form & Controls */}
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Right Ascension */}
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Right Ascension (RA)</span>
          </label>
          <input
            type="text"
            value={raInput}
            onChange={(e) => setRaInput(e.target.value)}
            placeholder="08h55m10.831s or 133.795"
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-sm text-cyan-200 mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* Declination */}
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Declination (Dec)</span>
          </label>
          <input
            type="text"
            value={decInput}
            onChange={(e) => setDecInput(e.target.value)}
            placeholder="-07d14m42.53s or -7.245"
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-sm text-cyan-200 mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* FOV */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            FOV (arcmin)
          </label>
          <select
            value={fovInput}
            onChange={(e) => setFovInput(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="2.0">2.0' (Deep Zoom)</option>
            <option value="5.0">5.0' (Standard)</option>
            <option value="10.0">10.0' (Wide Field)</option>
            <option value="15.0">15.0' (Cluster View)</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="md:col-span-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Querying Cutout...' : 'Query Sky Patch'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy shareable link with coordinates in URL"
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition-all flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-cyan-400" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share URL'}</span>
          </button>
        </div>
      </form>

      {/* Secondary Controls: Infrared Layering & Contrast Stretch */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Infrared Light Layering */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-slate-300 font-medium">Infrared Layer:</span>
          <select
            value={bandGroup}
            onChange={(e) => onBandGroupChange(e.target.value)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-400 font-mono text-xs"
          >
            <optgroup label="🔭 Stacks & Composites" className="bg-slate-950 text-cyan-300 font-semibold">
              <option value="stacked">All 102 Bands Stacked (High SNR)</option>
              <option value="false_color_rgb">False-Color Composite (Short+Mid+Long IR)</option>
            </optgroup>

            <optgroup label="🧪 Chemical & Ice Diagnostic Filters" className="bg-slate-950 text-amber-300 font-semibold">
              <option value="filter_h2o_ice">💧 H₂O Ice Filter (3.05 μm - Sedna / TNOs)</option>
              <option value="filter_h2o_vapor">💧 H₂O Vapor Filter (1.90 μm - Atmospheres)</option>
              <option value="filter_ch4_deep">🪐 CH₄ Deep Methane (3.30 μm - Brown Dwarf Drop)</option>
              <option value="filter_ch4_overtone">🪐 CH₄ Overtone Filter (1.66 μm)</option>
              <option value="filter_co2_ice">💨 CO₂ Ice Filter (4.25 μm)</option>
              <option value="filter_co">☁️ CO Carbon Monoxide (4.60 μm)</option>
              <option value="filter_h_bra">⚡ H Brackett-α (4.05 μm Accretion)</option>
              <option value="filter_pah_dust">✨ Silicate & PAH Dust (3.40 μm)</option>
            </optgroup>

            <optgroup label="📊 Spectral Indices & Ratios" className="bg-slate-950 text-emerald-300 font-semibold">
              <option value="ratio_ch4">CH₄ Absorption Index (F3.30 / F2.15)</option>
              <option value="ratio_h2o">H₂O Ice Index (F3.05 / F2.15)</option>
              <option value="diff_hydrogen">H Brackett-α Excess (Line - Continuum)</option>
            </optgroup>

            <optgroup label="🌌 Cross-Survey Photometric Bands" className="bg-slate-950 text-purple-300 font-semibold">
              <option value="filter_wise_w1">WISE W1 (3.40 μm)</option>
              <option value="filter_wise_w2">WISE W2 (4.60 μm - Cold Brown Dwarfs)</option>
              <option value="filter_j">2MASS J-Band (1.25 μm)</option>
              <option value="filter_h">2MASS H-Band (1.65 μm)</option>
              <option value="filter_ks">2MASS Ks-Band (2.15 μm)</option>
            </optgroup>

            <optgroup label="📐 SPHEREx Detector Arrays (1-6)" className="bg-slate-950 text-slate-300 font-semibold">
              <option value="array_1">Array 1: 0.75 - 1.11 μm</option>
              <option value="array_2">Array 2: 1.11 - 1.64 μm</option>
              <option value="array_3">Array 3: 1.64 - 2.42 μm</option>
              <option value="array_4">Array 4: 2.42 - 3.82 μm</option>
              <option value="array_5">Array 5: 3.82 - 4.42 μm</option>
              <option value="array_6">Array 6: 4.42 - 5.00 μm</option>
            </optgroup>
          </select>
        </div>

        {/* Contrast Stretch */}
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300 font-medium">Contrast Stretch:</span>
          <select
            value={stretch}
            onChange={(e) => onStretchChange(e.target.value)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="zscale">ZScale (Astronomical Standard)</option>
            <option value="asinh">Asinh (Dynamic Range)</option>
            <option value="linear">Linear</option>
            <option value="log">Logarithmic</option>
          </select>
        </div>

        {/* Colormap */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-medium">Colormap:</span>
          <select
            value={colormap}
            onChange={(e) => onColormapChange(e.target.value)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-400"
          >
            <option value="inferno">Inferno (Infrared Heat)</option>
            <option value="viridis">Viridis</option>
            <option value="magma">Magma</option>
            <option value="grayscale">Grayscale (Standard FITS)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
