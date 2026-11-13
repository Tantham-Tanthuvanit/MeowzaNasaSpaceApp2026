import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FlipPlayer from '../components/FlipPlayer';
import ProjectDialog from '../components/ProjectDialog';
import { CheckIcon, PlusIcon } from '../components/icons';
import { useProjects } from '../core/projects';
import { BANDS, ALL_BANDS, DEFAULT_LOOK } from '../core/targets';
import { parseRa, parseDec, fmtRa, fmtDec } from '../core/sky';
import { useFrames } from '../services/api';

export default function Viewer() {
  const [params, setParams] = useSearchParams();
  const { projects, addProject } = useProjects();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // The position comes from the project, else from the address bar, else none yet.
  const project = projects.find((p) => p.id === params.get('project')) || null;
  const urlRa = parseRa(params.get('ra')), urlDec = parseDec(params.get('dec'));
  const { ra, dec } = project || (urlRa !== null && urlDec !== null ? { ra: urlRa, dec: urlDec } : { ra: null, dec: null });
  const hasSpot = ra !== null && dec !== null;

  const bands = BANDS.filter((b) => (project ? project.bands : ALL_BANDS).includes(b.n));
  const band = bands.find((b) => String(b.n) === params.get('band')) || null; // null = all bands together
  const { frames, error, loading, progress, retry } = useFrames(ra, dec, band ? band.id : 'stacked');

  // The form holds what the visitor is typing; it follows the position when that changes.
  const [form, setForm] = useState({ ra: '', dec: '' });
  const [formError, setFormError] = useState('');
  useEffect(() => {
    setForm(hasSpot ? { ra: fmtRa(ra, true), dec: fmtDec(dec, true) } : { ra: '', dec: '' });
    setFormError('');
  }, [ra, dec]);

  const goTo = (newRa, newDec) => setParams({ ra: fmtRa(newRa, true), dec: fmtDec(newDec, true) });

  const submit = (e) => {
    e.preventDefault();
    const newRa = parseRa(form.ra), newDec = parseDec(form.dec);
    if (newRa === null || newDec === null) {
      setFormError('Check the position. Try RA like 08h55m10.8s and Dec like -7d14m42.5s.');
      return;
    }
    goTo(newRa, newDec);
  };

  const pickBand = (n) => {
    const next = new URLSearchParams(params);
    if (n) next.set('band', n);
    else next.delete('band');
    setParams(next);
  };

  const saveProject = async (fields) => {
    setSaving(false);
    try {
      const id = await addProject(fields);
      setSaveError('');
      setParams({ project: id });
    } catch (err) {
      setSaveError(`Couldn’t save the project. ${err.message}`);
    }
  };

  const title = project ? project.name : 'Your spot in the sky';
  const kind = project ? 'Project' : 'Your choice';
  const tab = (on) => `flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`;

  return (
    <main className="mx-auto grid w-full max-w-[1720px] gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_360px] xl:gap-12">
      {/* On small screens the player sits between the form and the list of stars. */}
      <aside aria-label="Choose a patch of sky" className="flex flex-col gap-8 max-lg:contents">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <h1 className="font-display text-[26px] font-medium">Where in the sky?</h1>
          <label className="flex flex-col gap-1 text-sm font-medium text-body">
            Right Ascension (RA)
            <span className="text-[13px] font-normal text-muted">Like longitude, but for the sky: how far east</span>
            <input type="text" value={form.ra} onChange={(e) => setForm({ ...form, ra: e.target.value })} placeholder="08h55m10.831s" className="field mt-1 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-body">
            Declination (Dec)
            <span className="text-[13px] font-normal text-muted">Like latitude, but for the sky: how far north or south</span>
            <input type="text" value={form.dec} onChange={(e) => setForm({ ...form, dec: e.target.value })} placeholder="-7d14m42.53s" className="field mt-1 font-mono" />
          </label>
          {formError && <p role="alert" className="text-sm font-medium text-danger">{formError}</p>}
          <button type="submit" className="btn-primary h-[52px] text-base">Show me</button>
        </form>

      </aside>

      <section aria-label="Image player" className="flex min-w-0 flex-col items-center gap-4 max-lg:order-1">
        <FlipPlayer
          frames={frames}
          loading={loading}
          error={error}
          onRetry={retry}
          progress={progress}
          emptyText={hasSpot ? '' : 'Type a position on the left and press Show me.'}
          resetKey={`${ra}|${dec}`}
          label={hasSpot ? `Centred on RA ${fmtRa(ra)}, Dec ${fmtDec(dec)}` : 'No position chosen yet'}
          bandDot={band ? band.color : '#FFFFFF'}
          bandLabel={band ? `Band ${band.n} · ${band.range} µm` : 'All bands combined'}
        />
        <div role="group" aria-label="Which light to show" className="flex w-full max-w-[700px] flex-wrap gap-2">
          <button type="button" onClick={() => pickBand(null)} aria-pressed={!band} className={tab(!band)}>All bands</button>
          {bands.map((b) => (
            <button key={b.n} type="button" onClick={() => pickBand(b.n)} aria-pressed={band === b} className={tab(band === b)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden="true" />
              Band {b.n}
            </button>
          ))}
        </div>
      </section>

      <aside aria-label="About this patch" className="flex flex-col gap-8 max-lg:order-3 lg:col-span-2 xl:col-span-1">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-rust">{kind}</p>
            {project && (
              <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#E6F6EE] px-2.5 text-[13px] font-semibold text-[#1B6B45]">
                <CheckIcon />Saved
              </span>
            )}
          </div>
          <h2 className="flex items-center gap-3 font-display text-[30px] font-medium leading-tight sm:text-4xl">
            {project && <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: project.color }} aria-hidden="true" />}
            {title}
          </h2>
          {project && project.desc && <p className="text-[15px] leading-relaxed text-body">{project.desc}</p>}

          {hasSpot && (
            <div className="flex flex-col gap-1 pt-1.5">
              <span className="eyebrow">Position · EQ-J2000</span>
              <span className="font-mono text-sm text-body">RA&nbsp; {fmtRa(ra)}</span>
              <span className="font-mono text-sm text-body">Dec {fmtDec(dec)}</span>
            </div>
          )}

          {project ? (
            <Link to={`/?project=${project.id}`} className="btn-plain self-start">Show on the sky map</Link>
          ) : hasSpot && (
            <button type="button" onClick={() => setSaving(true)} className="btn self-start border border-ink bg-white text-ink">
              <PlusIcon />Save as project
            </button>
          )}
          {saveError && <p role="alert" className="text-sm font-medium text-danger">{saveError}</p>}

          <div className="flex flex-col gap-2 pt-2.5">
            <span className="text-[13px] font-semibold text-muted">Spectral coverage</span>
            <div className="flex flex-wrap gap-1.5">
              {bands.map((b) => (
                <span key={b.n} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-soft bg-white px-2.5 text-[13px] text-body">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden="true" />
                  Band {b.n} · {b.range} µm
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[#E1E5EE] pt-7">
          <h3 className="text-[17px] font-semibold">What to watch for</h3>
          <p className="text-[15px] leading-relaxed text-muted">{DEFAULT_LOOK}</p>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[#E1E5EE] pt-7">
          <h3 className="text-[17px] font-semibold">How it works</h3>
          <p className="text-[15px] leading-relaxed text-muted">
            A NASA space telescope called SPHEREx takes pictures of the whole sky, over and over. We put the pictures of your spot in order, oldest to newest, and play them like a flipbook. Most stars stay still, so anything that moves or gets brighter or dimmer is easy to spot.
          </p>
        </div>

        <p className="text-[13px] leading-relaxed text-muted">
          These are real pictures from NASA’s SPHEREx space telescope, from the NASA/IPAC Infrared Science Archive. The first look at a new spot takes a minute or two while the pictures download; after that it opens straight away.
        </p>
      </aside>

      {saving && (
        <ProjectDialog
          title="Save as project"
          sub="Name this spot so you can find it again on the sky map."
          submitLabel="Save project"
          hint="Position filled in from the viewer. You can change it."
          initial={{ name: '', desc: '', ra: fmtRa(ra, true), dec: fmtDec(dec, true), color: '#FF8A3D' }}
          onSubmit={saveProject}
          onClose={() => setSaving(false)}
        />
      )}
    </main>
  );
}
