import { useEffect, useRef, useState } from 'react';
import { fmtDate, useFlipbook } from './FlipPlayer';
import { CloseIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';
import { DEMO_STEPS, DEMO_SUBJECT } from './DemoTour';
import { fetchDifferenceImage, useRemote } from '../services/api';

const RING_R = 14; // circle radius on the pictures' 0–256 grid
const SEEN_WITHIN_DAYS = 0.5;

const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The picture the change is in (the visit taken at subject.seenMjd) and one it is not in:
// the visit just before, or just after when it is in the first one. Null when no visit matches.
export function pickPictures(frames, subject = DEMO_SUBJECT) {
  const hit = frames.findIndex((f) => typeof f.mjd === 'number' && Math.abs(f.mjd - subject.seenMjd) < SEEN_WITHIN_DAYS);
  if (hit < 0) return null;
  const empty = hit > 0 ? hit - 1 : frames.length > 1 ? hit + 1 : -1;
  return empty < 0 ? null : { hit, empty };
}

// One square sky picture with the circle drawn on top. Zooming scales it around the circle.
function Picture({ src, label, zoom, ring = DEMO_SUBJECT.ring }) {
  const origin = `${(ring.cx / 256) * 100}% ${(ring.cy / 256) * 100}%`;
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#04060D]">
        <div
          className="absolute inset-0 transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: origin }}
        >
          {src && <img src={src} alt="" className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />}
          <svg viewBox="0 0 256 256" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <circle cx={ring.cx} cy={ring.cy} r={RING_R} fill="none" stroke="#04060D" strokeWidth="5" vectorEffect="non-scaling-stroke" opacity="0.6" />
            <circle cx={ring.cx} cy={ring.cy} r={RING_R} fill="none" stroke="#7FE3FF" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      {label && <figcaption className="text-[15px] text-body">{label}</figcaption>}
    </figure>
  );
}

