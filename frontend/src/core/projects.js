// Saved projects, stored in Supabase through the backend's /api/projects. Everyone sees the
// same list (there is no login yet).
//
// Project (as the UI uses it): { id, name, desc, color, ra, dec, bands, created }  (ra/dec in degrees)

import { useEffect, useState } from 'react';
import { createProject, listProjects, patchProject, removeProject } from '../services/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtCreated(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// API row -> UI project. Ids are strings so they compare with the ?project= address-bar value.
function fromApi(p) {
  return { id: String(p.id), name: p.name, desc: p.description, color: p.color, ra: p.ra_deg, dec: p.dec_deg, bands: p.bands, created: fmtCreated(p.created_at) };
}

// UI fields -> API fields, leaving out anything not given.
function toApi(fields) {
  const names = { name: 'name', desc: 'description', color: 'color', ra: 'ra_deg', dec: 'dec_deg', bands: 'bands' };
  return Object.fromEntries(Object.entries(names).filter(([k]) => fields[k] !== undefined).map(([k, api]) => [api, fields[k]]));
}

// The last list we saw, so moving between pages doesn't flash an empty map.
let known = null;

export function useProjects() {
  const [projects, setProjects] = useState(known || []);
  const [loaded, setLoaded] = useState(known !== null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    listProjects().then(
      (rows) => {
        if (!current) return;
        known = rows.map(fromApi);
        setProjects(known);
        setLoaded(true);
      },
      (err) => current && setError(err.message)
    );
    return () => {
      current = false;
    };
  }, []);

  const save = (list) => {
    known = list;
    setProjects(list);
  };

  return {
    projects,
    loaded,
    error,
    // fields: { name, desc, color, ra, dec, bands? }. Resolves to the new id.
    async addProject(fields) {
      const p = fromApi(await createProject(toApi(fields)));
      save([...(known || []), p]);
      return p.id;
    },
    async updateProject(id, fields) {
      const p = fromApi(await patchProject(id, toApi(fields)));
      save((known || []).map((x) => (x.id === id ? p : x)));
    },
    async deleteProject(id) {
      await removeProject(id);
      save((known || []).filter((x) => x.id !== id));
    },
  };
}
