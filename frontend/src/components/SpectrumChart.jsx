import React, { useState } from 'react';
import { Activity, Info, Sparkles } from 'lucide-react';

const ARRAY_COLORS = {
  1: '#818cf8', // Indigo
  2: '#38bdf8', // Cyan
  3: '#34d399', // Emerald
  4: '#fbbf24', // Amber
  5: '#fb923c', // Orange
  6: '#f87171', // Red
};

export default function SpectrumChart({ spectrum = [], targetInfo }) {
  const [hoveredBand, setHoveredBand] = useState(null);

  if (!spectrum || spectrum.length === 0) {
    return null;
  }

  // Calculate SVG chart coordinates
  const width = 800;
  const height = 180;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const minWave = 0.75;
  const maxWave = 5.00;

  const fluxes = spectrum.map((s) => s.flux);
  const maxFlux = Math.max(...fluxes, 1.0) * 1.15;
  const minFlux = Math.max(0, Math.min(...fluxes, 0.0) * 0.9);

  const getX = (wave) => padding.left + ((wave - minWave) / (maxWave - minWave)) * (width - padding.left - padding.right);
  const getY = (flux) => height - padding.bottom - ((flux - minFlux) / (maxFlux - minFlux)) * (height - padding.top - padding.bottom);

  // Build SVG path
  const points = spectrum.map((d) => `${getX(d.wavelength_um)},${getY(d.flux)}`).join(' ');
  const areaPath = `${points} L ${getX(spectrum[spectrum.length - 1].wavelength_um)},${height - padding.bottom} L ${getX(spectrum[0].wavelength_um)},${height - padding.bottom} Z`;

  // Molecular absorption features
  const molecules = [
    { label: 'H2O', wave: 1.4, desc: 'Water vapor' },
    { label: 'CH4', wave: 1.66, desc: 'Methane absorption' },
    { label: 'H2O', wave: 1.9, desc: 'Water band' },
    { label: 'CO', wave: 2.3, desc: 'Carbon Monoxide' },
    { label: 'CH4', wave: 3.3, desc: 'Deep Methane in Brown Dwarfs' },
    { label: 'CO2', wave: 4.25, desc: 'Carbon Dioxide' },
    { label: 'CO', wave: 4.6, desc: 'Carbon Monoxide bandhead' },
  ];

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-amber-400">
            SPHEREx 102-Band Near-Infrared Spectrum Preview
          </h3>
          <span className="text-xs text-slate-400 mono">
            ({targetInfo?.matched_preset || 'Target SED'} &bull; 0.75 - 5.00 μm)
          </span>
        </div>

        {/* Array Color Key */}
        <div className="flex items-center gap-2 text-[10px] mono">
          <span className="text-slate-400">Arrays:</span>
          {[1, 2, 3, 4, 5, 6].map((arrNum) => (
            <span key={arrNum} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ARRAY_COLORS[arrNum] }}></span>
              <span className="text-slate-300">A{arrNum}</span>
            </span>
          ))}
        </div>
      </div>

      {/* SVG Spectrum Visualization */}
      <div className="relative mt-4 bg-slate-950/80 rounded-xl p-2 border border-slate-800 overflow-x-auto">
        {/* Hovered Tooltip */}
        {hoveredBand && (
          <div
            className="absolute z-20 bg-slate-900 border border-cyan-400/60 rounded px-2.5 py-1 text-xs mono text-cyan-200 pointer-events-none shadow-lg -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(getX(hoveredBand.wavelength_um) / width) * 100}%`,
              top: '25%'
            }}
          >
            <div>Band #{hoveredBand.band_index} &bull; Array {hoveredBand.detector_array}</div>
            <div className="text-white font-bold">{hoveredBand.wavelength_um} μm: {hoveredBand.flux.toFixed(2)} Jy</div>
          </div>
        )}

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px] select-none">
          {/* Background Grid Lines */}
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#334155" strokeWidth="1" />
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#334155" strokeWidth="1" />

          {/* Detector Array Background Shading */}
          {[
            { start: 0.75, end: 1.11, arr: 1 },
            { start: 1.11, end: 1.64, arr: 2 },
            { start: 1.64, end: 2.42, arr: 3 },
            { start: 2.42, end: 3.82, arr: 4 },
            { start: 3.82, end: 4.42, arr: 5 },
            { start: 4.42, end: 5.00, arr: 6 },
          ].map((seg) => {
            const x1 = getX(seg.start);
            const x2 = getX(seg.end);
            return (
              <rect
                key={seg.arr}
                x={x1}
                y={padding.top}
                width={Math.max(1, x2 - x1)}
                height={height - padding.top - padding.bottom}
                fill={ARRAY_COLORS[seg.arr]}
                opacity="0.05"
              />
            );
          })}

          {/* Area under curve */}
          <path d={`M ${areaPath}`} fill="url(#spectrumGradient)" opacity="0.35" />

          <defs>
            <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="25%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#34d399" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="90%" stopColor="#f87171" />
            </linearGradient>
          </defs>

          {/* Spectral Line */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Molecular Absorption Callout Vertical Lines */}
          {molecules.map((m, idx) => {
            const xPos = getX(m.wave);
            return (
              <g key={idx}>
                <line
                  x1={xPos}
                  y1={padding.top + 5}
                  x2={xPos}
                  y2={height - padding.bottom}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                <text
                  x={xPos}
                  y={padding.top - 2}
                  fill="#f59e0b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* Interactive Data Points for 102 bands */}
          {spectrum.map((d) => (
            <circle
              key={d.band_index}
              cx={getX(d.wavelength_um)}
              cy={getY(d.flux)}
              r="3.5"
              fill={ARRAY_COLORS[d.detector_array]}
              className="cursor-pointer hover:r-5 transition-all opacity-80 hover:opacity-100"
              onMouseEnter={() => setHoveredBand(d)}
              onMouseLeave={() => setHoveredBand(null)}
            />
          ))}

          {/* X-Axis Ticks & Labels */}
          {[1.0, 2.0, 3.0, 4.0, 5.0].map((tick) => (
            <g key={tick}>
              <line
                x1={getX(tick)}
                y1={height - padding.bottom}
                x2={getX(tick)}
                y2={height - padding.bottom + 5}
                stroke="#64748b"
                strokeWidth="1"
              />
              <text
                x={getX(tick)}
                y={height - padding.bottom + 18}
                fill="#94a3b8"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {tick}.0 μm
              </text>
            </g>
          ))}

          {/* Axis Titles */}
          <text
            x={width / 2}
            y={height - 5}
            fill="#64748b"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            Near-Infrared Wavelength (λ in micrometers)
          </text>
          <text
            x={12}
            y={height / 2}
            fill="#64748b"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
            transform={`rotate(-90 12 ${height / 2})`}
          >
            Flux Density
          </text>
        </svg>
      </div>
    </div>
  );
}
