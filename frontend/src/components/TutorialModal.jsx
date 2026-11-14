import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookIcon, CloseIcon, CompassIcon, NextIcon, PrevIcon } from './icons';
import { DEMO_TARGET } from './DemoTour';

const TABS = [
  { id: 'welcome', label: '1. What is SkyFlip?' },
  { id: 'steps', label: '2. How to Hunt (4 Steps)' },
  { id: 'guide', label: '3. Field Guide & Shortcuts' },
];

export default function TutorialModal({ onClose }) {
  const [tab, setTab] = useState('welcome');
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const demoHref = `/viewer?demo=1&ra=${encodeURIComponent(DEMO_TARGET.ra)}&dec=${encodeURIComponent(DEMO_TARGET.dec)}&band=6`;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgba(11,16,32,0.58)] p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="m-auto flex max-h-[90vh] w-full max-w-[780px] flex-col overflow-hidden rounded-3xl border border-soft bg-white text-ink shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-soft bg-[#FFF9F4] px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-rust">
              <BookIcon />
              Citizen Science Quick-Start Guide
            </span>
            <h2 id="tutorial-title" className="font-display text-[24px] font-medium leading-tight sm:text-[28px]">
              Welcome to SkyFlip — Help Spot Hidden Worlds
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close tutorial" className="btn-round shrink-0">
            <CloseIcon />
          </button>
        </div>

        {/* Navigation tabs */}
        <div role="tablist" aria-label="Tutorial sections" className="flex flex-wrap gap-2 border-b border-soft bg-page px-6 py-3 sm:px-8">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink font-semibold text-white'
                    : 'border border-line bg-white text-body hover:border-ink hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {tab === 'welcome' && (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-soft bg-page p-5">
                <h3 className="text-[18px] font-semibold text-ink">What is NASA’s SPHEREx telescope?</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-body">
                  <strong>SPHEREx</strong> is a NASA space telescope mapping the entire sky in <strong>102 infrared colours</strong> every 6 months. Because it visits the same patch of sky multiple times, SkyFlip turns those real NASA pictures into a time-lapse flipbook.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 rounded-2xl border border-soft bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rust">Why infrared matters</p>
                  <h4 className="text-[17px] font-semibold text-ink">Hidden, freezing worlds</h4>
                  <p className="text-[14px] leading-relaxed text-body">
                    Cold <strong>brown dwarfs</strong> and distant outer solar system objects like <strong>Planet X</strong>, asteroids, and comets are far too cold and dim to show up in ordinary visible-light cameras—but they glow in longer infrared bands (3–5 µm).
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-soft bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rust">Why your eyes matter</p>
                  <h4 className="text-[17px] font-semibold text-ink">Computers miss faint movers</h4>
                  <p className="text-[14px] leading-relaxed text-body">
                    Automated pipelines easily get confused by crowded star fields and sensor artifacts. Human pattern recognition excels at spotting tiny dots that hop from place to place or stars that flare and fade between visits.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#F3DEC9] bg-[#FFF5EB] p-4 text-[14px] leading-relaxed text-ink">
                <strong className="font-semibold text-rust">Good to know:</strong> Famous projects already cached (like <strong>WISE 0855</strong>) open straight away. Brand-new coordinates download live from NASA/IPAC IRSA and take ~20–40 seconds the first time anyone explores that spot.
              </div>
            </div>
          )}

          {tab === 'steps' && (
            <div className="flex flex-col gap-4">
              {[
                {
                  n: '1',
                  title: 'Choose a spot on the Sky Map',
                  desc: 'Click a saved project marker on the globe (try WISE 0855 to see a real cold brown dwarf right away), press Random patch to jump to uncharted sky, or click any empty spot and press Watch this spot.',
                },
                {
                  n: '2',
                  title: 'Blink and compare NASA’s survey visits',
                  desc: 'In the Sky Viewer, watch the Flipbook loop across dates (press Space to play/pause, or ← / → arrow keys to step visit by visit). Switch to Split view to put two dates side by side, What changed to subtract visits into a difference map, or Combined to stack faint moving objects along a guessed drift.',
                },
                {
                  n: '3',
                  title: 'Check infrared colours & star catalogues',
                  desc: 'Test different Bands (1–6) on the right—cold objects grow brighter in Bands 5 & 6 (3.8–5.0 µm). Toggle Mark known stars to check Gaia (visible light) and WISE (infrared) matches, and scroll below the player to inspect the 102-channel SPHEREx spectrum.',
                },
                {
                  n: '4',
                  title: 'Flag what you spot',
                  desc: 'Notice a jumping dot or a flaring star? Click Flag something here in the left panel, click the object on the image, choose what it looks like (Moving object, Star changing brightness, or Not sure yet), and save it so other citizen scientists can confirm it with “I see it too”.',
                },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-4 rounded-2xl border border-soft bg-page p-4 sm:p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[17px] font-semibold text-ink">{step.title}</h3>
                    <p className="text-[14px] leading-relaxed text-body">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'guide' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-[18px] font-semibold text-ink">How to spot real discoveries in “What changed”</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-2 rounded-2xl border border-soft bg-page p-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#3B4CC0]" aria-hidden="true" />
                      <span className="text-xs font-bold text-muted">→</span>
                      <span className="h-3.5 w-3.5 rounded-full bg-[#B40426]" aria-hidden="true" />
                      <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-rust">Mover</span>
                    </div>
                    <h4 className="text-[15px] font-semibold text-ink">Blue + Red Pair</h4>
                    <p className="text-[13px] leading-relaxed text-body">
                      A nearby brown dwarf, asteroid, or Planet X candidate hops between visits—leaving a <strong>blue dot</strong> where it was and a <strong>red dot</strong> where it went.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 rounded-2xl border border-soft bg-page p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#B40426]" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-rust">or</span>
                      <span className="h-3.5 w-3.5 rounded-full bg-[#3B4CC0]" aria-hidden="true" />
                    </div>
                    <h4 className="text-[15px] font-semibold text-ink">Solid Red or Blue</h4>
                    <p className="text-[13px] leading-relaxed text-body">
                      A variable star or transient flare stays in the exact same spot, glowing <strong>red</strong> if it got brighter or <strong>blue</strong> if it dimmed.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 rounded-2xl border border-soft bg-page p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border border-line bg-[#E5E7EB]" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Static</span>
                    </div>
                    <h4 className="text-[15px] font-semibold text-ink">Pale Grey</h4>
                    <p className="text-[13px] leading-relaxed text-body">
                      Ordinary background stars remain steady across visits, so subtraction cancels them out into pale grey background.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <h3 className="text-[18px] font-semibold text-ink">Controls & keyboard shortcuts</h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    ['Spacebar', 'Play or pause the flipbook cycle'],
                    ['← / → Arrows', 'Step backward or forward one visit'],
                    ['FOV (3′ – 15′)', 'Zoom the cutout field of view in or out'],
                    ['Map Drag & Scroll', 'Rotate the whole-sky globe and zoom to 20,000%'],
                  ].map(([k, desc]) => (
                    <div key={k} className="flex items-center gap-3 rounded-xl border border-soft bg-white px-3.5 py-2.5">
                      <kbd className="shrink-0 rounded-md border border-line bg-page px-2 py-1 font-mono text-xs font-semibold text-ink">
                        {k}
                      </kbd>
                      <span className="text-[13px] text-body">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-soft bg-page px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            {tabIndex > 0 && (
              <button
                type="button"
                onClick={() => setTab(TABS[tabIndex - 1].id)}
                className="btn-plain h-10 px-4 text-sm"
              >
                <PrevIcon />
                Back
              </button>
            )}
            {tabIndex < TABS.length - 1 && (
              <button
                type="button"
                onClick={() => setTab(TABS[tabIndex + 1].id)}
                className="btn-plain h-10 px-4 text-sm"
              >
                Next section
                <NextIcon />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={demoHref}
              onClick={onClose}
              className="flex h-10 items-center gap-1.5 rounded-full border border-[#FF8A3D] bg-[#FFF5EB] px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#FFE6CE]"
            >
              <CompassIcon />
              Try 5-step Guided Demo (WISE 0855)
            </Link>
            <button type="button" onClick={onClose} className="btn-primary h-10 px-5 text-sm">
              Got it, start exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
