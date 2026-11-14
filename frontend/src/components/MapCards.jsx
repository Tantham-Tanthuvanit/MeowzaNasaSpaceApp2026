import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BANDS } from '../core/targets';
import { fmtRa, fmtDec } from '../core/sky';
import { useFrames } from '../services/api';
import { useFlipbook, fmtDate } from './FlipPlayer';
import { CloseIcon, InfoIcon } from './icons';

// A small looping preview of the real pictures for a position.
function MiniPreview({ ra, dec }) {
  const { frames, error, loading, progress } = useFrames(ra, dec);
  const { frame } = useFlipbook(frames.length, `${ra}|${dec}`);
  const current = frames[frame];
  return (
    <div role="img" aria-label={current ? `Preview, picture ${frame + 1} of ${frames.length}` : 'Preview'} className="relative h-[120px] overflow-hidden rounded-[10px] bg-[#04060D]">
      {current && <img src={current.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <span className="absolute left-2 top-2 rounded bg-[rgba(4,6,13,0.75)] px-1.5 py-0.5 font-mono text-xs text-[#E8ECF5]">
        {current ? `Picture ${frame + 1} of ${frames.length} · ${fmtDate(current.timestamp)}` : loading ? (progress ? `Downloading ${progress.cached_images} of ${progress.total_images}…` : 'Loading…') : error ? 'Preview unavailable' : ''}
      </span>
    </div>
  );
}

// Details of the selected project: what it watches, where, and what you can do with it.
export function ProjectCard({ project, onClose, onEdit, onDelete }) {
  const [askDelete, setAskDelete] = useState(false);
  return (
    <div role="dialog" aria-labelledby="project-card-title" className="flex flex-col gap-3.5 rounded-[18px] border border-soft bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: project.color }} aria-hidden="true" />
            <h3 id="project-card-title" className="font-display text-[22px] font-medium leading-tight">{project.name}</h3>
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close project details" className="btn-round"><CloseIcon /></button>
      </div>

      {project.desc && <p className="text-[15px] leading-relaxed text-body">{project.desc}</p>}

      <MiniPreview ra={project.ra} dec={project.dec} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">EQ-J2000</span>
          <span className="font-mono text-[13px]"><span className="text-rust">RA</span>&nbsp; {fmtRa(project.ra)}</span>
          <span className="font-mono text-[13px]"><span className="text-rust">Dec</span> {fmtDec(project.dec)}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Bands</span>
          <span className="flex flex-wrap gap-1">
            {BANDS.filter((b) => project.bands.includes(b.n)).map((b) => (
              <span key={b.n} className="inline-flex h-[22px] items-center gap-1 rounded-full border border-soft px-[7px] text-xs text-body">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: b.color }} aria-hidden="true" />{b.n}
              </span>
            ))}
          </span>
          <span className="text-xs text-muted">Created {project.created}</span>
        </div>
      </div>

      {askDelete ? (
        <div role="alert" className="flex flex-col gap-2.5 rounded-xl bg-[#FFF4F2] p-3.5 text-[#7A1D12]">
          <span className="text-[15px] font-semibold">Delete this project?</span>
          <span className="text-sm leading-snug">“{project.name}” will be removed from the map. This can’t be undone.</span>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setAskDelete(false)} className="btn-plain">Cancel</button>
            <button type="button" onClick={onDelete} className="btn bg-danger text-white">Delete project</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link to={`/viewer?project=${project.id}`} className="btn-primary flex-1 whitespace-nowrap">Open in Sky viewer</Link>
          <button type="button" onClick={onEdit} className="btn-plain px-4">Edit</button>
          <button type="button" onClick={() => setAskDelete(true)} className="btn border border-[#F1C9C4] bg-white px-4 font-medium text-danger">Delete</button>
        </div>
      )}
    </div>
  );
}

