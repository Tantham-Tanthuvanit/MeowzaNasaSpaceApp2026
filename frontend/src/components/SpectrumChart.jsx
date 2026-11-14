import { useState } from 'react';
import { BANDS } from '../core/targets';
import { fetchSpectrum, useRemote } from '../services/api';

// Chart geometry, in SVG units.
const W = 700, H = 300;
const LEFT = 58, RIGHT = 14, TOP = 12, BOTTOM = 62;
const PLOT_W = W - LEFT - RIGHT, PLOT_H = H - TOP - BOTTOM;
const MIN_UM = 0.75, MAX_UM = 5;
const xOf = (um) => LEFT + ((um - MIN_UM) / (MAX_UM - MIN_UM)) * PLOT_W;

// Round axis steps: 1, 2 or 5 times a power of ten, giving about four gridlines.
function niceStep(span) {
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].find((m) => m * pow >= raw) * pow;
}

function Chart({ channels, unit }) {
  const points = channels.filter((c) => c.flux_mjy_sr != null);
  const [picked, setPicked] = useState(null); // index into points
  if (!points.length) return <p className="text-[15px] text-muted">NASA’s pictures of this spot have no usable measurements at its centre.</p>;

  const values = points.map((c) => c.flux_mjy_sr);
  const lo = Math.min(0, ...values), hi = Math.max(...values);
  const step = niceStep(hi - lo || 1);
  const top = Math.ceil(hi / step) * step, bottom = Math.floor(lo / step) * step;
  const yOf = (v) => TOP + ((top - v) / (top - bottom)) * PLOT_H;
  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  const line = points.map((c, i) => `${i ? 'L' : 'M'}${xOf(c.wavelength_um).toFixed(1)} ${yOf(c.flux_mjy_sr).toFixed(1)}`).join('');
  const sel = picked === null ? null : points[picked];

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
    setPicked(Math.max(0, Math.min(points.length - 1, (picked ?? -1) + move)));
  };

  return (
    <div className="flex flex-col gap-2">
      <p aria-live="polite" className="min-h-[40px] text-sm leading-snug text-body">
        {sel ? (
          <>
            <span className="font-semibold text-ink">{sel.wavelength_um.toFixed(2)} µm</span> (colour {sel.channel} of 102, band {sel.detector}):
            brightness <span className="font-mono">{sel.flux_mjy_sr.toFixed(3)}</span> {unit}, measured in {sel.n_measurements} {sel.n_measurements === 1 ? 'picture' : 'pictures'}
          </>
        ) : (
          <span className="text-muted">Point at the chart to read one colour. With a keyboard, focus the chart and use the left and right arrow keys.</span>
        )}
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={`Line chart of brightness against wavelength, ${points.length} points from ${MIN_UM} to ${MAX_UM} micrometres. The same numbers are in the table below.`}
          onPointerMove={pickAt}
          onPointerDown={pickAt}
          onPointerLeave={() => setPicked(null)}
          onKeyDown={onKey}
          className="min-w-[520px] touch-pan-y rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {ticks.map((v) => (
            <g key={v}>
              <path d={`M${LEFT} ${yOf(v)}H${W - RIGHT}`} stroke={Math.abs(v) < step / 2 ? '#8A93A8' : '#E1E5EE'} strokeWidth="1" />
              <text x={LEFT - 8} y={yOf(v) + 4} textAnchor="end" fontSize="12" fill="#5A6580" className="font-mono">{v.toFixed(digits)}</text>
            </g>
          ))}
          {[1, 2, 3, 4, 5].map((um) => (
            <g key={um}>
              <path d={`M${xOf(um)} ${TOP + PLOT_H}v5`} stroke="#8A93A8" strokeWidth="1" />
              <text x={xOf(um)} y={TOP + PLOT_H + 19} textAnchor={um === 5 ? 'end' : 'middle'} fontSize="12" fill="#5A6580" className="font-mono">{um} µm</text>
            </g>
          ))}
          {/* Which detector band each stretch of the chart comes from. */}
          {BANDS.map((b) => {
            const [from, to] = b.range.split('–').map(Number);
            return (
              <g key={b.n}>
                <rect x={xOf(from) + 1} y={H - 30} width={xOf(to) - xOf(from) - 2} height="6" rx="3" fill={b.color} />
                <text x={(xOf(from) + xOf(to)) / 2} y={H - 9} textAnchor="middle" fontSize="12" fill="#3A4560">Band {b.n}</text>
              </g>
            );
          })}
          <path d={line} fill="none" stroke="#141A2E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {sel && (
            <>
              <path d={`M${xOf(sel.wavelength_um)} ${TOP}V${TOP + PLOT_H}`} stroke="#8A93A8" strokeWidth="1" />
              <circle cx={xOf(sel.wavelength_um)} cy={yOf(sel.flux_mjy_sr)} r="5" fill="#FF8A3D" stroke="#FFFFFF" strokeWidth="2" />
            </>
          )}
        </svg>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        Left to right: wavelength, from light just redder than the eye can see to deep infrared. Bottom to top: brightness in {unit}.
      </p>
      <details className="text-sm text-body">
        <summary className="cursor-pointer py-2 font-medium text-ink">Show the numbers as a table</summary>
        <div className="max-h-[320px] overflow-auto rounded-lg border border-soft bg-white">
          <table className="w-full text-left font-mono text-[13px]">
            <thead className="sticky top-0 bg-white font-sans text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Colour</th>
                <th className="px-3 py-2 font-semibold">Wavelength (µm)</th>
                <th className="px-3 py-2 font-semibold">Brightness ({unit})</th>
                <th className="px-3 py-2 font-semibold">Pictures</th>
              </tr>
            </thead>
            <tbody>
              {points.map((c) => (
                <tr key={c.channel} className="border-t border-soft">
                  <td className="px-3 py-1.5">{c.channel}</td>
                  <td className="px-3 py-1.5">{c.wavelength_um.toFixed(3)}</td>
                  <td className="px-3 py-1.5">{c.flux_mjy_sr.toFixed(4)}</td>
                  <td className="px-3 py-1.5">{c.n_measurements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// The spectrum of the centre of the picture. It is only fetched when asked for, because the
// backend has to download every picture of the spot first.
export default function SpectrumPanel({ ra, dec }) {
  const [asked, setAsked] = useState(false);
  const { data, error, loading, progress, retry } = useRemote(asked ? `${ra}|${dec}` : null, (onProgress, isCancelled) =>
    fetchSpectrum(ra, dec, onProgress, isCancelled)
  );

  return (
    <section aria-labelledby="spectrum-title" className="flex w-full player-w flex-col gap-3 border-t border-[#E1E5EE] pt-7">
      <h2 id="spectrum-title" className="font-display text-[22px] font-medium">The light here, split into 102 colours</h2>
      <p className="text-[15px] leading-relaxed text-muted">
        SPHEREx sees 102 shades of infrared light. This chart shows how bright the centre of the picture, under the orange cross, is in each one. Astronomers call it a spectrum. Its shape hints at what is there and how hot it is.
      </p>
      {!asked && <button type="button" onClick={() => setAsked(true)} className="btn-plain self-start">Measure the light here</button>}
      {loading && (
        <div role="status" className="text-[15px] leading-relaxed text-body">
          {progress ? (
            <>
              <p className="font-medium">Downloading picture {progress.cached_images} of {progress.total_images} from NASA…</p>
              <p className="text-[13px] text-muted">This needs every picture NASA has of this spot, so the first time can take 15 minutes or more. You can keep using the flipbook while you wait.</p>
            </>
          ) : (
            <p>Measuring…</p>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-[15px] font-medium text-danger">{error}</p>
          <button type="button" onClick={retry} className="btn-plain">Try again</button>
        </div>
      )}
      {data && <Chart channels={data.channels} unit={data.unit} />}
    </section>
  );
}
