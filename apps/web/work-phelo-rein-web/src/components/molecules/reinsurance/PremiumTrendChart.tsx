'use client';

import { useState } from 'react';
import { useThemeStore } from '@/store/theme.store';

export interface PremiumDataPoint {
  date: string;
  amount: number;
}

interface PremiumTrendChartProps {
  data: PremiumDataPoint[];
  currency?: string;
  /** Hex/CSS color for the line, area, and dots. Defaults to the current module's color. */
  color?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function formatAmount(v: number): string {
  return v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(1)}K`
      : v.toFixed(0);
}

export function PremiumTrendChart({
  data,
  currency,
  color = 'var(--module-btn-bg, var(--brand))',
}: PremiumTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        No premium history available yet.
      </div>
    );
  }

  const W = 700;
  const H = 220;
  const PL = 76;
  const PR = 24;
  const PT = 20;
  const PB = 48;

  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const amounts = data.map((d) => d.amount);
  const minAmt = Math.min(...amounts);
  const maxAmt = Math.max(...amounts);
  const spread = maxAmt - minAmt || 1;
  const padded = spread * 0.15;
  const yMin = Math.max(0, minAmt - padded);
  const yMax = maxAmt + padded;
  const yRange = yMax - yMin;

  function toX(i: number) {
    return PL + (i / Math.max(data.length - 1, 1)) * cW;
  }
  function toY(amt: number) {
    return PT + cH - ((amt - yMin) / yRange) * cH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)},${toY(d.amount).toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L ${toX(data.length - 1).toFixed(1)},${(PT + cH).toFixed(1)}` +
    ` L ${toX(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  const maxLabels = Math.min(6, data.length);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));
  const labelIndices = Array.from({ length: maxLabels }, (_, i) =>
    Math.min(i * labelStep, data.length - 1),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ userSelect: 'none', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.6} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid + Y labels */}
      {yTicks.map((tick, i) => {
        const y = toY(tick);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={gridStroke} strokeWidth={1} />
            <text x={PL - 8} y={y + 5} textAnchor="end" fontSize={17} fill="#9ca3af">
              {formatAmount(tick)}
            </text>
          </g>
        );
      })}

      {/* Area */}
      <path d={areaPath} fill="url(#premiumGradient)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* X labels */}
      {labelIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={PT + cH + 22}
          textAnchor="middle"
          fontSize={17}
          fill="#9ca3af"
        >
          {formatDate(data[idx].date)}
        </text>
      ))}

      {/* Dots + tooltips */}
      {data.map((d, i) => {
        const cx = toX(i);
        const cy = toY(d.amount);
        const isHov = hovered === i;
        const tW = 128;
        const tH = 38;
        const aH = 6;
        const aHW = 5;
        const tx = Math.max(PL, Math.min(W - PR - tW, cx - tW / 2));
        const ty = cy - tH - aH - 6;
        const ax = Math.max(tx + aHW + 4, Math.min(tx + tW - aHW - 4, cx));

        return (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <rect
              x={cx - cW / data.length / 2}
              y={PT}
              width={cW / data.length}
              height={cH}
              fill="transparent"
            />
            <circle
              cx={cx}
              cy={cy}
              r={isHov ? 10 : 8}
              fill={color}
              opacity={0.16}
              style={{ transition: 'r 0.1s ease' }}
            />
            <circle
              cx={cx}
              cy={cy}
              r={isHov ? 5.5 : 4.5}
              fill={color}
              style={{ transition: 'r 0.1s ease' }}
            />
            {isHov && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={tW} height={tH} rx={8} fill="var(--chip-dark,#111827)" />
                <path
                  d={`M ${ax - aHW},${ty + tH} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH} Z`}
                  fill="var(--chip-dark,#111827)"
                />
                <text x={tx + 10} y={ty + 16} fontSize={12} fontWeight="600" fill="#ffffff">
                  {currency ? `${currency} ` : ''}
                  {d.amount.toLocaleString()}
                </text>
                <text x={tx + 10} y={ty + 30} fontSize={10} fill="#9ca3af">
                  {formatDateLong(d.date)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
