import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FlipPlayer, { fmtDate } from '../components/FlipPlayer';
import Flags from '../components/Flags';
import SpectrumPanel from '../components/SpectrumChart';
import ProjectDialog from '../components/ProjectDialog';
import { CheckIcon, PlusIcon } from '../components/icons';
import { useProjects } from '../core/projects';
import { BANDS, ALL_BANDS, DEFAULT_LOOK } from '../core/targets';
import { parseRa, parseDec, fmtRa, fmtDec, skyToPixel } from '../core/sky';
import { fetchCatalog, fetchLightKinds, fetchShiftAndAdd, listCandidates, useFrames, useRemote } from '../services/api';

// Headings for the extra kinds of light, by the backend's category.
const KIND_GROUPS = [
  ['composite', 'Colour picture'],
  ['diagnostic', 'Molecules and dust'],
  ['photometric', 'Standard astronomy filters'],
  ['index', 'Comparisons of two colours'],
];
const SLOW_TEXT = 'This kind of light needs every picture NASA has of this spot, so the first time can take 15 minutes or more. After that it opens straight away.';
const cleanName = (name) => name.replace(/^[^\p{L}\p{N}]+/u, ''); // the backend's names start with an emoji
const STAR_COLORS = { gaia: '#5AB4FF', wise: '#7EE0B5', dwarf: '#C9A7FF' };
const NO_DRIFT = { x: 0, y: 0 };

