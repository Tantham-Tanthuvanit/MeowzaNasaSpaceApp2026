import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Intro from './Intro';

describe('Intro (welcome page)', () => {
  it('tells the story and links to the map, the demo and the challenge', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Intro />
      </MemoryRouter>
    );
    expect(html).toContain('Flip through the sky');
    expect(html).toContain('href="/map"');
    expect(html).toContain('/viewer?demo=1');
    expect(html).toContain('spaceappschallenge.org/2026/challenges/planet-x-and-spherex');
    expect(html).toContain('Why we built SkyFlip');
  });

  it('shows a loading state, not stand-in pictures, before the SPHEREx pictures arrive', () => {
    const html = renderToString(
      <MemoryRouter>
        <Intro />
      </MemoryRouter>
    );
    expect(html).not.toContain('<img');
  });
});
