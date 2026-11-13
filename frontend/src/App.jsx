import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Viewer from './pages/Viewer';

const navClass = ({ isActive }) =>
  `flex h-11 items-center rounded-full px-4 text-[15px] ${isActive ? 'bg-[#FFF1E6] font-semibold text-ink' : 'text-body hover:text-ink'}`;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
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
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>Sky map</NavLink>
            <NavLink to="/viewer" className={navClass}>Sky viewer</NavLink>
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/viewer" element={<Viewer />} />
      </Routes>
    </div>
  );
}
