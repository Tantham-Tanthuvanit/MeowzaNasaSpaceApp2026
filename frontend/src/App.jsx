import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useSearchParams } from 'react-router-dom';
import { BookIcon, CompassIcon, InfoIcon } from './components/icons';
import { DEMO_TARGET } from './components/DemoTour';
import TutorialModal from './components/TutorialModal';
import Home from './pages/Home';
import Viewer from './pages/Viewer';

const navClass = ({ isActive }) =>
  `flex h-11 items-center rounded-full px-4 text-[15px] ${isActive ? 'bg-[#FFF1E6] font-semibold text-ink' : 'text-body hover:text-ink'}`;

// Data credits, behind a small info button in the header so they never take room from the page.
function Credits() {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="data-credits"
        aria-label="Data credits"
        title="Data credits"
        className={`flex h-11 w-11 items-center justify-center rounded-full ${open ? 'bg-[#FFF1E6] text-ink' : 'text-body hover:text-ink'}`}
      >
        <InfoIcon />
      </button>
      {open && (
        <section id="data-credits" aria-labelledby="data-credits-title" className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[70vh] w-[440px] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-soft bg-white p-5 text-[13px] leading-relaxed text-muted shadow-[0_12px_32px_rgba(20,26,46,0.18)]">
          <h2 id="data-credits-title" className="text-[15px] font-semibold text-ink">Data credits</h2>
          <p>
            This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of
            Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California
            Institute of Technology, and is funded by the National Aeronautics and Space Administration. SPHEREx data from the
            NASA/IPAC Infrared Science Archive (IRSA).
          </p>
          <p>
            Star catalogues: Gaia DR3 (ESA/Gaia/DPAC, licensed CC BY-NC 3.0 IGO) and AllWISE (Wide-field Infrared Survey Explorer,
            a joint project of UCLA and JPL/Caltech, funded by NASA), both served by IRSA.
          </p>
        </section>
      )}
    </div>
  );
}

export default function App() {
  const [params] = useSearchParams();
  const inDemo = Boolean(params.get('demo'));
  const demoHref = `/viewer?demo=1&ra=${encodeURIComponent(DEMO_TARGET.ra)}&dec=${encodeURIComponent(DEMO_TARGET.dec)}&band=6`;
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return !localStorage.getItem('skyflip_tutorial_seen');
    } catch {
      return false;
    }
  });

  const closeTutorial = () => {
    try {
      localStorage.setItem('skyflip_tutorial_seen', '1');
    } catch {
      // ignore storage errors in restricted browsing contexts
    }
    setShowTutorial(false);
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="border-b border-[#E1E5EE] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1720px] flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="SkyFlip home">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="#FF8A3D" strokeWidth="2.2" aria-hidden="true">
              <rect x="4" y="4" width="18" height="18" rx="2" />
              <rect x="10" y="10" width="18" height="18" rx="2" />
            </svg>
            <span className="font-display text-[22px] font-bold">SkyFlip</span>
            <span className="ml-3 hidden text-[15px] text-muted xl:inline">
              See how the night sky changes, picture by picture
            </span>
          </NavLink>
          <nav aria-label="Main" className="flex items-center gap-1.5">
            <NavLink to="/" end className={navClass}>Sky map</NavLink>
            <NavLink to="/viewer" className={(s) => navClass({ isActive: s.isActive && !inDemo })}>Sky viewer</NavLink>
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[14px] font-medium text-ink transition-colors hover:border-ink"
              title="Learn how to read infrared sky images and spot moving objects"
            >
              <BookIcon />
              How to use
            </button>
            <Link
              to={demoHref}
              className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                inDemo
                  ? 'border-[#FF8A3D] bg-[#FF8A3D] text-[#0B1020]'
                  : 'border-[#FF8A3D] bg-[#FFF5EB] text-ink hover:bg-[#FFE6CE]'
              }`}
              title="Interactive 5-step walkthrough on real NASA SPHEREx data of brown dwarf WISE 0855"
            >
              <CompassIcon />
              Guided demo
            </Link>
            <Credits />
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home onOpenTutorial={() => setShowTutorial(true)} />} />
        <Route path="/viewer" element={<Viewer />} />
      </Routes>
      {showTutorial && !inDemo && <TutorialModal onClose={closeTutorial} />}
    </div>
  );
}
