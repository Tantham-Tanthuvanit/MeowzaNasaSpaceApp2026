import { fmtDate } from './FlipPlayer';

// Side-by-side dual epoch viewer for direct inspection of two survey visits.
export default function SplitPlayer({
  frames = [],
  loading,
  error,
  onRetry,
  leftIdx = 0,
  rightIdx = 1,
  onLeftChange,
  onRightChange,
  onSwap,
  onCompareDifference,
  overlay,
  onPick,
  bandDot,
  bandLabel,
  label,
}) {
  const count = frames.length;
  const left = frames[leftIdx] || frames[0];
  const right = frames[rightIdx] || frames[Math.min(count - 1, leftIdx + 1)];

  const makePick = (e) => {
    if (!onPick) return;
    const box = e.currentTarget.getBoundingClientRect();
    onPick(((e.clientX - box.left) / box.width) * 256, ((e.clientY - box.top) / box.height) * 256);
  };

  const renderPane = (f, idx, title, onChange, otherIdx) => (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-body">{title}</span>
        <div className="flex items-center gap-1">
          {frames.map((frameItem, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              title={`Switch to Visit ${i + 1} (${fmtDate(frameItem.timestamp)})`}
              className={`h-7 px-2.5 rounded-full text-xs font-mono transition-colors ${
                i === idx
                  ? 'bg-ink text-white font-bold'
                  : i === otherIdx
                  ? 'border border-soft text-muted bg-[#F5F7FB] hover:border-ink'
                  : 'border border-line bg-white text-body hover:border-ink'
              }`}
            >
              V{i + 1}
            </button>
          ))}
        </div>
      </div>

      <div
        role="img"
        aria-label={`${title}, Picture ${idx + 1} of ${count}, taken ${f ? fmtDate(f.timestamp) : ''}`}
        onClick={f && onPick ? makePick : undefined}
        className={`${f && onPick ? 'cursor-crosshair ' : ''}relative aspect-square w-full overflow-hidden rounded-md border border-soft bg-[#04060D] shadow-[0_8px_24px_rgba(20,26,46,0.12)]`}
      >
        {f && <img src={f.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}

        {/* Center reticle */}
        {f && (
          <svg viewBox="0 0 700 700" aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none">
            <path d="M350 310V330M350 370V390M310 350H330M370 350H390" stroke="#FF8A3D" strokeWidth="1.5" opacity="0.8" />
          </svg>
        )}

        {/* Overlays (stars and candidate flags) */}
        {f && overlay && (
          <svg viewBox="0 0 256 256" className={`absolute inset-0 h-full w-full ${onPick ? 'pointer-events-none' : ''}`}>
            {overlay}
          </svg>
        )}

        {f && (
          <>
            <div className="absolute left-2.5 top-2.5 rounded bg-[rgba(4,6,13,0.75)] px-2 py-1 font-mono text-xs text-[#E8ECF5]">
              Visit {idx + 1} · {fmtDate(f.timestamp)}
            </div>
            <div className="absolute bottom-2.5 right-2.5 rounded bg-[rgba(4,6,13,0.75)] px-1.5 py-0.5 text-[10px] text-[#C5CDE0]">
              SPHEREx
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-[#E8ECF5]">
            <p className="text-sm leading-relaxed">{error}</p>
            <button type="button" onClick={onRetry} className="btn-primary h-8 px-3 text-xs">Try again</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex w-full player-w flex-col gap-3.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPane(left, leftIdx, 'Left visit', onLeftChange, rightIdx)}
        {renderPane(right, rightIdx, 'Right visit', onRightChange, leftIdx)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft pt-2.5 text-xs text-muted">
        <div className="flex items-center gap-2">
          {onSwap && (
            <button
              type="button"
              onClick={onSwap}
              className="btn-plain h-8 px-3 text-xs"
              title="Swap left and right visits"
            >
              ⇄ Swap panes
            </button>
          )}
          {onCompareDifference && (
            <button
              type="button"
              onClick={onCompareDifference}
              className="btn-plain h-8 px-3 text-xs font-medium text-rust"
              title="Compare these two visits in What changed"
            >
              Subtract in What changed →
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: bandDot }} aria-hidden="true" />
          <span>{bandLabel}</span>
          <span className="hidden sm:inline">· {label}</span>
        </div>
      </div>
    </div>
  );
}
