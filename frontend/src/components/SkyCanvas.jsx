import { useEffect, useRef } from 'react';
import { MAP_W, MAP_H, MAP_RX, MAP_RY } from '../core/sky';

const VS = `
attribute vec2 a_pos;
varying vec2 v_pos;
void main() {
  v_pos = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FS = `
precision highp float;
uniform sampler2D u_sky;
uniform vec2 u_res;
uniform vec2 u_center;
uniform vec2 u_radii;
uniform float u_zoom;
uniform float u_rot;
uniform float u_tilt;

const float PI = 3.14159265358979323846;
const float SQRT2 = 1.41421356237309504880;

void main() {
  // Screen pixel (px, py) with (0,0) at top-left
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  
  // Normalized Aitoff space
  float X = (u_center.x - px.x) / (u_radii.x * u_zoom);
  float Y = (u_center.y - px.y) / (u_radii.y * u_zoom);
  
  if (X * X + Y * Y > 1.0) {
    gl_FragColor = vec4(0.043, 0.071, 0.188, 1.0); // #0B1230
    return;
  }
  
  float x = 2.0 * SQRT2 * X;
  float y = SQRT2 * Y;
  float z = sqrt(max(0.0, 1.0 - (x * 0.25) * (x * 0.25) - (y * 0.5) * (y * 0.5)));
  
  float lon = 2.0 * atan(z * x, 2.0 * (2.0 * z * z - 1.0));
  float lat = asin(clamp(z * y, -1.0, 1.0));
  
  float x2 = cos(lat) * cos(lon);
  float y2 = cos(lat) * sin(lon);
  float z2 = sin(lat);
  
  float t = u_tilt;
  float x1 = x2 * cos(t) - z2 * sin(t);
  float z1 = x2 * sin(t) + z2 * cos(t);
  
  float angle = atan(y2, x1) + u_rot;
  float dec = asin(clamp(z1, -1.0, 1.0));
  
  float u = fract(angle / (2.0 * PI));
  float v = clamp(0.5 - (dec / PI), 0.0, 1.0);
  
  vec4 star = texture2D(u_sky, vec2(u, v));
  // Boost contrast slightly for beautiful deep sky display
  vec3 rgb = star.rgb * 1.15;
  gl_FragColor = vec4(rgb, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compilation failed: ' + info);
  }
  return shader;
}

export default function SkyCanvas({ view }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const uniformsRef = useRef(null);
  const loadedRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const renderRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' })
        || canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { alpha: false, antialias: true });
    } catch {
      return;
    }
    if (!gl) return;
    glRef.current = gl;

    let program;
    let vs;
    let fs;
    try {
      vs = createShader(gl, gl.VERTEX_SHADER, VS);
      fs = createShader(gl, gl.FRAGMENT_SHADER, FS);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Program linking failed: ' + gl.getProgramInfoLog(program));
      }
    } catch (err) {
      console.warn('WebGL init error:', err);
      return;
    }

    gl.useProgram(program);

    // Quad geometry: two triangles covering clip space [-1, 1]
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      u_res: gl.getUniformLocation(program, 'u_res'),
      u_center: gl.getUniformLocation(program, 'u_center'),
      u_radii: gl.getUniformLocation(program, 'u_radii'),
      u_zoom: gl.getUniformLocation(program, 'u_zoom'),
      u_rot: gl.getUniformLocation(program, 'u_rot'),
      u_tilt: gl.getUniformLocation(program, 'u_tilt'),
      u_sky: gl.getUniformLocation(program, 'u_sky'),
    };
    uniformsRef.current = uniforms;

    const render = () => {
      if (!glRef.current || !uniformsRef.current) return;
      const g = glRef.current;
      const u = uniformsRef.current;
      const v = viewRef.current;

      g.viewport(0, 0, MAP_W, MAP_H);
      g.uniform2f(u.u_res, MAP_W, MAP_H);
      g.uniform2f(u.u_center, MAP_W / 2, MAP_H / 2);
      g.uniform2f(u.u_radii, MAP_RX, MAP_RY);
      g.uniform1f(u.u_zoom, v.zoom);
      g.uniform1f(u.u_rot, (v.rot * Math.PI) / 180);
      g.uniform1f(u.u_tilt, (v.tilt * Math.PI) / 180);

      g.drawArrays(g.TRIANGLES, 0, 6);
    };
    renderRef.current = render;

    // Load texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Placeholder 1x1 dark blue pixel while loading
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 18, 48, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const img = new Image();
    img.onload = () => {
      if (!glRef.current) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      loadedRef.current = true;
      render();
    };
    img.onerror = () => {
      if (!img.src.endsWith('.jpg')) {
        img.src = '/skymap_equatorial.jpg';
      }
    };
    img.src = '/skymap_equatorial.webp';

    render();

    return () => {
      if (gl) {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
      glRef.current = null;
      loadedRef.current = false;
      renderRef.current = null;
    };
  }, []);

  // Re-render when view changes
  useEffect(() => {
    if (loadedRef.current && renderRef.current) {
      renderRef.current();
    }
  }, [view.rot, view.tilt, view.zoom]);

  return (
    <canvas
      ref={canvasRef}
      width={MAP_W}
      height={MAP_H}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none rounded-2xl"
    />
  );
}
