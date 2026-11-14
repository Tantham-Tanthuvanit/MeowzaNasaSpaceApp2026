import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SkyMap from '../components/SkyMap';
import ProjectDialog from '../components/ProjectDialog';
import { ProjectCard, PinCard, CoordInfo } from '../components/MapCards';
import { useProjects } from '../core/projects';
import { MARKER_COLORS } from '../core/targets';
import { MAP_W, MAX_ZOOM, project, clamp, fmtRa, fmtDec } from '../core/sky';

const START_VIEW = { rot: 0, tilt: 0, zoom: 1 };
const centredOn = (p) => ({ rot: p.ra, tilt: p.dec, zoom: 1 });

export default function Home() {
  const { projects, loaded, error, addProject, updateProject, deleteProject } = useProjects();
  const [params] = useSearchParams();

  // Coming back from the viewer with ?project=id opens that project on the map.
  const arrived = projects.find((p) => p.id === params.get('project'));
  const [view, setView] = useState(arrived ? centredOn(arrived) : START_VIEW);
  const [selectedId, setSelectedId] = useState(arrived ? arrived.id : null);
  const [pin, setPin] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [dialog, setDialog] = useState(null); // null | { editId, initial }
  const [actionError, setActionError] = useState('');

  // The project list loads from the server, so ?project=id may only resolve once it arrives.
  useEffect(() => {
    if (loaded && arrived && selectedId === null) {
      setSelectedId(arrived.id);
      setView(centredOn(arrived));
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = projects.find((p) => p.id === selectedId) || null;
  // The open card docks on the side of the map away from the marker or pin it describes.
  const spot = selected ? [selected.ra, selected.dec] : pin;
  const cardSide = spot && project(spot[0], spot[1], view)[0] > MAP_W / 2 ? 'left-4' : 'right-4';
  const zoomBy = (f) => setView((v) => ({ ...v, zoom: clamp(v.zoom * f, 1, MAX_ZOOM) }));

  const openCreate = (name) =>
    setDialog({
      editId: null,
      initial: {
        name,
        desc: '',
        ra: pin ? fmtRa(pin[0], true) : '',
        dec: pin ? fmtDec(pin[1], true) : '',
        color: MARKER_COLORS[projects.length % MARKER_COLORS.length].color,
      },
    });

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
      setDraftName('');
      setPin(null);
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
    <PinCard pin={pin} onClose={() => setPin(null)} onSave={() => openCreate('')} />
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
          <p className="text-[15px] leading-relaxed text-muted sm:text-base">Drag the map to turn the sky, scroll to zoom. Click a project to see what it’s watching.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); openCreate(draftName); }} className="flex w-full flex-col gap-2 lg:max-w-[480px]">
          <label htmlFor="start-name" className="text-[15px] font-semibold">Start a project</label>
          <div className="flex flex-wrap gap-3">
            <input id="start-name" type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Enter project name" className="field h-12 min-w-[180px] flex-1 rounded-xl" />
            <button type="submit" className="btn-primary h-12 rounded-xl px-6 text-base">Create project</button>
          </div>
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
        projects={projects}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setPin(null); }}
        pin={pin}
        onPin={(spot) => { setPin(spot); setSelectedId(null); }}
      >
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
