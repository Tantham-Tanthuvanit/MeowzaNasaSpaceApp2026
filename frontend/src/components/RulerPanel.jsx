import { useMemo, useState } from 'react';
import { calculateProperMotion } from '../core/ruler';
import { fmtDate } from './FlipPlayer';

export default function RulerPanel({
  measurement,
  rulerState, // 'idle' | 'has_p1' | 'complete'
  onClear,
  onClose,
  frames = [],
  fov = 5.0,
}) {
  const [epochA, setEpochA] = useState(0);
  const [epochB, setEpochB] = useState(Math.max(0, frames.length - 1));

  // Calculate elapsed time between chosen epochs
  const motion = useMemo(() => {
    if (!measurement || frames.length < 2 || epochA === epochB) return null;
    const fA = frames[epochA];
    const fB = frames[epochB];
    if (!fA || !fB) return null;

    let deltaDays = 0;
    if (typeof fA.mjd === 'number' && typeof fB.mjd === 'number') {
      deltaDays = Math.abs(fB.mjd - fA.mjd);
    } else if (fA.timestamp && fB.timestamp) {
      const tA = new Date(fA.timestamp).getTime();
      const tB = new Date(fB.timestamp).getTime();
      deltaDays = Math.abs(tB - tA) / (1000 * 3600 * 24);
    }

    if (deltaDays < 1) return null;
    return calculateProperMotion(measurement.distanceArcsec, deltaDays);
  }, [measurement, frames, epochA, epochB]);

  return (
    <div
      role="region"
      aria-label="Astronomical Ruler and Distance Measurement"
      className="flex w-full flex-col gap-3 rounded-2xl border-2 border-sky-500/40 bg-surface p-4 shadow-md transition-all"
    >
      {/* Header with Title and Mode status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soft pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500 font-bold text-sm">
            📏
          </span>
          <div>
            <h3 className="font-semibold text-sm text-ink leading-tight">
              Astronomical Ruler &amp; Separation
            </h3>
            <p className="text-xs text-muted">
              {rulerState === 'idle' && 'Click anywhere on the sky picture to set Point A'}
              {rulerState === 'has_p1' && 'Point A set! Click a second spot to set Point B'}
              {rulerState === 'complete' && 'Measurement active — click any spot to measure again'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {measurement && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-soft px-2.5 py-1 text-xs font-medium text-body hover:border-ink hover:text-ink"
            >
              Reset points
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-soft/60 px-2.5 py-1 text-xs font-semibold text-body hover:bg-soft hover:text-ink"
            title="Exit Ruler Mode (Shortcut: M)"
          >
            Done
          </button>
        </div>
      </div>

      {/* Measurement Metrics Grid */}
      {measurement ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* 1. Angular Separation in Arcseconds */}
            <div className="flex flex-col rounded-xl bg-page p-2.5 border border-soft">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Angular Distance
              </span>
              <span className="mt-0.5 font-mono text-lg font-bold text-sky-500">
                {measurement.distanceArcsec}″
              </span>
              <span className="text-[11px] text-muted">
                {measurement.distanceArcmin}′ ({measurement.distanceMas.toLocaleString()} mas)
              </span>
            </div>

            {/* 2. Physical Pixels */}
            <div className="flex flex-col rounded-xl bg-page p-2.5 border border-soft">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Detector Distance
              </span>
              <span className="mt-0.5 font-mono text-lg font-bold text-ink">
                {measurement.distancePx} px
              </span>
              <span className="text-[11px] text-muted">
                256×256 grid ({((measurement.distancePx / 256) * 100).toFixed(1)}% FOV)
              </span>
            </div>

            {/* 3. Astronomical Position Angle (PA) */}
            <div className="flex flex-col rounded-xl bg-page p-2.5 border border-soft">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Position Angle (PA)
              </span>
              <span className="mt-0.5 font-mono text-lg font-bold text-ink">
                {measurement.positionAngleDeg}°
              </span>
              <span className="text-[11px] text-muted">
                Bearing: {measurement.compassDir} (E of N)
              </span>
            </div>

            {/* 4. Coordinate Offsets */}
            <div className="flex flex-col rounded-xl bg-page p-2.5 border border-soft">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Offset (ΔRA, ΔDec)
              </span>
              <div className="mt-0.5 font-mono text-xs font-medium text-ink">
                <span>ΔRA: {measurement.deltaRaArcsec >= 0 ? `+${measurement.deltaRaArcsec}` : measurement.deltaRaArcsec}″</span>
                <br />
                <span>ΔDec: {measurement.deltaDecArcsec >= 0 ? `+${measurement.deltaDecArcsec}` : measurement.deltaDecArcsec}″</span>
              </div>
            </div>
          </div>

          {/* Coordinate Endpoints Table */}
          <div className="flex flex-col gap-1 rounded-xl bg-page p-2.5 border border-soft text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soft pb-1 text-muted font-medium">
              <span>Endpoint Endpoints (EQ-J2000)</span>
              <span>FOV: {fov.toFixed(1)}′</span>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 pt-1 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-[#0B1020]">
                  A
                </span>
                <span>RA {measurement.coordA.raFormatted} · Dec {measurement.coordA.decFormatted}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  B
                </span>
                <span>RA {measurement.coordB.raFormatted} · Dec {measurement.coordB.decFormatted}</span>
              </div>
            </div>
          </div>

          {/* Motion / Proper Motion Speed Calculator across Survey Visits */}
          {frames.length >= 2 && (
            <div className="flex flex-col gap-2 rounded-xl bg-page p-3 border border-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">
                  ⏱️ Motion Across Visits (Proper Motion Rate)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 text-muted">
                    From
                    <select
                      value={epochA}
                      onChange={(e) => setEpochA(Number(e.target.value))}
                      className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink font-mono"
                    >
                      {frames.map((f, i) => (
                        <option key={i} value={i}>
                          V{i + 1} ({fmtDate(f.timestamp)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-muted">
                    To
                    <select
                      value={epochB}
                      onChange={(e) => setEpochB(Number(e.target.value))}
                      className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink font-mono"
                    >
                      {frames.map((f, i) => (
                        <option key={i} value={i}>
                          V{i + 1} ({fmtDate(f.timestamp)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {motion ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted">Elapsed: </span>
                    <strong className="font-mono text-ink">{motion.deltaDays} days</strong> ({motion.deltaYears} yrs)
                  </div>
                  <div>
                    <span className="text-muted">Apparent speed: </span>
                    <strong className="font-mono text-sky-500 font-bold">{motion.speedArcsecYr}″ / year</strong>{' '}
                    <span className="font-mono text-muted">({motion.speedMasYr.toLocaleString()} mas/yr)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Choose two distinct visits above to calculate speed across survey visits.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-soft p-4 text-center text-xs text-muted">
          Click on any star or feature in the image to place <strong>Point A</strong>, then click another point to measure distance, angle, and coordinates.
        </div>
      )}
    </div>
  );
}
