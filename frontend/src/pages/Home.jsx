import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SkyMap from '../components/SkyMap';
import ProjectDialog from '../components/ProjectDialog';
import { ProjectCard, PinCard, CoordInfo } from '../components/MapCards';
import { DEMO_HREF } from '../components/DemoTour';
import { BookIcon, CompassIcon, ShuffleIcon } from '../components/icons';
import { useProjects, isUserProject, isOfficialProject } from '../core/projects';
import { MARKER_COLORS } from '../core/targets';
import { MAP_W, MAX_ZOOM, project, clamp, fmtRa, fmtDec, randomSkyPoint } from '../core/sky';

const START_VIEW = { rot: 0, tilt: 0, zoom: 1 };
const centredOn = (p) => ({ rot: p.ra, tilt: p.dec, zoom: 1 });

export default function Home({ onOpenTutorial }) {
  const { projects, loaded, error, addProject, updateProject, deleteProject } = useProjects();
  const [params] = useSearchParams();
  const demoHref = DEMO_HREF();

  // Toggle for user-created projects and official benchmark targets
  const [showUserProjects, setShowUserProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('skyflip_show_user_projects');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [showOfficialProjects, setShowOfficialProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('skyflip_show_official_projects');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [skySurvey, setSkySurvey] = useState(() => {
    try {
      const saved = localStorage.getItem('skyflip_sky_survey');
      return saved === 'infrared' ? 'infrared' : 'visible';
    } catch {
      return 'visible';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('skyflip_show_user_projects', String(showUserProjects));
    } catch {
      // ignore
    }
  }, [showUserProjects]);

  useEffect(() => {
    try {
      localStorage.setItem('skyflip_show_official_projects', String(showOfficialProjects));
    } catch {
      // ignore
    }
  }, [showOfficialProjects]);

  useEffect(() => {
    try {
      localStorage.setItem('skyflip_sky_survey', skySurvey);
    } catch {
      // ignore
    }
  }, [skySurvey]);

  // Coming back from the viewer with ?project=id opens that project on the map.
  const arrived = projects.find((p) => p.id === params.get('project'));
  const [view, setView] = useState(arrived ? centredOn(arrived) : START_VIEW);
  const [selectedId, setSelectedId] = useState(arrived ? arrived.id : null);
  const [pin, setPin] = useState(null);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null); // null | { editId, initial }
  const [actionError, setActionError] = useState('');

  // Counts of user-created vs official projects
  const userProjectsCount = useMemo(() => projects.filter(isUserProject).length, [projects]);
  const officialProjectsCount = useMemo(() => projects.filter(isOfficialProject).length, [projects]);

  // Filter projects shown on the sky map based on user toggles
  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      const isUser = isUserProject(p);
      if (isUser && !showUserProjects) return false;
      if (!isUser && !showOfficialProjects) return false;
      return true;
    });
  }, [projects, showUserProjects, showOfficialProjects]);

  // The project list loads from the server, so ?project=id may only resolve once it arrives.
  useEffect(() => {
    if (loaded && arrived && selectedId === null) {
      if (isUserProject(arrived) && !showUserProjects) setShowUserProjects(true);
      setSelectedId(arrived.id);
      setView(centredOn(arrived));
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = projects.find((p) => p.id === selectedId) || null;

  // If a selected user project is hidden by the toggle, close its card
  useEffect(() => {
    if (selected && isUserProject(selected) && !showUserProjects) {
      setSelectedId(null);
    }
  }, [selected, showUserProjects]);

  // The open card docks on the side of the map away from the marker or pin it describes.
  const spot = selected ? [selected.ra, selected.dec] : pin;
  const cardSide = spot && project(spot[0], spot[1], view)[0] > MAP_W / 2 ? 'left-4' : 'right-4';
  const zoomBy = (f) => setView((v) => ({ ...v, zoom: clamp(v.zoom * f, 1, MAX_ZOOM) }));

  const openCreate = () =>
    setDialog({
      editId: null,
      initial: {
        name: '',
        desc: '',
        ra: pin ? fmtRa(pin[0], true) : '',
        dec: pin ? fmtDec(pin[1], true) : '',
        color: MARKER_COLORS[projects.length % MARKER_COLORS.length].color,
      },
    });

  // Search the saved projects by name or description.
  const q = query.trim().toLowerCase();
  const matches = q ? projects.filter((p) => `${p.name} ${p.desc || ''}`.toLowerCase().includes(q)) : [];
  const openFound = (p) => {
    setQuery('');
    setPin(null);
    if (isUserProject(p) && !showUserProjects) {
      setShowUserProjects(true);
    }
    if (isOfficialProject(p) && !showOfficialProjects) {
      setShowOfficialProjects(true);
    }
    setSelectedId(p.id);
    setView(centredOn(p));
  };

  const pickRandomPatch = () => {
    const [randRa, randDec] = randomSkyPoint();
    setQuery('');
    setSelectedId(null);
    setPin([randRa, randDec]);
    setView({ rot: randRa, tilt: randDec, zoom: 1 });
  };

  const openEdit = (p) =>
    setDialog({ editId: p.id, initial: { name: p.name, desc: p.desc, ra: fmtRa(p.ra, true), dec: fmtDec(p.dec, true), color: p.color } });

  const submitDialog = async (fields) => {
    const editId = dialog.editId;
    setDialog(null);
    try {
      let id = editId;
      if (id) await updateProject(id, fields);
      else id = await addProject(fields);
      setActionError('');
      setPin(null);
      // Ensure user projects are visible so newly created project is visible on map
      setShowUserProjects(true);
      setSelectedId(id);
      setView((v) => ({ ...v, rot: fields.ra, tilt: fields.dec }));
    } catch (err) {
      setActionError(`Couldn’t save the project. ${err.message}`);
    }
  };

  const removeSelected = async () => {
    try {
      await deleteProject(selected.id);
      setActionError('');
      setSelectedId(null);
    } catch (err) {
      setActionError(`Couldn’t delete the project. ${err.message}`);
    }
  };

  const card = selected ? (
    <ProjectCard
      key={selected.id}
      project={selected}
      onClose={() => setSelectedId(null)}
      onEdit={() => openEdit(selected)}
      onDelete={removeSelected}
    />
  ) : pin ? (
    <PinCard pin={pin} onClose={() => setPin(null)} onSave={openCreate} />
  ) : null;

  const zoomControls = (
    <div className="flex items-center gap-1.5 self-center rounded-full border border-[#2E3A66] bg-night p-1.5 shadow-lg">
      <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out" className="h-11 w-11 rounded-full bg-[#2A3560] text-2xl leading-none text-white">−</button>
      <span className="min-w-[52px] text-center text-[15px] font-semibold text-white">{Math.round(view.zoom * 100)}%</span>
      <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in" className="h-11 w-11 rounded-full bg-[#2A3560] text-2xl leading-none text-white">+</button>
      <button type="button" onClick={() => setView(START_VIEW)} className="h-11 rounded-full px-4 text-[15px] font-medium text-accent">Reset</button>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 px-4 py-5 sm:px-8 lg:min-h-0 lg:flex-1">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rust">Free sky viewer for everyone</p>
          <h1 className="font-display text-[28px] font-medium leading-[1.08] tracking-[-0.01em] sm:text-4xl lg:text-[clamp(28px,4.5vh,48px)]">Watch the night sky change.</h1>
          <p className="text-[15px] leading-relaxed text-muted sm:text-base">Drag the map to turn the sky, scroll to zoom. Click a project to see what it’s watching, or click any spot to start one.</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onOpenTutorial && (
              <button
                type="button"
                onClick={onOpenTutorial}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                <BookIcon />
                New here? How to use SkyFlip
              </button>
            )}
            <Link
              to={demoHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#FF8A3D] bg-[#FFF5EB] px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-[#FFE6CE] dark:bg-[#2A1E17] dark:hover:bg-[#38271C]"
            >
              <CompassIcon />
              Take the 2-minute demo
            </Link>
          </div>
        </div>
        <form role="search" onSubmit={(e) => { e.preventDefault(); if (matches[0]) openFound(matches[0]); }} className="relative flex w-full flex-col gap-2 lg:max-w-[540px]">
          <label htmlFor="project-search" className="text-[15px] font-semibold">Find a project</label>
          <div className="flex flex-wrap gap-2.5">
            <input
              id="project-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Search projects"
              autoComplete="off"
              aria-controls="project-search-results"
              className="field h-12 min-w-[160px] flex-1 rounded-xl"
            />
            <button type="submit" disabled={!matches.length} className="btn-primary h-12 rounded-xl px-5 text-base disabled:opacity-50">Search</button>
            <button
              type="button"
              onClick={pickRandomPatch}
              className="btn-plain h-12 rounded-xl px-4 text-base"
              title="Choose a random patch of sky"
            >
              <ShuffleIcon />
              Random patch
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-muted">Show on map:</span>
              <button
                type="button"
                onClick={() => setShowUserProjects((v) => !v)}
                aria-pressed={showUserProjects}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-all ${
                  showUserProjects
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line bg-surface/60 text-muted hover:border-ink hover:text-ink'
                }`}
                title={showUserProjects ? 'Hide user-created projects on sky map' : 'Show user-created projects on sky map'}
              >
                <span className={`h-2 w-2 rounded-full ${showUserProjects ? 'bg-accent' : 'bg-muted'}`} />
                User projects ({userProjectsCount})
              </button>
              <button
                type="button"
                onClick={() => setShowOfficialProjects((v) => !v)}
                aria-pressed={showOfficialProjects}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-all ${
                  showOfficialProjects
                    ? 'border-sky-500/50 bg-sky-500/15 text-ink'
                    : 'border-line bg-surface/60 text-muted hover:border-ink hover:text-ink'
                }`}
                title={showOfficialProjects ? 'Hide official benchmark targets on sky map' : 'Show official benchmark targets on sky map'}
              >
                <span className={`h-2 w-2 rounded-full ${showOfficialProjects ? 'bg-sky-400' : 'bg-muted'}`} />
                Official targets ({officialProjectsCount})
              </button>
            </div>
            {(!showUserProjects || !showOfficialProjects) && (
              <button
                type="button"
                onClick={() => { setShowUserProjects(true); setShowOfficialProjects(true); }}
                className="text-xs text-accent underline hover:opacity-80"
              >
                Show all
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="font-semibold text-muted">Sky light:</span>
            <button
              type="button"
              onClick={() => setSkySurvey('visible')}
              aria-pressed={skySurvey === 'visible'}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-all ${
                skySurvey === 'visible'
                  ? 'border-accent bg-accent/15 text-ink'
                  : 'border-line bg-surface/60 text-muted hover:border-ink hover:text-ink'
              }`}
              title="Show the real sky in optical visible light (DSS2)"
            >
              <span className={`h-2 w-2 rounded-full ${skySurvey === 'visible' ? 'bg-accent' : 'bg-muted'}`} />
              Visible light
            </button>
            <button
              type="button"
              onClick={() => setSkySurvey('infrared')}
              aria-pressed={skySurvey === 'infrared'}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-all ${
                skySurvey === 'infrared'
                  ? 'border-[#FF8A3D] bg-[#FF8A3D]/15 text-ink'
                  : 'border-line bg-surface/60 text-muted hover:border-ink hover:text-ink'
              }`}
              title="Show the real sky in infrared light (NASA SPHEREx)"
            >
              <span className={`h-2 w-2 rounded-full ${skySurvey === 'infrared' ? 'bg-[#FF8A3D]' : 'bg-muted'}`} />
              Infrared (SPHEREx)
            </button>
          </div>
          {q && (
            <ul id="project-search-results" aria-live="polite" className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-soft bg-surface p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
              {!loaded && !error ? (
                <li className="px-3 py-2.5 text-[15px] text-muted">Loading the saved projects…</li>
              ) : matches.length === 0 ? (
                <li className="px-3 py-2.5 text-[15px] text-muted">No projects match “{query.trim()}”. Click a spot on the map to start one.</li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => openFound(p)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-[#EEF1F8] focus:bg-[#EEF1F8] dark:hover:bg-[#1E294A] dark:focus:bg-[#1E294A] focus:outline-none">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold">{p.name}</span>
                          <span className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${p.isOfficial ? 'bg-sky-500/15 text-sky-400' : 'bg-accent/15 text-accent'}`}>
                            {p.isOfficial ? 'Official' : 'User'}
                          </span>
                          {((p.isUser && !showUserProjects) || (p.isOfficial && !showOfficialProjects)) && (
                            <span className="text-[11px] text-muted">(hidden on map)</span>
                          )}
                        </span>
                        {p.desc && <span className="block truncate text-sm text-muted">{p.desc}</span>}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </form>
      </div>

      {(error || actionError) && (
        <p role="alert" className="text-sm font-medium text-danger">{actionError || `Couldn’t load the saved projects. ${error}`}</p>
      )}

      {/* On large screens the map takes the height that is left, keeping its shape. */}
      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:items-center lg:justify-center lg:[container-type:size]">
      <div className="lg:w-[min(100cqw,100cqh*1640/780)] lg:[container-type:inline-size]">
      <SkyMap
        view={view}
        onView={setView}
        survey={skySurvey}
        projects={visibleProjects}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setPin(null); }}
        pin={pin}
        onPin={(spot) => { setPin(spot); setSelectedId(null); }}
      >
        <div
          data-map-ui
          className={`absolute ${cardSide === 'left-4' && card ? 'right-4' : 'left-4'} top-4 z-[8] hidden flex-wrap items-center gap-2 rounded-full border border-soft bg-surface/90 px-3 py-1.5 shadow-md backdrop-blur lg:flex`}
        >
          <span className="text-xs font-semibold text-muted">Sky:</span>
          <div className="inline-flex items-center rounded-full bg-soft p-0.5" role="group" aria-label="Sky light wavelength">
            <button
              type="button"
              onClick={() => setSkySurvey('visible')}
              aria-pressed={skySurvey === 'visible'}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                skySurvey === 'visible'
                  ? 'bg-accent text-[var(--color-accent-text,#0B1020)] shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
              title="Visible light · DSS2 (NASA/STScI)"
            >
              Visible
            </button>
            <button
              type="button"
              onClick={() => setSkySurvey('infrared')}
              aria-pressed={skySurvey === 'infrared'}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                skySurvey === 'infrared'
                  ? 'bg-[#FF8A3D] text-[#0B1020] shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
              title="Infrared · NASA SPHEREx"
            >
              Infrared
            </button>
          </div>
          <span className="h-3.5 w-px bg-soft" aria-hidden="true" />
          <span className="text-xs font-semibold text-muted">User projects:</span>
          <button
            type="button"
            onClick={() => setShowUserProjects((v) => !v)}
            aria-pressed={showUserProjects}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
              showUserProjects
                ? 'bg-accent text-[var(--color-accent-text,#0B1020)] shadow-sm'
                : 'bg-soft text-muted hover:text-ink'
            }`}
            title={showUserProjects ? 'Click to hide user-created projects' : 'Click to show user-created projects'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${showUserProjects ? 'bg-[var(--color-accent-text,#0B1020)]' : 'bg-muted'}`} />
            {showUserProjects ? 'Showing' : 'Hidden'} ({userProjectsCount})
          </button>
        </div>
        {card && (
          <div data-map-ui className={`absolute ${cardSide} top-4 z-10 hidden max-h-[calc(100%-2rem)] w-[380px] cursor-default overflow-y-auto rounded-[18px] lg:block`}>
            {card}
          </div>
        )}
        <div data-map-ui className="absolute bottom-4 left-4 z-[8] hidden cursor-default lg:block">
          <CoordInfo />
        </div>
        <div data-map-ui className="absolute bottom-4 right-4 z-[8] hidden cursor-default lg:block">
          {zoomControls}
        </div>
      </SkyMap>
      </div>
      </div>

      <p className="text-center text-sm text-muted lg:hidden">Drag to turn · Scroll or use the buttons to zoom · Click for coordinates</p>

      {/* On small screens the controls, card and explainer sit under the map instead of on it. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {zoomControls}
        {card}
        <CoordInfo />
      </div>

      {dialog && (
        <ProjectDialog
          title={dialog.editId ? 'Edit project' : 'Create a project'}
          sub={dialog.editId ? 'Update the details. The marker on the map changes to match.' : 'Give it a name and choose the spot in the sky you want to watch.'}
          submitLabel={dialog.editId ? 'Save changes' : 'Create project'}
          hint={dialog.editId
            ? 'Change the position and the marker moves with it.'
            : pin
              ? 'Position filled in from the pin you dropped on the map. You can change it.'
              : 'Tip: click anywhere on the sky map first and the position fills in for you.'}
          initial={dialog.initial}
          onSubmit={submitDialog}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
