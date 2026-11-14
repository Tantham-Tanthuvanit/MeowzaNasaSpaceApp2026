import { useEffect, useState } from 'react';
import { MARKER_COLORS } from '../core/targets';
import { parseRa, parseDec } from '../core/sky';
import { CloseIcon } from './icons';

// The one dialog used to create, edit and save projects.
// initial: { name, desc, ra, dec, color } with ra/dec as text.
// onSubmit receives { name, desc, color, ra, dec } with ra/dec in degrees.
export default function ProjectDialog({ title, sub, submitLabel, hint, initial, onSubmit, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setError('');
  };

  const submit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return setError('Give your project a name.');
    const ra = parseRa(form.ra), dec = parseDec(form.dec);
    if (ra === null || dec === null) {
      return setError('Check the position. Try RA like 08h55m10.8s and Dec like -7°14′42.5″.');
    }
    onSubmit({ name, desc: form.desc.trim(), color: form.color, ra, dec });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(11,16,32,0.55)] p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        className="m-auto flex w-full max-w-[640px] flex-col gap-5 rounded-3xl bg-white p-5 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="project-dialog-title" className="font-display text-[26px] font-medium sm:text-[30px]">{title}</h2>
            <p className="text-base leading-relaxed text-muted">{sub}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-round"><CloseIcon /></button>
        </div>

        <label className="flex flex-col gap-2 text-[15px] font-semibold">
          Project name
          <input autoFocus type="text" value={form.name} onChange={set('name')} placeholder="e.g. Hunting moving stars" className="field font-normal" />
        </label>

        <label className="flex flex-col gap-2 text-[15px] font-semibold">
          <span>Description <span className="font-normal text-muted">(optional)</span></span>
          <textarea value={form.desc} onChange={set('desc')} rows={2} placeholder="What are you hoping to spot?" className="field h-auto resize-none py-3 font-normal leading-normal" />
        </label>

        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Position · EQ-J2000</span>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-[15px] font-semibold">
              Right Ascension (RA)
              <input type="text" value={form.ra} onChange={set('ra')} placeholder="08h55m10.8s" className="field font-mono font-normal" />
            </label>
            <label className="flex flex-col gap-2 text-[15px] font-semibold">
              Declination (Dec)
              <input type="text" value={form.dec} onChange={set('dec')} placeholder="-7°14′42.5″" className="field font-mono font-normal" />
            </label>
          </div>
        </div>

        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="float-left mr-4 text-[15px] font-semibold">Marker colour</legend>
          {MARKER_COLORS.map((c) => (
            <button
              key={c.color}
              type="button"
              onClick={() => setForm({ ...form, color: c.color })}
              aria-label={`${c.label} marker`}
              aria-pressed={form.color === c.color}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-white ${form.color === c.color ? 'border-ink' : 'border-transparent'}`}
            >
              <span className="h-7 w-7 rounded-full" style={{ background: c.color }} />
            </button>
          ))}
        </fieldset>

        {error
          ? <p role="alert" className="text-sm font-medium leading-normal text-danger">{error}</p>
          : <p className="text-sm leading-normal text-muted">{hint}</p>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-plain h-[52px] px-6 text-base">Cancel</button>
          <button type="submit" className="btn-primary h-[52px] px-7 text-base">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
