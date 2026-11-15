import { useMemo, useState } from 'react';
import { BANDS } from '../core/targets';
import { fmtRa, fmtDec } from '../core/sky';
import {
  SPECTRAL_FEATURES,
  findNearestFeature,
  calculateContinuum,
  detectSpectralFeatures,
  wavelengthToColor,
} from '../core/spectrum';
import { fetchSpectrum, useRemote } from '../services/api';

// Chart geometry, in SVG units.
const W = 720, H = 340;
const LEFT = 60, RIGHT = 20, TOP = 28, BOTTOM = 66;
const PLOT_W = W - LEFT - RIGHT, PLOT_H = H - TOP - BOTTOM;
const MIN_UM = 0.75, MAX_UM = 5.0;
const xOf = (um) => LEFT + ((um - MIN_UM) / (MAX_UM - MIN_UM)) * PLOT_W;

// Round axis steps: 1, 2 or 5 times a power of ten, giving about four gridlines.
function niceStep(span) {
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].find((m) => m * pow >= raw) * pow;
}

// Benchmark sky patches known to demonstrate strong absorption or emission signatures
export const BENCHMARK_PATCHES = [
  {
    name: 'WISE 0855 (Brown dwarf: H₂O ice & CH₄ absorption)',
    ra: 133.795129,
    dec: -7.245147,
    band: 6,
    note: 'Coldest known brown dwarf, showcasing intense 3.05 µm water ice & 1.66 / 3.3 µm methane absorption dips.',
  },
  {
    name: 'Proxima Centauri (M-dwarf flare star)',
    ra: 217.429167,
    dec: -62.679444,
    band: 1,
    note: 'Closest star to the Sun, an active flare star with infrared photospheric emission.',
  },
];