// One catalogue object on the picture: circle = Gaia, square = WISE, diamond = possible brown dwarf.
function StarMark({ s, selected, onSelect }) {
  const x = s.pixel_x, y = s.pixel_y;
  const line = { fill: 'none', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' };
  return (
    <g onClick={() => onSelect(s)} className="cursor-pointer">
      <title>{s.id}</title>
      <circle cx={x} cy={y} r="5" fill="transparent" />
      {selected && <circle cx={x} cy={y} r="7" stroke="#FFFFFF" {...line} />}
      {s.is_brown_dwarf_candidate ? (
        <path d={`M${x} ${y - 5}l5 5-5 5-5-5z`} stroke={STAR_COLORS.dwarf} {...line} strokeWidth="2" />
      ) : s.catalog === 'Gaia DR3' ? (
        <circle cx={x} cy={y} r="2.8" stroke={STAR_COLORS.gaia} {...line} />
      ) : (
        <rect x={x - 2.5} y={y - 2.5} width="5" height="5" stroke={STAR_COLORS.wise} {...line} />
      )}
    </g>
  );
}

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

  // Every other kind of light the backend offers (colour picture, narrow filters, comparisons).
  const kinds = useRemote('kinds', fetchLightKinds).data || {};
  const extras = Object.entries(kinds).filter(([id]) => id !== 'stacked' && !id.startsWith('array_'));
  const extraId = !band && extras.some(([id]) => id === params.get('band')) ? params.get('band') : null;
  const bandId = band ? band.id : extraId || 'stacked';
  const { frames, difference, error, loading, progress, retry } = useFrames(ra, dec, bandId);

  // What the player shows: the flipbook, the before-and-after picture, or all pictures combined.
  const oneColour = bandId !== 'false_color_rgb'; // the colour picture has neither of the other two
  const [chosenView, setView] = useState('flipbook');
  const view = oneColour ? chosenView : 'flipbook';
  const [drift, setDrift] = useState(NO_DRIFT); // what the sliders say
  const [sent, setSent] = useState(NO_DRIFT); // what the combined picture was made with
  const combined = useRemote(hasSpot && view === 'combine' ? `${ra}|${dec}|${bandId}|${sent.x}|${sent.y}` : null, (onProgress, isCancelled) =>
    fetchShiftAndAdd(ra, dec, bandId, sent.x, sent.y, onProgress, isCancelled)
  );

  // Known stars from the Gaia and WISE catalogues, looked up only when asked for (it takes a while).
  const [showStars, setShowStars] = useState(false);
  const catalog = useRemote(hasSpot && showStars ? `${ra}|${dec}` : null, () => fetchCatalog(ra, dec));
  const stars = (!catalog.loading && catalog.data && catalog.data.sources) || [];
  const dwarfs = stars.filter((s) => s.is_brown_dwarf_candidate);
  const [source, setSource] = useState(null);

  // Flags near this spot (or all of them when no spot is chosen), and the point being flagged.
  const flags = useRemote(hasSpot ? `${ra}|${dec}` : 'all', () => listCandidates(ra, dec));
  const [point, setPoint] = useState(null);

  // The form holds what the visitor is typing; it follows the position when that changes.
  const [form, setForm] = useState({ ra: '', dec: '' });
  const [formError, setFormError] = useState('');
  useEffect(() => {
    setForm(hasSpot ? { ra: fmtRa(ra, true), dec: fmtDec(dec, true) } : { ra: '', dec: '' });
    setFormError('');
    setSource(null);
    setPoint(null);
    setDrift(NO_DRIFT);
    setSent(NO_DRIFT);
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
  const lightLabel = band ? `Band ${band.n} · ${band.range} µm` : extraId ? cleanName(kinds[extraId].name) : 'All bands combined';
  const still = {
    changes: {
      frames: difference ? [{ image_url: difference }] : [],
      caption: frames.length > 1 ? `${fmtDate(frames[0].timestamp)} to ${fmtDate(frames[frames.length - 1].timestamp)}` : 'What changed',
      emptyText: 'A before-and-after picture needs at least two visits to this spot.',
    },
    combine: {
      frames: combined.data ? [{ image_url: combined.data.image_url }] : [],
      caption: combined.data ? `${combined.data.epochs_stacked} pictures combined` : 'Combined',
      loading: combined.loading,
      error: combined.error,
      progress: combined.progress,
      onRetry: combined.retry,
    },
  }[view];

  const overlay = (
    <>
      {showStars && stars.map((s) => <StarMark key={s.id} s={s} selected={source === s} onSelect={setSource} />)}
      {hasSpot && (flags.data || []).map((c, i) => {
        const [x, y] = skyToPixel(c.ra_deg, c.dec_deg, ra, dec);
        return (
          <g key={c.id} aria-hidden="true">
            <circle cx={x} cy={y} r="5" fill="#FF8A3D" stroke="#0B1020" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={x} y={y + 2.2} textAnchor="middle" fontSize="6" fontWeight="700" fill="#0B1020">{i + 1}</text>
          </g>
        );
      })}
      {point && (
        <g aria-hidden="true" fill="none" vectorEffect="non-scaling-stroke">
          <circle cx={point.x} cy={point.y} r="8" stroke="#0B1020" strokeWidth="5" vectorEffect="non-scaling-stroke" />
          <circle cx={point.x} cy={point.y} r="8" stroke="#FF8A3D" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </>
  );

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
          slowText={extraId && oneColour ? SLOW_TEXT : ''}
          {...(hasSpot ? still : null)}
          overlay={overlay}
          onPick={point ? (x, y) => setPoint({ x, y }) : null}
          resetKey={`${ra}|${dec}`}
          label={hasSpot ? `Centred on RA ${fmtRa(ra)}, Dec ${fmtDec(dec)}` : 'No position chosen yet'}
          bandDot={band ? band.color : '#FFFFFF'}
          bandLabel={lightLabel}
        />

        <div className="flex w-full max-w-[700px] flex-wrap gap-2">
          <div role="group" aria-label="What to show" className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setView('flipbook')} aria-pressed={view === 'flipbook'} className={tab(view === 'flipbook')}>Flipbook</button>
            <button type="button" onClick={() => setView('changes')} aria-pressed={view === 'changes'} disabled={!hasSpot || !oneColour} className={`${tab(view === 'changes')} disabled:opacity-40`}>What changed</button>
            <button type="button" onClick={() => setView('combine')} aria-pressed={view === 'combine'} disabled={!hasSpot || !oneColour} className={`${tab(view === 'combine')} disabled:opacity-40`}>Combined</button>
          </div>
          <button type="button" onClick={() => setShowStars(!showStars)} aria-pressed={showStars} disabled={!hasSpot} className={`${tab(showStars)} ml-auto disabled:opacity-40`}>Known stars</button>
        </div>

        {hasSpot && view === 'changes' && difference && (
          <p className="w-full max-w-[700px] text-[15px] leading-relaxed text-body">
            The newest picture minus the oldest.{' '}
            <span className="mx-0.5 inline-block h-3 w-3 rounded-full bg-[#B40426] align-baseline" aria-hidden="true" /> Red got brighter,{' '}
            <span className="mx-0.5 inline-block h-3 w-3 rounded-full bg-[#3B4CC0] align-baseline" aria-hidden="true" /> blue got dimmer, and pale grey stayed the same. Something that moved leaves a blue dot where it was and a red dot where it went.
          </p>
        )}

        {hasSpot && view === 'combine' && (
          <div className="flex w-full max-w-[700px] flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-body">
              Something faint that drifts across the sky can be too dim to see in any one picture. Guess its drift, and each newer picture is slid back by that much before all of them are combined. Stars then smear out, but anything moving at your guess piles up into one clear dot. With no drift, this is simply every visit combined.
            </p>
            {[['x', 'Sideways drift'], ['y', 'Up-and-down drift']].map(([axis, name]) => (
              <label key={axis} className="flex flex-wrap items-center gap-x-3 text-sm font-medium text-body">
                <span className="w-[130px]">{name}</span>
                <input type="range" min="-8" max="8" step="0.5" value={drift[axis]} onChange={(e) => setDrift({ ...drift, [axis]: Number(e.target.value) })} className="h-11 min-w-[120px] flex-1 accent-accent" />
                <span className="w-[150px] text-right font-mono text-[13px]">{drift[axis]} pixels per visit</span>
              </label>
            ))}
            <button type="button" onClick={() => setSent(drift)} disabled={drift.x === sent.x && drift.y === sent.y} className="btn-primary self-start disabled:opacity-40">Combine with this drift</button>
          </div>
        )}

        {hasSpot && showStars && (
          <div className="flex w-full max-w-[700px] flex-col gap-2 text-sm leading-relaxed text-body">
            {catalog.loading && <p role="status">Looking up known stars in the Gaia and WISE catalogues… This takes about half a minute.</p>}
            {catalog.error && (
              <div role="alert" className="flex flex-wrap items-center gap-3">
                <p className="font-medium text-danger">{catalog.error}</p>
                <button type="button" onClick={catalog.retry} className="btn-plain">Try again</button>
              </div>
            )}
            {!catalog.loading && catalog.data && (
              <>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: STAR_COLORS.gaia }} aria-hidden="true" />
                    {stars.filter((s) => s.catalog === 'Gaia DR3').length} stars seen in visible light (Gaia)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 border-2" style={{ borderColor: STAR_COLORS.wise }} aria-hidden="true" />
                    {stars.filter((s) => s.catalog !== 'Gaia DR3' && !s.is_brown_dwarf_candidate).length} objects seen in infrared (WISE)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rotate-45 border-2" style={{ borderColor: STAR_COLORS.dwarf }} aria-hidden="true" />
                    {dwarfs.length} possible brown {dwarfs.length === 1 ? 'dwarf' : 'dwarfs'}
                  </span>
                </p>
                {dwarfs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dwarfs.map((s, i) => (
                      <button key={s.id} type="button" onClick={() => setSource(s)} aria-pressed={source === s} className={`btn-plain h-10 px-4 text-sm ${source === s ? 'border-ink' : ''}`}>
                        Possible brown dwarf {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                {source ? (
                  <div className="flex flex-col gap-1 rounded-xl border border-soft bg-white p-3.5">
                    <span className="font-mono text-[13px] text-ink">{source.id}</span>
                    {source.mag != null && <span>Brightness: magnitude {source.mag} in {source.mag_band}. Smaller numbers are brighter.</span>}
                    {source.proper_motion_mas_yr != null && (
                      <span>
                        Drifts {source.proper_motion_mas_yr} thousandths of an arcsecond a year{source.is_high_proper_motion ? ', which is fast for a star.' : '.'}
                      </span>
                    )}
                    {source.is_brown_dwarf_candidate && (
                      <span>
                        Much brighter in longer infrared light than shorter (W1 − W2 = {source.w1_w2_color}), with no Gaia star at the same place. Cold brown dwarfs look like this. It is a hint, not proof.
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">Click a mark on the picture to read about it.</p>
                )}
              </>
            )}
          </div>
        )}

        <div role="group" aria-label="Which light to show" className="flex w-full max-w-[700px] flex-wrap gap-2">
          <button type="button" onClick={() => pickBand(null)} aria-pressed={!band} className={tab(!band)}>All bands</button>
          {bands.map((b) => (
            <button key={b.n} type="button" onClick={() => pickBand(b.n)} aria-pressed={band === b} className={tab(band === b)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden="true" />
              Band {b.n}
            </button>
          ))}
          {extras.length > 0 && (
            <select
              aria-label="More kinds of light"
              value={extraId || ''}
              onChange={(e) => pickBand(e.target.value || null)}
              className={`h-11 max-w-full rounded-full border px-4 text-sm font-medium ${extraId ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}
            >
              <option value="">More kinds of light…</option>
              {KIND_GROUPS.map(([category, heading]) => (
                <optgroup key={category} label={heading}>
                  {extras.filter(([, k]) => k.category === category).map(([id, k]) => <option key={id} value={id}>{cleanName(k.name)}</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </div>
        {extraId && (
          <p className="w-full max-w-[700px] text-sm leading-relaxed text-muted">
            {kinds[extraId].description}{oneColour ? ' The first time, this needs every picture NASA has of this spot, which can take 15 minutes or more.' : ''}
          </p>
        )}

        {hasSpot && <SpectrumPanel key={`${ra}|${dec}`} ra={ra} dec={dec} />}
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

        <Flags ra={ra} dec={dec} flags={flags} point={point} setPoint={setPoint} band={bandId} />

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
