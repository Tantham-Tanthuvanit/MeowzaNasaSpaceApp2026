import { CloseIcon, CompassIcon, NextIcon, PrevIcon } from './icons';

export const DEMO_TARGET = {
  name: 'WISE 0855 (Cold Brown Dwarf · 7.2 light-years away)',
  ra: '08h55m10.831s',
  dec: '-07°14′42.53″',
  raDeg: 133.795129,
  decDeg: -7.245147,
};

export const DEMO_STEPS = [
  {
    step: 1,
    label: 'Flipbook',
    title: '1. Blink the infrared flipbook (Band 6 · 4.42 µm)',
    view: 'flipbook',
    band: '6',
    showStars: false,
    summary:
      'You are looking at real NASA SPHEREx images of WISE 0855 — a sub-zero brown dwarf only 7.2 light-years from Earth. We opened Band 6 (4.42 µm, long-wave infrared), where freezing objects glow brightly while ordinary background stars stay steady.',
    prompt: 'Watch the centre crosshair as the flipbook loops through NASA’s survey visits from oldest to newest.',
  },
  {
    step: 2,
    label: 'Split view',
    title: '2. Compare earliest and latest visits side by side',
    view: 'split',
    band: '6',
    showStars: false,
    summary:
      'Side-by-side Split View lets you inspect two individual SPHEREx visits at the same time without animation flicker. Ordinary stars stay locked at the exact same pixel coordinates in both panes.',
    prompt: 'Compare Left visit (V1) and Right visit (V4) near the centre reticle — or click V2 / V3 on either pane.',
  },
  {
    step: 3,
    label: 'What changed',
    title: '3. Subtract visits to reveal the motion signature',
    view: 'changes',
    band: '6',
    showStars: false,
    summary:
      'Subtracting an earlier visit from a later visit cancels out unchanging stars into pale grey. Anything that moved leaves a telltale blue-and-red dipole pair: blue where it was, and red where it went.',
    prompt: 'Use the "Choose visits to subtract" controls on the right to compare V1 → V4 or individual steps like V1 → V2.',
  },
  {
    step: 4,
    label: 'Shift & Add',
    title: '4. Stack faint moving worlds (Combined / Shift-and-Add)',
    view: 'combine',
    band: '6',
    showStars: false,
    summary:
      'A distant solar system body like Planet X may be too faint to stand out in a single visit. By sliding each visit back along a trial drift before combining them, stars smear out while an object moving at that speed stacks into one bright dot.',
    prompt: 'Adjust the Sideways and Up-and-down drift sliders on the right and press "Combine with this drift".',
  },
  {
    step: 5,
    label: 'Spectrum & Catalogues',
    title: '5. Verify with star catalogues & SPHEREx’s 102-channel spectrum',
    view: 'flipbook',
    band: 'all',
    showStars: true,
    summary:
      'We turned on "Mark known stars" (Gaia optical circles, WISE infrared squares, and purple diamonds for brown dwarf candidates). Unlike older surveys with only a few broad filters, SPHEREx measures 102 infrared channels from 0.75 to 5.0 µm.',
    prompt: 'Click the purple diamond on the picture to inspect its WISE colour, then scroll down below the player to explore the 102-channel spectrum.',
  },
];

export default function DemoTour({ stepIndex, onStep, onExit }) {
  const current = DEMO_STEPS[stepIndex] || DEMO_STEPS[0];
  const total = DEMO_STEPS.length;

  return (
    <aside
      aria-label="Guided discovery tour"
      className="flex w-full player-w flex-col gap-3 rounded-2xl border-2 border-[#FF8A3D] bg-[#FFF9F4] p-4 text-ink shadow-[0_8px_24px_rgba(20,26,46,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#FF8A3D] px-2.5 text-xs font-bold uppercase tracking-wider text-[#0B1020]">
            <CompassIcon />
            Guided Demo · Step {current.step} of {total}
          </span>
          <span className="hidden text-xs font-semibold text-rust sm:inline">
            Target: {DEMO_TARGET.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {DEMO_STEPS.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              onClick={() => onStep(idx)}
              aria-current={idx === stepIndex ? 'step' : undefined}
              title={s.title}
              className={`h-7 rounded-full px-2.5 text-xs font-medium transition-colors ${
                idx === stepIndex
                  ? 'bg-ink text-white font-semibold'
                  : 'border border-line bg-white text-body hover:border-ink'
              }`}
            >
              {s.step}. {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit guided demo"
            title="Exit guided demo"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-body hover:border-ink hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold leading-snug text-ink">{current.title}</h2>
        <p className="text-[14px] leading-relaxed text-body">{current.summary}</p>
        <p className="rounded-xl border border-[#F3DEC9] bg-white px-3 py-2 text-[13px] font-medium text-ink">
          <span className="font-semibold text-rust">Try this: </span>
          {current.prompt}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onStep(Math.max(0, stepIndex - 1))}
          disabled={stepIndex === 0}
          className="btn-plain h-9 px-3.5 text-xs disabled:opacity-40"
        >
          <PrevIcon />
          Previous step
        </button>

        <div className="flex items-center gap-2">
          {stepIndex < total - 1 ? (
            <button
              type="button"
              onClick={() => onStep(stepIndex + 1)}
              className="btn-primary h-9 px-4 text-xs"
            >
              Next: {DEMO_STEPS[stepIndex + 1].label}
              <NextIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={onExit}
              className="btn-primary h-9 px-4 text-xs"
            >
              Finish tour & explore freely
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
