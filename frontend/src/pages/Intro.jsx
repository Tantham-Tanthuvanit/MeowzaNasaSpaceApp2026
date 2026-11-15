// The welcome page at "/": what SkyFlip is, why we built it for the NASA Space Apps 2026
// "Planet X and SPHEREx" challenge, and where to start. The hero blinks the real SPHEREx
// pictures of WISE 0855 (cached, so they load in about a second). No stand-in pictures:
// if the backend can't be reached, it says so.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFrames } from '../services/api';
import { DEMO_HREF, DEMO_TARGET } from '../components/DemoTour';
import { fmtDate } from '../components/FlipPlayer';
import { PauseIcon, PlayIcon } from '../components/icons';
import { BANDS } from '../core/targets';
import { OFFICIAL_PROJECT_NAMES, useProjects } from '../core/projects';

const CHALLENGE_URL = 'https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/?tab=details';
const BLINK_MS = 750;

// What to watch for at each of the challenge's five test targets.
const TARGET_NOTES = {
  "Barnard's Star": 'The fastest-moving star in our sky. Watch it slide between visits.',
  'Epsilon Indi B': 'A pair of brown dwarfs circling a nearby star, moving together.',
  'WISE 0855': 'The coldest brown dwarf we know of, about 7 light-years away. Brightest in Band 6.',
  'RW Aurigae': 'A young star wrapped in dust that dims and brightens. Watch its brightness, not its place.',
  'R Draconis': 'A giant star that swells and fades over about eight months.',
};

const HISTORY = [
  {
    year: '1930',
    title: 'Pluto is found by blinking two pictures',
    text: 'At Lowell Observatory, Clyde Tombaugh flipped back and forth between two photographs of the same stars taken six days apart. One faint dot jumped. It was Pluto.',
  },
  {
    year: '2014',
    title: 'WISE 0855 turns up the same way',
    text: 'Kevin Luhman compared infrared pictures from NASA’s WISE telescope taken months apart and spotted a dot moving fast across the sky: a brown dwarf as cold as a freezer, one of our closest neighbours.',
  },
  {
    year: '2017',
    title: 'Volunteers join the hunt',
    text: 'Backyard Worlds: Planet 9 invited anyone to flip through WISE pictures. Volunteers have since found thousands of brown dwarfs that computers missed.',
  },
  {
    year: '2025',
    title: 'SPHEREx starts mapping the whole sky',
    text: 'NASA’s SPHEREx launched on 11 March and began its survey in May. It photographs the entire sky every six months, so every spot now has a growing stack of pictures to compare.',
  },
  {
    year: '2026',
    title: 'SkyFlip',
    text: 'We built a flipbook for those pictures, so anyone with a browser can do what Tombaugh did, with NASA’s newest telescope.',
  },
];