function InteractiveSpectrumPlot({ channels, unit }) {
  const points = useMemo(() => channels.filter((c) => c.flux_mjy_sr != null), [channels]);
  const [picked, setPicked] = useState(null); // index into points
  const [featureFilter, setFeatureFilter] = useState('all'); // 'all' | 'absorption' | 'emission' | 'none'

  const continuum = useMemo(() => calculateContinuum(points, 7), [points]);
  const detected = useMemo(() => detectSpectralFeatures(points), [points]);

  if (!points.length) {
    return (
      <div className="rounded-xl border border-soft bg-surface p-6 text-center text-[15px] text-muted">
        NASA’s pictures of this spot have no usable infrared measurements at its centre.
      </div>
    );
  }

  const values = points.map((c) => c.flux_mjy_sr);
  const lo = Math.min(0, ...values), hi = Math.max(...values);
  const step = niceStep(hi - lo || 1);
  const top = Math.ceil(hi / step) * step, bottom = Math.floor(lo / step) * step;
  const yOf = (v) => TOP + ((top - v) / (top - bottom || 1)) * PLOT_H;

  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
  const digits = Math.max(0, -Math.floor(Math.log10(step)));

  const line = points
    .map((c, i) => `${i ? 'L' : 'M'}${xOf(c.wavelength_um).toFixed(1)} ${yOf(c.flux_mjy_sr).toFixed(1)}`)
    .join('');

  const continuumLine = continuum
    .map((c, i) => `${i ? 'L' : 'M'}${xOf(c.wavelength_um).toFixed(1)} ${yOf(c.continuum_flux).toFixed(1)}`)
    .join('');

  const sel = picked === null ? null : points[picked];
  const matchedFeature = sel ? findNearestFeature(sel.wavelength_um, 0.08) : null;

  const pickAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const um = MIN_UM + ((((e.clientX - box.left) / box.width) * W - LEFT) / PLOT_W) * (MAX_UM - MIN_UM);
    let best = 0;
    points.forEach((c, i) => {
      if (Math.abs(c.wavelength_um - um) < Math.abs(points[best].wavelength_um - um)) best = i;
    });
    setPicked(best);
  };

  const onKey = (e) => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!move) return;
    e.preventDefault();
    setPicked((prev) => Math.max(0, Math.min(points.length - 1, (prev ?? -1) + move)));
  };

  // Filter spectral feature reference lines
  const visibleFeatures = SPECTRAL_FEATURES.filter((f) => {
    if (featureFilter === 'none') return false;
    if (featureFilter === 'absorption') return f.type === 'absorption';
    if (featureFilter === 'emission') return f.type === 'emission';
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Control row: Feature filters and live inspector readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-soft pb-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Spectral feature overlay">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted">Show:</span>
          {[
            ['all', 'All features'],
            ['absorption', 'Absorption (dips)'],
            ['emission', 'Emission (peaks)'],
            ['none', 'Clean plot'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFeatureFilter(id)}
              aria-pressed={featureFilter === id}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                featureFilter === id
                  ? 'bg-ink text-white dark:text-[#0B1020]'
                  : 'border border-soft bg-surface text-body hover:border-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#EE7F22]" aria-hidden="true" />
            Absorption (swallowed light)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" aria-hidden="true" />
            Emission (glowing light)
          </span>
        </div>
      </div>

      {/* Live readout banner */}
      <div
        aria-live="polite"
        className="flex min-h-[52px] items-center rounded-lg border border-soft bg-surface px-3.5 py-2 text-sm leading-snug text-body"
      >
        {sel ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-ink">
              {sel.wavelength_um.toFixed(3)} µm
            </span>
            <span className="text-muted">
              (Channel {sel.channel} of 102 · Band {sel.detector}):
            </span>
            <span>
              Brightness <strong className="font-mono text-ink">{sel.flux_mjy_sr.toFixed(4)}</strong> {unit}
            </span>
            <span className="text-xs text-muted">
              ({sel.n_measurements} {sel.n_measurements === 1 ? 'picture' : 'pictures'} stacked)
            </span>
            {matchedFeature && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  matchedFeature.type === 'absorption'
                    ? 'bg-[#FFF3E0] text-[#B45309] dark:bg-[#2A1D0F] dark:text-[#FBBF24]'
                    : 'bg-[#ECFDF5] text-[#047857] dark:bg-[#064E3B] dark:text-[#6EE7B7]'
                }`}
              >
                <span>{matchedFeature.type === 'absorption' ? '▼ Absorption' : '▲ Emission'}:</span>
                <strong>{matchedFeature.name}</strong>
                <span className="hidden sm:inline opacity-80">— {matchedFeature.desc}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted text-xs sm:text-sm">
            Point at the graph or focus it and use the <kbd className="rounded border border-soft px-1 font-mono text-xs">←</kbd> and <kbd className="rounded border border-soft px-1 font-mono text-xs">→</kbd> arrow keys to inspect the 102 colours, dips, and peaks.
          </p>
        )}
      </div>

      {/* SVG Spectrum Line Graph */}
      <div className="overflow-x-auto rounded-xl border border-soft bg-surface p-2 shadow-sm">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={`Absorption and emission spectra plot: brightness against wavelength from ${MIN_UM} to ${MAX_UM} micrometres across 102 SPHEREx channels.`}
          onPointerMove={pickAt}
          onPointerDown={pickAt}
          onPointerLeave={() => setPicked(null)}
          onKeyDown={onKey}
          className="min-w-[560px] w-full touch-pan-y rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink select-none"
        >
          {/* Y-axis horizontal gridlines */}
          {ticks.map((v) => (
            <g key={v}>
              <path
                d={`M${LEFT} ${yOf(v)}H${W - RIGHT}`}
                stroke={Math.abs(v) < step / 2 ? 'var(--color-muted)' : 'var(--color-soft)'}
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={yOf(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-muted)"
                className="font-mono"
              >
                {v.toFixed(digits)}
              </text>
            </g>
          ))}

          {/* X-axis vertical tick marks & labels */}
          {[1, 2, 3, 4, 5].map((um) => (
            <g key={um}>
              <path d={`M${xOf(um)} ${TOP + PLOT_H}v5`} stroke="var(--color-muted)" strokeWidth="1" />
              <text
                x={xOf(um)}
                y={TOP + PLOT_H + 18}
                textAnchor={um === 5 ? 'end' : 'middle'}
                fontSize="11"
                fill="var(--color-muted)"
                className="font-mono"
              >
                {um} µm
              </text>
            </g>
          ))}

          {/* SPHEREx detector bands bar along bottom */}
          {BANDS.map((b) => {
            const [from, to] = b.range.split('–').map(Number);
            const x1 = xOf(from), x2 = xOf(to);
            return (
              <g key={b.n}>
                <rect x={x1 + 1} y={H - 30} width={Math.max(2, x2 - x1 - 2)} height="6" rx="3" fill={b.color} />
                <text
                  x={(x1 + x2) / 2}
                  y={H - 9}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--color-body)"
                  className="font-medium"
                >
                  Band {b.n}
                </text>
              </g>
            );
          })}

          {/* Absorption & Emission Feature Guide Lines */}
          {visibleFeatures.map((feat) => {
            const x = xOf(feat.wavelength_um);
            const isAbs = feat.type === 'absorption';
            const strokeColor = isAbs ? '#EE7F22' : '#10B981';
            return (
              <g key={feat.id} opacity="0.85">
                <line
                  x1={x}
                  y1={TOP}
                  x2={x}
                  y2={TOP + PLOT_H}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                {/* Triangular marker indicating absorption (downward) or emission (upward) */}
                {isAbs ? (
                  <path
                    d={`M${x - 4} ${TOP} L${x + 4} ${TOP} L${x} ${TOP + 6} Z`}
                    fill={strokeColor}
                  />
                ) : (
                  <path
                    d={`M${x - 4} ${TOP + PLOT_H} L${x + 4} ${TOP + PLOT_H} L${x} ${TOP + PLOT_H - 6} Z`}
                    fill={strokeColor}
                  />
                )}
                <text
                  x={x}
                  y={isAbs ? TOP + 17 : TOP + PLOT_H - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={strokeColor}
                  className="font-semibold select-none"
                >
                  {feat.label}
                </text>
              </g>
            );
          })}

          {/* Continuum baseline estimation */}
          <path
            d={continuumLine}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.5"
          />

          {/* Main observed spectrum curve */}
          <path
            d={line}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Highlighted point and crosshair */}
          {sel && (
            <>
              <line
                x1={xOf(sel.wavelength_um)}
                y1={TOP}
                x2={xOf(sel.wavelength_um)}
                y2={TOP + PLOT_H}
                stroke="var(--color-ink)"
                strokeWidth="1"
                opacity="0.6"
              />
              <circle
                cx={xOf(sel.wavelength_um)}
                cy={yOf(sel.flux_mjy_sr)}
                r="6"
                fill="#FF8A3D"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>
      </div>

      {/* Kirchhoff Dual Visual Spectra Bars (Absorption & Emission Physical Strips) */}
      <div className="flex flex-col gap-3 rounded-xl border border-soft bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Kirchhoff’s Spectra: Continuous, Absorption &amp; Emission Barcodes
          </h3>
          <span className="text-xs text-muted">0.75 µm → 5.00 µm</span>
        </div>

        {/* 1. Absorption Spectrum Bar: Rainbow infrared continuum with dark absorption slits */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#EE7F22]">
              ▼ Absorption Spectrum (Dark lines where cool dust &amp; ices absorb infrared light)
            </span>
          </div>
          <div
            className="relative h-6 w-full overflow-hidden rounded shadow-inner"
            style={{
              background:
                'linear-gradient(to right, #3D5BE0 0%, #1FA2B8 20%, #2FA85A 40%, #E2B41F 65%, #EE7F22 82%, #D2362F 100%)',
            }}
            title="Absorption spectrum: Continuous infrared light punctuated by dark absorption bands"
          >
            {SPECTRAL_FEATURES.filter((f) => f.type === 'absorption').map((feat) => {
              const pct = ((feat.wavelength_um - MIN_UM) / (MAX_UM - MIN_UM)) * 100;
              return (
                <div
                  key={feat.id}
                  className="absolute top-0 bottom-0 w-1 bg-black/85"
                  style={{ left: `${pct}%` }}
                  title={`Absorption band: ${feat.name}`}
                />
              );
            })}
          </div>
        </div>

        {/* 2. Emission Spectrum Bar: Dark background with glowing vertical emission lines */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#10B981]">
              ▲ Emission Spectrum (Glowing bright lines where hot ionized gas &amp; dust radiate)
            </span>
          </div>
          <div
            className="relative h-6 w-full overflow-hidden rounded bg-[#070B14] shadow-inner"
            title="Emission spectrum: Distinct glowing emission lines on a dark space background"
          >
            {SPECTRAL_FEATURES.filter((f) => f.type === 'emission').map((feat) => {
              const pct = ((feat.wavelength_um - MIN_UM) / (MAX_UM - MIN_UM)) * 100;
              const color = wavelengthToColor(feat.wavelength_um);
              return (
                <div
                  key={feat.id}
                  className="absolute top-0 bottom-0 w-1 shadow-[0_0_8px_currentColor]"
                  style={{ left: `${pct}%`, backgroundColor: color, color }}
                  title={`Emission line: ${feat.name}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Detected features summary card */}
      {(detected.absorption.length > 0 || detected.emission.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-soft bg-surface p-3.5">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#EE7F22]">
              <span>▼</span> Detected Absorption Dips ({detected.absorption.length})
            </h4>
            <p className="mt-1 text-xs text-muted">
              Channels where brightness dips below the surrounding continuum, indicating cool intervening gas or ice grains.
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-xs">
              {detected.absorption.slice(0, 4).map((item) => (
                <li key={item.channel} className="flex items-center justify-between rounded bg-page px-2 py-1">
                  <span>
                    <strong>{item.wavelength_um.toFixed(2)} µm</strong>{' '}
                    {item.matchedFeature ? `(${item.matchedFeature.name})` : `(Channel ${item.channel})`}
                  </span>
                  <span className="font-mono text-[#B45309] dark:text-[#FBBF24]">
                    {item.delta_pct}% dip
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-soft bg-surface p-3.5">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#10B981]">
              <span>▲</span> Detected Emission Peaks ({detected.emission.length})
            </h4>
            <p className="mt-1 text-xs text-muted">
              Channels where brightness spikes above the continuum, tracing hot ionized hydrogen, shocks, or dust.
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-xs">
              {detected.emission.slice(0, 4).map((item) => (
                <li key={item.channel} className="flex items-center justify-between rounded bg-page px-2 py-1">
                  <span>
                    <strong>{item.wavelength_um.toFixed(2)} µm</strong>{' '}
                    {item.matchedFeature ? `(${item.matchedFeature.name})` : `(Channel ${item.channel})`}
                  </span>
                  <span className="font-mono text-[#047857] dark:text-[#6EE7B7]">
                    +{item.delta_pct}% peak
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Collapsible complete 102-channel measurement table */}
      <details className="text-sm text-body">
        <summary className="cursor-pointer py-2 font-medium text-ink hover:underline">
          Show all 102 colours as a table
        </summary>
        <div className="max-h-[320px] overflow-auto rounded-lg border border-soft bg-surface">
          <table className="w-full text-left font-mono text-[13px]">
            <thead className="sticky top-0 bg-surface font-sans text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Colour #</th>
                <th className="px-3 py-2 font-semibold">Band</th>
                <th className="px-3 py-2 font-semibold">Wavelength (µm)</th>
                <th className="px-3 py-2 font-semibold">Brightness ({unit})</th>
                <th className="px-3 py-2 font-semibold">Pictures</th>
                <th className="px-3 py-2 font-semibold">Feature match</th>
              </tr>
            </thead>
            <tbody>
              {points.map((c) => {
                const feat = findNearestFeature(c.wavelength_um, 0.06);
                return (
                  <tr key={c.channel} className="border-t border-soft">
                    <td className="px-3 py-1.5">{c.channel}</td>
                    <td className="px-3 py-1.5">Band {c.detector}</td>
                    <td className="px-3 py-1.5">{c.wavelength_um.toFixed(3)}</td>
                    <td className="px-3 py-1.5 font-medium text-ink">{c.flux_mjy_sr.toFixed(4)}</td>
                    <td className="px-3 py-1.5">{c.n_measurements}</td>
                    <td className="px-3 py-1.5 font-sans text-xs">
                      {feat ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 ${
                            feat.type === 'absorption'
                              ? 'bg-[#FFF3E0] text-[#B45309] dark:bg-[#2A1D0F] dark:text-[#FBBF24]'
                              : 'bg-[#ECFDF5] text-[#047857] dark:bg-[#064E3B] dark:text-[#6EE7B7]'
                          }`}
                        >
                          {feat.type === 'absorption' ? '▼ ' : '▲ '}
                          {feat.label}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// The spectrum of the centre of the picture. Positioned directly below the flipbook controls.
// Shows absorption dips and emission lines across 102 SPHEREx near-infrared colours.
export default function SpectrumPanel({ ra, dec, fov = 5.0, onSelectPatch }) {
  const hasCoordinates = ra != null && dec != null;
  // Automatically request spectrum if viewing the cached benchmark demo target WISE 0855
  const isWiseBenchmark =
    hasCoordinates && Math.abs(ra - 133.795129) < 0.001 && Math.abs(dec - (-7.245147)) < 0.001;

  const [asked, setAsked] = useState(isWiseBenchmark);

  const queryKey = asked && hasCoordinates ? `${ra}|${dec}|${fov}` : null;
  const { data, error, loading, progress, retry } = useRemote(queryKey, (onProgress, isCancelled) =>
    fetchSpectrum(ra, dec, fov, onProgress, isCancelled)
  );

  return (
    <section
      id="spectrum-section"
      aria-labelledby="spectrum-title"
      className="flex w-full player-w flex-col gap-4 border-t border-soft pt-7"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
            <h2 id="spectrum-title" className="font-display text-[22px] font-medium text-ink">
              Absorption &amp; emission spectra
            </h2>
          </div>
          <span className="rounded-full border border-soft bg-surface px-3 py-1 text-xs font-semibold text-muted">
            102 colours · 0.75 – 5.00 µm
          </span>
        </div>

        <p className="text-[15px] leading-relaxed text-muted">
          SPHEREx measures 102 infrared colours for every patch of sky. This graph shows the brightness of the spot under the orange crosshair, highlighting <strong>absorption lines</strong> (where cooler gas or dust swallows light, creating dips) and <strong>emission lines</strong> (where hot gas radiates, creating peaks).
        </p>

        {/* Benchmark patches quick chooser */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted">Try benchmark sky patches:</span>
          {BENCHMARK_PATCHES.map((patch) => {
            const isCurrent =
              hasCoordinates && Math.abs(ra - patch.ra) < 0.001 && Math.abs(dec - patch.dec) < 0.001;
            return (
              <button
                key={patch.name}
                type="button"
                onClick={() => {
                  if (onSelectPatch) {
                    onSelectPatch(patch.ra, patch.dec, patch.band);
                  }
                  setAsked(true);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  isCurrent
                    ? 'border border-accent bg-accent text-[#0B1020] font-semibold'
                    : 'border border-soft bg-surface text-body hover:border-ink'
                }`}
                title={patch.note}
              >
                {patch.name.split(' ')[0]} {patch.name.split(' ')[1]}
              </button>
            );
          })}
        </div>
      </div>

      {!hasCoordinates && (
        <div className="rounded-xl border border-soft bg-surface p-6 text-center text-[15px] text-body">
          <p className="font-medium text-ink">Choose a sky patch to measure its absorption and emission spectra</p>
          <p className="mt-1 text-xs text-muted">
            Enter coordinates on the left or click <strong>WISE 0855</strong> above to inspect a real cosmic spectrum.
          </p>
        </div>
      )}

      {hasCoordinates && !asked && (
        <div className="flex flex-col items-start gap-2.5 rounded-xl border border-soft bg-surface p-5">
          <p className="text-sm text-body">
            Ready to measure the infrared spectrum for this spot (RA {fmtRa(ra)}, Dec {fmtDec(dec)}).
          </p>
          <button
            type="button"
            onClick={() => setAsked(true)}
            className="btn-primary"
          >
            Measure absorption &amp; emission spectra here
          </button>
        </div>
      )}

      {loading && (
        <div role="status" className="rounded-xl border border-soft bg-surface p-6 text-[15px] leading-relaxed text-body">
          {progress ? (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-ink">
                Downloading picture {progress.cached_images} of {progress.total_images} from NASA…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full bg-accent transition-[width] duration-300"
                  style={{
                    width: `${Math.max(4, Math.round((progress.cached_images / Math.max(progress.total_images, 1)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted">
                SPHEREx spectra synthesize all 102 channels. NASA IRSA downloads take a few minutes the first time, then cache permanently. You can keep using the flipbook while you wait.
              </p>
            </div>
          ) : (
            <p className="motion-safe:animate-pulse">Measuring absorption &amp; emission spectra from NASA images…</p>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-5">
          <p className="text-[15px] font-medium text-danger">{error}</p>
          <button type="button" onClick={retry} className="btn-plain">
            Try again
          </button>
        </div>
      )}

      {data && <InteractiveSpectrumPlot channels={data.channels} unit={data.unit} />}
    </section>
  );
}
