'use client';

import { useState } from 'react';
import { FinalRating } from '@/types/hr';

interface DistributionItem {
  rating: FinalRating;
  count: number;
  percentage: number;
}

interface Props {
  data: DistributionItem[];
}

const BAR_DEFAULT = '#0D2244'; /* --brand */
const BAR_HOVER = '#f97316'; /* orange-500 */
const TOOLTIP_BORDER = '#f97316'; /* orange-500 */

function yTicks(maxVal: number): number[] {
  if (maxVal === 0) return [0, 10, 20, 30, 40, 50];
  const step = Math.ceil((maxVal * 1.2) / 5 / 5) * 5 || 5;
  const top = Math.ceil((maxVal * 1.2) / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return ticks;
}

function labelLines(rating: FinalRating): string[] {
  return rating === 'Needs Improvement' ? ['Needs', 'Improvement'] : [rating];
}

export function RatingDistributionChart({ data }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const ticks = yTicks(maxCount);
  const yMax = ticks[ticks.length - 1];

  // SVG layout
  const W = 700;
  const H = 210;
  const PL = 54; // left padding for y-axis labels
  const PR = 20;
  const PT = 16;
  const PB = 46; // bottom padding for x-axis labels

  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const slotW = cW / data.length;
  const barW = slotW * 0.5;

  return (
    <div className="px-4 py-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ userSelect: 'none', overflow: 'visible' }}
      >
        {/* Horizontal grid lines + y-axis tick labels */}
        {ticks.map((tick) => {
          const y = PT + cH - (tick / yMax) * cH;
          return (
            <g key={tick}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Y-axis label (rotated) */}
        <text
          x={13}
          y={PT + cH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="#6b7280"
          transform={`rotate(-90,13,${PT + cH / 2})`}
        >
          Number of Employees
        </text>

        {/* Bars + x-axis labels */}
        {data.map((item, i) => {
          const barH = yMax > 0 ? (item.count / yMax) * cH : 0;
          const bx = PL + i * slotW + (slotW - barW) / 2;
          const by = PT + cH - barH;
          const cx = bx + barW / 2;
          const isHov = hovered === i;
          const lines = labelLines(item.rating);

          // Tooltip geometry
          const tW = 130;
          const tH = 54;
          const aH = 8; // arrow height
          const aHW = 7; // arrow half-width
          const tx = Math.max(PL, Math.min(W - PR - tW, cx - tW / 2));
          const ty = by - tH - aH - 6;
          const ax = Math.max(tx + aHW + 6, Math.min(tx + tW - aHW - 6, cx));

          return (
            <g
              key={item.rating}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              {/* Bar */}
              <rect
                x={bx}
                y={barH > 0 ? by : PT + cH}
                width={barW}
                height={Math.max(barH, 0)}
                fill={isHov ? BAR_HOVER : BAR_DEFAULT}
                rx={3}
                style={{ transition: 'fill 0.15s ease' }}
              />

              {/* X-axis label */}
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={cx}
                  y={PT + cH + 18 + li * 15}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#6b7280"
                >
                  {line}
                </text>
              ))}

              {/* Tooltip (rendered only when hovered) */}
              {isHov && (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Box */}
                  <rect
                    x={tx}
                    y={ty}
                    width={tW}
                    height={tH}
                    rx={6}
                    fill="white"
                    stroke={TOOLTIP_BORDER}
                    strokeWidth={1.5}
                  />
                  {/* White rect to erase box bottom-border at arrow junction */}
                  <rect x={ax - aHW} y={ty + tH - 1.5} width={aHW * 2} height={3} fill="white" />
                  {/* Arrow: filled white triangle */}
                  <path
                    d={`M ${ax - aHW},${ty + tH + 1} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH + 1} Z`}
                    fill="white"
                  />
                  {/* Arrow: two diagonal strokes only (no top edge) */}
                  <path
                    d={`M ${ax - aHW},${ty + tH} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH}`}
                    fill="none"
                    stroke={TOOLTIP_BORDER}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  {/* Tooltip text */}
                  <text x={tx + 12} y={ty + 22} fontSize={13} fontWeight="600" fill="#111827">
                    {item.count} {item.count === 1 ? 'Employee' : 'Employees'}
                  </text>
                  <text x={tx + 12} y={ty + 40} fontSize={12} fill="#6b7280">
                    {item.percentage}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
