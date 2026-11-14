import { useMemo } from 'react';
import { skyPatchGrid } from '../core/sky';

/**
 * SkyPatchGrid renders an equatorial Right Ascension (RA) and Declination (Dec)
 * coordinate graticule over the 256x256 sky patch viewport.
 *
 * Astronomical convention: North is UP (+Dec), East is LEFT (+RA).
 */
export default function SkyPatchGrid({ ra, dec, fov = 5 }) {
  const { decLines, raLines } = useMemo(
    () => skyPatchGrid(ra, dec, fov),
    [ra, dec, fov]
  );

  if (!decLines.length && !raLines.length) return null;

  return (
    <g aria-label="Right Ascension and Declination grid" className="pointer-events-none select-none">
      {/* 1. Declination Grid Lines & Edge Ticks */}
      {decLines.map((line) => (
        <g key={`dec-${line.dec}`}>
          {/* Subtle dashed line across the patch */}
          <line
            x1="0"
            y1={line.y}
            x2="256"
            y2={line.y}
            stroke="rgba(125, 211, 252, 0.35)"
            strokeWidth="0.75"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* Left and right border tick marks */}
          <line
            x1="0"
            y1={line.y}
            x2="4"
            y2={line.y}
            stroke="rgba(125, 211, 252, 0.75)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="252"
            y1={line.y}
            x2="256"
            y2={line.y}
            stroke="rgba(125, 211, 252, 0.75)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {/* Dec coordinate label placed along left border */}
          <text
            x="6"
            y={Math.max(9, Math.min(247, line.y - 2.5))}
            fontSize="6.5"
            fontFamily="monospace"
            fontWeight="600"
            fill="#BAE6FD"
            stroke="#04060D"
            strokeWidth="2.5"
            paintOrder="stroke fill"
          >
            {line.label}
          </text>
        </g>
      ))}

      {/* 2. Right Ascension Grid Lines & Edge Ticks */}
      {raLines.map((line) => {
        const isNearLeft = line.x < 32;
        const isNearRight = line.x > 224;
        const anchor = isNearLeft ? 'start' : isNearRight ? 'end' : 'middle';
        const labelX = isNearLeft ? 6 : isNearRight ? 250 : line.x;

        return (
          <g key={`ra-${line.ra}`}>
            {/* Subtle dashed line across the patch */}
            <line
              x1={line.x}
              y1="0"
              x2={line.x}
              y2="256"
              stroke="rgba(125, 211, 252, 0.35)"
              strokeWidth="0.75"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* Top and bottom border tick marks */}
            <line
              x1={line.x}
              y1="0"
              x2={line.x}
              y2="4"
              stroke="rgba(125, 211, 252, 0.75)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={line.x}
              y1="252"
              x2={line.x}
              y2="256"
              stroke="rgba(125, 211, 252, 0.75)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* RA coordinate label placed along bottom border */}
            <text
              x={labelX}
              y="250"
              textAnchor={anchor}
              fontSize="6.5"
              fontFamily="monospace"
              fontWeight="600"
              fill="#BAE6FD"
              stroke="#04060D"
              strokeWidth="2.5"
              paintOrder="stroke fill"
            >
              {line.label}
            </text>
          </g>
        );
      })}

      {/* 3. Astronomical Cardinal Compass Indicator (North UP, East LEFT) in bottom-left */}
      <g aria-hidden="true" className="opacity-80">
        {/* Origin at (22, 232) */}
        {/* North arrow: points UP */}
        <line x1="22" y1="232" x2="22" y2="219" stroke="#BAE6FD" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points="22,216 19.5,221 24.5,221" fill="#BAE6FD" />
        <text
          x="22"
          y="213"
          textAnchor="middle"
          fontSize="6"
          fontFamily="monospace"
          fontWeight="700"
          fill="#BAE6FD"
          stroke="#04060D"
          strokeWidth="2"
          paintOrder="stroke fill"
        >
          N
        </text>

        {/* East arrow: points LEFT */}
        <line x1="22" y1="232" x2="9" y2="232" stroke="#BAE6FD" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <polygon points="6,232 11,229.5 11,234.5" fill="#BAE6FD" />
        <text
          x="4"
          y="234.5"
          textAnchor="end"
          fontSize="6"
          fontFamily="monospace"
          fontWeight="700"
          fill="#BAE6FD"
          stroke="#04060D"
          strokeWidth="2"
          paintOrder="stroke fill"
        >
          E
        </text>
      </g>
    </g>
  );
}