// Shown after clicking an empty spot on the map.
export function PinCard({ pin, onClose, onSave }) {
  return (
    <div role="dialog" aria-label="Coordinates of this spot" className="flex flex-col gap-3 rounded-2xl border border-soft bg-white px-5 py-[18px] shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-semibold">This spot in the sky</span>
          <span className="text-[13px] text-muted">Coordinates in EQ-J2000</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="btn-round"><CloseIcon /></button>
      </div>
      <div className="grid grid-cols-[44px_1fr] gap-y-1.5 font-mono text-base">
        <span className="text-rust">RA</span><span>{fmtRa(pin[0])}</span>
        <span className="text-rust">Dec</span><span>{fmtDec(pin[1])}</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link to={`/viewer?ra=${encodeURIComponent(fmtRa(pin[0], true))}&dec=${encodeURIComponent(fmtDec(pin[1], true))}`} className="btn-primary flex-1 whitespace-nowrap">Watch this spot</Link>
        <button type="button" onClick={onSave} className="btn-plain flex-1 whitespace-nowrap font-semibold">Save as project</button>
      </div>
    </div>
  );
}

// "How do sky positions work?" button and the explainer it opens.
export function CoordInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col-reverse gap-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="coord-info"
        className="flex min-h-[52px] items-center gap-3 self-start rounded-full border border-[#2E3A66] bg-night py-1.5 pl-4 pr-2 text-left text-[15px] font-semibold text-white"
      >
        <InfoIcon />
        <span className="flex flex-col">
          How do sky positions work?
          <span className="text-[13px] font-medium text-[#C5CDE0]">RA, Dec and EQ-J2000, explained simply</span>
        </span>
        <span className="flex h-9 items-center rounded-full bg-accent px-3.5 text-sm text-[#0B1020]">{open ? 'Close' : 'Open'}</span>
      </button>
      {open && (
        <section id="coord-info" aria-labelledby="coord-info-title" className="flex max-h-[70vh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-[22px] border border-soft bg-white/95 p-6 text-ink shadow-[0_12px_32px_rgba(20,26,46,0.18)] backdrop-blur">
          <div className="flex flex-col gap-1">
            <h2 id="coord-info-title" className="text-xl font-semibold">Every star has an address</h2>
            <p className="text-[15px] leading-relaxed text-muted">Just like a place on Earth, a spot in the sky is found with two numbers.</p>
          </div>
          <div className="grid grid-cols-[44px_1fr] gap-x-3 gap-y-3.5 border-t border-soft pt-3.5">
            <span className="font-mono text-base font-medium text-rust">RA</span>
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Right Ascension: like longitude</span>
              <span className="text-[15px] leading-relaxed text-muted">How far east around the sky, in hours, minutes and seconds, from 0h to 24h.</span>
              <span className="font-mono text-[15px] text-body">e.g. 08h 55m 10.8s</span>
            </div>
            <span className="font-mono text-base font-medium text-rust">Dec</span>
            <div className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Declination: like latitude</span>
              <span className="text-[15px] leading-relaxed text-muted">How far north or south, in degrees: +90° is straight above Earth’s North Pole, −90° above the South Pole.</span>
              <span className="font-mono text-[15px] text-body">e.g. −7° 14′ 42.5″</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-page p-4 text-[15px] leading-relaxed text-body">
            <span className="text-[17px] font-semibold text-ink">What does EQ-J2000 mean?</span>
            <span><strong className="font-semibold">EQ</strong> (equatorial): the grid is lined up with Earth’s equator and poles, stretched out onto the sky.</span>
            <span><strong className="font-semibold">J2000</strong>: Earth slowly wobbles like a spinning top, so the grid drifts a tiny bit each year. Astronomers pin it to one moment, noon on 1 January 2000, so a star’s address is the same for everyone.</span>
            <span>Every position on SkyFlip uses EQ-J2000.</span>
          </div>
        </section>
      )}
    </div>
  );
}
