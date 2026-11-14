import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_PROJECT_NAMES,
  isOfficialProject,
  isUserProject,
  fromApi,
} from './projects';

describe('Project classification and filtering', () => {
  it('correctly identifies official benchmark targets', () => {
    OFFICIAL_PROJECT_NAMES.forEach((name) => {
      expect(isOfficialProject({ name })).toBe(true);
      expect(isUserProject({ name })).toBe(false);
    });

    // Case-insensitive & trimmed matching
    expect(isOfficialProject({ name: '  wise 0855  ' })).toBe(true);
    expect(isOfficialProject({ name: "barnard's star" })).toBe(true);
  });

  it('correctly identifies user-created projects', () => {
    const userProjects = [
      { name: 'My Moving Object' },
      { name: 'Test Project 1' },
      { name: 'Alpha Centauri Hunt' },
      { name: 'Random Patch Discovery' },
    ];

    userProjects.forEach((proj) => {
      expect(isOfficialProject(proj)).toBe(false);
      expect(isUserProject(proj)).toBe(true);
    });
  });

  it('handles null, undefined, or empty names safely', () => {
    expect(isOfficialProject(null)).toBe(false);
    expect(isOfficialProject({})).toBe(false);
    expect(isOfficialProject({ name: '' })).toBe(false);
    expect(isUserProject(null)).toBe(true);
    expect(isUserProject({})).toBe(true);
  });

  it('fromApi attaches isOfficial and isUser flags', () => {
    const officialRow = {
      id: 7,
      name: 'WISE 0855',
      description: 'Cold brown dwarf',
      color: '#5AB4FF',
      ra_deg: 133.795,
      dec_deg: -7.245,
      bands: [1, 2, 3, 4, 5, 6],
      created_at: '2026-11-14T03:39:46.589Z',
    };
    const officialParsed = fromApi(officialRow);
    expect(officialParsed.isOfficial).toBe(true);
    expect(officialParsed.isUser).toBe(false);
    expect(officialParsed.id).toBe('7');

    const userRow = {
      id: 42,
      name: 'User Brown Dwarf Search',
      description: 'Searching for faint dipoles',
      color: '#FF8A3D',
      ra_deg: 210.5,
      dec_deg: 15.2,
      bands: [1, 6],
      created_at: '2026-11-14T10:00:00.000Z',
    };
    const userParsed = fromApi(userRow);
    expect(userParsed.isOfficial).toBe(false);
    expect(userParsed.isUser).toBe(true);
    expect(userParsed.id).toBe('42');
  });

  it('filters project list by user-created toggle state', () => {
    const projects = [
      fromApi({ id: 5, name: "Barnard's Star", color: '#FF8A3D', ra_deg: 10, dec_deg: 20, bands: [1], created_at: '2026-01-01' }),
      fromApi({ id: 7, name: 'WISE 0855', color: '#5AB4FF', ra_deg: 20, dec_deg: 30, bands: [6], created_at: '2026-01-01' }),
      fromApi({ id: 10, name: 'User Hunt 1', color: '#7EE0B5', ra_deg: 30, dec_deg: 40, bands: [1], created_at: '2026-01-01' }),
      fromApi({ id: 11, name: 'User Hunt 2', color: '#C9A7FF', ra_deg: 40, dec_deg: 50, bands: [2], created_at: '2026-01-01' }),
    ];

    // When showUserProjects is true: all 4 are visible
    const whenShowAll = projects.filter((p) => p.isOfficial || true);
    expect(whenShowAll.length).toBe(4);

    // When showUserProjects is false: only official projects are visible
    const whenHideUser = projects.filter((p) => !p.isUser);
    expect(whenHideUser.length).toBe(2);
    expect(whenHideUser.map((p) => p.name)).toEqual(["Barnard's Star", 'WISE 0855']);
  });
});
