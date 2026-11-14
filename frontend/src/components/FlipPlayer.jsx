import { useEffect, useState } from 'react';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2025-06-15" -> "15 Jun 2025"
export function fmtDate(timestamp) {
  const [y, m, d] = String(timestamp || '').split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : '';
}

// Steps through frames on a timer. Restarts from the first frame when `resetKey` changes.
export function useFlipbook(count, resetKey, startPlaying = true) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(startPlaying);
  const [speed, setSpeed] = useState(2);

  useEffect(() => {
    setFrame(0);
    setPlaying(startPlaying);
  }, [resetKey, startPlaying]);

  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % count), 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, count, speed]);

  const show = (f) => {
    setPlaying(false);
    setFrame(((f % count) + count) % count);
  };
  return { frame: count ? Math.min(frame, count - 1) : 0, playing, setPlaying, speed, setSpeed, show };
}

// The flipbook: one square picture plus play controls, scrubber and a thumbnail per frame.
// frames: [{ image_url, timestamp }] oldest first. progress: null or { cached_images, total_images }
// while the backend downloads the pictures from NASA. emptyText shows when there is nothing to load.
export default function FlipPlayer({ frames, loading, progress, error, onRetry, emptyText, resetKey, bandLabel, bandDot, label }) {
  const count = frames.length;
  const { frame, playing, setPlaying, speed, setSpeed, show } = useFlipbook(count, resetKey);
  const current = frames[frame];

  return (
    <div className="flex w-full max-w-[700px] flex-col gap-3.5">
      <div
        role="img"
        aria-label={current ? `Sky picture ${frame + 1} of ${count}, taken ${fmtDate(current.timestamp)}. ${label}` : label}
        className="relative aspect-square w-full overflow-hidden rounded-md border border-soft bg-[#04060D] shadow-[0_8px_24px_rgba(20,26,46,0.12)]"
      >
        {current && <img src={current.image_url} alt="" className="absolute inset-0 h-full w-full" />}

        {current && (
          <svg viewBox="0 0 700 700" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <path d="M350 310V330M350 370V390M310 350H330M370 350H390" stroke="#FF8A3D" strokeWidth="1.5" opacity="0.8" />
          </svg>
        )}

        {current && (
          <>
            <div className="absolute left-3 top-3 rounded bg-[rgba(4,6,13,0.75)] px-2 py-1 font-mono text-[13px] text-[#E8ECF5]">
              Picture {frame + 1} of {count} · {fmtDate(current.timestamp)}
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-[rgba(4,6,13,0.75)] px-3 py-1.5 text-[13px] text-[#E8ECF5]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: bandDot }} aria-hidden="true" />
              {bandLabel}
            </div>
            <div className="absolute bottom-3 right-3 rounded bg-[rgba(4,6,13,0.75)] px-2 py-1 text-xs text-[#C5CDE0]">
              NASA SPHEREx · IRSA
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-[#E8ECF5]">
            <p className="max-w-[360px] text-base leading-relaxed">{error}</p>
            <button type="button" onClick={onRetry} className="btn-primary">Try again</button>
          </div>
        )}
        {loading && !current && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-[15px] text-[#C5CDE0]">
            {progress ? (
              <>
                <p>Downloading picture {progress.cached_images} of {progress.total_images} from NASA…</p>
                <p className="max-w-[360px] text-[13px] leading-relaxed">The first look at a new spot takes a minute or two. After that it opens straight away.</p>
              </>
            ) : (
              <p>Loading pictures…</p>
            )}
          </div>
        )}
        {emptyText && !loading && !current && !error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[15px] text-[#C5CDE0]">{emptyText}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => show(frame - 1)} disabled={!count} aria-label="Previous picture" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-40">
          <PrevIcon />
        </button>
        <button type="button" onClick={() => setPlaying(!playing)} disabled={!count} aria-label={playing ? 'Pause' : 'Play'} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-accent text-[#0B1020] disabled:opacity-40">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" onClick={() => show(frame + 1)} disabled={!count} aria-label="Next picture" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-40">
          <NextIcon />
        </button>
        <input
          type="range"
          aria-label="Which picture"
          min="0"
          max={Math.max(count - 1, 0)}
          step="1"
          value={frame}
          disabled={!count}
          onChange={(e) => show(Number(e.target.value))}
          className="h-11 min-w-[120px] flex-1 accent-accent"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-11 rounded-lg border border-line bg-white px-2.5 text-sm text-ink">
            <option value="1">Slow</option>
            <option value="2">Medium</option>
            <option value="4">Fast</option>
          </select>
        </label>
      </div>

      {count > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {frames.map((f, i) => (
            <button
              key={f.epoch_id || i}
              type="button"
              onClick={() => show(i)}
              aria-label={`Show picture ${i + 1}, ${fmtDate(f.timestamp)}`}
              aria-pressed={i === frame}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1 font-mono text-sm ${i === frame ? 'border-accent bg-accent text-[#0B1020]' : 'border-line text-body'}`}
            >
              {i + 1}
              <span className="hidden text-[11px] sm:block">{fmtDate(f.timestamp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
