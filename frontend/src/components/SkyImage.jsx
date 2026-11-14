import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_W, MAP_H, MAP_RX, MAP_RY } from '../core/sky';
import { renderSky, MAX_ORDER } from '../core/skyImage';
import { loadSky, requestTiles, retryTiles } from '../services/skyTiles';

const QUICK = 2; // while the map is moving it is drawn at half size, then sharpened when it rests
const REST_MS = 140;

// The real SPHEREx picture of the sky, drawn under the grid and markers of the Home map.
export default function SkyImage({ view }) {
  const canvasRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const buf = useRef(null);
  const timer = useRef(0);
  const [src, setSrc] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [missing, setMissing] = useState(false); // some sharp tiles failed to load
  const [sharpening, setSharpening] = useState(false); // sharp tiles are on their way
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    loadSky().then(
      (s) => { if (live) { setSrc(s); setStatus('ready'); } },
      () => { if (live) setStatus('error'); },
    );
    return () => { live = false; };
  }, [attempt]);

  // Working memory, made once: full-size and half-size pixel buffers and the tile wish list.
  if (!buf.current && typeof document !== 'undefined') {
    const small = document.createElement('canvas');
    small.width = MAP_W / QUICK;
    small.height = MAP_H / QUICK;
    const wanted = {};
    for (let k = 1; k <= MAX_ORDER; k++) wanted[k] = new Uint8Array(12 * 4 ** k);
    buf.current = { small, full: new ImageData(MAP_W, MAP_H), half: new ImageData(MAP_W / QUICK, MAP_H / QUICK), wanted };
  }

  const drawSharp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!src || !canvas) return;
    const { full, wanted } = buf.current;
    for (let k = 1; k <= MAX_ORDER; k++) wanted[k].fill(0);
    const order = renderSky(new Uint32Array(full.data.buffer), MAP_W, MAP_H, viewRef.current, src, wanted);
    canvas.getContext('2d').putImageData(full, 0, 0);
    if (order === 0) { setMissing(false); setSharpening(false); return; }
    const { failed, pending } = requestTiles(src, wanted, order, (ok) => {
      // A tile arrived or failed: redraw at rest, without the half-size step.
      clearTimeout(timer.current);
      timer.current = setTimeout(drawSharp, ok ? 60 : 0);
    });
    setMissing(failed > 0);
    setSharpening(pending > 0);
  }, [src]);

  // The view moved: draw a quick half-size picture now, the sharp one when the map rests.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!src || !canvas) return undefined;
    const { small, half } = buf.current;
    const frame = requestAnimationFrame(() => {
      renderSky(new Uint32Array(half.data.buffer), half.width, half.height, viewRef.current, src, null);
      small.getContext('2d').putImageData(half, 0, 0);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      ctx.drawImage(small, 0, 0, MAP_W, MAP_H);
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(drawSharp, REST_MS);
    return () => cancelAnimationFrame(frame);
  }, [src, drawSharp, view.rot, view.tilt, view.zoom]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const retry = () => {
    if (status === 'error') setAttempt((n) => n + 1);
    else { retryTiles(); setMissing(false); drawSharp(); }
  };

  const rx = (MAP_RX * view.zoom * 100) / MAP_W, ry = (MAP_RY * view.zoom * 100) / MAP_H;
  const problem = status === 'error'
    ? 'Couldn’t load the real picture of the sky from NASA.'
    : missing ? 'Couldn’t load the sharper picture for part of this view.' : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={MAP_W}
        height={MAP_H}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ clipPath: `ellipse(${rx}% ${ry}% at 50% 50%)` }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[7] flex justify-center px-3 lg:top-auto lg:bottom-4 lg:pl-[430px] lg:pr-[280px]">
        {status === 'loading' && (
          <p role="status" className="rounded-full bg-[rgba(7,11,24,0.82)] px-4 py-2 text-sm text-white">Loading the real picture of the sky from NASA…</p>
        )}
        {problem && (
          <p role="alert" data-map-ui className="pointer-events-auto flex cursor-default flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-[rgba(7,11,24,0.88)] px-4 py-2 text-center text-sm text-white">
            {problem}
            <button type="button" onClick={retry} className="font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Try again</button>
          </p>
        )}
        {status === 'ready' && !problem && sharpening && (
          <p role="status" className="rounded-full bg-[rgba(7,11,24,0.82)] px-4 py-2 text-sm text-white">Loading a sharper picture…</p>
        )}
        {status === 'ready' && !problem && !sharpening && (
          <p className="hidden rounded-full bg-[rgba(7,11,24,0.6)] px-3 py-1 text-[13px] text-[#D5DCF0] lg:block">Real picture of the sky in infrared light · NASA SPHEREx</p>
        )}
      </div>
    </>
  );
}
