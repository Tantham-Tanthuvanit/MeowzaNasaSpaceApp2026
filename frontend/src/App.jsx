import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useSearchParams } from 'react-router-dom';
import { BookIcon, CompassIcon, InfoIcon, MoonIcon, SunIcon, PaletteIcon } from './components/icons';
import { DEMO_TARGET } from './components/DemoTour';
import TutorialModal from './components/TutorialModal';
import SettingsModal from './components/SettingsModal';
import { getInitialTheme, getTheme, applyTheme } from './core/themes';
import Home from './pages/Home';
import Viewer from './pages/Viewer';

const navClass = ({ isActive }) =>
  `flex h-11 items-center rounded-full px-4 text-[15px] ${isActive ? 'bg-[#FFF1E6] dark:bg-[#2A2019] font-semibold text-ink' : 'text-body hover:text-ink'}`;

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
        className={`flex h-11 w-11 items-center justify-center rounded-full ${open ? 'bg-[#FFF1E6] dark:bg-[#2A2019] text-ink' : 'text-body hover:text-ink'}`}
      >
        <InfoIcon />
      </button>
      {open && (
        <section id="data-credits" aria-labelledby="data-credits-title" className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[70vh] w-[440px] max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-soft bg-surface p-5 text-[13px] leading-relaxed text-body shadow-[0_12px_32px_rgba(20,26,46,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
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

  const [themeId, setThemeId] = useState(() => getInitialTheme().id);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('themes');
  const theme = getTheme(themeId);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const toggleQuickDark = () => {
    const nextThemeId = theme.type === 'dark' ? 'retro-sunset' : 'deep-spruce';
    setThemeId(nextThemeId);
  };

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
      <header className="border-b border-soft bg-surface">
        <div className="mx-auto flex min-h-[72px] max-w-[1720px] flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="SkyFlip home">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="var(--color-accent, #FF8A3D)" strokeWidth="2.2" aria-hidden="true">
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
              className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[14px] font-medium text-ink transition-colors hover:border-ink"
              title="Learn how to read infrared sky images and spot moving objects"
            >
              <BookIcon />
              How to use
            </button>
            <Link
              to={demoHref}
              className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
                inDemo
                  ? 'border-accent bg-accent text-[var(--color-accent-text,#0B1020)]'
                  : 'border-accent bg-surface text-ink hover:bg-page'
              }`}
              title="Interactive 5-step walkthrough on real NASA SPHEREx data of brown dwarf WISE 0855"
            >
              <CompassIcon />
              Guided demo
            </Link>
            <button
              type="button"
              onClick={() => {
                setSettingsTab('themes');
                setShowSettings(true);
              }}
              aria-label="Theme settings (Monkeytype style)"
              title={`Active theme: ${theme.name}. Click to open Theme Settings`}
              className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] font-medium text-ink transition-colors hover:border-ink"
            >
              <PaletteIcon />
              <span className="hidden md:inline font-medium">{theme.name}</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 shadow-sm" style={{ backgroundColor: theme.palette[0] }} />
                <span className="h-2.5 w-2.5 rounded-full border border-black/15 shadow-sm" style={{ backgroundColor: theme.palette[4] }} />
              </span>
            </button>
            <button
              type="button"
              onClick={toggleQuickDark}
              aria-pressed={theme.type === 'dark'}
              aria-label={theme.type === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme.type === 'dark' ? 'Quick toggle: Light theme' : 'Quick toggle: Dark theme'}
              className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[14px] font-medium text-ink transition-colors hover:border-ink"
            >
              {theme.type === 'dark' ? <SunIcon /> : <MoonIcon />}
              <span className="hidden xl:inline">{theme.type === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <Credits />
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home onOpenTutorial={() => setShowTutorial(true)} />} />
        <Route path="/viewer" element={<Viewer />} />
      </Routes>
      {showTutorial && !inDemo && <TutorialModal onClose={closeTutorial} />}
      {showSettings && (
        <SettingsModal
          currentThemeId={themeId}
          onSelectTheme={(id) => {
            setThemeId(id);
            applyTheme(id);
          }}
          onClose={() => setShowSettings(false)}
          initialTab={settingsTab}
        />
      )}
    </div>
  );
}