const STEPS = [
  { title: 'Pick a spot', text: 'Click anywhere on the sky map, search for a saved project, or type the coordinates of a star.' },
  { title: 'Press play', text: 'SkyFlip shows one SPHEREx picture per visit, lined up so the stars stay still. Anything that moves or changes brightness stands out.' },
  { title: 'Look closer', text: 'Subtract one visit from another to leave only what changed, or add the visits along a path to bring out something faint.' },
  { title: 'Flag it', text: 'Mark what you found. Other visitors can look at the same spot and say whether they see it too.' },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

// The real SPHEREx pictures of WISE 0855, one per survey visit, flipped like Tombaugh's plates.
function HeroFlip() {
  const { frames, error, loading, retry } = useFrames(DEMO_TARGET.raDeg, DEMO_TARGET.decDeg, 'array_6', 5.0, 'inferno');
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const count = frames.length;
  const running = playing && !reduced && count > 1;

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setFrame((f) => (f + 1) % count), BLINK_MS);
    return () => clearInterval(t);
  }, [running, count]);

  const current = frames[frame % (count || 1)];

  return (
    <figure className="w-full max-w-[460px]">
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black ring-1 ring-white/15">
        {frames.map((f, i) => (
          <img
            key={f.image_url}
            src={f.image_url}
            alt={i === frame ? `SPHEREx picture of WISE 0855 taken ${fmtDate(f.timestamp)}, picture ${i + 1} of ${count}` : ''}
            className={`absolute inset-0 h-full w-full ${i === frame ? '' : 'invisible'}`}
          />
        ))}
        {count === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-[15px] text-[#C4CCE2]">
            {error ? (
              <>
                <p>The SPHEREx pictures couldn’t load. Start the backend, then try again.</p>
                <button type="button" onClick={retry} className="btn border border-white/40 text-white hover:border-white">Try again</button>
              </>
            ) : (
              <p>{loading ? 'Loading the SPHEREx pictures of WISE 0855…' : 'No pictures yet.'}</p>
            )}
          </div>
        )}
      </div>
      <figcaption className="mt-4 flex items-start justify-between gap-4 text-[#C4CCE2]">
        <div>
          <p className="font-display text-[22px] font-bold leading-tight text-white" aria-live="off">
            {current ? fmtDate(current.timestamp) : 'WISE 0855'}
          </p>
          <p className="mt-1 text-[14px] leading-snug">
            The sky around WISE 0855, seen by SPHEREx at 4.4–5.0 µm.
            {count > 1 && ` Visit ${frame + 1} of ${count}.`}
          </p>
        </div>
        {count > 1 && !reduced && (
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? 'Pause the pictures' : 'Play the pictures'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
      </figcaption>
      {count > 1 && reduced && (
        <div className="mt-3 flex gap-2" role="group" aria-label="Choose a visit">
          {frames.map((f, i) => (
            <button
              key={f.image_url}
              type="button"
              onClick={() => setFrame(i)}
              aria-pressed={i === frame}
              className={`h-10 flex-1 rounded-full border text-[13px] ${i === frame ? 'border-white bg-white text-[#0B1230]' : 'border-white/40 text-white'}`}
            >
              {fmtDate(f.timestamp).split(' ').slice(1).join(' ')}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

// 102 SPHEREx channels: six detector bands of 17 each, short wavelengths on the left.
function BandStrip() {
  return (
    <div>
      <div className="flex h-16 gap-[3px] sm:h-20" aria-hidden="true">
        {BANDS.map((b) => (
          <div key={b.n} className="flex flex-1 gap-px">
            {Array.from({ length: 17 }, (_, i) => (
              <span key={i} className="flex-1 rounded-[1px]" style={{ backgroundColor: b.color, opacity: 0.55 + (i / 16) * 0.45 }} />
            ))}
          </div>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-y-3 text-[13px] text-[#C4CCE2] sm:flex sm:gap-[3px]">
        {BANDS.map((b) => (
          <li key={b.n} className="sm:flex-1">
            <span className="block font-semibold text-white">Band {b.n}</span>
            {b.range} µm
          </li>
        ))}
      </ul>
      <p className="sr-only">102 colours of infrared light, from 0.75 to 5.00 micrometres, in six bands of 17.</p>
    </div>
  );
}

function Targets() {
  const { projects, loaded, error } = useProjects();
  const byName = new Map(projects.map((p) => [p.name.trim().toLowerCase(), p]));
  const targets = OFFICIAL_PROJECT_NAMES.map((name) => ({ name, project: byName.get(name.toLowerCase()) }));

  if (error) return <p className="text-body">The list of targets couldn’t load ({error}). They are also on the sky map.</p>;
  if (!loaded) return <p className="text-body">Loading the five targets…</p>;

  return (
    <ul className="divide-y divide-soft border-y border-soft">
      {targets.map(({ name, project }) => (
        <li key={name} className="grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[220px_1fr_auto] sm:items-center">
          <span className="font-display text-[20px] font-bold text-ink">{name}</span>
          <span className="text-[16px] leading-relaxed text-body">{TARGET_NOTES[name]}</span>
          {project ? (
            <Link to={`/viewer?project=${project.id}`} className="btn-plain justify-self-start">
              Watch {name}
            </Link>
          ) : (
            <span className="text-[14px] text-muted">Not on the map yet</span>
          )}
        </li>
      ))}
    </ul>
  );
}

const Section = ({ id, title, children, className = '' }) => (
  <section aria-labelledby={id} className={`mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-8 sm:py-28 ${className}`}>
    <h2 id={id} className="max-w-[18ch] font-display text-[clamp(30px,4.2vw,48px)] font-bold leading-[1.08] tracking-[-0.015em] text-ink">
      {title}
    </h2>
    {children}
  </section>
);

export default function Intro() {
  return (
    <main className="flex-1">
      {/* Hero: on the night sky in every theme */}
      <div className="bg-sky text-white">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <h1 className="font-display text-[clamp(44px,7vw,92px)] font-bold leading-[0.98] tracking-[-0.025em]">
              Flip through the sky. Catch what moves.
            </h1>
            <p className="mt-7 max-w-[34em] text-[18px] leading-[1.6] text-[#C4CCE2]">
              SkyFlip shows NASA’s newest infrared pictures of any spot in the sky as a little flipbook. Stars stay
              put. Asteroids, comets, brown dwarfs and maybe an unknown planet don’t. You can be the one who notices.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/map" className="btn-primary h-12 px-6 text-[16px]">Open the sky map</Link>
              <Link to={DEMO_HREF()} className="btn h-12 border border-white/40 px-6 text-[16px] text-white hover:border-white">
                Take the 2-minute demo
              </Link>
            </div>
          </div>
          <HeroFlip />
        </div>
      </div>

      <Section id="intro-history" title="New worlds give themselves away by moving">
        <p className="mt-6 max-w-[62ch] text-[18px] leading-[1.65] text-body">
          Stars are so far away that they barely move from one year to the next. Things close to us do. Take two
          pictures of the same patch of sky at different times, flip between them, and anything nearby jumps. It is
          the oldest trick in the hunt for new objects, and it still works.
        </p>
        <ol className="mt-14 max-w-[880px]">
          {HISTORY.map((h) => (
            <li key={h.year} className="grid gap-x-10 gap-y-1 border-t border-soft py-7 sm:grid-cols-[120px_1fr]">
              <span className="font-display text-[28px] font-bold leading-none text-rust">{h.year}</span>
              <div>
                <h3 className="text-[19px] font-semibold text-ink">{h.title}</h3>
                <p className="mt-2 max-w-[62ch] text-[16px] leading-[1.65] text-body">{h.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <div className="bg-night text-white">
        <section aria-labelledby="intro-spherex" className="mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-8 sm:py-28">
          <h2 id="intro-spherex" className="max-w-[18ch] font-display text-[clamp(30px,4.2vw,48px)] font-bold leading-[1.08] tracking-[-0.015em]">
            SPHEREx sees 102 colours of light our eyes can’t
          </h2>
          <div className="mt-6 grid max-w-[1000px] gap-6 text-[17px] leading-[1.65] text-[#C4CCE2] md:grid-cols-2 md:gap-12">
            <p>
              SPHEREx is a NASA space telescope that splits infrared light into 102 narrow colours, from 0.75 to 5
              micrometres. Water ice, carbon dioxide and methane each leave their own mark in that light, so the same
              pictures that show something moving can also hint at what it is made of.
            </p>
            <p>
              It covers the whole sky every six months and has already pictured more than a billion objects. That is
              far too much for any one person, or any one computer program, to look through. The more people looking,
              the more gets found.
            </p>
          </div>
          <div className="mt-14">
            <BandStrip />
          </div>
        </section>
      </div>

      <Section id="intro-why" title="Why we built SkyFlip">
        <div className="mt-6 max-w-[62ch] space-y-5 text-[18px] leading-[1.65] text-body">
          <p>
            NASA asked teams in the{' '}
            <a href={CHALLENGE_URL} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-4 hover:text-rust">
              Space Apps Challenge 2026
            </a>{' '}
            to build a public tool that shows SPHEREx pictures of any patch of sky over time, so that anyone can spot
            what changes.
          </p>
          <p>
            We are team Meowza. Most of us are not astronomers, and that is the point. We wanted a tool where you
            don’t need to know what a FITS file is: pick a spot, press play, and look. Behind the scenes SkyFlip
            fetches the real pictures from NASA’s archive, removes the glow of dust in our own solar system, and lines
            every visit up on the same grid so the stars hold still.
          </p>
          <p>Everything you see is real SPHEREx data. Nothing is simulated.</p>
        </div>
      </Section>

      <Section id="intro-steps" title="How to hunt" className="pt-0 sm:pt-0">
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-5">
              <span className="font-display text-[15px] font-bold text-muted">Step {i + 1}</span>
              <h3 className="mt-1 text-[19px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-[1.6] text-body">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="intro-targets" title="Start with these five" className="pt-0 sm:pt-0">
        <p className="mt-6 max-w-[62ch] text-[18px] leading-[1.65] text-body">
          NASA picked these to test every tool in the challenge. Three of them move; two change brightness.
        </p>
        <div className="mt-10">
          <Targets />
        </div>
      </Section>

      <footer className="border-t border-soft bg-surface">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-16 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="max-w-[20ch] font-display text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.1] text-ink">
              The sky has changed since you last looked.
            </p>
            <Link to="/map" className="btn-primary mt-7 h-12 px-6 text-[16px]">Open the sky map</Link>
          </div>
          <p className="max-w-[52ch] text-[13px] leading-relaxed text-muted">
            Made by team Meowza for the NASA Space Apps Challenge 2026. SPHEREx data from the NASA/IPAC Infrared
            Science Archive (IRSA); SPHEREx is a joint project of JPL and Caltech, funded by NASA. Star catalogues from
            ESA’s Gaia (DR3) and NASA’s WISE (AllWISE).
          </p>
        </div>
      </footer>
    </main>
  );
}
