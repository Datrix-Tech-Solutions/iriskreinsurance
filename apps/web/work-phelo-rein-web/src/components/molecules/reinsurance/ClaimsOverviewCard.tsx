'use client';

import { useState } from 'react';
import { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useReinsuranceClaimStats, useReinsuranceClaimsTrend } from '@/hooks';
import { cardClass } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';

const CLAIMS_COLOR = '#d03b3b';
const RECOVERIES_COLOR = '#0ca30c';
const OUTSTANDING_COLOR = '#ec835a';

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(2)}K`;
  else formatted = value.toFixed(2);
  return symbol ? `${symbol} ${formatted}` : formatted;
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' });
}

function formatMonthLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 1.5, 2, 3, 4, 5, 7.5, 10];
  for (const step of steps) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

interface ClaimsOverviewCardProps {
  period: Period;
  currency: string;
}

export function ClaimsOverviewCard({ period, currency }: ClaimsOverviewCardProps) {
  const {
    totalAmount: claimsIncurred,
    recoveriesAmount,
    outstandingAmount,
    isLoading: loadingStats,
  } = useReinsuranceClaimStats({
    period,
    currency,
  });
  const {
    data: trend,
    currencySymbol: sym,
    isLoading: loadingTrend,
  } = useReinsuranceClaimsTrend({ currency });

  const isLoading = loadingStats || loadingTrend;
  const [hovered, setHovered] = useState<number | null>(null);
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';

  const W = 700;
  const H = 150;
  const PL = 68;
  const PR = 12;
  const PT = 10;
  const PB = 34;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const maxAmt = niceMax(Math.max(...trend.map((d) => d.claimsIncurred), 1));
  const yTicks = Array.from({ length: 4 }, (_, i) => (i / 3) * maxAmt);

  function toY(amt: number) {
    return PT + cH - (amt / maxAmt) * cH;
  }

  const groupW = cW / Math.max(trend.length, 1);
  const barW = Math.min(7, groupW / 4);
  const barGap = 2;

  const maxLabels = Math.min(6, trend.length);
  const labelStep = Math.max(1, Math.floor((trend.length - 1) / (maxLabels - 1)));
  const labelIndices = new Set(
    Array.from({ length: maxLabels }, (_, i) => Math.min(i * labelStep, trend.length - 1)),
  );

  return (
    <div className={cardClass('flex flex-col gap-3 p-5 h-80', 'glass')}>
      <h3 className="text-sm font-semibold text-gray-900">Claims Overview</h3>

      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CLAIMS_COLOR }} />
            Claims Incurred
          </span>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-sm font-bold text-gray-900 truncate">
              {fmtAmount(claimsIncurred, sym)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: RECOVERIES_COLOR }}
            />
            Recoveries Received
          </span>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-sm font-bold text-gray-900 truncate">
              {fmtAmount(recoveriesAmount, sym)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: OUTSTANDING_COLOR }}
            />
            Outstanding
          </span>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-sm font-bold text-gray-900 truncate">
              {fmtAmount(outstandingAmount, sym)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ userSelect: 'none', overflow: 'visible' }}
          >
            {yTicks.map((tick, i) => {
              const y = toY(tick);
              return (
                <g key={i}>
                  <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={gridStroke} strokeWidth={1} />
                  <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={17} fill="#9ca3af">
                    {fmtAmount(tick, '')}
                  </text>
                </g>
              );
            })}

            {trend.map((d, i) => {
              const groupX = PL + i * groupW + groupW / 2;
              const bars = [
                { label: 'Claims Incurred', value: d.claimsIncurred, color: CLAIMS_COLOR },
                { label: 'Recoveries Received', value: 0, color: RECOVERIES_COLOR },
                { label: 'Outstanding', value: 0, color: OUTSTANDING_COLOR },
              ];
              const isHov = hovered === i;

              const tW = 148;
              const tH = 62;
              const aH = 6;
              const aHW = 5;
              const topY = toY(Math.max(...bars.map((b) => b.value)));
              const tx = Math.max(PL, Math.min(W - PR - tW, groupX - tW / 2));
              const ty = topY - tH - aH - 6;
              const ax = Math.max(tx + aHW + 4, Math.min(tx + tW - aHW - 4, groupX));

              return (
                <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                  <rect x={PL + i * groupW} y={PT} width={groupW} height={cH} fill="transparent" />
                  {bars.map((b, j) => {
                    const x = groupX - ((barW + barGap) * 3) / 2 + j * (barW + barGap);
                    const y = toY(b.value);
                    const h = PT + cH - y;
                    return (
                      <rect
                        key={j}
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(h, 1)}
                        rx={1.5}
                        fill={b.color}
                        opacity={isHov ? 1 : hovered === null ? 1 : 0.4}
                        style={{ transition: 'opacity 0.15s ease' }}
                      />
                    );
                  })}
                  {labelIndices.has(i) && (
                    <text
                      x={groupX}
                      y={PT + cH + 24}
                      textAnchor="middle"
                      fontSize={17}
                      fill="#9ca3af"
                    >
                      {formatMonth(d.month)}
                    </text>
                  )}
                  {isHov && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect
                        x={tx}
                        y={ty}
                        width={tW}
                        height={tH}
                        rx={8}
                        fill="var(--chip-dark,#111827)"
                      />
                      <path
                        d={`M ${ax - aHW},${ty + tH} L ${ax},${ty + tH + aH} L ${ax + aHW},${ty + tH} Z`}
                        fill="var(--chip-dark,#111827)"
                      />
                      <text x={tx + 10} y={ty + 15} fontSize={11} fontWeight="600" fill="#ffffff">
                        {formatMonthLong(d.month)}
                      </text>
                      {bars.map((b, j) => (
                        <g key={j}>
                          <circle cx={tx + 12} cy={ty + 28 + j * 13} r={2.5} fill={b.color} />
                          <text x={tx + 20} y={ty + 31 + j * 13} fontSize={10} fill="#9ca3af">
                            {b.label}
                          </text>
                          <text
                            x={tx + tW - 10}
                            y={ty + 31 + j * 13}
                            textAnchor="end"
                            fontSize={10}
                            fontWeight="600"
                            fill="#ffffff"
                          >
                            {fmtAmount(b.value, sym)}
                          </text>
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
