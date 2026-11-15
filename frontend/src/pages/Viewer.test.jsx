import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Viewer from './Viewer';

describe('Viewer component smoke test', () => {
  it('renders without throwing when no spot is chosen', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/viewer']}>
        <Viewer />
      </MemoryRouter>
    );
    expect(html).toContain('Right Ascension');
    expect(html).toContain('Declination');
  });

  it('renders without throwing when a spot is chosen', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/viewer?ra=08h55m10.8s&dec=-07%C2%B014%E2%80%B242.5%E2%80%B3&band=6']}>
        <Viewer />
      </MemoryRouter>
    );
    expect(html).toContain('Right Ascension');
    expect(html).toContain('Declination');
    expect(html).toContain('Ruler');
  });
});
