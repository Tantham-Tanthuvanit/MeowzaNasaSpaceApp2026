import { useEffect, useMemo, useRef, useState } from 'react';
import { MAP_W, MAP_H, MAP_RX, MAP_RY, project, inverse, pathFrom, wrap360, clamp, fmtRa, fmtDec } from '../core/sky';
import SkyCanvas from './SkyCanvas';

const pct = (v, total) => `${(v / total) * 100}%`;

// Where a pointer event lands in map coordinates.
function toMap(e, el) {
  const r = el.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H];
}

// The drag-and-zoom all-sky map with project markers and the dropped pin.
// view: { rot, tilt, zoom }. Children are drawn on top (controls, cards).
export default function SkyMap({ view, onView, projects, selectedId, onSelect, pin, onPin, children }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(null);
  const { zoom } = view;

  // Wheel zoom needs a non-passive listener so the page doesn't scroll at the same time.
  useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      e.preventDefault();
      onView((v) => ({ ...v, zoom: clamp(v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 6) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onView]);

  const P = (ra, dec) => project(ra, dec, view);

  const { grid, hours } = useMemo(() => {
    const lines = [];
    for (const dec of [-60, -30, 0, 30, 60]) {
      const pts = [];
      for (let ra = 0; ra <= 360; ra += 3) pts.push(P(ra, dec));
      lines.push(pathFrom(pts));
    }
    for (let ra = 0; ra < 360; ra += 30) {
      const pts = [];
      for (let dec = -88; dec <= 88; dec += 3) pts.push(P(ra, dec));
      lines.push(pathFrom(pts));
    }
    const labels = [];
    for (let h = 0; h < 24; h += 3) {
      const q = P(h * 15, 0);
      const onFront = Math.abs(q[2]) < (160 * Math.PI) / 180;
      if (onFront && q[0] > 20 && q[0] < MAP_W - 20 && q[1] > 30 && q[1] < MAP_H - 20) labels.push({ h, x: q[0], y: q[1] });
    }
    return {
      grid: lines,
      hours: labels,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.rot, view.tilt, view.zoom]);

  const onPointerDown = (e) => {
    if (e.target.closest('[data-map-ui]')) return;
    drag.current = { x: e.clientX, y: e.clientY, rot: view.rot, tilt: view.tilt, scale: MAP_W / ref.current.getBoundingClientRect().width };
    moved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) {
      setHover(e.target.closest('[data-map-ui]') ? null : inverse(...toMap(e, ref.current), view));
      return;
    }
    const dx = (e.clientX - d.x) * d.scale, dy = (e.clientY - d.y) * d.scale;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) {
      moved.current = true;
      ref.current.setPointerCapture(e.pointerId);
    }
    if (moved.current) {
      onView((v) => ({
        ...v,
        rot: wrap360(d.rot + (dx * (180 / MAP_RX)) / v.zoom),
        tilt: clamp(d.tilt + (dy * (90 / MAP_RY)) / v.zoom, -90, 90),
      }));
    }
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onClick = (e) => {
    if (moved.current || e.target.closest('[data-map-ui]')) return;
    const spot = inverse(...toMap(e, ref.current), view);
    if (spot) onPin(spot);
  };

  const pinXY = pin ? P(pin[0], pin[1]) : null;

  return (
    <section
      ref={ref}
      aria-label="Map of the whole sky. Drag to turn it, scroll to zoom, click anywhere to see its coordinates, or click a project marker to see its details."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
      className={`relative w-full touch-none select-none overflow-hidden rounded-2xl ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
    >
      <SkyCanvas view={view} />

      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none">
        <defs>
          <clipPath id="sky-oval"><ellipse cx={MAP_W / 2} cy={MAP_H / 2} rx={MAP_RX * zoom} ry={MAP_RY * zoom} /></clipPath>
        </defs>
        <g clipPath="url(#sky-oval)">
          <g fill="none" stroke="#7A93D0" strokeWidth="0.8" opacity="0.5">
            {grid.map((d, i) => <path key={i} d={d} />)}
          </g>
        </g>
        <ellipse cx={MAP_W / 2} cy={MAP_H / 2} rx={MAP_RX * zoom} ry={MAP_RY * zoom} fill="none" stroke="#667EA8" strokeWidth="1.5" />
      </svg>

      {hours.map((l) => (
        <span key={l.h} className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-full pb-1 font-mono text-sm text-[#B4BFDB] sm:block" style={{ left: pct(l.x, MAP_W), top: pct(l.y, MAP_H) }}>
          {l.h}h
        </span>
      ))}

      {projects.map((p) => {
        const [x, y] = P(p.ra, p.dec);
        if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) return null;
        const on = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            data-map-ui
            onClick={() => onSelect(on ? null : p.id)}
            aria-label={`Project ${p.name}: show details`}
            aria-pressed={on}
            className="group absolute -ml-[22px] -mt-[22px] flex h-11 items-center gap-1.5 rounded-full pr-1 text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ left: pct(x, MAP_W), top: pct(y, MAP_H), zIndex: on ? 5 : 2 }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center">
              <span
                className="flex items-center justify-center rounded-full border-[2.5px] transition-transform group-hover:scale-[1.18]"
                style={{ width: on ? 30 : 22, height: on ? 30 : 22, borderColor: p.color, boxShadow: `0 0 ${on ? 18 : 10}px ${p.color}, inset 0 0 6px ${p.color}` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </span>
            <span
              className={`whitespace-nowrap rounded-[10px] border bg-[rgba(7,11,24,0.82)] px-3 py-1.5 text-[15px] font-semibold ${on ? '' : 'hidden md:block'}`}
              style={{ borderColor: on ? p.color : 'rgba(255,255,255,0.12)' }}
            >
              {p.name}
            </span>
          </button>
        );
      })}

      {pinXY && pinXY[0] > 0 && pinXY[0] < MAP_W && pinXY[1] > 0 && pinXY[1] < MAP_H && (
        <svg width="36" height="48" viewBox="0 0 36 48" aria-hidden="true" className="pointer-events-none absolute z-[6] -ml-[18px] -mt-[46px] drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)]" style={{ left: pct(pinXY[0], MAP_W), top: pct(pinXY[1], MAP_H) }}>
          <path d="M18 46 C18 46 3 28 3 17 A15 15 0 0 1 33 17 C33 28 18 46 18 46 Z" fill="#FF8A3D" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="18" cy="17" r="5.5" fill="#FFFFFF" />
        </svg>
      )}

      {hover && !dragging && (
        <div className="pointer-events-none absolute left-1/2 top-3 hidden -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-soft bg-white/85 px-4 py-2 font-mono text-sm text-ink backdrop-blur lg:flex">
          <span className="font-sans text-[13px] font-semibold text-muted">Pointer</span>
          <span>RA {fmtRa(hover[0])}</span>
          <span>Dec {fmtDec(hover[1])}</span>
        </div>
      )}

      {children}
    </section>
  );
}
