import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtRa, fmtDec } from '../core/sky';
import { flagCandidate, voteCandidate } from '../services/api';
import { fmtDate } from './FlipPlayer';
import { PlusIcon } from './icons';

// The backend's four categories, in plain words.
const KINDS = [
  { id: 'variable_star', label: 'A star that changes brightness' },
  { id: 'asteroid', label: 'An asteroid' },
  { id: 'brown_dwarf', label: 'A brown dwarf (a failed star)' },
  { id: 'planet_x', label: 'A far-off planet' },
];
const kindLabel = (id) => (KINDS.find((k) => k.id === id) || { label: id }).label;
const SURE = ['A wild guess', 'Not very sure', 'Fairly sure', 'Sure', 'Certain'];

// Things people have flagged: near the chosen spot, or everywhere when no spot is chosen.
// flags: { data, error, loading, retry } from useRemote. point: null, or the { x, y } picture
// point being flagged (the viewer draws it and moves it when the picture is clicked).
export default function Flags({ ra, dec, flags, point, setPoint, band }) {
  const hasSpot = ra !== null;
  const [form, setForm] = useState({ category: KINDS[0].id, confidence: 3, notes: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = flags.data || [];

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const act = async (work, failText) => {
    setBusy(true);
    setError('');
    try {
      await work();
      flags.retry();
    } catch (err) {
      setError(`${failText} ${err.message}`);
    }
    setBusy(false);
  };

  const submit = (e) => {
    e.preventDefault();
    act(async () => {
      await flagCandidate(ra, dec, point.x, point.y, {
        category: form.category,
        confidence: Number(form.confidence),
        notes: form.notes.trim(),
        observer_callsign: form.name.trim() || undefined,
        band_group: band,
      });
      setPoint(null);
      setForm({ ...form, notes: '' });
    }, 'Couldn’t save the flag.');
  };

  return (
    <div className="flex flex-col gap-4 border-t border-[#E1E5EE] pt-7">
      <h3 className="text-[17px] font-semibold">{hasSpot ? 'Flagged in this picture' : 'Flagged by people'}</h3>
      <p className="text-[15px] leading-relaxed text-muted">
        Seen a dot that moves, appears or changes brightness? Flag it so others can check. Flags are public and anyone can add one.
      </p>

      {hasSpot && !point && (
        <button type="button" onClick={() => setPoint({ x: 128, y: 128 })} className="btn self-start border border-ink bg-white text-ink">
          <PlusIcon />Flag something here
        </button>
      )}

      {hasSpot && point && (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-ink bg-white p-4">
          <p className="text-sm leading-relaxed text-body">
            The orange ring on the picture marks your flag. It starts on the centre. Click the picture to move it.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            What do you think it is?
            <select value={form.category} onChange={set('category')} className="field h-11 px-3 text-[15px] font-normal">
              {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            How sure are you?
            <select value={form.confidence} onChange={set('confidence')} className="field h-11 px-3 text-[15px] font-normal">
              {SURE.map((s, i) => <option key={s} value={i + 1}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>What did you see? <span className="font-normal text-muted">(optional)</span></span>
            <textarea value={form.notes} onChange={set('notes')} rows={2} maxLength={500} className="field h-auto resize-none px-3 py-2.5 text-[15px] font-normal leading-normal" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Your name or nickname <span className="font-normal text-muted">(optional, shown to everyone)</span></span>
            <input type="text" value={form.name} onChange={set('name')} maxLength={40} className="field h-11 px-3 text-[15px] font-normal" />
          </label>
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">Flag it</button>
            <button type="button" onClick={() => setPoint(null)} className="btn-plain">Cancel</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

      {flags.error && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-sm font-medium text-danger">Couldn’t load the flags. {flags.error}</p>
          <button type="button" onClick={flags.retry} className="btn-plain">Try again</button>
        </div>
      )}
      {flags.loading && !flags.data && <p role="status" className="text-sm text-muted">Loading flags…</p>}
      {flags.data && !list.length && <p className="text-sm text-body">{hasSpot ? 'Nothing flagged here yet.' : 'Nothing flagged yet. Choose a spot to flag the first thing.'}</p>}

      {list.length > 0 && (
        <ol className="flex flex-col gap-3">
          {list.map((c, i) => (
            <li key={c.id} className="flex flex-col gap-1.5 rounded-xl border border-soft bg-white p-3.5">
              <div className="flex items-start gap-2.5">
                {hasSpot && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[13px] font-semibold text-[#0B1020]">{i + 1}</span>}
                <div className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{kindLabel(c.category)}</span>
                  <span className="text-[13px] text-muted">
                    {SURE[c.confidence - 1]}, says {c.observer_callsign}, {fmtDate(String(c.created_at).slice(0, 10))}
                  </span>
                </div>
              </div>
              {c.notes && <p className="text-sm leading-relaxed text-body">{c.notes}</p>}
              <span className="font-mono text-[13px] text-muted">RA {fmtRa(c.ra_deg)} · Dec {fmtDec(c.dec_deg)}</span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" disabled={busy} onClick={() => act(() => voteCandidate(c.id, c.user_voted), 'Couldn’t save your vote.')} className="btn-plain h-10 px-4 text-sm disabled:opacity-50">
                  {c.user_voted ? 'Take back my vote' : 'I see it too'}
                </button>
                <span className="text-sm text-body">
                  {c.upvotes} {c.upvotes === 1 ? 'person agrees' : 'people agree'}{c.user_voted ? ', including you' : ''}
                </span>
                {!hasSpot && <Link to={`/viewer?ra=${fmtRa(c.ra_deg, true)}&dec=${encodeURIComponent(fmtDec(c.dec_deg, true))}`} className="ml-auto text-sm font-semibold text-rust underline">Look at this spot</Link>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {list.length > 0 && (
        <a href="/api/candidates/export-mpc" download="skyflip-flags.txt" className="self-start text-sm font-semibold text-rust underline">
          Download every flag as a report for astronomers
        </a>
      )}
    </div>
  );
}
