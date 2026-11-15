import { CloseIcon, NextIcon, PrevIcon } from './icons';

// The advanced tour uses WISE 0855, a cold brown dwarf whose motion is too small to see by eye.
// Every view of it is cached, so it opens straight away.
export const DEMO_TARGET = {
  name: 'WISE 0855',
  ra: '08h55m10.831s',
  dec: '-07°14′42.53″',
  raDeg: 133.795129,
  decDeg: -7.245147,
};

// The beginner demo shows a real change that is easy to see. Every value comes from real pictures.
//   kind 'streak': a line crosses one picture and no other. Something moved so fast during that one
//     exposure that it smeared into a line (most likely a satellite; we can't tell which).
//   kind 'asteroid' (for later): a dot in one visit, gone in the others.
// seenMjd: when SPHEREx took the picture the change is in (matched to the visit times).
// ring: where the circle goes, on the pictures' 0–256 grid (north up).
export const DEMO_STREAK = {
  kind: 'streak',
  ra: DEMO_TARGET.ra,
  dec: DEMO_TARGET.dec,
  band: '1',
  fov: 15,
  // Band 1 picture of 2 May 2026. The line was measured on the stored pixels: from about (0, 71)
  // to (137, 256); (73, 169) is its point nearest the centre.
  seenMjd: 61162.336956,
  ring: { cx: 73, cy: 169 },
  light: 'SPHEREx band 1, wavelengths of 0.75 to 1.11 millionths of a metre, just too red for our eyes',
  width: '15 arcminutes wide, about half the width of the full Moon',
};

// To show an asteroid instead, fill this in (found with JPL Horizons and IRSA) and set its name.
export const DEMO_ASTEROID = {
  kind: 'asteroid',
  name: '',
  ra: '',
  dec: '',
  band: '6',
  fov: 5,
  seenMjd: 0,
  ring: { cx: 128, cy: 128 },
  hoursToCross: 0, // how long it takes to cross the picture, from its real speed on the sky
  about: '', // e.g. 'a rock about 30 km across that orbits the Sun between Mars and Jupiter'
  light: 'SPHEREx band 6, wavelengths of 4.42 to 5.00 millionths of a metre',
  width: '5 arcminutes wide, about a sixth of the width of the full Moon',
};

export const DEMO_SUBJECT = DEMO_ASTEROID.name ? DEMO_ASTEROID : DEMO_STREAK;

// The five beginner steps. `scene` is what the picture area shows; DemoFocus draws each one.
export const DEMO_STEPS = [
  { id: '1', scene: 'look', title: 'This is a real photo of space' },
  { id: '2', scene: 'flip', title: 'Flip through the pictures' },
  { id: '3', scene: 'compare', title: 'Put two pictures side by side' },
  { id: '4', scene: 'subtract', title: 'Let the computer find the change' },
  { id: '5', scene: 'found', title: DEMO_SUBJECT.kind === 'asteroid' ? 'You found an asteroid' : 'You spotted something passing by' },
];

// The advanced tour runs in the full viewer, with all the tools showing.
export const ADVANCED_STEPS = [
  {
    id: 'a1',
    view: 'combine',
    band: '6',
    showStars: false,
    title: 'When the change is too small to see',
    body:
      'This is WISE 0855, a cold, dim “failed star” about 7 light-years away. It drifts across the sky too, but so slowly that you can’t see it move from one picture to the next. Combined lays all the pictures on top of each other, so faint things add up and stand out.',
    tryThis: 'On the right, move the drift sliders and press “Combine with this drift”. Stars smear out; anything moving at that speed piles up into one dot.',
  },
  {
    id: 'a2',
    view: 'flipbook',
    band: 'all',
    showStars: true,
    title: 'Check what is already known',
    body:
      'We switched on “Mark known stars”. Circles and squares are stars that other telescopes have already measured. A purple diamond is something that glows in a way cold brown dwarfs do.',
    tryThis: 'Click the purple diamond on the picture to read about it. Below the player, see this spot’s light split into 102 colours.',
  },
];

export const DEMO_HREF = () => demoHref('1');

// The address of one demo step, beginner ('1'–'5') or advanced ('a1', 'a2').
export function demoHref(id) {
  const advanced = id.startsWith('a');
  const target = advanced ? DEMO_TARGET : DEMO_SUBJECT;
  const step = advanced ? ADVANCED_STEPS.find((s) => s.id === id) : null;
  const band = step ? step.band : DEMO_SUBJECT.band;
  const fov = !advanced && DEMO_SUBJECT.fov && DEMO_SUBJECT.fov !== 5 ? `&fov=${DEMO_SUBJECT.fov}` : '';
  return `/viewer?demo=${id}&ra=${encodeURIComponent(target.ra)}&dec=${encodeURIComponent(target.dec)}&band=${band}${fov}`;
}

// ?demo= value -> { advanced, index, step } or null when it is not a demo step.
export function parseDemo(value) {
  const v = String(value || '');
  const list = v.startsWith('a') ? ADVANCED_STEPS : DEMO_STEPS;
  const index = list.findIndex((s) => s.id === v);
  return index < 0 ? null : { advanced: list === ADVANCED_STEPS, index, step: list[index] };
}

// The card above the full viewer during the advanced tour.
export default function DemoTour({ index, onStep, onExit }) {
  const current = ADVANCED_STEPS[index];
  const last = index === ADVANCED_STEPS.length - 1;

  return (
    <aside aria-label="Advanced tour" className="flex w-full player-w flex-col gap-3 rounded-2xl border border-line bg-surface p-5 text-ink">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">Advanced tour, part {index + 1} of {ADVANCED_STEPS.length}</p>
        <button type="button" onClick={onExit} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-body hover:text-ink">
          <CloseIcon />
          Leave the tour
        </button>
      </div>
      <h2 className="font-display text-[22px] font-medium leading-snug">{current.title}</h2>
      <p className="max-w-[62ch] text-[15px] leading-relaxed text-body">{current.body}</p>
      <p className="max-w-[62ch] border-l-2 border-accent pl-3 text-[15px] leading-relaxed text-ink">{current.tryThis}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button type="button" onClick={() => onStep(index - 1)} className="btn-plain h-10 px-4 text-sm">
          <PrevIcon />
          {index === 0 ? 'Back to the basics' : 'Back'}
        </button>
        <button type="button" onClick={last ? onExit : () => onStep(index + 1)} className="btn-primary h-10 px-4 text-sm">
          {last ? 'Finish and explore' : 'Next'}
          {!last && <NextIcon />}
        </button>
      </div>
    </aside>
  );
}
