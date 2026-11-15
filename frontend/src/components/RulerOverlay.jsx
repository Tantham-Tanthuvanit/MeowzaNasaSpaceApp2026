import { useMemo } from 'react';
import { getScaleBar } from '../core/ruler';

/**
 * RulerOverlay renders:
 * 1. An astronomical scale bar in the bottom-left corner of the 256x256 image canvas.
 * 2. An interactive two-point measurement line with endpoints, perpendicular ticks,
 *    and distance label when a measurement is active.
 */
export default function RulerOverlay({
  p1,
  p2,
  measurement,
  fov = 5.0,
  showScaleBar = true,
}) {
  const scaleBar = useMemo(() => getScaleBar(fov), [fov]);

  // Calculations for ruler line midpoint and angle
  const midX = p1 && p2 ? (p1.x + p2.x) / 2 : 0;
  const midY = p1 && p2 ? (p1.y + p2.y) / 2 : 0;

  // Normal vector for perpendicular end ticks
  const dx = p1 && p2 ? p2.x - p1.x : 0;
  const dy = p1 && p2 ? p2.y - p1.y : 0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 4;
  const ny = (dx / len) * 4;

  return (
    <g aria-label="Astronomical ruler and scale bar overlay" className="pointer-events-none select-none">
      {/* 1. On-Screen Astronomical Corner Scale Bar */}
      {showScaleBar && (
        <g id="scale-bar" className="transition-opacity duration-200">
          {/* Background backdrop pill for high readability */}
          <rect
            x="8"
            y="235"
            width={scaleBar.pxWidth + 14}
            height="15"
            rx="3"
            fill="rgba(4, 6, 13, 0.72)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="0.5"
          />

          {/* Scale bar text label */}
          <text
            x={15 + scaleBar.pxWidth / 2}
            y="242.5"
            textAnchor="middle"
            fontSize="5.5"
            fontFamily="monospace"
            fontWeight="600"
            fill="#BAE6FD"
            stroke="#04060D"
            strokeWidth="1.5"
            paintOrder="stroke fill"
          >
            {scaleBar.label}
          </text>

          {/* Main scale line */}
          <line
            x1="15"
            y1="246"
            x2={15 + scaleBar.pxWidth}
            y2="246"
            stroke="#38BDF8"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />

          {/* Left end tick */}
          <line
            x1="15"
            y1="243.5"
            x2="15"
            y2="247.5"
            stroke="#38BDF8"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />

          {/* Right end tick */}
          <line
            x1={15 + scaleBar.pxWidth}
            y1="243.5"
            x2={15 + scaleBar.pxWidth}
            y2="247.5"
            stroke="#38BDF8"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      {/* 2. Interactive Measurement Line between Point A and Point B */}
      {p1 && (
        <g id="ruler-measurement">
          {/* Point A Reticle */}
          <g>
            {/* Outer halo */}
            <circle cx={p1.x} cy={p1.y} r="5.5" fill="none" stroke="#04060D" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <circle cx={p1.x} cy={p1.y} r="5.5" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            {/* Center dot */}
            <circle cx={p1.x} cy={p1.y} r="1.5" fill="#38BDF8" />
            {/* Point A label */}
            <rect x={p1.x - 4} y={p1.y - 12} width="8" height="6.5" rx="1.5" fill="rgba(4, 6, 13, 0.85)" stroke="#38BDF8" strokeWidth="0.5" />
            <text x={p1.x} y={p1.y - 7.5} textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="#38BDF8">A</text>
          </g>

          {/* Connecting line and Point B if p2 exists */}
          {p2 && (
            <>
              {/* Dark outer contrast stroke */}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#04060D"
                strokeWidth="3.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Glowing cyan measurement line */}
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#38BDF8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Perpendicular end tick marks at A */}
              <line
                x1={p1.x - nx}
                y1={p1.y - ny}
                x2={p1.x + nx}
                y2={p1.y + ny}
                stroke="#38BDF8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Perpendicular end tick marks at B */}
              <line
                x1={p2.x - nx}
                y1={p2.y - ny}
                x2={p2.x + nx}
                y2={p2.y + ny}
                stroke="#38BDF8"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Point B Reticle */}
              <g>
                <circle cx={p2.x} cy={p2.y} r="5.5" fill="none" stroke="#04060D" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <circle cx={p2.x} cy={p2.y} r="5.5" fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                <circle cx={p2.x} cy={p2.y} r="1.5" fill="#F43F5E" />
                {/* Point B label */}
                <rect x={p2.x - 4} y={p2.y - 12} width="8" height="6.5" rx="1.5" fill="rgba(4, 6, 13, 0.85)" stroke="#F43F5E" strokeWidth="0.5" />
                <text x={p2.x} y={p2.y - 7.5} textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="#F43F5E">B</text>
              </g>

              {/* Distance pill badge centered on the measurement line */}
              {measurement && (
                <g>
                  <rect
                    x={midX - 22}
                    y={midY - 6}
                    width="44"
                    height="11"
                    rx="3"
                    fill="rgba(4, 6, 13, 0.88)"
                    stroke="#38BDF8"
                    strokeWidth="0.75"
                  />
                  <text
                    x={midX}
                    y={midY + 1.5}
                    textAnchor="middle"
                    fontSize="5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#FFFFFF"
                  >
                    {measurement.distanceArcsec >= 60
                      ? `${measurement.distanceArcmin}′ (${measurement.distanceArcsec}″)`
                      : `${measurement.distanceArcsec}″`}
                  </text>
                </g>
              )}
            </>
          )}
        </g>
      )}
    </g>
  );
}