function Dark({ children, role = 'status' }) {
  return (
    <div role={role} className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-lg bg-[#04060D] p-6 text-center text-[15px] leading-relaxed text-[#C5CDE0]">
      {children}
    </div>
  );
}

// The flipbook for step 2: slow, big, with only play/pause and the picture numbers.
function Flip({ frames, zoom }) {
  const { frame, playing, setPlaying, setSpeed, show } = useFlipbook(frames.length, 'demo', !reducedMotion());
  useEffect(() => setSpeed(1), [setSpeed]); // one picture a second
  const f = frames[frame];
  return (
    <div className="flex flex-col gap-3">
      <Picture src={f.image_url} zoom={zoom} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--color-accent-text,#0B1020)]"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="flex min-w-0 flex-1 gap-1.5" role="group" aria-label="Pictures, oldest first">
          {frames.map((p, i) => (
            <button
              key={p.image_url}
              type="button"
              onClick={() => show(i)}
              aria-pressed={i === frame}
              aria-label={`Picture ${i + 1}, ${fmtDate(p.timestamp)}`}
              className={`flex h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-lg border text-sm ${i === frame ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-body hover:border-ink'}`}
            >
              <span className="font-semibold">{i + 1}</span>
              <span className="hidden text-[11px] sm:block">{fmtDate(p.timestamp)}</span>
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="text-[15px] text-body">
        Picture {frame + 1} of {frames.length}, taken {fmtDate(f.timestamp)}
      </p>
    </div>
  );
}

function Swatch({ color, children }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-4 w-4 shrink-0 rounded-sm border border-line" style={{ background: color }} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

// The beginner demo in focus mode: only the picture and one step card, nothing else on screen.
// ra, dec (degrees), bandId, fov, colormap: the spot the viewer has open, for the difference picture.
export default function DemoFocus({ frames, loading, progress, error, onRetry, ra, dec, bandId, fov, colormap, stepIndex, onStep, onExit, onRandom, onAdvanced }) {
  const subject = DEMO_SUBJECT;
  const streak = subject.kind === 'streak';
  const thing = streak ? 'a line' : 'a dot';
  const step = DEMO_STEPS[stepIndex];
  const total = DEMO_STEPS.length;
  const [zoom, setZoom] = useState(streak ? 1 : 2);
  const [answer, setAnswer] = useState(null); // which picture the visitor says the change is in (step 2)
  const heading = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    setAnswer(null);
    if (first.current) first.current = false;
    else if (heading.current) heading.current.focus();
  }, [stepIndex]);

  const pics = !loading && !error ? pickPictures(frames) : null;
  const [early, late] = pics ? [Math.min(pics.hit, pics.empty), Math.max(pics.hit, pics.empty)] : [0, 0];
  const later = pics && pics.hit > pics.empty; // is the change in the later of the two pictures?
  // Scaled to the noise, so a faint change shows (the default scale is set by bright star leftovers).
  const diff = useRemote(
    pics && step.scene === 'subtract' ? `demo-diff|${ra}|${dec}|${bandId}|${fov}|${early}|${late}|${colormap}` : null,
    () => fetchDifferenceImage(ra, dec, bandId, early, late, fov, colormap, 'noise')
  );
  const n = frames.length;
  const hit = pics && frames[pics.hit], empty = pics && frames[pics.empty];

  let stage;
  if (error) {
    stage = (
      <Dark role="alert">
        <p className="max-w-[36ch] text-base text-[#E8ECF5]">{error}</p>
        <button type="button" onClick={onRetry} className="btn-primary">Try again</button>
      </Dark>
    );
  } else if (loading || !n) {
    stage = (
      <Dark>
        <p className="font-display text-xl text-[#E8ECF5]">Getting the pictures from NASA</p>
        <p>{progress ? `${progress.cached_images} of ${progress.total_images} pictures are here.` : 'This takes a few seconds.'}</p>
      </Dark>
    );
  } else if (!pics) {
    stage = <Dark><p className="max-w-[36ch]">NASA’s archive sent different pictures of this spot than expected, so this demo can’t be shown. Leave the demo to look around freely.</p></Dark>;
  } else if (step.scene === 'look') {
    stage = <Picture src={empty.image_url} zoom={zoom} label={`Picture ${pics.empty + 1} of ${n}, taken ${fmtDate(empty.timestamp)}`} />;
  } else if (step.scene === 'flip') {
    stage = <Flip frames={frames} zoom={zoom} />;
  } else if (step.scene === 'compare') {
    const name = (i) => (i === pics.hit ? `With ${thing}` : 'Without it');
    stage = (
      <div className="grid grid-cols-2 gap-3">
        <Picture src={frames[early].image_url} zoom={zoom} label={`${name(early)} · ${fmtDate(frames[early].timestamp)}`} />
        <Picture src={frames[late].image_url} zoom={zoom} label={`${name(late)} · ${fmtDate(frames[late].timestamp)}`} />
      </div>
    );
  } else if (step.scene === 'subtract') {
    stage = diff.error ? (
      <Dark role="alert">
        <p className="max-w-[36ch] text-[#E8ECF5]">{diff.error}</p>
        <button type="button" onClick={diff.retry} className="btn-primary">Try again</button>
      </Dark>
    ) : diff.data && diff.data.difference_image_url ? (
      <Picture src={diff.data.difference_image_url} zoom={zoom} label={`${fmtDate(frames[late].timestamp)} take away ${fmtDate(frames[early].timestamp)}`} />
    ) : (
      <Dark><p>Making the difference picture…</p></Dark>
    );
  } else {
    stage = <Picture src={hit.image_url} zoom={zoom} label={`Picture ${pics.hit + 1} of ${n}, taken ${fmtDate(hit.timestamp)}`} />;
  }

  const body = {
    look: (
      <>
        <p>NASA’s SPHEREx space telescope took this picture. Every glowing dot is a star or a galaxy, far outside our solar system.</p>
        <p>Keep an eye on the blue circle. Something is about to happen there.</p>
      </>
    ),
    flip: (
      <>
        <p>SPHEREx photographed this same patch of sky {n} times, months apart. Here they are in order, like a flip-book. Watch the circle.</p>
        <fieldset className="flex flex-col gap-2.5 rounded-xl bg-page p-4">
          <legend className="float-left mb-1 font-semibold text-ink">In which picture does {thing} go through the circle?</legend>
          <div className="clear-both flex gap-2">
            {frames.map((p, i) => (
              <button
                key={p.image_url}
                type="button"
                onClick={() => setAnswer(i)}
                aria-pressed={answer === i}
                className={`h-11 flex-1 rounded-full border text-[15px] font-semibold ${answer === i ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink hover:border-ink'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {answer !== null && pics && (
            <p aria-live="polite" className={answer === pics.hit ? 'font-medium text-ink' : 'text-body'}>
              {answer === pics.hit
                ? `Yes, picture ${pics.hit + 1}. It isn’t in any other picture.`
                : 'Not that one. Press a picture number under the photo and look at the circle.'}
            </p>
          )}
        </fieldset>
      </>
    ),
    compare: (
      <>
        <p>Same patch of sky, same circle. Look at the bright stars: they sit in the same places in both pictures.</p>
        <p>Only {thing} is new. That is the kind of change we are looking for.</p>
      </>
    ),
    subtract: (
      <>
        <p>Comparing by eye gets hard when there are thousands of stars. So the computer takes one picture away from the other. Anything that stayed the same cancels out.</p>
        <ul className="flex flex-col gap-2">
          <Swatch color="#DCDDDD">Grey: no change.</Swatch>
          {later
            ? <Swatch color="#B40426">Red: here now, but not before. That’s {streak ? 'the line' : 'the asteroid'}.</Swatch>
            : <Swatch color="#3B4CC0">Blue: here before, but gone now. That’s {streak ? 'the line' : 'the asteroid'}.</Swatch>}
        </ul>
        <p>The small red and blue dots are leftovers from stars. The two pictures are never exactly alike, so stars don’t cancel out perfectly. They are not real changes.</p>
      </>
    ),
    found: streak ? (
      <>
        <p>The line is something that moved so fast it smeared into a streak while SPHEREx was taking that one picture. It was most likely a satellite passing; we can’t tell which one.</p>
        <p>A far-away world moves much more slowly. It would be a dot in a slightly different place each visit, not a line. Astronomers hunt for an unseen “Planet X” the same way: flip the pictures, compare them, and look for what changed.</p>
      </>
    ) : (
      <>
        <p>That dot is <strong className="font-semibold text-ink">{subject.name}</strong>, {subject.about}.</p>
        <p>It is in only one picture because it doesn’t stay still. It crosses this whole picture in about {subject.hoursToCross} hours, while the stars stay where they are. By the next visit it was long gone.</p>
        <p>Astronomers hunt for an unseen “Planet X” the same way: flip the pictures, compare them, and look for what changed.</p>
      </>
    ),
  }[step.scene];

  return (
    <main className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-10 lg:overflow-y-auto">
      <section aria-label="Sky picture" className="flex w-full flex-col gap-3 lg:sticky lg:top-0">
        <div className="mx-auto flex w-full max-w-[min(680px,calc(100dvh-220px))] flex-col gap-3 max-lg:max-w-[560px]">
          {stage}
          {pics && (
            <button type="button" onClick={() => setZoom(zoom === 1 ? 2 : 1)} className="btn-plain h-10 self-start px-4 text-sm">
              {zoom === 1 ? 'Zoom in on the circle' : 'Show the whole picture'}
            </button>
          )}
        </div>
      </section>

      <section aria-label="Guided demo" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted">Step {stepIndex + 1} of {total}</span>
            <span className="flex gap-1" aria-hidden="true">
              {DEMO_STEPS.map((s, i) => (
                <span key={s.id} className={`h-1.5 w-5 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-soft'}`} />
              ))}
            </span>
          </div>
          <button type="button" onClick={onExit} className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm text-body hover:text-ink">
            <CloseIcon />
            Leave demo
          </button>
        </div>

        <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-medium leading-tight outline-none sm:text-[32px]">
          {step.title}
        </h1>

        <div className="flex flex-col gap-3.5 text-[17px] leading-relaxed text-body">{body}</div>

        {step.scene === 'found' && (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={onRandom} className="btn-primary">Try a random patch of sky</button>
            <button type="button" onClick={onExit} className="btn-plain">Use all the tools here</button>
            <button type="button" onClick={onAdvanced} className="btn-plain">Advanced tour: tools for tiny changes</button>
          </div>
        )}

        <details className="text-[15px] text-body">
          <summary className="cursor-pointer font-medium text-ink">What am I looking at?</summary>
          <div className="mt-2 flex flex-col gap-1.5 leading-relaxed">
            <p>Infrared light: {subject.light}. Brighter colours mean more light.</p>
            <p>The picture is {subject.width}.</p>
            <p>Position: RA {subject.ra}, Dec {subject.dec}.</p>
          </div>
        </details>

        <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-2 rounded-b-2xl border-t border-soft bg-surface px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6 lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:p-0">
          <button type="button" onClick={() => onStep(stepIndex - 1)} disabled={stepIndex === 0} className="btn-plain disabled:invisible">
            <PrevIcon />
            Back
          </button>
          {stepIndex < total - 1 && (
            <button type="button" onClick={() => onStep(stepIndex + 1)} className="btn-primary">
              Next
              <NextIcon />
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
