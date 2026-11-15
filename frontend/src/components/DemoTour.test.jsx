import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ADVANCED_STEPS, DEMO_STEPS, DEMO_SUBJECT, DEMO_TARGET, demoHref, parseDemo } from './DemoTour';
import { pickPictures } from './DemoFocus';
import Viewer from '../pages/Viewer';

describe('demo steps', () => {
  it('parses beginner and advanced steps and rejects anything else', () => {
    expect(parseDemo('1')).toMatchObject({ advanced: false, index: 0 });
    expect(parseDemo('5')).toMatchObject({ advanced: false, index: 4 });
    expect(parseDemo('a2')).toMatchObject({ advanced: true, index: 1 });
    for (const bad of [null, '', '0', '6', 'a3', 'x']) expect(parseDemo(bad)).toBeNull();
  });

  it('every step has a known scene or view', () => {
    expect(DEMO_STEPS.map((s) => s.scene)).toEqual(['look', 'flip', 'compare', 'subtract', 'found']);
    for (const s of ADVANCED_STEPS) expect(['flipbook', 'split', 'changes', 'combine']).toContain(s.view);
  });

  it('beginner links go to the demo subject, advanced links to WISE 0855', () => {
    expect(demoHref('1')).toContain(`ra=${encodeURIComponent(DEMO_SUBJECT.ra)}`);
    expect(demoHref('a1')).toContain(`ra=${encodeURIComponent(DEMO_TARGET.ra)}`);
    expect(demoHref('a2')).toContain('band=all');
  });
});

describe('pickPictures', () => {
  const at = (...mjds) => mjds.map((mjd) => ({ mjd, image_url: `u${mjd}` }));
  const rock = (seenMjd) => ({ kind: 'asteroid', seenMjd });

  it('finds the visit the asteroid is in and the visit before it', () => {
    expect(pickPictures(at(100, 200, 300), rock(200.2))).toEqual({ hit: 1, empty: 0 });
  });

  it('uses the next visit when the asteroid is in the first one', () => {
    expect(pickPictures(at(100, 200), rock(100.1))).toEqual({ hit: 0, empty: 1 });
  });

  it('returns null when no visit matches, or there is nothing to compare with', () => {
    expect(pickPictures(at(100, 200), rock(150))).toBeNull();
    expect(pickPictures(at(100), rock(100))).toBeNull();
  });

  it('the line example matches a real visit time and opens the wide band 1 view', () => {
    expect(DEMO_SUBJECT.kind).toBe('streak');
    expect(demoHref('1')).toContain('band=1');
    expect(demoHref('1')).toContain('fov=15');
    expect(demoHref('a1')).not.toContain('fov=');
  });
});

describe('Viewer in demo mode', () => {
  it('shows only the focus view for a beginner step', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={[demoHref('1')]}>
        <Viewer />
      </MemoryRouter>
    ).replace(/<!-- -->/g, '');
    expect(html).toContain('Step 1 of 5');
    expect(html).toContain('Leave demo');
    expect(html).not.toContain('Right Ascension');
  });

  it('shows the full viewer with the card for an advanced step', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={[demoHref('a1')]}>
        <Viewer />
      </MemoryRouter>
    ).replace(/<!-- -->/g, '');
    expect(html).toContain('Advanced tour, part 1 of 2');
    expect(html).toContain('Right Ascension');
  });
});
