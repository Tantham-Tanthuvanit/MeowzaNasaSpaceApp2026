// Saved projects. They live in this browser's localStorage for now; when the backend
// gains project storage, only this file needs to change.
//
// Project: { id, name, desc, color, ra, dec, star, kind, bands, created }  (ra/dec in degrees)

import { useState } from 'react';
import { SEED_PROJECTS, ALL_BANDS } from './targets';

const KEY = 'skyflip_projects';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Unreadable or blocked storage: fall through to the examples.
  }
  return SEED_PROJECTS;
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: the projects still work until the page is closed.
  }
}

function today() {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function useProjects() {
  const [projects, setProjects] = useState(load);

  const save = (list) => {
    setProjects(list);
    store(list);
  };

  return {
    projects,
    // fields: { name, desc, color, ra, dec, star?, kind?, bands? }. Returns the new id.
    addProject(fields) {
      const id = 'p' + Date.now();
      save([
        ...projects,
        { star: 'Your own spot', kind: 'Custom position', bands: ALL_BANDS, ...fields, id, created: today() },
      ]);
      return id;
    },
    // Moving a project to a new position means it no longer watches its original star.
    updateProject(id, fields) {
      save(
        projects.map((p) => {
          if (p.id !== id) return p;
          const moved = Math.abs(p.ra - fields.ra) > 1e-3 || Math.abs(p.dec - fields.dec) > 1e-3;
          return { ...p, ...fields, ...(moved ? { star: 'Your own spot', kind: 'Custom position' } : {}) };
        })
      );
    },
    deleteProject(id) {
      save(projects.filter((p) => p.id !== id));
    },
  };
}
